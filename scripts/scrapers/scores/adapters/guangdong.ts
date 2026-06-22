import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseGdToudangPdf } from '../guangdong'
import { parsePdf } from '../../shared/pdf'
import AdmZip from 'adm-zip'

// 真实数据：广东省教育考试院 eea.gd.gov.cn
// 投档线以 ZIP 包形式发布，内含多个 PDF（普通类物理/历史、艺术类、体育类等）
const GD_TOUDANG_URLS: Record<number, { pageUrl: string; zipUrl: string }> = {
  2024: {
    pageUrl: 'https://eea.gd.gov.cn/ptgk/content/post_4458330.html',
    zipUrl: 'https://eea.gd.gov.cn/attachment/0/554/554636/4458330.zip',
  },
}

export const guangdongScoreScraper: ScoreScraper = {
  province: '广东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = GD_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.zipUrl, {
        cacheKey: `gd_toudang_${year}.zip`,
        forceRefresh: options?.force,
      })

      // 解压 ZIP 并找到普通类物理/历史 PDF
      const zip = new AdmZip(result.buffer)
      const entries = zip.getEntries()

      for (const entry of entries) {
        if (entry.isDirectory) continue
        if (!/\.pdf$/i.test(entry.entryName)) continue

        try {
          const pdfBuffer = entry.getData()
          const text = await parsePdf(pdfBuffer)

          // 通过 PDF 内容判断类别（文件名是 GBK 编码，难以可靠解码）
          let category: '物理类' | '历史类' | null = null
          if (text.includes('普通类') && text.includes('物理')) {
            category = '物理类'
          } else if (text.includes('普通类') && text.includes('历史')) {
            category = '历史类'
          }

          if (!category) continue

          const parsed = parseGdToudangPdf(text, year, category, urlConfig.pageUrl)
          records.push(...parsed)
        } catch (error) {
          failed.push({
            url: `${urlConfig.zipUrl}!/${entry.entryName}`,
            error: (error as Error).message,
            retryCount: 3,
            context: `广东 ${year} PDF 解析`,
          })
        }
      }
    } catch (error) {
      failed.push({
        url: urlConfig.zipUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `广东 ${year}`,
      })
    }

    return { records, failed }
  },
}
