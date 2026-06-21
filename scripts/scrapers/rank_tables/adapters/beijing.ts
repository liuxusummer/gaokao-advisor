import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseBjTable } from '../beijing'

const BJ_RANK_TABLE_URLS: Record<number, { pageUrl: string; htmlUrl: string }> = {
  2023: { pageUrl: 'https://www.bjeea.cn/', htmlUrl: 'https://www.bjeea.cn/a3/bjyfydb2023.html' },
  2024: { pageUrl: 'https://www.bjeea.cn/', htmlUrl: 'https://www.bjeea.cn/a3/bjyfydb2024.html' },
  2025: { pageUrl: 'https://www.bjeea.cn/', htmlUrl: 'https://www.bjeea.cn/a3/bjyfydb2025.html' },
}

export const beijingRankTableScraper: RankTableScraper = {
  province: '北京',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = BJ_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetch(urlConfig.htmlUrl, {
        cacheKey: `bj_rank_${year}.html`,
        forceRefresh: options?.force,
      })

      const parsed = parseBjTable(result.html, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.htmlUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `北京一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
