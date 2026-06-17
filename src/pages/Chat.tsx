import { useState, useRef, useEffect } from 'react'
import { Button, Input } from 'antd'
import { SendOutlined, BookOutlined, ClearOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'
import { chatSuggestions, mockChatReply } from '../data/mock'

export default function Chat() {
  const { chatMessages, addChatMessage, clearChat } = useAppStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = async (text: string) => {
    if (!text.trim()) return
    addChatMessage({ role: 'user', content: text })
    setInput('')
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    addChatMessage({
      role: 'assistant',
      content: mockChatReply(text) + '\n\n以上信息仅供参考，请以官方发布为准。',
    })
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 h-[calc(100vh-64px)] md:h-auto flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">AI 问答</h1>
        <Button icon={<ClearOutlined />} onClick={clearChat}>
          新对话
        </Button>
      </div>

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
              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-border-color bg-bg-card text-xs text-text-body hover:border-primary hover:text-primary transition-colors"
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
            className="flex-1"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleSend(input)}
            loading={loading}
            className="bg-primary border-0 h-auto"
          />
        </div>
        <p className="text-xs text-text-secondary flex items-center gap-1">
          <BookOutlined />
          AI 回答基于内置知识库，关键数据请与官方发布核对。
        </p>
      </div>
    </div>
  )
}
