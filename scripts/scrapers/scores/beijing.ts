import * as cheerio from 'cheerio'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析北京投档线 HTML（院校专业组级，3+3 综合科类，本科批）。
 *
 * 真实数据格式（来自 bjeea.cn）：
 * | 序号 | 院校代码 | 院校名称 | 专业组代码 | 选考要求 | 总分 | 语文 | 数学 | 外语 | 三科选考 | 其他要求 |
 *
 * 北京采用"院校专业组"模式，每条记录对应一个院校专业组。
 * 北京为 3+3 模式，仅有综合科类，故 category 硬编码为 '综合'。
 */
export function parseBjToudang(
  html: string,
  year: number,
  sourceUrl: string
): ScoreRecord[] {
  const $ = cheerio.load(html)
  const records: ScoreRecord[] = []
  const meta: ScoreRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  const allRows: string[][] = []
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td,th').map((_, cell) => $(cell).text().trim()).get()
    allRows.push(cells)
  })

  // 找到表头行（包含"序号"和"总分"或"院校"）
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(allRows.length, 15); i++) {
    const row = allRows[i]
    const rowText = row.join(' ')
    if (rowText.includes('序号') && (rowText.includes('总分') || rowText.includes('院校'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return records

  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i]
    if (row.length < 6) continue

    // 跳过非数据行（序号不是数字）
    const seq = Number(row[0])
    if (isNaN(seq) || seq < 1) continue

    // 按固定列位置提取（北京格式标准化）
    const collegeCode = String(row[1] ?? '').trim()
    const collegeName = String(row[2] ?? '').trim()
    const majorGroup = String(row[3] ?? '').trim()
    const subjectReq = String(row[4] ?? '').trim()
    const minScore = Number(row[5])

    if (!collegeName || !minScore || isNaN(minScore)) continue

    records.push({
      collegeId: collegeCode,
      collegeName,
      year,
      majorName: subjectReq || collegeName,
      majorGroup: majorGroup || undefined,
      majorGroupName: subjectReq || undefined,
      province: '北京',
      category: '综合',
      batch: '本科批',
      minScore,
      minRank: 0,
      _meta: { ...meta },
    })
  }

  return records
}
