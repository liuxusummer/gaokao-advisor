import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

/**
 * 解析山东省选科要求 PDF 文本。
 *
 * PDF 格式（每页有页眉、表头、页脚）：
 *   院校代码 | 院校名称 | 专业代码 | 专业（类） | 选考科目要求 | 院校所在省份
 *
 * 字段用 \t 分隔。专业名称可能跨多行。
 * 新记录以 5 位数字（院校代码）开头。
 */
export function parseSdSubjects(
  pdfText: string,
  sourceUrl: string,
  level: '本科' | '专科' = '本科'
): SubjectRequirementRecord[] {
  const records: SubjectRequirementRecord[] = []
  const meta: SubjectMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  const lines = pdfText.split('\n')

  // 状态：累积当前记录的所有行
  let currentLines: string[] = []

  const flushRecord = () => {
    if (currentLines.length === 0) return

    // 把所有行用空格连接，然后按 \t 分割
    const combined = currentLines.join(' ')
    const parts = combined.split('\t').map((s) => s.trim()).filter((s) => s.length > 0)

    // 一条完整记录应该有 5-6 个字段：
    // 院校代码 | 院校名称 | 专业代码 | 专业（类） | 选考科目要求 | 院校所在省份
    // 注意：当专业名称跨多行时，专业代码和专业名称可能合并为一个字段（5 个字段）
    if (parts.length < 5) {
      currentLines = []
      return
    }

    let collegeId: string
    let collegeName: string
    let majorName: string
    let subjectText: string

    if (parts.length >= 6) {
      // 标准 6 字段格式
      collegeId = parts[0]
      collegeName = parts[1]
      subjectText = parts[parts.length - 2]
      majorName = parts.slice(3, parts.length - 2).join(' ')
    } else {
      // 5 字段格式：专业代码和专业名称合并了
      // parts[2] 格式如 "0015 文科试验班类（...）"
      collegeId = parts[0]
      collegeName = parts[1]
      subjectText = parts[parts.length - 2]
      // 从 parts[2] 中分割出专业代码和专业名称
      const majorPart = parts[2]
      const majorMatch = majorPart.match(/^(\d{4,6})\s+(.+)$/)
      if (majorMatch) {
        majorName = majorMatch[2]
      } else {
        majorName = majorPart
      }
      // 如果还有更多字段（专业名称被分割），追加到 majorName
      if (parts.length > 5) {
        majorName = [majorName, ...parts.slice(3, parts.length - 2)].join(' ')
      }
    }

    // 验证院校代码是 5 位数字
    if (!/^\d{5}$/.test(collegeId)) {
      currentLines = []
      return
    }

    // 验证选考科目要求
    if (!subjectText || (!subjectText.includes('科目') && !subjectText.includes('选考'))) {
      currentLines = []
      return
    }

    const { type, subjects } = parseRequirement(subjectText)

    records.push({
      collegeId,
      collegeName,
      province: '山东',
      year: 2024,
      level,
      majorName,
      subjectRequirement: subjectText,
      requirementType: type,
      requiredSubjects: subjects,
      _meta: { ...meta },
    })

    currentLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // 跳过空行
    if (!trimmed) continue

    // 跳过页眉
    if (trimmed.startsWith('2024通用版') || trimmed.startsWith('（适用于')) continue

    // 跳过表头
    if (trimmed.startsWith('院校') || trimmed.startsWith('代码') || trimmed.startsWith('在省份')) continue

    // 跳过页脚
    if (trimmed.startsWith('-- ')) continue

    // 检查是否是新记录的开始（5 位数字开头）
    if (/^\d{5}\s/.test(trimmed) || /^\d{5}\t/.test(trimmed)) {
      // flush 前一条记录
      flushRecord()
      currentLines = [trimmed]
    } else {
      // 续行
      if (currentLines.length > 0) {
        currentLines.push(trimmed)
      }
    }
  }

  // flush 最后一条记录
  flushRecord()

  return records
}
