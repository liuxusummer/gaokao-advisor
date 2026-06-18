import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjTable } from '../zhejiang'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.txt')
const fixtureText = fs.readFileSync(fixturePath, 'utf-8')

describe('parseZjTable', () => {
  it('正确解析 10 条记录', () => {
    const records = parseZjTable(fixtureText, 2025, 'https://zjzs.net/test')
    expect(records).toHaveLength(10)
  })

  it('解析 700 分记录字段正确', () => {
    const records = parseZjTable(fixtureText, 2025, 'https://zjzs.net/test')
    const top = records[0]
    expect(top.score).toBe(700)
    expect(top.count).toBe(50)
    expect(top.cumulativeCount).toBe(50)
    expect(top.rank).toBe(1) // 700 分对应位次 1
  })

  it('解析 695 分记录字段正确', () => {
    const records = parseZjTable(fixtureText, 2025, 'https://zjzs.net/test')
    const r695 = records.find((r) => r.score === 695)!
    expect(r695.count).toBe(60)
    expect(r695.cumulativeCount).toBe(310)
    expect(r695.rank).toBe(251) // 累计 250 + 1
  })

  it('province 为浙江，category 为综合', () => {
    const records = parseZjTable(fixtureText, 2025, 'https://zjzs.net/test')
    expect(records.every((r) => r.province === '浙江')).toBe(true)
    expect(records.every((r) => r.category === '综合')).toBe(true)
  })

  it('year 传入正确', () => {
    const records = parseZjTable(fixtureText, 2025, 'https://zjzs.net/test')
    expect(records.every((r) => r.year === 2025)).toBe(true)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseZjTable(fixtureText, 2025, 'https://zjzs.net/test')
    for (const r of records) {
      expect(r._meta.source).toBe('zjzs')
      expect(r._meta.sourceUrl).toBe('https://zjzs.net/test')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(true)
    }
  })

  it('score 降序排列', () => {
    const records = parseZjTable(fixtureText, 2025, 'https://zjzs.net/test')
    for (let i = 1; i < records.length; i++) {
      expect(records[i].score).toBeLessThan(records[i - 1].score)
    }
  })

  it('空文本返回空数组', () => {
    const records = parseZjTable('', 2025, 'https://zjzs.net/test')
    expect(records).toEqual([])
  })

  it('支持分数段格式（如 698-750）', () => {
    const text = `分数 人数 累计人数
698-750 266 266
697 46 312
696 40 352`
    const records = parseZjTable(text, 2025, 'https://zjzs.net/test')
    expect(records).toHaveLength(3)
    expect(records[0].score).toBe(698)
    expect(records[0].count).toBe(266)
    expect(records[0].cumulativeCount).toBe(266)
  })
})
