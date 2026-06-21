import path from 'node:path'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, CollegeRecord, FailedRecord } from '../../types'
import { loadColleges } from '../../shared/colleges_loader'
import { parseZjSubjects } from '../zhejiang'
import { GAOKAO_QPS, ZJ_SUBJECTS_URL_TEMPLATE, OUTPUT_DIR } from '../../config'

export const zhejiangSubjectScraper: SubjectScraper = {
  province: '浙江',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
    const collegesMap = loadColleges(collegesPath)
    const colleges: CollegeRecord[] = Array.from(collegesMap.values())

    const requestInterval = 1000 / GAOKAO_QPS

    for (let i = 0; i < colleges.length; i++) {
      const college = colleges[i]
      const guobiaoCode = college.moeCode.slice(-5)
      const url = ZJ_SUBJECTS_URL_TEMPLATE.replace('{guobiaoCode}', guobiaoCode)

      try {
        const result = await client.fetch(url, {
          cacheKey: `zj_${guobiaoCode}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseZjSubjects(result.html, college.id, college.name, url)
        records.push(...parsed)

        if (!result.fromCache) {
          await new Promise((resolve) => setTimeout(resolve, requestInterval))
        }
      } catch (error) {
        failed.push({
          url,
          error: (error as Error).message,
          retryCount: 0,
          context: `浙江 ${college.name}`,
        })
      }
    }

    return { records, failed }
  },
}
