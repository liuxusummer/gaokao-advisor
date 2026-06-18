import type { RequirementType } from '../types'

export interface ParsedRequirement {
  type: RequirementType
  subjects: string[]
}

/**
 * 解析选科要求文本为结构化类型和科目列表。
 *
 * 支持的格式：
 *   - "不提科目要求" → none, []
 *   - "物理(1门科目考生必须选考方可报考)" → one_required, ["物理"]
 *   - "物理,化学(2门科目考生均须选考方可报考)" → two_required, ["物理","化学"]
 *   - "物理,化学(2门科目考生选考其中1门即可报考)" → any_of_two
 */
export function parseRequirement(text: string): ParsedRequirement {
  const trimmed = text.trim()

  if (trimmed.includes('不提科目要求')) {
    return { type: 'none', subjects: [] }
  }

  // 提取括号前的科目
  const bracketMatch = trimmed.match(/^([^(]+)\(/)
  if (!bracketMatch) {
    return { type: 'unknown', subjects: [] }
  }

  const subjectsStr = bracketMatch[1].trim()
  // 支持半角和全角逗号
  const subjects = subjectsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean)

  // 根据括号内文本判断类型
  if (trimmed.includes('均须选考')) {
    if (subjects.length === 1) return { type: 'one_required', subjects }
    if (subjects.length === 2) return { type: 'two_required', subjects }
    if (subjects.length === 3) return { type: 'three_required', subjects }
    return { type: 'unknown', subjects }
  }

  if (trimmed.includes('必须选考')) {
    return { type: 'one_required', subjects }
  }

  if (trimmed.includes('选考其中1门')) {
    return { type: 'any_of_two', subjects }
  }

  if (trimmed.includes('选考其中2门')) {
    return { type: 'any_of_three', subjects }
  }

  return { type: 'unknown', subjects }
}
