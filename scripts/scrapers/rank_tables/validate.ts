import type {
  RankTableRecord,
  RankTableValidationResult,
} from '../types'

export function validateRankRecord(record: RankTableRecord): RankTableValidationResult {
  const requiredFields: Array<keyof RankTableRecord> = [
    'province', 'year', 'category', 'score', 'rank', 'count', 'cumulativeCount',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === '' || value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
  }

  // score 范围校验：0-750
  if (record.score < 0 || record.score > 750) {
    return { valid: false, reason: `score 超出范围 (0-750): ${record.score}` }
  }

  // rank 为正整数
  if (!Number.isInteger(record.rank) || record.rank <= 0) {
    return { valid: false, reason: `rank 必须为正整数: ${record.rank}` }
  }

  // count 为非负整数
  if (!Number.isInteger(record.count) || record.count < 0) {
    return { valid: false, reason: `count 必须为非负整数: ${record.count}` }
  }

  // cumulativeCount 为正整数
  if (!Number.isInteger(record.cumulativeCount) || record.cumulativeCount <= 0) {
    return { valid: false, reason: `cumulativeCount 必须为正整数: ${record.cumulativeCount}` }
  }

  // 白名单校验
  if (!record._meta.verified) {
    return { valid: false, reason: '记录未通过校验 (verified=false)' }
  }

  return { valid: true }
}

export function validateRankTableMonotonicity(
  records: RankTableRecord[]
): RankTableValidationResult {
  if (records.length === 0) return { valid: true }

  const seenScores = new Set<number>()

  for (let i = 0; i < records.length; i++) {
    const current = records[i]

    // score 唯一性
    if (seenScores.has(current.score)) {
      return { valid: false, reason: `score 重复: ${current.score}` }
    }
    seenScores.add(current.score)

    // score 降序
    if (i > 0) {
      const prev = records[i - 1]
      if (current.score >= prev.score) {
        return {
          valid: false,
          reason: `score 非降序: ${prev.score} → ${current.score}`,
        }
      }

      // cumulativeCount 递增
      if (current.cumulativeCount <= prev.cumulativeCount) {
        return {
          valid: false,
          reason: `cumulativeCount 非递增: ${prev.cumulativeCount} → ${current.cumulativeCount}`,
        }
      }
    }
  }

  return { valid: true }
}
