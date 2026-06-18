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
