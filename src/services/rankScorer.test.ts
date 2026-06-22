import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  EMPLOYMENT_SCORE_MAP,
  scoreCandidate,
  deriveHollandCategories,
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

  it('EMPLOYMENT_SCORE_MAP 已知类别返回得分，未知类别返回 undefined', () => {
    expect(EMPLOYMENT_SCORE_MAP['工学']).toBe(85)
    expect(EMPLOYMENT_SCORE_MAP['未知类别']).toBeUndefined()
  })
})

describe('scoreCandidate', () => {
  const emptyAssessment: AssessmentInput = {
    hollandCategories: [],
    subjectCategories: [],
    mbtiCategories: [],
  }
  const fullAssessment: AssessmentInput = {
    hollandCategories: ['工学'],
    subjectCategories: ['工学'],
    mbtiCategories: ['工学'],
  }
  const maxCandidate: CandidateInput = {
    probability: 100,
    collegeLevel: 3,
    majorCategory: '工学',
    collegeProvince: '北京',
    tuition: 0,
    employmentScore: 100,
  }
  const minCandidate: CandidateInput = {
    probability: 0,
    collegeLevel: 0,
    majorCategory: '哲学',
    collegeProvince: '西藏',
    tuition: 10000,
    employmentScore: 0,
  }
  const profileWithPrefs: ProfileInput = {
    regions: ['北京'],
    maxTuition: 10000,
  }
  const profileNoPrefs: ProfileInput = {
    regions: [],
    maxTuition: null,
  }

  it('默认权重下，所有维度最小值且不匹配的候选得分 = 0', () => {
    // 使用非空但不匹配的 assessment，使 majorInterest 得分 = 0（而非空 assessment 的中性 50）
    const nonMatchingAssessment: AssessmentInput = {
      hollandCategories: ['工学'],
      subjectCategories: ['工学'],
      mbtiCategories: ['工学'],
    }
    const score = scoreCandidate(minCandidate, DEFAULT_WEIGHTS, nonMatchingAssessment, profileWithPrefs)
    expect(score).toBeCloseTo(0, 0)
  })

  it('默认权重下，所有维度最大值且匹配的候选得分 = 100', () => {
    const score = scoreCandidate(maxCandidate, DEFAULT_WEIGHTS, fullAssessment, profileWithPrefs)
    expect(score).toBeCloseTo(100, 0)
  })

  it('三源测评全匹配时 majorInterest 维度贡献满分', () => {
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, tuition: 10000, employmentScore: 0, collegeProvince: '西藏' },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      fullAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(100, 0)
  })

  it('三源测评全不匹配时 majorInterest 维度贡献 0 分', () => {
    const nonMatchingAssessment: AssessmentInput = {
      hollandCategories: ['理学'],
      subjectCategories: ['理学'],
      mbtiCategories: ['理学'],
    }
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, tuition: 10000, employmentScore: 0, collegeProvince: '西藏' },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      nonMatchingAssessment,
      profileNoPrefs
    )
    // majorCategory='工学' 不在 ['理学'] 中，三源都不匹配，majorInterest 得分 = 0
    expect(score).toBeCloseTo(0, 0)
  })

  it('assessment 三源均为空时 majorInterest 得分 = 50（中性）', () => {
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, tuition: 10000, employmentScore: 0, collegeProvince: '西藏' },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    // 三源都为空，majorInterest 得分 = 50（中性）
    expect(score).toBeCloseTo(50, 0)
  })

  it('三源测评部分匹配时 majorInterest 得分 = 33.3 或 66.7', () => {
    const partialAssessment: AssessmentInput = {
      hollandCategories: ['工学'],
      subjectCategories: [],
      mbtiCategories: [],
    }
    const score = scoreCandidate(
      maxCandidate,
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      partialAssessment,
      profileNoPrefs
    )
    // majorInterest 得分 = (1+0+0)/3 * 100 = 33.33
    expect(score).toBeCloseTo(100 / 3, 1)
  })

  it('用户未设地域偏好（regions=[]）时 region 得分 = 50', () => {
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, tuition: 10000, employmentScore: 0 },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, majorInterest: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(50, 0)
  })

  it('用户未设 maxTuition 时 tuition 得分 = 50', () => {
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, employmentScore: 0, collegeProvince: '西藏' },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, majorInterest: 0, region: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(50, 0)
  })

  it('权重全设 0 时回退到 DEFAULT_WEIGHTS', () => {
    const zeroWeights: RecommendWeights = {
      probability: 0, collegeLevel: 0, majorInterest: 0,
      region: 0, tuition: 0, employment: 0,
    }
    const scoreDefault = scoreCandidate(maxCandidate, DEFAULT_WEIGHTS, fullAssessment, profileWithPrefs)
    const scoreZero = scoreCandidate(maxCandidate, zeroWeights, fullAssessment, profileWithPrefs)
    expect(scoreZero).toBeCloseTo(scoreDefault, 0)
  })

  it('权重之和不等于 100 时按比例归一化', () => {
    const doubleWeights: RecommendWeights = {
      probability: 60, collegeLevel: 50, majorInterest: 40,
      region: 30, tuition: 10, employment: 10,
    }
    const scoreNormal = scoreCandidate(maxCandidate, DEFAULT_WEIGHTS, fullAssessment, profileWithPrefs)
    const scoreDouble = scoreCandidate(maxCandidate, doubleWeights, fullAssessment, profileWithPrefs)
    expect(scoreDouble).toBeCloseTo(scoreNormal, 0)
  })

  it('985 院校 collegeLevel 得分 = 100', () => {
    const candidate985: CandidateInput = { ...maxCandidate, collegeLevel: 3 }
    const score = scoreCandidate(
      candidate985,
      { ...DEFAULT_WEIGHTS, probability: 0, majorInterest: 0, region: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(100, 0)
  })

  it('双一流院校 collegeLevel 得分 = 33.3', () => {
    const candidateDoubleFirst: CandidateInput = { ...maxCandidate, collegeLevel: 1 }
    const score = scoreCandidate(
      candidateDoubleFirst,
      { ...DEFAULT_WEIGHTS, probability: 0, majorInterest: 0, region: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(100 / 3, 1)
  })
})

describe('deriveHollandCategories', () => {
  it('hollandCode 为 undefined 时返回空数组', () => {
    expect(deriveHollandCategories(undefined)).toEqual([])
  })

  it('hollandCode 为空字符串时返回空数组', () => {
    expect(deriveHollandCategories('')).toEqual([])
  })

  it('hollandCode="RIA" 时返回霍兰德推荐的专业大类集合', () => {
    const majorMapping = {
      physics: ['工学', '理学'],
      computer: ['工学'],
      math: ['理学'],
      biology: ['理学', '农学', '医学'],
      chemistry: ['理学', '工学'],
      art: ['艺术学', '文学'],
      chinese: ['文学', '教育学'],
      politics: ['法学', '教育学'],
      economics: ['经济学', '管理学'],
      foreign_lang: ['文学', '经济学'],
    }
    const result = deriveHollandCategories('RIA', majorMapping)
    // R → physics, computer → 工学, 理学
    // I → math, biology, chemistry, computer → 理学, 农学, 医学, 工学
    // A → art, chinese → 艺术学, 文学, 教育学
    expect(result).toEqual(
      expect.arrayContaining(['工学', '理学', '农学', '医学', '艺术学', '文学', '教育学'])
    )
    expect(result).toHaveLength(7)
  })

  it('majorMapping 为空时返回空数组', () => {
    expect(deriveHollandCategories('RIA', {})).toEqual([])
  })

  it('majorMapping 未传入时返回空数组（默认值）', () => {
    expect(deriveHollandCategories('RIA')).toEqual([])
  })
})
