import type { RankTableEntry } from './dataLoader'

export interface EquivalentScore {
  year: number
  equivalentScore: number
  equivalentRank: number
  exactMatch: boolean
}

/**
 * 在单年一分一段表中二分查找位次对应的分数
 */
export function findScoreByRank(
  userRank: number,
  entries: RankTableEntry[]
): { score: number; exactMatch: boolean } {
  if (entries.length === 0) {
    throw new Error('entries must not be empty')
  }

  const sorted = [...entries].sort((a, b) => a.cumulativeCount - b.cumulativeCount)

  // 二分查找 cumulativeCount >= userRank 的最小条目
  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (sorted[mid].cumulativeCount < userRank) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  const matched = sorted[lo]
  const exactMatch = matched.cumulativeCount === userRank
  return { score: matched.score, exactMatch }
}

/**
 * 对一组按年份分组的一分一段表做等效位次换算
 * @param userRank 用户当年位次
 * @param entriesByYear 按年份分组的一分一段表数据
 * @returns 各年等效分列表，按年份降序排列
 */
export function convertRankToEquivalentScores(
  userRank: number,
  entriesByYear: Map<number, RankTableEntry[]>
): EquivalentScore[] {
  if (userRank <= 0) {
    throw new RangeError('userRank must be positive')
  }

  const results: EquivalentScore[] = []
  for (const [year, entries] of entriesByYear) {
    if (entries.length === 0) continue
    const { score, exactMatch } = findScoreByRank(userRank, entries)
    results.push({
      year,
      equivalentScore: score,
      equivalentRank: userRank,
      exactMatch,
    })
  }

  results.sort((a, b) => b.year - a.year)
  return results
}
