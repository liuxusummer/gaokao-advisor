import { useRef, useEffect } from 'react'
import { Button, Tag } from 'antd'
import { RedoOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import type { SubjectAssessmentResult } from '../types'

const subjectNames: Record<string, string> = {
  math: '数学/逻辑',
  physics: '物理/机械',
  chemistry: '化学/实验',
  biology: '生物/生命',
  chinese: '语文/写作',
  history: '历史/文化',
  geography: '地理/环境',
  politics: '政治/社会',
  foreign_lang: '外语/交流',
  art: '艺术/审美',
  computer: '计算机/技术',
  economics: '经济/管理',
}

interface SubjectResultProps {
  result: SubjectAssessmentResult
  onReset: () => void
  onBack: () => void
}

export default function SubjectResultView({ result, onReset, onBack }: SubjectResultProps) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    const entries = Object.entries(result.subjectScores).sort((a, b) => b[1] - a[1])
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: entries.map(([key]) => subjectNames[key] || key),
        axisLabel: { rotate: 45, fontSize: 10 },
      },
      yAxis: { type: 'value', max: 5 },
      series: [
        {
          type: 'bar',
          data: entries.map(([key, val]) => ({
            value: val,
            itemStyle: { color: result.topSubjects.includes(key) ? '#059669' : '#d1d5db' },
          })),
        },
      ],
    })
    return () => chart.dispose()
  }, [result])

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <h2 className="text-lg font-bold text-text-primary mb-4">学科兴趣测评结果</h2>
      <div className="text-center mb-6">
        <p className="text-sm text-text-secondary mb-2">你的前 3 高分学科</p>
        <div className="text-2xl font-bold text-primary">
          {result.topSubjects.map((s) => subjectNames[s] || s).join('、')}
        </div>
      </div>
      <div ref={chartRef} className="w-full h-72 mb-6" />
      <div className="mb-4">
        <p className="text-sm font-medium text-text-primary mb-2">推荐专业大类</p>
        <div className="flex flex-wrap gap-2">
          {result.recommendedCategories.map((cat) => (
            <Tag key={cat} color="green">{cat}</Tag>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button icon={<RedoOutlined />} onClick={onReset}>重新测评</Button>
        <Button type="primary" onClick={onBack} className="bg-primary border-0">返回测评入口</Button>
      </div>
    </div>
  )
}
