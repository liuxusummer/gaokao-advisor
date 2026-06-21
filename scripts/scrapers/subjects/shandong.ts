import * as cheerio from 'cheerio'
import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

export function parseSdSubjects(
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
    if (cells.length < 4) return
    if (cells[0].includes('专业代码') || cells[0].includes('专业名称')) return

    const majorName = cells[1] || cells[0]
    const subjectText = cells.find((c) => c.includes('选考') || c.includes('科目')) || ''
    if (!majorName) return
    if (!subjectText) return

    const { type, subjects } = parseRequirement(subjectText)

    records.push({
      collegeId,
      collegeName,
      province: '山东',
      year: 2024,
      level: '本科',
      majorName,
      subjectRequirement: subjectText,
      requirementType: type,
      requiredSubjects: subjects,
      _meta: { ...meta },
    })
  })

  return records
}
