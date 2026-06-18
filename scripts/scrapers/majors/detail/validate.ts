import type { DetailedMajorRecord } from '../../types.js'

export function validateDetailedRecord(record: DetailedMajorRecord): {
  valid: boolean
  reason?: string
} {
  if (!record.majorCode || !/^\d{6}$/.test(record.majorCode)) {
    return { valid: false, reason: `majorCode 格式非法: "${record.majorCode}"` }
  }
  if (!record.majorName) {
    return { valid: false, reason: 'majorName 为空' }
  }
  if (!record.category) {
    return { valid: false, reason: 'category 为空' }
  }
  if (!record.subCategory) {
    return { valid: false, reason: 'subCategory 为空' }
  }
  if (!record.educationLevel) {
    return { valid: false, reason: 'educationLevel 为空' }
  }
  if (!record.specId) {
    return { valid: false, reason: 'specId 为空' }
  }
  const { boyPercent, girlPercent } = record.durationAndDegree
  if (boyPercent < 0 || boyPercent > 100) {
    return { valid: false, reason: `boyPercent 越界: ${boyPercent}` }
  }
  if (girlPercent < 0 || girlPercent > 100) {
    return { valid: false, reason: `girlPercent 越界: ${girlPercent}` }
  }
  return { valid: true }
}
