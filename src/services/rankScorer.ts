import { HOLLAND_TO_SUBJECTS } from '../features/assessment/services/resultIntegrator'
import type { SubjectMajorMapping } from '../features/assessment/types'

export interface RecommendWeights {
  probability: number
  collegeLevel: number
  majorInterest: number
  region: number
  tuition: number
  employment: number
}

export const DEFAULT_WEIGHTS: RecommendWeights = {
  probability: 30,
  collegeLevel: 25,
  majorInterest: 20,
  region: 15,
  tuition: 5,
  employment: 5,
}

export interface AssessmentInput {
  hollandCategories: string[]
  subjectCategories: string[]
  mbtiCategories: string[]
}

export interface CandidateInput {
  probability: number
  collegeLevel: number
  majorCategory: string
  collegeProvince: string
  tuition: number
  employmentScore: number
}

export interface ProfileInput {
  regions: string[]
  maxTuition: number | null
}

export const EMPLOYMENT_SCORE_MAP: Record<string, number> = {
  '哲学': 40,
  '经济学': 75,
  '法学': 70,
  '教育学': 65,
  '文学': 55,
  '历史学': 40,
  '理学': 60,
  '工学': 85,
  '农学': 50,
  '医学': 80,
  '管理学': 75,
  '艺术学': 50,
}

// 占位，将在后续 Task 实现
export function scoreCandidate(
  _candidate: CandidateInput,
  _weights: RecommendWeights,
  _assessment: AssessmentInput,
  _profile: ProfileInput
): number {
  return 0
}

export function deriveHollandCategories(
  _hollandCode?: string,
  _majorMapping: SubjectMajorMapping = {}
): string[] {
  return []
}
