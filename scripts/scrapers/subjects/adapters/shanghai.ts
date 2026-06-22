import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseShSubjects } from '../shanghai'
import { parsePdf } from '../../shared/pdf'

// 真实数据：上海市教育考试院 shmeea.edu.cn
// 选科要求以单一 PDF 文件发布，包含所有高校的选科要求
const SH_SUBJECTS_URLS: Record<number, { pageUrl: string; pdfUrl: string }> = {
  2024: {
    pageUrl: 'http://www.shmeea.edu.cn/page/08000/20211231/25650.html',
    pdfUrl: 'http://www.shmeea.edu.cn/download/20211231/01.pdf',
  },
}

export const shanghaiSubjectScraper: SubjectScraper = {
  province: '上海',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SH_SUBJECTS_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.pdfUrl, {
        cacheKey: `sh_subjects_${year}.pdf`,
        forceRefresh: options?.force,
        timeout: 60000,
      })

      const text = await parsePdf(result.buffer)
      const parsed = parseShSubjects(text, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.pdfUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `上海选科要求 ${year}`,
      })
    }

    return { records, failed }
  },
}
