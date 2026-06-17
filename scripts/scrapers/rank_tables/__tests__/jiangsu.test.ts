import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseJsTable } from '../jiangsu'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseJsTable', () => {
  it('解析物理类 5 条记录', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(5)
    expect(records.every((r) => r.category === '物理类')).toBe(true)
  })

  it('解析历史类 5 条记录', () => {
    const records = parseJsTable(fixtureHtml, 2025, '历史类', 'https://jseea.cn/test')
    expect(records).toHaveLength(5)
    expect(records.every((r) => r.category === '历史类')).toBe(true)
  })

  it('解析物理类 690 分记录字段正确', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    const top = records[0]
    expect(top.score).toBe(690)
    expect(top.count).toBe(30)
    expect(top.cumulativeCount).toBe(30)
    expect(top.rank).toBe(1)
  })

  it('解析历史类 665 分记录字段正确', () => {
    const records = parseJsTable(fixtureHtml, 2025, '历史类', 'https://jseea.cn/test')
    const top = records[0]
    expect(top.score).toBe(665)
    expect(top.count).toBe(20)
    expect(top.cumulativeCount).toBe(20)
    expect(top.rank).toBe(1)
  })

  it('province 为江苏', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.province === '江苏')).toBe(true)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    for (const r of records) {
      expect(r._meta.source).toBe('jseea')
      expect(r._meta.sourceUrl).toBe('https://jseea.cn/test')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(true)
    }
  })

  it('score 降序排列', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    for (let i = 1; i < records.length; i++) {
      expect(records[i].score).toBeLessThan(records[i - 1].score)
    }
  })

  it('空 HTML 返回空数组', () => {
    const records = parseJsTable('<html></html>', 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toEqual([])
  })
})
