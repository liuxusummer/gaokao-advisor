import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseZjToudang } from '../zhejiang'
import { ZJ_TOUDANG_URLS } from '../../config'

export const zhejiangScoreScraper: ScoreScraper = {
  province: '浙江',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = ZJ_TOUDANG_URLS[year]
    if (!urlConfig) {
      return { records, failed }
    }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `zj_toudang_${year}.xls`,
        forceRefresh: options?.force,
      })

      const parsed = parseZjToudang(result.buffer, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `浙江 ${year}`,
      })
    }

    return { records, failed }
  },
}
