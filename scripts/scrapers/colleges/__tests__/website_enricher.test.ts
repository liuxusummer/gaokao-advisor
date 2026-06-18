import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  parseSchList,
  matchCollege,
  parseSchDetail,
  normalizeName,
} from '../website_enricher'
import type { CollegeRecord } from '../../types'

const listFixturePath = path.join(__dirname, '..', '__fixtures__', 'sch_list_sample.html')
const listFixtureHtml = fs.readFileSync(listFixturePath, 'utf-8')

const detailFixturePath = path.join(__dirname, '..', '__fixtures__', 'sch_detail_sample.json')
const detailFixtureJson = fs.readFileSync(detailFixturePath, 'utf-8')

// 模拟 colleges.json 中的记录
function makeCollege(overrides: Partial<CollegeRecord> = {}): CollegeRecord {
  return {
    id: '4111010001',
    moeCode: '4111010001',
    name: '北京大学',
    province: '北京市',
    city: '北京市',
    level: ['本科'],
    type: '综合',
    nature: 'public',
    affiliation: '教育部',
    officialWebsite: '',
    gaokaoUrl: '',
    _meta: {
      source: 'merged',
      sourceUrl: '',
      fetchedAt: '2026-06-17T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('parseSchList', () => {
  it('正常解析 5 条映射', () => {
    const mappings = parseSchList(listFixtureHtml)
    expect(mappings).toHaveLength(5)
  })

  it('schId 是数字字符串', () => {
    const mappings = parseSchList(listFixtureHtml)
    expect(mappings[0].schId).toBe('1')
    expect(mappings[4].schId).toBe('5')
    expect(/^\d+$/.test(mappings[0].schId)).toBe(true)
  })

  it('校名被 trim 清理空白', () => {
    const mappings = parseSchList(listFixtureHtml)
    expect(mappings[0].collegeName).toBe('北京大学')
    expect(mappings[0].collegeName).not.toMatch(/^\s|\s$/)
  })

  it('空 HTML 返回空数组', () => {
    const mappings = parseSchList('')
    expect(mappings).toEqual([])
  })

  it('无匹配项的 HTML 返回空数组', () => {
    const mappings = parseSchList('<html><body>无院校数据</body></html>')
    expect(mappings).toEqual([])
  })
})

describe('normalizeName', () => {
  it('全角括号转半角', () => {
    expect(normalizeName('中国矿业大学（北京）')).toBe('中国矿业大学(北京)')
  })

  it('去除括号后缀', () => {
    expect(normalizeName('浙江大学(中外合作办学)')).toBe('浙江大学')
  })

  it('无括号的原样返回', () => {
    expect(normalizeName('北京大学')).toBe('北京大学')
  })
})

describe('matchCollege', () => {
  const collegesByName = new Map<string, CollegeRecord>([
    ['北京大学', makeCollege({ id: '4111010001', name: '北京大学' })],
    ['中国矿业大学(北京)', makeCollege({ id: '4111010054', name: '中国矿业大学(北京)' })],
    ['浙江大学', makeCollege({ id: '4133010001', name: '浙江大学' })],
  ])

  it('精确匹配', () => {
    const result = matchCollege('北京大学', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.collegeId).toBe('4111010001')
    expect(result!.matchType).toBe('exact')
  })

  it('全角括号匹配', () => {
    // 列表页是全角括号，colleges.json 是半角括号
    const result = matchCollege('中国矿业大学（北京）', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.collegeId).toBe('4111010054')
  })

  it('去括号后缀匹配', () => {
    // 列表页带括号后缀，colleges.json 无括号
    const result = matchCollege('浙江大学(中外合作办学)', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.collegeId).toBe('4133010001')
  })

  it('包含匹配', () => {
    const result = matchCollege('浙大', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.matchType).toBe('contains')
  })

  it('未匹配返回 null', () => {
    const result = matchCollege('不存在的大学', collegesByName)
    expect(result).toBeNull()
  })
})

describe('parseSchDetail', () => {
  it('正常响应返回官网和招生网', () => {
    const result = parseSchDetail(detailFixtureJson)
    expect(result).not.toBeNull()
    expect(result!.xxwz).toBe('https://www.pku.edu.cn')
    expect(result!.zswz).toBe('https://bkzs.pku.edu.cn')
  })

  it('flag=false 返回 null', () => {
    const json = JSON.stringify({ flag: false, msg: null })
    const result = parseSchDetail(json)
    expect(result).toBeNull()
  })

  it('xxwz 为空字符串时返回空', () => {
    const data = JSON.parse(detailFixtureJson)
    data.msg.xxwz = ''
    const result = parseSchDetail(JSON.stringify(data))
    expect(result).not.toBeNull()
    expect(result!.xxwz).toBe('')
  })
})
