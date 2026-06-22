import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parsePdf } from '../../shared/pdf'
import { parseGdTable, parseGdExcel } from '../guangdong'
import AdmZip from 'adm-zip'

// 真实数据：广东省教育考试院 eea.gd.gov.cn
// 一分一段表以 ZIP 包形式发布，内含 16 个 PDF（普通类物理/历史、艺术类、体育类等）
// 文件名以 GBK 编码，但前缀数字 "1." = 历史类, "2." = 物理类 可用于识别
const GD_RANK_TABLE_URLS: Record<number, { pageUrl: string; zipUrl: string }> = {
  2024: {
    pageUrl: 'https://eea.gd.gov.cn/ptgk/content/post_4445521.html',
    zipUrl: 'https://eea.gd.gov.cn/attachment/0/552/552702/4445521.zip',
  },
}

export const guangdongRankTableScraper: RankTableScraper = {
  province: '广东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = GD_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.zipUrl, {
        cacheKey: `gd_rank_${year}.zip`,
        forceRefresh: options?.force,
      })

      // 解压 ZIP 并找到普通类物理/历史 PDF
      const zip = new AdmZip(result.buffer)
      const entries = zip.getEntries()

      for (const entry of entries) {
        if (entry.isDirectory) continue

        const isExcel = /\.(xlsx?|xls)$/i.test(entry.entryName)
        const isPdf = /\.pdf$/i.test(entry.entryName)
        if (!isExcel && !isPdf) continue

        // 通过文件名前缀识别类别（文件名 GBK 编码，但数字前缀是 ASCII）
        // "1.xxx.pdf" = 历史类, "2.xxx.pdf" = 物理类
        let category: '物理类' | '历史类' | null = null
        const prefixMatch = entry.entryName.match(/^(\d+)\./)
        if (prefixMatch) {
          const num = parseInt(prefixMatch[1], 10)
          if (num === 1) category = '历史类'
          else if (num === 2) category = '物理类'
        }

        if (!category) continue

        try {
          const fileBuffer = entry.getData()

          if (isExcel) {
            const parsed = parseGdExcel(fileBuffer, year, category, urlConfig.pageUrl)
            records.push(...parsed)
          } else {
            const text = await parsePdf(fileBuffer)
            const parsed = parseGdTable(text, year, category, urlConfig.pageUrl)
            records.push(...parsed)
          }
        } catch (error) {
          failed.push({
            url: `${urlConfig.zipUrl}!/${entry.entryName}`,
            error: (error as Error).message,
            retryCount: 3,
            context: `广东一分一段表 ${year} ${category} 文件解析`,
          })
        }
      }
    } catch (error) {
      failed.push({
        url: urlConfig.zipUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `广东一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
