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
  collegeId: string
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
 * 返回匹配的 collegeId 和匹配类型，未匹配返回 null。
 */
export function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): MatchResult | null {
  // 1. 精确匹配
  const exact = collegesByName.get(name)
  if (exact) {
    return { collegeId: exact.id, matchType: 'exact' }
  }

  // 2. 标准化后匹配（全角转半角 + 去括号后缀）
  const normalized = normalizeName(name)
  if (normalized !== name) {
    // 先尝试标准化后的精确匹配
    for (const [collegeName, college] of collegesByName) {
      if (normalizeName(collegeName) === normalized) {
        return { collegeId: college.id, matchType: 'stripped' }
      }
    }
  }

  // 3. 包含匹配
  for (const [collegeName, college] of collegesByName) {
    const cn = normalizeName(collegeName)
    // 子串包含
    if (cn.includes(normalized) || normalized.includes(cn)) {
      return { collegeId: college.id, matchType: 'contains' }
    }
    // 子序列包含（处理"浙大"→"浙江大学"等简称场景：
    // 短串字符按顺序出现在长串中，但不要求连续）
    if (isSubsequence(normalized, cn) || isSubsequence(cn, normalized)) {
      return { collegeId: college.id, matchType: 'contains' }
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
