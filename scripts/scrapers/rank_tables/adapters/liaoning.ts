import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseLnTable } from '../liaoning'

const LN_RANK_TABLE_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; htmlUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/yfydbwl2023.html' },
    '历史类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/yfydbls2023.html' },
  },
  2024: {
    '物理类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/yfydbwl2024.html' },
    '历史类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/yfydbls2024.html' },
  },
  2025: {
    '物理类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/yfydbwl2025.html' },
    '历史类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/yfydbls2025.html' },
  },
}

export const liaoningRankTableScraper: RankTableScraper = {
  province: '辽宁',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = LN_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetch(fileConfig.htmlUrl, {
          cacheKey: `ln_rank_${year}_${category}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseLnTable(result.html, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.htmlUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `辽宁一分一段表 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
