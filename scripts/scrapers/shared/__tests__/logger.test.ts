import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLogger } from '../logger'

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('info 级别输出 JSON 格式日志', () => {
    const logger = createLogger('test')
    logger.info('hello', { key: 'value' })

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.level).toBe('info')
    expect(output.module).toBe('test')
    expect(output.message).toBe('hello')
    expect(output.context).toEqual({ key: 'value' })
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('error 级别输出到 console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('test')
    logger.error('failed', { code: 500 })

    expect(errorSpy).toHaveBeenCalled()
    const output = JSON.parse(errorSpy.mock.calls[0][0])
    expect(output.level).toBe('error')
    expect(output.message).toBe('failed')
  })

  it('warn 级别输出到 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = createLogger('test')
    logger.warn('caution')

    expect(warnSpy).toHaveBeenCalled()
    const output = JSON.parse(warnSpy.mock.calls[0][0])
    expect(output.level).toBe('warn')
  })
})
