import { describe, it, expect } from 'vitest'
import { buildFileName, buildRows } from './exporter'
import type { VolunteerItem } from '../store'
import type { College, Major } from '../data/mock'

const mockCollege: College = {
  id: 'c1', name: '浙江大学', province: '浙江省', city: '杭州市',
  level: ['本科'], type: '综合', tags: ['985', '211', '双一流'],
  website: 'https://www.zju.edu.cn',
}

const mockMajor: Major = {
  id: 'm1', name: '计算机科学与技术', category: '工学',
  discipline: '计算机类', subjects: ['物理', '化学'], tuition: 6000,
}

const mockItem: VolunteerItem = {
  id: 'c1-m1-1', college: mockCollege, major: mockMajor,
  tier: 'stable', probability: 75, minRank: 5000, obeyAdjust: true,
}

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

describe('buildRows', () => {
  it('将 VolunteerItem 转换为行数据', () => {
    const rows = buildRows([mockItem])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      '志愿序号': 1,
      '院校名称': '浙江大学',
      '专业名称': '计算机科学与技术',
      '梯度': '稳',
      '录取概率': '75%',
      '选科要求': '物理+化学',
      '学费(元/年)': 6000,
      '服从调剂': '是',
    })
  })

  it('空列表返回空数组', () => {
    expect(buildRows([])).toEqual([])
  })

  it('subjects 为空时显示 "-"', () => {
    const item: VolunteerItem = {
      ...mockItem, major: { ...mockMajor, subjects: [] },
    }
    const rows = buildRows([item])
    expect(rows[0]['选科要求']).toBe('-')
  })

  it('tuition 为 undefined 时显示 "-"', () => {
    const item: VolunteerItem = {
      ...mockItem, major: { ...mockMajor, tuition: undefined },
    }
    const rows = buildRows([item])
    expect(rows[0]['学费(元/年)']).toBe('-')
  })

  it('obeyAdjust 为 false 时显示 "否"', () => {
    const item: VolunteerItem = { ...mockItem, obeyAdjust: false }
    const rows = buildRows([item])
    expect(rows[0]['服从调剂']).toBe('否')
  })

  it('多个志愿序号递增', () => {
    const items: VolunteerItem[] = [
      mockItem,
      { ...mockItem, id: 'c2-m2-2' },
      { ...mockItem, id: 'c3-m3-3' },
    ]
    const rows = buildRows(items)
    expect(rows.map((r) => r['志愿序号'])).toEqual([1, 2, 3])
  })
})
