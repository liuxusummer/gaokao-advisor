import { describe, it, expect } from 'vitest'
import { validateSubjectRecord } from '../validate'
import type { SubjectRequirementRecord } from '../../types'

function makeRecord(overrides: Partial<SubjectRequirementRecord> = {}): SubjectRequirementRecord {
  return {
    collegeId: '4111010001',
    collegeName: '北京大学',
    province: '浙江',
    year: 2024,
    level: '本科',
    majorName: '数学类',
    subjectRequirement: '物理,化学(2门科目考生均须选考方可报考)',
    requirementType: 'two_required',
    requiredSubjects: ['物理', '化学'],
    _meta: {
      source: 'zjzs',
      sourceUrl: 'https://example.com',
      fetchedAt: '2026-06-18T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateSubjectRecord', () => {
  it('正常记录通过', () => {
    const result = validateSubjectRecord(makeRecord())
    expect(result.valid).toBe(true)
  })

  it('province 非白名单 → 失败', () => {
    const result = validateSubjectRecord(makeRecord({ province: '上海' }))
    expect(result.valid).toBe(false)
  })

  it('majorName 为空 → 失败', () => {
    const result = validateSubjectRecord(makeRecord({ majorName: '' }))
    expect(result.valid).toBe(false)
  })

  it('requirementType=unknown → 通过（仅 warn）', () => {
    const result = validateSubjectRecord(makeRecord({
      requirementType: 'unknown',
      requiredSubjects: [],
    }))
    expect(result.valid).toBe(true)
  })

  it('requiredSubjects 与 type 不一致 → 失败', () => {
    // type=two_required 但 requiredSubjects 为空
    const result = validateSubjectRecord(makeRecord({ requiredSubjects: [] }))
    expect(result.valid).toBe(false)
  })

  it('verified=false → 通过', () => {
    const result = validateSubjectRecord(makeRecord({
      _meta: { ...makeRecord()._meta, verified: false },
    }))
    expect(result.valid).toBe(true)
  })
})
