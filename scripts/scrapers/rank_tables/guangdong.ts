import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

/**
 * 解析广东省一分一段表 PDF 文本（分物理类/历史类）。
 *
 * PDF 文本格式（pdf-parse 提取后）：
 *   分数段人数（含本科加分） 累计人数 分数段人数（含专科加分） 累计人数
 *   665（含以上）   20      20      20      20
 *   664     3       23      3       23
 *   ...
 *
 * 也支持简单的 3 列格式：分数 人数 累计人数
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
    if (/分数|人数|累计|score|count|cumulative|附件|文化总分|合成总分|本科|专科/i.test(trimmed)) continue

    // 全角数字转半角
    const normalized = trimmed
      .replace(/[\u3000\uff00-\uffef]/g, (ch) => {
        const code = ch.charCodeAt(0)
        if (code >= 0xff10 && code <= 0xff19) return String.fromCharCode(code - 0xff10 + 0x30)
        if (code === 0x3000) return ' '
        return ch
      })
      .replace(/\s+/g, ' ')
      .trim()

    // 匹配 "665（含以上） 20 20 20 20" 或 "664 3 23 3 23" 格式
    // 也匹配 "665 20 20" 简单 3 列格式
    const scoreMatch = normalized.match(/^(\d+)(?:[（(]含以上[）)])?\s+(.+)/)
    if (!scoreMatch) continue

    const score = parseInt(scoreMatch[1], 10)
    const restNumbers = scoreMatch[2].split(/\s+/).filter((s) => /^\d+$/.test(s))

    if (isNaN(score) || score < 0 || score > 750) continue

    // 取前 2 个数字作为 count 和 cumulativeCount（本科列）
    if (restNumbers.length < 2) continue

    const count = parseInt(restNumbers[0], 10)
    const cumulativeCount = parseInt(restNumbers[1], 10)

    if (isNaN(count) || isNaN(cumulativeCount)) continue
    if (count < 0 || cumulativeCount < 0) continue

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

/**
 * 解析广东省一分一段表 Excel（分物理类/历史类）。
 */
export function parseGdExcel(
  buffer: Buffer,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): RankTableRecord[] {
  // 动态导入 xlsx 避免循环依赖
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const xlsx = require('xlsx')
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const records: RankTableRecord[] = []
  const normalize = (s: string) => s.replace(/[\r\n\s]/g, '')

  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row.some((cell) => normalize(String(cell)).includes('分数'))) {
      headerRowIndex = i
      break
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const score = Number(row[0])
    const count = Number(row[1])
    const cumulativeCount = Number(row[2])

    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) continue
    if (score < 0 || score > 750) continue
    if (count < 0 || cumulativeCount < 0) continue

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
