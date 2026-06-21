import path from 'node:path'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, CollegeRecord, FailedRecord } from '../../types'
import { loadColleges } from '../../shared/colleges_loader'
import { parseShSubjects } from '../shanghai'
import { GAOKAO_QPS, OUTPUT_DIR } from '../../config'

const SH_SUBJECTS_URL_TEMPLATE = 'https://www.shmeea.edu.cn/xkqz/{guobiaoCode}.html'

export const shanghaiSubjectScraper: SubjectScraper = {
  province: '上海',

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
      const url = SH_SUBJECTS_URL_TEMPLATE.replace('{guobiaoCode}', guobiaoCode)

      try {
        const result = await client.fetch(url, {
          cacheKey: `sh_${guobiaoCode}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseShSubjects(result.html, college.id, college.name, url)
        records.push(...parsed)

        if (!result.fromCache) {
          await new Promise((resolve) => setTimeout(resolve, requestInterval))
        }
      } catch (error) {
        failed.push({
          url,
          error: (error as Error).message,
          retryCount: 0,
          context: `上海 ${college.name}`,
        })
      }
    }

    return { records, failed }
  },
}
