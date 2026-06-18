import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjSubjects } from '../zhejiang'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseZjSubjects', () => {
  it('正常解析 3 条记录', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    expect(records).toHaveLength(3)
  })

  it('字段正确映射', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    const math = records[0]
    expect(math.collegeId).toBe('4111010001')
    expect(math.collegeName).toBe('北京大学')
    expect(math.province).toBe('浙江')
    expect(math.level).toBe('本科')
    expect(math.majorName).toBe('数学类')
    expect(math.subjectRequirement).toContain('物理,化学')
    expect(math.requirementType).toBe('two_required')
    expect(math.requiredSubjects).toEqual(['物理', '化学'])
  })

  it('subMajors 解析为数组', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    expect(records[0].subMajors).toEqual(['数学与应用数学', '信息与计算科学'])
  })

  it('不提科目要求正确解析', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    const law = records.find(r => r.majorName === '法学')
    expect(law).toBeDefined()
    expect(law!.requirementType).toBe('none')
    expect(law!.requiredSubjects).toEqual([])
  })

  it('空 HTML 返回空数组', () => {
    const records = parseZjSubjects('', '4111010001', '北京大学', 'https://example.com')
    expect(records).toEqual([])
  })
})
