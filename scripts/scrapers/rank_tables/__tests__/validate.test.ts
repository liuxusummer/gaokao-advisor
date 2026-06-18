import { describe, it, expect } from 'vitest'
import { validateRankRecord, validateRankTableMonotonicity } from '../validate'
import type { RankTableRecord } from '../../types'

const validRecord: RankTableRecord = {
  province: '浙江',
  year: 2025,
  category: '综合',
  score: 695,
  rank: 251,
  count: 60,
  cumulativeCount: 310,
  _meta: {
    source: 'zjzs',
    sourceUrl: 'https://zjzs.net/test',
    fetchedAt: '2026-06-17T10:00:00.000Z',
    scraperVersion: '1.0.0',
    verified: true,
  },
}

describe('validateRankRecord', () => {
  it('合法记录返回 { valid: true }', () => {
    const result = validateRankRecord(validRecord)
    expect(result.valid).toBe(true)
  })

  it('score 超出 0-750 范围时校验失败', () => {
    const result = validateRankRecord({ ...validRecord, score: 800 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('score')
  })

  it('rank 为非正整数时校验失败', () => {
    const result = validateRankRecord({ ...validRecord, rank: 0 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('rank')
  })

  it('cumulativeCount 为非正整数时校验失败', () => {
    const result = validateRankRecord({ ...validRecord, cumulativeCount: -5 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('cumulativeCount')
  })

  it('verified=false 时仍通过校验（OCR 数据可正常校验）', () => {
    const result = validateRankRecord({
      ...validRecord,
      _meta: { ...validRecord._meta, verified: false },
    })
    expect(result.valid).toBe(true)
  })
})

describe('validateRankTableMonotonicity', () => {
  it('合法单调序列返回 { valid: true }', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 700, cumulativeCount: 50 },
      { ...validRecord, score: 699, cumulativeCount: 95 },
      { ...validRecord, score: 698, cumulativeCount: 147 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(true)
  })

  it('score 非降序时校验失败', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 698, cumulativeCount: 147 },
      { ...validRecord, score: 700, cumulativeCount: 50 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('score')
  })

  it('cumulativeCount 非递增时校验失败', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 700, cumulativeCount: 100 },
      { ...validRecord, score: 699, cumulativeCount: 50 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('cumulativeCount')
  })

  it('score 重复时校验失败', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 700, cumulativeCount: 50 },
      { ...validRecord, score: 700, cumulativeCount: 100 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('重复')
  })

  it('空数组返回 { valid: true }', () => {
    const result = validateRankTableMonotonicity([])
    expect(result.valid).toBe(true)
  })
})
