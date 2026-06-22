import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseSdSubjects } from '../shandong'
import { parsePdf } from '../../shared/pdf'

// 真实数据：山东省教育招生考试院 sdzk.cn
// 选科要求以 PDF 文件形式发布（2024通用版，适用于2025-2026年高考）
// 本科和专科分别有独立的 PDF 文件
const SD_SUBJECTS_BK_URL =
  'https://www.sdzk.cn/Floadup/file/20250317/6387782010007663213616549.pdf'
const SD_SUBJECTS_ZK_URL =
  'https://www.sdzk.cn/Floadup/file/20250317/6387782010723289868336614.pdf'
const SD_SUBJECTS_PAGE_URL = 'https://www.sdzk.cn/NewsInfo.aspx?NewsID=6819'

export const shandongSubjectScraper: SubjectScraper = {
  province: '山东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    // 下载并解析本科 PDF
    try {
      console.log('  山东选科要求：下载本科 PDF...')
      const bkResult = await client.fetchBinary(SD_SUBJECTS_BK_URL, {
        cacheKey: `sd_subjects_${year}_bk.pdf`,
        forceRefresh: options?.force,
      })
      console.log(`  山东选科要求：本科 PDF 大小 ${bkResult.buffer.length} bytes`)

      const bkText = await parsePdf(bkResult.buffer)
      console.log(`  山东选科要求：本科 PDF 文本长度 ${bkText.length}`)

      const bkRecords = parseSdSubjects(bkText, SD_SUBJECTS_PAGE_URL, '本科')
      console.log(`  山东选科要求：本科解析到 ${bkRecords.length} 条记录`)
      records.push(...bkRecords)
    } catch (error) {
      failed.push({
        url: SD_SUBJECTS_BK_URL,
        error: (error as Error).message,
        retryCount: 3,
        context: `山东选科要求（本科）${year}`,
      })
    }

    // 下载并解析专科 PDF
    try {
      console.log('  山东选科要求：下载专科 PDF...')
      const zkResult = await client.fetchBinary(SD_SUBJECTS_ZK_URL, {
        cacheKey: `sd_subjects_${year}_zk.pdf`,
        forceRefresh: options?.force,
      })
      console.log(`  山东选科要求：专科 PDF 大小 ${zkResult.buffer.length} bytes`)

      const zkText = await parsePdf(zkResult.buffer)
      console.log(`  山东选科要求：专科 PDF 文本长度 ${zkText.length}`)

      const zkRecords = parseSdSubjects(zkText, SD_SUBJECTS_PAGE_URL, '专科')
      console.log(`  山东选科要求：专科解析到 ${zkRecords.length} 条记录`)
      records.push(...zkRecords)
    } catch (error) {
      failed.push({
        url: SD_SUBJECTS_ZK_URL,
        error: (error as Error).message,
        retryCount: 3,
        context: `山东选科要求（专科）${year}`,
      })
    }

    console.log(
      `  山东选科要求完成：共 ${records.length} 条记录，${failed.length} 个失败`
    )

    return { records, failed }
  },
}
