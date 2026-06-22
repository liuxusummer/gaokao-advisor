import * as xlsx from 'xlsx'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析河北投档线 Excel（专业级，3+1+2 双科类，本科批）。
 *
 * 真实数据格式（来自 hebeea.edu.cn）：
 * 表头: 院校代号 | 院校名称 | 专业代号 | 专业名称 | 投档最低分 | 语数成绩 | 语数最高成绩 |
 *       外语成绩 | 首选科目成绩 | 再选科目最高成绩 | 再选科目次高成绩 | 志愿号 | 备注
 *
 * 院校名称示例: "安徽财经大学(蚌埠市)[公办]"
 * 河北采用"专业+院校"模式，每条记录对应一个专业。
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

  // 动态表头检测：扫描前 10 行查找含 '院校代号'/'院校名称' 的行
  // 注意：河北 Excel 表头含换行符（如 "院校\r\n代号"），需规范化后匹配
  const normalize = (s: string) => s.replace(/[\r\n\s]/g, '')
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row.some((cell) => normalize(String(cell)).includes('院校代号')) && row.some((cell) => normalize(String(cell)).includes('投档最低分'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return records

  const headers = rows[headerRowIndex].map((h) => normalize(String(h)))
  const colMap = {
    collegeId: headers.findIndex((h) => h.includes('院校代号')),
    collegeName: headers.findIndex((h) => h.includes('院校名称')),
    majorCode: headers.findIndex((h) => h.includes('专业代号')),
    majorName: headers.findIndex((h) => h.includes('专业名称')),
    minScore: headers.findIndex((h) => h.includes('投档最低分') || h.includes('最低分')),
  }

  if (colMap.collegeName < 0 || colMap.minScore < 0) return records

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const collegeName = String(row[colMap.collegeName] ?? '').trim()
    if (!collegeName || collegeName === '院校名称') continue

    const minScore = Number(row[colMap.minScore])
    if (!minScore || isNaN(minScore)) continue

    const majorName = String(row[colMap.majorName] ?? '').trim()

    records.push({
      collegeId: colMap.collegeId >= 0 ? String(row[colMap.collegeId] ?? '').trim() : '',
      collegeName,
      year,
      majorName,
      majorCode: colMap.majorCode >= 0 ? String(row[colMap.majorCode] ?? '').trim() : undefined,
      province: '河北',
      category,
      batch: '本科批',
      minScore,
      minRank: 0,
      _meta: { ...meta },
    })
  }

  return records
}
