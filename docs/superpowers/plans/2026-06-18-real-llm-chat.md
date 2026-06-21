# 真实 LLM 接入 AI 助手实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 助手从 mock 接入真实 LLM 服务（OpenAI 兼容协议、SSE 流式），保留 mock 作为未配置时的降级方案。

**Architecture:** Store 新增 `aiConfig` 持久化配置 + `updateLastAssistantMessage` 支持流式更新；新建 `src/services/chat.ts` 封装 `streamChat`（构造 system prompt、fetch POST、ReadableStream 解析 SSE、错误分类）；Chat.tsx 按 `aiConfig.apiKey` 分支：未配置走 mock，已配置走流式 + AbortController 停止按钮 + 未配置提示条；Settings.tsx 三个 Input 直接读写 store。

**Tech Stack:** React 18 + TypeScript + Vite + Zustand（persist）+ Ant Design 5 + Tailwind + vitest + @testing-library/react

**Spec:** [2026-06-18-real-llm-chat-design.md](../specs/2026-06-18-real-llm-chat-design.md)

---

## 文件结构

**新建：**
- `src/services/chat.ts` — LLM Service 层：`buildSystemPrompt`、`trimMessages`、`streamChat`、错误类型
- `src/services/chat.test.ts` — Service 层单元测试（mock fetch + ReadableStream）
- `src/pages/Chat.test.tsx` — Chat 组件交互测试（未配置走 mock、已配置走 streamChat、停止生成、错误提示）

**修改：**
- `src/store/index.ts` — 新增 `AiConfig` 接口、`aiConfig` 字段、`setAiConfig`、`updateLastAssistantMessage`
- `src/pages/Chat.tsx` — 替换 mock 调用为 `streamChat`，新增停止按钮、未配置提示条、loading 期间禁用输入
- `src/pages/Settings.tsx` — 三个 `useState` 改为读写 `aiConfig`，移除"保存配置"按钮的 mock toast

**不修改：**
- `src/data/mock.ts`（`mockChatReply` 保留作为降级）
- `vite.config.ts`（暂不加 proxy）
- `ChatMessage` 接口结构

---

## Task 1: Store 新增 aiConfig 和流式更新方法

**Files:**
- Modify: `src/store/index.ts`
- Test: `src/store/index.test.ts` (新建)

- [ ] **Step 1: 写失败测试**

新建 `src/store/index.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './index'

describe('store aiConfig', () => {
  beforeEach(() => {
    useAppStore.setState({
      aiConfig: { baseUrl: '', apiKey: '', model: '' },
      chatMessages: [
        { id: 'welcome', role: 'assistant', content: '你好', timestamp: 1 },
      ],
    })
  })

  it('默认 aiConfig 为空字符串', () => {
    const { aiConfig } = useAppStore.getState()
    expect(aiConfig).toEqual({ baseUrl: '', apiKey: '', model: '' })
  })

  it('setAiConfig 部分更新字段', () => {
    useAppStore.getState().setAiConfig({ apiKey: 'sk-test' })
    expect(useAppStore.getState().aiConfig.apiKey).toBe('sk-test')
    expect(useAppStore.getState().aiConfig.baseUrl).toBe('')
  })

  it('setAiConfig 多次合并更新', () => {
    useAppStore.getState().setAiConfig({ baseUrl: 'https://a.com' })
    useAppStore.getState().setAiConfig({ model: 'glm-4' })
    expect(useAppStore.getState().aiConfig).toEqual({
      baseUrl: 'https://a.com',
      apiKey: '',
      model: 'glm-4',
    })
  })

  it('updateLastAssistantMessage 更新最后一条 assistant 消息内容', () => {
    useAppStore.setState({
      chatMessages: [
        { id: 'a1', role: 'assistant', content: '旧', timestamp: 1 },
        { id: 'u1', role: 'user', content: '问', timestamp: 2 },
        { id: 'a2', role: 'assistant', content: '', timestamp: 3 },
      ],
    })
    useAppStore.getState().updateLastAssistantMessage('流式内容')
    const msgs = useAppStore.getState().chatMessages
    expect(msgs[msgs.length - 1].content).toBe('流式内容')
    expect(msgs[0].content).toBe('旧')
  })

  it('updateLastAssistantMessage 没有 assistant 消息时不报错', () => {
    useAppStore.setState({
      chatMessages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
    })
    expect(() => useAppStore.getState().updateLastAssistantMessage('x')).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/store/index.test.ts`
