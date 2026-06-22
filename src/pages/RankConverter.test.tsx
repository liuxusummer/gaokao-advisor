import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RankConverter from './RankConverter'
import { useAppStore } from '../store'

// jsdom 未实现 canvas getContext，echarts 实际渲染会抛错，这里 mock 掉
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn(),
  })),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <RankConverter />
    </MemoryRouter>
  )
}

describe('RankConverter 页面', () => {
  beforeEach(() => {
    useAppStore.setState({
      profile: {
        provinceId: 'zhejiang',
        provinceName: '浙江',
        subjectType: 'comprehensive',
        subjects: [],
        score: 620,
        rank: null,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
      dataCache: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('未填位次时显示提示', () => {
    renderPage()
    expect(screen.getByText(/请输入当年位次/)).toBeInTheDocument()
  })

  it('有数据时渲染等效分表格', () => {
    useAppStore.setState({
      profile: {
        provinceId: 'zhejiang',
        provinceName: '浙江',
        subjectType: 'comprehensive',
        subjects: [],
        score: 620,
        rank: 200,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
      dataCache: {
        colleges: [],
        majors: [],
        scoreRecords: [],
        subjectRequirements: new Map(),
        rankTable: [
          { province: '浙江', year: 2024, category: '综合', score: 690, rank: 200, count: 150, cumulativeCount: 200 },
          { province: '浙江', year: 2025, category: '综合', score: 695, rank: 200, count: 150, cumulativeCount: 200 },
        ],
        province: '浙江',
        loadedAt: Date.now(),
      },
    })

    renderPage()
    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('695')).toBeInTheDocument()
    expect(screen.getByText('690')).toBeInTheDocument()
  })

  it('精确命中显示"精确"标签', () => {
    useAppStore.setState({
      profile: {
        provinceId: 'zhejiang',
        provinceName: '浙江',
        subjectType: 'comprehensive',
        subjects: [],
        score: 620,
        rank: 200,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
      dataCache: {
        colleges: [],
        majors: [],
        scoreRecords: [],
        subjectRequirements: new Map(),
        rankTable: [
          { province: '浙江', year: 2024, category: '综合', score: 690, rank: 200, count: 150, cumulativeCount: 200 },
        ],
        province: '浙江',
        loadedAt: Date.now(),
      },
    })

    renderPage()
    expect(screen.getByText('精确')).toBeInTheDocument()
  })

  it('渲染折线图容器', () => {
    useAppStore.setState({
      profile: {
        provinceId: 'zhejiang',
        provinceName: '浙江',
        subjectType: 'comprehensive',
        subjects: [],
        score: 620,
        rank: 200,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
      dataCache: {
        colleges: [],
        majors: [],
        scoreRecords: [],
        subjectRequirements: new Map(),
        rankTable: [
          { province: '浙江', year: 2024, category: '综合', score: 690, rank: 200, count: 150, cumulativeCount: 200 },
        ],
        province: '浙江',
        loadedAt: Date.now(),
      },
    })

    renderPage()
    const chartContainer = document.querySelector('[data-testid="rank-chart"]')
    expect(chartContainer).toBeInTheDocument()
  })
})
