import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseHbToudang } from '../hebei'

// 真实数据：河北教育考试院 hebeea.edu.cn
// 物理类和历史类分别在不同的 Excel 文件中
const HB_TOUDANG_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; xlsUrl: string }>
> = {
  2024: {
    '物理类': {
      pageUrl: 'http://www.hebeea.edu.cn/html/xxgl/tzgg/2024/0722-163123-755.html',
      xlsUrl: 'https://file.hebeea.edu.cn/files/article/2024/07/20240722163024_933.xlsx',
    },
    '历史类': {
      pageUrl: 'http://www.hebeea.edu.cn/html/xxgl/tzgg/2024/0722-163123-755.html',
      xlsUrl: 'https://file.hebeea.edu.cn/files/article/2024/07/20240722163024_223.xlsx',
    },
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
          cacheKey: `hb_toudang_${year}_${category}.xlsx`,
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
