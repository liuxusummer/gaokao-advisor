import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RankConverter from './RankConverter'
import { useAppStore } from '../store'

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
})
