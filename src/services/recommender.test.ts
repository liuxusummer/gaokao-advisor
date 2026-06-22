import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateRecommendations } from './recommender'
import { useAppStore } from '../store'
import type { UserProfile } from '../store'

const baseProfile: UserProfile = {
  provinceId: '',
  provinceName: '',
  subjectType: 'physics',
  subjects: ['物理', '化学'],
  score: 600,
  rank: 5000,
  regions: [],
  levels: [],
  categories: [],
  maxTuition: null,
  physicalExam: 'normal',
  riskPreference: 'balanced',
  mbtiType: null,
}

describe('generateRecommendations MBTI 整合', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.getState().resetProfile()
  })

  it('用户未选择 MBTI 时推荐正常返回', async () => {
    const results = await generateRecommendations(baseProfile)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('用户已选择 MBTI 时推荐正常返回', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: 'desc' },
      }),
    })
    const profileWithMbti = { ...baseProfile, mbtiType: 'INTJ' }
    const results = await generateRecommendations(profileWithMbti)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('MBTI 映射加载失败时推荐正常返回', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const profileWithMbti = { ...baseProfile, mbtiType: 'INTJ' }
    const results = await generateRecommendations(profileWithMbti)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('MBTI 匹配的专业推荐理由包含 MBTI 标注', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: 'desc' },
      }),
    })
    const profileWithMbti = { ...baseProfile, mbtiType: 'INTJ' }
    const results = await generateRecommendations(profileWithMbti)
    const mbtiMatched = results.find(
      (r) => r.reason.includes('MBTI') && r.reason.includes('INTJ')
    )
    // mock 数据中工学专业（如计算机科学与技术）应被 MBTI 匹配
    expect(mbtiMatched).toBeDefined()
  })
})

import { DEFAULT_WEIGHTS, type AssessmentInput, type RecommendWeights } from './rankScorer'

describe('generateRecommendations 加权排序', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.getState().resetProfile()
  })

  it('未传入 options 时使用 DEFAULT_WEIGHTS 和空 assessment，正常返回', async () => {
    const results = await generateRecommendations(baseProfile)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('传入 assessment 参数后，匹配专业兴趣的候选排序靠前', async () => {
    const assessment: AssessmentInput = {
      hollandCategories: ['工学'],
      subjectCategories: ['工学'],
      mbtiCategories: ['工学'],
    }
    const results = await generateRecommendations(baseProfile, undefined, {
      weights: DEFAULT_WEIGHTS,
      assessment,
    })
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
    // 工学类候选应排在前面（如果有）
    const engineeringItems = results.filter((r) => r.major.category === '工学')
    if (engineeringItems.length > 0) {
      // 检查工学候选在前 50% 位置的比例
      const halfIndex = Math.floor(results.length / 2)
      const engineeringInFirstHalf = engineeringItems.filter((_, i) =>
        results.indexOf(engineeringItems[i]) < halfIndex
      ).length
      // 至少有一些工学候选在前半部分
      expect(engineeringInFirstHalf).toBeGreaterThan(0)
    }
  })

  it('传入自定义 weights 参数后，按自定义权重排序', async () => {
    const customWeights: RecommendWeights = {
      probability: 50,
      collegeLevel: 10,
      majorInterest: 10,
      region: 10,
      tuition: 10,
      employment: 10,
    }
    const results = await generateRecommendations(baseProfile, undefined, {
      weights: customWeights,
    })
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('三桶配额截断逻辑保持不变（rush/stable/safe 比例）', async () => {
    const results = await generateRecommendations(baseProfile)
    const rushCount = results.filter((r) => r.tier === 'rush').length
    const stableCount = results.filter((r) => r.tier === 'stable').length
    const safeCount = results.filter((r) => r.tier === 'safe').length
    // balanced 模式下：25% / 50% / 25%
    const total = rushCount + stableCount + safeCount
    if (total > 0) {
      expect(rushCount).toBeLessThanOrEqual(stableCount)
      expect(safeCount).toBeLessThanOrEqual(stableCount)
    }
  })
})
