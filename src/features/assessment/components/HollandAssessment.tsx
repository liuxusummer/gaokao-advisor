import { useState, useEffect } from 'react'
import { Button, Progress, Radio, Spin } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import { hollandQuestions as fallbackQuestions } from '../../../data/mock'
import { useAppStore } from '../../../store'
import { calculateHolland } from '../services/hollandEngine'
import { loadHollandQuestions, type HollandQuestion } from '../../../services/hollandQuestions'
import HollandResultView from './HollandResult'

const options = [
  { value: 1, label: '完全不喜欢' },
  { value: 2, label: '不太喜欢' },
  { value: 3, label: '一般' },
  { value: 4, label: '比较喜欢' },
  { value: 5, label: '非常喜欢' },
]

interface HollandAssessmentProps {
  onBack: () => void
}

export default function HollandAssessment({ onBack }: HollandAssessmentProps) {
  const { assessmentResult, setAssessmentResult } = useAppStore()
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [current, setCurrent] = useState(0)
  const [questions, setQuestions] = useState<HollandQuestion[]>(fallbackQuestions)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHollandQuestions().then((qs) => {
      setQuestions(qs)
      setLoading(false)
    })
  }, [])

  const question = questions[current]
  const progress = Math.round(((current + 1) / questions.length) * 100)

  const handleAnswer = (value: number) => {
    setAnswers({ ...answers, [question.id]: value })
  }

  const handleNext = () => {
    if (answers[question.id] === undefined) return
    if (current < questions.length - 1) {
      setCurrent(current + 1)
    } else {
      const result = calculateHolland(answers, questions)
      setAssessmentResult(result.scores)
      setStarted(false)
    }
  }

  const reset = () => {
    setAnswers({})
    setCurrent(0)
    setAssessmentResult(null)
    setStarted(true)
  }

  if (!started && assessmentResult) {
    const hollandResult = calculateHolland(
      Object.fromEntries(
        questions.map((q) => [q.id, assessmentResult[q.dimension] || 0])
      ),
      questions
    )
    return <HollandResultView result={hollandResult} onReset={reset} onBack={onBack} />
  }

  if (loading) {
    return (
      <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
        <Spin tip="加载题目中..." />
      </div>
    )
  }

  if (!started) {
    return (
      <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center text-primary text-2xl mx-auto mb-4">
          <StarOutlined />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">霍兰德兴趣测评</h2>
        <p className="text-sm text-text-secondary mb-6">
          共 {questions.length} 题，约 10 分钟完成，帮助你发现适合的专业方向。
        </p>
        <Button type="primary" size="large" onClick={() => setStarted(true)} className="bg-gradient-to-r from-primary to-primary-light border-0">
          开始测评
        </Button>
      </div>
    )
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
        value={answers[question.id]}
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
          disabled={answers[question.id] === undefined}
          onClick={handleNext}
          className="bg-primary border-0"
        >
          {current === questions.length - 1 ? '查看结果' : '下一题'}
        </Button>
      </div>
    </div>
  )
}
