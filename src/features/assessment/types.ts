export interface SubjectQuestion {
  id: number
  text: string
  dimension: string
  type: 'subject' | 'behavior'
}

export interface SubjectMajorMapping {
  [subjectKey: string]: string[]
}

export interface SubjectAssessmentResult {
  subjectScores: Record<string, number>
  behaviorScores: Record<string, number>
  topSubjects: string[]
  recommendedCategories: string[]
  timestamp: number
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface IntegratedAssessment {
  hollandCode: string
  topSubjects: string[]
  agreedCategories: string[]
  confidence: ConfidenceLevel
  mbtiType: string | null
  mbtiCategories: string[]
  timestamp: number
}

export type HollandDimension = 'R' | 'I' | 'A' | 'S' | 'E' | 'C'

export interface HollandResult {
  scores: Record<HollandDimension, number>
  code: string
}

export interface MbtiMapping {
  name: string
  categories: string[]
  description: string
}

export type MbtiMappingRecord = Record<string, MbtiMapping>
