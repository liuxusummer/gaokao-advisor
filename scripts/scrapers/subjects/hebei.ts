import * as xlsx from 'xlsx'
import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

/**
 * 解析河北省选科要求 Excel。
 *
 * Excel 格式：
 *   Row 0: 标题 "2024年拟在河北招生的普通高校招生专业选考科目要求"
 *   Row 1: 表头 院校代码 | 院校名称 | 专业代码 | 专业名称 | 包含专业 | 招考方向 | 层次 | 选考科目要求
 *   Row 2+: 数据行
 */
export function parseHbSubjects(
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

  // 找到表头行
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

    const collegeId = String(row[0] || '').trim()
    const collegeName = String(row[1] || '').trim()
    const majorCode = String(row[2] || '').trim()
    const majorName = String(row[3] || '').trim()
    const level = String(row[6] || '').trim() || '本科'
    const subjectText = String(row[7] || '').trim()

    if (!collegeId || !collegeName || !subjectText) continue
    if (collegeId === '院校代码') continue

    const { type, subjects } = parseRequirement(subjectText)

    records.push({
      collegeId,
      collegeName,
      province: '河北',
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
