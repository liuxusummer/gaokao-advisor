import { describe, it, expect } from 'vitest'
import { validateCatalogRecord } from '../validate'
import type { MajorCatalogRecord } from '../../types'

function makeRecord(overrides: Partial<MajorCatalogRecord> = {}): MajorCatalogRecord {
  return {
    majorCode: '080901',
    majorName: '计算机科学与技术',
    category: '工学',
    subCategory: '计算机类',
    degreeType: '工学学士',
    duration: '四年',
    _meta: {
      source: 'moe',
      sourceUrl: 'https://example.com',
      fetchedAt: '2026-06-18T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateCatalogRecord', () => {
  it('正常记录通过', () => {
    const result = validateCatalogRecord(makeRecord())
    expect(result.valid).toBe(true)
  })

  it('majorCode 格式错误 → 失败', () => {
    const result = validateCatalogRecord(makeRecord({ majorCode: 'abc123' }))
    expect(result.valid).toBe(false)
  })

  it('majorName 为空 → 失败', () => {
    const result = validateCatalogRecord(makeRecord({ majorName: '' }))
    expect(result.valid).toBe(false)
  })

  it('category 不在 13 门类 → 失败', () => {
    const result = validateCatalogRecord(makeRecord({ category: '不存在' }))
    expect(result.valid).toBe(false)
  })

  it('degreeType 为空 → 通过（可选字段）', () => {
    const result = validateCatalogRecord(makeRecord({ degreeType: '' }))
    expect(result.valid).toBe(true)
  })
})
