import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges } from '../shared/colleges_loader'
import { parsePdf } from '../shared/pdf'
import { parseZjToudang } from './zhejiang'
import { parseJsToudangExcel, parseJsToudangPdf } from './jiangsu'
import { validateScoreRecord } from './validate'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  OUTPUT_DIR,
  SCORES_OUTPUT_DIR,
  SCORES_REPORTS_DIR,
  LOGS_DIR,
  TARGET_YEARS,
  ZJ_TOUDANG_URLS,
  JS_TOUDANG_URLS,
} from '../config'
import type {
  ScoreRecord,
  ScoresMeta,
  FailedRecord,
  ScoreWarningRecord,
  CollegeRecord,
} from '../types'

const logger = createLogger('scores')

interface CliArgs {
  force: boolean
  province?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const provinceArg = args.find((a) => a.startsWith('--province='))
  return {
    force: args.includes('--force'),
    province: provinceArg ? provinceArg.split('=')[1] : undefined,
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始投档线采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    province: args.province ?? '全部',
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SCORES_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // Step 1: 加载院校白名单（按院校名建立索引）
  const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
  if (!fs.existsSync(collegesPath)) {
    logger.error('colleges.json 不存在，请先运行 scrape:colleges', { path: collegesPath })
    process.exit(2)
  }

  const collegesById = loadColleges(collegesPath)
  const collegesByName = new Map<string, CollegeRecord>()
  for (const college of collegesById.values()) {
    collegesByName.set(college.name, college)
  }
  logger.info('院校白名单加载完成', { count: collegesByName.size })

  // Step 2-3: 下载并解析投档线文件
  const http = new HttpClient(path.join(process.cwd(), 'raw', 'scores'))
  const allScores: ScoreRecord[] = []
  const failed: FailedRecord[] = []
  const warnings: ScoreWarningRecord[] = []
  const stats: Array<{ province: string; year: number; category?: string; count: number; matched: number }> = []

  const shouldProcessZhejiang = !args.province || args.province === '浙江'
  const shouldProcessJiangsu = !args.province || args.province === '江苏'

  // 浙江投档线（专业级，Excel）
  if (shouldProcessZhejiang) {
    for (const year of TARGET_YEARS) {
      const urlConfig = ZJ_TOUDANG_URLS[year]
      if (!urlConfig) {
        logger.warn('浙江投档线 URL 未配置', { year })
        continue
      }

      try {
        logger.info('下载浙江投档线 Excel', { year, url: urlConfig.xlsUrl })
        const result = await http.fetchBinary(urlConfig.xlsUrl, {
          cacheKey: `zj_toudang_${year}.xls`,
          forceRefresh: args.force,
        })

        logger.info('解析浙江投档线', { year, bufferSize: result.buffer.length })
        const records = parseZjToudang(result.buffer, year, urlConfig.pageUrl)
        logger.info('浙江投档线解析完成', { year, count: records.length })

        // Step 4: 关联白名单
        const matched = matchColleges(records, collegesByName, warnings)
        allScores.push(...records)
        stats.push({ province: '浙江', year, count: records.length, matched })
      } catch (error) {
        logger.error('浙江投档线采集失败', { year, error: (error as Error).message })
        failed.push({
          url: urlConfig.xlsUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `浙江 ${year}`,
        })
      }
    }
  }

  // 江苏投档线（院校专业组级，Excel/PDF）
  if (shouldProcessJiangsu) {
    for (const year of TARGET_YEARS) {
      const urlConfig = JS_TOUDANG_URLS[year]
      if (!urlConfig) {
        logger.warn('江苏投档线 URL 未配置', { year })
        continue
      }

      for (const category of ['物理类', '历史类'] as const) {
        const fileConfig = urlConfig.files[category]
        if (!fileConfig) {
          logger.warn('江苏投档线 URL 未配置', { year, category })
          continue
        }

        try {
          logger.info('下载江苏投档线', { year, category, format: fileConfig.format, url: fileConfig.url })
          const result = await http.fetchBinary(fileConfig.url, {
            cacheKey: `js_toudang_${year}_${category}.${fileConfig.format}`,
            forceRefresh: args.force,
          })

          let records: ScoreRecord[]
          if (fileConfig.format === 'xls') {
            logger.info('解析江苏投档线 Excel', { year, category })
            records = parseJsToudangExcel(result.buffer, year, category, fileConfig.pageUrl)
          } else {
            logger.info('解析江苏投档线 PDF', { year, category })
            const text = await parsePdf(result.buffer)
            records = parseJsToudangPdf(text, year, category, fileConfig.pageUrl)
          }

          logger.info('江苏投档线解析完成', { year, category, count: records.length })

          // Step 4: 关联白名单
          const matched = matchColleges(records, collegesByName, warnings)
          allScores.push(...records)
          stats.push({ province: '江苏', year, category, count: records.length, matched })
        } catch (error) {
          logger.error('江苏投档线采集失败', {
            year, category, error: (error as Error).message,
          })
          failed.push({
            url: fileConfig.url,
            error: (error as Error).message,
            retryCount: 3,
            context: `江苏 ${year} ${category}`,
          })
        }
      }
    }
  }

  // Step 5: 校验与产出
  const validated: ScoreRecord[] = []
  const rejected: Array<{ record: Partial<ScoreRecord>; reason: string }> = []

  for (const record of allScores) {
    const result = validateScoreRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  // 按 province/year 分组写入
  for (const province of ['浙江', '江苏']) {
    if (args.province && args.province !== province) continue

    const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
    fs.mkdirSync(provinceDir, { recursive: true })

    for (const year of TARGET_YEARS) {
      const records = validated.filter(
        (s) => s.province === province && s.year === year
      )
      const outputPath = path.join(provinceDir, `scores_${year}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8')
      logger.info('投档线文件已写入', {
        province, year, count: records.length, path: outputPath,
      })
    }
  }

  // 写入元信息
  const meta = buildScoresMeta(validated)
  const metaPath = path.join(SCORES_OUTPUT_DIR, 'scores.meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(SCORES_REPORTS_DIR, 'failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (warnings.length > 0) {
    fs.writeFileSync(
      path.join(SCORES_REPORTS_DIR, 'warnings.json'),
      JSON.stringify(warnings, null, 2),
      'utf-8'
    )
  }
  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(SCORES_REPORTS_DIR, 'rejected.json'),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[投档线采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    ...stats.map((s) =>
      s.category
        ? `${s.province} ${s.year} ${s.category}: ${s.count} 条 (匹配 ${s.matched}/${s.count})`
        : `${s.province} ${s.year}: ${s.count} 条 (匹配 ${s.matched}/${s.count})`
    ),
    '------------------------------------------------------',
    `总计产出:   ${validated.length} 条`,
    `校验拒绝:   ${rejected.length} 条`,
    `未匹配:     ${warnings.length} 条 (warnings.json)`,
    `失败:       ${failed.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)

  const logPath = path.join(LOGS_DIR, `scrape-scores-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')

  if (failed.length > 0) {
    process.exit(1)
  }
}

/**
 * 三级院校名匹配策略，填充 collegeId 和 verified 字段。
 * 返回匹配成功的记录数。
 */
function matchColleges(
  records: ScoreRecord[],
  collegesByName: Map<string, CollegeRecord>,
  warnings: ScoreWarningRecord[]
): number {
  let matched = 0

  for (const record of records) {
    const result = matchCollege(record.collegeName, collegesByName)

    if (result.collegeId) {
      record.collegeId = result.collegeId
      record._meta.verified = true
      matched++
    } else {
      record.collegeId = ''
      record._meta.verified = false
      // 避免重复 warning（同一院校名只记一次）
      if (!warnings.some((w) => w.collegeName === record.collegeName && w.year === record.year)) {
        warnings.push({
          collegeId: '',
          collegeName: record.collegeName,
          type: 'missing_data',
          detail: `未在 colleges.json 中找到匹配院校 (${record.province} ${record.year})`,
        })
      }
    }
  }

  return matched
}

/**
 * 三级匹配：精确 → 去后缀 → 包含
 */
function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): { collegeId: string; matchType: string } {
  // 1. 精确匹配
  const exact = collegesByName.get(name)
  if (exact) {
    return { collegeId: exact.id, matchType: 'exact' }
  }

  // 2. 去除括号后缀匹配（如"浙江大学(中外合作办学)" → "浙江大学"）
  const bracketIndex = name.indexOf('(')
  if (bracketIndex > 0) {
    const stripped = name.substring(0, bracketIndex).trim()
    const strippedMatch = collegesByName.get(stripped)
    if (strippedMatch) {
      return { collegeId: strippedMatch.id, matchType: 'stripped' }
    }
  }

  // 3. 包含匹配（投档线名包含 colleges.json 名，或反之）
  for (const [collegeName, college] of collegesByName) {
    if (collegeName.includes(name) || name.includes(collegeName)) {
      return { collegeId: college.id, matchType: 'contains' }
    }
  }

  return { collegeId: '', matchType: 'none' }
}

function buildScoresMeta(records: ScoreRecord[]): ScoresMeta {
  const provinces = (['浙江', '江苏'] as const).map((name) => {
    const years = TARGET_YEARS
    const scoreRecordCount: Record<number, number> = {}
    const rankTableRecordCount: Record<number, number> = {}

    for (const year of years) {
      scoreRecordCount[year] = records.filter(
        (r) => r.province === name && r.year === year
      ).length
      rankTableRecordCount[year] = 0
    }

    return { name, years, scoreRecordCount, rankTableRecordCount }
  })

  return {
    provinces,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    sources: [
      {
        name: '浙江省教育考试院',
        url: 'https://www.zjzs.net/',
        coverage: '专业级投档线 2023-2025',
      },
      {
        name: '江苏省教育考试院',
        url: 'https://www.jseea.cn/',
        coverage: '院校专业组级投档线 2023-2025',
      },
    ],
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('投档线采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
