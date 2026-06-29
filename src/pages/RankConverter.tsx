import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { InputNumber, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import { useAppStore } from '../store'
import { loadRankTable, RANK_TABLE_YEARS, type RankTableEntry } from '../services/dataLoader'
import { convertRankToEquivalentScores, type EquivalentScore } from '../services/rankConverter'

function getCategory(subjectType: 'physics' | 'history' | 'comprehensive'): string {
  switch (subjectType) {
    case 'physics': return '物理类'
    case 'history': return '历史类'
    case 'comprehensive': return '综合'
  }
}

export default function RankConverter() {
  const navigate = useNavigate()
  const { profile, updateProfile, dataCache } = useAppStore()
  const [rankInput, setRankInput] = useState<number | null>(profile.rank)
  const [loadedEntries, setLoadedEntries] = useState<RankTableEntry[]>([])

  const category = getCategory(profile.subjectType)

  const entries = useMemo(() => {
    if (dataCache?.rankTable && dataCache.rankTable.length > 0) {
      return dataCache.rankTable
    }
    return loadedEntries
  }, [dataCache, loadedEntries])

  useEffect(() => {
    if (dataCache?.rankTable && dataCache.rankTable.length > 0) return
    if (!profile.provinceName) return
    let mounted = true
    Promise.all(
      RANK_TABLE_YEARS.map((year) => loadRankTable(profile.provinceName, year).catch(() => []))
    ).then((entriesByYear) => {
      if (mounted) {
        setLoadedEntries(entriesByYear.flat())
      }
    })
    return () => { mounted = false }
  }, [dataCache, profile.provinceName])

  const entriesByYear = useMemo(() => {
    const map = new Map<number, RankTableEntry[]>()
    for (const entry of entries) {
      if (entry.category !== category) continue
      if (!map.has(entry.year)) map.set(entry.year, [])
      map.get(entry.year)!.push(entry)
    }
    return map
  }, [entries, category])

  const results: EquivalentScore[] = useMemo(() => {
    if (!rankInput || rankInput <= 0 || entriesByYear.size === 0) return []
    return convertRankToEquivalentScores(rankInput, entriesByYear)
  }, [rankInput, entriesByYear])

  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current || results.length === 0) return
    const chart = echarts.init(chartRef.current)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 30, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: results.map((r) => String(r.year)),
        name: '年份',
      },
      yAxis: {
        type: 'value',
        name: '等效分',
        scale: true,
      },
      series: [
        {
          type: 'line',
          data: results.map((r) => r.equivalentScore),
          smooth: true,
          label: { show: true, position: 'top' },
          itemStyle: { color: '#059669' },
          lineStyle: { color: '#059669' },
        },
      ],
    })
    return () => chart.dispose()
  }, [results])

  const handleRankChange = (v: number | null) => {
    setRankInput(v)
    if (v && v > 0) {
      updateProfile({ rank: v })
    }
  }

  const hasData = entriesByYear.size > 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">等效位次换算</h1>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/profile')}>返回</Button>
      </div>

      <div className="bg-bg-card rounded-2xl shadow-md p-4 mb-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <span className="text-sm text-text-secondary">省份</span>
            <p className="font-medium text-text-primary">{profile.provinceName || '未设置'}</p>
          </div>
          <div>
            <span className="text-sm text-text-secondary">科类</span>
            <p className="font-medium text-text-primary">{category}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">当年位次</label>
          <InputNumber
            min={1}
            value={rankInput || undefined}
            onChange={handleRankChange}
            placeholder="请输入当年位次"
            className="w-full"
          />
        </div>
        {profile.score && (
          <p className="text-sm text-text-secondary mt-2">当年分数：{profile.score}</p>
        )}
      </div>

      {!rankInput && (
        <div className="text-center py-8 text-text-secondary">
          请输入当年位次
        </div>
      )}

      {rankInput && !hasData && (
        <div className="text-center py-8 text-text-secondary">
          <p>当前省份暂无一分一段表数据</p>
          <Button type="link" onClick={() => navigate('/profile')}>返回画像页</Button>
        </div>
      )}

      {rankInput && hasData && results.length > 0 && (
        <div className="bg-bg-card rounded-2xl shadow-md p-4 mb-4">
          <h2 className="text-lg font-bold text-text-primary mb-3">等效分表格</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color text-text-secondary">
                <th className="text-left py-2">年份</th>
                <th className="text-left py-2">等效分</th>
                <th className="text-left py-2">等效位次</th>
                <th className="text-left py-2">命中</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.year} className="border-b border-border-color/50">
                  <td className="py-2 text-text-primary">{r.year}</td>
                  <td className="py-2 text-text-primary font-medium">{r.equivalentScore}</td>
                  <td className="py-2 text-text-body">{r.equivalentRank}</td>
                  <td className="py-2">
                    {r.exactMatch ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">精确</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">近似</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rankInput && hasData && results.length > 0 && (
        <div className="bg-bg-card rounded-2xl shadow-md p-4 mb-4">
          <h2 className="text-lg font-bold text-text-primary mb-3">等效分趋势</h2>
          <div ref={chartRef} data-testid="rank-chart" className="w-full h-72" />
        </div>
      )}

      {rankInput && hasData && results.length > 0 && (
        <div className="text-xs text-text-secondary space-y-1">
          <p>数据来源：各省考试院一分一段表</p>
          <p>近似命中表示位次落在分数段内，取该段最低分</p>
        </div>
      )}
    </div>
  )
}
