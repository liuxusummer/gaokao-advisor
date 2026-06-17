import {
  colleges,
  majors,
  scoreRecords,
  type RecommendationItem,
  type College,
} from '../data/mock'
import type { UserProfile } from '../store'

export function generateRecommendations(profile: UserProfile): RecommendationItem[] {
  const userRank = profile.rank || 5000
  const userSubjects = new Set(profile.subjects)
  const maxTuition = profile.maxTuition || Infinity

  const candidates: RecommendationItem[] = []

  colleges.forEach((college) => {
    majors.forEach((major) => {
      if (major.tuition > maxTuition) return
      if (major.subjects.length > 0 && !major.subjects.every((s) => userSubjects.has(s))) return
      if (profile.categories.length > 0 && !profile.categories.includes(major.category)) return
      if (profile.regions.length > 0 && !profile.regions.includes(college.province)) return
      if (profile.levels.length > 0 && !college.level.some((l) => profile.levels.includes(l))) return
      if (profile.physicalExam === 'colorWeak' && major.colorBlind) return
      if (profile.physicalExam === 'colorBlind' && major.colorBlind) return

      const records = scoreRecords
        .filter((r) => r.collegeId === college.id && r.majorId === major.id)
        .sort((a, b) => b.year - a.year)
      if (records.length === 0) return

      const weights = [0.5, 0.3, 0.2]
      const recent = records.slice(0, 3)
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
        return
      }

      const reasonParts = [
        `你的位次 ${userRank}，近三年录取平均位次 ${Math.round(avgRank)}`,
        `属于"${tier === 'rush' ? '冲' : tier === 'stable' ? '稳' : '保'}"档`,
      ]
      if (major.subjects.length > 0) {
        reasonParts.push(`选科要求 ${major.subjects.join('+')}，你已满足`)
      }
      if (profile.categories.includes(major.category)) {
        reasonParts.push(`专业方向匹配你的偏好`)
      }

      candidates.push({
        id: `${college.id}-${major.id}`,
        college,
        major,
        tier,
        probability: Math.min(99, Math.round(probability)),
        minRanks: recent.map((r) => ({ year: r.year, rank: r.minRank })),
        reason: reasonParts.join('；'),
        source: `${college.name}本科招生网 · 阳光高考网`,
      })
    })
  })

  // Sort within each tier: higher probability first, then by college level weight
  const levelWeight = (college: College) => {
    if (college.level.includes('985')) return 3
    if (college.level.includes('211')) return 2
    if (college.level.includes('双一流')) return 1
    return 0
  }

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) {
      const order = { rush: 0, stable: 1, safe: 2 }
      return order[a.tier] - order[b.tier]
    }
    if (b.probability !== a.probability) return b.probability - a.probability
    return levelWeight(b.college) - levelWeight(a.college)
  })

  // Limit per tier based on profile risk preference and province total
  const provinceTotal = 96
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
  candidates.forEach((item) => {
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
