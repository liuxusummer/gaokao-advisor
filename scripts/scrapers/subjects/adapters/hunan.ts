import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseHnSubjects } from '../hunan'

// 真实数据：湖南省教育厅 hnedu.cn
// 选科要求以 Excel 文件发布（本科 + 专科两个文件）
const HN_SUBJECTS_URLS: Record<
  number,
  { pageUrl: string; bachelorUrl: string; vocationalUrl?: string }
> = {
  2024: {
    pageUrl: 'https://www.hneeb.cn/hnxxg/1/37/content_2845.html',
    bachelorUrl: 'http://govnew.hnedu.cn:8090/zcms/contentcore/resource/download?ID=101131',
    vocationalUrl: 'http://govnew.hnedu.cn:8090/zcms/contentcore/resource/download?ID=101132',
  },
}

export const hunanSubjectScraper: SubjectScraper = {
  province: '湖南',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HN_SUBJECTS_URLS[year]
    if (!urlConfig) return { records, failed }

    // 本科
    try {
      const result = await client.fetchBinary(urlConfig.bachelorUrl, {
        cacheKey: `hn_subjects_${year}_bk.xlsx`,
        forceRefresh: options?.force,
        timeout: 60000,
      })
      const parsed = parseHnSubjects(result.buffer, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.bachelorUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `湖南选科要求 ${year} 本科`,
      })
    }

    // 专科
    if (urlConfig.vocationalUrl) {
      try {
        const result = await client.fetchBinary(urlConfig.vocationalUrl, {
          cacheKey: `hn_subjects_${year}_zk.xlsx`,
          forceRefresh: options?.force,
          timeout: 60000,
        })
        const parsed = parseHnSubjects(result.buffer, urlConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: urlConfig.vocationalUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `湖南选科要求 ${year} 专科`,
        })
      }
    }

    return { records, failed }
  },
}
