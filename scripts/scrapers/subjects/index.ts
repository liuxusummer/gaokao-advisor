import fs from 'node:fs'
import path from 'node:path'
import * as xlsx from 'xlsx'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges } from '../shared/colleges_loader'
import { parseZjSubjects } from './zhejiang'
import { parseJsSubjects } from './jiangsu'
import { validateSubjectRecord } from './validate'
import {
  SCRAPER_VERSION,
  GAOKAO_QPS,
  ZJ_SUBJECTS_URL_TEMPLATE,
  JS_SUBJECTS_XLSX_URL,
  JS_SUBJECTS_PAGE_URL,
  RAW_DIR,
  OUTPUT_DIR,
  ROOT_DIR,
  LOGS_DIR,
} from '../config'
import type { SubjectRequirementRecord, CollegeRecord } from '../types'

const logger = createLogger('subjects')

// 选科要求产出目录（与 scores 同级，独立于 common）
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

  logger.info('开始选科要求采集', { force: args.force, province: args.province })

  fs.mkdirSync(SUBJECTS_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SUBJECTS_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // 加载 colleges.json
  const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
  if (!fs.existsSync(collegesPath)) {
    logger.error('colleges.json 不存在，请先运行 scrape:colleges', { path: collegesPath })
    process.exit(2)
  }
  const collegesMap = loadColleges(collegesPath)
  const colleges: CollegeRecord[] = Array.from(collegesMap.values())
  logger.info('colleges.json 加载完成', { count: colleges.length })

  const runZhejiang = !args.province || args.province === '浙江'
  const runJiangsu = !args.province || args.province === '江苏'

  let zjRecords: SubjectRequirementRecord[] = []
  let jsRecords: SubjectRequirementRecord[] = []

  if (runZhejiang) {
    zjRecords = await collectZhejiang(colleges, args.force)
  }

  if (runJiangsu) {
    jsRecords = await collectJiangsu(colleges, args.force)
  }

  // 写入输出文件
  if (runZhejiang) {
    writeOutput(zjRecords, '浙江', 'zjzs', 'https://www.zjzs.net/')
  }
  if (runJiangsu) {
    writeOutput(jsRecords, '江苏', 'jseea', 'https://www.jseea.cn/')
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[选科要求采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `浙江记录: ${zjRecords.length} 条`,
    `江苏记录: ${jsRecords.length} 条`,
    '------------------------------------------------------',
    `总计产出:   ${zjRecords.length + jsRecords.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-subjects-${Date.now()}.log`), report, 'utf-8')
}

async function collectZhejiang(
  colleges: CollegeRecord[],
  force: boolean
): Promise<SubjectRequirementRecord[]> {
  logger.info('Step 1: 采集浙江选科要求', { collegeCount: colleges.length })

  const http = new HttpClient(path.join(RAW_DIR, 'subjects'))
  const allRecords: SubjectRequirementRecord[] = []
  const failed: Array<{ collegeId: string; collegeName: string; error: string }> = []
  const empty: Array<{ collegeId: string; collegeName: string }> = []
  const requestInterval = 1000 / GAOKAO_QPS

  for (let i = 0; i < colleges.length; i++) {
    const college = colleges[i]
    const guobiaoCode = college.moeCode.slice(-5)
    const url = ZJ_SUBJECTS_URL_TEMPLATE.replace('{guobiaoCode}', guobiaoCode)

    if ((i + 1) % 100 === 0) {
      logger.info('浙江选科要求进度', {
        current: i + 1,
        total: colleges.length,
        records: allRecords.length,
      })
    }

    try {
      const result = await http.fetch(url, {
        cacheKey: `zj_${guobiaoCode}.html`,
        forceRefresh: force,
      })

      const records = parseZjSubjects(result.html, college.id, college.name, url)
      if (records.length === 0) {
        empty.push({ collegeId: college.id, collegeName: college.name })
      } else {
        allRecords.push(...records)
      }

      if (!result.fromCache) {
        await sleep(requestInterval)
      }
    } catch (error) {
      failed.push({
        collegeId: college.id,
        collegeName: college.name,
        error: (error as Error).message,
      })
    }
  }

  logger.info('浙江选科要求采集完成', {
    records: allRecords.length,
    failed: failed.length,
    empty: empty.length,
  })

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(SUBJECTS_REPORTS_DIR, 'zj_subjects_failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (empty.length > 0) {
    fs.writeFileSync(
      path.join(SUBJECTS_REPORTS_DIR, 'zj_subjects_empty.json'),
      JSON.stringify(empty, null, 2),
      'utf-8'
    )
  }

  return allRecords
}

async function collectJiangsu(
  colleges: CollegeRecord[],
  force: boolean
): Promise<SubjectRequirementRecord[]> {
  logger.info('Step 2: 采集江苏选科要求')

  const http = new HttpClient(path.join(RAW_DIR, 'subjects'))

  // 下载 Excel
  logger.info('下载江苏选科要求 Excel', { url: JS_SUBJECTS_XLSX_URL })
  const excelResult = await http.fetchBinary(JS_SUBJECTS_XLSX_URL, {
    cacheKey: 'js_subjects_2024.xlsx',
    forceRefresh: force,
  })

  // 解析 Excel
  const workbook = xlsx.read(excelResult.buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

  logger.info('Excel 解析完成', { rows: rows.length })

  const records = parseJsSubjects(rows, JS_SUBJECTS_PAGE_URL)

  // 匹配 colleges.json（按院校名）
  const collegesByName = new Map<string, CollegeRecord>()
  for (const c of colleges) {
    collegesByName.set(c.name, c)
  }

  const unmatched: Array<{ collegeName: string; reason: string }> = []
  let matched = 0

  for (const record of records) {
    const college = collegesByName.get(record.collegeName)
    if (college) {
      record.collegeId = college.id
      record._meta.verified = true
      matched++
    } else {
      unmatched.push({
        collegeName: record.collegeName,
        reason: '未在 colleges.json 中找到匹配院校',
      })
    }
  }

  logger.info('江苏选科要求匹配完成', {
    total: records.length,
    matched,
    unmatched: unmatched.length,
  })

  if (unmatched.length > 0) {
    // 去重后写入
    const uniqueUnmatched = Array.from(
      new Map(unmatched.map((u) => [u.collegeName, u])).values()
    )
    fs.writeFileSync(
      path.join(SUBJECTS_REPORTS_DIR, 'js_subjects_unmatched.json'),
      JSON.stringify(uniqueUnmatched, null, 2),
      'utf-8'
    )
  }

  return records
}

function writeOutput(
  records: SubjectRequirementRecord[],
  province: string,
  source: string,
  sourceUrl: string
) {
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

  const provinceDir = path.join(SUBJECTS_OUTPUT_DIR, province)
  fs.mkdirSync(provinceDir, { recursive: true })

  const outputPath = path.join(provinceDir, 'subjects_2024.json')
  fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2), 'utf-8')
  logger.info(`${province} subjects_2024.json 已写入`, {
    path: outputPath,
    count: validated.length,
  })

  // meta.json
  const meta = {
    province,
    year: 2024,
    totalCount: validated.length,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [{ name: source, url: sourceUrl, recordCount: validated.length }],
  }
  fs.writeFileSync(
    path.join(provinceDir, 'subjects_2024.meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8'
  )

  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(SUBJECTS_REPORTS_DIR, `${province.toLowerCase()}_subjects_rejected.json`),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
