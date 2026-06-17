import type { ScoreRecord, ScoreValidationResult } from '../types'

export function validateScoreRecord(record: ScoreRecord): ScoreValidationResult {
  const requiredFields: Array<keyof ScoreRecord> = [
    'collegeId', 'collegeName', 'year', 'majorName',
    'province', 'category', 'batch', 'minScore', 'minRank',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === '' || value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
  }

  // minScore 范围校验：0-750
  if (record.minScore < 0 || record.minScore > 750) {
    return { valid: false, reason: `minScore 超出范围 (0-750): ${record.minScore}` }
  }

  // minRank 为正整数
  if (!Number.isInteger(record.minRank) || record.minRank <= 0) {
    return { valid: false, reason: `minRank 必须为正整数: ${record.minRank}` }
  }

  // year 合理性
  if (record.year < 2000 || record.year > 2030) {
    return { valid: false, reason: `year 不合理: ${record.year}` }
  }

  // 白名单校验
  if (!record._meta.verified) {
    return { valid: false, reason: '记录未通过白名单校验 (verified=false)' }
  }

  return { valid: true }
}
