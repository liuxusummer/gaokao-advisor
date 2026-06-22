import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Tag, Select, message, Collapse, Slider } from 'antd'
import {
  PlusOutlined,
  FileTextOutlined,
  BookOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'
import { generateRecommendations } from '../services/recommender'
import { type RecommendationItem } from '../data/mock'
import { loadMajorMapping } from '../features/assessment/services/majorMatcher'
import { deriveHollandCategories, type AssessmentInput } from '../services/rankScorer'
import CollegeNameLink from '../components/CollegeNameLink'

const { Panel } = Collapse

const tierLabels = {
  rush: { text: '冲', color: 'text-tier-rush', bg: 'bg-tier-rush/10' },
  stable: { text: '稳', color: 'text-tier-stable', bg: 'bg-tier-stable/10' },
  safe: { text: '保', color: 'text-tier-safe', bg: 'bg-tier-safe/10' },
}

export default function Recommend() {
  const navigate = useNavigate()
  const {
    profile, recommendations, setRecommendations, addVolunteer, volunteerList,
    loadProvinceData,
    recommendWeights, setRecommendWeights, resetRecommendWeights,
    integratedAssessment, subjectAssessmentResult,
  } = useAppStore()
  const [activeTier, setActiveTier] = useState<'rush' | 'stable' | 'safe'>('stable')
  const [sortBy, setSortBy] = useState<'probability' | 'rank' | 'tuition'>('probability')
  const [regenerating, setRegenerating] = useState(false)

  const filtered = useMemo(() => {
    let list = recommendations.filter((r) => r.tier === activeTier)
    if (sortBy === 'probability') {
      list = [...list].sort((a, b) => b.probability - a.probability)
    } else if (sortBy === 'tuition') {
      list = [...list].sort((a, b) => (a.major.tuition || 0) - (b.major.tuition || 0))
    } else if (sortBy === 'rank') {
      const weight = (c: RecommendationItem['college']) => {
        if (c.tags?.includes('985')) return 3
        if (c.tags?.includes('211')) return 2
        return 1
      }
      list = [...list].sort((a, b) => weight(b.college) - weight(a.college))
    }
    return list
  }, [recommendations, activeTier, sortBy])

  const counts = useMemo(() => {
    return {
      rush: recommendations.filter((r) => r.tier === 'rush').length,
      stable: recommendations.filter((r) => r.tier === 'stable').length,
      safe: recommendations.filter((r) => r.tier === 'safe').length,
    }
  }, [recommendations])

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const cache = await loadProvinceData(profile.provinceId)
      const majorMapping = await loadMajorMapping()
      const assessment: AssessmentInput = {
        hollandCategories: deriveHollandCategories(integratedAssessment?.hollandCode, majorMapping),
        subjectCategories: subjectAssessmentResult?.recommendedCategories ?? [],
        mbtiCategories: integratedAssessment?.mbtiCategories ?? [],
      }
      const recs = await generateRecommendations(profile, cache || undefined, {
        weights: recommendWeights,
        assessment,
      })
      setRecommendations(recs)
      message.success('已重新生成推荐')
    } catch (err) {
      message.error('重新生成失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setRegenerating(false)
    }
  }

  const handleAdd = (item: RecommendationItem) => {
    if (volunteerList.some((v) => v.college.id === item.college.id && v.major.id === item.major.id)) {
      message.warning('该志愿已在志愿表中')
      return
    }
    addVolunteer({
      college: item.college,
      major: item.major,
      tier: item.tier,
      probability: item.probability,
      minRank: item.minRanks[0]?.rank,
    })
    message.success('已加入志愿表')
  }

  if (!profile.score) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Empty description="还没有成绩信息，先去完善志愿画像吧" />
        <Button type="primary" className="mt-6 bg-primary" onClick={() => navigate('/profile')}>
          去填写
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary">为你推荐的志愿</h1>
          <p className="text-sm text-text-secondary mt-1">
            基于 {profile.provinceName} · 位次 {profile.rank} · 共 {recommendations.length} 个推荐
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'probability', label: '按录取概率' },
              { value: 'rank', label: '按院校层次' },
              { value: 'tuition', label: '按学费从低到高' },
            ]}
            className="w-36"
          />
          <Button icon={<ReloadOutlined />} onClick={handleRegenerate} loading={regenerating}>
            重新生成
          </Button>
        </div>
      </div>

      {/* 高级设置：权重调整 */}
      <Collapse className="mb-4">
        <Panel header="高级设置（推荐权重调整）" key="weights">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <WeightSlider label="录取概率" value={recommendWeights.probability}
              onChange={(v) => setRecommendWeights({ probability: v })} />
            <WeightSlider label="院校层次" value={recommendWeights.collegeLevel}
              onChange={(v) => setRecommendWeights({ collegeLevel: v })} />
            <WeightSlider label="专业兴趣" value={recommendWeights.majorInterest}
              onChange={(v) => setRecommendWeights({ majorInterest: v })} />
            <WeightSlider label="地域偏好" value={recommendWeights.region}
              onChange={(v) => setRecommendWeights({ region: v })} />
            <WeightSlider label="学费" value={recommendWeights.tuition}
              onChange={(v) => setRecommendWeights({ tuition: v })} />
            <WeightSlider label="就业前景" value={recommendWeights.employment}
              onChange={(v) => setRecommendWeights({ employment: v })} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              当前权重总和：{Object.values(recommendWeights).reduce((a, b) => a + b, 0)}（无需等于 100，系统会自动归一化）
            </span>
            <Button size="small" onClick={resetRecommendWeights}>恢复默认</Button>
          </div>
        </Panel>
      </Collapse>

      {/* Tier Tabs */}
      <div className="flex gap-2 mb-5">
        {( ['rush', 'stable', 'safe'] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => setActiveTier(tier)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              activeTier === tier
                ? `${tierLabels[tier].bg} ${tierLabels[tier].color} border-current`
                : 'bg-bg-card text-text-secondary border-border-color hover:border-primary'
            }`}
          >
            {tierLabels[tier].text} ({counts[tier]})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <VolunteerCard key={item.id} item={item} onAdd={() => handleAdd(item)} />
        ))}
        {filtered.length === 0 && (
          <Empty description="该梯度暂无推荐，可调整筛选条件或偏好" />
        )}
      </div>

      <div className="mt-8 p-4 bg-primary-bg rounded-xl text-sm text-primary-dark flex items-start gap-2">
        <BookOutlined className="mt-0.5" />
        <div>
          <p className="font-medium">数据说明</p>
          <p className="mt-1 opacity-80">
            推荐结果基于近三年录取位次估算，录取概率仅供参考。请以各省教育考试院官方发布为准。
          </p>
        </div>
      </div>
    </div>
  )
}

function WeightSlider({ label, value, onChange }: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-text-body">{label}</span>
        <span className="text-text-secondary">{value}</span>
      </div>
      <Slider min={0} max={50} step={5} value={value} onChange={onChange} />
    </div>
  )
}

function VolunteerCard({ item, onAdd }: { item: RecommendationItem; onAdd: () => void }) {
  const [expanded, setExpanded] = useState(true)
  const tier = tierLabels[item.tier]

  return (
    <div className="bg-bg-card rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CollegeNameLink college={item.college} className="text-base" />
            <span className="text-text-secondary">·</span>
            <span className="font-semibold text-text-primary">{item.major.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {item.college.tags?.map((l) => (
              <Tag key={l} color={l === '985' ? 'success' : l === '211' ? 'blue' : 'default'} className="m-0">
                {l}
              </Tag>
            ))}
            <span className="text-xs text-text-secondary">{item.college.province}{item.college.city}</span>
            {item.major.subjects && item.major.subjects.length > 0 && (
              <span className="text-xs text-text-secondary">选科：{item.major.subjects.join('+')}</span>
            )}
            {item.major.duration && <span className="text-xs text-text-secondary">{item.major.duration}年</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${tier.bg} ${tier.color}`}>
            {tier.text} {item.probability}%
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border-color">
          <div className="bg-primary-bg rounded-lg p-3 mb-3">
            <p className="text-sm font-medium text-primary-dark mb-1">为什么推荐？</p>
            <p className="text-sm text-text-body">{item.reason}</p>
            <div className="mt-2 text-xs text-text-secondary">
              近三年位次：
              {item.minRanks.map((r) => `${r.year} ${r.rank}名`).join(' / ')}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary mb-3 flex-wrap">
            <BookOutlined />
            <span className="text-text-secondary">来源：</span>
            <SourceLink href={item.college.admissionUrl || item.college.website} label="本科招生网" />
            <span className="text-text-secondary">·</span>
            <SourceLink href={item.college.gaokaoUrl || 'https://gaokao.chsi.com.cn/'} label="阳光高考网" />
            <span className="text-text-secondary">·</span>
            <span className="text-text-secondary">各省教育考试院</span>
          </div>
          <div className="flex gap-2">
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd} className="bg-primary border-0">
              加入志愿表
            </Button>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              className="border-primary text-primary hover:bg-primary-bg"
              onClick={() => {
                const url = item.college.gaokaoUrl || 'https://gaokao.chsi.com.cn/'
                window.open(url, '_blank', 'noopener,noreferrer')
              }}
            >
              详情
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-text-secondary hover:text-primary flex items-center gap-1"
      >
        {expanded ? '收起' : '展开详情'}
      </button>
    </div>
  )
}

function SourceLink({ href, label }: { href?: string; label: string }) {
  if (!href) return <span className="text-text-secondary">{label}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </a>
  )
}
