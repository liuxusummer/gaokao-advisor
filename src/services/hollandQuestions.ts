import { hollandQuestions as fallbackQuestions } from '../data/mock'
import { publicPath } from '../utils/publicPath'

export interface HollandQuestion {
  id: number
  text: string
  dimension: string
}

const QUESTION_URL = publicPath('/data/assessment/holland_60.json')
let cachedQuestions: HollandQuestion[] | null = null

function isValidQuestions(data: unknown): data is HollandQuestion[] {
  if (!Array.isArray(data)) return false
  if (data.length < 12) return false
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'number' &&
      typeof item.text === 'string' &&
      typeof item.dimension === 'string'
  )
}

/**
 * 加载霍兰德题库（60 题）
 * fetch 失败时降级到 mock.ts 的 12 题
 */
export async function loadHollandQuestions(): Promise<HollandQuestion[]> {
  if (cachedQuestions) return cachedQuestions

  try {
    const response = await fetch(QUESTION_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (!isValidQuestions(data)) throw new Error('Invalid questions format')
    cachedQuestions = data
    return data
  } catch {
    return fallbackQuestions
  }
}
