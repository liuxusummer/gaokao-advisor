import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseShToudangPdf } from '../shanghai'
import { parsePdf } from '../../shared/pdf'

// 真实数据：上海市教育考试院 shmeea.edu.cn
// 投档线以 PDF 格式发布，包含所有院校专业组（580分以下）
const SH_TOUDANG_URLS: Record<number, { pageUrl: string; pdfUrl: string }> = {
  2024: {
    pageUrl: 'https://www.shmeea.edu.cn/page/02200/20240719/18689.html',
    pdfUrl: 'https://www.shmeea.edu.cn/download/20240719/198.pdf',
  },
}

export const shanghaiScoreScraper: ScoreScraper = {
  province: '上海',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SH_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.pdfUrl, {
        cacheKey: `sh_toudang_${year}.pdf`,
        forceRefresh: options?.force,
      })

      const text = await parsePdf(result.buffer)
      const parsed = parseShToudangPdf(text, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.pdfUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `上海 ${year}`,
      })
    }

    return { records, failed }
  },
}
