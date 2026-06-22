import {
  colleges as mockColleges,
  majors as mockMajors,
  scoreRecords as mockScoreRecords,
  provinces,
  type RecommendationItem,
  type College,
  type Major,
  type ScoreRecord,
} from '../data/mock'
import type { UserProfile } from '../store'
import { loadMbtiMapping } from '../features/assessment/services/mbtiMapper'
import {
  loadProvinceData,
  isRealDataAvailable,
  checkSubjectRequirement,
  type RealDataCache,
} from './dataLoader'
import {
  scoreCandidate,
  DEFAULT_WEIGHTS,
  EMPLOYMENT_SCORE_MAP,
  type RecommendWeights,
  type AssessmentInput,
} from './rankScorer'

export interface RecommendOptions {
  weights?: RecommendWeights
  assessment?: AssessmentInput
}

export async function generateRecommendations(
  profile: UserProfile,
  cache?: RealDataCache,
  options?: RecommendOptions
): Promise<RecommendationItem[]> {
  const useReal = isRealDataAvailable(profile.provinceId)
  const data = useReal ? cache || (await loadProvinceData(profile.provinceId)) : undefined

  const colleges = data?.colleges || mockColleges
  const majors = data?.majors || mockMajors
  const scoreRecords = data?.scoreRecords || mockScoreRecords
  const subjectRequirements = data?.subjectRequirements

  const userRank = profile.rank || estimateRankFromScore(profile.score)
  const userSubjects = new Set(profile.subjects)
  const maxTuition = profile.maxTuition || Infinity

  const mbtiMapping = profile.mbtiType ? await loadMbtiMapping() : null
  const mbtiCategories = mbtiMapping?.[profile.mbtiType]?.categories ?? []

  const collegeMap = new Map(colleges.map((c) => [c.id, c]))
  const majorMap = new Map(majors.map((m) => [m.id, m]))

  const candidates: RecommendationItem[] = []

  // Group score records by (collegeId, majorId) for multi-year lookup
  const recordMap = new Map<string, ScoreRecord[]>()
  for (const r of scoreRecords) {
    const key = `${r.collegeId}-${r.majorId}`
    if (!recordMap.has(key)) recordMap.set(key, [])
    recordMap.get(key)!.push(r)
  }

  // 投档线中的专业代码多为各省本地编码，可能与教育部目录不一致；
  // 先用代码查，再用专业名称查，再尝试子串匹配，都找不到时用投档线中的专业名称和科类生成合成专业对象
  const majorByNameMap = new Map(majors.map((m) => [m.name, m]))
  const findMajorByName = (name?: string): Major | undefined => {
    if (!name) return undefined
    const exact = majorByNameMap.get(name)
    if (exact) return exact
    // 投档线常见“类/试验班”名称，尝试用目录中单个专业名作为子串匹配门类
    for (const m of majors) {
      if (name.includes(m.name)) return m
    }
    return undefined
  }
  const getOrCreateMajor = (record: ScoreRecord): Major => {
    const byCode = majorMap.get(record.majorId)
    if (byCode) return byCode
    const byName = findMajorByName(record.majorName)
    if (byName) return { ...byName, id: record.majorId }
    return {
      id: record.majorId,
      name: record.majorName || record.majorId,
      category: record.category || '未知门类',
      subjects: [],
    }
  }

  for (const [, records] of recordMap) {
    const college = collegeMap.get(records[0].collegeId)
    const major = getOrCreateMajor(records[0])
    if (!college) continue

    if (major.tuition && major.tuition > maxTuition) continue
    if (profile.categories.length > 0 && !profile.categories.includes(major.category)) continue
    if (profile.regions.length > 0 && !profile.regions.includes(normalizeProvince(college.province))) continue
    if (profile.levels.length > 0 && !college.tags?.some((l) => profile.levels.includes(l))) continue
    if (profile.physicalExam === 'colorWeak' && major.colorBlind) continue
    if (profile.physicalExam === 'colorBlind' && major.colorBlind) continue

    // Check subject requirement from real data first, then fallback to major.subjects
    const subjectReq = subjectRequirements?.get(`${college.id}-${records[0].majorName}`)
    if (subjectReq) {
      if (!checkSubjectRequirement(subjectReq, profile.subjects)) continue
    } else if (major.subjects && major.subjects.length > 0) {
      if (!major.subjects.every((s) => userSubjects.has(s))) continue
    }

    const sorted = records.sort((a, b) => b.year - a.year)
    const recent = sorted.slice(0, 3)
    if (recent.length === 0) continue

    const weights = [0.5, 0.3, 0.2]
    const avgRank =
      recent.reduce((sum, r, i) => sum + r.minRank * (weights[i] || 0), 0) /
      recent.reduce((sum, _, i) => sum + (weights[i] || 0), 0)

    const deviation = (userRank - avgRank) / avgRank
    let tier: 'rush' | 'stable' | 'safe'
    let probability: number

    if (deviation < -0.15) {
      tier = 'safe'
      probability = 90 + Math.random() * 6
    } else if (deviation < -0.05) {
      tier = 'safe'
      probability = 80 + Math.random() * 10
    } else if (deviation <= 0.05) {
      tier = 'stable'
      probability = 60 + Math.random() * 20
    } else if (deviation <= 0.15) {
      tier = 'rush'
      probability = 20 + Math.random() * 20
    } else {
      continue
    }

    const reasonParts = [
      `你的位次 ${userRank}，近三年录取平均位次 ${Math.round(avgRank)}`,
      `属于"${tier === 'rush' ? '冲' : tier === 'stable' ? '稳' : '保'}"档`,
    ]
    if (subjectReq) {
      reasonParts.push(`选科要求 ${subjectReq.rawText}，你已满足`)
    } else if (major.subjects && major.subjects.length > 0) {
      reasonParts.push(`选科要求 ${major.subjects.join('+')}，你已满足`)
    }
    if (profile.categories.includes(major.category)) {
      reasonParts.push(`专业方向匹配你的偏好`)
    }
    if (mbtiCategories.includes(major.category)) {
      reasonParts.push(`与你的 MBTI 人格(${profile.mbtiType})匹配`)
    }

    candidates.push({
      id: `${college.id}-${major.id}`,
      college,
      major,
      tier,
      probability: Math.min(99, Math.round(probability)),
      minRanks: recent.map((r) => ({ year: r.year, rank: r.minRank })),
      reason: reasonParts.join('；'),
      source: `${college.name}本科招生网 · 阳光高考网 · 各省教育考试院`,
    })
  }

  const levelWeight = (college: College) => {
    if (college.tags?.includes('985')) return 3
    if (college.tags?.includes('211')) return 2
    if (college.tags?.includes('双一流')) return 1
    return 0
  }

  const weights = options?.weights ?? DEFAULT_WEIGHTS
  const assessmentInput: AssessmentInput = options?.assessment ?? {
    hollandCategories: [],
    subjectCategories: [],
    mbtiCategories: mbtiCategories,
  }

  const scoredCandidates = candidates.map((c) => ({
    item: c,
    score: scoreCandidate(
      {
        probability: c.probability,
        collegeLevel: levelWeight(c.college),
        majorCategory: c.major.category,
        collegeProvince: normalizeProvince(c.college.province),
        tuition: c.major.tuition ?? 0,
        employmentScore: EMPLOYMENT_SCORE_MAP[c.major.category] ?? 50,
      },
      weights,
      assessmentInput,
      { regions: profile.regions, maxTuition: profile.maxTuition }
    ),
  }))

  scoredCandidates.sort((a, b) => b.score - a.score)
  const sortedCandidates = scoredCandidates.map((s) => s.item)

  const provinceTotal = provinces.find((p) => p.id === profile.provinceId)?.total ?? 96
  let rushCount = Math.round(provinceTotal * 0.25)
  let stableCount = Math.round(provinceTotal * 0.5)
  let safeCount = Math.round(provinceTotal * 0.25)

  if (profile.riskPreference === 'conservative') {
    rushCount = Math.round(provinceTotal * 0.15)
    stableCount = Math.round(provinceTotal * 0.55)
    safeCount = Math.round(provinceTotal * 0.3)
  } else if (profile.riskPreference === 'aggressive') {
    rushCount = Math.round(provinceTotal * 0.35)
    stableCount = Math.round(provinceTotal * 0.45)
    safeCount = Math.round(provinceTotal * 0.2)
  }

  const result: RecommendationItem[] = []
  let r = 0, s = 0, g = 0
  sortedCandidates.forEach((item) => {
    if (item.tier === 'rush' && r < rushCount) {
      result.push(item)
      r++
    } else if (item.tier === 'stable' && s < stableCount) {
      result.push(item)
      s++
    } else if (item.tier === 'safe' && g < safeCount) {
      result.push(item)
      g++
    }
  })

  return result
}

function estimateRankFromScore(score: number | null): number {
  if (!score) return 50000
  return Math.round((750 - score) * 100 + 500)
}

// 真实院校数据中 province 字段带"省/市/自治区/特别行政区"后缀，
// 而用户偏好中的地域选项使用短名（如"浙江"），需要归一化后比较
function normalizeProvince(province: string): string {
  return province
    .replace(/(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/, '')
}
