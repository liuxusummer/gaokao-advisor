// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parsePdf } from '../pdf'

describe('parsePdf', () => {
  it('对空 Buffer 返回空字符串或抛出错误', async () => {
    // pdf-parse 对空内容会抛错，我们期望它抛出
    await expect(parsePdf(Buffer.from(''))).rejects.toThrow()
  })

  it('函数存在且可导入', async () => {
    expect(typeof parsePdf).toBe('function')
  })
})
