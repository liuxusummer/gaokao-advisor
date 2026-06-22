import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges } from '../shared/colleges_loader'
import { validateScoreRecord } from './validate'
import { ensureRegistryInitialized } from '../shared/registry_init'
import { getProvince, getEnabledProvinces } from '../shared/province_registry'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  OUTPUT_DIR,
  SCORES_OUTPUT_DIR,
  SCORES_REPORTS_DIR,
  LOGS_DIR,
  TARGET_YEARS,
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

  ensureRegistryInitialized()

  logger.info('开始投档线采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    province: args.province ?? '全部',
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SCORES_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // 加载院校白名单
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

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'scores'))
  const allScores: ScoreRecord[] = []
  const failed: FailedRecord[] = []
  const warnings: ScoreWarningRecord[] = []
  const stats: Array<{ province: string; year: number; category?: string; count: number; matched: number }> = []

  // 确定要处理的省份列表
  const provinces = args.province
    ? [getProvince(args.province)!].filter(Boolean)
    : getEnabledProvinces()

  // 遍历省份注册表采集
  for (const reg of provinces) {
    if (!reg.scoreScraper) {
      logger.warn('省份未注册投档线适配器，跳过', { province: reg.meta.name })
      continue
    }

    for (const year of TARGET_YEARS) {
      try {
        logger.info('采集投档线', { province: reg.meta.name, year })
        const { records, failed: provFailed } = await reg.scoreScraper.scrape(http, year, {
          force: args.force,
        })

        const matched = matchColleges(records, collegesByName, warnings, reg.meta.name, year)
        allScores.push(...records)
        failed.push(...provFailed)

        // 按科类统计
        const categories = new Set(records.map((r) => r.category))
        if (categories.size <= 1) {
          stats.push({ province: reg.meta.name, year, count: records.length, matched })
        } else {
          for (const category of categories) {
            const catRecords = records.filter((r) => r.category === category)
            const catMatched = catRecords.filter((r) => r._meta.verified).length
            stats.push({ province: reg.meta.name, year, category, count: catRecords.length, matched: catMatched })
          }
        }
      } catch (error) {
        logger.error('投档线采集失败', {
          province: reg.meta.name, year, error: (error as Error).message,
        })
        failed.push({
          url: '',
          error: (error as Error).message,
          retryCount: 3,
          context: `${reg.meta.name} ${year}`,
        })
      }
    }
  }

  // 校验与产出
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
  for (const reg of provinces) {
    const province = reg.meta.name
    const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
    fs.mkdirSync(provinceDir, { recursive: true })

    for (const year of TARGET_YEARS) {
      const records = validated.filter((s) => s.province === province && s.year === year)
      const outputPath = path.join(provinceDir, `scores_${year}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8')
      logger.info('投档线文件已写入', { province, year, count: records.length, path: outputPath })
    }
  }

  // 写入元信息
  const meta = buildScoresMeta(validated, provinces.map((r) => r.meta.name))
  const metaPath = path.join(SCORES_OUTPUT_DIR, 'scores.meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(path.join(SCORES_REPORTS_DIR, 'failed.json'), JSON.stringify(failed, null, 2), 'utf-8')
  }
  if (warnings.length > 0) {
    fs.writeFileSync(path.join(SCORES_REPORTS_DIR, 'warnings.json'), JSON.stringify(warnings, null, 2), 'utf-8')
  }
  if (rejected.length > 0) {
    fs.writeFileSync(path.join(SCORES_REPORTS_DIR, 'rejected.json'), JSON.stringify(rejected, null, 2), 'utf-8')
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
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-scores-${Date.now()}.log`), report, 'utf-8')

  if (failed.length > 0) {
    process.exit(1)
  }
}

function matchColleges(
  records: ScoreRecord[],
  collegesByName: Map<string, CollegeRecord>,
  warnings: ScoreWarningRecord[],
  province: string,
  year: number
): number {
  let matched = 0

  for (const record of records) {
    const result = matchCollege(record.collegeName, collegesByName)

    if (result.collegeId) {
      record.collegeId = result.collegeId
      record._meta.verified = true
      matched++
    } else {
      // 匹配失败时保留原始 collegeId（parser 阶段提取的源代码）作为兜底
      // 不再强制清空，避免前端无法关联院校信息
      record._meta.verified = false
      if (!warnings.some((w) => w.collegeName === record.collegeName && w.year === year)) {
        warnings.push({
          collegeId: record.collegeId || '',
          collegeName: record.collegeName,
          type: 'missing_data',
          detail: `未在 colleges.json 中找到匹配院校 (${province} ${year})`,
        })
      }
    }
  }

  return matched
}

