import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'
import type { SubjectRequirementRecord } from '../types'

/**
 * 解析江苏选科要求 Excel 的二维数组。
 *
 * 预期 7 列：院校代码、院校名称、专业组代码、专业组名称、专业代码、专业名称、选考科目要求
 * 第一行为标题行，跳过。
 */
export function parseJsSubjects(
  rows: string[][],
  sourceUrl: string
): SubjectRequirementRecord[] {
  if (!rows || rows.length === 0) return []

  const records: SubjectRequirementRecord[] = []

  // 跳过标题行（第一行包含"院校名称"）
  const startIndex = rows[0].some(cell => cell.includes('院校名称')) ? 1 : 0

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 7) continue

    const collegeCode = row[0]?.trim() || ''
    const collegeName = row[1]?.trim() || ''
    const majorGroup = row[2]?.trim() || ''
    const majorGroupName = row[3]?.trim() || ''
    const majorCode = row[4]?.trim() || ''
    const majorName = row[5]?.trim() || ''
    const subjectReqText = row[6]?.trim() || ''

    if (!collegeName || !majorName || !subjectReqText) continue

    const parsed = parseRequirement(subjectReqText)

    // collegeId 用院校代码（国标码）构造，后续主流程会匹配 colleges.json
    records.push({
      collegeId: collegeCode,
      collegeName,
      province: '江苏',
      year: 2024,
      level: '本科',
      majorName,
      majorCode: majorCode || undefined,
      subjectRequirement: subjectReqText,
      requirementType: parsed.type,
      requiredSubjects: parsed.subjects,
      majorGroup: majorGroup || undefined,
      majorGroupName: majorGroupName || undefined,
      _meta: {
        source: 'jseea',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false, // 待主流程匹配 colleges.json 后更新
      },
    })
  }

  return records
}
