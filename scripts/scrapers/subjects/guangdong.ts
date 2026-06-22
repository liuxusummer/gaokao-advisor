import * as cheerio from 'cheerio'
import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

/**
 * 解析广东省选科要求详情页 HTML。
 *
 * HTML 表格格式：
 *   序号 | 层次 | 专业类名称 | 首选科目 | 再选科目要求 | 包含专业 | 备注
 *
 * 首选科目值：物理或历史均可 / 仅物理 / 仅历史
 * 再选科目要求值：不提科目要求 / 化学(1门科目考生必须选考) / 化学,生物(2门科目考生选考其中1门即可报考) 等
 */
export function parseGdSubjects(
  html: string,
  collegeId: string,
  collegeName: string,
  sourceUrl: string
): SubjectRequirementRecord[] {
  const $ = cheerio.load(html)
  const records: SubjectRequirementRecord[] = []
  const meta: SubjectMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get()
    if (cells.length < 5) return

    // 跳过表头
    if (cells[0] === '序号' || cells[0].includes('专业')) return

    const level = cells[1] || '本科'
    const majorName = cells[2] || ''
    const firstChoice = cells[3] || '' // 首选科目
    const secondChoice = cells[4] || '' // 再选科目要求

    if (!majorName) return

    // 合并首选和再选科目要求为标准格式
    let subjectText = secondChoice
    if (firstChoice === '仅物理') {
      if (secondChoice === '不提科目要求') {
        subjectText = '物理(1门科目考生必须选考方可报考)'
      } else {
        subjectText = secondChoice
      }
    } else if (firstChoice === '仅历史') {
      if (secondChoice === '不提科目要求') {
        subjectText = '历史(1门科目考生必须选考方可报考)'
      } else {
        subjectText = secondChoice
      }
    } else if (firstChoice === '物理或历史均可') {
      if (secondChoice === '不提科目要求') {
        subjectText = '不提科目要求'
      } else {
        subjectText = secondChoice
      }
    }

    const { type, subjects } = parseRequirement(subjectText)

    records.push({
      collegeId,
      collegeName,
      province: '广东',
      year: 2024,
      level,
      majorName,
      subjectRequirement: subjectText,
      requirementType: type,
      requiredSubjects: subjects,
      _meta: { ...meta },
    })
  })

  return records
}
