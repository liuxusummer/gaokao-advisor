import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseSdToudang } from '../shandong'

const SD_TOUDANG_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2023: {
    pageUrl: 'https://www.sdzk.cn/',
    xlsUrl: 'https://www.sdzk.cn/Floadup/file/20230719/6385700532268895241675881.xls',
  },
  2024: {
    pageUrl: 'https://www.eol.cn/m/gaokao/202407/t20240719_2625077.shtml',
    xlsUrl: 'https://www.sdzk.cn/Floadup/file/20240719/6385700532268895241675882.xls',
  },
  2025: {
    pageUrl: 'https://www.sdzk.cn/',
    xlsUrl: 'https://www.sdzk.cn/Floadup/file/20250719/6385700532268895241675883.xls',
  },
}

export const shandongScoreScraper: ScoreScraper = {
  province: '山东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SD_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `sd_toudang_${year}.xls`,
        forceRefresh: options?.force,
      })

      const parsed = parseSdToudang(result.buffer, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `山东 ${year}`,
      })
    }

    return { records, failed }
  },
}
