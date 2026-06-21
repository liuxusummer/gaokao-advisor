import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseShToudang } from '../shanghai'

const SH_TOUDANG_URLS: Record<number, { pageUrl: string; htmlUrl: string }> = {
  2023: {
    pageUrl: 'https://www.shmeea.edu.cn/',
    htmlUrl: 'https://www.shmeea.edu.cn/a3/shtd2023.html',
  },
  2024: {
    pageUrl: 'https://www.shmeea.edu.cn/',
    htmlUrl: 'https://www.shmeea.edu.cn/a3/shtd2024.html',
  },
  2025: {
    pageUrl: 'https://www.shmeea.edu.cn/',
    htmlUrl: 'https://www.shmeea.edu.cn/a3/shtd2025.html',
  },
}

export const shanghaiScoreScraper: ScoreScraper = {
  province: '上海',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SH_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetch(urlConfig.htmlUrl, {
        cacheKey: `sh_toudang_${year}.html`,
        forceRefresh: options?.force,
      })

      const parsed = parseShToudang(result.html, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.htmlUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `上海 ${year}`,
      })
    }

    return { records, failed }
  },
}
