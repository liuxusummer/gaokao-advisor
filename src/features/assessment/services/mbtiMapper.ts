import type { MbtiMappingRecord } from '../types'
import { publicPath } from '../../../utils/publicPath'

export async function loadMbtiMapping(): Promise<MbtiMappingRecord | null> {
  try {
    const response = await fetch(publicPath('/data/assessment/mbti_category_mapping.json'))
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export function getMbtiCategories(
  mbtiType: string | null,
  mapping: MbtiMappingRecord | null
): string[] {
  if (!mbtiType || !mapping) return []
  return mapping[mbtiType]?.categories ?? []
}
