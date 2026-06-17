import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMoeList } from '../moe_list'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'moe_list_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseMoeList', () => {
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
