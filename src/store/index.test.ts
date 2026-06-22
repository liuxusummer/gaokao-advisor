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

describe('store subjectAssessment + integratedAssessment', () => {
  beforeEach(() => {
    useAppStore.setState({
      subjectAssessmentResult: null,
      integratedAssessment: null,
    })
  })

  it('默认 subjectAssessmentResult 为 null', () => {
    expect(useAppStore.getState().subjectAssessmentResult).toBeNull()
  })

  it('setSubjectAssessmentResult 设置结果', () => {
    const result = {
      subjectScores: { math: 5, physics: 4 },
      behaviorScores: { theory_practice: 3 },
      topSubjects: ['math', 'physics'],
      recommendedCategories: ['数学类', '计算机类'],
      timestamp: Date.now(),
    }
    useAppStore.getState().setSubjectAssessmentResult(result)
    expect(useAppStore.getState().subjectAssessmentResult).toEqual(result)
  })

  it('默认 integratedAssessment 为 null', () => {
    expect(useAppStore.getState().integratedAssessment).toBeNull()
  })

  it('setIntegratedAssessment 设置结果', () => {
    const result = {
      hollandCode: 'RIA',
      topSubjects: ['math', 'computer', 'physics'],
      agreedCategories: ['计算机类', '数学类'],
      confidence: 'high' as const,
      mbtiType: null,
      mbtiCategories: [],
      timestamp: Date.now(),
    }
    useAppStore.getState().setIntegratedAssessment(result)
    expect(useAppStore.getState().integratedAssessment).toEqual(result)
  })
})

describe('schemes actions', () => {
  beforeEach(() => {
    useAppStore.setState({ schemes: [], volunteerList: [] })
  })

  it('saveScheme 新增方案并返回 id', () => {
    const id = useAppStore.getState().saveScheme('方案A', [])
    const schemes = useAppStore.getState().schemes
    expect(schemes).toHaveLength(1)
    expect(schemes[0].id).toBe(id)
    expect(schemes[0].name).toBe('方案A')
  })

  it('saveScheme 未传 items 时使用当前 volunteerList', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({ volunteerList: [{ id: 'v1', college: { id: 'c1', name: 'X' }, major: { id: 'm1', name: 'Y' }, tier: 'rush', probability: 0.5 } as any] })
    const id = useAppStore.getState().saveScheme('方案B')
    const scheme = useAppStore.getState().schemes.find(s => s.id === id)
    expect(scheme?.items).toHaveLength(1)
  })

  it('saveScheme name 为空时自动命名"方案 N"', () => {
    useAppStore.getState().saveScheme('', [])
    useAppStore.getState().saveScheme('', [])
    const schemes = useAppStore.getState().schemes
    expect(schemes[0].name).toBe('方案 1')
    expect(schemes[1].name).toBe('方案 2')
  })

  it('renameScheme 修改方案名', () => {
    const id = useAppStore.getState().saveScheme('old', [])
    useAppStore.getState().renameScheme(id, 'new')
    expect(useAppStore.getState().schemes[0].name).toBe('new')
  })

  it('deleteScheme 删除方案', () => {
    const id = useAppStore.getState().saveScheme('A', [])
    useAppStore.getState().deleteScheme(id)
    expect(useAppStore.getState().schemes).toHaveLength(0)
  })

  it('loadScheme 将方案 items 加载到 volunteerList', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockItem = { id: 'v1', college: { id: 'c1', name: 'X' }, major: { id: 'm1', name: 'Y' }, tier: 'rush', probability: 0.5 } as any
    const id = useAppStore.getState().saveScheme('A', [mockItem])
    useAppStore.getState().loadScheme(id)
    expect(useAppStore.getState().volunteerList).toHaveLength(1)
    expect(useAppStore.getState().volunteerList[0].id).toBe('v1')
  })

  it('saveScheme 删除后自动命名不重复', () => {
    // 预置 3 个方案：方案 1, 方案 2, 方案 3（用 setState 避免同一毫秒生成相同 id）
    const now = Date.now()
    useAppStore.setState({
      schemes: [
        { id: 's1', name: '方案 1', items: [], createdAt: now, updatedAt: now },
        { id: 's2', name: '方案 2', items: [], createdAt: now, updatedAt: now },
        { id: 's3', name: '方案 3', items: [], createdAt: now, updatedAt: now },
      ],
    })

    // 删除方案 2
    useAppStore.getState().deleteScheme('s2')
    expect(useAppStore.getState().schemes).toHaveLength(2)

    // 再创建一个新方案，应命名为"方案 4"而不是"方案 3"
    useAppStore.getState().saveScheme('', [])
    const newSchemes = useAppStore.getState().schemes
    expect(newSchemes).toHaveLength(3)
    expect(newSchemes[2].name).toBe('方案 4')
    // 确认没有重名
    const names = newSchemes.map(s => s.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
