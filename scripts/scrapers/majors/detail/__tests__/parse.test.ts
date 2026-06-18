import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseDetail } from '../parse.js'
import type { MajorDetailResponse } from '../types.js'

const philosophyFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '__fixtures__', 'detail_philosophy.json'), 'utf-8'),
) as MajorDetailResponse

const vocationalFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '__fixtures__', 'detail_vocational.json'), 'utf-8'),
) as MajorDetailResponse

describe('parseDetail', () => {
  it('正确转换本科专业详情', () => {
    const record = parseDetail(philosophyFixture, '哲学', '哲学类', '本科（普通教育）')

    expect(record.majorCode).toBe('010101')
    expect(record.majorName).toBe('哲学')
    expect(record.category).toBe('哲学')
    expect(record.subCategory).toBe('哲学类')
    expect(record.educationLevel).toBe('本科（普通教育）')
    expect(record.introduction).toContain('马克思主义哲学')
    expect(record.careerDirections).toEqual(['公务员(省级机关)', '考研', '高中教师'])
    expect(record.durationAndDegree.studentScale).toBe('3000-3500')
    expect(record.durationAndDegree.boyPercent).toBe(38)
    expect(record.durationAndDegree.girlPercent).toBe(62)
    expect(record.durationAndDegree.year).toBe('2025')
    expect(record.satisfaction).toHaveLength(4)
    expect(record.graduateMajors).toHaveLength(4)
    expect(record.recommendedColleges).toHaveLength(3)
    expect(record.similarMajors).toHaveLength(3)
    expect(record.specId).toBe('73381059')
    expect(record._meta.source).toBe('gaokao_chsi')
    expect(record._meta.sourceUrl).toBe('https://gaokao.chsi.com.cn/zyk/zybk/detail/73381059')
  })

  it('正确转换专科专业详情（含主干课程提取）', () => {
    const record = parseDetail(vocationalFixture, '农林牧渔', '农业类', '高职（专科）')

    expect(record.majorCode).toBe('410101')
    expect(record.educationLevel).toBe('高职（专科）')
    expect(record.mainCourses).toBe('作物栽培学、作物育种学、种子生产技术')
    expect(record.careerDirections).toEqual(['种子公司技术员', '农业技术推广'])
  })

  it('zyjs 为 null 时 introduction 为空字符串', () => {
    const detail: MajorDetailResponse = {
      ...philosophyFixture,
      zyjs: null,
    }
    const record = parseDetail(detail, '哲学', '哲学类', '本科（普通教育）')
    expect(record.introduction).toBe('')
    expect(record.mainCourses).toBe('')
  })

  it('jyfxInfo 为 null 时 careerDirections 为空数组', () => {
    const detail: MajorDetailResponse = {
      ...philosophyFixture,
      jyfxInfo: null,
    }
    const record = parseDetail(detail, '哲学', '哲学类', '本科（普通教育）')
    expect(record.careerDirections).toEqual([])
  })

  it('recommendedColleges 最多取 10 条', () => {
    const detail: MajorDetailResponse = {
      ...philosophyFixture,
      zytjzsList: Array.from({ length: 15 }, (_, i) => ({
        schId: `sch_${i}`,
        yxmc: `大学${i}`,
        count: 100 - i,
        rank: 4.0,
      })),
    }
    const record = parseDetail(detail, '哲学', '哲学类', '本科（普通教育）')
    expect(record.recommendedColleges).toHaveLength(10)
  })
})
