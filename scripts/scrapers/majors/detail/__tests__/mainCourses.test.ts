import { describe, it, expect } from 'vitest'
import { extractMainCourses } from '../parse.js'

describe('extractMainCourses', () => {
  it('从 desc 中提取主干课程（冒号格式）', () => {
    const desc = '本专业培养具备...主干课程：作物栽培学、作物育种学、种子生产技术。'
    const result = extractMainCourses(desc)
    expect(result).toBe('作物栽培学、作物育种学、种子生产技术')
  })

  it('从 desc 中提取主要课程', () => {
    const desc = '主要课程：哲学概论、马克思主义哲学、中国哲学史。'
    const result = extractMainCourses(desc)
    expect(result).toBe('哲学概论、马克思主义哲学、中国哲学史')
  })

  it('从 desc 中提取核心课程', () => {
    const desc = '核心课程：高等数学、线性代数、概率论。'
    const result = extractMainCourses(desc)
    expect(result).toBe('高等数学、线性代数、概率论')
  })

  it('desc 中无课程信息时返回空字符串', () => {
    const desc = '本专业学生主要学习马克思主义哲学基本原理。'
    const result = extractMainCourses(desc)
    expect(result).toBe('')
  })

  it('desc 为空时返回空字符串', () => {
    const result = extractMainCourses('')
    expect(result).toBe('')
  })

  it('课程列表到句号结尾时正确截断', () => {
    const desc = '主干课程：课程A、课程B、课程C。后续其他内容。'
    const result = extractMainCourses(desc)
    expect(result).toBe('课程A、课程B、课程C')
  })
})
