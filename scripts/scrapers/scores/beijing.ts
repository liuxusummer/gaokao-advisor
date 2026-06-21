import * as cheerio from 'cheerio'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析北京投档线 HTML（院校专业组级，3+3 综合科类，本科批）。
 *
 * 北京采用"院校专业组"模式，每条记录对应一个院校专业组，
 * 包含专业组代号与专业组名称字段（无具体专业级信息）。
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
    majorGroup: headers.findIndex(
      (h) =>
        h.includes('专业组代号') ||
        h.includes('专业组代码') ||
        h.includes('院校专业组代号') ||
        h.includes('院校专业组代码') ||
        h.includes('专业组')
    ),
    majorGroupName: headers.findIndex(
      (h) => h.includes('专业组名称') || h.includes('院校专业组名称')
    ),
    planCount: headers.findIndex((h) => h.includes('计划数')),
    minScore: headers.findIndex((h) => h.includes('投档分') || h.includes('投档最低分') || h.includes('最低分')),
    minRank: headers.findIndex((h) => h.includes('位次') || h.includes('投档最低位次')),
  }

  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i]
    const collegeName = String(row[colMap.collegeName] ?? '').trim()
    if (!collegeName || collegeName === '院校名称') continue

    const minScore = Number(row[colMap.minScore])
    if (!minScore || isNaN(minScore)) continue

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
      majorName: majorGroupName ?? collegeName, // 院校专业组级无专业名，用专业组名填充
      majorGroup,
      majorGroupName,
      province: '北京',
      category: '综合',
      batch: '本科批',
      minScore,
      minRank: Number(row[colMap.minRank]) || 0,
      planCount: colMap.planCount >= 0 ? Number(row[colMap.planCount]) || undefined : undefined,
      _meta: { ...meta },
    })
  }

  return records
}
