import { SCRAPER_VERSION, MAJOR_DETAIL_API_BASE } from '../../config.js'
import type { MajorDetailResponse } from './types.js'
import type { DetailedMajorRecord } from '../../types.js'

/**
 * 从专业介绍文本中提取主干课程信息（best-effort）
 */
export function extractMainCourses(desc: string): string {
  if (!desc) return ''
  const match = desc.match(/(?:主干|主要|核心)课程[：:]\s*(.+?)(?:。|$)/)
  return match ? match[1].trim() : ''
}

export function parseDetail(
  detail: MajorDetailResponse,
  categoryName: string,
  subCategoryName: string,
  educationLevel: string,
): DetailedMajorRecord {
  const introduction = detail.zyjs?.desc ?? ''
  const mainCourses = extractMainCourses(introduction)

  const careerDirections = (detail.jyfxInfo?.jyfxList ?? []).map((item) => item.jyfx)

  const satisfaction = detail.zymyd.map((item) => ({
    type: item.type,
    typeDesc: item.typeDesc,
    rank: item.rank,
    count: item.count,
  }))

  const graduateMajors = detail.kyfx.map((item) => ({
    majorCode: item.zydm,
    majorName: item.zymc,
  }))

  const recommendedColleges = detail.zytjzsList.slice(0, 10).map((item) => ({
    collegeName: item.yxmc,
    count: item.count,
    rank: item.rank,
  }))

  const similarMajors = detail.simileZyList.map((item) => ({
    majorCode: item.zydm,
    majorName: item.zymc,
  }))

  return {
    majorCode: detail.zydm,
    majorName: detail.zymc,
    category: categoryName,
    subCategory: subCategoryName,
    educationLevel,
    introduction,
    careerDirections,
    mainCourses,
    durationAndDegree: {
      studentScale: detail.xsgm,
      boyPercent: detail.boyPercent,
      girlPercent: detail.girlPercent,
      year: detail.year,
    },
    satisfaction,
    graduateMajors,
    recommendedColleges,
    similarMajors,
    specId: detail.specId,
    _meta: {
      source: 'gaokao_chsi',
      sourceUrl: `${MAJOR_DETAIL_API_BASE}/detail/${detail.specId}`,
      fetchedAt: new Date().toISOString(),
      scraperVersion: SCRAPER_VERSION,
      verified: true,
    },
  }
}
