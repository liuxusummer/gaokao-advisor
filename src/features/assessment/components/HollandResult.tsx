import { useRef, useEffect } from 'react'
import { Button } from 'antd'
import { RedoOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import type { HollandResult } from '../types'

const hollandNames: Record<string, string> = {
  R: '现实型',
  I: '研究型',
  A: '艺术型',
  S: '社会型',
  E: '企业型',
  C: '常规型',
}

interface HollandResultProps {
  result: HollandResult
  onReset: () => void
  onBack: () => void
}

export default function HollandResultView({ result, onReset, onBack }: HollandResultProps) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    const dims = ['R', 'I', 'A', 'S', 'E', 'C']
    chart.setOption({
      radar: {
        indicator: dims.map((d) => ({ name: `${d} ${hollandNames[d]}`, max: 10 })),
        shape: 'polygon',
        splitNumber: 5,
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: dims.map((d) => result.scores[d as keyof typeof result.scores]),
              name: '霍兰德得分',
              areaStyle: { color: 'rgba(5, 150, 105, 0.3)' },
              lineStyle: { color: '#059669' },
              itemStyle: { color: '#059669' },
            },
          ],
        },
      ],
    })
    return () => chart.dispose()
  }, [result])

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <h2 className="text-lg font-bold text-text-primary mb-4">霍兰德测评结果</h2>
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-primary mb-2">{result.code}</div>
        <p className="text-sm text-text-secondary">
          你的霍兰德代码：{result.code.split('').map((k) => hollandNames[k]).join(' / ')}
        </p>
      </div>
      <div ref={chartRef} className="w-full h-72 mb-6" />
      <div className="flex flex-wrap gap-3">
        <Button icon={<RedoOutlined />} onClick={onReset}>重新测评</Button>
        <Button type="primary" onClick={onBack} className="bg-primary border-0">返回测评入口</Button>
      </div>
    </div>
  )
}
