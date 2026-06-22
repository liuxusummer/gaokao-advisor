import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

/**
 * 解析北京市选科要求 PDF 文本。
 *
 * PDF 文本格式：
 *   院校代号 院校名称
 *   {组号}科目要求：
 *   专业代号 专业名称
 *   专业代号 专业名称
 *   {组号}科目要求：
 *   ...
 *
 * 例如：
 *   0111 陆军装甲兵学院
 *   {00}不限选考科目：
 *   01 作战指挥
 *   {01}物理＋化学：
 *   02 机械工程
 *
 * 选考科目组中"+"号表示"均须选考科目"。
 */
export function parseBjSubjects(
  text: string,
  sourceUrl: string
): SubjectRequirementRecord[] {
  const records: SubjectRequirementRecord[] = []
  const meta: SubjectMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  let currentCollegeId = ''
  let currentCollegeName = ''
  let currentSubjectText = ''
  let currentMajorGroup = ''

  const lines = text.split(/\r?\n/)

  // 跳过说明部分，找到第一个院校行
  let startIndex = 0
  for (let i = 0; i < lines.length; i++) {
    // 院校行格式：4位数字 + 空格 + 中文名称
    if (/^\d{4}\s+\S/.test(lines[i].trim())) {
      startIndex = i
      break
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // 跳过页眉、页脚
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue
    if (/^\d+\s+of\s+\d+$/i.test(line)) continue
    if (line.includes('2024 年拟在京招生')) continue
    if (line.includes('北京教育考试院')) continue
    if (/^\d+$/.test(line)) continue // 单独的页码数字

    // 匹配院校行：4位数字 + 空格 + 中文名称
    const collegeMatch = line.match(/^(\d{4})\s+(.+)$/)
    if (collegeMatch && !line.includes('{') && !line.includes('：')) {
      currentCollegeId = collegeMatch[1]
      currentCollegeName = collegeMatch[2].trim()
      currentSubjectText = ''
      currentMajorGroup = ''
      continue
    }

    // 匹配科目要求组：{组号}科目要求：
    const groupMatch = line.match(/^\{(\d+)\}(.+?)：$/)
    if (groupMatch) {
      currentMajorGroup = groupMatch[1]
      currentSubjectText = groupMatch[2].trim()
      continue
    }

    // 匹配专业行：专业代号 + 空格 + 专业名称
    // 格式：01 作战指挥 或 16 管理科学与工程类(含管理科学)
    const majorMatch = line.match(/^(\d{2})\s+(.+)$/)
    if (majorMatch && currentCollegeId && currentSubjectText) {
      const majorCode = majorMatch[1]
      const majorName = majorMatch[2].trim()

      // 将北京 PDF 的 "+" 格式转换为标准格式
      let normalizedSubject = currentSubjectText
      if (normalizedSubject === '不限选考科目') {
        normalizedSubject = '不提科目要求'
      } else if (normalizedSubject.includes('+')) {
        // "物理＋化学" → "物理,化学(2门科目考生均须选考方可报考)"
        const subjects = normalizedSubject
          .replace(/＋/g, '+')
          .split('+')
          .map((s) => s.trim())
          .filter(Boolean)
        normalizedSubject = `${subjects.join(',')}(${subjects.length}门科目考生均须选考方可报考)`
      }

      const { type, subjects } = parseRequirement(normalizedSubject)

      records.push({
        collegeId: currentCollegeId,
        collegeName: currentCollegeName,
        province: '北京',
        year: 2024,
        level: '本科',
        majorName,
        subjectRequirement: normalizedSubject,
        requirementType: type,
        requiredSubjects: subjects,
        majorGroup: currentMajorGroup || undefined,
        _meta: { ...meta },
      })
      continue
    }
  }

  return records
}
