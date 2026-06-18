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
