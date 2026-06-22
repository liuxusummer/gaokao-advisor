import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord, RankTableRecordMeta } from '../types'

/**
 * 解析上海市一分一段表 PDF 文本。
 *
 * 真实数据格式（来自 shmeea.edu.cn PDF）：
 * 每行格式（tab 分隔）：
 *   分数  人数  累计人数
 *
 * 特殊情况：
 *   - 最高分显示为"619分及以上"
 *   - 每页有页眉（分数/人数/累计人数）和页脚（第X页/共Y页），需跳过
 */
export function parseShTable(
  text: string,
  year: number,
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
    if (/^(20\d{2}年|上海市)/.test(trimmed)) continue

    // 按 tab 或多个空格分割
    const parts = trimmed.split(/\t+|\s{2,}/).filter((p) => p.length > 0)
    if (parts.length < 3) continue

    // 解析分数（可能是"619分及以上"或纯数字）
    let score: number
    const scoreStr = parts[0]
    if (/^\d+分及以上$/.test(scoreStr)) {
      score = parseInt(scoreStr)
    } else {
      score = Number(scoreStr)
    }

    if (isNaN(score) || score < 0 || score > 750) continue

    const count = Number(parts[1])
    const cumulativeCount = Number(parts[2])

    if (isNaN(count) || isNaN(cumulativeCount)) continue
    if (count < 0 || cumulativeCount < 0) continue

    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '上海',
      year,
      category: '综合',
      score,
      rank,
      count,
      cumulativeCount,
      _meta: { ...meta },
    })
  }

  return records
}