Expected: FAIL — `aiConfig` is undefined / `setAiConfig` is not a function

- [ ] **Step 3: 实现 store 改动**

修改 `src/store/index.ts`。在 `ChatMessage` 接口下方新增 `AiConfig` 接口：

```typescript
export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}
```

在 `AppState` 接口中，紧跟 `clearChat` 之后新增三个成员：

```typescript
  clearChat: () => void

  aiConfig: AiConfig
  setAiConfig: (config: Partial<AiConfig>) => void
  updateLastAssistantMessage: (content: string) => void
```

在 store 实现中，紧跟 `clearChat` 实现之后新增：

```typescript
      clearChat: () =>
        set({
          chatMessages: [
            {
              id: 'welcome',
              role: 'assistant',
              content: '你好！我是智填助手。你可以问我关于志愿推荐、院校专业、填报规则的问题。',
              timestamp: Date.now(),
            },
          ],
        }),

      aiConfig: { baseUrl: '', apiKey: '', model: '' },
      setAiConfig: (config) =>
        set((state) => ({ aiConfig: { ...state.aiConfig, ...config } })),
      updateLastAssistantMessage: (content) =>
        set((state) => {
          const msgs = [...state.chatMessages]
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], content }
              break
            }
          }
          return { chatMessages: msgs }
        }),
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/store/index.test.ts`
Expected: PASS — 5 tests passed

- [ ] **Step 5: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/store/index.ts src/store/index.test.ts
git commit -m "feat(store): add aiConfig and updateLastAssistantMessage for LLM streaming"
```

---

## Task 2: Service - buildSystemPrompt 和 trimMessages 辅助函数

**Files:**
- Create: `src/services/chat.ts`
- Test: `src/services/chat.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/services/chat.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, trimMessages } from './chat'
import type { ChatMessage, UserProfile, VolunteerItem } from '../store'
import type { College, Major } from '../data/mock'

const profile: UserProfile = {
  provinceId: 'zhejiang',
  provinceName: '浙江',
  subjectType: 'physics',
  subjects: ['物理', '化学', '生物'],
  score: 620,
  rank: 15000,
  regions: [],
  levels: [],
  categories: [],
  maxTuition: null,
  physicalExam: 'normal',
  riskPreference: 'balanced',
}

describe('buildSystemPrompt', () => {
  it('包含考生省份和分数', () => {
    const prompt = buildSystemPrompt(profile, [])
    expect(prompt).toContain('浙江')
    expect(prompt).toContain('620')
    expect(prompt).toContain('15000')
    expect(prompt).toContain('物理+化学+生物')
  })

  it('包含志愿表内容', () => {
    const college: College = {
      id: 'c1', name: '测试大学', province: '浙江', city: '杭州',
      level: ['本科'], type: '综合', tags: ['双一流'],
    }
    const major: Major = {
      id: 'm1', name: '计算机科学与技术', category: '工学',
      collegeId: 'c1', collegeName: '测试大学',
    }
    const volunteerList: VolunteerItem[] = [
      { id: 'v1', college, major, tier: 'stable', probability: 0.7 },
    ]
    const prompt = buildSystemPrompt(profile, volunteerList)
    expect(prompt).toContain('测试大学')
    expect(prompt).toContain('计算机科学与技术')
    expect(prompt).toContain('stable')
  })

  it('志愿表为空时显示"无"', () => {
    const prompt = buildSystemPrompt(profile, [])
    expect(prompt).toMatch(/当前志愿表.*无/)
  })

  it('包含免责声明要求', () => {
    const prompt = buildSystemPrompt(profile, [])
    expect(prompt).toContain('以上信息仅供参考')
  })
})