function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): { collegeId: string; matchType: string } {
  // 1. 精确匹配
  const exact = collegesByName.get(name)
  if (exact) return { collegeId: exact.id, matchType: 'exact' }

  // 2. 统一括号后精确匹配（处理半角/全角括号差异）
  const normalized = name.replace(/（/g, '(').replace(/）/g, ')')
  if (normalized !== name) {
    const normMatch = collegesByName.get(normalized)
    if (normMatch) return { collegeId: normMatch.id, matchType: 'normalized' }
  }
  const fullNormalized = name.replace(/\(/g, '（').replace(/\)/g, '）')
  if (fullNormalized !== name) {
    const fullNormMatch = collegesByName.get(fullNormalized)
    if (fullNormMatch) return { collegeId: fullNormMatch.id, matchType: 'full_normalized' }
  }

  // 3. 去除后缀匹配（处理 "[公办]"、"[民办]" 等后缀）
  const suffixStripped = name.replace(/\s*\[.*?\]\s*/g, '').trim()
  if (suffixStripped !== name) {
    const suffixMatch = collegesByName.get(suffixStripped)
    if (suffixMatch) return { collegeId: suffixMatch.id, matchType: 'suffix_stripped' }
    // 递归尝试统一括号
    const suffixNorm = suffixStripped.replace(/（/g, '(').replace(/）/g, ')')
    const suffixNormMatch = collegesByName.get(suffixNorm)
    if (suffixNormMatch) return { collegeId: suffixNormMatch.id, matchType: 'suffix_normalized' }
  }

  // 4. 去括号匹配（同时处理半角和全角括号）
  const halfBracketIndex = name.indexOf('(')
  const fullBracketIndex = name.indexOf('（')
  let bracketIndex = -1
  if (halfBracketIndex > 0 && fullBracketIndex > 0) {
    bracketIndex = Math.min(halfBracketIndex, fullBracketIndex)
  } else if (halfBracketIndex > 0) {
    bracketIndex = halfBracketIndex
  } else if (fullBracketIndex > 0) {
    bracketIndex = fullBracketIndex
  }
  if (bracketIndex > 0) {
    const stripped = name.substring(0, bracketIndex).trim()
    const strippedMatch = collegesByName.get(stripped)
    if (strippedMatch) return { collegeId: strippedMatch.id, matchType: 'stripped' }
  }

  // 5. 简称匹配（处理上海交大、华东师大等简称）
  // 构建"去括号+去后缀"的基础名称用于简称匹配
  const baseName = (suffixStripped || name).replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim()
  if (baseName && baseName !== name) {
    const baseMatch = collegesByName.get(baseName)
    if (baseMatch) return { collegeId: baseMatch.id, matchType: 'base_name' }
  }

  // 6. 包含匹配（使用统一括号后的名称）
  for (const [collegeName, college] of collegesByName) {
    const collegeNorm = collegeName.replace(/（/g, '(').replace(/）/g, ')')
    if (collegeNorm.includes(normalized) || normalized.includes(collegeNorm)) {
      return { collegeId: college.id, matchType: 'contains' }
    }
  }

  // 7. 简称包含匹配（处理简称与全称的包含关系）
  if (baseName && baseName.length >= 3) {
    for (const [collegeName, college] of collegesByName) {
      // 去掉"大学"、"学院"等后缀后比较
      const collegeShort = collegeName.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').replace(/(大学|学院|职业学校|职业技术学院)$/g, '').trim()
      if (collegeShort.length >= 3 && (collegeShort.includes(baseName) || baseName.includes(collegeShort))) {
        return { collegeId: college.id, matchType: 'short_contains' }
      }
    }
  }

  return { collegeId: '', matchType: 'none' }
}

function buildScoresMeta(records: ScoreRecord[], provinceNames: string[]): ScoresMeta {
  const provinces = provinceNames.map((name) => {
    const years = TARGET_YEARS
    const scoreRecordCount: Record<number, number> = {}
    const rankTableRecordCount: Record<number, number> = {}

    for (const year of years) {
      scoreRecordCount[year] = records.filter((r) => r.province === name && r.year === year).length
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
      { name: '各省教育考试院', url: '', coverage: '投档线 2023-2025' },
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
