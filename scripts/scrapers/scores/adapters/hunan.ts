import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseHnToudang } from '../hunan'

// 真实数据：湖南教育考试院 hneeb.cn
// 物理类和历史类在同一个 Excel 文件中，通过"科类"列区分
const HN_TOUDANG_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2024: {
    pageUrl: 'https://www.hneeb.cn/hnxxg/741/742/',
    xlsUrl: 'https://www.hneeb.cn/hnxxg/741/742/2024072001.xlsx',
  },
}

export const hunanScoreScraper: ScoreScraper = {
  province: '湖南',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HN_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `hn_toudang_${year}.xlsx`,
        forceRefresh: options?.force,
      })

      const parsed = parseHnToudang(result.buffer, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `湖南 ${year}`,
      })
    }

    return { records, failed }
  },
}
