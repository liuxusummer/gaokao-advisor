import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store'
import SchemeCompare from './SchemeCompare'

const mockItem = (id: string, collegeId: string, collegeName: string, majorName: string) => ({
  id,
  college: { id: collegeId, name: collegeName },
  major: { id: `m-${id}`, name: majorName },
  tier: 'rush',
  probability: 50,
  locked: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

const renderPage = () => render(<MemoryRouter><SchemeCompare /></MemoryRouter>)

describe('SchemeCompare', () => {
  beforeEach(() => {
    useAppStore.setState({ schemes: [] })
    vi.clearAllMocks()
  })

  it('无方案时显示 Empty', () => {
    renderPage()
    expect(screen.getByText(/暂无保存的方案/)).toBeInTheDocument()
  })

  it('默认显示并排对比模式并默认选中前两套方案', async () => {
    useAppStore.setState({
      schemes: [
        { id: 's1', name: '方案A', items: [mockItem('v1', 'c1', '北大', '计算机')], createdAt: 0, updatedAt: 0 },
        { id: 's2', name: '方案B', items: [mockItem('v2', 'c2', '清华', '软件')], createdAt: 0, updatedAt: 0 },
      ],
    })
    renderPage()
    expect(screen.getByText('并排对比')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('北大')).toBeInTheDocument()
      expect(screen.getByText('清华')).toBeInTheDocument()
    })
  })

  it('切换到单套查看模式', async () => {
    useAppStore.setState({
      schemes: [{
        id: 's1', name: '方案A', items: [mockItem('v1', 'c1', '北大', '计算机')],
        createdAt: 0, updatedAt: 0,
      }],
    })
    renderPage()
    await userEvent.click(screen.getByText('单套查看'))
    await waitFor(() => {
      expect(screen.getByText('北大')).toBeInTheDocument()
      expect(screen.getByText('加载到志愿表')).toBeInTheDocument()
    })
  })

  it('并排对比取消选择后隐藏对应方案', async () => {
    useAppStore.setState({
      schemes: [
        { id: 's1', name: 'A', items: [mockItem('v1', 'c1', '北大', '计算机')], createdAt: 0, updatedAt: 0 },
        { id: 's2', name: 'B', items: [mockItem('v2', 'c2', '清华', '软件')], createdAt: 0, updatedAt: 0 },
        { id: 's3', name: 'C', items: [mockItem('v3', 'c3', '复旦', '经济')], createdAt: 0, updatedAt: 0 },
      ],
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('北大')).toBeInTheDocument()
      expect(screen.getByText('清华')).toBeInTheDocument()
    })
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[1])
    await waitFor(() => {
      expect(screen.queryByText('清华')).not.toBeInTheDocument()
    })
    await userEvent.click(checkboxes[2])
    await waitFor(() => {
      expect(screen.getByText('复旦')).toBeInTheDocument()
    })
  })
})
