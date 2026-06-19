import type { SubjectQuestion } from '../types'

export async function loadSubjectQuestions(): Promise<SubjectQuestion[]> {
  try {
    const response = await fetch('/data/assessment/subject_15.json')
    if (!response.ok) return []
    return await response.json()
  } catch {
    return []
  }
}

export function calculateSubjectScores(
  answers: Record<number, number>,
  questions: SubjectQuestion[]
): {
  subjectScores: Record<string, number>
  behaviorScores: Record<string, number>
  topSubjects: string[]
} {
  const subjectScores: Record<string, number> = {}
  const behaviorScores: Record<string, number> = {}

  for (const q of questions) {
    const score = answers[q.id] || 0
    if (q.type === 'subject') {
      subjectScores[q.dimension] = (subjectScores[q.dimension] || 0) + score
    } else {
      behaviorScores[q.dimension] = (behaviorScores[q.dimension] || 0) + score
    }
  }

  const sorted = Object.entries(subjectScores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  return {
    subjectScores,
    behaviorScores,
    topSubjects: sorted.slice(0, 3).map(([key]) => key),
  }
}
