import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isAxiosError: (e: unknown) => e && typeof e === 'object' && 'isAxiosError' in e,
  },
}))

import axios from 'axios'

describe('HttpClient', () => {
  let tmpDir: string
  let client: HttpClient

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'http-test-'))
    client = new HttpClient(tmpDir)
    vi.clearAllMocks()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('成功请求返回 HTML 和 fromCache=false', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: '<html>test</html>',
      status: 200,
    })

    const result = await client.fetch('https://example.com', { cacheKey: 'test1' })

    expect(result.html).toBe('<html>test</html>')
    expect(result.fromCache).toBe(false)
    expect(result.url).toBe('https://example.com')
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('缓存命中时返回缓存内容且 fromCache=true', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: '<html>cached</html>',
      status: 200,
    })
    await client.fetch('https://example.com', { cacheKey: 'cached_key' })

    const result = await client.fetch('https://example.com', { cacheKey: 'cached_key' })

    expect(result.html).toBe('<html>cached</html>')
    expect(result.fromCache).toBe(true)
    expect(axios.get).toHaveBeenCalledTimes(1)
  })

  it('forceRefresh=true 时忽略缓存', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: '<html>fresh</html>',
      status: 200,
    })

    await client.fetch('https://example.com', { cacheKey: 'force_key' })
    const result = await client.fetch('https://example.com', {
      cacheKey: 'force_key',
      forceRefresh: true,
    })

    expect(result.fromCache).toBe(false)
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('5xx 错误重试 3 次后抛出', async () => {
    const error = {
      response: { status: 500 },
      message: 'Internal Server Error',
      isAxiosError: true,
    }
    ;(axios.get as ReturnType<typeof vi.fn>).mockRejectedValue(error)

    await expect(
      client.fetch('https://example.com', { cacheKey: 'fail_key' })
    ).rejects.toThrow()

    expect(axios.get).toHaveBeenCalledTimes(3)
  })
})
