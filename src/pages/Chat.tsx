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
