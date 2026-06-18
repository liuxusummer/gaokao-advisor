import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from './Settings'
import { useAppStore } from '../store'

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  )
}

describe('Settings AI 配置', () => {
  beforeEach(() => {
    useAppStore.setState({
      aiConfig: { baseUrl: '', apiKey: '', model: '' },
      darkMode: false,
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
      },
      volunteerList: [],
    })
  })

  it('三个输入框初始为空', () => {
    renderSettings()
    const baseInput = screen.getByPlaceholderText('https://open.bigmodel.cn/api/paas/v4')
    const modelInput = screen.getByPlaceholderText('glm-4-plus')
    expect(baseInput).toHaveValue('')
    expect(modelInput).toHaveValue('')
  })

  it('修改 Base URL 实时同步到 store', () => {
    renderSettings()
    const baseInput = screen.getByPlaceholderText('https://open.bigmodel.cn/api/paas/v4')
    fireEvent.change(baseInput, { target: { value: 'https://api.test.com/v1' } })
    expect(useAppStore.getState().aiConfig.baseUrl).toBe('https://api.test.com/v1')
  })

  it('修改 API Key 实时同步到 store', () => {
    renderSettings()
    const keyInput = screen.getByPlaceholderText('仅存储在本地浏览器')
    fireEvent.change(keyInput, { target: { value: 'sk-abc' } })
    expect(useAppStore.getState().aiConfig.apiKey).toBe('sk-abc')
  })

  it('修改模型名称实时同步到 store', () => {
    renderSettings()
    const modelInput = screen.getByPlaceholderText('glm-4-plus')
    fireEvent.change(modelInput, { target: { value: 'gpt-4' } })
    expect(useAppStore.getState().aiConfig.model).toBe('gpt-4')
  })

  it('store 中的配置反映到输入框', () => {
    useAppStore.setState({
      aiConfig: { baseUrl: 'https://existing.com', apiKey: 'sk-existing', model: 'existing-model' },
    })
    renderSettings()
    expect(screen.getByPlaceholderText('https://open.bigmodel.cn/api/paas/v4')).toHaveValue('https://existing.com')
    expect(screen.getByPlaceholderText('仅存储在本地浏览器')).toHaveValue('sk-existing')
    expect(screen.getByPlaceholderText('glm-4-plus')).toHaveValue('existing-model')
  })

  it('不显示"保存配置"按钮', () => {
    renderSettings()
    expect(screen.queryByRole('button', { name: /保存配置/ })).not.toBeInTheDocument()
  })
})
