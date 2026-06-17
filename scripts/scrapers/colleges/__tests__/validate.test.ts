import { describe, it, expect } from 'vitest'
import { validateRecord } from '../merge'
import type { CollegeRecord } from '../../types'

const validRecord: CollegeRecord = {
  id: '4111010001',
  moeCode: '4111010001',
  name: '北京大学',
  province: '北京市',
  city: '北京市',
  level: ['普通本科'],
  type: '综合',
  nature: 'public',
  affiliation: '教育部',
  officialWebsite: 'https://www.pku.edu.cn',
  gaokaoUrl: 'https://gaokao.chsi.com.cn/test',
  _meta: {
    source: 'merged',
    sourceUrl: 'https://moe.gov.cn/test',
    fetchedAt: '2026-06-17T10:00:00.000Z',
    scraperVersion: '1.0.0',
    verified: true,
  },
}

describe('validateRecord', () => {
  it('合法记录返回 { valid: true }', () => {
    const result = validateRecord(validRecord)
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('id 为空时校验失败', () => {
    const result = validateRecord({ ...validRecord, id: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('id')
  })

  it('name 为空时校验失败', () => {
    const result = validateRecord({ ...validRecord, name: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('name')
  })

  it('officialWebsite 为空时校验仍通过（允许空）', () => {
    const result = validateRecord({ ...validRecord, officialWebsite: '' })
    expect(result.valid).toBe(true)
  })

  it('verified=false 时校验失败', () => {
    const result = validateRecord({
      ...validRecord,
      _meta: { ...validRecord._meta, verified: false },
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('verified')
  })
})