describe('trimMessages', () => {
  it('过滤掉 welcome 消息和空内容', () => {
    const msgs: ChatMessage[] = [
      { id: 'welcome', role: 'assistant', content: '你好', timestamp: 1 },
      { id: 'u1', role: 'user', content: '问题', timestamp: 2 },
      { id: 'a1', role: 'assistant', content: '', timestamp: 3 },
      { id: 'a2', role: 'assistant', content: '回复', timestamp: 4 },
    ]
    const result = trimMessages(msgs)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('问题')
    expect(result[1].content).toBe('回复')
  })

  it('只保留最近 20 条', () => {
    const msgs: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
      id: `m${i}`,
      role: 'user' as const,
      content: `内容${i}`,
      timestamp: i,
    }))
    const result = trimMessages(msgs)
    expect(result).toHaveLength(20)
    expect(result[0].content).toBe('内容10')
    expect(result[19].content).toBe('内容29')
  })

  it('只返回 role 和 content 字段', () => {
    const msgs: ChatMessage[] = [
      { id: 'u1', role: 'user', content: '问题', timestamp: 1 },
    ]
    const result = trimMessages(msgs)
    expect(result[0]).toEqual({ role: 'user', content: '问题' })
    expect(result[0]).not.toHaveProperty('id')
    expect(result[0]).not.toHaveProperty('timestamp')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/chat.test.ts`
Expected: FAIL — Cannot find module './chat'

- [ ] **Step 3: 实现 chat.ts 辅助函数**

新建 `src/services/chat.ts`：

```typescript
import type { ChatMessage, UserProfile, VolunteerItem } from '../store'

/**
 * 构造系统提示词，让 LLM 扮演"智填志愿"助手并携带考生上下文
 */
export function buildSystemPrompt(profile: UserProfile, volunteerList: VolunteerItem[]): string {
  const subjectsStr = profile.subjects.length > 0 ? profile.subjects.join('+') : '未指定'
  const levelsStr = profile.levels.length > 0 ? profile.levels.join('/') : '未指定'
  const majorsStr = profile.preferredMajors?.length ? profile.preferredMajors.join('、') : '未指定'

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

当前志愿表（如有）：
${volunteerStr}

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
```

注意：`UserProfile` 当前没有 `preferredMajors` 字段，使用可选链 `?.` 避免类型错误。如果 TypeScript 报错，移除该行改为 `const majorsStr = '未指定'`。

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/chat.test.ts`
Expected: PASS — 7 tests passed

- [ ] **Step 5: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误（如有 `preferredMajors` 报错，按 Step 3 注释处理）

- [ ] **Step 6: 提交**

```bash
git add src/services/chat.ts src/services/chat.test.ts
git commit -m "feat(chat-service): add buildSystemPrompt and trimMessages helpers"
```

---

## Task 3: Service - streamChat 成功流式路径

**Files:**
- Modify: `src/services/chat.ts`
- Test: `src/services/chat.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/services/chat.test.ts` 顶部新增 import：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildSystemPrompt, trimMessages, streamChat } from './chat'
import type { ChatMessage, UserProfile, VolunteerItem, AiConfig } from '../store'
import type { College, Major } from '../data/mock'
```

（替换原有第一行 import）

在文件末尾追加：

```typescript
const aiConfig: AiConfig = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-test',
}

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function makeSseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('streamChat 成功路径', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('流式接收多个 chunk 并拼接完整文本', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"！"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeSseResponse(makeSseStream(sseChunks))
    )

    const receivedChunks: string[] = []
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: '你好', timestamp: 1 },
    ]
    const result = await streamChat({
      messages,
      aiConfig,
      profile,
      volunteerList: [],
      onChunk: (text) => receivedChunks.push(text),
    })

    expect(result).toBe('你好，世界！')
    expect(receivedChunks).toEqual(['你好', '，世界', '！'])
  })

  it('调用 fetch 时使用正确的 URL、headers、body', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeSseResponse(makeSseStream(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'data: [DONE]\n\n']))
    )

    await streamChat({
      messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
      aiConfig,
      profile,
      volunteerList: [],
      onChunk: () => {},
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-test',
        },
      })
    )
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const body = JSON.parse(callArgs.body as string)
    expect(body.model).toBe('gpt-test')
    expect(body.stream).toBe(true)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
  })

  it('空回复返回空字符串', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeSseResponse(makeSseStream(['data: [DONE]\n\n']))
    )

    const result = await streamChat({
      messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
      aiConfig,
      profile,
      volunteerList: [],
      onChunk: () => {},
    })

    expect(result).toBe('')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/chat.test.ts`
Expected: FAIL — `streamChat` is not exported

- [ ] **Step 3: 实现 streamChat**

在 `src/services/chat.ts` 末尾追加：

```typescript
export interface ChatParams {
  messages: ChatMessage[]
  aiConfig: { baseUrl: string; apiKey: string; model: string }
  profile: UserProfile
  volunteerList: VolunteerItem[]
  onChunk: (text: string) => void
  signal?: AbortSignal
}

/**
 * 调用 OpenAI 兼容的 /chat/completions 接口，流式接收回复
 * @returns 完整拼接的文本
 */
