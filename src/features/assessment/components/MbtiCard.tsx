import { useEffect, useState } from 'react'
import { Select, Tag, Button } from 'antd'
import { SolutionOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../store'
import { loadMbtiMapping } from '../services/mbtiMapper'
import type { MbtiMappingRecord } from '../types'

const MBTI_TEST_URL = 'https://www.16personalities.com/free-personality-test'

export default function MbtiCard() {
  const { profile, updateProfile } = useAppStore()
  const [mapping, setMapping] = useState<MbtiMappingRecord | null>(null)
  const [editing, setEditing] = useState(!profile.mbtiType)

  useEffect(() => {
    loadMbtiMapping().then(setMapping)
  }, [])

  const currentMbti = profile.mbtiType
  const currentMapping = currentMbti && mapping ? mapping[currentMbti] : null

  const options = mapping
    ? Object.entries(mapping).map(([code, info]) => ({
        value: code,
        label: `${code} - ${info.name}`,
      }))
    : []

  const handleChange = (value: string) => {
    updateProfile({ mbtiType: value })
    setEditing(false)
  }

  const handleEdit = () => {
    setEditing(true)
  }

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-6 border-2 border-transparent hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl">
          <SolutionOutlined />
        </div>
        {currentMbti && !editing && (
          <Button size="small" icon={<EditOutlined />} onClick={handleEdit}>
            修改
          </Button>
        )}
      </div>

      <h3 className="text-base font-bold text-text-primary mb-2">MBTI 人格测评</h3>

      {currentMbti && !editing && currentMapping ? (
        <div>
          <p className="text-lg font-bold text-primary mb-1">
            {currentMbti} {currentMapping.name}
          </p>
          <p className="text-sm text-text-secondary mb-3">{currentMapping.description}</p>
          <p className="text-xs text-text-secondary mb-2">匹配专业大类</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {currentMapping.categories.map((cat) => (
              <Tag key={cat} color="blue">{cat}</Tag>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-text-secondary mb-3">
            选择你的 MBTI 人格类型，优化专业推荐
          </p>
          <Select
            placeholder="选择你的人格类型"
            options={options}
            onChange={handleChange}
            className="w-full mb-3"
            value={undefined}
          />
          <a
            href={MBTI_TEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            不知道自己的人格？点击测评 <LinkOutlined />
          </a>
        </div>
      )}
    </div>
  )
}
