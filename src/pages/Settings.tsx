import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Switch, Card, message } from 'antd'
import { LeftOutlined, MoonOutlined, SunOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'

export default function Settings() {
  const navigate = useNavigate()
  const { darkMode, setDarkMode, profile, resetProfile, clearVolunteerList, clearChat } = useAppStore()
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')

  const clearAll = () => {
    resetProfile()
    clearVolunteerList()
    clearChat()
    message.success('已清除所有本地数据')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button icon={<LeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">设置</h1>
      </div>

      <div className="space-y-4">
        <Card title="个人信息" className="shadow-md">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-secondary">省份</span>
              <p className="font-medium text-text-primary">{profile.provinceName || '未设置'}</p>
            </div>
            <div>
              <span className="text-text-secondary">高考分数</span>
              <p className="font-medium text-text-primary">{profile.score || '未设置'}</p>
            </div>
            <div>
              <span className="text-text-secondary">位次</span>
              <p className="font-medium text-text-primary">{profile.rank || '未设置'}</p>
            </div>
            <div>
              <span className="text-text-secondary">选科</span>
              <p className="font-medium text-text-primary">{profile.subjects.join('+') || '未设置'}</p>
            </div>
          </div>
        </Card>

        <Card title="外观" className="shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <MoonOutlined /> : <SunOutlined />}
              <span className="text-sm text-text-primary">深色模式</span>
            </div>
            <Switch checked={darkMode} onChange={setDarkMode} className={darkMode ? 'bg-primary' : ''} />
          </div>
        </Card>

        <Card title="AI 对话配置（可选）" className="shadow-md">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Base URL</label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://open.bigmodel.cn/api/paas/v4"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">API Key</label>
              <Input.Password
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="仅存储在本地浏览器"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">模型名称</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="glm-4-plus"
              />
            </div>
            <Button type="primary" className="bg-primary border-0" onClick={() => message.info('原型演示：配置仅本地保存')}>
              保存配置
            </Button>
          </div>
        </Card>

        <Card title="数据管理" className="shadow-md">
          <div className="flex flex-wrap gap-3">
            <Button icon={<ExportOutlined />} onClick={() => message.info('原型演示：导出功能')}>导出数据</Button>
            <Button icon={<DeleteOutlined />} danger onClick={clearAll}>
              清除所有本地数据
            </Button>
          </div>
        </Card>

        <Card title="关于" className="shadow-md">
          <p className="text-sm text-text-secondary">智填志愿 v1.0</p>
          <p className="text-xs text-text-secondary mt-2">
            免责声明：本工具基于公开历史数据进行分析推荐，不保证录取结果。请以各省教育考试院官方发布为准。
          </p>
        </Card>
      </div>
    </div>
  )
}
