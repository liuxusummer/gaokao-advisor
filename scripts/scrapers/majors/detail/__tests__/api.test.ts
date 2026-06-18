import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { HttpClient } from '../../../shared/http.js'
import { fetchCategories, fetchSubcategories, fetchMajors, fetchMajorDetail } from '../api.js'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isAxiosError: (e: unknown) => e && typeof e === 'object' && 'isAxiosError' in e,
  },
}))
import axios from 'axios'

describe('detail/api', () => {
  let tmpDir: string
  let client: HttpClient

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detail-api-test-'))
    client = new HttpClient(tmpDir)
    vi.clearAllMocks()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('fetchCategories', () => {
    it('正常返回门类列表', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: [{ key: '105001', name: '哲学' }, { key: '105002', name: '经济学' }],
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchCategories(client, '1050')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ key: '105001', name: '哲学' })
    })

    it('flag 为 false 时抛错', async () => {
      const mockResponse = {
        data: JSON.stringify({ msg: null, flag: false }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      await expect(fetchCategories(client, '1050')).rejects.toThrow(/flag.*false/)
    })
  })

  describe('fetchSubcategories', () => {
    it('正常返回专业类列表', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: [{ key: '10500101', name: '哲学类' }],
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchSubcategories(client, '105001')
      expect(result).toEqual([{ key: '10500101', name: '哲学类' }])
    })
  })

  describe('fetchMajors', () => {
    it('正常返回专业列表', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: [
            { zydm: '010101', zymc: '哲学', specId: '73381059', zymyd: '4.2', hasZyjs: true },
          ],
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchMajors(client, '10500101')
      expect(result).toHaveLength(1)
      expect(result[0].specId).toBe('73381059')
    })
  })

  describe('fetchMajorDetail', () => {
    it('正常返回专业详情', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: {
            zydm: '010101',
            zymc: '哲学',
            ml: '哲学',
            mlCode: '01',
            xk: '哲学类',
            xkCode: '0101',
            xlcc: '本科（普通教育）',
            specId: '73381059',
            xsgm: '3000-3500',
            boyPercent: 38,
            girlPercent: 62,
            zyjs: { desc: '本专业学生主要学习...', zymx: null },
            jyfxInfo: { jyfxList: [{ jyfx: '考研', url4Xzpt: '' }] },
            zymyd: [{ type: '3', typeDesc: '综合满意度', rank: 4.2, count: 3479 }],
            kyfx: [{ zydm: '010100', zymc: '哲学' }],
            zytjzsList: [{ schId: '73395168', yxmc: '黑龙江大学', count: 828, rank: 4.6 }],
            simileZyList: [{ zydm: '010102', zymc: '逻辑学', specId: '73381063' }],
            year: '2025',
          },
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchMajorDetail(client, '73381059')
      expect(result.zymc).toBe('哲学')
      expect(result.zyjs?.desc).toBe('本专业学生主要学习...')
      expect(result.boyPercent).toBe(38)
    })

    it('zyjs 为 null 时不抛错', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: {
            zydm: '410121', zymc: '高标准农田建设与应用技术', ml: '农林牧渔', mlCode: '41',
            xk: '农业类', xkCode: '4101', xlcc: '高职（专科）', specId: 'cbwwxpqalt4ryqj4',
            xsgm: '', boyPercent: 0, girlPercent: 0,
            zyjs: null, jyfxInfo: null,
            zymyd: [], kyfx: [], zytjzsList: [], simileZyList: [],
            year: '2025',
          },
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchMajorDetail(client, 'cbwwxpqalt4ryqj4')
      expect(result.zyjs).toBeNull()
      expect(result.jyfxInfo).toBeNull()
    })
  })
})
