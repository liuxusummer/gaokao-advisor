import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseGaokaoList, buildGaokaoUrl } from '../gaokao_detail'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'gaokao_list_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseGaokaoList', () => {
  it('正确解析 3 条记录', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    expect(records).toHaveLength(3)
  })

  it('解析北京大学字段正确', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    const pku = records.find((r) => r.name === '北京大学')!

    expect(pku.gaokaoId).toBe('1')
    expect(pku.name).toBe('北京大学')
    // 列表页不提供官网链接，留空
    expect(pku.officialWebsite).toBe('')
    expect(pku.gaokaoUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo--schId-1.dhtml')
    expect(pku.province).toBe('北京')
  })

  it('官网缺失时 officialWebsite 为空字符串', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    const missing = records.find((r) => r.name === '某学院')!

    expect(missing.officialWebsite).toBe('')
  })

  it('gaokaoUrl 为完整 URL（含 base）', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    const zju = records.find((r) => r.name === '浙江大学')!

    expect(zju.gaokaoUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo--schId-3.dhtml')
  })

  it('空 HTML 返回空数组', () => {
    const records = parseGaokaoList('<html></html>', 'https://gaokao.chsi.com.cn/test')
    expect(records).toEqual([])
  })
})

describe('buildGaokaoUrl', () => {
  it('构造分页 URL（start 偏移格式）', () => {
    const url = buildGaokaoUrl('浙江', 1)
    expect(url).toContain('search--province-')
    expect(url).toContain('start-0')
    expect(url).toContain('gaokao.chsi.com.cn')
  })

  it('第 2 页 start 偏移为 20', () => {
    const url = buildGaokaoUrl('浙江', 2)
    expect(url).toContain('start-20')
  })

  it('省份被 URL 编码', () => {
    const url = buildGaokaoUrl('浙江', 1)
    expect(url).toContain(encodeURIComponent('浙江'))
  })
})
