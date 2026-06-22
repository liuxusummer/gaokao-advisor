import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseHnTable } from '../hunan'

const HN_RANK_TABLE_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; htmlUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://www.hneeb.cn/', htmlUrl: 'https://www.hneeb.cn/hnxxg/741/742/content_4023.html' },
    '历史类': { pageUrl: 'https://www.hneeb.cn/', htmlUrl: 'https://www.hneeb.cn/hnxxg/741/742/content_4022.html' },
  },
  2024: {
    '物理类': { pageUrl: 'https://www.hneeb.cn/', htmlUrl: 'https://www.hneeb.cn/hnxxg/741/742/content_4207.html' },
    '历史类': { pageUrl: 'https://www.hneeb.cn/', htmlUrl: 'https://www.hneeb.cn/hnxxg/741/742/content_4206.html' },
  },
  2025: {
    '物理类': { pageUrl: 'https://www.hneeb.cn/', htmlUrl: 'https://www.hneeb.cn/hnxxg/741/742/content_4400.html' },
    '历史类': { pageUrl: 'https://www.hneeb.cn/', htmlUrl: 'https://www.hneeb.cn/hnxxg/741/742/content_4399.html' },
  },
}

export const hunanRankTableScraper: RankTableScraper = {
  province: '湖南',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HN_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetch(fileConfig.htmlUrl, {
          cacheKey: `hn_rank_${year}_${category}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseHnTable(result.html, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.htmlUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `湖南一分一段表 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
