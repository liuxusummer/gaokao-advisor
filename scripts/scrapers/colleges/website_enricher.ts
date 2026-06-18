import * as cheerio from 'cheerio'
import type { CollegeRecord } from '../types'

// === 类型定义 ===

export interface SchIdMapping {
  schId: string
  collegeName: string
}

export interface SchDetail {
  xxwz: string  // 学校网址（官网）
  zswz: string  // 招生网址
}

interface SchDetailResponse {
  flag: boolean
  msg: {
    schid: string
    yxmc: string
    yxdm: string
    xxwz: string
    zswz: string
    dh: string
    txdz: string
    yxszd: string
    zgbmmc: string
  } | null
}

export interface MatchResult {
  college: CollegeRecord
  matchType: 'exact' | 'stripped' | 'contains'
}

// === 列表页解析 ===

/**
 * 解析阳光高考院校列表页 HTML，提取 (schId, 校名) 映射。
 *
 * HTML 结构：
 *   <a class="name js-yxk-yxmc..." href="/sch/schoolInfo--schId-{N}.dhtml">{校名}</a>
 */
export function parseSchList(html: string): SchIdMapping[] {
  if (!html) return []

  const $ = cheerio.load(html)
  const mappings: SchIdMapping[] = []

  $('.sch-list-container .sch-item .sch-title .name').each((_, el) => {
    const $el = $(el)
    const name = $el.text().trim()
    const href = $el.attr('href') || ''

    const match = href.match(/schoolInfo--schId-(\d+)\.dhtml/)
    if (!match || !name) return

    mappings.push({
      schId: match[1],
      collegeName: name,
    })
  })

  return mappings
}

// === 院校名标准化与匹配 ===

/**
 * 标准化院校名：全角括号转半角，去除括号后缀。
 * 用于匹配时消除格式差异。
 *
 * 注意：仅当原始为半角括号时才去除后缀；
 * 全角括号（如"（北京）"）仅做全角→半角转换，保留括号内容。
 */
export function normalizeName(name: string): string {
  // 检查原始是否含全角括号
  const hasFullWidthBracket = /[（）]/.test(name)
  // 全角括号转半角
  let normalized = name.replace(/（/g, '(').replace(/）/g, ')')
  // 仅当原始为半角括号时去除括号后缀（如"(中外合作办学)"）
  if (!hasFullWidthBracket) {
    const bracketIndex = normalized.indexOf('(')
    if (bracketIndex > 0) {
      normalized = normalized.substring(0, bracketIndex).trim()
    }
  }
  return normalized
}

/**
 * 三级院校名匹配：精确 → 去括号 → 包含。
 * 返回匹配的 college 对象和匹配类型，未匹配返回 null。
 */
export function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): MatchResult | null {
  // 1. 精确匹配
  const exact = collegesByName.get(name)
  if (exact) {
    return { college: exact, matchType: 'exact' }
  }

  // 2. 标准化后匹配（全角转半角 + 去括号后缀）
  const normalized = normalizeName(name)
  if (normalized !== name) {
    // 先尝试标准化后的精确匹配
    for (const [collegeName, college] of collegesByName) {
      if (normalizeName(collegeName) === normalized) {
        return { college, matchType: 'stripped' }
      }
    }
  }

  // 3. 包含匹配
  for (const [collegeName, college] of collegesByName) {
    const cn = normalizeName(collegeName)
    // 子串包含
    if (cn.includes(normalized) || normalized.includes(cn)) {
      return { college, matchType: 'contains' }
    }
    // 子序列包含（处理"浙大"→"浙江大学"等简称场景：
    // 短串字符按顺序出现在长串中，但不要求连续）
    if (isSubsequence(normalized, cn) || isSubsequence(cn, normalized)) {
      return { college, matchType: 'contains' }
    }
  }

  return null
}

/**
 * 判断 short 是否为 long 的子序列（字符按顺序出现，不要求连续）。
 */
function isSubsequence(short: string, long: string): boolean {
  if (short.length === 0) return false
  let i = 0
  for (let j = 0; i < short.length && j < long.length; j++) {
    if (short[i] === long[j]) i++
  }
  return i === short.length
}

// === 详情 API 解析 ===

/**
 * 解析阳光高考院校详情 API 响应 JSON。
 * 返回官网和招生网，flag=false 或 msg=null 时返回 null。
 */
export function parseSchDetail(jsonText: string): SchDetail | null {
  if (!jsonText) return null

  try {
    const data: SchDetailResponse = JSON.parse(jsonText)
    if (!data.flag || !data.msg) return null

    return {
      xxwz: data.msg.xxwz || '',
      zswz: data.msg.zswz || '',
    }
  } catch {
    return null
  }
}

