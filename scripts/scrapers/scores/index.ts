import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges, verifyCollegeId } from '../shared/colleges_loader'
import { parseScores, buildScoreUrl } from './gaokao_score'
import { validateScoreRecord } from './validate'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  GAOKAO_QPS,
  OUTPUT_DIR,
  SCORES_OUTPUT_DIR,
  SCORES_REPORTS_DIR,
  LOGS_DIR,
  TARGET_YEARS,
  TARGET_PROVINCES,
} from '../config'
import type {
  ScoreRecord,
  ScoresMeta,
  FailedRecord,
  ScoreWarningRecord,
} from '../types'

const logger = createLogger('scores')

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

  logger.info('开始分数线采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    provinces: TARGET_PROVINCES,
    force: args.force,
    dryRun: args.dryRun,
  })

  // 确保输出目录存在
  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SCORES_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // Step 1: 加载院校白名单
  const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
  if (!fs.existsSync(collegesPath)) {
    logger.error('colleges.json 不存在，请先运行 scrape:colleges', { path: collegesPath })
    process.exit(2)
  }

  const colleges = loadColleges(collegesPath)
  logger.info('院校白名单加载完成', { count: colleges.size })

  // Step 2-3: 抓取+解析阳光高考详情页
  const http = new HttpClient(path.join(process.cwd(), 'raw', 'scores'))
  const allScores: ScoreRecord[] = []
  const failed: FailedRecord[] = []
  const warnings: ScoreWarningRecord[] = []
  const requestInterval = 1000 / GAOKAO_QPS

  let processed = 0
  for (const [collegeId, college] of colleges) {
    processed++
    try {
      const url = buildScoreUrl(collegeId)
      const result = await http.fetch(url, {
        cacheKey: `score_${collegeId}`,
        forceRefresh: args.force,
      })
      const scores = parseScores({
        html: result.html,
        collegeId,
        collegeName: college.name,
        years: TARGET_YEARS,
        provinces: TARGET_PROVINCES,
        sourceUrl: url,
      })

      if (scores.length === 0) {
        warnings.push({
          collegeId,
          collegeName: college.name,
          type: 'missing_data',
          detail: `该院校在 ${TARGET_PROVINCES.join('/')} ${TARGET_YEARS.join('/')} 无录取数据`,
        })
      }

      allScores.push(...scores)

      if (processed % 100 === 0) {
        logger.info('采集进度', {
          processed,
          total: colleges.size,
          scoresCollected: allScores.length,
        })
      }
    } catch (error) {
      failed.push({
        url: buildScoreUrl(collegeId),
        error: (error as Error).message,
        retryCount: 3,
        context: `collegeId=${collegeId}, name=${college.name}`,
      })
    }
    await sleep(requestInterval)
  }

  logger.info('阳光高考抓取完成', {
    totalScores: allScores.length,
    failed: failed.length,
    warnings: warnings.length,
  })

  // Step 4: 关联白名单校验
  const verified = allScores.map((s) => ({
    ...s,
    _meta: {
      ...s._meta,
      verified: verifyCollegeId(s.collegeId, colleges),
    },
  }))

  // Step 5: 校验与产出
  const validated: ScoreRecord[] = []
  const rejected: Array<{ record: Partial<ScoreRecord>; reason: string }> = []

  for (const record of verified) {
    const result = validateScoreRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  // 按 province/year 分组写入
  for (const province of TARGET_PROVINCES) {
    const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
    fs.mkdirSync(provinceDir, { recursive: true })

    for (const year of TARGET_YEARS) {
      const records = validated.filter(
        (s) => s.province === province && s.year === year
      )
      const outputPath = path.join(provinceDir, `scores_${year}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8')
      logger.info('分数线文件已写入', {
        province,
        year,
        count: records.length,
        path: outputPath,
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
    '[分数线采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `院校白名单: ${colleges.size} 所`,
    `抓取成功:   ${colleges.size - failed.length} 所（失败 ${failed.length} 所）`,
    '------------------------------------------------------',
    ...TARGET_PROVINCES.map((p) =>
      TARGET_YEARS.map((y) => {
        const count = validated.filter((s) => s.province === p && s.year === y).length
        return `${p} ${y}: ${count} 条专业级分数`
      }).join('\n')
    ).join('\n'),
    '------------------------------------------------------',
    `总计产出:   ${validated.length} 条`,
    `校验拒绝:   ${rejected.length} 条`,
    `警告:       ${warnings.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)

  const logPath = path.join(LOGS_DIR, `scrape-scores-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')

  if (rejected.length > 0) {
    process.exit(1)
  }
}

function buildScoresMeta(records: ScoreRecord[]): ScoresMeta {
  const provinces = TARGET_PROVINCES.map((name) => {
    const years = TARGET_YEARS
    const scoreRecordCount: Record<number, number> = {}
    const rankTableRecordCount: Record<number, number> = {}

    for (const year of years) {
      scoreRecordCount[year] = records.filter(
        (r) => r.province === name && r.year === year
      ).length
      rankTableRecordCount[year] = 0 // 由 rank_tables 采集器填充
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
        name: '阳光高考',
        url: 'https://gaokao.chsi.com.cn',
        coverage: '分数线',
      },
    ],
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
  logger.error('分数线采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
