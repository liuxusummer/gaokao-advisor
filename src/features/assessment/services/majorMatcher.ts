import type { SubjectMajorMapping } from '../types'
import { publicPath } from '../../../utils/publicPath'

export async function loadMajorMapping(): Promise<SubjectMajorMapping> {
  try {
    const response = await fetch(publicPath('/data/assessment/subject_major_mapping.json'))
    if (!response.ok) return {}
    return await response.json()
  } catch {
    return {}
  }
}

export function matchMajors(topSubjects: string[], mapping: SubjectMajorMapping): string[] {
  const categories = new Set<string>()
  for (const subject of topSubjects) {
    const majors = mapping[subject]
    if (majors) {
      majors.forEach((m) => categories.add(m))
    }
  }
  return Array.from(categories)
}
