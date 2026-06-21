import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjToudang } from '../zhejiang'
import { parseJsToudangExcel } from '../jiangsu'
import { validateScoreRecord } from '../validate'
import type { CollegeRecord } from '../../types'

const zjFixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.xls')
const zjFixtureBuffer = fs.readFileSync(zjFixturePath)

const jsFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_physics_sample.xls')
const jsFixtureBuffer = fs.readFileSync(jsFixturePath)

// 模拟 colleges.json 白名单
const mockColleges = new Map<string, CollegeRecord>([
  ['4111010001', {
    id: '4111010001', moeCode: '4111010001', name: '浙江大学',
    province: '浙江省', city: '杭州市', level: ['本科'], type: '综合',
    nature: 'public', affiliation: '教育部', officialWebsite: '', gaokaoUrl: '',
    _meta: { source: 'merged', sourceUrl: '', fetchedAt: '', scraperVersion: '1.0.0', verified: true },
  }],
  ['4111010002', {
    id: '4111010002', moeCode: '4111010002', name: '杭州电子科技大学',
    province: '浙江省', city: '杭州市', level: ['本科'], type: '理工',
    nature: 'public', affiliation: '浙江省', officialWebsite: '', gaokaoUrl: '',
    _meta: { source: 'merged', sourceUrl: '', fetchedAt: '', scraperVersion: '1.0.0', verified: true },
  }],
  ['4111010003', {
    id: '4111010003', moeCode: '4111010003', name: '南京大学',
    province: '江苏省', city: '南京市', level: ['本科'], type: '综合',
    nature: 'public', affiliation: '教育部', officialWebsite: '', gaokaoUrl: '',
    _meta: { source: 'merged', sourceUrl: '', fetchedAt: '', scraperVersion: '1.0.0', verified: true },
  }],
])

const mockCollegesByName = new Map<string, CollegeRecord>()
for (const c of mockColleges.values()) {
  mockCollegesByName.set(c.name, c)
}

describe('投档线采集端到端流程', () => {
  it('浙江: parse → match → validate 完整流程', () => {
    // Step 1: 解析
    const records = parseZjToudang(zjFixtureBuffer, 2025, 'https://zjzs.net/test')
    expect(records.length).toBeGreaterThan(0)

    // Step 2: 关联白名单（模拟）
    let matched = 0
    for (const r of records) {
      const college = mockCollegesByName.get(r.collegeName)
      if (college) {
        r.collegeId = college.id
        r._meta.verified = true
        matched++
      }
    }
    expect(matched).toBeGreaterThan(0)

    // Step 3: 校验
    const validated = records.filter((r) => validateScoreRecord(r).valid)
    expect(validated.length).toBe(records.length) // 全部应通过校验

    // Step 4: 验证字段
    const first = validated[0]
    expect(first.province).toBe('浙江')
    expect(first.category).toBe('综合')
    expect(first.batch).toBe('普通类第一段')
    expect(first._meta.source).toBe('zjzs')
  })

  it('江苏: parse → match → validate 完整流程', () => {
    // Step 1: 解析
    const records = parseJsToudangExcel(jsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records.length).toBeGreaterThan(0)

    // Step 2: 关联白名单（模拟）
    let matched = 0
    for (const r of records) {
      const college = mockCollegesByName.get(r.collegeName)
      if (college) {
        r.collegeId = college.id
        r._meta.verified = true
        matched++
      }
    }
    expect(matched).toBeGreaterThan(0) // 南京大学应匹配

    // Step 3: 校验
    const validated = records.filter((r) => validateScoreRecord(r).valid)
    expect(validated.length).toBe(records.length)

    // Step 4: 验证字段
    const nj = validated.find((r) => r.collegeName === '南京大学')
    expect(nj).toBeDefined()
    expect(nj!.majorGroup).toBe('01')
    expect(nj!.minScore).toBe(638)
    expect(nj!.minRank).toBe(0) // 江苏无位次
    expect(nj!.tieBreakers).toBeDefined()
    expect(nj!._meta.source).toBe('jseea')
  })
})
