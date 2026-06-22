import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

/**
 * 解析上海市选科要求 PDF 文本。
 *
 * PDF 文本格式（tab 分隔，但列数不固定）：
 *   省份\t院校名称\t专业（类）名称\t[包含专业]\t[招生方向]\t科目要求
 *
 * 列数可能为 4-6 列（中间列可为空），部分记录跨多行。
 * 科目要求简写：不限/物/化/生/政/史/地/物和化/物或化 等
 */
export function parseShSubjects(
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

  const normalizeSubject = (s: string): string => {
    const trimmed = s.trim()
    if (trimmed === '不限' || trimmed === '') return '不提科目要求'
    if (trimmed === '物和化') return '物理,化学(2门科目考生均须选考方可报考)'
    if (trimmed === '物或化') return '物理,化学(2门科目考生选考其中1门即可报考)'
    if (trimmed === '物或化或生') return '物理,化学,生物(3门科目考生选考其中1门即可报考)'
    if (trimmed === '物和化和生') return '物理,化学,生物(3门科目考生均须选考方可报考)'
    if (trimmed === '史和政') return '历史,政治(2门科目考生均须选考方可报考)'
    if (trimmed === '史或政') return '历史,政治(2门科目考生选考其中1门即可报考)'
    if (trimmed === '物和化或生') return '物理,化学,生物(3门科目考生选考其中1门即可报考)'
    const singleSubjectMap: Record<string, string> = {
      '物': '物理', '化': '化学', '生': '生物',
      '政': '政治', '史': '历史', '地': '地理',
    }
    if (singleSubjectMap[trimmed]) {
      return `${singleSubjectMap[trimmed]}(1门科目考生必须选考方可报考)`
    }
    return trimmed
  }

  const isSubjectRequirement = (s: string): boolean => {
    const trimmed = s.trim()
    if (!trimmed) return false
    return /^[物化生政史地和不或限]+$/.test(trimmed)
  }

  const provinceNames = ['上海', '北京', '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃',
    '青海', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '广西',
    '重庆', '西藏', '宁夏', '新疆', '香港', '澳门', '台湾']

  const isProvinceName = (s: string): boolean => {
    return provinceNames.some(p => s.trim().startsWith(p))
  }

  const lines = text.split(/\r?\n/)

  let currentCollegeName = ''
  let currentMajorName = ''
  let currentSubjectText = ''
  let pendingIncludedMajors = '' // 跨行的包含专业文本

  const flushRecord = () => {
    if (currentCollegeName && currentMajorName && currentSubjectText) {
      const normalizedSubject = normalizeSubject(currentSubjectText)
      const { type, subjects } = parseRequirement(normalizedSubject)

      records.push({
        collegeId: '',
        collegeName: currentCollegeName,
        province: '上海',
        year: 2024,
        level: '本科',
        majorName: currentMajorName + pendingIncludedMajors,
        subjectRequirement: normalizedSubject,
        requirementType: type,
        requiredSubjects: subjects,
        _meta: { ...meta },
      })
    }
    currentMajorName = ''
    currentSubjectText = ''
    pendingIncludedMajors = ''
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) continue
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(trimmed)) continue
    if (/^\d+\s+of\s+\d+$/i.test(trimmed)) continue
    if (trimmed.includes('页，共')) continue
    if (trimmed.includes('2024年普通高校本科专业选考科目要求')) continue
    if (trimmed.startsWith('省份\t')) continue

    const parts = line.split('\t').map((p) => p.trim()).filter((p) => p !== '')

    // 检查是否是新记录的开始（以省份名开头，至少有省份+院校+专业）
    if (parts.length >= 3 && isProvinceName(parts[0])) {
      // 先 flush 上一条记录
      flushRecord()

      currentCollegeName = parts[1]
      currentMajorName = parts[2]

      // 从最后一个 part 开始检查是否是科目要求
      const lastPart = parts[parts.length - 1]
      if (parts.length >= 4 && isSubjectRequirement(lastPart)) {
        // 最后一个字段是科目要求
        currentSubjectText = lastPart
      } else {
        // 科目要求在续行中
        currentSubjectText = ''
        pendingIncludedMajors = parts.slice(3).join('')
      }
      continue
    }

    // 续行处理
    if (currentMajorName && !currentSubjectText) {
      // 还在寻找科目要求
      if (parts.length === 1) {
        if (isSubjectRequirement(parts[0])) {
          currentSubjectText = parts[0]
        } else {
          pendingIncludedMajors += parts[0]
        }
      } else if (parts.length >= 2) {
        // 检查最后一个 part 是否是科目要求
        const lastPart = parts[parts.length - 1]
        if (isSubjectRequirement(lastPart)) {
          currentSubjectText = lastPart
        } else {
          pendingIncludedMajors += parts.join('')
        }
      }
    }
  }

  // flush 最后一条记录
  flushRecord()

  return records
}
