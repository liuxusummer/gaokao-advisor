import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseShTable } from '../shanghai'

const SH_RANK_TABLE_URLS: Record<number, { pageUrl: string; htmlUrl: string }> = {
  2023: { pageUrl: 'https://www.shmeea.edu.cn/', htmlUrl: 'https://www.shmeea.edu.cn/a3/shyfydb2023.html' },
  2024: { pageUrl: 'https://www.shmeea.edu.cn/', htmlUrl: 'https://www.shmeea.edu.cn/a3/shyfydb2024.html' },
  2025: { pageUrl: 'https://www.shmeea.edu.cn/', htmlUrl: 'https://www.shmeea.edu.cn/a3/shyfydb2025.html' },
}

export const shanghaiRankTableScraper: RankTableScraper = {
  province: '上海',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SH_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetch(urlConfig.htmlUrl, {
        cacheKey: `sh_rank_${year}.html`,
        forceRefresh: options?.force,
      })

      const parsed = parseShTable(result.html, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.htmlUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `上海一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
