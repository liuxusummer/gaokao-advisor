import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseCatalog } from '../parse'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'catalog_sample.txt')
const fixtureText = fs.readFileSync(fixturePath, 'utf-8')

describe('parseCatalog', () => {
  it('正常解析多个专业', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    // fixture 中有 10 个专业
    expect(records).toHaveLength(10)
  })

  it('专业代码含 K 后缀', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const infoSec = records.find(r => r.majorName === '信息安全')
    expect(infoSec).toBeDefined()
    expect(infoSec!.majorCode).toBe('080910TK')
  })

  it('专业代码含 T 后缀', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const crypto = records.find(r => r.majorName === '密码科学与技术')
    expect(crypto).toBeDefined()
    expect(crypto!.majorCode).toBe('080910T')
  })

  it('标题行被跳过', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const hasTitle = records.some(r => r.majorName.includes('普通高等学校'))
    expect(hasTitle).toBe(false)
  })

  it('空行被跳过', () => {
    const text = '01 \t学科门类：哲学\n0101 \t哲学类\n\n010101 \t哲学\n\n'
    const records = parseCatalog(text, 'https://example.com/catalog.pdf')
    expect(records).toHaveLength(1)
  })

  it('空文本返回空数组', () => {
    const records = parseCatalog('', 'https://example.com/catalog.pdf')
    expect(records).toEqual([])
  })

  it('_meta 字段正确填充', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    expect(records[0]._meta.source).toBe('moe')
    expect(records[0]._meta.sourceUrl).toBe('https://example.com/catalog.pdf')
    expect(records[0]._meta.verified).toBe(true)
  })

  it('degreeType 与 duration 为空（PDF 中无此信息）', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    for (const r of records) {
      expect(r.degreeType).toBe('')
      expect(r.duration).toBe('')
    }
  })

  it('跨行专业：代码行与名称行分离时按顺序配对', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const digitalEconomy = records.find(r => r.majorCode === '020109T')
    expect(digitalEconomy).toBeDefined()
    expect(digitalEconomy!.majorName).toBe('数字经济')

    const lowAltitude = records.find(r => r.majorCode === '020110TK')
    expect(lowAltitude).toBeDefined()
    expect(lowAltitude!.majorName).toBe('低空经济与管理')
  })

  it('notes 从专业名称括号备注中提取', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const lowAltitude = records.find(r => r.majorCode === '020110TK')
    expect(lowAltitude).toBeDefined()
    expect(lowAltitude!.majorName).toBe('低空经济与管理')
    expect(lowAltitude!.notes).toBe('（注：授予管理学学士学位）')
  })

  it('无备注的专业 notes 为 undefined', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const philosophy = records.find(r => r.majorCode === '010101')
    expect(philosophy).toBeDefined()
    expect(philosophy!.notes).toBeUndefined()
  })

  it('门类与专业类正确归属', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const philosophy = records.find(r => r.majorCode === '010101')!
    expect(philosophy.category).toBe('哲学')
    expect(philosophy.subCategory).toBe('哲学类')

    const infoSec = records.find(r => r.majorCode === '080910TK')!
    expect(infoSec.category).toBe('工学')
    expect(infoSec.subCategory).toBe('计算机类')
  })
})
