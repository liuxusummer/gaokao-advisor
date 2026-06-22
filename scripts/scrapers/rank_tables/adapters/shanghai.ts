import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseShTable } from '../shanghai'
import { parsePdf } from '../../shared/pdf'

// 真实数据：上海市教育考试院 shmeea.edu.cn
// 一分一段表以 PDF 格式发布
const SH_RANK_TABLE_URLS: Record<number, { pageUrl: string; pdfUrl: string }> = {
  2024: {
    pageUrl: 'https://www.shmeea.edu.cn/page/02200/20240623/18612.html',
    pdfUrl: 'https://www.shmeea.edu.cn/download/20240623/00.pdf',
  },
}

export const shanghaiRankTableScraper: RankTableScraper = {
  province: '上海',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SH_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.pdfUrl, {
        cacheKey: `sh_rank_${year}.pdf`,
        forceRefresh: options?.force,
      })

      const text = await parsePdf(result.buffer)
      const parsed = parseShTable(text, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.pdfUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `上海一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
