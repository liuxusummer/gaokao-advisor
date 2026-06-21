import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseHbToudang } from '../hebei'

const HB_TOUDANG_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; xlsUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://www.hebeea.edu.cn/', xlsUrl: 'https://www.hebeea.edu.cn/a3/hbwl2023.xls' },
    '历史类': { pageUrl: 'https://www.hebeea.edu.cn/', xlsUrl: 'https://www.hebeea.edu.cn/a3/hbls2023.xls' },
  },
  2024: {
    '物理类': { pageUrl: 'https://www.hebeea.edu.cn/', xlsUrl: 'https://www.hebeea.edu.cn/a3/hbwl2024.xls' },
    '历史类': { pageUrl: 'https://www.hebeea.edu.cn/', xlsUrl: 'https://www.hebeea.edu.cn/a3/hbls2024.xls' },
  },
  2025: {
    '物理类': { pageUrl: 'https://www.hebeea.edu.cn/', xlsUrl: 'https://www.hebeea.edu.cn/a3/hbwl2025.xls' },
    '历史类': { pageUrl: 'https://www.hebeea.edu.cn/', xlsUrl: 'https://www.hebeea.edu.cn/a3/hbls2025.xls' },
  },
}

export const hebeiScoreScraper: ScoreScraper = {
  province: '河北',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HB_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.xlsUrl, {
          cacheKey: `hb_toudang_${year}_${category}.xls`,
          forceRefresh: options?.force,
        })

        const parsed = parseHbToudang(result.buffer, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.xlsUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `河北 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
