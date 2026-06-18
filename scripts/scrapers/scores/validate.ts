import type { ScoreRecord, ScoreValidationResult, TieBreakers } from '../types'

export function validateScoreRecord(record: ScoreRecord): ScoreValidationResult {
  const requiredFields: Array<keyof ScoreRecord> = [
    'collegeId', 'collegeName', 'year', 'majorName',
    'province', 'category', 'batch', 'minScore', 'minRank',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
    if (typeof value === 'string' && value === '') {
      // collegeId 允许为空（未匹配白名单时），其他字符串字段不允许
      if (field !== 'collegeId') {
        return { valid: false, reason: `必填字段 ${String(field)} 为空字符串` }
      }
    }
  }

  // minScore 范围校验：0-750
  if (record.minScore < 0 || record.minScore > 750) {
    return { valid: false, reason: `minScore 超出范围 (0-750): ${record.minScore}` }
  }

  // minRank 允许 0（江苏投档线无位次），但不能为负
  if (!Number.isInteger(record.minRank) || record.minRank < 0) {
    return { valid: false, reason: `minRank 必须为非负整数: ${record.minRank}` }
  }

  // year 合理性
  if (record.year < 2020 || record.year > 2025) {
    return { valid: false, reason: `year 不合理: ${record.year}` }
  }

  // province 白名单
  if (!['浙江', '江苏'].includes(record.province)) {
    return { valid: false, reason: `province 不在白名单: ${record.province}` }
  }

  // category 合法性
  if (record.province === '浙江' && record.category !== '综合') {
    return { valid: false, reason: `浙江 category 必须为 综合: ${record.category}` }
  }
  if (record.province === '江苏' && !['物理类', '历史类'].includes(record.category)) {
    return { valid: false, reason: `江苏 category 必须为 物理类/历史类: ${record.category}` }
  }

  // tieBreakers 可选校验
  if (record.tieBreakers) {
    const tb = record.tieBreakers
    const tbFields: Array<keyof TieBreakers> = [
      'chineseMathSum', 'chineseMathMax', 'foreignLanguage',
      'preferredSubject', 'reselectSubjectMax', 'volunteerOrder',
    ]
    for (const f of tbFields) {
      const v = tb[f]
      if (v !== undefined && (typeof v !== 'number' || v < 0)) {
        return { valid: false, reason: `tieBreakers.${String(f)} 必须为非负数: ${v}` }
      }
    }
  }

  // _meta.verified 是溯源标记，不影响数据有效性
  return { valid: true }
}
