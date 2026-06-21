import type { VolunteerItem, UserProfile } from '../store'
import type { RiskItem } from '../data/mock'
import type { SubjectRequirement } from './dataLoader'
import { checkSubjectRequirement } from './dataLoader'

export function detectRisks(
  volunteerList: VolunteerItem[],
  profile: UserProfile,
  subjectRequirements?: Map<string, SubjectRequirement>
): RiskItem[] {
  const risks: RiskItem[] = []
  const userRank = profile.rank || 0

  // 1. 冲稳保比例
  const rushCount = volunteerList.filter((v) => v.tier === 'rush').length
  const stableCount = volunteerList.filter((v) => v.tier === 'stable').length
  const safeCount = volunteerList.filter((v) => v.tier === 'safe').length
  const total = volunteerList.length

  if (total > 0) {
    const rushRatio = rushCount / total
    const safeRatio = safeCount / total
    if (rushRatio > 0.5 || safeRatio < 0.1) {
      risks.push({
        id: 'ratio',
        type: 'slide',
        level: 'high',
        category: '冲稳保比例',
        title: '冲稳保比例不均衡',
        description: `冲 ${rushCount} / 稳 ${stableCount} / 保 ${safeCount}，保底志愿占比不足。`,
        reason: '保底志愿过少会增加滑档风险。',
        suggestion: '建议增加保底志愿数量，使“保”档占比达到 20%-30%。',
        affectedIndexes: [],
      })
    } else if (rushRatio > 0.4 || safeRatio < 0.15) {
      risks.push({
        id: 'ratio',
        type: 'slide',
        level: 'medium',
        category: '冲稳保比例',
        title: '冲稳保比例可优化',
        description: `冲 ${rushCount} / 稳 ${stableCount} / 保 ${safeCount}，梯度可更合理。`,
        reason: '冲档过多或保底偏少可能导致滑档。',
        suggestion: '建议微调志愿比例，增加部分保底志愿。',
        affectedIndexes: [],
      })
    }
  }

  // 2. 保底院校位次差
  if (safeCount > 0 && userRank > 0) {
    const lastSafe = volunteerList.filter((v) => v.tier === 'safe').pop()
    if (lastSafe?.minRank) {
      const gap = (lastSafe.minRank - userRank) / userRank
      if (gap < 0.05) {
        risks.push({
          id: 'safe-gap',
          type: 'slide',
          level: 'high',
          category: '保底院校位次差',
          title: '保底院校位次不够低',
          description: '最后一个保底志愿与考生位次差距过小。',
          reason: '保底院校录取位次应明显低于考生位次，才能确保兜底。',
          suggestion: '将录取概率更高的院校专业放在志愿表末尾。',
          affectedIndexes: [volunteerList.length],
        })
      }
    }
  }

  // 3. 相邻志愿梯度断层
  for (let i = 0; i < volunteerList.length - 1; i++) {
    const cur = volunteerList[i]
    const next = volunteerList[i + 1]
    const diff = Math.abs(cur.probability - next.probability)
    if (diff < 3) {
      risks.push({
        id: `gradient-${i}`,
        type: 'slide',
        level: 'medium',
        category: '志愿间梯度',
        title: `第 ${i + 1} 与第 ${i + 2} 志愿梯度不足`,
        description: '相邻两个志愿录取概率接近，形成梯度断层。',
        reason: '梯度过于平缓会浪费志愿名额。',
        suggestion: '调整志愿顺序，使相邻志愿录取概率拉开 5%-15% 的差距。',
        affectedIndexes: [i + 1, i + 2],
      })
    }
  }

  // 4. 退档风险：身体条件
  volunteerList.forEach((item, index) => {
    if ((profile.physicalExam === 'colorWeak' || profile.physicalExam === 'colorBlind') && item.major.colorBlind) {
      risks.push({
        id: `physical-${index}`,
        type: 'reject',
        level: 'high',
        category: '身体条件',
        title: `${item.college.name} · ${item.major.name} 色觉限报`,
        description: `你的体检结论为"${profile.physicalExam === 'colorWeak' ? '色弱' : '色盲'}"，该专业可能不予录取。`,
        reason: '根据《普通高等学校招生体检工作指导意见》，色觉异常考生报考相关专业可能被退档。',
        suggestion: '建议删除或替换为不限色觉的专业，如法学、教育学、数学、文学等。',
        affectedIndexes: [index + 1],
      })
    }
  })

  // 5. 退档风险：未服从调剂（院校专业组模式）
  if (profile.provinceId !== 'zhejiang' && profile.provinceId !== 'shandong' && profile.provinceId !== 'liaoning') {
    volunteerList.forEach((item, index) => {
      if (item.obeyAdjust === false) {
        risks.push({
          id: `adjust-${index}`,
          type: 'reject',
          level: 'high',
          category: '服从调剂',
          title: `第 ${index + 1} 志愿未勾选服从调剂`,
          description: `${item.college.name} · ${item.major.name} 未服从专业调剂。`,
          reason: '院校专业组模式下，不服从调剂存在较大退档风险。',
          suggestion: '建议勾选服从调剂，或确保专业组内专业均可接受。',
          affectedIndexes: [index + 1],
        })
      }
    })
  }

  // 6. 退档风险：选科不匹配（兜底检查）
  const userSubjects = new Set(profile.subjects)
  volunteerList.forEach((item, index) => {
    // 优先使用真实数据中的选科要求
    const subjectReq = subjectRequirements?.get(`${item.college.id}-${item.major.name}`)
    if (subjectReq && !checkSubjectRequirement(subjectReq, profile.subjects)) {
      risks.push({
        id: `subject-${index}`,
        type: 'reject',
        level: 'high',
        category: '选科匹配',
        title: `${item.college.name} · ${item.major.name} 选科不符`,
        description: `该专业要求${subjectReq.rawText || subjectReq.requiredSubjects.join('+')}，你的选科不满足。`,
        reason: '新高考下选科不符合要求将被退档。',
        suggestion: '删除该志愿或更换为选科要求匹配的专业。',
        affectedIndexes: [index + 1],
      })
      return
    }

    // 无真实选科要求时，回退到专业基础 subjects
    if (item.major.subjects && item.major.subjects.length > 0 && !item.major.subjects.every((s) => userSubjects.has(s))) {
      risks.push({
        id: `subject-${index}`,
        type: 'reject',
        level: 'high',
        category: '选科匹配',
        title: `${item.college.name} · ${item.major.name} 选科不符`,
        description: `该专业要求选考 ${item.major.subjects.join('+')}，你的选科不满足。`,
        reason: '新高考下选科不符合要求将被退档。',
        suggestion: '删除该志愿或更换为选科要求匹配的专业。',
        affectedIndexes: [index + 1],
      })
    }
  })

  return risks
}
