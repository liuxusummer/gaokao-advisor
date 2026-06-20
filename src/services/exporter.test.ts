import { describe, it, expect } from 'vitest'
import { buildFileName } from './exporter'

describe('buildFileName', () => {
  it('生成含日期时间的 xlsx 文件名', () => {
    const name = buildFileName('xlsx')
    expect(name).toMatch(/^志愿表_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/)
  })

  it('支持其他扩展名', () => {
    const name = buildFileName('pdf')
    expect(name).toMatch(/^志愿表_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/)
  })
})
