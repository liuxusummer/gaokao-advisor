import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildSystemPrompt, trimMessages, streamChat } from './chat'
import type { ChatMessage, UserProfile, VolunteerItem, AiConfig } from '../store'
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

  it('包含偏好专业方向（categories）', () => {
    const profileWithCategories: UserProfile = {
      ...profile,
      categories: ['工学', '理学'],
    }
    const prompt = buildSystemPrompt(profileWithCategories, [])
    expect(prompt).toContain('工学/理学')
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

  it('跨 chunk 的不完整行能正确拼接', async () => {
    // 一个 SSE 行被拆成两个 chunk
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"hel',  // 不完整
      'lo"}}]}\n\n',  // 补全
      'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeSseResponse(makeSseStream(sseChunks))
    )

    const receivedChunks: string[] = []
    const result = await streamChat({
      messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
      aiConfig,
      profile,
      volunteerList: [],
      onChunk: (text) => receivedChunks.push(text),
    })

    expect(result).toBe('helloworld')
    expect(receivedChunks).toEqual(['hello', 'world'])
  })

  it('流自然结束（无 [DONE]）时处理残留 buffer', async () => {
    // 流结束但没有 [DONE]，最后一条 data 行没有尾随换行
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"B"}}]}',  // 无换行，无 [DONE]
    ]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeSseResponse(makeSseStream(sseChunks))
    )

    const result = await streamChat({
      messages: [{ id: 'u1', role: 'user', content: '问', timestamp: 1 }],
      aiConfig,
      profile,
      volunteerList: [],
      onChunk: () => {},
    })

    expect(result).toBe('AB')
  })
})
