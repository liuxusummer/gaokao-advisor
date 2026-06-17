import { describe, it, expect } from 'vitest'
import { buildMeta } from '../meta'
import { SCRAPER_VERSION } from '../../config'

describe('buildMeta', () => {
  it('生成完整的溯源字段', () => {
    const meta = buildMeta('merged', 'https://example.com/source', true)

    expect(meta.source).toBe('merged')
    expect(meta.sourceUrl).toBe('https://example.com/source')
    expect(meta.scraperVersion).toBe(SCRAPER_VERSION)
    expect(meta.verified).toBe(true)
    expect(meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('verified 可为 false', () => {
    const meta = buildMeta('moe_list', 'https://moe.gov.cn', false)
    expect(meta.verified).toBe(false)
  })

  it('fetchedAt 为合法 ISO 8601 时间', () => {
    const meta = buildMeta('gaokao', 'https://gaokao.chsi.com.cn', true)
    const date = new Date(meta.fetchedAt)
    expect(date.getTime()).not.toBeNaN()
  })
})
