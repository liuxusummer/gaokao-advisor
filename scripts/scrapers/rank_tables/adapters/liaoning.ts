import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseLnTable } from '../liaoning'
import { parsePdf } from '../../shared/pdf'

// 真实数据：辽宁招生考试之窗 lnzsks.com
// 物理类和历史类分别在不同的 PDF 文件中
const LN_RANK_TABLE_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; pdfUrl: string }>
> = {
  2024: {
    '物理类': {
      pageUrl: 'https://www.lnzsks.com/newsinfo/IMS_20240624_44046_Zy6XwhnIQA.htm',
      pdfUrl: 'https://www.lnzsks.com/lnzkbfiles/2024/2024gkfsxptl0624001.pdf',
    },
    '历史类': {
      pageUrl: 'https://www.lnzsks.com/newsinfo/IMS_20240624_44046_Zy6XwhnIQA.htm',
      pdfUrl: 'https://www.lnzsks.com/lnzkbfiles/2024/2024gkfsxptw0624002.pdf',
    },
  },
}

export const liaoningRankTableScraper: RankTableScraper = {
  province: '辽宁',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = LN_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.pdfUrl, {
          cacheKey: `ln_rank_${year}_${category}.pdf`,
          forceRefresh: options?.force,
        })

        const text = await parsePdf(result.buffer)
        const parsed = parseLnTable(text, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.pdfUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `辽宁一分一段表 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
