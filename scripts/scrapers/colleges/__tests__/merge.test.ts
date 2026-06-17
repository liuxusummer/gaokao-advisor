import { describe, it, expect } from 'vitest'
import { matchColleges, mergeFields, matchAndMerge } from '../merge'
import type { MoeRecord, GaokaoRecord } from '../../types'

const moeRecords: MoeRecord[] = [
  {
    id: '4111010001', name: '北京大学', province: '北京市', city: '北京市',
    level: '普通本科', nature: 'public', affiliation: '教育部',
    sourceUrl: 'https://moe.gov.cn/test',
  },
  {
    id: '4133010003', name: '浙江大学', province: '浙江省', city: '杭州市',
    level: '普通本科', nature: 'public', affiliation: '教育部',
    sourceUrl: 'https://moe.gov.cn/test',
  },
  {
    id: '4133010110', name: '西湖大学', province: '浙江省', city: '杭州市',
    level: '普通本科', nature: 'private', affiliation: '浙江省',
    sourceUrl: 'https://moe.gov.cn/test',
  },
]

const gaokaoRecords: GaokaoRecord[] = [
  {
    gaokaoId: '10001', name: '北京大学', officialWebsite: 'https://www.pku.edu.cn',
    gaokaoUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    province: '北京', sourceUrl: 'https://gaokao.chsi.com.cn/test',
  },
  {
    gaokaoId: '10003', name: '浙江大学', officialWebsite: 'https://www.zju.edu.cn',
    gaokaoUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10003.dhtml',
    province: '浙江', sourceUrl: 'https://gaokao.chsi.com.cn/test',
  },
  // 野鸡大学：不在教育部名单中
  {
    gaokaoId: '99999', name: '野鸡大学', officialWebsite: 'https://fake.edu',
    gaokaoUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-99999.dhtml',
    province: '浙江', sourceUrl: 'https://gaokao.chsi.com.cn/test',
  },
]

describe('matchColleges', () => {
  it('匹配成功的记录数 = 教育部名单数（阳光高考侧野鸡大学被丢弃）', () => {
    const { matched, unmatchedMoe, droppedGaokao } = matchColleges(moeRecords, gaokaoRecords)
    expect(matched).toHaveLength(2)
    expect(unmatchedMoe).toHaveLength(1) // 西湖大学未在阳光高考中
    expect(droppedGaokao).toHaveLength(1) // 野鸡大学被丢弃
  })

  it('匹配的记录包含教育部和阳光高考双方字段', () => {
    const { matched } = matchColleges(moeRecords, gaokaoRecords)
    const pku = matched.find((m) => m.moe.name === '北京大学')!
    expect(pku.moe.id).toBe('4111010001')
    expect(pku.gaokao?.officialWebsite).toBe('https://www.pku.edu.cn')
  })

  it('未匹配的教育部记录 gaokao 为 null', () => {
    const { unmatchedMoe } = matchColleges(moeRecords, gaokaoRecords)
    const westlake = unmatchedMoe[0]
    expect(westlake.name).toBe('西湖大学')
  })
})

describe('mergeFields', () => {
  it('教育部字段优先，阳光高考补充官网', () => {
    const { matched } = matchColleges(moeRecords, gaokaoRecords)
    const pku = matched.find((m) => m.moe.name === '北京大学')!
    const merged = mergeFields(pku)

    expect(merged.id).toBe('4111010001')
    expect(merged.name).toBe('北京大学')
    expect(merged.officialWebsite).toBe('https://www.pku.edu.cn')
    expect(merged.gaokaoUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml')
    expect(merged._meta.source).toBe('merged')
    expect(merged._meta.verified).toBe(true)
  })

  it('未匹配阳光高考的教育部记录官网为空', () => {
    const { unmatchedMoe } = matchColleges(moeRecords, gaokaoRecords)
    const westlake = unmatchedMoe[0]
    const merged = mergeFields({ moe: westlake, gaokao: null })

    expect(merged.officialWebsite).toBe('')
    expect(merged._meta.verified).toBe(true)
  })
})

describe('matchAndMerge', () => {
  it('完整流程：匹配 + 合并 + 校验', () => {
    const result = matchAndMerge(moeRecords, gaokaoRecords)

    expect(result.records).toHaveLength(3) // 教育部名单 3 条全部保留
    expect(result.warnings).toHaveLength(1) // 西湖大学官网缺失

    const westlake = result.records.find((r) => r.name === '西湖大学')!
    expect(westlake.officialWebsite).toBe('')
  })
})
