import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord, RankTableRecordMeta } from '../types'

/**
 * 解析辽宁省一分一段表 PDF 文本。
 *
 * 真实数据格式（来自 lnzsks.com PDF）：
 * 每行格式（tab 分隔）：
 *   分数  人数  累计
 *
 * 特殊情况：
 *   - 最高分行可能有"及以上"后缀（如"708  11  11  及以上"）
 *   - 累计人数可能含逗号（如"1,014"）
 *   - 每页有页眉（分数/人数/累计），需跳过
 */
export function parseLnTable(
  text: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): RankTableRecord[] {
  const records: RankTableRecord[] = []
  const meta: RankTableRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过页眉、页脚、标题
    if (/^(分数|人数|累计|第\s*\d+\s*页|---|^\d+\s+of)/.test(trimmed)) continue
    if (/^(20\d{2}年|辽宁省)/.test(trimmed)) continue

    // 按任意空白分割（部分行累计人数前只有 1 个空格，如 "674 60 1,014"）
    const parts = trimmed.split(/\s+/).filter((p) => p.length > 0)
    if (parts.length < 3) continue

    // 解析分数
    const score = Number(parts[0])
    if (isNaN(score) || score < 0 || score > 750) continue

    // 解析人数和累计人数（可能含逗号，如 "1,014"）
    const count = Number(parts[1].replace(/,/g, ''))
    const cumulativeCount = Number(parts[2].replace(/,/g, ''))

    if (isNaN(count) || isNaN(cumulativeCount)) continue
    if (count < 0 || cumulativeCount < 0) continue

    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '辽宁',
      year,
      category,
      score,
      rank,
      count,
      cumulativeCount,
      _meta: { ...meta },
    })
  }

  return records
}
