import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { LeftOutlined } from '@ant-design/icons'
import AssessmentEntry from '../features/assessment/components/AssessmentEntry'
import HollandAssessment from '../features/assessment/components/HollandAssessment'
import SubjectAssessment from '../features/assessment/components/SubjectAssessment'

type View = 'entry' | 'holland' | 'subject'

export default function Assessment() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('entry')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button icon={<LeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">兴趣测评</h1>
      </div>

      {view === 'entry' && (
        <AssessmentEntry
          onSelectHolland={() => setView('holland')}
          onSelectSubject={() => setView('subject')}
        />
      )}

      {view === 'holland' && (
        <HollandAssessment onBack={() => setView('entry')} />
      )}

      {view === 'subject' && (
        <SubjectAssessment onBack={() => setView('entry')} />
      )}
    </div>
  )
}
