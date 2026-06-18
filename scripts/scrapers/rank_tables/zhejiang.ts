import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

/**
 * 解析浙江省一分一段表 PDF 文本。
 *
 * PDF 文本格式（pdf-parse 提取后）通常为逐行文本：
 *   分数 人数 累计人数
 *   698-750 266 266
 *   697 46 312
 *   696 40 352
 *   ...
 *
 * 也可能出现无表头、纯数据行的情况。
 * 部分行可能包含 "分数段" 描述（如 698-750），需特殊处理。
 */
export function parseZjTable(
  text: string,
  year: number,
  sourceUrl: string
): RankTableRecord[] {
  const records: RankTableRecord[] = []
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过表头行
    if (/分数|人数|累计|score|count|cumulative/i.test(trimmed)) continue

    // 匹配 "分数 人数 累计人数" 格式
    // 分数可能是单个数字（697）或区间（698-750）
    const match = trimmed.match(/^(\d+)(?:\s*-\s*\d+)?\s+(\d+)\s+(\d+)$/)
    if (!match) continue

    const score = parseInt(match[1], 10)
    const count = parseInt(match[2], 10)
    const cumulativeCount = parseInt(match[3], 10)

    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) continue
    if (score < 0 || score > 750) continue
    if (count < 0 || cumulativeCount < 0) continue

    // rank = 上一分数的累计人数 + 1（即该分数段的最高位次）
    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '浙江',
      year,
      category: '综合',
      score,
      rank,
      count,
      cumulativeCount,
      _meta: {
        source: 'zjzs',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: true,
      },
    })
  }

  return records
}