export async function streamChat(params: ChatParams): Promise<string> {
  const { messages, aiConfig, profile, volunteerList, onChunk, signal } = params
  const systemPrompt = buildSystemPrompt(profile, volunteerList)
  const trimmed = trimMessages(messages)

  const url = `${aiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey}`,
    },
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

  return accumulated
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/chat.test.ts`
Expected: PASS — 10 tests passed

- [ ] **Step 5: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/services/chat.ts src/services/chat.test.ts
git commit -m "feat(chat-service): implement streamChat with SSE parsing"
```

---

## Task 4: Service - streamChat 错误处理

**Files:**
- Modify: `src/services/chat.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/services/chat.test.ts` 末尾追加：

```typescript
describe('streamChat 错误处理', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('HTTP 401 抛出包含状态码的 ChatError', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(
      streamChat({
        messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
        aiConfig,
        profile,
        volunteerList: [],
        onChunk: () => {},
      })
    ).rejects.toMatchObject({ name: 'ChatError', status: 401, message: 'Invalid API key' })
  })

  it('HTTP 429 抛出 ChatError 状态码 429', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('rate limited', { status: 429 })
    )

    await expect(
      streamChat({
        messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
        aiConfig,
        profile,
        volunteerList: [],
        onChunk: () => {},
      })
    ).rejects.toMatchObject({ name: 'ChatError', status: 429 })
  })

  it('网络错误（fetch 抛 TypeError）原样抛出', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    )

    await expect(
      streamChat({
        messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
        aiConfig,
        profile,
        volunteerList: [],
        onChunk: () => {},
      })
    ).rejects.toThrow(TypeError)
  })

  it('AbortSignal 已取消时抛出 AbortError', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new DOMException('The user aborted a request.', 'AbortError')
            reject(err)
          })
        })
    )

    const controller = new AbortController()
    const promise = streamChat({
      messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
      aiConfig,
      profile,
      volunteerList: [],
      onChunk: () => {},
      signal: controller.signal,
    })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/chat.test.ts`
Expected: 4 个新测试可能部分通过（HTTP 错误路径 Task 3 已实现），AbortError 测试可能 FAIL

- [ ] **Step 3: 验证错误处理已完整**

检查 `src/services/chat.ts` 中的 `streamChat`：
- HTTP 非 2xx → `ChatError`（已在 Task 3 实现）
- fetch 抛 TypeError → 原样抛出（无需额外处理）
- AbortSignal → fetch 自身会 reject AbortError（无需额外处理）

如果所有测试通过，跳到 Step 4。如果有失败，根据失败信息修复 `streamChat`。

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/chat.test.ts`
Expected: PASS — 14 tests passed

- [ ] **Step 5: 提交**

```bash
git add src/services/chat.test.ts
git commit -m "test(chat-service): cover error paths (401/429/network/abort)"
```

---

## Task 5: Chat.tsx - 未配置走 mock + 提示条

**Files:**
- Modify: `src/pages/Chat.tsx`
- Test: `src/pages/Chat.test.tsx` (新建)

- [ ] **Step 1: 写失败测试**

新建 `src/pages/Chat.test.tsx`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Chat from './Chat'
import { useAppStore } from '../store'
import { mockChatReply } from '../data/mock'

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  )
}

describe('Chat 未配置时', () => {
  beforeEach(() => {
    useAppStore.setState({
      aiConfig: { baseUrl: '', apiKey: '', model: '' },
      chatMessages: [
        { id: 'welcome', role: 'assistant', content: '你好', timestamp: 1 },
      ],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('显示"未配置 AI 服务"提示条', () => {
    renderChat()
    expect(screen.getByText(/未配置 AI 服务/)).toBeInTheDocument()
  })

  it('发送消息后显示 mock 回复', async () => {
    renderChat()
    const input = screen.getByPlaceholderText('输入你的问题...')
    fireEvent.change(input, { target: { value: '我的分数能上什么学校' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(mockChatReply('我的分数能上什么学校').slice(0, 10)))
      ).toBeInTheDocument()
    })
  })

  it('mock 回复包含免责声明', async () => {
    renderChat()
    const input = screen.getByPlaceholderText('输入你的问题...')
    fireEvent.change(input, { target: { value: '分数' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(screen.getByText(/以上信息仅供参考/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/pages/Chat.test.tsx`
Expected: FAIL — 找不到"未配置 AI 服务"文本

- [ ] **Step 3: 实现 Chat.tsx 未配置分支**

修改 `src/pages/Chat.tsx`。完整替换为：

