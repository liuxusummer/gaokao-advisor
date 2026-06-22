import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hollandQuestions as fallbackQuestions } from '../data/mock'

describe('loadHollandQuestions', () => {
  const mock60Questions = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    text: `测试题目 ${i + 1}`,
    dimension: ['R', 'I', 'A', 'S', 'E', 'C'][Math.floor(i / 10)],
  }))

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('正常加载 60 题', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mock60Questions,
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toHaveLength(60)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('text')
    expect(result[0]).toHaveProperty('dimension')
  })

  it('fetch 失败时降级到 fallback 12 题', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
    expect(result).toHaveLength(12)
  })

  it('JSON 校验失败（非数组）时降级到 fallback', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'array' }),
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
  })

  it('JSON 校验失败（长度不足）时降级到 fallback', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, text: '短题库', dimension: 'R' }],
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
  })

  it('内存缓存：第二次调用不 fetch', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mock60Questions,
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    await loadHollandQuestions()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await loadHollandQuestions()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
