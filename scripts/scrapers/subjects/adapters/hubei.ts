import path from 'node:path'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, CollegeRecord, FailedRecord } from '../../types'
import { loadColleges } from '../../shared/colleges_loader'
import { parseHubSubjects } from '../hubei'
import { GAOKAO_QPS, OUTPUT_DIR } from '../../config'

const HUB_SUBJECTS_URL_TEMPLATE = 'https://www.hbea.edu.cn/xkqz/{guobiaoCode}.html'

export const hubeiSubjectScraper: SubjectScraper = {
  province: '湖北',

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
      const url = HUB_SUBJECTS_URL_TEMPLATE.replace('{guobiaoCode}', guobiaoCode)

      try {
        const result = await client.fetch(url, {
          cacheKey: `hub_${guobiaoCode}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseHubSubjects(result.html, college.id, college.name, url)
        records.push(...parsed)

        if (!result.fromCache) {
          await new Promise((resolve) => setTimeout(resolve, requestInterval))
        }
      } catch (error) {
        failed.push({
          url,
          error: (error as Error).message,
          retryCount: 0,
          context: `湖北 ${college.name}`,
        })
      }
    }

    return { records, failed }
  },
}
