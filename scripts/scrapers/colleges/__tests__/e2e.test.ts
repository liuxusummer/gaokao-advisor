import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMoeList } from '../moe_list'
import { parseGaokaoList } from '../gaokao_detail'
import { matchAndMerge, validateRecord } from '../merge'
import type { CollegeRecord, CollegesMeta } from '../../types'

const moeFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'moe_list_sample.html'),
  'utf-8'
)
const gaokaoFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'gaokao_list_sample.html'),
  'utf-8'
)

describe('端到端冒烟测试', () => {
  it('完整流程：parse → merge → validate → output', () => {
    // Step 1: 解析教育部名单
    const moeRecords = parseMoeList(moeFixture, 'https://moe.gov.cn/test')
    expect(moeRecords.length).toBeGreaterThan(0)

    // Step 2: 解析阳光高考
    const gaokaoRecords = parseGaokaoList(gaokaoFixture, 'https://gaokao.chsi.com.cn/test')
    expect(gaokaoRecords.length).toBeGreaterThan(0)

    // Step 3-4: 匹配与合并
    const { records } = matchAndMerge(moeRecords, gaokaoRecords)
    expect(records.length).toBeGreaterThan(0)

    // Step 5: 校验
    const validated: CollegeRecord[] = []
    for (const record of records) {
      const result = validateRecord(record)
      expect(result.valid).toBe(true)
      validated.push(record)
    }

    // 断言 _meta 字段完整
    for (const record of validated) {
      expect(record._meta.source).toBe('merged')
      expect(record._meta.verified).toBe(true)
      expect(record._meta.scraperVersion).toBeDefined()
      expect(record._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(record._meta.sourceUrl).toMatch(/^https?:\/\//)
    }

    // 断言所有记录都在教育部白名单中（无野鸡大学）
    const moeNames = new Set(moeRecords.map((r) => r.name))
    for (const record of validated) {
      expect(moeNames.has(record.name)).toBe(true)
    }
  })

  it('元信息文件结构正确', () => {
    const moeRecords = parseMoeList(moeFixture, 'https://moe.gov.cn/test')
    const gaokaoRecords = parseGaokaoList(gaokaoFixture, 'https://gaokao.chsi.com.cn/test')
    const { records } = matchAndMerge(moeRecords, gaokaoRecords)

    const meta: CollegesMeta = {
      totalCount: records.length,
      publicCount: records.filter((r) => r.nature === 'public').length,
      privateCount: records.filter((r) => r.nature === 'private').length,
      byProvince: {},
      byLevel: {},
      generatedAt: new Date().toISOString(),
      scraperVersion: '1.0.0',
      sources: [
        {
          name: '教育部全国高等学校名单',
          url: 'https://moe.gov.cn/test',
          fetchedAt: new Date().toISOString(),
          recordCount: records.length,
        },
      ],
      schemaVersion: '1.0.0',
    }

    expect(meta.totalCount).toBeGreaterThan(0)
    expect(meta.publicCount + meta.privateCount).toBeLessThanOrEqual(meta.totalCount)
    expect(meta.sources).toHaveLength(1)
    expect(meta.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
