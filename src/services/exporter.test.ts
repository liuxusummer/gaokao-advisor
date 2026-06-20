import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildFileName, buildRows, buildTsv, buildPrintHtml, exportToExcel } from './exporter'
import type { VolunteerItem, UserProfile } from '../store'
import type { College, Major } from '../data/mock'

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({ '!cols': [] })),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

import * as XLSX from 'xlsx'

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

const mockProfile: UserProfile = {
  provinceId: 'zhejiang', provinceName: '浙江', subjectType: 'physics',
  subjects: ['物理', '化学', '生物'], score: 650, rank: 10000,
  regions: [], levels: [], categories: [], maxTuition: null,
  physicalExam: 'normal', riskPreference: 'balanced', mbtiType: null,
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

describe('buildTsv', () => {
  it('生成含信息行、表头、数据行的 TSV 字符串', () => {
    const tsv = buildTsv([mockItem], mockProfile)
    const lines = tsv.split('\n')

    // 信息行
    expect(lines[0]).toContain('浙江')
    expect(lines[0]).toContain('650')
    expect(lines[0]).toContain('10000')
    expect(lines[1]).toContain('导出时间')

    // 表头
    expect(lines[2]).toBe('志愿序号\t院校名称\t专业名称\t梯度\t录取概率\t选科要求\t学费(元/年)\t服从调剂')

    // 数据行
    expect(lines[3]).toBe('1\t浙江大学\t计算机科学与技术\t稳\t75%\t物理+化学\t6000\t是')
  })

  it('空列表仍生成信息行和表头', () => {
    const tsv = buildTsv([], mockProfile)
    const lines = tsv.split('\n')
    expect(lines).toHaveLength(3) // 信息行 + 表头 + (无数据)
    expect(lines[2]).toContain('志愿序号')
  })

  it('profile 字段为 null 时显示 "未填写"', () => {
    const profile: UserProfile = { ...mockProfile, score: null, rank: null, provinceName: '' }
    const tsv = buildTsv([mockItem], profile)
    expect(tsv).toContain('未填写')
  })
})

describe('buildPrintHtml', () => {
  it('生成含标题、信息、table 的 HTML 字符串', () => {
    const html = buildPrintHtml([mockItem], mockProfile)
    expect(html).toContain('<h1>志愿表</h1>')
    expect(html).toContain('浙江')
    expect(html).toContain('650')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>志愿序号</th>')
    expect(html).toContain('<th>院校名称</th>')
    expect(html).toContain('<td>浙江大学</td>')
    expect(html).toContain('<td>计算机科学与技术</td>')
    expect(html).toContain('<td>稳</td>')
    expect(html).toContain('</table>')
  })

  it('多个志愿生成多行 tr', () => {
    const items: VolunteerItem[] = [
      mockItem,
      { ...mockItem, id: 'c2-m2-2', college: { ...mockCollege, name: '清华大学' } },
    ]
    const html = buildPrintHtml(items, mockProfile)
    const trCount = (html.match(/<tr>/g) || []).length
    // 1 表头 + 2 数据行 = 3
    expect(trCount).toBe(3)
    expect(html).toContain('清华大学')
  })

  it('profile 字段为 null 时显示 "未填写"', () => {
    const profile: UserProfile = { ...mockProfile, score: null, rank: null }
    const html = buildPrintHtml([mockItem], profile)
    expect(html).toContain('未填写')
  })
})

describe('exportToExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('空列表抛错', () => {
    expect(() => exportToExcel([], mockProfile)).toThrow('志愿表为空')
  })

  it('调用 xlsx 生成文件', () => {
    exportToExcel([mockItem], mockProfile)
    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled()
    expect(XLSX.utils.book_new).toHaveBeenCalled()
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled()
    expect(XLSX.writeFile).toHaveBeenCalled()
    const fileName = (XLSX.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(fileName).toMatch(/^志愿表_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/)
  })

  it('aoa_to_sheet 入参包含信息行和表头', () => {
    exportToExcel([mockItem], mockProfile)
    const arg = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // 前 4 行：信息行 x3 + 空行
    expect(arg[0][0]).toContain('浙江')
    expect(arg[1][0]).toContain('650')
    expect(arg[2][0]).toContain('导出时间')
    expect(arg[3]).toEqual([])
    // 第 5 行：表头
    expect(arg[4]).toEqual(['志愿序号', '院校名称', '专业名称', '梯度', '录取概率', '选科要求', '学费(元/年)', '服从调剂'])
    // 第 6 行起：数据
    expect(arg[5][1]).toBe('浙江大学')
  })
})
