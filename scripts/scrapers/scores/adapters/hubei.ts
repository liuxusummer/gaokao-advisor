import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseHubToudangPdf } from '../hubei'
import { parsePdf } from '../../shared/pdf'

// 真实数据：湖北省教育厅 jyt.hubei.gov.cn
// 物理类和历史类分别在不同的 PDF 文件中
const HUB_TOUDANG_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; pdfUrl: string }>
> = {
  2024: {
    '物理类': {
      pageUrl: 'https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202407/t20240721_5274253.shtml',
      pdfUrl: 'https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202407/P020240721672288198677.pdf',
    },
    '历史类': {
      pageUrl: 'https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202407/t20240721_5274252.shtml',
      pdfUrl: 'https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202407/P020240721671647870696.pdf',
    },
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
