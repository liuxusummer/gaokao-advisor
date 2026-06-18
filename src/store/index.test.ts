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
