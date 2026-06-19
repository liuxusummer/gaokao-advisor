import { useState, useEffect } from 'react'
import { Button, Progress, Radio, message } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../store'
import { loadSubjectQuestions, calculateSubjectScores } from '../services/subjectEngine'
import { loadMajorMapping, matchMajors } from '../services/majorMatcher'
import SubjectResultView from './SubjectResult'
import type { SubjectQuestion, SubjectAssessmentResult } from '../types'

const options = [
  { value: 1, label: '完全不喜欢' },
  { value: 2, label: '不太喜欢' },
  { value: 3, label: '一般' },
  { value: 4, label: '比较喜欢' },
  { value: 5, label: '非常喜欢' },
]

interface SubjectAssessmentProps {
  onBack: () => void
}

export default function SubjectAssessment({ onBack }: SubjectAssessmentProps) {
  const { subjectAssessmentResult, setSubjectAssessmentResult } = useAppStore()
  const [started, setStarted] = useState(false)
  const [questions, setQuestions] = useState<SubjectQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (started && questions.length === 0) {
      loadSubjectQuestions().then((qs) => {
        if (qs.length === 0) {
          message.error('题库加载失败，请稍后重试')
          setStarted(false)
        } else {
          setQuestions(qs)
        }
      })
    }
  }, [started, questions.length])

  const question = questions[current]
  const progress = questions.length > 0 ? Math.round(((current + 1) / questions.length) * 100) : 0

  const handleAnswer = (value: number) => {
    if (!question) return
    setAnswers({ ...answers, [question.id]: value })
  }

  const handleNext = async () => {
    if (!question || answers[question.id] === undefined) return
    if (current < questions.length - 1) {
      setCurrent(current + 1)
    } else {
      const scores = calculateSubjectScores(answers, questions)
      const mapping = await loadMajorMapping()
      const categories = matchMajors(scores.topSubjects, mapping)
      const result: SubjectAssessmentResult = {
        ...scores,
        recommendedCategories: categories,
        timestamp: Date.now(),
      }
      setSubjectAssessmentResult(result)
      setStarted(false)
    }
  }

  const reset = () => {
    setAnswers({})
    setCurrent(0)
    setSubjectAssessmentResult(null)
    setStarted(true)
  }

  if (!started && subjectAssessmentResult) {
    return <SubjectResultView result={subjectAssessmentResult} onReset={reset} onBack={onBack} />
  }

  if (!started) {
    return (
      <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center text-primary text-2xl mx-auto mb-4">
          <BookOutlined />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">学科兴趣测评</h2>
        <p className="text-sm text-text-secondary mb-6">
          共 15 题，约 3 分钟完成，发现你感兴趣的学科方向并推荐匹配专业。
        </p>
        <Button type="primary" size="large" onClick={() => setStarted(true)} className="bg-gradient-to-r from-primary to-primary-light border-0">
          开始测评
        </Button>
      </div>
    )
  }

  if (questions.length === 0) {
    return <div className="text-center py-8 text-text-secondary">题库加载中...</div>
  }

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-text-secondary mb-2">
          <span>进度 {current + 1}/{questions.length}</span>
          <span>{progress}%</span>
        </div>
        <Progress percent={progress} showInfo={false} strokeColor="#059669" trailColor="var(--border-color)" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-6">{question.text}</h2>
      <Radio.Group
        onChange={(e) => handleAnswer(e.target.value)}
        value={question ? answers[question.id] : undefined}
        className="w-full"
      >
        <div className="grid grid-cols-1 gap-3">
          {options.map((opt) => (
            <Radio.Button
              key={opt.value}
              value={opt.value}
              className="h-auto py-3 px-4 text-left rounded-lg border-border-color hover:border-primary hover:text-primary"
            >
              {opt.label}
            </Radio.Button>
          ))}
        </div>
      </Radio.Group>
      <div className="flex justify-end mt-8">
        <Button
          type="primary"
          size="large"
          disabled={!question || answers[question.id] === undefined}
          onClick={handleNext}
          className="bg-primary border-0"
        >
          {current === questions.length - 1 ? '查看结果' : '下一题'}
        </Button>
      </div>
    </div>
  )
}
