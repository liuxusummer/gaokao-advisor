import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadColleges, verifyCollegeId } from '../colleges_loader'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('colleges_loader', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'colleges-loader-test-'))
    // 创建一个临时的 colleges.json
    const mockColleges = [
      {
        id: '4111010001',
        moeCode: '4111010001',
        name: '北京大学',
        province: '北京市',
        city: '北京市',
        level: ['普通本科'],
        type: '综合',
        nature: 'public',
        affiliation: '教育部',
        officialWebsite: 'https://www.pku.edu.cn',
        gaokaoUrl: 'https://gaokao.chsi.com.cn/test',
        _meta: {
          source: 'merged',
          sourceUrl: 'https://moe.gov.cn/test',
          fetchedAt: '2026-06-17T10:00:00.000Z',
          scraperVersion: '1.0.0',
          verified: true,
        },
      },
      {
        id: '4133010003',
        moeCode: '4133010003',
        name: '浙江大学',
        province: '浙江省',
        city: '杭州市',
        level: ['普通本科'],
        type: '综合',
        nature: 'public',
        affiliation: '教育部',
        officialWebsite: 'https://www.zju.edu.cn',
        gaokaoUrl: 'https://gaokao.chsi.com.cn/test2',
        _meta: {
          source: 'merged',
          sourceUrl: 'https://moe.gov.cn/test',
          fetchedAt: '2026-06-17T10:00:00.000Z',
          scraperVersion: '1.0.0',
          verified: true,
        },
      },
    ]
    fs.writeFileSync(
      path.join(tmpDir, 'colleges.json'),
      JSON.stringify(mockColleges),
      'utf-8'
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('loadColleges 返回 Map，key 为 id', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    expect(colleges.size).toBe(2)
    expect(colleges.has('4111010001')).toBe(true)
    expect(colleges.has('4133010003')).toBe(true)
  })

  it('loadColleges 返回的 value 包含完整 CollegeRecord', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    const pku = colleges.get('4111010001')!
    expect(pku.name).toBe('北京大学')
    expect(pku.province).toBe('北京市')
    expect(pku.nature).toBe('public')
  })

  it('verifyCollegeId 对存在的 id 返回 true', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    expect(verifyCollegeId('4111010001', colleges)).toBe(true)
  })

  it('verifyCollegeId 对不存在的 id 返回 false', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    expect(verifyCollegeId('9999999999', colleges)).toBe(false)
  })

  it('文件不存在时抛出错误', () => {
    expect(() => loadColleges('/nonexistent/path/colleges.json')).toThrow()
  })
})
