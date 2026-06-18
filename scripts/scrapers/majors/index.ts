import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { parsePdf } from '../shared/pdf'
import { parseCatalog } from './parse'
import { validateCatalogRecord } from './validate'
import {
  SCRAPER_VERSION,
  MOE_CATALOG_PDF_URL,
  MOE_CATALOG_PAGE_URL,
  RAW_DIR,
  OUTPUT_DIR,
  REPORTS_DIR,
  LOGS_DIR,
} from '../config'
import type { MajorCatalogRecord } from '../types'

const logger = createLogger('majors')

interface CliArgs {
  force: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return { force: args.includes('--force') }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始专业目录采集', { force: args.force })

  fs.mkdirSync(path.join(OUTPUT_DIR, 'majors'), { recursive: true })
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(RAW_DIR, 'majors'))

  // Step 1: 下载 PDF
  logger.info('Step 1: 下载教育部专业目录 PDF', { url: MOE_CATALOG_PDF_URL })
  const pdfResult = await http.fetchBinary(MOE_CATALOG_PDF_URL, {
    cacheKey: 'catalog.pdf',
    forceRefresh: args.force,
  })
  logger.info('PDF 下载完成', { size: pdfResult.buffer.length })

  // Step 2: PDF 文本提取
  logger.info('Step 2: PDF 文本提取')
  const text = await parsePdf(pdfResult.buffer)

  // 缓存提取的文本
  const textCachePath = path.join(RAW_DIR, 'majors', 'catalog.txt')
  fs.writeFileSync(textCachePath, text, 'utf-8')

  // Step 3: 解析
  logger.info('Step 3: 解析专业目录')
  const records = parseCatalog(text, MOE_CATALOG_PAGE_URL)
  logger.info('解析完成', { count: records.length })

  // Step 4: 校验
  const validated: MajorCatalogRecord[] = []
  const rejected: Array<{ record: MajorCatalogRecord; reason: string }> = []

  for (const record of records) {
    const result = validateCatalogRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  logger.info('校验完成', { valid: validated.length, rejected: rejected.length })

  // Step 5: 写入 catalog.json
  const outputPath = path.join(OUTPUT_DIR, 'majors', 'catalog.json')
  fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2), 'utf-8')
  logger.info('catalog.json 已写入', { path: outputPath, count: validated.length })

  // 写入 meta.json
  const meta = {
    totalCount: validated.length,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [
      {
        name: '教育部普通高等学校本科专业目录',
        url: MOE_CATALOG_PAGE_URL,
        fetchedAt: pdfResult.fetchedAt,
        recordCount: validated.length,
      },
    ],
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'majors', 'catalog.meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8'
  )

  // 写入 rejected 报告
  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'majors_rejected.json'),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[专业目录采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `专业总数:   ${validated.length} 条`,
    `校验失败:   ${rejected.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(
    path.join(LOGS_DIR, `scrape-majors-${Date.now()}.log`),
    report,
    'utf-8'
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('专业目录采集异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
