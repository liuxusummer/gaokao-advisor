import { describe, it, expect } from 'vitest'
import { calculateHolland } from './hollandEngine'
import { hollandQuestions } from '../../../data/mock'

describe('calculateHolland', () => {
  it('正确聚合六维度得分', () => {
    const answers: Record<number, number> = {}
    hollandQuestions.forEach((q) => {
      answers[q.id] = q.dimension === 'R' ? 5 : 1
    })
    const result = calculateHolland(answers)
    expect(result.scores.R).toBe(10)
    expect(result.scores.I).toBe(2)
    expect(result.scores.A).toBe(2)
    expect(result.scores.S).toBe(2)
    expect(result.scores.E).toBe(2)
    expect(result.scores.C).toBe(2)
  })

  it('生成 3 字母霍兰德代码', () => {
    const answers: Record<number, number> = {}
    hollandQuestions.forEach((q) => {
      if (q.dimension === 'R') answers[q.id] = 5
      else if (q.dimension === 'I') answers[q.id] = 4
      else if (q.dimension === 'A') answers[q.id] = 3
      else answers[q.id] = 1
    })
    const result = calculateHolland(answers)
    expect(result.code).toBe('RIA')
  })

  it('全部同分时按字母序取前 3', () => {
    const answers: Record<number, number> = {}
    hollandQuestions.forEach((q) => {
      answers[q.id] = 3
    })
    const result = calculateHolland(answers)
    expect(result.code).toHaveLength(3)
    expect(result.code).toBe('ACE')
  })
})
