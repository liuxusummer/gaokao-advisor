import axios from 'axios'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, FailedRecord } from '../../types'
import { parseGdSubjects } from '../guangdong'
import { GAOKAO_QPS } from '../../config'

// 真实数据：广东省教育考试院 eeagd.edu.cn
// 选科要求通过在线查询系统提供，使用 API 遍历所有院校
// 1. POST 调用 GetYxxxServlet 获取所有院校列表（JSON）
// 2. 遍历每个院校的 xxdetail.jsp 获取选科要求详情（HTML）
const GD_SUBJECTS_BASE_URL = 'https://www.eeagd.edu.cn/xkcx2024'
const GD_SUBJECTS_LIST_API = `${GD_SUBJECTS_BASE_URL}/GetYxxxServlet`
const GD_SUBJECTS_DETAIL_URL = `${GD_SUBJECTS_BASE_URL}/xxdetail.jsp`

interface GdCollege {
  yxdm: string // 院校代码
  yxmc: string // 院校名称
  ssmc: string // 省市名称
  zswz: string // 招生网址
}

export const guangdongSubjectScraper: SubjectScraper = {
  province: '广东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    try {
      // Step 1: 通过 POST 请求获取所有院校列表
      const response = await axios.post(
        GD_SUBJECTS_LIST_API,
        new URLSearchParams({
          ssdm: '',
          sxkm: '',
          kskms: '',
          xkml: '',
          qttj: '',
          cxtj: '',
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': GD_SUBJECTS_BASE_URL + '/',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 30000,
        }
      )

      const colleges: GdCollege[] = response.data?.yxs || []

      if (colleges.length === 0) {
        failed.push({
          url: GD_SUBJECTS_LIST_API,
          error: '院校列表为空',
          retryCount: 3,
          context: `广东选科要求 ${year}`,
        })
        return { records, failed }
      }

      console.log(`  广东选科要求：共 ${colleges.length} 所院校待处理`)

      // Step 2: 遍历每个院校获取详情
      const requestInterval = 1000 / GAOKAO_QPS
      let processed = 0
      let failedCount = 0

      for (const college of colleges) {
        const detailUrl = `${GD_SUBJECTS_DETAIL_URL}?yxdm=${college.yxdm}&yxmc=${encodeURIComponent(college.yxmc)}&sxkm=&kskms=&qttj=&cxtj=&xkml=`

        try {
          const result = await client.fetch(detailUrl, {
            cacheKey: `gd_subjects_${year}_${college.yxdm}.html`,
            forceRefresh: options?.force,
            headers: {
              'Referer': GD_SUBJECTS_BASE_URL + '/',
            },
          })

          const parsed = parseGdSubjects(
            result.html,
            college.yxdm,
            college.yxmc,
            GD_SUBJECTS_BASE_URL
          )
          records.push(...parsed)

          processed++
          if (processed % 100 === 0) {
            console.log(
              `  广东选科要求进度: ${processed}/${colleges.length} (已采集 ${records.length} 条)`
            )
          }

          if (!result.fromCache) {
            await new Promise((resolve) => setTimeout(resolve, requestInterval))
          }
        } catch (error) {
          failedCount++
          failed.push({
            url: detailUrl,
            error: (error as Error).message,
            retryCount: 0,
            context: `广东 ${college.yxmc}`,
          })
          // 连续失败太多则停止
          if (failedCount > 50 && failedCount > processed * 0.5) {
            console.log(
              `  广东选科要求：失败率过高，停止采集（已处理 ${processed}，失败 ${failedCount}）`
            )
            break
          }
        }
      }

      console.log(
        `  广东选科要求完成：处理 ${processed}/${colleges.length} 所院校，采集 ${records.length} 条记录`
      )
    } catch (error) {
      failed.push({
        url: GD_SUBJECTS_LIST_API,
        error: (error as Error).message,
        retryCount: 3,
        context: `广东选科要求 ${year}`,
      })
    }

    return { records, failed }
  },
}