// === 主流程编排 ===

import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import {
  SCRAPER_VERSION,
  GAOKAO_BASE_URL,
  GAOKAO_QPS,
  RAW_DIR,
  OUTPUT_DIR,
  REPORTS_DIR,
  LOGS_DIR,
} from '../config'

const logger = createLogger('website-enricher')

interface CliArgs {
  force: boolean
  listOnly: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force'),
    listOnly: args.includes('--list-only'),
  }
}

interface EnrichmentReport {
  totalMappings: number
  matched: number
  unmatched: number
  enriched: number
  emptyWebsite: number
  apiFailed: number
}

/**
 * 抓取阳光高考列表页，建立 schId → 院校名 映射。
 * 遍历 148 页（start-0 到 start-2940），每页 20 条。
 */
async function fetchSchIdMappings(
  http: HttpClient,
  force: boolean
): Promise<SchIdMapping[]> {
  const allMappings: SchIdMapping[] = []
  const seenSchIds = new Set<string>()
  const MAX_PAGES = 200 // 安全上限
  const requestInterval = 1000 // 列表页每页间隔 1 秒

  for (let page = 1; page <= MAX_PAGES; page++) {
    const start = (page - 1) * 20
    const url = `${GAOKAO_BASE_URL}/sch/search--searchType-1,start-${start}.dhtml`

    try {
      const result = await http.fetch(url, {
        cacheKey: `sch_list_start_${start}.html`,
        forceRefresh: force,
      })

      const mappings = parseSchList(result.html)
      if (mappings.length === 0) {
        logger.info('列表页分页结束：0 条记录', { page })
        break
      }

      // 去重
      const newMappings = mappings.filter((m) => !seenSchIds.has(m.schId))
      if (newMappings.length === 0) {
        logger.info('列表页分页结束：全部为重复记录', { page })
        break
      }

      for (const m of newMappings) {
        seenSchIds.add(m.schId)
        allMappings.push(m)
      }

      if (page % 20 === 0) {
        logger.info('列表页抓取进度', { page, total: allMappings.length })
      }

      // 不足 20 条说明是最后一页
      if (mappings.length < 20) {
        logger.info('列表页分页结束：不足 20 条', { page, count: mappings.length })
        break
      }

      // 限速：每页间隔 1 秒（非缓存时）
      if (!result.fromCache) {
        await sleep(requestInterval)
      }
    } catch (error) {
      logger.error('列表页抓取失败', { page, url, error: (error as Error).message })
      break
    }
  }

  // 缓存映射表到文件
  const mapPath = path.join(RAW_DIR, 'colleges', 'schid_map.json')
  fs.writeFileSync(mapPath, JSON.stringify(allMappings, null, 2), 'utf-8')
  logger.info('schId 映射表已缓存', { path: mapPath, count: allMappings.length })

  return allMappings
}

/**
 * 调用详情 API 获取官网和招生网。
 * 限速 QPS=2（每 500ms 一个请求）。
 */
