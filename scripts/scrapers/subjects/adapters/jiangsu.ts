import * as xlsx from 'xlsx'
import path from 'node:path'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, CollegeRecord, FailedRecord } from '../../types'
import { loadColleges } from '../../shared/colleges_loader'
import { parseJsSubjects } from '../jiangsu'
import { JS_SUBJECTS_XLSX_URL, JS_SUBJECTS_PAGE_URL, OUTPUT_DIR } from '../../config'

export const jiangsuSubjectScraper: SubjectScraper = {
  province: '江苏',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    try {
      const result = await client.fetchBinary(JS_SUBJECTS_XLSX_URL, {
        cacheKey: 'js_subjects_2024.xlsx',
        forceRefresh: options?.force,
      })

      const workbook = xlsx.read(result.buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

      const parsed = parseJsSubjects(rows, JS_SUBJECTS_PAGE_URL).filter(
        (r) => r.collegeName !== '院校名称' && r.collegeId !== '院校代码'
      )

      // 匹配 colleges.json
      const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
      const collegesMap = loadColleges(collegesPath)
      const collegesByName = new Map<string, CollegeRecord>()
      for (const c of collegesMap.values()) {
        collegesByName.set(c.name, c)
      }

      for (const record of parsed) {
        const college = collegesByName.get(record.collegeName)
        if (college) {
          record.collegeId = college.id
          record._meta.verified = true
        }
      }

      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: JS_SUBJECTS_XLSX_URL,
        error: (error as Error).message,
        retryCount: 3,
        context: `江苏选科要求`,
      })
    }

    return { records, failed }
  },
}
