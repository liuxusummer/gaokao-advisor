import { describe, it, expect } from 'vitest'
import { validateDetailedRecord } from '../validate.js'
import type { DetailedMajorRecord } from '../../../types.js'

function makeRecord(overrides: Partial<DetailedMajorRecord> = {}): DetailedMajorRecord {
  return {
    majorCode: '010101',
    majorName: '哲学',
    category: '哲学',
    subCategory: '哲学类',
    educationLevel: '本科（普通教育）',
    introduction: '本专业...',
    careerDirections: ['考研'],
    mainCourses: '',
    durationAndDegree: {
      studentScale: '3000-3500',
      boyPercent: 38,
      girlPercent: 62,
      year: '2025',
    },
    satisfaction: [],
    graduateMajors: [],
    recommendedColleges: [],
    similarMajors: [],
    specId: '73381059',
    _meta: {
      source: 'gaokao_chsi',
      sourceUrl: 'https://example.com/detail/73381059',
      fetchedAt: '2026-06-18T10:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateDetailedRecord', () => {
  it('合法记录返回 valid: true', () => {
    const result = validateDetailedRecord(makeRecord())
    expect(result.valid).toBe(true)
  })

  it('majorCode 非 6 位数字时无效', () => {
    const result = validateDetailedRecord(makeRecord({ majorCode: '12345' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('majorCode')
  })

  it('majorCode 含字母时无效', () => {
    const result = validateDetailedRecord(makeRecord({ majorCode: '01010A' }))
    expect(result.valid).toBe(false)
  })

  it('majorName 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ majorName: '' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('majorName')
  })

  it('category 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ category: '' }))
    expect(result.valid).toBe(false)
  })

  it('specId 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ specId: '' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('specId')
  })

  it('boyPercent 超出 0-100 时无效', () => {
    const result = validateDetailedRecord(makeRecord({
      durationAndDegree: { studentScale: '', boyPercent: 150, girlPercent: 62, year: '2025' },
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('boyPercent')
  })

  it('girlPercent 为负数时无效', () => {
    const result = validateDetailedRecord(makeRecord({
      durationAndDegree: { studentScale: '', boyPercent: 38, girlPercent: -10, year: '2025' },
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('girlPercent')
  })

  it('educationLevel 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ educationLevel: '' }))
    expect(result.valid).toBe(false)
  })
})
