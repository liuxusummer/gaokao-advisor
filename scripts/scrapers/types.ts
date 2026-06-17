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
