import * as xlsx from 'xlsx'
import type { RankTableRecord, RankTableRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

export function parseSdTable(
  buffer: Buffer,
  year: number,
  sourceUrl: string
): RankTableRecord[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const records: RankTableRecord[] = []
  const meta: RankTableRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some((cell) => String(cell).includes('分数') || String(cell).includes('分值'))) {
      headerRowIndex = i
      break
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    const score = Number(row[0])
    const count = Number(row[1])
    const cumulativeCount = Number(row[2])

    if (!score || isNaN(score)) continue
    if (score < 0 || score > 750) continue
    if (count < 0 || cumulativeCount < 0) continue

    // rank = 上一分数的累计人数 + 1（即该分数段的最高位次）
    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '山东',
      year,
      category: '综合',
      score,
      rank,
      count: count || 0,
      cumulativeCount: cumulativeCount || 0,
      _meta: { ...meta },
    })
  }

  return records
}
