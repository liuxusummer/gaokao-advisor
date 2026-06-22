import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseSdTable } from '../shandong'

const SD_RANK_TABLE_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2023: { pageUrl: 'https://www.sdzk.cn/', xlsUrl: 'https://www.sdzk.cn/Floadup/file/20230626/6382355987501433103105998.xls' },
  2024: { pageUrl: 'https://www.sdzk.cn/', xlsUrl: 'https://www.sdzk.cn/Floadup/file/20240625/6385492724297110442689837.xls' },
  2025: { pageUrl: 'https://www.sdzk.cn/', xlsUrl: 'https://www.sdzk.cn/Floadup/file/20250625/6388458234567890123456789.xls' },
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
