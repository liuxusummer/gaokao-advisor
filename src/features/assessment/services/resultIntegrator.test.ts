import { describe, it, expect } from 'vitest'
import { integrateResults } from './resultIntegrator'
import type { SubjectAssessmentResult } from '../types'

const subjectResult: SubjectAssessmentResult = {
  subjectScores: { math: 5, physics: 4, computer: 5, chemistry: 3 },
  behaviorScores: { theory_practice: 4 },
  topSubjects: ['math', 'computer', 'physics'],
  recommendedCategories: ['数学类', '统计学类', '计算机类', '电子信息类', '自动化类', '机械类', '电气类'],
  timestamp: 1,
}

const humanitiesResult: SubjectAssessmentResult = {
  subjectScores: { art: 5, history: 4, chinese: 5 },
  behaviorScores: { creative_structured: 3 },
  topSubjects: ['art', 'chinese', 'history'],
  recommendedCategories: ['艺术学理论类', '美术学类', '设计学类', '戏剧与影视学类', '中国语言文学类', '新闻传播学类', '历史学类', '考古学类', '民族学类'],
  timestamp: 1,
}

const majorMapping = {
  math: ['数学类', '统计学类', '计算机类'],
  physics: ['机械类', '电气类', '电子信息类', '自动化类'],
  computer: ['计算机类', '电子信息类', '自动化类'],
  chemistry: ['化学类', '材料类', '生物科学类'],
  biology: ['基础医学类', '临床医学类', '生物科学类'],
  chinese: ['中国语言文学类', '新闻传播学类'],
  history: ['历史学类', '考古学类', '民族学类'],
  geography: ['地理科学类', '环境科学类', '地质学类'],
  politics: ['政治学类', '法学类', '社会学类', '马克思主义理论类'],
  foreign_lang: ['外国语言文学类', '翻译类'],
  art: ['艺术学理论类', '美术学类', '设计学类', '戏剧与影视学类'],
  economics: ['经济学类', '财政学类', '金融学类', '工商管理类'],
}

describe('integrateResults', () => {
  it('生成霍兰德代码', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    expect(result.hollandCode).toBe('RIA')
  })

  it('计算交叉验证一致的专业大类', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    expect(result.agreedCategories).toContain('计算机类')
    expect(result.agreedCategories).toContain('数学类')
    expect(result.agreedCategories).toContain('机械类')
    expect(result.agreedCategories.length).toBeGreaterThanOrEqual(3)
  })

  it('置信度 high（交集 >= 3）', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    expect(result.confidence).toBe('high')
  })

  it('置信度 low（交集 0）', () => {
    const hollandScores = { E: 10, C: 8, R: 6, S: 2, I: 2, A: 2 }
    const result = integrateResults(hollandScores, humanitiesResult, majorMapping)
    expect(result.confidence).toBe('low')
  })
})
