import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('probeRankTableYears', () => {
  beforeEach(() => {
    // 重置模块内缓存
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('返回可用年份数组（降序）', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      return Promise.resolve({
        ok: url.includes('2024') || url.includes('2025'),
      } as Response)
    }))
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('beijing')
    expect(years).toEqual([2025, 2024])
  })

  it('无数据省份返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)))
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('unknown')
    expect(years).toEqual([])
  })

  it('内存缓存：第二次调用不重复 fetch', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response))
    vi.stubGlobal('fetch', fetchMock)
    const { probeRankTableYears } = await import('./dataLoader')
    await probeRankTableYears('shanghai')
    const firstCallCount = fetchMock.mock.calls.length
    await probeRankTableYears('shanghai')
    expect(fetchMock.mock.calls.length).toBe(firstCallCount)
  })
})
