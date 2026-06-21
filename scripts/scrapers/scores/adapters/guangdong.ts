import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseGdToudangPdf } from '../guangdong'
import { parsePdf } from '../../shared/pdf'

// 广东（guangDong）使用 `Gd` 前缀
const GD_TOUDANG_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; pdfUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdwl2023.pdf' },
    '历史类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdls2023.pdf' },
  },
  2024: {
    '物理类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdwl2024.pdf' },
    '历史类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdls2024.pdf' },
  },
  2025: {
    '物理类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdwl2025.pdf' },
    '历史类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdls2025.pdf' },
  },
}

export const guangdongScoreScraper: ScoreScraper = {
  province: '广东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = GD_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.pdfUrl, {
          cacheKey: `gd_toudang_${year}_${category}.pdf`,
          forceRefresh: options?.force,
        })

        const text = await parsePdf(result.buffer)
        const parsed = parseGdToudangPdf(text, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.pdfUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `广东 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
