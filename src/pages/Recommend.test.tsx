import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Recommend from './Recommend'
import { useAppStore } from '../store'

// Mock echarts 以避免 jsdom 环境报错
vi.mock('echarts', () => ({
  init: vi.fn(() => ({ dispose: vi.fn(), resize: vi.fn(), setOption: vi.fn() })),
  use: vi.fn(),
}))

// Mock generateRecommendations
vi.mock('../services/recommender', () => ({
  generateRecommendations: vi.fn().mockResolvedValue([
    {
      id: 'c1-m1',
      college: { id: 'c1', name: '测试大学', province: '北京', city: '北京', tags: ['985'] },
      major: { id: 'm1', name: '计算机科学与技术', category: '工学', tuition: 6000 },
      tier: 'stable',
      probability: 75,
      minRanks: [{ year: 2024, rank: 5000 }],
      reason: '测试原因',
      source: '测试来源',
    },
  ]),
}))

function renderRecommend() {
  return render(
    <MemoryRouter>
      <Recommend />
    </MemoryRouter>
  )
}

describe('Recommend 页面高级设置', () => {
  beforeEach(() => {
    useAppStore.setState({
      profile: {
        provinceId: '11',
        provinceName: '北京',
        subjectType: 'physics',
        subjects: ['物理', '化学'],
        score: 600,
        rank: 5000,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
      recommendations: [],
      recommendWeights: {
        probability: 30,
        collegeLevel: 25,
        majorInterest: 20,
        region: 15,
        tuition: 5,
        employment: 5,
      },
    })
  })

  afterEach(() => {
    useAppStore.getState().resetProfile()
  })

  it('页面渲染时显示高级设置折叠区域', () => {
    renderRecommend()
    expect(screen.getByText('高级设置（推荐权重调整）')).toBeInTheDocument()
  })

  it('点击展开后显示 6 个权重滑块', async () => {
    renderRecommend()
    fireEvent.click(screen.getByText('高级设置（推荐权重调整）'))
    await waitFor(() => {
      expect(screen.getByText('录取概率')).toBeInTheDocument()
      expect(screen.getByText('院校层次')).toBeInTheDocument()
      expect(screen.getByText('专业兴趣')).toBeInTheDocument()
      expect(screen.getByText('地域偏好')).toBeInTheDocument()
      expect(screen.getByText('学费')).toBeInTheDocument()
      expect(screen.getByText('就业前景')).toBeInTheDocument()
    })
  })

  it('显示当前权重总和', async () => {
    renderRecommend()
    fireEvent.click(screen.getByText('高级设置（推荐权重调整）'))
    await waitFor(() => {
      expect(screen.getByText(/当前权重总和：100/)).toBeInTheDocument()
    })
  })

  it('点击恢复默认按钮调用 resetRecommendWeights', async () => {
    renderRecommend()
    fireEvent.click(screen.getByText('高级设置（推荐权重调整）'))
    await waitFor(() => {
      expect(screen.getByText('恢复默认')).toBeInTheDocument()
    })
    // 先修改权重
    useAppStore.getState().setRecommendWeights({ probability: 50 })
    expect(useAppStore.getState().recommendWeights.probability).toBe(50)
    // 点击恢复默认
    fireEvent.click(screen.getByText('恢复默认'))
    expect(useAppStore.getState().recommendWeights.probability).toBe(30)
  })
})
