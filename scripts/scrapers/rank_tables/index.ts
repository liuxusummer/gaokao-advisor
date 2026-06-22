import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { validateRankRecord, validateRankTableMonotonicity } from './validate'
import { ensureRegistryInitialized } from '../shared/registry_init'
import { getProvince, getEnabledProvinces } from '../shared/province_registry'
import {
  SCRAPER_VERSION,
  SCORES_OUTPUT_DIR,
  LOGS_DIR,
  TARGET_YEARS,
} from '../config'
import type { RankTableRecord, RankTableFile } from '../types'

const logger = createLogger('rank_tables')

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

  ensureRegistryInitialized()

  logger.info('开始一分一段表采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    province: args.province ?? '全部',
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'rank_tables'))
  const results: Array<{ province: string; year: number; count: number }> = []
  const errors: Array<{ province: string; year: number; error: string }> = []

  const provinces = args.province
    ? [getProvince(args.province)!].filter(Boolean)
    : getEnabledProvinces()

  for (const reg of provinces) {
    if (!reg.rankTableScraper) {
      logger.warn('省份未注册一分一段表适配器，跳过', { province: reg.meta.name })
      continue
    }

    for (const year of TARGET_YEARS) {
      try {
        logger.info('采集一分一段表', { province: reg.meta.name, year })
        const { records, failed } = await reg.rankTableScraper.scrape(http, year, {
          force: args.force,
        })

        if (records.length === 0) {
          logger.warn('一分一段表无数据', { province: reg.meta.name, year })
          continue
        }

        // 按科类分组
        const categories: Record<string, RankTableRecord[]> = {}
        for (const record of records) {
          if (!categories[record.category]) {
            categories[record.category] = []
          }
          categories[record.category].push(record)
        }

        // 校验
        const validatedCategories: Record<string, RankTableRecord[]> = {}
        for (const [category, catRecords] of Object.entries(categories)) {
          catRecords.sort((a, b) => b.score - a.score)
          const deduped = dedupByScore(catRecords)
          for (let i = 0; i < deduped.length; i++) {
            deduped[i].rank = i === 0 ? 1 : deduped[i - 1].cumulativeCount + 1
          }

          const validated = deduped.filter((r) => validateRankRecord(r).valid)
          const monotonicity = validateRankTableMonotonicity(validated)
          if (!monotonicity.valid) {
            logger.warn('一分一段表单调性校验失败', {
              province: reg.meta.name, year, category, reason: monotonicity.reason,
            })
          }
          validatedCategories[category] = validated
        }

        // 写入文件
        const totalCount = Object.values(validatedCategories).reduce((sum, arr) => sum + arr.length, 0)
        if (totalCount > 0) {
          await writeRankTableFile(reg.meta.name, year, validatedCategories, reg.meta.pinyinId)
          results.push({ province: reg.meta.name, year, count: totalCount })
          logger.info('一分一段表完成', { province: reg.meta.name, year, count: totalCount })
        }

        if (failed.length > 0) {
          logger.warn('一分一段表部分失败', { province: reg.meta.name, year, failed: failed.length })
        }
      } catch (error) {
        logger.error('一分一段表采集失败', {
          province: reg.meta.name, year, error: (error as Error).message,
        })
        errors.push({ province: reg.meta.name, year, error: (error as Error).message })
      }
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
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-rank-tables-${Date.now()}.log`), report, 'utf-8')
}

function dedupByScore(records: RankTableRecord[]): RankTableRecord[] {
  const seen = new Set<number>()
  const result: RankTableRecord[] = []
  for (const r of records) {
    if (!seen.has(r.score)) {
      seen.add(r.score)
      result.push(r)
    }
  }
  return result
}

async function writeRankTableFile(
  province: string,
  year: number,
  categories: Record<string, RankTableRecord[]>,
  source: string
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
      source,
      sourceUrl: '',
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
