import { buildMeta } from '../shared/meta'
import type {
  MoeRecord,
  GaokaoRecord,
  CollegeRecord,
  WarningRecord,
} from '../types'

interface MatchedPair {
  moe: MoeRecord
  gaokao: GaokaoRecord | null
}

export interface MatchResult {
  matched: MatchedPair[]
  unmatchedMoe: MoeRecord[]
  droppedGaokao: GaokaoRecord[]
}

export interface MergeResult {
  records: CollegeRecord[]
  warnings: WarningRecord[]
}

export interface ValidationResult {
  valid: boolean
  reason?: string
}

/**
 * 规范化院校名称用于匹配（去除"大学/学院"后缀差异）
 */
function normalizeName(name: string): string {
  return name.replace(/(大学|学院|学校)$/g, '').trim()
}

/**
 * 规范化省份名称（去除"省/市/自治区"等后缀差异）
 * 教育部名单使用 "北京市"、"浙江省"，阳光高考使用 "北京"、"浙江"
 */
function normalizeProvince(province: string): string {
  return province
    .replace(/(壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)$/g, '')
    .trim()
}

/**
 * 双源匹配
 */
export function matchColleges(
  moeRecords: MoeRecord[],
  gaokaoRecords: GaokaoRecord[]
): MatchResult {
  const matched: MatchedPair[] = []
  const unmatchedMoe: MoeRecord[] = []
  const droppedGaokao: GaokaoRecord[] = []

  // 构建阳光高考索引：按规范化名称
  const gaokaoByName = new Map<string, GaokaoRecord>()
  for (const g of gaokaoRecords) {
    gaokaoByName.set(normalizeName(g.name), g)
  }

  const matchedGaokaoIds = new Set<string>()

  for (const moe of moeRecords) {
    const gaokao = gaokaoByName.get(normalizeName(moe.name)) || null
    if (gaokao) {
      matched.push({ moe, gaokao })
      matchedGaokaoIds.add(gaokao.gaokaoId)
    } else {
      unmatchedMoe.push(moe)
    }
  }

  // 阳光高考中未匹配的记录 = 不在白名单中 = 丢弃
  for (const g of gaokaoRecords) {
    if (!matchedGaokaoIds.has(g.gaokaoId)) {
      droppedGaokao.push(g)
    }
  }

  return { matched, unmatchedMoe, droppedGaokao }
}

/**
 * 字段合并：教育部字段优先，阳光高考补充
 */
export function mergeFields(pair: MatchedPair): CollegeRecord {
  const { moe, gaokao } = pair

  return {
    id: moe.id,
    moeCode: moe.id,
    name: moe.name,
    province: moe.province,
    city: moe.city,
    level: [moe.level],
    type: '综合', // 教育部名单不含类型，默认综合，后续可从阳光高考补充
    nature: moe.nature,
    affiliation: moe.affiliation,
    officialWebsite: gaokao?.officialWebsite || '',
    gaokaoUrl: gaokao?.gaokaoUrl || '',
    admissionUrl: gaokao?.admissionUrl,
    _meta: buildMeta('merged', moe.sourceUrl, true),
  }
}

/**
 * 校验单条记录
 */
export function validateRecord(record: CollegeRecord): ValidationResult {
  const requiredFields: Array<keyof CollegeRecord> = [
    'id', 'name', 'province', 'city', 'level', 'type', 'nature',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === '' || value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
    if (Array.isArray(value) && value.length === 0) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空数组` }
    }
  }

  if (!record._meta.verified) {
    return { valid: false, reason: '记录未通过白名单校验 (verified=false)' }
  }

  return { valid: true }
}

/**
 * 完整流程：匹配 + 合并 + 校验
 */
export function matchAndMerge(
  moeRecords: MoeRecord[],
  gaokaoRecords: GaokaoRecord[]
): MergeResult {
  const { matched, unmatchedMoe } = matchColleges(moeRecords, gaokaoRecords)

  const records: CollegeRecord[] = []
  const warnings: WarningRecord[] = []

  // 合并匹配成功的记录
  for (const pair of matched) {
    const merged = mergeFields(pair)
    records.push(merged)

    if (!merged.officialWebsite) {
      warnings.push({
        collegeId: merged.id,
        collegeName: merged.name,
        type: 'missing_website',
        detail: '阳光高考未提供官网链接',
      })
    }

    // 省份一致性检查（规范化后比较，避免"北京市"vs"北京"误报）
    if (
      pair.gaokao &&
      normalizeProvince(pair.gaokao.province) !== normalizeProvince(merged.province)
    ) {
      warnings.push({
        collegeId: merged.id,
        collegeName: merged.name,
        type: 'province_mismatch',
        detail: `教育部省份=${merged.province}, 阳光高考省份=${pair.gaokao.province}`,
      })
    }
  }

  // 合并未匹配阳光高考的教育部记录（官网留空）
  for (const moe of unmatchedMoe) {
    const merged = mergeFields({ moe, gaokao: null })
    records.push(merged)
    warnings.push({
      collegeId: merged.id,
      collegeName: merged.name,
      type: 'missing_website',
      detail: '未在阳光高考中匹配到该院校',
    })
  }

  return { records, warnings }
}
