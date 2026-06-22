import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  EMPLOYMENT_SCORE_MAP,
  type RecommendWeights,
  type AssessmentInput,
  type CandidateInput,
  type ProfileInput,
} from './rankScorer'

describe('rankScorer 常量', () => {
  it('DEFAULT_WEIGHTS 包含 6 个维度且总和为 100', () => {
    const keys = Object.keys(DEFAULT_WEIGHTS) as (keyof RecommendWeights)[]
    expect(keys).toHaveLength(6)
    expect(keys).toEqual(
      expect.arrayContaining([
        'probability', 'collegeLevel', 'majorInterest',
        'region', 'tuition', 'employment',
      ])
    )
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBe(100)
  })

  it('DEFAULT_WEIGHTS 符合 PRD 9.5 默认值', () => {
    expect(DEFAULT_WEIGHTS.probability).toBe(30)
    expect(DEFAULT_WEIGHTS.collegeLevel).toBe(25)
    expect(DEFAULT_WEIGHTS.majorInterest).toBe(20)
    expect(DEFAULT_WEIGHTS.region).toBe(15)
    expect(DEFAULT_WEIGHTS.tuition).toBe(5)
    expect(DEFAULT_WEIGHTS.employment).toBe(5)
  })

  it('EMPLOYMENT_SCORE_MAP 包含 12 个专业大类', () => {
    const expectedCategories = [
      '哲学', '经济学', '法学', '教育学', '文学', '历史学',
      '理学', '工学', '农学', '医学', '管理学', '艺术学',
    ]
    for (const cat of expectedCategories) {
      expect(EMPLOYMENT_SCORE_MAP[cat]).toBeDefined()
      expect(EMPLOYMENT_SCORE_MAP[cat]).toBeGreaterThanOrEqual(0)
      expect(EMPLOYMENT_SCORE_MAP[cat]).toBeLessThanOrEqual(100)
    }
  })

  it('EMPLOYMENT_SCORE_MAP 工学得分最高，哲学/历史学最低', () => {
    expect(EMPLOYMENT_SCORE_MAP['工学']).toBe(85)
    expect(EMPLOYMENT_SCORE_MAP['哲学']).toBe(40)
    expect(EMPLOYMENT_SCORE_MAP['历史学']).toBe(40)
  })
})
