import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MbtiCard from './MbtiCard'
import { useAppStore } from '../../../store'

vi.mock('../services/mbtiMapper', () => ({
  loadMbtiMapping: vi.fn().mockResolvedValue({
    INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: '富有想象力又有战略思维' },
    ENFP: { name: '竞选者', categories: ['艺术学', '文学', '教育学'], description: '热情有创意' },
  }),
}))

describe('MbtiCard', () => {
  beforeEach(() => {
    useAppStore.setState({
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
        mbtiType: null,
      },
    })
  })

  it('未选择状态渲染标题和外链', async () => {
    render(<MbtiCard />)
    expect(screen.getByText('MBTI 人格测评')).toBeInTheDocument()
    const link = screen.getByText(/不知道自己的人格？点击测评/).closest('a')
    expect(link).toHaveAttribute('href', 'https://www.16personalities.com/chinese-personality-test')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('选择下拉项后调用 updateProfile', async () => {
    render(<MbtiCard />)
    // 等待映射加载完成
    const select = await screen.findByRole('combobox')
    fireEvent.mouseDown(select)
    // Ant Design Select 选项在 portal 中
    const option = await screen.findByText('INTJ - 建筑师')
    fireEvent.click(option)
    expect(useAppStore.getState().profile.mbtiType).toBe('INTJ')
  })

  it('已选择状态渲染类型名称和匹配专业大类', async () => {
    useAppStore.setState({
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
        mbtiType: 'INTJ',
      },
    })
    render(<MbtiCard />)
    expect(await screen.findByText('INTJ 建筑师')).toBeInTheDocument()
    expect(screen.getByText('工学')).toBeInTheDocument()
    expect(screen.getByText('理学')).toBeInTheDocument()
    expect(screen.getByText('经济学')).toBeInTheDocument()
  })

  it('点击修改按钮切换回选择状态', async () => {
    useAppStore.setState({
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
        mbtiType: 'INTJ',
      },
    })
    render(<MbtiCard />)
    const editBtn = await screen.findByText('修改')
    fireEvent.click(editBtn)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
