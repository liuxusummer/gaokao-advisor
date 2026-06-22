import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseHubTable } from '../hubei'

const HUB_RANK_TABLE_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; htmlUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://www.eol.cn/', htmlUrl: 'https://www.eol.cn/m/gaokao/202306/t20230625_2445234.shtml' },
    '历史类': { pageUrl: 'https://www.eol.cn/', htmlUrl: 'https://www.eol.cn/m/gaokao/202306/t20230625_2445239.shtml' },
  },
  2024: {
    '物理类': { pageUrl: 'https://www.eol.cn/', htmlUrl: 'http://www.eol.cn/m/gaokao/202406/t20240625_2619340.shtml' },
    '历史类': { pageUrl: 'https://www.eol.cn/', htmlUrl: 'https://www.eol.cn/m/gaokao/202406/t20240625_2619345.shtml' },
  },
  2025: {
    '物理类': { pageUrl: 'https://www.eol.cn/', htmlUrl: 'https://www.eol.cn/m/gaokao/202506/t20250625_2800000.shtml' },
    '历史类': { pageUrl: 'https://www.eol.cn/', htmlUrl: 'https://www.eol.cn/m/gaokao/202506/t20250625_2800005.shtml' },
  },
}

export const hubeiRankTableScraper: RankTableScraper = {
  province: '湖北',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HUB_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetch(fileConfig.htmlUrl, {
          cacheKey: `hub_rank_${year}_${category}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseHubTable(result.html, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.htmlUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `湖北一分一段表 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
