import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerProvince,
  getProvince,
  getAllProvinces,
  getEnabledProvinces,
  clearRegistry,
} from '../province_registry'
import type { ProvinceRegistry, ProvinceMeta } from '../province_registry'

const mockMeta: ProvinceMeta = {
  name: '测试省',
  pinyinId: 'test',
  examMode: '3+3',
  volunteerMode: 'major+college',
  categories: ['综合'],
  batchSize: '本科批',
}

describe('province_registry', () => {
  beforeEach(() => {
    clearRegistry()
  })

  it('registerProvince 注册省份后可通过 getProvince 获取', () => {
    const registry: ProvinceRegistry = { meta: mockMeta }
    registerProvince(registry)

    const result = getProvince('测试省')
    expect(result).toBeDefined()
    expect(result?.meta.name).toBe('测试省')
  })

  it('getAllProvinces 返回所有已注册省份', () => {
    registerProvince({ meta: mockMeta })
    registerProvince({
      meta: { ...mockMeta, name: '测试省2', pinyinId: 'test2' },
    })

    const all = getAllProvinces()
    expect(all).toHaveLength(2)
  })

  it('getEnabledProvinces 按 TARGET_PROVINCES 过滤', () => {
    registerProvince({ meta: mockMeta })
    registerProvince({
      meta: { ...mockMeta, name: '未启用省', pinyinId: 'disabled' },
    })

    const original = process.env.TARGET_PROVINCES
    process.env.TARGET_PROVINCES = '测试省'
    const enabled = getEnabledProvinces()
    process.env.TARGET_PROVINCES = original

    expect(enabled).toHaveLength(1)
    expect(enabled[0].meta.name).toBe('测试省')
  })

  it('getProvince 未注册省份返回 undefined', () => {
    expect(getProvince('不存在')).toBeUndefined()
  })
})
