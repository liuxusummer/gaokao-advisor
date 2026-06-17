import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMoeList, parseMoeExcel, extractMoeExcelUrl } from '../moe_list'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'moe_list_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

const excelFixturePath = path.join(__dirname, '..', '__fixtures__', 'moe_list_sample.xls')
const excelBuffer = fs.readFileSync(excelFixturePath)

const moePagePath = path.join(__dirname, '..', '__fixtures__', 'moe_page_sample.html')
const moePageHtml = fs.readFileSync(moePagePath, 'utf-8')

describe('parseMoeList (HTML 表格，旧版兼容)', () => {
  it('正确解析 3 条记录', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    expect(records).toHaveLength(3)
  })

  it('解析北京大学字段正确', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    const pku = records.find((r) => r.name === '北京大学')!

    expect(pku.id).toBe('4111010001')
    expect(pku.name).toBe('北京大学')
    expect(pku.province).toBe('北京市')
    expect(pku.city).toBe('北京市')
    expect(pku.level).toBe('普通本科')
    expect(pku.nature).toBe('public')
    expect(pku.affiliation).toBe('教育部')
    expect(pku.sourceUrl).toBe('https://moe.gov.cn/test')
  })

  it('解析浙江大学字段正确', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    const zju = records.find((r) => r.name === '浙江大学')!

    expect(zju.id).toBe('4133010003')
    expect(zju.province).toBe('浙江省')
    expect(zju.city).toBe('杭州市')
    expect(zju.nature).toBe('public')
  })

  it('民办院校 nature 解析为 private', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    const westlake = records.find((r) => r.name === '西湖大学')!

    expect(westlake.nature).toBe('private')
    expect(westlake.affiliation).toBe('浙江省')
  })

  it('空 HTML 返回空数组', () => {
    const records = parseMoeList('<html><body></body></html>', 'https://moe.gov.cn/test')
    expect(records).toEqual([])
  })
})

describe('parseMoeExcel (Excel 附件，2025 年度起)', () => {
  it('正确解析 3 条记录', () => {
    const records = parseMoeExcel(excelBuffer, 'https://moe.gov.cn/test')
    expect(records).toHaveLength(3)
  })

  it('解析北京大学字段正确（省份来自分组头）', () => {
    const records = parseMoeExcel(excelBuffer, 'https://moe.gov.cn/test')
    const pku = records.find((r) => r.name === '北京大学')!

    expect(pku.id).toBe('4111010001')
    expect(pku.name).toBe('北京大学')
    expect(pku.province).toBe('北京市')
    expect(pku.city).toBe('北京市')
    expect(pku.level).toBe('本科')
    expect(pku.nature).toBe('public')
    expect(pku.affiliation).toBe('教育部')
    expect(pku.sourceUrl).toBe('https://moe.gov.cn/test')
  })

  it('备注列含"民办"时 nature 解析为 private', () => {
    const records = parseMoeExcel(excelBuffer, 'https://moe.gov.cn/test')
    const private1 = records.find((r) => r.name === '某民办学院')!
    const westlake = records.find((r) => r.name === '西湖大学')!

    expect(private1.nature).toBe('private')
    expect(westlake.nature).toBe('private')
    expect(westlake.province).toBe('浙江省')
    expect(westlake.city).toBe('杭州市')
  })
})

describe('extractMoeExcelUrl', () => {
  it('从发布页 HTML 提取普通高等学校名单 Excel URL', () => {
    const url = extractMoeExcelUrl(moePageHtml, 'https://moe.gov.cn/test/202506/t20250627_1195683.html')
    expect(url).toBe('https://moe.gov.cn/test/202506/W020250729615142156867.xls')
  })

  it('未找到附件时返回 null', () => {
    const url = extractMoeExcelUrl('<html></html>', 'https://moe.gov.cn/test')
    expect(url).toBeNull()
  })
})
