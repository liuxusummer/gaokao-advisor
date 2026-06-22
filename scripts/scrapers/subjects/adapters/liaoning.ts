import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseLnSubjects } from '../liaoning'

// 真实数据：辽宁省招生考试之窗 lnzsks.com
// 选科要求以 Excel 文件发布（本科 + 高职专科两个文件）
// 原始链接已下线，使用营口市教育局镜像
const LN_SUBJECTS_URLS: Record<
  number,
  { pageUrl: string; bachelorUrl: string; vocationalUrl?: string }
> = {
  2024: {
    pageUrl: 'https://jyt.ln.gov.cn/jyt/gk/zxtz/2023082115102399493/index.shtml',
    bachelorUrl: 'https://jyj.yingkou.gov.cn/EWB_YK/epointtemp/editor/uploadfile/20220325151020948.xlsx',
    vocationalUrl: 'https://jyj.yingkou.gov.cn/EWB_YK/epointtemp/editor/uploadfile/20220325151040223.xlsx',
  },
}

export const liaoningSubjectScraper: SubjectScraper = {
  province: '辽宁',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = LN_SUBJECTS_URLS[year]
    if (!urlConfig) return { records, failed }

    // 本科
    try {
      const result = await client.fetchBinary(urlConfig.bachelorUrl, {
        cacheKey: `ln_subjects_${year}_bk.xlsx`,
        forceRefresh: options?.force,
      })
      const parsed = parseLnSubjects(result.buffer, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.bachelorUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `辽宁选科要求 ${year} 本科`,
      })
    }

    // 高职专科
    if (urlConfig.vocationalUrl) {
      try {
        const result = await client.fetchBinary(urlConfig.vocationalUrl, {
          cacheKey: `ln_subjects_${year}_zk.xlsx`,
          forceRefresh: options?.force,
        })
        const parsed = parseLnSubjects(result.buffer, urlConfig.pageUrl)
        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: urlConfig.vocationalUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `辽宁选科要求 ${year} 高职专科`,
        })
      }
    }

    return { records, failed }
  },
}
