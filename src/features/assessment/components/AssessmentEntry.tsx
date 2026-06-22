import { useEffect, useState } from 'react'
import { Button, Tag, message } from 'antd'
import { StarOutlined, BookOutlined, CheckCircleOutlined, ImportOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../store'
import { integrateResults } from '../services/resultIntegrator'
import { loadMajorMapping } from '../services/majorMatcher'
import { loadMbtiMapping } from '../services/mbtiMapper'
import MbtiCard from './MbtiCard'

const subjectNames: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', biology: '生物',
  chinese: '语文', history: '历史', geography: '地理', politics: '政治',
  foreign_lang: '外语', art: '艺术', computer: '计算机', economics: '经济',
}

const confidenceConfig = {
  high: { color: 'green', label: '高置信度' },
  medium: { color: 'gold', label: '中置信度' },
  low: { color: 'default', label: '低置信度' },
}

interface AssessmentEntryProps {
  onSelectHolland: () => void
  onSelectSubject: () => void
}

export default function AssessmentEntry({ onSelectHolland, onSelectSubject }: AssessmentEntryProps) {
  const {
    assessmentResult,
    subjectAssessmentResult,
    integratedAssessment,
    setIntegratedAssessment,
    updateProfile,
    profile,
  } = useAppStore()
  const [mapping, setMapping] = useState<Record<string, string[]>>({})
  const [mbtiMapping, setMbtiMapping] = useState<Record<string, { name: string; categories: string[]; description: string }> | null>(null)

  useEffect(() => {
    loadMajorMapping().then(setMapping)
  }, [])

  useEffect(() => {
    loadMbtiMapping().then(setMbtiMapping)
  }, [])

  useEffect(() => {
    if (assessmentResult && subjectAssessmentResult && Object.keys(mapping).length > 0) {
      const integrated = integrateResults(
        assessmentResult,
        subjectAssessmentResult,
        mapping,
        profile.mbtiType,
        mbtiMapping
      )
      setIntegratedAssessment(integrated)
    }
  }, [assessmentResult, subjectAssessmentResult, mapping, profile.mbtiType, mbtiMapping, setIntegratedAssessment])

  const handleApplyToProfile = () => {
    if (!integratedAssessment) return
    updateProfile({ categories: integratedAssessment.agreedCategories })
    message.success('已应用到推荐偏好')
  }

  const showIntegration = Boolean(assessmentResult && subjectAssessmentResult && integratedAssessment)

  return (
    <div className="space-y-4">
      {showIntegration && integratedAssessment && (
        <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-6 border-2 border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">测评整合结果</h2>
            <Tag color={confidenceConfig[integratedAssessment.confidence].color}>
              {confidenceConfig[integratedAssessment.confidence].label}
            </Tag>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-text-secondary mb-1">霍兰德代码</p>
              <p className="text-lg font-bold text-primary">{integratedAssessment.hollandCode}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">学科兴趣前 3</p>
              <p className="text-sm font-medium text-text-primary">
                {integratedAssessment.topSubjects.map((s) => subjectNames[s] || s).join('、')}
              </p>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2">交叉验证一致的专业大类</p>
            <div className="flex flex-wrap gap-2">
              {integratedAssessment.agreedCategories.length > 0 ? (
                integratedAssessment.agreedCategories.map((cat) => (
                  <Tag key={cat} color="green">{cat}</Tag>
                ))
              ) : (
                <span className="text-sm text-text-secondary">暂无一致专业大类</span>
              )}
            </div>
          </div>
          {integratedAssessment.mbtiType && integratedAssessment.mbtiCategories.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-text-secondary mb-2">
                MBTI 人格匹配专业大类（{integratedAssessment.mbtiType}）
              </p>
              <div className="flex flex-wrap gap-2">
                {integratedAssessment.mbtiCategories.map((cat) => (
                  <Tag key={cat} color="blue">{cat}</Tag>
                ))}
              </div>
            </div>
          )}
          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={handleApplyToProfile}
            className="bg-primary border-0"
          >
            应用到推荐偏好
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={onSelectHolland}
          className="bg-bg-card rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/30"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl">
              <StarOutlined />
            </div>
            {assessmentResult && (
              <CheckCircleOutlined className="text-primary text-xl" />
            )}
          </div>
          <h3 className="text-base font-bold text-text-primary mb-2">霍兰德兴趣测评</h3>
          <p className="text-sm text-text-secondary mb-4">
            12 题，约 2 分钟。通过 RIASEC 六维度模型发现你的职业兴趣类型。
          </p>
          <Button type="primary" size="small" className="bg-primary border-0">
            {assessmentResult ? '重新测评' : '开始测评'}
          </Button>
        </div>

        <div
          onClick={onSelectSubject}
          className="bg-bg-card rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/30"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl">
              <BookOutlined />
            </div>
            {subjectAssessmentResult && (
              <CheckCircleOutlined className="text-primary text-xl" />
            )}
          </div>
          <h3 className="text-base font-bold text-text-primary mb-2">学科兴趣测评</h3>
          <p className="text-sm text-text-secondary mb-4">
            15 题，约 3 分钟。发现你感兴趣的学科方向并推荐匹配专业大类。
          </p>
          <Button type="primary" size="small" className="bg-primary border-0">
            {subjectAssessmentResult ? '重新测评' : '开始测评'}
          </Button>
        </div>

        <MbtiCard />
      </div>

      {!showIntegration && assessmentResult && !subjectAssessmentResult && (
        <p className="text-center text-sm text-text-secondary">
          完成学科兴趣测评后可查看整合结果
        </p>
      )}
      {!showIntegration && !assessmentResult && subjectAssessmentResult && (
        <p className="text-center text-sm text-text-secondary">
          完成霍兰德测评后可查看整合结果
        </p>
      )}
    </div>
  )
}
