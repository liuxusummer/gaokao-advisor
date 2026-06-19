import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matchMajors, loadMajorMapping } from './majorMatcher'

const mockMapping = {
  math: ['数学类', '统计学类', '计算机类'],
  physics: ['机械类', '电气类', '电子信息类', '自动化类'],
  computer: ['计算机类', '电子信息类', '自动化类'],
}

describe('matchMajors', () => {
  it('返回单个学科对应的专业大类', () => {
    const result = matchMajors(['math'], mockMapping)
    expect(result).toEqual(['数学类', '统计学类', '计算机类'])
  })

  it('多学科取并集去重', () => {
    const result = matchMajors(['math', 'computer'], mockMapping)
    expect(result).toEqual(['数学类', '统计学类', '计算机类', '电子信息类', '自动化类'])
  })

  it('未知学科返回空数组', () => {
    const result = matchMajors(['unknown'], mockMapping)
    expect(result).toEqual([])
  })

  it('空输入返回空数组', () => {
    const result = matchMajors([], mockMapping)
    expect(result).toEqual([])
  })
})

describe('loadMajorMapping', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功加载映射', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapping,
    })
    const mapping = await loadMajorMapping()
    expect(mapping).toEqual(mockMapping)
  })

  it('加载失败返回空对象', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const mapping = await loadMajorMapping()
    expect(mapping).toEqual({})
  })
})
