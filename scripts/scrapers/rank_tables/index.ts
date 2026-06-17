import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { parseZjTable } from './zhejiang'
import { parseJsTable } from './jiangsu'
import { validateRankRecord, validateRankTableMonotonicity } from './validate'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  ZJ_RANK_TABLE_URLS,
  JS_RANK_TABLE_URLS,
  SCORES_OUTPUT_DIR,
  LOGS_DIR,
  TARGET_YEARS,
} from '../config'
import type {
  RankTableRecord,
  RankTableFile,
} from '../types'

const logger = createLogger('rank_tables')

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

  logger.info('开始一分一段表采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    dryRun: args.dryRun,
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'rank_tables'))
  const results: Array<{ province: string; year: number; count: number }> = []
  const errors: Array<{ province: string; year: number; category?: string; error: string }> = []

  // 浙江（综合类单表）
  for (const year of TARGET_YEARS) {
    const url = ZJ_RANK_TABLE_URLS[year]
    if (!url) {
      logger.warn('浙江一分一段表 URL 未配置', { year })
      errors.push({ province: '浙江', year, error: 'URL 未配置' })
      continue
    }

    try {
      logger.info('抓取浙江一分一段表', { year, url })
      const result = await http.fetch(url, {
        cacheKey: `zj_rank_${year}`,
        forceRefresh: args.force,
      })
      const records = parseZjTable(result.html, year, url)

      // 校验
      const validated = records.filter((r) => validateRankRecord(r).valid)
      const monotonicity = validateRankTableMonotonicity(validated)
      if (!monotonicity.valid) {
        logger.warn('浙江一分一段表单调性校验失败', { year, reason: monotonicity.reason })
      }

      // 写入文件
      await writeRankTableFile('浙江', year, { '综合': validated })
      results.push({ province: '浙江', year, count: validated.length })
      logger.info('浙江一分一段表完成', { year, count: validated.length })
    } catch (error) {
      logger.error('浙江一分一段表抓取失败', { year, error: (error as Error).message })
      errors.push({ province: '浙江', year, error: (error as Error).message })
    }
  }

  // 江苏（物理类 + 历史类双表）
  for (const year of TARGET_YEARS) {
    const urls = JS_RANK_TABLE_URLS[year]
    if (!urls || (!urls['物理类'] && !urls['历史类'])) {
      logger.warn('江苏一分一段表 URL 未配置', { year })
      errors.push({ province: '江苏', year, error: 'URL 未配置' })
      continue
    }

    const categories: Record<string, RankTableRecord[]> = {}

    for (const category of ['物理类', '历史类'] as const) {
      const url = urls[category]
      if (!url) {
        logger.warn('江苏一分一段表 URL 未配置', { year, category })
        errors.push({ province: '江苏', year, category, error: 'URL 未配置' })
        continue
      }

      try {
        logger.info('抓取江苏一分一段表', { year, category, url })
        const result = await http.fetch(url, {
          cacheKey: `js_rank_${year}_${category}`,
          forceRefresh: args.force,
        })
        const records = parseJsTable(result.html, year, category, url)

        // 校验
        const validated = records.filter((r) => validateRankRecord(r).valid)
        const monotonicity = validateRankTableMonotonicity(validated)
        if (!monotonicity.valid) {
          logger.warn('江苏一分一段表单调性校验失败', {
            year, category, reason: monotonicity.reason,
          })
        }

        categories[category] = validated
      } catch (error) {
        logger.error('江苏一分一段表抓取失败', {
          year, category, error: (error as Error).message,
        })
        errors.push({ province: '江苏', year, category, error: (error as Error).message })
      }
    }

    const totalCount = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0)
    if (totalCount > 0) {
      await writeRankTableFile('江苏', year, categories)
      results.push({ province: '江苏', year, count: totalCount })
      logger.info('江苏一分一段表完成', { year, count: totalCount })
    }
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[一分一段表采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    ...results.map((r) => `${r.province} ${r.year}: ${r.count} 条`),
    '------------------------------------------------------',
    `总计产出:   ${results.reduce((sum, r) => sum + r.count, 0)} 条`,
    `失败:       ${errors.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)

  const logPath = path.join(LOGS_DIR, `scrape-rank-tables-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')
}

async function writeRankTableFile(
  province: string,
  year: number,
  categories: Record<string, RankTableRecord[]>
): Promise<void> {
  const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
  fs.mkdirSync(provinceDir, { recursive: true })

  const totalCount = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0)
  const file: RankTableFile = {
    province,
    year,
    categories,
    _meta: {
      generatedAt: new Date().toISOString(),
      scraperVersion: SCRAPER_VERSION,
      source: province === '浙江' ? 'zjzs' : 'jseea',
      sourceUrl: province === '浙江'
        ? ZJ_RANK_TABLE_URLS[year] || ''
        : (JS_RANK_TABLE_URLS[year]?.['物理类'] || ''),
      recordCount: totalCount,
    },
  }

  const outputPath = path.join(provinceDir, `rank_table_${year}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(file, null, 2), 'utf-8')
  logger.info('一分一段表文件已写入', { province, year, count: totalCount, path: outputPath })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('一分一段表采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
