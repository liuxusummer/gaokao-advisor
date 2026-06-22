import type { College, Major, ScoreRecord } from '../data/mock'

export interface RealDataCache {
  colleges: College[]
  majors: Major[]
  scoreRecords: ScoreRecord[]
  subjectRequirements: Map<string, SubjectRequirement>
  rankTable: RankTableEntry[]
  province: string
  loadedAt: number
}

export interface SubjectRequirement {
  collegeId: string
  collegeName: string
  majorName: string
  requirementType: 'none' | 'one_required' | 'two_required' | 'other'
  requiredSubjects: string[]
  rawText: string
}

export interface RankTableEntry {
  province: string
  year: number
  category: string
  score: number
  rank: number
  count: number
  cumulativeCount: number
}

export interface RawCollege {
  id: string
  moeCode: string
  name: string
  province: string
  city: string
  level: string[]
  type: string
  nature: string
  affiliation?: string
  officialWebsite?: string
  gaokaoUrl?: string
  admissionUrl?: string
}

export interface RawMajor {
  majorCode: string
  majorName: string
  category: string
  subCategory: string
  degreeType?: string
  duration?: string
  educationLevel?: string
}

export interface RawScoreRecord {
  collegeId: string
  collegeName: string
  year: number
  majorName: string
  majorCode: string
  province: string
  category: string
  batch: string
  minScore: number
  minRank: number
  planCount: number
}

export interface RawSubjectRecord {
  collegeId: string
  collegeName: string
  province: string
  year: number
  level: string
  majorName: string
  subjectRequirement: string
  requirementType: string
  requiredSubjects: string[]
  subMajors: string[]
}

export interface RawRankTable {
  province: string
  year: number
  categories: Record<string, RawRankTableEntry[]>
}

export interface RawRankTableEntry {
  province: string
  year: number
  category: string
  score: number
  rank: number
  count: number
  cumulativeCount: number
}

