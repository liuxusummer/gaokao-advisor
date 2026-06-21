import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

/**
 * 解析广东省一分一段表 PDF 文本（分物理类/历史类）。
 *
 * PDF 文本格式（pdf-parse 提取后）通常为逐行文本：
 *   分数 人数 累计人数
 *   698 46 266
 *   697 40 312
 *   ...
 *
 * 也可能出现无表头、纯数据行的情况。
 */
export function parseGdTable(
  text: string,
  year: number,
  category: '物理类' | '历史类',
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
    const match = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)$/)
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
      province: '广东',
      year,
      category,
      score,
      rank,
      count,
      cumulativeCount,
      _meta: {
        source: 'gaokao',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false,
      },
    })
  }

  return records
}
