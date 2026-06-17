import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Progress, Radio } from 'antd'
import { LeftOutlined, StarOutlined, RedoOutlined, ImportOutlined } from '@ant-design/icons'
import { hollandQuestions } from '../data/mock'
import { useAppStore } from '../store'

const options = [
  { value: 1, label: '完全不喜欢' },
  { value: 2, label: '不太喜欢' },
  { value: 3, label: '一般' },
  { value: 4, label: '比较喜欢' },
  { value: 5, label: '非常喜欢' },
]

const hollandNames: Record<string, string> = {
  R: '现实型',
  I: '研究型',
  A: '艺术型',
  S: '社会型',
  E: '企业型',
  C: '常规型',
}

export default function Assessment() {
  const navigate = useNavigate()
  const { assessmentResult, setAssessmentResult } = useAppStore()
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [current, setCurrent] = useState(0)

  const question = hollandQuestions[current]
  const progress = Math.round(((current + 1) / hollandQuestions.length) * 100)

  const handleAnswer = (value: number) => {
    setAnswers({ ...answers, [question.id]: value })
  }

  const handleNext = () => {
    if (answers[question.id] === undefined) return
    if (current < hollandQuestions.length - 1) {
      setCurrent(current + 1)
    } else {
      // Calculate result
      const scores: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }
      hollandQuestions.forEach((q) => {
        scores[q.dimension] += answers[q.id] || 0
      })
      setAssessmentResult(scores)
      setStarted(false)
    }
  }

  const reset = () => {
    setAnswers({})
    setCurrent(0)
    setAssessmentResult(null)
    setStarted(true)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button icon={<LeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">兴趣测评</h1>
      </div>

      {!started && !assessmentResult && (
        <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center text-primary text-2xl mx-auto mb-4">
            <StarOutlined />
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-2">霍兰德兴趣测评</h2>
          <p className="text-sm text-text-secondary mb-6">
            共 {hollandQuestions.length} 题，约 2 分钟完成，帮助你发现适合的专业方向。
          </p>
          <Button type="primary" size="large" onClick={() => setStarted(true)} className="bg-gradient-to-r from-primary to-primary-light border-0 shadow-primary">
            开始测评
          </Button>
        </div>
      )}

      {started && (
        <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>进度 {current + 1}/{hollandQuestions.length}</span>
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
              {current === hollandQuestions.length - 1 ? '查看结果' : '下一题'}
            </Button>
          </div>
        </div>
      )}

      {assessmentResult && !started && (
        <ResultView result={assessmentResult} onReset={reset} />
      )}
    </div>
  )
}

function ResultView({ result, onReset }: { result: Record<string, number>; onReset: () => void }) {
  const navigate = useNavigate()
  const sorted = Object.entries(result).sort((a, b) => b[1] - a[1])
  const top3 = sorted.slice(0, 3)
  const code = top3.map(([k]) => k).join('')

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <h2 className="text-lg font-bold text-text-primary mb-4">测评结果</h2>
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-primary mb-2">{code}</div>
        <p className="text-sm text-text-secondary">
          你的霍兰德代码：{top3.map(([k]) => hollandNames[k]).join(' / ')}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {sorted.map(([dim, score]) => (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-16 text-sm font-medium text-text-primary">
              {dim} {hollandNames[dim]}
            </span>
            <div className="flex-1 h-2.5 bg-bg-page rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(100, (score / 25) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right text-sm text-text-secondary">{score}</span>
          </div>
        ))}
      </div>

      <div className="bg-primary-bg rounded-xl p-4 mb-6">
        <p className="text-sm text-primary-dark">
          建议优先关注与“{top3.map(([k]) => hollandNames[k]).join('、')}”特质匹配的专业大类。
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button icon={<RedoOutlined />} onClick={onReset}>
          重新测评
        </Button>
        <Button
          type="primary"
          icon={<ImportOutlined />}
          onClick={() => navigate('/profile')}
          className="bg-primary border-0"
        >
          将结果应用到偏好
        </Button>
      </div>
    </div>
  )
}
