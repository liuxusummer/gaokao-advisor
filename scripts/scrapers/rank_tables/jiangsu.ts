import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

export function parseJsTable(
  html: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): RankTableRecord[] {
  const $ = cheerio.load(html)
  const records: RankTableRecord[] = []

  // 根据科类选择对应的表格
  const tableId = category === '物理类' ? '#physics' : '#history'
  const tableSelector = `${tableId}.rank-table tbody tr`

  $(tableSelector).each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return

    const score = parseInt($(cells[0]).text().trim(), 10)
    const count = parseInt($(cells[1]).text().trim(), 10)
    const cumulativeCount = parseInt($(cells[2]).text().trim(), 10)

    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) return

    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '江苏',
      year,
      category,
      score,
      rank,
      count,
      cumulativeCount,
      _meta: {
        source: 'jseea',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: true,
      },
    })
  })

  return records
}
