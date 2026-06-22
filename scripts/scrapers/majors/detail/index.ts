import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../../shared/http.js'
import {
  SCRAPER_VERSION,
  RAW_DIR,
  MAJOR_DETAIL_OUTPUT_DIR,
  MAJOR_DETAIL_OUTPUT_FILE,
  MAJOR_DETAIL_META_FILE,
  MAJOR_DETAIL_PARTIAL_FILE,
  MAJOR_DETAIL_FAILED_FILE,
  REPORTS_DIR,
  UNDERGRADUATE_ROOT_KEY,
  VOCATIONAL_ROOT_KEY,
  GAOKAO_QPS,
} from '../../config.js'
import { crawlCatalog, type FailedMajor } from './crawler.js'
import type { DetailedMajorRecord, DetailedCatalogFileMeta } from '../../types.js'

function parseArgs(): { force: boolean; dryRun: boolean } {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
  }
}

function loadPartial(): DetailedMajorRecord[] {
  if (fs.existsSync(MAJOR_DETAIL_PARTIAL_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(MAJOR_DETAIL_PARTIAL_FILE, 'utf-8'))
      console.log(`[断点续采] 加载 ${data.length} 条已采集记录`)
      return data
    } catch {
      console.warn('[断点续采] partial 文件解析失败，从头开始')
    }
  }
  return []
}

function savePartial(records: DetailedMajorRecord[]): void {
  fs.writeFileSync(MAJOR_DETAIL_PARTIAL_FILE, JSON.stringify(records, null, 2), 'utf-8')
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs()

  // 创建目录
  fs.mkdirSync(MAJOR_DETAIL_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(REPORTS_DIR, { recursive: true })

  const client = new HttpClient(path.join(RAW_DIR, 'majors_detail'))

  // 断点续采
  const existingRecords = loadPartial()
  const allRecords: DetailedMajorRecord[] = [...existingRecords]
  const allFailed: FailedMajor[] = []

  // 采集本科
  console.log('\n=== 采集本科（普通教育）专业目录 ===')
  console.log(`QPS: ${GAOKAO_QPS}（间隔 ${1000 / GAOKAO_QPS}ms）\n`)

  const undergradResult = await crawlCatalog(
    client,
    UNDERGRADUATE_ROOT_KEY,
    '本科（普通教育）',
    (current, total, majorName) => {
      const percent = ((current / total) * 100).toFixed(1)
      console.log(`  [本科] ${majorName} (${current}/${total}, ${percent}%)`)
    },
  )
  allRecords.push(...undergradResult.records)
  allFailed.push(...undergradResult.failed)
  const undergradCount = undergradResult.records.length
  console.log(`\n[本科] 完成: ${undergradCount} 条记录, ${undergradResult.failed.length} 条失败`)

  // 保存 partial
  savePartial(allRecords)

  // 采集专科
  console.log('\n=== 采集高职（专科）专业目录 ===\n')

  const vocationalResult = await crawlCatalog(
    client,
    VOCATIONAL_ROOT_KEY,
    '高职（专科）',
    (current, total, majorName) => {
      const percent = ((current / total) * 100).toFixed(1)
      console.log(`  [专科] ${majorName} (${current}/${total}, ${percent}%)`)
    },
  )
  allRecords.push(...vocationalResult.records)
  allFailed.push(...vocationalResult.failed)
  const vocationalCount = vocationalResult.records.length
  console.log(`\n[专科] 完成: ${vocationalCount} 条记录, ${vocationalResult.failed.length} 条失败`)

  // 汇总
  console.log('\n=== 采集完成 ===')
  console.log(`本科: ${undergradCount} 条`)
  console.log(`专科: ${vocationalCount} 条`)
  console.log(`总计: ${allRecords.length} 条记录, ${allFailed.length} 条失败`)

  if (dryRun) {
    console.log('\n[dry-run] 跳过写入输出文件')
    return
  }

  // 写入主输出文件
  fs.writeFileSync(MAJOR_DETAIL_OUTPUT_FILE, JSON.stringify(allRecords, null, 2), 'utf-8')
  console.log(`\n写入: ${MAJOR_DETAIL_OUTPUT_FILE}`)

  // 写入 meta 文件
  const meta: DetailedCatalogFileMeta = {
    totalCount: allRecords.length,
    undergraduateCount: undergradCount,
    vocationalCount,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [
      {
        name: '阳光高考专业库-本科（普通教育）',
        url: `https://gaokao.chsi.com.cn/zyk/zybk/mlCategory/${UNDERGRADUATE_ROOT_KEY}`,
        recordCount: undergradCount,
      },
      {
        name: '阳光高考专业库-高职（专科）',
        url: `https://gaokao.chsi.com.cn/zyk/zybk/mlCategory/${VOCATIONAL_ROOT_KEY}`,
        recordCount: vocationalCount,
      },
    ],
  }
  fs.writeFileSync(MAJOR_DETAIL_META_FILE, JSON.stringify(meta, null, 2), 'utf-8')
  console.log(`写入: ${MAJOR_DETAIL_META_FILE}`)

  // 写入失败报告
  if (allFailed.length > 0) {
    fs.writeFileSync(MAJOR_DETAIL_FAILED_FILE, JSON.stringify(allFailed, null, 2), 'utf-8')
    console.log(`写入失败报告: ${MAJOR_DETAIL_FAILED_FILE}`)
  }

  // 清理 partial 文件
  if (fs.existsSync(MAJOR_DETAIL_PARTIAL_FILE)) {
    fs.unlinkSync(MAJOR_DETAIL_PARTIAL_FILE)
    console.log('清理断点续采临时文件')
  }
}

main().catch((err) => {
  console.error('采集失败:', err)
  process.exit(2)
})