async function fetchSchDetailWithLimit(
  http: HttpClient,
  schId: string,
  force: boolean
): Promise<SchDetail | null> {
  const url = `${GAOKAO_BASE_URL}/wap/sch/schinfo/${schId}`
  const requestInterval = 1000 / GAOKAO_QPS // 500ms

  try {
    const result = await http.fetch(url, {
      cacheKey: `sch_detail_${schId}.json`,
      forceRefresh: force,
      headers: {
        'Accept': 'application/json',
        'Referer': 'https://gaokao.chsi.com.cn/sch/',
      },
    })

    const detail = parseSchDetail(result.html)

    // 限速：非缓存时间隔 500ms
    if (!result.fromCache) {
      await sleep(requestInterval)
    }

    return detail
  } catch (error) {
    logger.warn('详情 API 调用失败', { schId, error: (error as Error).message })
    return null
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始院校官网补齐', {
    force: args.force,
    listOnly: args.listOnly,
  })

  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // Step 1: 加载 colleges.json
  const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
  if (!fs.existsSync(collegesPath)) {
    logger.error('colleges.json 不存在', { path: collegesPath })
    process.exit(2)
  }

  const colleges: CollegeRecord[] = JSON.parse(fs.readFileSync(collegesPath, 'utf-8'))
  logger.info('colleges.json 加载完成', { count: colleges.length })

  // 按院校名建立索引
  const collegesByName = new Map<string, CollegeRecord>()
  for (const college of colleges) {
    collegesByName.set(college.name, college)
  }

  // Step 2: 抓取列表页建立 schId 映射
  const http = new HttpClient(path.join(RAW_DIR, 'colleges'))
  logger.info('Step 2: 抓取列表页建立 schId 映射')
  const mappings = await fetchSchIdMappings(http, args.force)
  logger.info('列表页映射完成', { total: mappings.length })

  if (args.listOnly) {
    logger.info('--list-only 模式，跳过详情 API 调用')
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    console.log(`\n[列表页映射完成] 共 ${mappings.length} 条映射，耗时 ${formatDuration(elapsed)}`)
    return
  }

  // Step 3: 匹配院校名
  logger.info('Step 3: 匹配院校名')
  const matchedPairs: Array<{ schId: string; college: CollegeRecord; matchType: string }> = []
  const unmatched: Array<{ schId: string; listName: string; reason: string }> = []

  for (const mapping of mappings) {
    const result = matchCollege(mapping.collegeName, collegesByName)
    if (result) {
      matchedPairs.push({
        schId: mapping.schId,
        college: result.college,
        matchType: result.matchType,
      })
    } else {
      unmatched.push({
        schId: mapping.schId,
        listName: mapping.collegeName,
        reason: '未在 colleges.json 中找到匹配院校',
      })
    }
  }

  logger.info('院校名匹配完成', {
    matched: matchedPairs.length,
    unmatched: unmatched.length,
  })

  // Step 4: 调用详情 API 补齐官网
  logger.info('Step 4: 调用详情 API 补齐官网', { count: matchedPairs.length })

  const failed: Array<{ schId: string; collegeName: string; error: string }> = []
  const emptyWebsite: Array<{ schId: string; collegeName: string; detail: string }> = []
  let enriched = 0

  for (let i =  0; i < matchedPairs.length; i++) {
    const { schId, college } = matchedPairs[i]

    if ((i + 1) % 100 === 0) {
      logger.info('详情 API 进度', {
        current: i + 1,
        total: matchedPairs.length,
        enriched,
      })
    }

    const detail = await fetchSchDetailWithLimit(http, schId, args.force)

    if (detail === null) {
      failed.push({
        schId,
        collegeName: college.name,
        error: 'API 调用失败或响应解析失败',
      })
      continue
    }

    if (!detail.xxwz) {
      emptyWebsite.push({
        schId,
        collegeName: college.name,
        detail: 'API 返回 xxwz 为空',
      })
      // 仍尝试填充招生网
      if (detail.zswz) {
        college.admissionUrl = detail.zswz
      }
    } else {
      college.officialWebsite = detail.xxwz
      if (detail.zswz) {
        college.admissionUrl = detail.zswz
      }
      enriched++
    }

    // 更新溯源信息
    college._meta.fetchedAt = new Date().toISOString()
  }

  // Step 5: 写回 colleges.json
  logger.info('Step 5: 写回 colleges.json')
  fs.writeFileSync(collegesPath, JSON.stringify(colleges, null, 2), 'utf-8')
  logger.info('colleges.json 已更新', { path: collegesPath })

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'website_enrichment_failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (unmatched.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'website_enrichment_unmatched.json'),
      JSON.stringify(unmatched, null, 2),
      'utf-8'
    )
  }
  if (emptyWebsite.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'website_enrichment_empty.json'),
      JSON.stringify(emptyWebsite, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report: EnrichmentReport = {
    totalMappings: mappings.length,
    matched: matchedPairs.length,
    unmatched: unmatched.length,
    enriched,
    emptyWebsite: emptyWebsite.length,
    apiFailed: failed.length,
  }

  const reportText = [
    '[院校官网补齐报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `列表页映射:   ${report.totalMappings} 条`,
    `匹配成功:     ${report.matched} 条 (${pct(report.matched, report.totalMappings)})`,
    `匹配失败:     ${report.unmatched} 条 (unmatched.json)`,
    '------------------------------------------------------',
    `官网补齐:     ${report.enriched} 条 (${pct(report.enriched, report.matched)})`,
    `官网为空:     ${report.emptyWebsite} 条 (empty.json)`,
    `API 失败:     ${report.apiFailed} 条`,
    '------------------------------------------------------',
    `colleges.json 更新: ${report.matched} 条记录`,
    '======================================================',
  ].join('\n')

  console.log('\n' + reportText)

  const logPath = path.join(LOGS_DIR, `scrape-colleges-websites-${Date.now()}.log`)
  fs.writeFileSync(logPath, reportText, 'utf-8')

  if (failed.length > 0) {
    process.exit(1)
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

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

main().catch((error) => {
  logger.error('官网补齐流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
