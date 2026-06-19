import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateSubjectScores, loadSubjectQuestions } from './subjectEngine'

const mockQuestions = [
  { id: 1, text: '数学题', dimension: 'math', type: 'subject' as const },
  { id: 2, text: '物理题', dimension: 'physics', type: 'subject' as const },
  { id: 3, text: '化学题', dimension: 'chemistry', type: 'subject' as const },
  { id: 13, text: '行为题', dimension: 'theory_practice', type: 'behavior' as const },
]

describe('calculateSubjectScores', () => {
  it('正确聚合学科维度得分', () => {
    const answers: Record<number, number> = { 1: 5, 2: 3, 3: 4, 13: 2 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.subjectScores.math).toBe(5)
    expect(result.subjectScores.physics).toBe(3)
    expect(result.subjectScores.chemistry).toBe(4)
  })

  it('正确聚合行为倾向得分', () => {
    const answers: Record<number, number> = { 1: 5, 2: 3, 3: 4, 13: 2 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.behaviorScores.theory_practice).toBe(2)
  })

  it('取前 3 高分学科', () => {
    const answers: Record<number, number> = { 1: 5, 2: 3, 3: 4, 13: 2 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.topSubjects).toEqual(['math', 'chemistry', 'physics'])
  })

  it('同分时按字母序排序', () => {
    const answers: Record<number, number> = { 1: 3, 2: 3, 3: 3, 13: 3 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.topSubjects).toEqual(['chemistry', 'math', 'physics'])
  })
})

describe('loadSubjectQuestions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功加载题库', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuestions,
    })
    const questions = await loadSubjectQuestions()
    expect(questions).toEqual(mockQuestions)
  })

  it('加载失败时返回空数组', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const questions = await loadSubjectQuestions()
    expect(questions).toEqual([])
  })
})
