import type { HttpClient } from '../../shared/http.js'
import { GAOKAO_QPS } from '../../config.js'
import { fetchCategories, fetchSubcategories, fetchMajors, fetchMajorDetail } from './api.js'
import { parseDetail } from './parse.js'
import { validateDetailedRecord } from './validate.js'
import type { DetailedMajorRecord } from '../../types.js'

export interface FailedMajor {
  specId: string
  majorName: string
  reason: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function crawlCatalog(
  client: HttpClient,
  rootKey: string,
  educationLevel: string,
  onProgress?: (current: number, total: number, majorName: string) => void,
): Promise<{ records: DetailedMajorRecord[]; failed: FailedMajor[] }> {
  const records: DetailedMajorRecord[] = []
  const failed: FailedMajor[] = []

  // Step 1: 门类
  const categories = await fetchCategories(client, rootKey)

  for (const cat of categories) {
    // Step 2: 专业类
    const subcats = await fetchSubcategories(client, cat.key)

    for (const subcat of subcats) {
      // Step 3: 专业列表
      const majors = await fetchMajors(client, subcat.key)

      let current = 0
      for (const major of majors) {
        current++
        try {
          // Step 4: 专业详情
          const detail = await fetchMajorDetail(client, major.specId)
          const record = parseDetail(detail, cat.name, subcat.name, educationLevel)
          const validation = validateDetailedRecord(record)
          if (validation.valid) {
            records.push(record)
          } else {
            failed.push({
              specId: major.specId,
              majorName: major.zymc,
              reason: `校验失败: ${validation.reason}`,
            })
          }
        } catch (err) {
          failed.push({
            specId: major.specId,
            majorName: major.zymc,
            reason: err instanceof Error ? err.message : String(err),
          })
        }

        if (onProgress) {
          onProgress(current, majors.length, major.zymc)
        }

        await sleep(1000 / GAOKAO_QPS)
      }
    }
  }

  return { records, failed }
}
