import { describe, it, expect } from 'vitest'
import { validateScoreRecord } from '../validate'
import type { ScoreRecord } from '../../types'

function makeValidRecord(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    collegeId: '4111010001',
    collegeName: '北京大学',
    year: 2025,
    majorName: '计算机科学与技术',
    province: '浙江',
    category: '综合',
    batch: '普通类第一段',
    minScore: 700,
    minRank: 100,
    _meta: {
      source: 'zjzs',
      sourceUrl: 'https://zjzs.net/test',
      fetchedAt: '2026-06-18T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateScoreRecord', () => {
  it('合法记录通过校验', () => {
    const result = validateScoreRecord(makeValidRecord())
    expect(result.valid).toBe(true)
  })

  it('必填字段缺失 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ collegeName: '' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('collegeName')
  })

  it('minScore 超范围 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ minScore: 800 }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minScore')
  })

  it('minScore 为 0 → 成功', () => {
    const result = validateScoreRecord(makeValidRecord({ minScore: 0 }))
    expect(result.valid).toBe(true)
  })

  it('minRank 为 0 → 成功（江苏投档线无位次）', () => {
    const result = validateScoreRecord(makeValidRecord({ minRank: 0 }))
    expect(result.valid).toBe(true)
  })

  it('minRank 为负数 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ minRank: -1 }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minRank')
  })

  it('year 不合理 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ year: 2019 }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('year')
  })

  it('province 非白名单 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ province: '香港' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('province')
  })

  it('浙江 category 非 综合 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ province: '浙江', category: '物理类' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('category')
  })

  it('江苏 category 非 物理类/历史类 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ province: '江苏', category: '综合' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('category')
  })

  it('tieBreakers 含负数 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({
      tieBreakers: {
        chineseMathSum: -1,
        chineseMathMax: 128,
        foreignLanguage: 141,
        preferredSubject: 79,
        reselectSubjectMax: 95,
        volunteerOrder: 1,
      },
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('tieBreakers')
  })

  it('tieBreakers 合法 → 成功', () => {
    const result = validateScoreRecord(makeValidRecord({
      tieBreakers: {
        chineseMathSum: 230,
        chineseMathMax: 128,
        foreignLanguage: 141,
        preferredSubject: 79,
        reselectSubjectMax: 95,
        volunteerOrder: 1,
      },
    }))
    expect(result.valid).toBe(true)
  })

  it('verified=false → 成功（溯源标记不影响校验）', () => {
    const record = makeValidRecord({
      _meta: { ...makeValidRecord()._meta, verified: false },
    })
    const result = validateScoreRecord(record)
    expect(result.valid).toBe(true)
  })

  it('collegeId 为空 → 成功（未匹配白名单但仍保留）', () => {
    const result = validateScoreRecord(makeValidRecord({ collegeId: '' }))
    expect(result.valid).toBe(true)
  })
})
