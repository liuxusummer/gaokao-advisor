import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseCatalog } from '../parse'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'catalog_sample.txt')
const fixtureText = fs.readFileSync(fixturePath, 'utf-8')

describe('parseCatalog', () => {
  it('正常解析多个专业', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    expect(records.length).toBeGreaterThanOrEqual(7)
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
    const text = '\n\n010101\t哲学\t哲学学士\t四年\n\n'
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
})
