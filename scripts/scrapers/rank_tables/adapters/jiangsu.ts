import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { ocrImage } from '../../shared/ocr'
import { parseJsTable } from '../jiangsu'
import { JS_RANK_TABLE_URLS } from '../../config'

export const jiangsuRankTableScraper: RankTableScraper = {
  province: '江苏',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = JS_RANK_TABLE_URLS[year]
    if (!urlConfig || !urlConfig.images) {
      return { records, failed }
    }

    for (const category of ['物理类', '历史类'] as const) {
      const imageUrls = urlConfig.images[category]
      if (!imageUrls) continue

      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const result = await client.fetchBinary(imageUrls[i], {
            cacheKey: `js_rank_${year}_${category}_${i + 1}`,
            forceRefresh: options?.force,
          })

          const text = await ocrImage(result.buffer)
          const parsed = parseJsTable(text, year, category, urlConfig.pageUrl)
          records.push(...parsed)
        } catch (error) {
          failed.push({
            url: imageUrls[i],
            error: (error as Error).message,
            retryCount: 3,
            context: `江苏一分一段表 ${year} ${category} part ${i + 1}`,
          })
        }
      }
    }

    return { records, failed }
  },
}
