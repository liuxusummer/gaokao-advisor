import { describe, it, expect } from 'vitest'
import { validateScoreRecord } from '../validate'
import type { ScoreRecord } from '../../types'

const validRecord: ScoreRecord = {
  collegeId: '4111010001',
  collegeName: '北京大学',
  year: 2025,
  majorName: '计算机科学与技术',
  majorGroup: '01',
  province: '浙江',
  category: '综合',
  batch: '本科批',
  minScore: 695,
  minRank: 120,
  _meta: {
    source: 'gaokao',
    sourceUrl: 'https://gaokao.chsi.com.cn/test',
    fetchedAt: '2026-06-17T10:00:00.000Z',
    scraperVersion: '1.0.0',
    verified: true,
  },
}

describe('validateScoreRecord', () => {
  it('合法记录返回 { valid: true }', () => {
    const result = validateScoreRecord(validRecord)
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('collegeId 为空时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, collegeId: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('collegeId')
  })

  it('majorName 为空时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, majorName: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('majorName')
  })

  it('minScore 超出 0-750 范围时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, minScore: 800 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minScore')
  })

  it('minScore 为负数时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, minScore: -10 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minScore')
  })

  it('minRank 为非正整数时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, minRank: 0 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minRank')
  })

  it('verified=false 时校验失败', () => {
    const result = validateScoreRecord({
      ...validRecord,
      _meta: { ...validRecord._meta, verified: false },
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('verified')
  })
})
