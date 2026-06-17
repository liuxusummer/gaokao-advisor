import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseScores, buildScoreUrl } from '../gaokao_score'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'gaokao_score_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('buildScoreUrl', () => {
  it('构造阳光高考详情页 URL', () => {
    const url = buildScoreUrl('10001')
    expect(url).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml')
  })
})

describe('parseScores', () => {
  it('按年份和省份筛选：浙江 2025 返回 2 条', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(2)
    expect(records.every((r) => r.year === 2025)).toBe(true)
    expect(records.every((r) => r.province === '浙江')).toBe(true)
  })

  it('解析专业级字段正确', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    const cs = records.find((r) => r.majorName === '计算机科学与技术')!
    expect(cs.collegeId).toBe('4111010001')
    expect(cs.collegeName).toBe('北京大学')
    expect(cs.year).toBe(2025)
    expect(cs.majorName).toBe('计算机科学与技术')
    expect(cs.majorGroup).toBe('01')
    expect(cs.category).toBe('综合')
    expect(cs.batch).toBe('本科批')
    expect(cs.minScore).toBe(695)
    expect(cs.minRank).toBe(120)
    expect(cs.avgScore).toBe(700)
    expect(cs.planCount).toBe(5)
  })

  it('江苏 2025 返回 2 条（物理类+历史类）', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(2)
    const categories = records.map((r) => r.category)
    expect(categories).toContain('物理类')
    expect(categories).toContain('历史类')
  })

  it('多年份筛选：浙江 2024+2025 返回 3 条', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2024, 2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(3)
  })

  it('排除不在目标省份的记录（北京）', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2023],
      provinces: ['浙江', '江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(0)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    for (const r of records) {
      expect(r._meta.source).toBe('gaokao')
      expect(r._meta.sourceUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(true)
    }
  })

  it('空 HTML 返回空数组', () => {
    const records = parseScores({
      html: '<html></html>',
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/test',
    })
    expect(records).toEqual([])
  })
})