// 985/211/双一流 院校标识码映射（基于教育部全国高等学校名单）
// 由于爬取的高校名单未包含建设项目标签，使用静态映射补充；后续可随名单更新扩展
const COLLEGE_TAG_MAP: Record<string, string[]> = {
  // 北京 985
  '4111010001': ['985', '211', '双一流'],
  '4111010002': ['985', '211', '双一流'],
  '4111010003': ['985', '211', '双一流'],
  '4111010006': ['985', '211', '双一流'],
  '4111010007': ['985', '211', '双一流'],
  '4111010019': ['985', '211', '双一流'],
  '4111020027': ['985', '211', '双一流'],
  '4111010080': ['985', '211', '双一流'],
  // 北京 211 / 双一流
  '4111010004': ['211', '双一流'],
  '4111010005': ['211', '双一流'],
  '4111010008': ['211', '双一流'],
  '4111010010': ['211', '双一流'],
  '4111010013': ['211', '双一流'],
  '4111020022': ['211', '双一流'],
  '4111020026': ['211', '双一流'],
  '4111020030': ['211', '双一流'],
  '4111020033': ['211', '双一流'],
  '4111020034': ['211', '双一流'],
  '4111020036': ['211', '双一流'],
  '4111020053': ['211', '双一流'],
  '4111010054': ['211', '双一流'],
  '4111014430': ['双一流'],
  // 天津
  '4112010055': ['985', '211', '双一流'],
  '4112010056': ['985', '211', '双一流'],
  '4112010062': ['211', '双一流'],
  '4112010058': ['双一流'],
  // 河北
  '4113010080': ['211', '双一流'],
  // 山西
  '4114010124': ['211', '双一流'],
  '4114010108': ['双一流'],
  // 内蒙古
  '4115010126': ['211', '双一流'],
  // 辽宁
  '4121010141': ['985', '211', '双一流'],
  '4121010145': ['985', '211', '双一流'],
  '4121010151': ['211', '双一流'],
  '4121010265': ['双一流'],
  // 吉林
  '4122010183': ['985', '211', '双一流'],
  '4122010184': ['211', '双一流'],
  '4122010200': ['211', '双一流'],
  // 黑龙江
  '4123010213': ['985', '211', '双一流'],
  '4123010217': ['211', '双一流'],
  '4123010224': ['211', '双一流'],
  '4123010226': ['211', '双一流'],
  // 上海 985
  '4131010246': ['985', '211', '双一流'],
  '4131010247': ['985', '211', '双一流'],
  '4131024848': ['985', '211', '双一流'],
  '4131010269': ['985', '211', '双一流'],
  // 上海 211 / 双一流
  '4131010248': ['211', '双一流'],
  '4131010251': ['211', '双一流'],
  '4131027156': ['211', '双一流'],
  '4131025662': ['211', '双一流'],
  '4131028040': ['211', '双一流'],
  '4131014423': ['双一流'],
  // 江苏 985
  '4132010284': ['985', '211', '双一流'],
  '4132010286': ['985', '211', '双一流'],
  // 江苏 211 / 双一流
  '4132010290': ['211', '双一流'],
  '4132010285': ['211', '双一流'],
  '4132010287': ['211', '双一流'],
  '4132010288': ['211', '双一流'],
  '4132010294': ['211', '双一流'],
  '4132010295': ['211', '双一流'],
  '4132010307': ['211', '双一流'],
  '4132010309': ['211', '双一流'],
  '4132010319': ['211', '双一流'],
  '4132010293': ['双一流'],
  '4132010300': ['双一流'],
  '4132010298': ['双一流'],
  '4132010315': ['双一流'],
  // 浙江
  '4133010335': ['985', '211', '双一流'],
  '4133010355': ['双一流'],
  '4133011646': ['双一流'],
  // 安徽
  '4134010357': ['211', '双一流'],
  '4134010358': ['985', '211', '双一流'],
  '4134010359': ['211', '双一流'],
  '4134010361': ['双一流'],
  // 福建
  '4135010384': ['985', '211', '双一流'],
  '4135010386': ['211', '双一流'],
  // 江西
  '4136010403': ['211', '双一流'],
  // 山东
  '4137010422': ['985', '211', '双一流'],
  '4137010423': ['985', '211', '双一流'],
  '4137010425': ['211', '双一流'],
  // 河南
  '4141010459': ['211', '双一流'],
  '4141010475': ['双一流'],
  // 湖北 985
  '4142010486': ['985', '211', '双一流'],
  '4142010487': ['985', '211', '双一流'],
  // 湖北 211 / 双一流
  '4142010491': ['211', '双一流'],
  '4142010497': ['211', '双一流'],
  '4142010504': ['211', '双一流'],
  '4142010511': ['211', '双一流'],
  '4142010520': ['211', '双一流'],
  // 湖南
  '4143010533': ['985', '211', '双一流'],
  '4143010534': ['985', '211', '双一流'],
  '4143010542': ['211', '双一流'],
  '4143010530': ['双一流'],
  // 广东 985
  '4144010558': ['985', '211', '双一流'],
  '4144010561': ['985', '211', '双一流'],
  // 广东 211 / 双一流
  '4144010559': ['211', '双一流'],
  '4144010574': ['211', '双一流'],
  '4144010564': ['双一流'],
  '4144010570': ['双一流'],
  '4144011059': ['双一流'],
  // 广西
  '4145010593': ['211', '双一流'],
  // 海南
  '4146010589': ['211', '双一流'],
  // 重庆
  '4150010611': ['985', '211', '双一流'],
  '4150010635': ['211', '双一流'],
  // 四川 985
  '4151010610': ['985', '211', '双一流'],
  '4151010651': ['985', '211', '双一流'],
  // 四川 211 / 双一流
  '4151010613': ['211', '双一流'],
  '4151010626': ['211', '双一流'],
  '4151010674': ['双一流'],
  // 贵州
  '4152010657': ['211', '双一流'],
  // 云南
  '4153010673': ['211', '双一流'],
  // 西藏
  '4154010694': ['211', '双一流'],
  // 陕西 985
  '4161010698': ['985', '211', '双一流'],
  '4161010699': ['985', '211', '双一流'],
  '4161010712': ['985', '211', '双一流'],
  // 陕西 211 / 双一流
  '4161010697': ['211', '双一流'],
  '4161010701': ['211', '双一流'],
  '4161010710': ['211', '双一流'],
  '4161010718': ['211', '双一流'],
  // 甘肃
  '4162010730': ['985', '211', '双一流'],
  // 青海
  '4163010743': ['211', '双一流'],
  // 宁夏
  '4164010749': ['211', '双一流'],
  // 新疆
  '4165010755': ['211', '双一流'],
  '4165010759': ['211', '双一流'],
}

