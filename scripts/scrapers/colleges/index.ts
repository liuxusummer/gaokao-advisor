import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { parseMoeList, parseMoeExcel, extractMoeExcelUrl } from './moe_list'
import { parseGaokaoList, buildGaokaoUrl } from './gaokao_detail'
import { matchAndMerge, validateRecord } from './merge'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  MOE_LIST_URL,
  GAOKAO_QPS,
  RAW_DIR,
  OUTPUT_DIR,
  REPORTS_DIR,
  LOGS_DIR,
} from '../config'
import type {
  CollegeRecord,
  CollegesMeta,
  FailedRecord,
  RejectedRecord,
  GaokaoRecord,
} from '../types'

const logger = createLogger('colleges')

interface CliArgs {
  force: boolean
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始院校数据采集', {
    version: SCRAPER_VERSION,
    force: args.force,
    dryRun: args.dryRun,
  })

  // 确保输出目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(RAW_DIR, 'colleges'))

  // Step 1: 教育部名单（2025 年度起以 Excel 附件形式发布）
  logger.info('Step 1: 抓取教育部名单', { url: MOE_LIST_URL })
  const moeResult = await http.fetch(MOE_LIST_URL, {
    cacheKey: 'moe_list',
    forceRefresh: args.force,
  })

  // 尝试从发布页提取 Excel 附件 URL
  const excelUrl = extractMoeExcelUrl(moeResult.html, MOE_LIST_URL)
  let moeRecords: import('../types').MoeRecord[]

  if (excelUrl) {
    logger.info('检测到 Excel 附件，下载并解析', { excelUrl })
    const excelResult = await http.fetchBinary(excelUrl, {
      cacheKey: 'moe_list_excel',
      forceRefresh: args.force,
    })
    moeRecords = parseMoeExcel(excelResult.buffer, MOE_LIST_URL)
  } else {
    // 回退到 HTML 表格解析（旧版兼容）
    logger.info('未检测到 Excel 附件，回退到 HTML 表格解析')
    moeRecords = parseMoeList(moeResult.html, MOE_LIST_URL)
  }

  logger.info('教育部名单解析完成', { count: moeRecords.length })

  if (moeRecords.length === 0) {
    logger.error('教育部名单解析 0 条，终止', { url: MOE_LIST_URL })
    process.exit(2)
  }

  // Step 2: 阳光高考列表
  // 注：阳光高考站点的 province URL 参数不会过滤结果，而是返回全局列表。
  // 因此改为直接分页抓取全局列表，通过 schId 去重检测终止。
  logger.info('Step 2: 抓取阳光高考院校列表（全局分页）')
  const gaokaoRecords: GaokaoRecord[] = []
  const failed: FailedRecord[] = []
  const requestInterval = 1000 / GAOKAO_QPS
  const seenGaokaoIds = new Set<string>()
  const MAX_GAOKAO_PAGES = 200 // 安全上限：200 页 × 20 条 = 4000

  for (let page = 1; page <= MAX_GAOKAO_PAGES; page++) {
    const url = buildGaokaoUrl('', page)
    try {
      const result = await http.fetch(url, {
        cacheKey: `gaokao_global_${page}`,
        forceRefresh: args.force,
      })
      const records = parseGaokaoList(result.html, url)

      if (records.length === 0) {
        logger.info('阳光高考分页结束：0 条记录', { page })
        break
      }

      // 检测重复：如果本页所有 schId 都已见过，说明已到达末尾
      const newRecords = records.filter((r) => !seenGaokaoIds.has(r.gaokaoId))
      if (newRecords.length === 0) {
        logger.info('阳光高考分页结束：全部为重复记录', { page })
        break
      }

      for (const r of newRecords) {
        seenGaokaoIds.add(r.gaokaoId)
        gaokaoRecords.push(r)
      }

      if (page % 20 === 0) {
        logger.info('阳光高考抓取进度', { page, total: gaokaoRecords.length })
      }

      // 不足 20 条说明是最后一页
      if (records.length < 20) {
        logger.info('阳光高考分页结束：不足 20 条', { page, count: records.length })
        break
      }

      await sleep(requestInterval)
    } catch (error) {
      failed.push({
        url,
        error: (error as Error).message,
        retryCount: 3,
        context: `global page=${page}`,
      })
      break
    }
  }

  logger.info('阳光高考抓取完成', {
    total: gaokaoRecords.length,
    failed: failed.length,
  })

  // Step 3-4: 匹配与合并
  logger.info('Step 3-4: 双源匹配与字段合并')
  const { records, warnings } = matchAndMerge(moeRecords, gaokaoRecords)
  logger.info('合并完成', {
    total: records.length,
    warnings: warnings.length,
  })

  // Step 5: 校验与产出
  logger.info('Step 5: 校验与产出')
  const validated: CollegeRecord[] = []
  const rejected: RejectedRecord[] = []

  for (const record of records) {
    const result = validateRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  // 去重：ID 唯一性
  const seen = new Set<string>()
  const deduped: CollegeRecord[] = []
  for (const record of validated) {
    if (seen.has(record.id)) {
      rejected.push({ record, reason: `ID 重复: ${record.id}` })
    } else {
      seen.add(record.id)
      deduped.push(record)
    }
  }

  // 写入 colleges.json
  const outputPath = path.join(OUTPUT_DIR, 'colleges.json')
  fs.writeFileSync(outputPath, JSON.stringify(deduped, null, 2), 'utf-8')
  logger.info('colleges.json 已写入', { path: outputPath, count: deduped.length })

  // 写入 colleges.meta.json
  const meta = buildMetaFile(deduped, moeResult.fetchedAt)
  const metaPath = path.join(OUTPUT_DIR, 'colleges.meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
  logger.info('colleges.meta.json 已写入', { path: metaPath })

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (warnings.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'warnings.json'),
      JSON.stringify(warnings, null, 2),
      'utf-8'
    )
  }
  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'rejected.json'),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `教育部名单: ${moeRecords.length} 条`,
    `阳光高考:   ${gaokaoRecords.length} 条（抓取失败 ${failed.length} 条）`,
    `最终产出:   ${deduped.length} 条`,
    `校验拒绝:   ${rejected.length} 条`,
    `警告:       ${warnings.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)

  // 写入日志文件
  const logPath = path.join(LOGS_DIR, `scrape-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')

  // 退出码
  if (rejected.length > 0) {
    process.exit(1)
  }
}

function buildMetaFile(
  records: CollegeRecord[],
  moeFetchedAt: string
): CollegesMeta {
  const byProvince: Record<string, number> = {}
  const byLevel: Record<string, number> = {}
  let publicCount = 0
  let privateCount = 0

  for (const r of records) {
    byProvince[r.province] = (byProvince[r.province] || 0) + 1
    for (const lv of r.level) {
      byLevel[lv] = (byLevel[lv] || 0) + 1
    }
    if (r.nature === 'public') publicCount++
    else if (r.nature === 'private') privateCount++
  }

  return {
    totalCount: records.length,
    publicCount,
    privateCount,
    byProvince,
    byLevel,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [
      {
        name: '教育部全国高等学校名单',
        url: MOE_LIST_URL,
        fetchedAt: moeFetchedAt,
        recordCount: records.length,
      },
    ],
    schemaVersion: SCHEMA_VERSION,
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  logger.error('采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
