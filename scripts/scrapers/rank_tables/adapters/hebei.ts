import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { ocrImage } from '../../shared/ocr'
import { parseHbTable } from '../hebei'

const HB_RANK_TABLE_URLS: Record<
  number,
  { pageUrl: string; images: Record<string, string[]> }
> = {
  2023: {
    pageUrl: 'https://www.hebeea.edu.cn/',
    images: {
      '物理类': [
        'https://www.hebeea.edu.cn/a3/yfydbwl2023_1.jpg',
        'https://www.hebeea.edu.cn/a3/yfydbwl2023_2.jpg',
      ],
      '历史类': [
        'https://www.hebeea.edu.cn/a3/yfydbls2023_1.jpg',
        'https://www.hebeea.edu.cn/a3/yfydbls2023_2.jpg',
      ],
    },
  },
  2024: {
    pageUrl: 'https://www.hebeea.edu.cn/',
    images: {
      '物理类': [
        'https://www.hebeea.edu.cn/a3/yfydbwl2024_1.jpg',
      ],
      '历史类': [
        'https://www.hebeea.edu.cn/a3/yfydbls2024_1.jpg',
      ],
    },
  },
  2025: {
    pageUrl: 'https://www.hebeea.edu.cn/',
    images: {
      '物理类': [
        'https://www.hebeea.edu.cn/a3/yfydbwl2025_1.jpg',
      ],
      '历史类': [
        'https://www.hebeea.edu.cn/a3/yfydbls2025_1.jpg',
      ],
    },
  },
}

export const hebeiRankTableScraper: RankTableScraper = {
  province: '河北',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HB_RANK_TABLE_URLS[year]
    if (!urlConfig || !urlConfig.images) {
      return { records, failed }
    }

    for (const category of ['物理类', '历史类'] as const) {
      const imageUrls = urlConfig.images[category]
      if (!imageUrls) continue

      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const result = await client.fetchBinary(imageUrls[i], {
            cacheKey: `hb_rank_${year}_${category}_${i + 1}`,
            forceRefresh: options?.force,
          })

          const text = await ocrImage(result.buffer)
          const parsed = parseHbTable(text, year, category, urlConfig.pageUrl)
          records.push(...parsed)
        } catch (error) {
          failed.push({
            url: imageUrls[i],
            error: (error as Error).message,
            retryCount: 3,
            context: `河北一分一段表 ${year} ${category} part ${i + 1}`,
          })
        }
      }
    }

    return { records, failed }
  },
}
