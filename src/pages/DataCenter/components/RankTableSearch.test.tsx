import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RankTableSearch from './RankTableSearch'
import { loadRankTable, probeRankTableYears } from '../../../services/dataLoader'

// loadRankTable 返回扁平的 RankTableEntry[]（字段：province/year/category/score/rank/count/cumulativeCount）
// vi.mock 工厂函数会被提升到文件顶部，因此使用 vi.hoisted 保证 mock 数据同样被提升
const { mockEntries } = vi.hoisted(() => ({
  mockEntries: [
    { province: 'beijing', year: 2025, category: '物理类', score: 600, rank: 1000, count: 50, cumulativeCount: 1050 },
    { province: 'beijing', year: 2025, category: '物理类', score: 599, rank: 1100, count: 30, cumulativeCount: 1030 },
  ],
}))

vi.mock('../../../services/dataLoader', () => ({
  probeRankTableYears: vi.fn().mockResolvedValue([2025, 2024]),
  loadRankTable: vi.fn().mockResolvedValue(mockEntries),
  getProvinceName: vi.fn((id: string) => ({ '11': '北京' }[id])),
}))

const renderComponent = (props = {}) => {
  return render(
    <MemoryRouter>
      <RankTableSearch provinceId="11" provinceName="beijing" {...props} />
    </MemoryRouter>
  )
}

describe('RankTableSearch', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('渲染年份和科类选择器', async () => {
    renderComponent()
    await waitFor(() => expect(screen.getByText('北京 一分一段表')).toBeInTheDocument())
    expect(screen.getByText('年份')).toBeInTheDocument()
    expect(screen.getByText('科类')).toBeInTheDocument()
  })

  it('加载并显示一分一段表数据', async () => {
    renderComponent()
    await waitFor(() => expect(screen.getByText('600')).toBeInTheDocument())
    expect(screen.getByText('1000')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument() // 同分人数 count
  })

  it('搜索框输入分数后过滤表格', async () => {
    renderComponent()
    await waitFor(() => expect(screen.getByText('600')).toBeInTheDocument())
    const input = screen.getByPlaceholderText('输入分数、位次、同分人数或累计人数过滤')
    fireEvent.change(input, { target: { value: '600' } })
    expect(screen.getByText('600')).toBeInTheDocument()
    expect(screen.queryByText('599')).not.toBeInTheDocument()
  })

  it('无数据省份显示 Empty', async () => {
    vi.mocked(loadRankTable).mockResolvedValueOnce([])
    vi.mocked(probeRankTableYears).mockResolvedValueOnce([])
    renderComponent({ provinceName: 'unknown' })
    await waitFor(() => expect(screen.getByText('该省份暂无可查年份的一分一段表数据')).toBeInTheDocument())
  })

  it('未选择省份时显示提示', () => {
    renderComponent({ provinceName: '' })
    expect(screen.getByText('请先完善省份信息')).toBeInTheDocument()
  })
})
