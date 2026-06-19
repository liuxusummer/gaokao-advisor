import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadMbtiMapping, getMbtiCategories } from './mbtiMapper'
import type { MbtiMappingRecord } from '../types'

const mockMapping: MbtiMappingRecord = {
  INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: 'desc' },
  ENFP: { name: '竞选者', categories: ['艺术学', '文学', '教育学'], description: 'desc' },
}

describe('loadMbtiMapping', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功加载映射返回完整对象', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapping,
    })
    const mapping = await loadMbtiMapping()
    expect(mapping).toEqual(mockMapping)
    expect(Object.keys(mapping!)).toHaveLength(2)
  })

  it('fetch 失败返回 null', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const mapping = await loadMbtiMapping()
    expect(mapping).toBeNull()
  })

  it('response 非 ok 返回 null', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    })
    const mapping = await loadMbtiMapping()
    expect(mapping).toBeNull()
  })
})

describe('getMbtiCategories', () => {
  it('有效类型返回对应专业大类数组', () => {
    const result = getMbtiCategories('INTJ', mockMapping)
    expect(result).toEqual(['工学', '理学', '经济学'])
  })

  it('无效类型返回空数组', () => {
    const result = getMbtiCategories('XXXX', mockMapping)
    expect(result).toEqual([])
  })

  it('mbtiType 为 null 返回空数组', () => {
    const result = getMbtiCategories(null, mockMapping)
    expect(result).toEqual([])
  })

  it('mapping 为 null 返回空数组', () => {
    const result = getMbtiCategories('INTJ', null)
    expect(result).toEqual([])
  })
})
