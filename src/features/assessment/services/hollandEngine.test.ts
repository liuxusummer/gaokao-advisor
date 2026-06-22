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

  it('传入自定义 questions 参数计分', () => {
    const customQuestions = [
      { id: 101, text: '测试题 R1', dimension: 'R' },
      { id: 102, text: '测试题 R2', dimension: 'R' },
      { id: 103, text: '测试题 I1', dimension: 'I' },
      { id: 104, text: '测试题 I2', dimension: 'I' },
    ]
    const answers: Record<number, number> = {
      101: 5,
      102: 5,
      103: 3,
      104: 3,
    }
    const result = calculateHolland(answers, customQuestions)
    expect(result.scores.R).toBe(10)
    expect(result.scores.I).toBe(6)
    expect(result.scores.A).toBe(0)
    expect(result.code.startsWith('RI')).toBe(true)
  })

  it('60 题计分：每维度 10 题，每题 5 分，维度得分最大 50', () => {
    const questions60 = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      text: `题 ${i + 1}`,
      dimension: ['R', 'I', 'A', 'S', 'E', 'C'][Math.floor(i / 10)],
    }))
    const answers: Record<number, number> = {}
    questions60.forEach((q) => {
      answers[q.id] = q.dimension === 'R' ? 5 : 1
    })
    const result = calculateHolland(answers, questions60)
    expect(result.scores.R).toBe(50)
    expect(result.scores.I).toBe(10)
    expect(result.scores.A).toBe(10)
    expect(result.scores.S).toBe(10)
    expect(result.scores.E).toBe(10)
    expect(result.scores.C).toBe(10)
    expect(result.code.startsWith('R')).toBe(true)
  })
})