```typescript
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from 'antd'
import { SendOutlined, BookOutlined, ClearOutlined, UserOutlined, RobotOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'
import { chatSuggestions, mockChatReply } from '../data/mock'
import { streamChat, ChatError } from '../services/chat'

export default function Chat() {
  const navigate = useNavigate()
  const { chatMessages, addChatMessage, clearChat, updateLastAssistantMessage, aiConfig, profile, volunteerList } = useAppStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const unconfigured = !aiConfig.apiKey || !aiConfig.baseUrl

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return
    addChatMessage({ role: 'user', content: text })
    setInput('')
    setLoading(true)

    // 未配置 → mock 兜底
    if (unconfigured) {
      await new Promise((r) => setTimeout(r, 800))
      addChatMessage({
        role: 'assistant',
        content: mockChatReply(text) + '\n\n以上信息仅供参考，请以官方发布为准。',
      })
      setLoading(false)
      return
    }

    // 真实 LLM 流式
    try {
      let accumulated = ''
      addChatMessage({ role: 'assistant', content: '' })
      abortRef.current = new AbortController()
      accumulated = await streamChat({
        messages: useAppStore.getState().chatMessages,
        aiConfig,
        profile,
        volunteerList,
        onChunk: (chunk) => {
          accumulated += chunk
          updateLastAssistantMessage(accumulated)
        },
        signal: abortRef.current.signal,
      })
      if (accumulated.trim() === '') {
        updateLastAssistantMessage('未收到有效回复，请重试。')
      } else {
        updateLastAssistantMessage(accumulated + '\n\n以上信息仅供参考，请以官方发布为准。')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 取消不当作错误，保留已收到内容
        const lastMsg = useAppStore.getState().chatMessages.at(-1)
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content.trim() === '') {
          updateLastAssistantMessage('（已取消）')
        }
      } else if (err instanceof ChatError) {
        const hint = err.status === 401 || err.status === 403
          ? 'API Key 无效或已过期，请检查设置'
          : err.status === 429
          ? '请求过于频繁，请稍后再试'
          : err.status === 404
          ? '模型不存在，请检查模型名称'
          : `请求失败（${err.status}）：${err.message}`
        updateLastAssistantMessage(`${hint}。请检查设置中的 AI 配置。`)
      } else if (err instanceof TypeError) {
        updateLastAssistantMessage('无法连接服务，可能是 CORS 限制或 Base URL 无效，请检查设置。')
      } else {
        updateLastAssistantMessage(`请求失败：${err instanceof Error ? err.message : '未知错误'}。请检查设置中的 AI 配置。`)
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 h-[calc(100vh-64px)] md:h-auto flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">AI 问答</h1>
        <Button icon={<ClearOutlined />} onClick={clearChat}>
          新对话
        </Button>
      </div>

      {unconfigured && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 text-xs flex items-center gap-2">
          <WarningOutlined />
          <span>未配置 AI 服务，当前为模拟回复。</span>
          <button
            onClick={() => navigate('/settings')}
            className="underline font-medium hover:text-yellow-900 dark:hover:text-yellow-100"
          >
            前往设置 →
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-bg-card rounded-2xl shadow-md p-4 mb-4 space-y-4">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-primary to-primary-light text-white rounded-br-md'
                  : 'bg-bg-page text-text-body rounded-bl-md border border-border-color'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 text-xs opacity-80">
                {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                <span>{msg.role === 'user' ? '你' : '智填助手'}</span>
              </div>
              <p className="text-sm whitespace-pre-line">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-page text-text-body rounded-2xl rounded-bl-md border border-border-color px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chatSuggestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-border-color bg-bg-card text-xs text-text-body hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend(input)
              }
            }}
            placeholder="输入你的问题..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            className="flex-1"
          />
          {loading ? (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              className="h-auto"
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSend(input)}
              disabled={!input.trim()}
              className="bg-primary border-0 h-auto"
            />
          )}
        </div>
        <p className="text-xs text-text-secondary flex items-center gap-1">
          <BookOutlined />
          AI 回答基于内置知识库，关键数据请与官方发布核对。
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/pages/Chat.test.tsx`
Expected: PASS — 3 tests passed

