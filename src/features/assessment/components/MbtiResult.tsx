import { Tag } from 'antd'
import type { IntegratedAssessment } from '../types'

interface MbtiResultProps {
  assessment: IntegratedAssessment
}

export default function MbtiResult({ assessment }: MbtiResultProps) {
  if (!assessment.mbtiType) {
    return null
  }

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-6">
      <h3 className="text-base font-bold text-text-primary mb-3">MBTI 人格</h3>
      <p className="text-2xl font-bold text-primary mb-2">{assessment.mbtiType}</p>
      <p className="text-sm text-text-secondary mb-3">{assessment.mbtiCategories.join('、')}</p>
      <div className="flex flex-wrap gap-2">
        {assessment.mbtiCategories.map((cat) => (
          <Tag key={cat} color="blue">{cat}</Tag>
        ))}
      </div>
    </div>
  )
}
