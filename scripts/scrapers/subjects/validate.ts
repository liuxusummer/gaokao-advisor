import type { SubjectRequirementRecord } from '../types'

export interface SubjectValidationResult {
  valid: boolean
  reason?: string
}

const VALID_PROVINCES = ['浙江', '江苏']

export function validateSubjectRecord(record: SubjectRequirementRecord): SubjectValidationResult {
  if (!record.collegeName) {
    return { valid: false, reason: 'collegeName 为空' }
  }

  if (!VALID_PROVINCES.includes(record.province)) {
    return { valid: false, reason: `province 非白名单: ${record.province}` }
  }

  if (!record.majorName) {
    return { valid: false, reason: 'majorName 为空' }
  }

  if (!record.subjectRequirement) {
    return { valid: false, reason: 'subjectRequirement 为空' }
  }

  // requiredSubjects 与 type 一致性检查
  if (record.requirementType === 'none' && record.requiredSubjects.length > 0) {
    return { valid: false, reason: 'type=none 但 requiredSubjects 非空' }
  }

  if (record.requirementType !== 'none' && record.requirementType !== 'unknown' && record.requiredSubjects.length === 0) {
    return { valid: false, reason: `type=${record.requirementType} 但 requiredSubjects 为空` }
  }

  if (record.year < 2024) {
    return { valid: false, reason: `year 不合理: ${record.year}` }
  }

  return { valid: true }
}
