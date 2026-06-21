import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parsePdf } from '../../shared/pdf'
import { parseZjTable } from '../zhejiang'
import { ZJ_RANK_TABLE_URLS } from '../../config'

export const zhejiangRankTableScraper: RankTableScraper = {
  province: '浙江',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = ZJ_RANK_TABLE_URLS[year]
    if (!urlConfig || !urlConfig.pdfUrl) {
      return { records, failed }
    }

    try {
      const result = await client.fetchBinary(urlConfig.pdfUrl, {
        cacheKey: `zj_rank_${year}`,
        forceRefresh: options?.force,
      })

      const text = await parsePdf(result.buffer)
      const parsed = parseZjTable(text, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.pdfUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `浙江一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
