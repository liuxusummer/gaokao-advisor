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

export function scoreCandidate(
  candidate: CandidateInput,
  weights: RecommendWeights,
  assessment: AssessmentInput,
  profile: ProfileInput
): number {
  // 权重归一化：全设 0 时回退到 DEFAULT_WEIGHTS
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
  const effectiveWeights = weightSum === 0 ? DEFAULT_WEIGHTS : weights
  const totalWeight = weightSum === 0 ? 100 : weightSum

  // 1. probability 得分（0-100）
  const probabilityScore = candidate.probability

  // 2. collegeLevel 得分（0-100）
  const collegeLevelScore = (candidate.collegeLevel / 3) * 100

  // 3. majorInterest 得分（0-100）
  let majorInterestScore: number
  const hollandMatch = assessment.hollandCategories.includes(candidate.majorCategory) ? 1 : 0
  const subjectMatch = assessment.subjectCategories.includes(candidate.majorCategory) ? 1 : 0
  const mbtiMatch = assessment.mbtiCategories.includes(candidate.majorCategory) ? 1 : 0
  const assessmentEmpty =
    assessment.hollandCategories.length === 0 &&
    assessment.subjectCategories.length === 0 &&
    assessment.mbtiCategories.length === 0
  if (assessmentEmpty) {
    majorInterestScore = 50
  } else {
    majorInterestScore = ((hollandMatch + subjectMatch + mbtiMatch) / 3) * 100
  }

  // 4. region 得分（0-100）
  const regionScore =
    profile.regions.length === 0
      ? 50
      : profile.regions.includes(candidate.collegeProvince)
        ? 100
        : 0

  // 5. tuition 得分（0-100）
  const tuitionScore =
    profile.maxTuition === null
      ? 50
      : Math.max(0, 100 * (1 - candidate.tuition / profile.maxTuition))

  // 6. employment 得分（0-100）
  const employmentScore = candidate.employmentScore

  // 加权平均
  const weightedSum =
    probabilityScore * effectiveWeights.probability +
    collegeLevelScore * effectiveWeights.collegeLevel +
    majorInterestScore * effectiveWeights.majorInterest +
    regionScore * effectiveWeights.region +
    tuitionScore * effectiveWeights.tuition +
    employmentScore * effectiveWeights.employment

  return weightedSum / totalWeight
}

export function deriveHollandCategories(
  _hollandCode?: string,
  _majorMapping: SubjectMajorMapping = {}
): string[] {
  return []
}
