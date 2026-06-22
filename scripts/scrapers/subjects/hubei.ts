import * as xlsx from 'xlsx'
import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

/**
 * 解析湖北省选科要求 Excel。
 *
 * Excel 格式（本科 sheet）：
 *   Row 0: 标题
 *   Row 1: 表头 院校名称 | 招生专业(类) | 包含专业 | 招考方向 | 考试科目要求
 *   Row 2+: 数据行
 *
 * 注意：湖北 Excel 无院校代码列，仅有院校名称。
 * 工作簿包含两个 sheet：本科、专科
 */
export function parseHubSubjects(
  buffer: Buffer,
  sourceUrl: string
): SubjectRequirementRecord[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const records: SubjectRequirementRecord[] = []
  const meta: SubjectMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    const level = sheetName.includes('本科') ? '本科' : sheetName.includes('专科') ? '专科' : '本科'

    const normalize = (s: string) => s.replace(/[\r\n\s]/g, '')
    let headerRowIndex = -1
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (rows[i].some((cell) => normalize(String(cell)).includes('院校名称'))) {
        headerRowIndex = i
        break
      }
    }

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue

      const collegeName = String(row[0] || '').trim()
      const majorName = String(row[1] || '').trim()
      const subjectText = String(row[4] || '').trim()

      if (!collegeName || !subjectText) continue
      if (collegeName === '院校名称') continue

      const { type, subjects } = parseRequirement(subjectText)

      records.push({
        collegeId: '', // 湖北 Excel 无院校代码
        collegeName,
        province: '湖北',
        year: 2024,
        level,
        majorName,
        subjectRequirement: subjectText,
        requirementType: type,
        requiredSubjects: subjects,
        _meta: { ...meta },
      })
    }
  }

  return records
}
