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
