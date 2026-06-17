import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

export function parseZjTable(
  html: string,
  year: number,
  sourceUrl: string
): RankTableRecord[] {
  const $ = cheerio.load(html)
  const records: RankTableRecord[] = []

  $('.rank-table tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return

    const score = parseInt($(cells[0]).text().trim(), 10)
    const count = parseInt($(cells[1]).text().trim(), 10)
    const cumulativeCount = parseInt($(cells[2]).text().trim(), 10)

    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) return

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
  })

  return records
}
