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
