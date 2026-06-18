import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseJsToudangExcel, parseJsToudangPdf } from '../jiangsu'

const xlsFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_physics_sample.xls')
const xlsFixtureBuffer = fs.readFileSync(xlsFixturePath)

const pdfFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_2025_pdf_sample.txt')
const pdfFixtureText = fs.readFileSync(pdfFixturePath, 'utf-8')

describe('parseJsToudangExcel', () => {
  it('正确解析 8 条记录', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(8)
  })

  it('第一条记录为南京大学01专业组', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const first = records[0]
    expect(first.collegeName).toBe('南京大学')
    expect(first.majorGroup).toBe('01')
    expect(first.majorGroupName).toBe('南京大学01专业组(不限)')
    expect(first.majorName).toBe('南京大学01专业组(不限)')
    expect(first.minScore).toBe(638)
    expect(first.minRank).toBe(0) // 江苏投档线无位次
  })

  it('专业组名正确拆分', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const r = records.find((x) => x.majorGroup === '02' && x.collegeName === '南京大学')
    expect(r).toBeDefined()
    expect(r!.majorGroupName).toBe('南京大学02专业组(化学)')
  })

  it('同分排序项 tieBreakers 正确填充', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const first = records[0]
    expect(first.tieBreakers).toBeDefined()
    expect(first.tieBreakers!.chineseMathSum).toBe(230)
    expect(first.tieBreakers!.chineseMathMax).toBe(128)
    expect(first.tieBreakers!.foreignLanguage).toBe(141)
    expect(first.tieBreakers!.preferredSubject).toBe(79)
    expect(first.tieBreakers!.reselectSubjectMax).toBe(95)
    expect(first.tieBreakers!.volunteerOrder).toBe(1)
  })

  it('category 为物理类', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.category === '物理类')).toBe(true)
  })

  it('province 为江苏，batch 为本科批', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.province === '江苏')).toBe(true)
    expect(records.every((r) => r.batch === '本科批')).toBe(true)
  })

  it('跳过末尾注释行', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    // 注释行不应产生记录
    expect(records.every((r) => !r.collegeName.startsWith('注'))).toBe(true)
  })

  it('复杂专业组名（中外合作办学）正确处理', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const r = records.find((x) => x.majorGroupName?.includes('中外合作办学'))
    expect(r).toBeDefined()
    expect(r!.collegeName).toBe('南京理工大学')
    expect(r!.majorGroup).toBe('02')
  })

  it('空 Buffer 返回空数组', () => {
    const records = parseJsToudangExcel(Buffer.from(''), 2024, '物理类', 'https://jseea.cn/test')
    expect(records).toEqual([])
  })
})

describe('parseJsToudangPdf', () => {
  it('正确解析 8 条记录', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(8)
  })

  it('过滤水印字符（江/苏/省/教/育/考/试/院）', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    // 水印字符单独成行，不应产生记录
    expect(records.every((r) => r.collegeName.length > 1)).toBe(true)
    expect(records.every((r) => !'江苏省教育考试院'.includes(r.collegeName))).toBe(true)
  })

  it('第一条记录为南京大学01专业组', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    const first = records[0]
    expect(first.collegeName).toBe('南京大学')
    expect(first.majorGroup).toBe('01')
    expect(first.minScore).toBe(638)
  })

  it('minRank 为 0', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.minRank === 0)).toBe(true)
  })

  it('空文本返回空数组', () => {
    const records = parseJsToudangPdf('', 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toEqual([])
  })
})
