import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseJsSubjects } from '../jiangsu'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_sample.txt')
const fixtureText = fs.readFileSync(fixturePath, 'utf-8')

// 将文本样本转为二维数组（模拟 xlsx sheet_to_json 输出）
function textToRows(text: string): string[][] {
  return text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t'))
}

describe('parseJsSubjects', () => {
  const rows = textToRows(fixtureText)

  it('正常解析 5 条记录（跳过标题行）', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    expect(records).toHaveLength(5)
  })

  it('字段正确映射', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    const first = records[0]
    expect(first.collegeName).toBe('北京大学')
    expect(first.province).toBe('江苏')
    expect(first.year).toBe(2024)
    expect(first.majorName).toBe('数学类')
    expect(first.majorCode).toBe('070101')
    expect(first.majorGroup).toBe('01')
    expect(first.majorGroupName).toBe('北京大学01专业组(不限)')
    expect(first.requirementType).toBe('two_required')
    expect(first.requiredSubjects).toEqual(['物理', '化学'])
  })

  it('专业组名拆分', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    const law = records.find(r => r.majorName === '法学')
    expect(law).toBeDefined()
    expect(law!.majorGroup).toBe('02')
    expect(law!.majorGroupName).toBe('北京大学02专业组(思想政治)')
  })

  it('多院校解析', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    const colleges = new Set(records.map(r => r.collegeName))
    expect(colleges.size).toBe(3) // 北京大学、中国人民大学、清华大学
  })

  it('空数组返回空', () => {
    const records = parseJsSubjects([], 'https://example.com/js.xlsx')
    expect(records).toEqual([])
  })
})
