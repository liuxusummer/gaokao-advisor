import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseSdTable } from '../shandong'

const SD_RANK_TABLE_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2023: { pageUrl: 'https://www.sdzs.gov.cn/', xlsUrl: 'https://www.sdzs.gov.cn/yfydb2023.xls' },
  2024: { pageUrl: 'https://www.sdzs.gov.cn/', xlsUrl: 'https://www.sdzs.gov.cn/yfydb2024.xls' },
  2025: { pageUrl: 'https://www.sdzs.gov.cn/', xlsUrl: 'https://www.sdzs.gov.cn/yfydb2025.xls' },
}

export const shandongRankTableScraper: RankTableScraper = {
  province: '山东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SD_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `sd_rank_${year}.xls`,
        forceRefresh: options?.force,
      })

      const parsed = parseSdTable(result.buffer, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `山东一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
