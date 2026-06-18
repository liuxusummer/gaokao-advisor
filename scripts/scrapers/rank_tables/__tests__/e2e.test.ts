import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjTable } from '../zhejiang'
import { parseJsTable } from '../jiangsu'
import { validateRankRecord, validateRankTableMonotonicity } from '../validate'
import type { RankTableRecord, RankTableFile } from '../../types'

const zjFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.txt'),
  'utf-8'
)
const jsPhysicsFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'jiangsu_physics_sample.txt'),
  'utf-8'
)
const jsHistoryFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'jiangsu_history_sample.txt'),
  'utf-8'
)

describe('rank_tables 端到端冒烟测试', () => {
  it('浙江完整流程：parse → validate → output', () => {
    const records = parseZjTable(zjFixture, 2025, 'https://zjzs.net/test')
    expect(records.length).toBeGreaterThan(0)

    // 校验所有记录
    const validated: RankTableRecord[] = []
    for (const record of records) {
      const result = validateRankRecord(record)
      expect(result.valid).toBe(true)
      validated.push(record)
    }

    // 单调性校验
    const monotonicity = validateRankTableMonotonicity(validated)
    expect(monotonicity.valid).toBe(true)

    // 断言 _meta 字段完整
    for (const record of validated) {
      expect(record._meta.source).toBe('zjzs')
      expect(record._meta.verified).toBe(true)
      expect(record._meta.scraperVersion).toBeDefined()
      expect(record._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }

    // 断言浙江为综合类
    expect(validated.every((r) => r.province === '浙江')).toBe(true)
    expect(validated.every((r) => r.category === '综合')).toBe(true)
  })

  it('江苏完整流程：parse → validate → output（物理类+历史类）', () => {
    const physicsRecords = parseJsTable(jsPhysicsFixture, 2025, '物理类', 'https://jseea.cn/test')
    const historyRecords = parseJsTable(jsHistoryFixture, 2025, '历史类', 'https://jseea.cn/test')

    expect(physicsRecords.length).toBeGreaterThan(0)
    expect(historyRecords.length).toBeGreaterThan(0)

    // 校验
    for (const record of [...physicsRecords, ...historyRecords]) {
      const result = validateRankRecord(record)
      expect(result.valid).toBe(true)
    }

    // 单调性校验
    expect(validateRankTableMonotonicity(physicsRecords).valid).toBe(true)
    expect(validateRankTableMonotonicity(historyRecords).valid).toBe(true)

    // 断言科类正确
    expect(physicsRecords.every((r) => r.category === '物理类')).toBe(true)
    expect(historyRecords.every((r) => r.category === '历史类')).toBe(true)
    expect(physicsRecords.every((r) => r.province === '江苏')).toBe(true)
  })

  it('RankTableFile 结构正确', () => {
    const records = parseZjTable(zjFixture, 2025, 'https://zjzs.net/test')
    const file: RankTableFile = {
      province: '浙江',
      year: 2025,
      categories: { '综合': records },
      _meta: {
        generatedAt: new Date().toISOString(),
        scraperVersion: '1.0.0',
        source: 'zjzs',
        sourceUrl: 'https://zjzs.net/test',
        recordCount: records.length,
      },
    }

    expect(file.province).toBe('浙江')
    expect(file.year).toBe(2025)
    expect(file.categories['综合'].length).toBeGreaterThan(0)
    expect(file._meta.recordCount).toBe(records.length)
    expect(file._meta.source).toBe('zjzs')
  })
})
