import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseJsTable } from '../jiangsu'

const physicsFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_physics_sample.txt')
const physicsFixtureText = fs.readFileSync(physicsFixturePath, 'utf-8')

const historyFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_history_sample.txt')
const historyFixtureText = fs.readFileSync(historyFixturePath, 'utf-8')

describe('parseJsTable', () => {
  it('解析物理类 5 条记录', () => {
    const records = parseJsTable(physicsFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(5)
    expect(records.every((r) => r.category === '物理类')).toBe(true)
  })

  it('解析历史类 5 条记录', () => {
    const records = parseJsTable(historyFixtureText, 2025, '历史类', 'https://jseea.cn/test')
    expect(records).toHaveLength(5)
    expect(records.every((r) => r.category === '历史类')).toBe(true)
  })

  it('解析物理类 690 分记录字段正确', () => {
    const records = parseJsTable(physicsFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    const top = records[0]
    expect(top.score).toBe(690)
    expect(top.count).toBe(30)
    expect(top.cumulativeCount).toBe(30)
    expect(top.rank).toBe(1)
  })

  it('解析历史类 665 分记录字段正确', () => {
    const records = parseJsTable(historyFixtureText, 2025, '历史类', 'https://jseea.cn/test')
    const top = records[0]
    expect(top.score).toBe(665)
    expect(top.count).toBe(20)
    expect(top.cumulativeCount).toBe(20)
    expect(top.rank).toBe(1)
  })

  it('province 为江苏', () => {
    const records = parseJsTable(physicsFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.province === '江苏')).toBe(true)
  })

  it('每条记录包含 _meta 溯源字段（OCR 数据 verified=false）', () => {
    const records = parseJsTable(physicsFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    for (const r of records) {
      expect(r._meta.source).toBe('jseea')
      expect(r._meta.sourceUrl).toBe('https://jseea.cn/test')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      // OCR 识别数据标记为未验证
      expect(r._meta.verified).toBe(false)
    }
  })

  it('score 降序排列', () => {
    const records = parseJsTable(physicsFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    for (let i = 1; i < records.length; i++) {
      expect(records[i].score).toBeLessThan(records[i - 1].score)
    }
  })

  it('空文本返回空数组', () => {
    const records = parseJsTable('', 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toEqual([])
  })

  it('容错处理全角数字和多余空格', () => {
    // OCR 可能产生全角数字和多余空格
    const text = '分数 人数 累计人数\n６９０ ３０ ３０\n６８９  ３５  ６５'
    const records = parseJsTable(text, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(2)
    expect(records[0].score).toBe(690)
    expect(records[0].count).toBe(30)
    expect(records[0].cumulativeCount).toBe(30)
  })

  it('支持多栏排版格式（每行多组数据）', () => {
    // OCR 输出为多栏排版，每行可能包含 1-3 组数据
    const text = `分数 人数 累计人数
563 1255 75837 523 1410 130715 483 1149 184370
562 1256 77093 522 1367 132082 482 1212 185582`
    const records = parseJsTable(text, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(6)
    // 第一行第一组
    expect(records[0].score).toBe(563)
    expect(records[0].count).toBe(1255)
    expect(records[0].cumulativeCount).toBe(75837)
    // 第一行第二组
    expect(records[1].score).toBe(523)
    expect(records[1].count).toBe(1410)
    expect(records[1].cumulativeCount).toBe(130715)
    // 第二行第一组
    expect(records[3].score).toBe(562)
    expect(records[3].count).toBe(1256)
    expect(records[3].cumulativeCount).toBe(77093)
  })

  it('跳过页码和标题噪声行', () => {
    const text = `分数 人数 累计人数
江苏省2025年普通高考普通类(物理等科目类)逐分段统计表
690 30 30
第 1 页, 共 2 页
689 35 65`
    const records = parseJsTable(text, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(2)
    expect(records[0].score).toBe(690)
    expect(records[1].score).toBe(689)
  })
})