const PROVINCE_NAME_MAP: Record<string, string> = {
  zhejiang: '浙江',
  jiangsu: '江苏',
  shandong: '山东',
  hebei: '河北',
  liaoning: '辽宁',
  hubei: '湖北',
  hunan: '湖南',
  guangdong: '广东',
  beijing: '北京',
  shanghai: '上海',
}

const KNOWN_REAL_PROVINCES = new Set([
  'zhejiang', 'jiangsu', 'shandong', 'hebei', 'liaoning',
  'hubei', 'hunan', 'guangdong', 'beijing', 'shanghai'
])

export function isRealDataAvailable(provinceId: string): boolean {
  return KNOWN_REAL_PROVINCES.has(provinceId)
}

export function getProvinceName(provinceId: string): string | undefined {
  return PROVINCE_NAME_MAP[provinceId]
}

let globalColleges: College[] | null = null
let globalMajors: Major[] | null = null

export async function loadColleges(): Promise<College[]> {
  if (globalColleges) return globalColleges
  const res = await fetch('/data/common/colleges.json')
  if (!res.ok) throw new Error(`Failed to load colleges: ${res.status}`)
  const raw: RawCollege[] = await res.json()
  globalColleges = raw.map(transformCollege)
  return globalColleges
}

export async function loadMajors(): Promise<Major[]> {
  if (globalMajors) return globalMajors
  const res = await fetch('/data/common/majors/catalog.json')
  if (!res.ok) throw new Error(`Failed to load majors: ${res.status}`)
  const raw: RawMajor[] = await res.json()
  globalMajors = raw.map(transformMajor)
  return globalMajors
}

export async function loadProvinceData(provinceId: string): Promise<RealDataCache> {
  const provinceName = getProvinceName(provinceId)
  if (!provinceName) throw new Error(`Unknown province: ${provinceId}`)

  const [colleges, majors] = await Promise.all([loadColleges(), loadMajors()])

  const targetYears = [2024, 2023, 2025]
  const [scoreRecordsByYear, subjectRequirements, rankTable] = await Promise.all([
    Promise.all(targetYears.map((year) => loadScores(provinceName, year).catch(() => [] as ScoreRecord[]))),
    loadSubjects(provinceName, 2024),
    loadRankTable(provinceName, 2024),
  ])
  const scoreRecords = scoreRecordsByYear.flat()

  return {
    colleges,
    majors,
    scoreRecords,
    subjectRequirements,
    rankTable,
    province: provinceId,
    loadedAt: Date.now(),
  }
}

export async function loadScores(provinceName: string, year: number): Promise<ScoreRecord[]> {
  const res = await fetch(`/data/scores/${encodeURIComponent(provinceName)}/scores_${year}.json`)
  if (!res.ok) throw new Error(`Failed to load scores for ${provinceName} ${year}: ${res.status}`)
  const raw: RawScoreRecord[] = await res.json()
  return raw.map(transformScoreRecord)
}

export async function loadSubjects(provinceName: string, year: number): Promise<Map<string, SubjectRequirement>> {
  const res = await fetch(`/data/subjects/${encodeURIComponent(provinceName)}/subjects_${year}.json`)
  if (!res.ok) throw new Error(`Failed to load subjects for ${provinceName} ${year}: ${res.status}`)
  const raw: RawSubjectRecord[] = await res.json()
  const map = new Map<string, SubjectRequirement>()
  for (const r of raw) {
    const key = `${r.collegeId}-${r.majorName}`
    map.set(key, transformSubjectRecord(r))
  }
  return map
}

