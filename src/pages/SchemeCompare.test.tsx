import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store'
import SchemeCompare from './SchemeCompare'

const mockItem = (id: string, collegeId: string, collegeName: string, majorName: string) => ({
  id,
  college: { id: collegeId, name: collegeName },
  major: { id: `m-${id}`, name: majorName },
  tier: 'rush',
  probability: 0.5,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

const renderPage = () => render(<MemoryRouter><SchemeCompare /></MemoryRouter>)

describe('SchemeCompare', () => {
  beforeEach(() => {
    useAppStore.setState({ schemes: [] })
  })

  it('无方案时显示 Empty', () => {
    renderPage()
    expect(screen.getByText(/暂无保存的方案/)).toBeInTheDocument()
  })

  it('默认显示并排对比模式', () => {
    useAppStore.setState({
      schemes: [{
        id: 's1', name: '方案A', items: [mockItem('v1', 'c1', '北大', '计算机')],
        createdAt: 0, updatedAt: 0,
      }],
    })
    renderPage()
    expect(screen.getByText('并排对比')).toBeInTheDocument()
  })

  it('切换到单套查看模式', () => {
    useAppStore.setState({
      schemes: [{
        id: 's1', name: '方案A', items: [mockItem('v1', 'c1', '北大', '计算机')],
        createdAt: 0, updatedAt: 0,
      }],
    })
    renderPage()
    fireEvent.click(screen.getByText('单套查看'))
    expect(screen.getByText('北大')).toBeInTheDocument()
  })

  it('并排对比选择 2 套方案后显示两列表格', () => {
    useAppStore.setState({
      schemes: [
        { id: 's1', name: 'A', items: [mockItem('v1', 'c1', '北大', '计算机')], createdAt: 0, updatedAt: 0 },
        { id: 's2', name: 'B', items: [mockItem('v2', 'c2', '清华', '软件')], createdAt: 0, updatedAt: 0 },
      ],
    })
    renderPage()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    expect(screen.getByText('北大')).toBeInTheDocument()
    expect(screen.getByText('清华')).toBeInTheDocument()
  })
})
