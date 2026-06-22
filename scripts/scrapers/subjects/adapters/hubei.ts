import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseHubSubjects } from '../hubei'

// 真实数据：湖北招生信息网 zsxx.e21.cn
// 选科要求以 Excel 文件发布，包含本科和专科两个 sheet
// 原始链接需在业务期访问，使用 gaokaobang 镜像
const HUB_SUBJECTS_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2024: {
    pageUrl: 'https://zsxx.e21.cn/e21html/zsarticles/gaozhao/2022_03_29/1085.html',
    xlsUrl: 'https://gaokaobang.oss-cn-beijing.aliyuncs.com/attachs/ohr/2022/03/29/104404_62427274c6dc6.xls',
  },
}

export const hubeiSubjectScraper: SubjectScraper = {
  province: '湖北',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = HUB_SUBJECTS_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `hub_subjects_${year}.xls`,
        forceRefresh: options?.force,
        timeout: 60000,
      })

      const parsed = parseHubSubjects(result.buffer, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `湖北选科要求 ${year}`,
      })
    }

    return { records, failed }
  },
}
