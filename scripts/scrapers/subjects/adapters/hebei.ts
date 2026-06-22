import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseHbSubjects } from '../hebei'

// 真实数据：河北省教育考试院 hebeea.edu.cn
// 选科要求以单一 Excel 文件发布，包含所有高校的选科要求
const HB_SUBJECTS_URLS: Record<number, { pageUrl: string; xlsxUrl: string }> = {
  2024: {
    pageUrl: 'http://www.hebeea.edu.cn/html/ptgk/tzgg/2022/0121-105905-018.html',
    xlsxUrl: 'https://file.hebeea.edu.cn/files/article/2022/01/20220121105849_631.xlsx',
  },
}

export const hebeiSubjectScraper: SubjectScraper = {
  province: '河北',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HB_SUBJECTS_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.xlsxUrl, {
        cacheKey: `hb_subjects_${year}.xlsx`,
        forceRefresh: options?.force,
      })

      const parsed = parseHbSubjects(result.buffer, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsxUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `河北选科要求 ${year}`,
      })
    }

    return { records, failed }
  },
}
