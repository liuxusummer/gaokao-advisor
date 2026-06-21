import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseLnToudang } from '../liaoning'

const LN_TOUDANG_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; htmlUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/lntdwl2023.html' },
    '历史类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/lntdls2023.html' },
  },
  2024: {
    '物理类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/lntdwl2024.html' },
    '历史类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/lntdls2024.html' },
  },
  2025: {
    '物理类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/lntdwl2025.html' },
    '历史类': { pageUrl: 'https://www.lnzsks.com/', htmlUrl: 'https://www.lnzsks.com/a3/lntdls2025.html' },
  },
}

export const liaoningScoreScraper: ScoreScraper = {
  province: '辽宁',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = LN_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetch(fileConfig.htmlUrl, {
          cacheKey: `ln_toudang_${year}_${category}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseLnToudang(result.html, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.htmlUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `辽宁 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
