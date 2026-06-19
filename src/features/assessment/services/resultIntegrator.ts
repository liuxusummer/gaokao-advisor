import type { IntegratedAssessment, SubjectAssessmentResult, SubjectMajorMapping, HollandDimension } from '../types'

const HOLLAND_TO_SUBJECTS: Record<string, string[]> = {
  R: ['physics', 'computer'],
  I: ['math', 'biology', 'chemistry', 'computer'],
  A: ['art', 'chinese'],
  S: ['politics', 'chinese'],
  E: ['economics', 'foreign_lang'],
  C: ['computer', 'economics'],
}

export function integrateResults(
  hollandScores: Record<string, number>,
  subjectResult: SubjectAssessmentResult,
  majorMapping: SubjectMajorMapping
): IntegratedAssessment {
  const dimensions: HollandDimension[] = ['R', 'I', 'A', 'S', 'E', 'C']
  const sortedDims = dimensions.slice().sort((a, b) => {
    if (hollandScores[b] !== hollandScores[a]) return hollandScores[b] - hollandScores[a]
    return a.localeCompare(b)
  })
  const hollandCode = sortedDims.slice(0, 3).join('')

  const hollandSubjects = new Set<string>()
  for (const dim of hollandCode) {
    const subjects = HOLLAND_TO_SUBJECTS[dim]
    if (subjects) {
      subjects.forEach((s) => hollandSubjects.add(s))
    }
  }

  const hollandCategories = new Set<string>()
  for (const subject of hollandSubjects) {
    const majors = majorMapping[subject]
    if (majors) {
      majors.forEach((m) => hollandCategories.add(m))
    }
  }

  const subjectCategories = new Set(subjectResult.recommendedCategories)
  const agreedCategories = Array.from(hollandCategories).filter((c) => subjectCategories.has(c))

  let confidence: 'high' | 'medium' | 'low'
  if (agreedCategories.length >= 3) {
    confidence = 'high'
  } else if (agreedCategories.length >= 1) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  return {
    hollandCode,
    topSubjects: subjectResult.topSubjects,
    agreedCategories,
    confidence,
    timestamp: Date.now(),
  }
}
