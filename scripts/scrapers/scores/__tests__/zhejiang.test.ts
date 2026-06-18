import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjToudang } from '../zhejiang'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.xls')
const fixtureBuffer = fs.readFileSync(fixturePath)

describe('parseZjToudang', () => {
  it('正确解析 10 条记录', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    expect(records).toHaveLength(10)
  })

  it('第一条记录为浙江大学人文科学试验班', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    const first = records[0]
    expect(first.collegeName).toBe('浙江大学')
    expect(first.majorName).toBe('人文科学试验班')
    expect(first.majorCode).toBe('001')
    expect(first.minScore).toBe(672)
    expect(first.minRank).toBe(4122)
    expect(first.planCount).toBe(80)
  })

  it('province 为浙江，category 为综合，batch 为普通类第一段', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    expect(records.every((r) => r.province === '浙江')).toBe(true)
    expect(records.every((r) => r.category === '综合')).toBe(true)
    expect(records.every((r) => r.batch === '普通类第一段')).toBe(true)
  })

  it('year 传入正确', () => {
    const records = parseZjToudang(fixtureBuffer, 2024, 'https://zjzs.net/test')
    expect(records.every((r) => r.year === 2024)).toBe(true)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    for (const r of records) {
      expect(r._meta.source).toBe('zjzs')
      expect(r._meta.sourceUrl).toBe('https://zjzs.net/test')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(false) // 解析阶段未关联白名单
    }
  })

  it('minScore 和 minRank 为数字类型', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    for (const r of records) {
      expect(typeof r.minScore).toBe('number')
      expect(typeof r.minRank).toBe('number')
      expect(Number.isFinite(r.minScore)).toBe(true)
      expect(Number.isFinite(r.minRank)).toBe(true)
    }
  })

  it('空 Buffer 返回空数组', () => {
    const records = parseZjToudang(Buffer.from(''), 2025, 'https://zjzs.net/test')
    expect(records).toEqual([])
  })

  it('跳过标题行和空行', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    // 标题行和表头行不应产生记录
    // fixture 有 2 行标题 + 1 行表头 + 10 行数据 = 13 行
    expect(records).toHaveLength(10)
    // 第一条数据不应是标题文本
    expect(records[0].collegeName).not.toContain('浙江省')
  })
})
