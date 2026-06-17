import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseScores } from '../gaokao_score'
import { validateScoreRecord } from '../validate'
import type { ScoreRecord } from '../../types'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'gaokao_score_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('scores 端到端冒烟测试', () => {
  it('完整流程：parse → validate → output', () => {
    // Step 1: 解析阳光高考详情页
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2023, 2024, 2025],
      provinces: ['浙江', '江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records.length).toBeGreaterThan(0)

    // Step 2: 校验所有记录
    const validated: ScoreRecord[] = []
    for (const record of records) {
      const result = validateScoreRecord(record)
      expect(result.valid).toBe(true)
      validated.push(record)
    }

    // Step 3: 断言 _meta 字段完整
    for (const record of validated) {
      expect(record._meta.source).toBe('gaokao')
      expect(record._meta.verified).toBe(true)
      expect(record._meta.scraperVersion).toBeDefined()
      expect(record._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(record._meta.sourceUrl).toMatch(/^https?:\/\//)
    }

    // Step 4: 断言数据按省份和年份正确筛选
    const provinces = new Set(validated.map((r) => r.province))
    const years = new Set(validated.map((r) => r.year))
    expect(provinces.has('浙江')).toBe(true)
    expect(provinces.has('江苏')).toBe(true)
    expect([...years].every((y) => [2023, 2024, 2025].includes(y))).toBe(true)

    // Step 5: 断言不包含目标省份之外的数据
    expect([...provinces].every((p) => ['浙江', '江苏'].includes(p))).toBe(true)
  })

  it('按省/年分组结构正确', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江', '江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/test',
    })

    const zj2025 = records.filter((r) => r.province === '浙江' && r.year === 2025)
    const js2025 = records.filter((r) => r.province === '江苏' && r.year === 2025)

    expect(zj2025.length).toBeGreaterThan(0)
    expect(js2025.length).toBeGreaterThan(0)
    expect(zj2025.every((r) => r.province === '浙江' && r.year === 2025)).toBe(true)
    expect(js2025.every((r) => r.province === '江苏' && r.year === 2025)).toBe(true)
  })
})
