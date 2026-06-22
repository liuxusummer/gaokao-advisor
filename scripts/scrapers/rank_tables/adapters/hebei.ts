import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseHbTable } from '../hebei'

// 真实数据：河北省教育考试院 hebeea.edu.cn 的 PDF 为图片格式，无法直接解析文本。
// 改用大学生必备网 (dxsbb.com) 转载的 HTML 表格（数据来源为河北考试院官方）。
const HB_RANK_TABLE_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; htmlUrl: string }>
> = {
  2023: {
    '物理类': { pageUrl: 'https://www.dxsbb.com/', htmlUrl: 'https://www.dxsbb.com/news/128345.html' },
    '历史类': { pageUrl: 'https://www.dxsbb.com/', htmlUrl: 'https://www.dxsbb.com/news/128346.html' },
  },
  2024: {
    '物理类': { pageUrl: 'https://www.dxsbb.com/', htmlUrl: 'https://www.dxsbb.com/news/146488.html' },
    '历史类': { pageUrl: 'https://www.dxsbb.com/', htmlUrl: 'https://www.dxsbb.com/news/146489.html' },
  },
  2025: {
    '物理类': { pageUrl: 'https://www.dxsbb.com/', htmlUrl: 'https://www.dxsbb.com/news/160000.html' },
    '历史类': { pageUrl: 'https://www.dxsbb.com/', htmlUrl: 'https://www.dxsbb.com/news/160001.html' },
  },
}

export const hebeiRankTableScraper: RankTableScraper = {
  province: '河北',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HB_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetch(fileConfig.htmlUrl, {
          cacheKey: `hb_rank_${year}_${category}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseHbTable(result.html, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.htmlUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `河北一分一段表 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
