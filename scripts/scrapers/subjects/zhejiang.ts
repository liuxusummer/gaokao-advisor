import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'
import type { SubjectRequirementRecord } from '../types'

/**
 * 解析浙江省选科要求 HTML 页面。
 *
 * HTML 结构：
 *   <table>
 *     <tr><th>层次</th><th>专业(类)名称</th><th>选考科目要求</th><th>类中所含专业</th></tr>
 *     <tr><td>本科</td><td>数学类</td><td>物理,化学(...)</td><td>数学与应用数学、信息与计算科学</td></tr>
 *   </table>
 */
export function parseZjSubjects(
  html: string,
  collegeId: string,
  collegeName: string,
  sourceUrl: string
): SubjectRequirementRecord[] {
  if (!html) return []

  const $ = cheerio.load(html)
  const records: SubjectRequirementRecord[] = []

  $('table tbody tr').each((_, el) => {
    const $row = $(el)
    const cells = $row.find('td')
    if (cells.length < 3) return

    const level = $(cells[0]).text().trim()
    const majorName = $(cells[1]).text().trim()
    const subjectReqText = $(cells[2]).text().trim()
    const subMajorsText = cells.length >= 4 ? $(cells[3]).text().trim() : ''

    if (!majorName || !subjectReqText) return

    const parsed = parseRequirement(subjectReqText)
    const subMajors = subMajorsText
      ? subMajorsText.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
      : undefined

    records.push({
      collegeId,
      collegeName,
      province: '浙江',
      year: 2024,
      level,
      majorName,
      subjectRequirement: subjectReqText,
      requirementType: parsed.type,
      requiredSubjects: parsed.subjects,
      subMajors: subMajors && subMajors.length > 0 ? subMajors : undefined,
      _meta: {
        source: 'zjzs',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: true,
      },
    })
  })

  return records
}
