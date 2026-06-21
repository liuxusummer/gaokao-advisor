import * as xlsx from 'xlsx'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析山东投档线 Excel（专业级，综合科类，普通类常规批第1次）
 */
export function parseSdToudang(
  buffer: Buffer,
  year: number,
  sourceUrl: string
): ScoreRecord[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const records: ScoreRecord[] = []
  const meta: ScoreRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row.some((cell) => String(cell).includes('院校代码') || String(cell).includes('院校名称'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return records

  const headers = rows[headerRowIndex].map((h) => String(h).trim())
  const colMap = {
    collegeName: headers.findIndex((h) => h.includes('院校名称')),
    majorCode: headers.findIndex((h) => h.includes('专业代码')),
    majorName: headers.findIndex((h) => h.includes('专业名称')),
    planCount: headers.findIndex((h) => h.includes('计划数')),
    minScore: headers.findIndex((h) => h.includes('投档最低分') || h.includes('最低分')),
    minRank: headers.findIndex((h) => h.includes('位次') || h.includes('投档最低位次')),
  }

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
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
      province: '山东',
      category: '综合',
      batch: '普通类常规批第1次',
      minScore,
      minRank: Number(row[colMap.minRank]) || 0,
      planCount: colMap.planCount >= 0 ? Number(row[colMap.planCount]) || undefined : undefined,
      _meta: { ...meta },
    })
  }

  return records
}
