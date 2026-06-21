import * as xlsx from 'xlsx'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析河北投档线 Excel（专业级，3+1+2 双科类，本科批）。
 *
 * 河北采用"专业+院校"模式，每条记录对应一个专业，
 * 同时包含专业组代号与专业组名称字段。
 */
export function parseHbToudang(
  buffer: Buffer,
  year: number,
  category: '物理类' | '历史类',
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

  // 动态表头检测：扫描前 10 行查找含 '院校代码'/'院校名称' 的行
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
    majorGroup: headers.findIndex((h) => h.includes('专业组代号') || h.includes('专业组代码')),
    majorGroupName: headers.findIndex((h) => h.includes('专业组名称')),
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

    const majorName = String(row[colMap.majorName] ?? '').trim()
    const majorGroup = colMap.majorGroup >= 0
      ? String(row[colMap.majorGroup] ?? '').trim() || undefined
      : undefined
    const majorGroupName = colMap.majorGroupName >= 0
      ? String(row[colMap.majorGroupName] ?? '').trim() || undefined
      : undefined

    records.push({
      collegeId: '',
      collegeName,
      year,
      majorName,
      majorCode: colMap.majorCode >= 0 ? String(row[colMap.majorCode] ?? '').trim() : undefined,
      majorGroup,
      majorGroupName,
      province: '河北',
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
