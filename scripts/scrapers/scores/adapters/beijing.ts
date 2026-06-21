import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseBjToudang } from '../beijing'

const BJ_TOUDANG_URLS: Record<number, { pageUrl: string; htmlUrl: string }> = {
  2023: {
    pageUrl: 'https://www.bjeea.cn/',
    htmlUrl: 'https://www.bjeea.cn/a3/bjtd2023.html',
  },
  2024: {
    pageUrl: 'https://www.bjeea.cn/',
    htmlUrl: 'https://www.bjeea.cn/a3/bjtd2024.html',
  },
  2025: {
    pageUrl: 'https://www.bjeea.cn/',
    htmlUrl: 'https://www.bjeea.cn/a3/bjtd2025.html',
  },
}

export const beijingScoreScraper: ScoreScraper = {
  province: '北京',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = BJ_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetch(urlConfig.htmlUrl, {
        cacheKey: `bj_toudang_${year}.html`,
        forceRefresh: options?.force,
      })

      const parsed = parseBjToudang(result.html, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.htmlUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `北京 ${year}`,
      })
    }

    return { records, failed }
  },
}