export async function loadRankTable(provinceName: string, year: number): Promise<RankTableEntry[]> {
  const res = await fetch(`/data/scores/${encodeURIComponent(provinceName)}/rank_table_${year}.json`)
  if (!res.ok) throw new Error(`Failed to load rank table for ${provinceName} ${year}: ${res.status}`)
  const raw: RawRankTable = await res.json()
  const entries: RankTableEntry[] = []
  for (const category of Object.keys(raw.categories)) {
    for (const e of raw.categories[category]) {
      entries.push({
        province: e.province,
        year: e.year,
        category: e.category,
        score: e.score,
        rank: e.rank,
        count: e.count,
        cumulativeCount: e.cumulativeCount,
      })
    }
  }
  return entries
}

function transformCollege(raw: RawCollege): College {
  return {
    id: raw.id,
    name: raw.name,
    province: raw.province,
    city: raw.city,
    level: raw.level,
    type: raw.type,
    nature: raw.nature,
    affiliation: raw.affiliation,
    website: raw.officialWebsite,
    gaokaoUrl: raw.gaokaoUrl,
    admissionUrl: raw.admissionUrl,
    tags: COLLEGE_TAG_MAP[raw.moeCode] ?? [],
  }
}

function transformMajor(raw: RawMajor): Major {
  const duration = parseDuration(raw.duration)
  return {
    id: raw.majorCode,
    name: raw.majorName,
    category: raw.category,
    discipline: raw.subCategory,
    degreeType: raw.degreeType,
    duration,
    subjects: [],
  }
}

function parseDuration(raw?: string): number | undefined {
  if (!raw) return undefined
  const match = raw.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : undefined
}

function transformScoreRecord(raw: RawScoreRecord): ScoreRecord {
  return {
    collegeId: raw.collegeId,
    majorId: raw.majorCode,
    collegeName: raw.collegeName,
    majorName: raw.majorName,
    year: raw.year,
    province: raw.province,
    batch: raw.batch,
    category: raw.category,
    minScore: raw.minScore,
    minRank: raw.minRank,
    planCount: raw.planCount,
  }
}

function transformSubjectRecord(raw: RawSubjectRecord): SubjectRequirement {
  return {
    collegeId: raw.collegeId,
    collegeName: raw.collegeName,
    majorName: raw.majorName,
    requirementType: normalizeRequirementType(raw.requirementType),
    requiredSubjects: raw.requiredSubjects,
    rawText: raw.subjectRequirement,
  }
}

function normalizeRequirementType(raw: string): SubjectRequirement['requirementType'] {
  if (raw === 'none') return 'none'
  if (raw === 'one_required') return 'one_required'
  if (raw === 'two_required') return 'two_required'
  return 'other'
}

export function checkSubjectRequirement(
  requirement: SubjectRequirement | undefined,
  userSubjects: string[]
): boolean {
  if (!requirement) return true
  if (requirement.requirementType === 'none') return true
  if (requirement.requirementType === 'two_required') {
    return requirement.requiredSubjects.every((s) => userSubjects.includes(s))
  }
  if (requirement.requirementType === 'one_required') {
    return requirement.requiredSubjects.some((s) => userSubjects.includes(s))
  }
  return true
}

const rankTableYearsCache = new Map<string, number[]>()

export async function probeRankTableYears(provinceName: string): Promise<number[]> {
  if (rankTableYearsCache.has(provinceName)) {
    return rankTableYearsCache.get(provinceName)!
  }
  const years = [2023, 2024, 2025]
  const results = await Promise.all(
    years.map(async (year) => {
      try {
        const response = await fetch(`/data/scores/${provinceName}/rank_table_${year}.json`)
        return response.ok ? year : null
      } catch {
        return null
      }
    })
  )
  const available = results.filter((y): y is number => y !== null).sort((a, b) => b - a)
  rankTableYearsCache.set(provinceName, available)
  return available
}
