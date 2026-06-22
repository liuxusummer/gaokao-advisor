import { hollandQuestions } from '../../../data/mock'
import type { HollandResult, HollandDimension } from '../types'

const DIMENSIONS: HollandDimension[] = ['R', 'I', 'A', 'S', 'E', 'C']

interface Question {
  id: number
  text: string
  dimension: string
}

export function calculateHolland(
  answers: Record<number, number>,
  questions: Question[] = hollandQuestions
): HollandResult {
  const scores: Record<HollandDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }

  questions.forEach((q) => {
    const dim = q.dimension as HollandDimension
    if (DIMENSIONS.includes(dim)) {
      scores[dim] += answers[q.id] || 0
    }
  })

  const sorted = DIMENSIONS.slice().sort((a, b) => {
    if (scores[b] !== scores[a]) return scores[b] - scores[a]
    return a.localeCompare(b)
  })

  return {
    scores,
    code: sorted.slice(0, 3).join(''),
  }
}
