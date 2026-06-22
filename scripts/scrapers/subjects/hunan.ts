import * as xlsx from 'xlsx'
import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

/**
 * 解析湖南省选科要求 Excel。
 *
 * Excel 格式：
 *   Row 0: [null, 标题]
 *   Row 1: 表头 ZKNF | 院校代码 | 院校名称 | ZSZYDM | 招生专业（类） | BHZY | 包含招生专业名称 | 招考方向 | CCDM | 招生层次 | SYSSDM | SYSSMC | XKZYBB | 招生专业科目要求 | KSKMSM
 *   Row 2+: 数据行
 */
export function parseHnSubjects(
  buffer: Buffer,
  sourceUrl: string
): SubjectRequirementRecord[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const records: SubjectRequirementRecord[] = []
  const meta: SubjectMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  const normalize = (s: string) => s.replace(/[\r\n\s]/g, '')
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some((cell) => normalize(String(cell)).includes('院校代码'))) {
      headerRowIndex = i
      break
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const collegeId = String(row[1] || '').trim()
    const collegeName = String(row[2] || '').trim()
    const majorCode = String(row[3] || '').trim()
    const majorName = String(row[4] || '').trim()
    const level = String(row[9] || '').trim() || '本科'
    const subjectText = String(row[13] || '').trim()

    if (!collegeId || !collegeName || !subjectText) continue
    if (collegeId === '院校代码') continue

    const { type, subjects } = parseRequirement(subjectText)

    records.push({
      collegeId,
      collegeName,
      province: '湖南',
      year: 2024,
      level,
      majorName,
      subjectRequirement: subjectText,
      requirementType: type,
      requiredSubjects: subjects,
      majorGroup: majorCode || undefined,
      _meta: { ...meta },
    })
  }

  return records
}
