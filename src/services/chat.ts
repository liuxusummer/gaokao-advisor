import type { ChatMessage, UserProfile, VolunteerItem } from '../store'

/**
 * 构造系统提示词，让 LLM 扮演"智填志愿"助手并携带考生上下文
 */
export function buildSystemPrompt(profile: UserProfile, volunteerList: VolunteerItem[]): string {
  const subjectsStr = profile.subjects.length > 0 ? profile.subjects.join('+') : '未指定'
  const levelsStr = profile.levels.length > 0 ? profile.levels.join('/') : '未指定'
  const majorsStr = profile.categories.length > 0 ? profile.categories.join('/') : '未指定'

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
export function trimMessages(messages: ChatMessage[]): Array<{ role: ChatMessage['role']; content: string }> {
  const filtered = messages.filter(
    (m) => m.id !== 'welcome' && m.content.trim() !== ''
  )
  const recent = filtered.slice(-20)
  return recent.map((m) => ({ role: m.role, content: m.content }))
}

export interface ChatParams {
  messages: ChatMessage[]
  aiConfig: { baseUrl: string; apiKey: string; model: string }
  profile: UserProfile
  volunteerList: VolunteerItem[]
  onChunk: (text: string) => void
  signal?: AbortSignal
}

/**
 * 自定义错误类，携带 HTTP 状态码便于上层分类处理
 */
export class ChatError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ChatError'
    this.status = status
  }
}

async function safeReadError(response: Response): Promise<{ message: string }> {
  try {
    const text = await response.text()
    const parsed = JSON.parse(text)
    return { message: parsed.error?.message || `HTTP ${response.status}` }
  } catch {
    return { message: `HTTP ${response.status}` }
  }
}

/**
 * 调用 OpenAI 兼容的 /chat/completions 接口，流式接收回复
 * @returns 完整拼接的文本
 */
export async function streamChat(params: ChatParams): Promise<string> {
  const { messages, aiConfig, profile, volunteerList, onChunk, signal } = params
  const systemPrompt = buildSystemPrompt(profile, volunteerList)
  const trimmed = trimMessages(messages)

  // 开发环境通过 Vite proxy 转发，绕过浏览器 CORS 限制
  // 生产环境（vite build 部署后）需自行配置反向代理或使用支持 CORS 的 API
  const baseUrl = aiConfig.baseUrl.replace(/\/$/, '')
  const isDev = import.meta.env.DEV
  const url = isDev ? '/llm-proxy/chat/completions' : `${baseUrl}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${aiConfig.apiKey}`,
  }
  if (isDev) {
    headers['X-Target-Base-URL'] = baseUrl
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [{ role: 'system', content: systemPrompt }, ...trimmed],
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errBody = await safeReadError(response)
    throw new ChatError(errBody.message, response.status)
  }

  if (!response.body) {
    throw new ChatError('响应没有 body', response.status)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || !trimmedLine.startsWith('data:')) continue
      const data = trimmedLine.slice(5).trim()
      if (data === '[DONE]') {
        return accumulated
      }
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) {
          accumulated += delta
          onChunk(delta)
        }
      } catch {
        // 跳过无法解析的行（心跳等）
      }
    }
  }

  // Flush any remaining bytes in the decoder
  buffer += decoder.decode()

  // 处理流结束时残留的最后一行
  if (buffer.trim()) {
    const trimmedLine = buffer.trim()
    if (trimmedLine.startsWith('data:')) {
      const data = trimmedLine.slice(5).trim()
      if (data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) {
            accumulated += delta
            onChunk(delta)
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  }

  return accumulated
}
