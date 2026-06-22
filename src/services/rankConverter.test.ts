import { describe, it, expect } from 'vitest'
import { findScoreByRank, convertRankToEquivalentScores } from './rankConverter'
import type { RankTableEntry } from './dataLoader'

const entries: RankTableEntry[] = [
  { province: '浙江', year: 2024, category: '综合', score: 700, rank: 50, count: 50, cumulativeCount: 50 },
  { province: '浙江', year: 2024, category: '综合', score: 690, rank: 200, count: 150, cumulativeCount: 200 },
  { province: '浙江', year: 2024, category: '综合', score: 680, rank: 500, count: 300, cumulativeCount: 500 },
  { province: '浙江', year: 2024, category: '综合', score: 670, rank: 1000, count: 500, cumulativeCount: 1000 },
  { province: '浙江', year: 2024, category: '综合', score: 660, rank: 2000, count: 1000, cumulativeCount: 2000 },
]

describe('findScoreByRank', () => {
  it('精确命中：cumulativeCount === userRank', () => {
    const result = findScoreByRank(200, entries)
    expect(result.score).toBe(690)
    expect(result.exactMatch).toBe(true)
  })

  it('近似命中：cumulativeCount 落在两个分数段之间，取较低分', () => {
    const result = findScoreByRank(300, entries)
    expect(result.score).toBe(680)
    expect(result.exactMatch).toBe(false)
  })

  it('超出最大位次：返回最低分', () => {
    const result = findScoreByRank(5000, entries)
    expect(result.score).toBe(660)
    expect(result.exactMatch).toBe(false)
  })

  it('小于最小位次：返回最高分', () => {
    const result = findScoreByRank(10, entries)
    expect(result.score).toBe(700)
    expect(result.exactMatch).toBe(false)
  })

  it('空数组抛错', () => {
    expect(() => findScoreByRank(100, [])).toThrow('entries must not be empty')
  })

  it('未排序输入：内部排序后正确换算', () => {
    const shuffled = [...entries].reverse()
    const result = findScoreByRank(200, shuffled)
    expect(result.score).toBe(690)
    expect(result.exactMatch).toBe(true)
  })
})

describe('convertRankToEquivalentScores', () => {
  const entries2023: RankTableEntry[] = [
    { province: '浙江', year: 2023, category: '综合', score: 695, rank: 50, count: 50, cumulativeCount: 50 },
    { province: '浙江', year: 2023, category: '综合', score: 685, rank: 200, count: 150, cumulativeCount: 200 },
    { province: '浙江', year: 2023, category: '综合', score: 675, rank: 500, count: 300, cumulativeCount: 500 },
  ]
  const entries2024: RankTableEntry[] = [
    { province: '浙江', year: 2024, category: '综合', score: 700, rank: 50, count: 50, cumulativeCount: 50 },
    { province: '浙江', year: 2024, category: '综合', score: 690, rank: 200, count: 150, cumulativeCount: 200 },
    { province: '浙江', year: 2024, category: '综合', score: 680, rank: 500, count: 300, cumulativeCount: 500 },
  ]
  const entries2025: RankTableEntry[] = [
    { province: '浙江', year: 2025, category: '综合', score: 705, rank: 50, count: 50, cumulativeCount: 50 },
    { province: '浙江', year: 2025, category: '综合', score: 695, rank: 200, count: 150, cumulativeCount: 200 },
    { province: '浙江', year: 2025, category: '综合', score: 685, rank: 500, count: 300, cumulativeCount: 500 },
  ]

  it('多年份换算：结果按年份降序排列', () => {
    const entriesByYear = new Map<number, RankTableEntry[]>([
      [2023, entries2023],
      [2024, entries2024],
      [2025, entries2025],
    ])
    const result = convertRankToEquivalentScores(200, entriesByYear)
    expect(result).toHaveLength(3)
    expect(result[0].year).toBe(2025)
    expect(result[1].year).toBe(2024)
    expect(result[2].year).toBe(2023)
  })

  it('等效分和等效位次正确', () => {
    const entriesByYear = new Map<number, RankTableEntry[]>([
      [2024, entries2024],
    ])
    const result = convertRankToEquivalentScores(200, entriesByYear)
    expect(result[0].equivalentScore).toBe(690)
    expect(result[0].equivalentRank).toBe(200)
    expect(result[0].exactMatch).toBe(true)
  })

  it('userRank <= 0 抛 RangeError', () => {
    const entriesByYear = new Map<number, RankTableEntry[]>([[2024, entries2024]])
    expect(() => convertRankToEquivalentScores(0, entriesByYear)).toThrow(RangeError)
    expect(() => convertRankToEquivalentScores(-1, entriesByYear)).toThrow(RangeError)
  })

  it('空 Map 返回空数组', () => {
    const result = convertRankToEquivalentScores(200, new Map())
    expect(result).toEqual([])
  })

  it('某年空数组跳过该年份', () => {
    const entriesByYear = new Map<number, RankTableEntry[]>([
      [2023, []],
      [2024, entries2024],
    ])
    const result = convertRankToEquivalentScores(200, entriesByYear)
    expect(result).toHaveLength(1)
    expect(result[0].year).toBe(2024)
  })
})
