import * as xlsx from 'xlsx'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析山东投档线 Excel（专业+院校级，3+3 综合科类，本科批）。
 *
 * 真实数据格式（来自 sdzk.cn）：
 * Row 0: 标题行 "山东省2024年普通类常规批第1次志愿投档情况表"
 * Row 1: 表头 ["专业代号及名称", "院校代号及名称", "投档计划数", "最低位次"]
 * Row 2+: 数据行
 *
 * 院校代号及名称格式: "A001北京大学" (院校代号+院校名称)
 * 专业代号及名称格式: "17文科试验班类(文科基础类专业)" (专业代号+专业名称)
 *
 * 注意：山东数据只有最低位次，没有投档分。minScore 从一分一段表反查。
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

  // 找到表头行（包含"专业代号"或"院校代号"）
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row.some((cell) => String(cell).includes('专业代号') || String(cell).includes('院校代号'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return records

  const headers = rows[headerRowIndex].map((h) => String(h).trim())
  const colMap = {
    majorName: headers.findIndex((h) => h.includes('专业代号')),
    collegeName: headers.findIndex((h) => h.includes('院校代号')),
    planCount: headers.findIndex((h) => h.includes('投档计划数') || h.includes('计划数')),
    minRank: headers.findIndex((h) => h.includes('最低位次') || h.includes('位次')),
  }

  if (colMap.majorName < 0 || colMap.collegeName < 0) return records

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const majorRaw = String(row[colMap.majorName] ?? '').trim()
    const collegeRaw = String(row[colMap.collegeName] ?? '').trim()
    if (!majorRaw || !collegeRaw) continue

    // 从"17文科试验班类"中提取专业代码和专业名称
    const majorMatch = majorRaw.match(/^(\d+)(.*)$/)
    const majorCode = majorMatch ? majorMatch[1] : ''
    const majorName = majorMatch ? majorMatch[2].trim() : majorRaw

    // 从"A001北京大学"中提取院校代码和院校名称
    const collegeMatch = collegeRaw.match(/^([A-Z]\d+)(.*)$/)
    const collegeId = collegeMatch ? collegeMatch[1] : ''
    const collegeName = collegeMatch ? collegeMatch[2].trim() : collegeRaw

    const minRank = colMap.minRank >= 0 ? Number(row[colMap.minRank]) : 0
    const planCount = colMap.planCount >= 0 ? Number(row[colMap.planCount]) : undefined

    if (!collegeName || !minRank || isNaN(minRank)) continue

    records.push({
      collegeId,
      collegeName,
      year,
      majorName: majorName || collegeName,
      majorCode: majorCode || undefined,
      province: '山东',
      category: '综合',
      batch: '普通类常规批第1次',
      minScore: 0, // 山东数据只有位次，分数需从一分一段表反查
      minRank,
      planCount: planCount || undefined,
      _meta: { ...meta },
    })
  }

  return records
}
