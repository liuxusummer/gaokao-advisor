// 院校记录（最终产出格式）
export interface CollegeRecord {
  id: string
  moeCode: string
  name: string
  aliases?: string[]

  province: string
  city: string
  level: string[]
  type: string
  nature: 'public' | 'private' | 'joint'
  affiliation: string

  officialWebsite: string
  gaokaoUrl: string
  admissionUrl?: string

  subjectCategories?: string[]
  majorCount?: number

  _meta: RecordMeta
}

export interface RecordMeta {
  source: 'moe_list' | 'gaokao' | 'merged'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

// 教育部名单原始记录
export interface MoeRecord {
  id: string
  name: string
  province: string
  city: string
  level: string
  nature: 'public' | 'private' | 'joint'
  affiliation: string
  sourceUrl: string
}

// 阳光高考原始记录
export interface GaokaoRecord {
  gaokaoId: string
  name: string
  officialWebsite: string
  gaokaoUrl: string
  admissionUrl?: string
  province: string
  sourceUrl: string
}

// 采集元信息
export interface CollegesMeta {
  totalCount: number
  publicCount: number
  privateCount: number
  byProvince: Record<string, number>
  byLevel: Record<string, number>
  generatedAt: string
  scraperVersion: string
  sources: Array<{
    name: string
    url: string
    fetchedAt: string
    recordCount: number
  }>
  schemaVersion: string
}

// 错误报告
export interface FailedRecord {
  url: string
  error: string
  retryCount: number
  context?: string
}

export interface WarningRecord {
  collegeId: string
  collegeName: string
  type: 'missing_website' | 'province_mismatch' | 'name_match_failed'
  detail: string
}

export interface RejectedRecord {
  record: Partial<CollegeRecord>
  reason: string
}

// HTTP 客户端类型
export interface FetchOptions {
  cacheKey?: string
  forceRefresh?: boolean
  timeout?: number
  rateLimit?: { perSecond: number }
  headers?: Record<string, string>
}

export interface FetchResult {
  html: string
  fromCache: boolean
  fetchedAt: string
  url: string
}

export interface FetchBinaryResult {
  buffer: Buffer
  fromCache: boolean
  fetchedAt: string
  url: string
}

// === 分数线采集类型 ===

export interface TieBreakers {
  chineseMathSum?: number       // (一) 语数成绩之和
  chineseMathMax?: number       // (二) 语数最高成绩
  foreignLanguage?: number      // (三) 外语成绩
  preferredSubject?: number     // (四) 首选科目成绩（物理/历史）
  reselectSubjectMax?: number   // (五) 再选科目最高成绩
  volunteerOrder?: number       // (六) 志愿号
}

export interface ScoreRecord {
  collegeId: string
  collegeName: string
  year: number
  majorName: string
  majorCode?: string
  majorGroup?: string
  majorGroupName?: string
  province: string
  category: string
  batch: string
  minScore: number
  minRank: number
  avgScore?: number
  maxScore?: number
  planCount?: number
  actualCount?: number
  tieBreakers?: TieBreakers
  _meta: ScoreRecordMeta
}

export interface ScoreRecordMeta {
  source: 'gaokao' | 'zjzs' | 'jseea'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

// === 一分一段表采集类型 ===

export interface RankTableRecord {
  province: string
  year: number
  category: string
  score: number
  rank: number
  count: number
  cumulativeCount: number
  _meta: RankTableRecordMeta
}

export interface RankTableRecordMeta {
  source: 'zjzs' | 'jseea'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

export interface RankTableFile {
  province: string
  year: number
  categories: Record<string, RankTableRecord[]>
  _meta: {
    generatedAt: string
    scraperVersion: string
    source: string
    sourceUrl: string
    recordCount: number
  }
}

// === 分数线采集元信息 ===

export interface ScoresMeta {
  provinces: Array<{
    name: string
    years: number[]
    scoreRecordCount: Record<number, number>
    rankTableRecordCount: Record<number, number>
  }>
  generatedAt: string
  scraperVersion: string
  schemaVersion: string
  sources: Array<{
    name: string
    url: string
    coverage: string
  }>
}

// === 校验结果 ===

export interface ScoreValidationResult {
  valid: boolean
  reason?: string
}

export interface RankTableValidationResult {
  valid: boolean
  reason?: string
}

// 扩展 WarningRecord 以支持分数线场景
export interface ScoreWarningRecord {
  collegeId: string
  collegeName: string
  type: 'missing_data' | 'parse_error' | 'year_missing'
  detail: string
}

// === 专业目录 ===

export interface MajorCatalogRecord {
  majorCode: string         // 专业代码，如 "080901"（含 K/T 后缀，如 "080910TK"）
  majorName: string         // 专业名称，如 "计算机科学与技术"
  category: string          // 学科门类，如 "工学"（13 个门类）
  subCategory: string       // 专业类，如 "计算机类"（93 个专业类）
  degreeType: string        // 学位类型，如 "工学学士"（部分专业可能为空）
  duration: string          // 学制，如 "四年"（部分专业可能为空）
  notes?: string            // 备注，如 "国家控制布点专业"
  _meta: CatalogMeta
}

export interface CatalogMeta {
  source: 'moe'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

// === 选科要求 ===

export interface SubjectRequirementRecord {
  collegeId: string
  collegeName: string
  province: string          // "浙江" | "江苏"
  year: number              // 2024
  level: string             // "本科" | "专科"
  majorName: string
  majorCode?: string
  subjectRequirement: string
  requirementType: RequirementType
  requiredSubjects: string[]
  subMajors?: string[]
  majorGroup?: string
  majorGroupName?: string
  _meta: SubjectMeta
}

export type RequirementType =
  | 'none'
  | 'one_required'
  | 'two_required'
  | 'three_required'
  | 'any_of_two'
  | 'any_of_three'
  | 'unknown'

export interface SubjectMeta {
  source: 'zjzs' | 'jseea'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}
