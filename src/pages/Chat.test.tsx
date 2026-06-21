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
    // jsdom 未实现 scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    useAppStore.setState({
      aiConfig: { baseUrl: '', apiKey: '', model: '' },
      chatMessages: [
        { id: 'welcome', role: 'assistant', content: '你好', timestamp: 1 },
      ],
      profile: {
        provinceId: '',
        provinceName: '',
        subjectType: 'physics',
        subjects: [],
        score: null,
        rank: null,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
      volunteerList: [],
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

describe('Chat 已配置时', () => {
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
        mbtiType: null,
      },
      volunteerList: [],
    })
    // jsdom 未实现 scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
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
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(screen.getByText(/你好同学/)).toBeInTheDocument()
    })
    // 开发环境通过 Vite proxy 转发，URL 为 /llm-proxy/chat/completions
    expect(global.fetch).toHaveBeenCalledWith(
      '/llm-proxy/chat/completions',
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
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(screen.getAllByText(/以上信息仅供参考/).length).toBeGreaterThan(0)
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
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

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
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /停止/ })).toBeInTheDocument()
    })

    // 解除阻塞以避免影响后续测试
    resolveFetch(
      new Response(
        makeSseStream(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'data: [DONE]\n\n']),
        { status: 200 }
      )
    )
  })

  it('点击"停止"按钮中断请求', async () => {
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
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    const stopBtn = await screen.findByRole('button', { name: /停止/ })
    fireEvent.click(stopBtn)

    // abort 后 loading 应结束，停止按钮消失
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /停止/ })).not.toBeInTheDocument()
    })
  })
})