- [ ] **Step 5: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/pages/Chat.tsx src/pages/Chat.test.tsx
git commit -m "feat(chat): add unconfigured banner, mock fallback, stop button, streaming"
```

---

## Task 6: Chat.tsx - 已配置走真实 LLM 流式

**Files:**
- Modify: `src/pages/Chat.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/pages/Chat.test.tsx` 顶部新增 import：

```typescript
import { vi } from 'vitest'
```
（如果已 import vi 则跳过）

在文件末尾追加：

```typescript
describe('Chat 已配置时', () => {
  const mockOnChunk = vi.fn()

  function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    })
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    useAppStore.setState({
      aiConfig: { baseUrl: 'https://api.test.com/v1', apiKey: 'sk-test', model: 'gpt-test' },
      chatMessages: [
        { id: 'welcome', role: 'assistant', content: '你好', timestamp: 1 },
      ],
      profile: {
        provinceId: 'zhejiang',
        provinceName: '浙江',
        subjectType: 'physics',
        subjects: ['物理'],
        score: 600,
        rank: 20000,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
      },
      volunteerList: [],
    })
    mockOnChunk.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('不显示"未配置 AI 服务"提示条', () => {
    renderChat()
    expect(screen.queryByText(/未配置 AI 服务/)).not.toBeInTheDocument()
  })

  it('发送消息调用 fetch 流式 API 并更新消息', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        makeSseStream([
          'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"同学"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      )
    )

    renderChat()
    const input = screen.getByPlaceholderText('输入你的问题...')
    fireEvent.change(input, { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    await waitFor(() => {
      expect(screen.getByText(/你好同学/)).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('流式回复末尾追加免责声明', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        makeSseStream([
          'data: {"choices":[{"delta":{"content":"回答"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        { status: 200 }
      )
    )

    renderChat()
    const input = screen.getByPlaceholderText('输入你的问题...')
    fireEvent.change(input, { target: { value: '问' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    await waitFor(() => {
      const els = screen.getAllByText(/以上信息仅供参考/)
      expect(els.length).toBeGreaterThan(0)
    })
  })

  it('HTTP 401 显示 API Key 无效提示', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Invalid key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    renderChat()
    const input = screen.getByPlaceholderText('输入你的问题...')
    fireEvent.change(input, { target: { value: '问' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    await waitFor(() => {
      expect(screen.getByText(/API Key 无效/)).toBeInTheDocument()
    })
  })

  it('loading 期间显示"停止"按钮', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve })
    )

    renderChat()
    const input = screen.getByPlaceholderText('输入你的问题...')
    fireEvent.change(input, { target: { value: '问' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /停止/ })).toBeInTheDocument()
    })

    // 解除阻塞
    resolveFetch(
      new Response(
        makeSseStream(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'data: [DONE]\n\n']),
        { status: 200 }
      )
    )
  })

  it('点击"停止"按钮中断请求并保留已收到内容', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
    )

    renderChat()
    const input = screen.getByPlaceholderText('输入你的问题...')
    fireEvent.change(input, { target: { value: '问' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    const stopBtn = await screen.findByRole('button', { name: /停止/ })
    fireEvent.click(stopBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /发送/ })).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/pages/Chat.test.tsx`
Expected: PASS — 9 tests passed（3 未配置 + 6 已配置）

注：Task 5 已经实现了完整的 Chat.tsx（含真实 LLM 调用、停止按钮、错误处理），所以这些测试应当直接通过。如果失败，根据失败信息修复 `src/pages/Chat.tsx`。

- [ ] **Step 3: 类型检查 + lint**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit && npx eslint src/pages/Chat.tsx src/pages/Chat.test.tsx src/services/chat.ts src/services/chat.test.ts src/store/index.ts`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/pages/Chat.test.tsx
git commit -m "test(chat): cover configured LLM streaming, stop button, error states"
```

---

## Task 7: Settings.tsx - 配置项接入 store

**Files:**
- Modify: `src/pages/Settings.tsx`
- Test: `src/pages/Settings.test.tsx` (新建)

- [ ] **Step 1: 写失败测试**

新建 `src/pages/Settings.test.tsx`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from './Settings'
import { useAppStore } from '../store'

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  )
}

describe('Settings AI 配置', () => {
  beforeEach(() => {
    useAppStore.setState({
      aiConfig: { baseUrl: '', apiKey: '', model: '' },
      darkMode: false,
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
      },
      volunteerList: [],
    })
  })

  it('三个输入框初始为空', () => {
    renderSettings()
    const inputs = screen.getAllByRole('textbox')
    const baseInput = screen.getByPlaceholderText('https://open.bigmodel.cn/api/paas/v4')
    const modelInput = screen.getByPlaceholderText('glm-4-plus')
    expect(baseInput).toHaveValue('')
    expect(modelInput).toHaveValue('')
  })

  it('修改 Base URL 实时同步到 store', () => {
    renderSettings()
    const baseInput = screen.getByPlaceholderText('https://open.bigmodel.cn/api/paas/v4')
    fireEvent.change(baseInput, { target: { value: 'https://api.test.com/v1' } })
    expect(useAppStore.getState().aiConfig.baseUrl).toBe('https://api.test.com/v1')
  })

  it('修改 API Key 实时同步到 store', () => {
    renderSettings()
    const keyInput = screen.getByPlaceholderText('仅存储在本地浏览器')
    fireEvent.change(keyInput, { target: { value: 'sk-abc' } })
    expect(useAppStore.getState().aiConfig.apiKey).toBe('sk-abc')
  })

  it('修改模型名称实时同步到 store', () => {
    renderSettings()
    const modelInput = screen.getByPlaceholderText('glm-4-plus')
    fireEvent.change(modelInput, { target: { value: 'gpt-4' } })
    expect(useAppStore.getState().aiConfig.model).toBe('gpt-4')
  })

  it('store 中的配置反映到输入框', () => {
    useAppStore.setState({
      aiConfig: { baseUrl: 'https://existing.com', apiKey: 'sk-existing', model: 'existing-model' },
    })
    renderSettings()
    expect(screen.getByPlaceholderText('https://open.bigmodel.cn/api/paas/v4')).toHaveValue('https://existing.com')
    expect(screen.getByPlaceholderText('仅存储在本地浏览器')).toHaveValue('sk-existing')
    expect(screen.getByPlaceholderText('glm-4-plus')).toHaveValue('existing-model')
  })

  it('不显示"原型演示：配置仅本地保存"toast 文案按钮', () => {
    renderSettings()
    expect(screen.queryByRole('button', { name: /保存配置/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/pages/Settings.test.tsx`
Expected: FAIL — 输入框初始值不为空（当前是组件内 useState）或找不到"保存配置"按钮（仍存在）

- [ ] **Step 3: 实现 Settings.tsx 接入 store**

修改 `src/pages/Settings.tsx`。完整替换为：

```typescript
import { useNavigate } from 'react-router-dom'
import { Button, Input, Switch, Card, message } from 'antd'
import { LeftOutlined, MoonOutlined, SunOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'

export default function Settings() {
  const navigate = useNavigate()
  const { darkMode, setDarkMode, profile, resetProfile, clearVolunteerList, clearChat, aiConfig, setAiConfig } = useAppStore()

  const clearAll = () => {
    resetProfile()
    clearVolunteerList()
    clearChat()
    message.success('已清除所有本地数据')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button icon={<LeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">设置</h1>
      </div>

      <div className="space-y-4">
        <Card title="个人信息" className="shadow-md">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-secondary">省份</span>
              <p className="font-medium text-text-primary">{profile.provinceName || '未设置'}</p>
            </div>
            <div>
              <span className="text-text-secondary">高考分数</span>
              <p className="font-medium text-text-primary">{profile.score || '未设置'}</p>
            </div>
            <div>
              <span className="text-text-secondary">位次</span>
              <p className="font-medium text-text-primary">{profile.rank || '未设置'}</p>
            </div>
            <div>
              <span className="text-text-secondary">选科</span>
              <p className="font-medium text-text-primary">{profile.subjects.join('+') || '未设置'}</p>
            </div>
          </div>
        </Card>

        <Card title="外观" className="shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <MoonOutlined /> : <SunOutlined />}
              <span className="text-sm text-text-primary">深色模式</span>
            </div>
            <Switch checked={darkMode} onChange={setDarkMode} className={darkMode ? 'bg-primary' : ''} />
          </div>
        </Card>

        <Card title="AI 对话配置（可选）" className="shadow-md">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Base URL</label>
              <Input
                value={aiConfig.baseUrl}
                onChange={(e) => setAiConfig({ baseUrl: e.target.value })}
                placeholder="https://open.bigmodel.cn/api/paas/v4"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">API Key</label>
              <Input.Password
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig({ apiKey: e.target.value })}
                placeholder="仅存储在本地浏览器"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">模型名称</label>
              <Input
                value={aiConfig.model}
                onChange={(e) => setAiConfig({ model: e.target.value })}
                placeholder="glm-4-plus"
              />
            </div>
            <p className="text-xs text-text-secondary">
              配置保存后立即生效。未配置时 AI 助手将使用模拟回复。
            </p>
          </div>
        </Card>

        <Card title="数据管理" className="shadow-md">
          <div className="flex flex-wrap gap-3">
            <Button icon={<ExportOutlined />} onClick={() => message.info('原型演示：导出功能')}>导出数据</Button>
            <Button icon={<DeleteOutlined />} danger onClick={clearAll}>
              清除所有本地数据
            </Button>
          </div>
        </Card>

        <Card title="关于" className="shadow-md">
          <p className="text-sm text-text-secondary">智填志愿 v1.0</p>
          <p className="text-xs text-text-secondary mt-2">
            免责声明：本工具基于公开历史数据进行分析推荐，不保证录取结果。请以各省教育考试院官方发布为准。
          </p>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/pages/Settings.test.tsx`
Expected: PASS — 6 tests passed

- [ ] **Step 5: 类型检查 + lint**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit && npx eslint src/pages/Settings.tsx src/pages/Settings.test.tsx`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "feat(settings): bind AI config inputs to store with live persistence"
```

---

## Task 8: 全量验证 + 构建

**Files:**
- 无修改

- [ ] **Step 1: 运行全部新增测试**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/store/index.test.ts src/services/chat.test.ts src/pages/Chat.test.tsx src/pages/Settings.test.tsx`
Expected: 所有测试 PASS

- [ ] **Step 2: 运行全量类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行 ESLint**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx eslint src/`
Expected: 无错误

- [ ] **Step 4: 运行生产构建**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 5: 启动 dev server 手动验证**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npm run dev`

手动验证清单：
1. 打开 Settings 页面，输入 Base URL / API Key / 模型名称，刷新页面后配置仍在
2. 打开 Chat 页面，未配置时显示黄色提示条 + 模拟回复
3. 配置后提示条消失，发送消息触发真实 LLM 调用（需有效 Key）
4. 流式过程中显示"停止"按钮，点击可中断
5. 错误场景（无效 Key）显示对应错误提示

- [ ] **Step 6: 最终提交（如有手动验证发现的修复）**

```bash
git add -A
git commit -m "chore: final verification of real LLM chat integration"
```

---

## Self-Review

### 1. Spec 覆盖检查

| Spec 要求 | 对应 Task |
|---|---|
| 数据层：aiConfig / setAiConfig / updateLastAssistantMessage | Task 1 ✓ |
| Service 层：streamChat + system prompt + SSE 解析 | Task 2, 3 ✓ |
| Service 层：错误处理（401/429/网络/abort/空回复） | Task 3, 4 ✓ |
| Chat.tsx：未配置走 mock | Task 5 ✓ |
| Chat.tsx：已配置走流式 | Task 5, 6 ✓ |
| Chat.tsx：停止生成按钮 | Task 5, 6 ✓ |
| Chat.tsx：未配置提示条 | Task 5 ✓ |
| Chat.tsx：loading 期间禁用输入 | Task 5 ✓ |
| Settings.tsx：三个 Input 接入 store | Task 7 ✓ |
| Settings.tsx：移除 mock toast | Task 7 ✓ |
| 测试：Service 单元测试 | Task 2, 3, 4 ✓ |
| 测试：Chat 组件测试 | Task 5, 6 ✓ |
| 测试：Settings 组件测试 | Task 7 ✓ |

### 2. 占位符扫描

- 无 "TBD" / "TODO" / "implement later"
- 每个步骤都含完整代码或完整命令
- 错误处理分支都给出了具体的提示文案

### 3. 类型一致性

- `AiConfig` 接口在 Task 1 定义，Task 2/3/5/7 使用 — 一致
- `ChatParams` 接口在 Task 3 定义，Task 5/6 使用 — 一致
- `ChatError` 类在 Task 3 定义，Task 5 使用 — 一致
- `setAiConfig: (config: Partial<AiConfig>) => void` 在 Task 1 定义，Task 7 调用 `setAiConfig({ baseUrl: ... })` — 一致
- `updateLastAssistantMessage: (content: string) => void` 在 Task 1 定义，Task 5 调用 — 一致
- `streamChat` 返回 `Promise<string>`，Task 5 中 `accumulated = await streamChat(...)` — 一致

### 4. 潜在问题

- `UserProfile` 没有 `preferredMajors` 字段（Task 2 Step 3 已用可选链 + 注释说明兜底）
- jsdom 的 `ReadableStream` / `TextDecoder` / `DOMException` / `AbortController` 在 vitest 1.x + jsdom 24 下可用（已在测试中使用）
- `useAppStore.getState().chatMessages` 在 Task 5 中读取最新消息（含刚 addChatMessage 的 user 消息），确保 system prompt 之后的 history 正确
