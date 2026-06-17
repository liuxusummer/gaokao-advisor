import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Cache } from '../cache'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('Cache', () => {
  let tmpDir: string
  let cache: Cache

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'))
    cache = new Cache(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('set 后 get 能取回内容', () => {
    cache.set('moe_list', '<html>hello</html>')
    const result = cache.get('moe_list')
    expect(result).toBe('<html>hello</html>')
  })

  it('未缓存的 key 返回 null', () => {
    expect(cache.get('not_exist')).toBeNull()
  })

  it('has 方法正确判断缓存存在', () => {
    cache.set('key1', 'data')
    expect(cache.has('key1')).toBe(true)
    expect(cache.has('key2')).toBe(false)
  })

  it('文件存储在指定目录下，扩展名为 .html', () => {
    cache.set('moe_list', '<html></html>')
    const files = fs.readdirSync(tmpDir)
    expect(files).toContain('moe_list.html')
  })
})
