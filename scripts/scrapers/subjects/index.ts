import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { validateSubjectRecord } from './validate'
import { ensureRegistryInitialized } from '../shared/registry_init'
import { getProvince, getEnabledProvinces } from '../shared/province_registry'
import {
  SCRAPER_VERSION,
  ROOT_DIR,
  LOGS_DIR,
} from '../config'
import type { SubjectRequirementRecord, FailedRecord } from '../types'

const logger = createLogger('subjects')

const SUBJECTS_OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'data', 'subjects')
const SUBJECTS_REPORTS_DIR = path.join(SUBJECTS_OUTPUT_DIR, 'reports')

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

  logger.info('开始选科要求采集', { force: args.force, province: args.province ?? '全部' })

  fs.mkdirSync(SUBJECTS_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SUBJECTS_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'subjects'))

  const provinces = args.province
    ? [getProvince(args.province)!].filter(Boolean)
    : getEnabledProvinces()

  const allFailed: FailedRecord[] = []
  const stats: Array<{ province: string; count: number; failed: number }> = []

  for (const reg of provinces) {
    if (!reg.subjectScraper) {
      logger.warn('省份未注册选科要求适配器，跳过', { province: reg.meta.name })
      continue
    }

    try {
      logger.info('采集选科要求', { province: reg.meta.name })
      const { records, failed } = await reg.subjectScraper.scrape(http, 2024, {
        force: args.force,
      })

      // 校验
      const validated: SubjectRequirementRecord[] = []
      const rejected: Array<{ record: SubjectRequirementRecord; reason: string }> = []
      for (const record of records) {
        const result = validateSubjectRecord(record)
        if (result.valid) {
          validated.push(record)
        } else {
          rejected.push({ record, reason: result.reason! })
        }
      }

      // 写入文件
      const provinceDir = path.join(SUBJECTS_OUTPUT_DIR, reg.meta.name)
      fs.mkdirSync(provinceDir, { recursive: true })
      const outputPath = path.join(provinceDir, 'subjects_2024.json')
      fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2), 'utf-8')
      logger.info('选科要求文件已写入', {
        province: reg.meta.name, count: validated.length, path: outputPath,
      })

      // meta.json
      const meta = {
        province: reg.meta.name,
        year: 2024,
        totalCount: validated.length,
        generatedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
      }
      fs.writeFileSync(
        path.join(provinceDir, 'subjects_2024.meta.json'),
        JSON.stringify(meta, null, 2),
        'utf-8'
      )

      if (rejected.length > 0) {
        fs.writeFileSync(
          path.join(SUBJECTS_REPORTS_DIR, `${reg.meta.pinyinId}_subjects_rejected.json`),
          JSON.stringify(rejected, null, 2),
          'utf-8'
        )
      }

      allFailed.push(...failed)
      stats.push({ province: reg.meta.name, count: validated.length, failed: failed.length })
    } catch (error) {
      logger.error('选科要求采集失败', {
        province: reg.meta.name, error: (error as Error).message,
      })
      allFailed.push({
        url: '',
        error: (error as Error).message,
        retryCount: 3,
        context: reg.meta.name,
      })
    }
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[选科要求采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    ...stats.map((s) => `${s.province}: ${s.count} 条 (失败 ${s.failed})`),
    '------------------------------------------------------',
    `总计产出:   ${stats.reduce((sum, s) => sum + s.count, 0)} 条`,
    `失败:       ${allFailed.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-subjects-${Date.now()}.log`), report, 'utf-8')
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('选科要求采集异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
