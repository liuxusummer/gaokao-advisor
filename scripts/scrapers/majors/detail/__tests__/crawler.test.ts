import { describe, it, expect, vi } from 'vitest'
import { crawlCatalog } from '../crawler.js'
import type { CategoryItem, MajorListItem, MajorDetailResponse } from '../types.js'

// Mock API 函数
vi.mock('../api.js', () => ({
  fetchCategories: vi.fn(),
  fetchSubcategories: vi.fn(),
  fetchMajors: vi.fn(),
  fetchMajorDetail: vi.fn(),
}))

import { fetchCategories, fetchSubcategories, fetchMajors, fetchMajorDetail } from '../api.js'

const mockCategories: CategoryItem[] = [
  { key: '105001', name: '哲学' },
]
const mockSubcategories: CategoryItem[] = [
  { key: '10500101', name: '哲学类' },
]
const mockMajors: MajorListItem[] = [
  { zydm: '010101', zymc: '哲学', specId: '73381059', zymyd: '4.2', hasZyjs: true },
  { zydm: '010102', zymc: '逻辑学', specId: '73381063', zymyd: '3.5', hasZyjs: true },
]

function makeMockDetail(specId: string, zymc: string): MajorDetailResponse {
  return {
    zydm: '010101', zymc, ml: '哲学', mlCode: '01', xk: '哲学类', xkCode: '0101',
    xlcc: '本科（普通教育）', specId, xsgm: '1000-2000', boyPercent: 50, girlPercent: 50,
    zyjs: { desc: '介绍', zymx: null },
    jyfxInfo: { jyfxList: [{ jyfx: '考研', url4Xzpt: '' }] },
    zymyd: [], kyfx: [], zytjzsList: [], simileZyList: [],
    year: '2025',
  }
}

describe('crawlCatalog', () => {
  it('完整遍历门类→专业类→专业→详情', async () => {
    vi.mocked(fetchCategories).mockResolvedValue(mockCategories)
    vi.mocked(fetchSubcategories).mockResolvedValue(mockSubcategories)
    vi.mocked(fetchMajors).mockResolvedValue(mockMajors)
    vi.mocked(fetchMajorDetail)
      .mockResolvedValueOnce(makeMockDetail('73381059', '哲学'))
      .mockResolvedValueOnce(makeMockDetail('73381063', '逻辑学'))

    const onProgress = vi.fn()
    const result = await crawlCatalog({} as never, '1050', '本科（普通教育）', onProgress)

    expect(result.records).toHaveLength(2)
    expect(result.records[0].majorName).toBe('哲学')
    expect(result.records[1].majorName).toBe('逻辑学')
    expect(fetchCategories).toHaveBeenCalledWith(expect.anything(), '1050')
    expect(fetchSubcategories).toHaveBeenCalledWith(expect.anything(), '105001')
    expect(fetchMajors).toHaveBeenCalledWith(expect.anything(), '10500101')
    expect(fetchMajorDetail).toHaveBeenCalledWith(expect.anything(), '73381059')
    expect(fetchMajorDetail).toHaveBeenCalledWith(expect.anything(), '73381063')
  })

  it('onProgress 回调被正确调用', async () => {
    vi.mocked(fetchCategories).mockResolvedValue(mockCategories)
    vi.mocked(fetchSubcategories).mockResolvedValue(mockSubcategories)
    vi.mocked(fetchMajors).mockResolvedValue(mockMajors)
    vi.mocked(fetchMajorDetail)
      .mockResolvedValueOnce(makeMockDetail('73381059', '哲学'))
      .mockResolvedValueOnce(makeMockDetail('73381063', '逻辑学'))

    const onProgress = vi.fn()
    await crawlCatalog({} as never, '1050', '本科（普通教育）', onProgress)

    expect(onProgress).toHaveBeenCalled()
    // 至少调用 2 次（2 个专业）
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('详情 API 失败时跳过当前专业继续采集', async () => {
    vi.mocked(fetchCategories).mockResolvedValue(mockCategories)
    vi.mocked(fetchSubcategories).mockResolvedValue(mockSubcategories)
    vi.mocked(fetchMajors).mockResolvedValue(mockMajors)
    vi.mocked(fetchMajorDetail)
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce(makeMockDetail('73381063', '逻辑学'))

    const onProgress = vi.fn()
    const result = await crawlCatalog({} as never, '1050', '本科（普通教育）', onProgress)

    expect(result.records).toHaveLength(1)
    expect(result.records[0].majorName).toBe('逻辑学')
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].specId).toBe('73381059')
  })

  it('空门类列表返回空数组', async () => {
    vi.mocked(fetchCategories).mockResolvedValue([])
    const result = await crawlCatalog({} as never, '1050', '本科（普通教育）')
    expect(result.records).toEqual([])
    expect(result.failed).toEqual([])
  })
})
