import * as xlsx from 'xlsx'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析湖南投档线 Excel（院校专业组级，3+1+2，本科批）。
 *
 * 真实数据格式（来自 hneeb.cn）：
 * Row 0: 标题行
 * Row 1: 说明文字
 * Row 2: 表头 ["批次","计划类别","科类","院校代号","院校名称","专业组编号","专业组名称","投档线",...]
 * Row 3+: 数据行
 *
 * 科类列区分物理类/历史类: "普通类(首选历史)" / "普通类(首选物理)"
 * 物理类和历史类在同一个 Excel 中。
 */
export function parseHnToudang(
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

  // 找到表头行（包含"院校代号"和"投档线"）
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row.some((cell) => String(cell).includes('院校代号')) && row.some((cell) => String(cell).includes('投档线'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return records

  const headers = rows[headerRowIndex].map((h) => String(h).trim())
  const colMap = {
    category: headers.findIndex((h) => h.includes('科类')),
    collegeId: headers.findIndex((h) => h.includes('院校代号')),
    collegeName: headers.findIndex((h) => h.includes('院校名称')),
    majorGroup: headers.findIndex((h) => h.includes('专业组编号')),
    majorGroupName: headers.findIndex((h) => h.includes('专业组名称')),
    minScore: headers.findIndex((h) => h.includes('投档线')),
  }

  if (colMap.collegeId < 0 || colMap.minScore < 0) return records

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const categoryRaw = String(row[colMap.category] ?? '').trim()
    const collegeId = String(row[colMap.collegeId] ?? '').trim()
    const collegeName = String(row[colMap.collegeName] ?? '').trim()
    const majorGroup = String(row[colMap.majorGroup] ?? '').trim()
    const majorGroupName = String(row[colMap.majorGroupName] ?? '').trim()
    const minScore = Number(row[colMap.minScore])

    if (!collegeName || !minScore || isNaN(minScore)) continue

    // 从"普通类(首选历史)"/"普通类(首选物理)"提取科类
    let category: '物理类' | '历史类'
    if (categoryRaw.includes('历史')) {
      category = '历史类'
    } else if (categoryRaw.includes('物理')) {
      category = '物理类'
    } else {
      continue
    }

    records.push({
      collegeId,
      collegeName,
      year,
      majorName: majorGroupName || collegeName,
      majorGroup: majorGroup || undefined,
      majorGroupName: majorGroupName || undefined,
      province: '湖南',
      category,
      batch: '本科批',
      minScore,
      minRank: 0,
      _meta: { ...meta },
    })
  }

  return records
}
