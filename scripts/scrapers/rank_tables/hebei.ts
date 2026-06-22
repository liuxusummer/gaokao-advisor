import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord, RankTableRecordMeta } from '../types'

/**
 * 解析河北省一分一段表 HTML（cheerio 解析 table）。
 *
 * HTML 结构：标准 <table> 表格，每行包含 分数档次 / 人数 / 累计人数 三列。
 * 跳过表头行（含 '分数'/'人数'/'累计' 字样）。
 *
 * 特殊行处理：
 * - "689及以上" → 视为 689 分
 */
export function parseHbTable(
  html: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): RankTableRecord[] {
  const $ = cheerio.load(html)
  const records: RankTableRecord[] = []
  const meta: RankTableRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get()
    if (cells.length < 3) return

    // 跳过表头行
    if (cells.some((c) => c.includes('分数') || c.includes('人数') || c.includes('累计'))) return

    const scoreStr = cells[0]
    const count = Number(cells[1])
    const cumulativeCount = Number(cells[2])

    if (isNaN(count) || isNaN(cumulativeCount)) return

    // 处理 "689及以上" 行
    const aboveMatch = scoreStr.match(/^(\d+)及以上$/)
    if (aboveMatch) {
      const score = parseInt(aboveMatch[1], 10)
      const rank = records.length > 0
        ? records[records.length - 1].cumulativeCount + 1
        : 1
      records.push({
        province: '河北',
        year,
        category,
        score,
        rank,
        count,
        cumulativeCount,
        _meta: { ...meta },
      })
      return
    }

    // 普通数值行
    const score = Number(scoreStr)
    if (!isNaN(score)) {
      if (score < 0 || score > 750) return
      if (count < 0 || cumulativeCount < 0) return

      const rank = records.length > 0
        ? records[records.length - 1].cumulativeCount + 1
        : 1

      records.push({
        province: '河北',
        year,
        category,
        score,
        rank,
        count,
        cumulativeCount,
        _meta: { ...meta },
      })
    }
  })

  return records
}
