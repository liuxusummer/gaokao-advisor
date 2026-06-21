import * as cheerio from 'cheerio'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析辽宁投档线 HTML（专业级，3+1+2 双科类，本科批）。
 *
 * 辽宁采用"专业+院校"模式，每条记录对应一个专业，
 * 不包含专业组代号与专业组名称字段（与院校专业组模式不同）。
 * 辽宁为 3+1+2 模式，科类由参数传入（物理类/历史类）。
 */
export function parseLnToudang(
  html: string,
  year: number,
  category: '物理类' | '历史类',
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

  // 动态表头检测：扫描前 10 行查找含 '院校代码'/'院校名称' 的行
  let headerRowIndex = -1
  const allRows: string[][] = []
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td,th').map((_, cell) => $(cell).text().trim()).get()
    allRows.push(cells)
  })

  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i]
    if (row.some((cell) => cell.includes('院校代码') || cell.includes('院校名称'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return records

  const headers = allRows[headerRowIndex].map((h) => String(h).trim())
  const colMap = {
    collegeName: headers.findIndex((h) => h.includes('院校名称')),
    majorCode: headers.findIndex((h) => h.includes('专业代码')),
    majorName: headers.findIndex((h) => h.includes('专业名称')),
    planCount: headers.findIndex((h) => h.includes('计划数')),
    minScore: headers.findIndex(
      (h) => h.includes('投档分') || h.includes('投档最低分') || h.includes('最低分')
    ),
    minRank: headers.findIndex((h) => h.includes('位次') || h.includes('投档最低位次')),
  }

  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i]
    const collegeName = String(row[colMap.collegeName] ?? '').trim()
    if (!collegeName || collegeName === '院校名称') continue

    const minScore = Number(row[colMap.minScore])
    if (!minScore || isNaN(minScore)) continue

    records.push({
      collegeId: '',
      collegeName,
      year,
      majorName: String(row[colMap.majorName] ?? '').trim(),
      majorCode: colMap.majorCode >= 0 ? String(row[colMap.majorCode] ?? '').trim() : undefined,
      province: '辽宁',
      category,
      batch: '本科批',
      minScore,
      minRank: Number(row[colMap.minRank]) || 0,
      planCount: colMap.planCount >= 0 ? Number(row[colMap.planCount]) || undefined : undefined,
      _meta: { ...meta },
    })
  }

  return records
}
