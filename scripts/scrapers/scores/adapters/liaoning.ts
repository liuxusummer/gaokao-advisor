import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseLnToudang } from '../liaoning'
import AdmZip from 'adm-zip'

// 真实数据：辽宁招生考试之窗 lnzsks.com
// 物理类和历史类分别在不同的 ZIP 文件中，ZIP 内含 XLSX
const LN_TOUDANG_URLS: Record<
  number,
  Record<'物理类' | '历史类', { pageUrl: string; zipUrl: string }>
> = {
  2024: {
    '物理类': {
      pageUrl: 'https://www.lnzsks.com/newsinfo/IMS_20240720_44109_OymtAPK6ag.htm',
      zipUrl: 'https://www.lnzsks.com/lnzkbfiles/2024/2024gkbktdxsiexieft02l.zip',
    },
    '历史类': {
      pageUrl: 'https://www.lnzsks.com/newsinfo/IMS_20240720_44109_OymtAPK6ag.htm',
      zipUrl: 'https://www.lnzsks.com/lnzkbfiles/2024/2024gkbkptdxosiexie01w.zip',
    },
  },
}

export const liaoningScoreScraper: ScoreScraper = {
  province: '辽宁',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = LN_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.zipUrl, {
          cacheKey: `ln_toudang_${year}_${category}.zip`,
          forceRefresh: options?.force,
        })

        // 解压 ZIP 并找到 XLSX 文件
        const zip = new AdmZip(result.buffer)
        const entries = zip.getEntries()
        const xlsxEntry = entries.find((e) => !e.isDirectory && /\.xlsx?$/i.test(e.entryName))
        if (!xlsxEntry) {
          throw new Error('ZIP 中未找到 Excel 文件')
        }

        const xlsxBuffer = xlsxEntry.getData()
        const parsed = parseLnToudang(xlsxBuffer, year, category, fileConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.zipUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `辽宁 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
