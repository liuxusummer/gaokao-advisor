import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseBjSubjects } from '../beijing'
import { parsePdf } from '../../shared/pdf'

// 真实数据：北京教育考试院 bjeea.cn
// 选科要求以单一 PDF 文件发布，包含所有高校的选科要求
const BJ_SUBJECTS_URLS: Record<number, { pageUrl: string; pdfUrl: string }> = {
  2024: {
    pageUrl: 'https://www.bjeea.cn/html/gkgz/tzgg/2021/1231/80578.html',
    pdfUrl: 'https://www.bjeea.cn/uploads/soft/220112/120-2201121F019.pdf',
  },
}

export const beijingSubjectScraper: SubjectScraper = {
  province: '北京',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = BJ_SUBJECTS_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.pdfUrl, {
        cacheKey: `bj_subjects_${year}.pdf`,
        forceRefresh: options?.force,
        timeout: 60000,
      })

      const text = await parsePdf(result.buffer)
      const parsed = parseBjSubjects(text, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.pdfUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `北京选科要求 ${year}`,
      })
    }

    return { records, failed }
  },
}
