import { MAJOR_CATEGORIES } from '../config'
import type { MajorCatalogRecord } from '../types'

export interface CatalogValidationResult {
  valid: boolean
  reason?: string
}

export function validateCatalogRecord(record: MajorCatalogRecord): CatalogValidationResult {
  if (!record.majorCode || !/^\d{6}T?K?$/.test(record.majorCode)) {
    return { valid: false, reason: `majorCode 格式错误: ${record.majorCode}` }
  }

  if (!record.majorName) {
    return { valid: false, reason: 'majorName 为空' }
  }

  if (!record.category || !MAJOR_CATEGORIES.includes(record.category)) {
    return { valid: false, reason: `category 不在 13 门类: ${record.category}` }
  }

  if (!record.subCategory) {
    return { valid: false, reason: 'subCategory 为空' }
  }

  return { valid: true }
}
