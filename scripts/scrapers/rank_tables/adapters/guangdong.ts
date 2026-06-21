import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parsePdf } from '../../shared/pdf'
import { parseGdTable } from '../guangdong'

const GD_RANK_TABLE_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; pdfUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdrankwl2023.pdf' },
    '历史类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdrankls2023.pdf' },
  },
  2024: {
    '物理类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdrankwl2024.pdf' },
    '历史类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdrankls2024.pdf' },
  },
  2025: {
    '物理类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdrankwl2025.pdf' },
    '历史类': { pageUrl: 'https://eea.gd.gov.cn/', pdfUrl: 'https://eea.gd.gov.cn/attach/gdrankls2025.pdf' },
  },
}

export const guangdongRankTableScraper: RankTableScraper = {
  province: '广东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = GD_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.pdfUrl, {
          cacheKey: `gd_rank_${year}_${category}.pdf`,
          forceRefresh: options?.force,
        })

        const text = await parsePdf(result.buffer)
        const parsed = parseGdTable(text, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.pdfUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `广东一分一段表 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
