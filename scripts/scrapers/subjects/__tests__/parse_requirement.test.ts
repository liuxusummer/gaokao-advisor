import { describe, it, expect } from 'vitest'
import { parseRequirement } from '../parse_requirement'

describe('parseRequirement', () => {
  it('不提科目要求 → none', () => {
    const result = parseRequirement('不提科目要求')
    expect(result.type).toBe('none')
    expect(result.subjects).toEqual([])
  })

  it('1 门必选', () => {
    const result = parseRequirement('物理(1门科目考生必须选考方可报考)')
    expect(result.type).toBe('one_required')
    expect(result.subjects).toEqual(['物理'])
  })

  it('2 门必选', () => {
    const result = parseRequirement('物理,化学(2门科目考生均须选考方可报考)')
    expect(result.type).toBe('two_required')
    expect(result.subjects).toEqual(['物理', '化学'])
  })

  it('3 门必选', () => {
    const result = parseRequirement('物理,化学,生物(3门科目考生均须选考方可报考)')
    expect(result.type).toBe('three_required')
    expect(result.subjects).toEqual(['物理', '化学', '生物'])
  })

  it('2 门选考 1 门', () => {
    const result = parseRequirement('物理,化学(2门科目考生选考其中1门即可报考)')
    expect(result.type).toBe('any_of_two')
    expect(result.subjects).toEqual(['物理', '化学'])
  })

  it('3 门选考 2 门', () => {
    const result = parseRequirement('物理,化学,生物(3门科目考生选考其中2门即可报考)')
    expect(result.type).toBe('any_of_three')
    expect(result.subjects).toEqual(['物理', '化学', '生物'])
  })

  it('全角逗号处理', () => {
    const result = parseRequirement('物理，化学(2门科目考生均须选考方可报考)')
    expect(result.type).toBe('two_required')
    expect(result.subjects).toEqual(['物理', '化学'])
  })

  it('未识别格式 → unknown', () => {
    const result = parseRequirement('特殊要求')
    expect(result.type).toBe('unknown')
    expect(result.subjects).toEqual([])
  })
})
