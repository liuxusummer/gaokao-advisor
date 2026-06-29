import { describe, it, expect, vi, beforeEach } from 'vitest'

function createJsonResponse(ok: boolean, body?: unknown): Promise<Response> {
  return Promise.resolve({
    ok,
    headers: { get: () => (ok ? 'application/json' : 'text/html') },
    json: () => Promise.resolve(body ?? {}),
  } as unknown as Response)
}

describe('probeRankTableYears', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('返回可用年份数组（降序）', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const ok = url.includes('2024') || url.includes('2025') || url.includes('2026')
      return createJsonResponse(ok, ok ? { categories: {} } : undefined)
    }))
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('beijing')
    expect(years).toEqual([2026, 2025, 2024])
  })

  it('无数据省份返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as unknown as Response)))
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('unknown')
    expect(years).toEqual([])
  })

  it('内存缓存：第二次调用不重复 fetch', async () => {
    const fetchMock = vi.fn(() => createJsonResponse(true, { categories: {} }))
    vi.stubGlobal('fetch', fetchMock)
    const { probeRankTableYears } = await import('./dataLoader')
    await probeRankTableYears('shanghai')
    const firstCallCount = fetchMock.mock.calls.length
    await probeRankTableYears('shanghai')
    expect(fetchMock.mock.calls.length).toBe(firstCallCount)
  })

  it('空省份名直接返回空数组', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('')
    expect(years).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('非 JSON 响应视为不可用', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      headers: { get: () => 'text/html' },
    } as unknown as Response)))
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('beijing')
    expect(years).toEqual([])
  })

  it('loadProvinceData 加载包含 2026 的一分一段表缓存', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/data/common/colleges.json')) return createJsonResponse(true, [])
      if (url.includes('/data/common/majors/catalog.json')) return createJsonResponse(true, [])
      if (url.includes('/data/subjects/')) return createJsonResponse(true, [])
      if (url.includes('/data/scores/') && url.includes('/scores_')) return createJsonResponse(true, [])
      if (url.includes('/rank_table_')) return createJsonResponse(true, { categories: { '综合': [] } })
      return createJsonResponse(false)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { loadProvinceData } = await import('./dataLoader')
    await loadProvinceData('zhejiang')
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.includes('/rank_table_2026.json'))).toBe(true)
  })
})
