import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseHubToudangPdf } from '../hubei'
import { parsePdf } from '../../shared/pdf'

// 湖北（huBei）使用 `Hub` 前缀以避免与河北（hebei，`Hb` 前缀）冲突
const HUB_TOUDANG_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; pdfUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://www.hbea.edu.cn/', pdfUrl: 'https://www.hbea.edu.cn/a3/hubwl2023.pdf' },
    '历史类': { pageUrl: 'https://www.hbea.edu.cn/', pdfUrl: 'https://www.hbea.edu.cn/a3/hubls2023.pdf' },
  },
  2024: {
    '物理类': { pageUrl: 'https://www.hbea.edu.cn/', pdfUrl: 'https://www.hbea.edu.cn/a3/hubwl2024.pdf' },
    '历史类': { pageUrl: 'https://www.hbea.edu.cn/', pdfUrl: 'https://www.hbea.edu.cn/a3/hubls2024.pdf' },
  },
  2025: {
    '物理类': { pageUrl: 'https://www.hbea.edu.cn/', pdfUrl: 'https://www.hbea.edu.cn/a3/hubwl2025.pdf' },
    '历史类': { pageUrl: 'https://www.hbea.edu.cn/', pdfUrl: 'https://www.hbea.edu.cn/a3/hubls2025.pdf' },
  },
}

export const hubeiScoreScraper: ScoreScraper = {
  province: '湖北',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HUB_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.pdfUrl, {
          cacheKey: `hub_toudang_${year}_${category}.pdf`,
          forceRefresh: options?.force,
        })

        const text = await parsePdf(result.buffer)
        const parsed = parseHubToudangPdf(text, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.pdfUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `湖北 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
