import type { ChatMessage, UserProfile, VolunteerItem } from '../store'

/**
 * 构造系统提示词，让 LLM 扮演"智填志愿"助手并携带考生上下文
 */
export function buildSystemPrompt(profile: UserProfile, volunteerList: VolunteerItem[]): string {
  const subjectsStr = profile.subjects.length > 0 ? profile.subjects.join('+') : '未指定'
  const levelsStr = profile.levels.length > 0 ? profile.levels.join('/') : '未指定'
  const majorsStr = '未指定'

  const volunteerStr =
    volunteerList.length > 0
      ? volunteerList
          .map((v) => `${v.college.name} · ${v.major.name}（${v.tier}）`)
          .join('\n')
      : '无'

  return `你是"智填志愿"AI 助手，专门帮助中国高考考生填报志愿。你的职责：
1. 根据考生的分数、位次、选科、省份，提供志愿填报建议
2. 解答专业选择、院校选择、填报规则等问题
3. 分析冲稳保策略和滑档/退档风险

当前考生信息：
- 省份：${profile.provinceName || '未设置'}
- 高考分数：${profile.score ?? '未设置'}
- 全省位次：${profile.rank ?? '未设置'}
- 选考科目：${subjectsStr}
- 偏好层次：${levelsStr}
- 偏好专业方向：${majorsStr}

当前志愿表（如有）：${volunteerStr}

回答要求：
- 基于中国高考实际政策，区分新高考/老高考省份
- 给出具体建议时参考考生位次，不要空泛
- 如果信息不足，主动追问
- 简洁明了，避免冗长
- 最后附上"以上信息仅供参考，请以官方发布为准"`
}

/**
 * 裁剪消息历史：过滤 welcome/空内容，取最近 20 条，只保留 role+content
 */
export function trimMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  const filtered = messages.filter(
    (m) => m.id !== 'welcome' && m.content.trim() !== ''
  )
  const recent = filtered.slice(-20)
  return recent.map((m) => ({ role: m.role, content: m.content }))
}
