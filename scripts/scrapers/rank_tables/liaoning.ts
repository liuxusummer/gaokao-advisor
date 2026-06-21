import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

/**
 * 解析辽宁省一分一段表 HTML（cheerio 解析 table）。
 *
 * HTML 结构：标准 <table> 表格，每行包含 分数 / 人数 / 累计人数 三列。
 * 跳过表头行（含 '分数'/'人数'/'累计' 字样）。
 * 辽宁为 3+1+2 模式，科类由参数传入（物理类/历史类）。
 */
export function parseLnTable(
  html: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): RankTableRecord[] {
  const $ = cheerio.load(html)
  const records: RankTableRecord[] = []

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get()
    if (cells.length < 3) return

    // 跳过表头行
    if (cells.some((c) => c.includes('分数') || c.includes('人数') || c.includes('累计'))) return

    const score = Number(cells[0])
    const count = Number(cells[1])
    const cumulativeCount = Number(cells[2])

    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) return
    if (score < 0 || score > 750) return
    if (count < 0 || cumulativeCount < 0) return

    // rank = 上一分数的累计人数 + 1（即该分数段的最高位次）
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
      _meta: {
        source: 'gaokao',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false,
      },
    })
  })

  return records
}
