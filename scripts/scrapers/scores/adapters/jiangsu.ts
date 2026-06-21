import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseJsToudangExcel, parseJsToudangPdf } from '../jiangsu'
import { parsePdf } from '../../shared/pdf'
import { JS_TOUDANG_URLS } from '../../config'

export const jiangsuScoreScraper: ScoreScraper = {
  province: '江苏',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = JS_TOUDANG_URLS[year]
    if (!urlConfig) {
      return { records, failed }
    }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig.files[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.url, {
          cacheKey: `js_toudang_${year}_${category}.${fileConfig.format}`,
          forceRefresh: options?.force,
        })

        let parsed: ScoreRecord[]
        if (fileConfig.format === 'xls') {
          parsed = parseJsToudangExcel(result.buffer, year, category, fileConfig.pageUrl)
        } else {
          const text = await parsePdf(result.buffer)
          parsed = parseJsToudangPdf(text, year, category, fileConfig.pageUrl)
        }

        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.url,
          error: (error as Error).message,
          retryCount: 3,
          context: `江苏 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
