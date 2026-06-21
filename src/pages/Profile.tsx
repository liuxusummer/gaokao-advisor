import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Steps, Select, InputNumber, Checkbox, Radio, Button, message } from 'antd'
import { LeftOutlined, RightOutlined, ReloadOutlined } from '@ant-design/icons'
import { provinces, subjectOptions, regionOptions, majorCategories } from '../data/mock'
import { useAppStore } from '../store'
import { generateRecommendations } from '../services/recommender'

const { Step } = Steps

export default function Profile() {
  const navigate = useNavigate()
  const { profile, setRecommendations, setRiskReport, loadProvinceData } = useAppStore()
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)

  const steps = ['选择省份', '输入成绩', '填写偏好', '生成推荐']

  const canNext = () => {
    if (current === 0) return !!profile.provinceId
    if (current === 1) return !!profile.score && profile.score > 0
    return true
  }

  const handleNext = () => {
    if (!canNext()) {
      message.error('请填写必填项')
      return
    }
    if (current < 2) {
      setCurrent(current + 1)
    } else {
      handleGenerate()
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const cache = await loadProvinceData(profile.provinceId)
      const recs = await generateRecommendations(profile, cache || undefined)
      setRecommendations(recs)
      setRiskReport([])
      navigate('/recommend')
    } catch (err) {
      message.error('生成推荐失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
      <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
        <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-6">志愿填报向导</h1>
        <Steps current={current} className="mb-8">
          {steps.map((s) => (
            <Step key={s} title={s} />
          ))}
        </Steps>

        <div className="min-h-[300px]">
          {current === 0 && <Step1Province />}
          {current === 1 && <Step2Score />}
          {current === 2 && <Step3Preference />}
        </div>

        <div className="flex justify-between mt-8">
          <Button
            size="large"
            onClick={() => (current === 0 ? navigate('/') : setCurrent(current - 1))}
            icon={<LeftOutlined />}
          >
            {current === 0 ? '返回首页' : '上一步'}
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={handleNext}
            loading={loading}
            icon={current === 2 ? <ReloadOutlined /> : <RightOutlined />}
            iconPosition="end"
            className="bg-gradient-to-r from-primary to-primary-light border-0 shadow-primary"
          >
            {current === 2 ? '生成推荐' : '下一步'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Step1Province() {
  const { profile, updateProfile, loadProvinceData, dataLoading, dataError } = useAppStore()
  const province = provinces.find((p) => p.id === profile.provinceId)

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-text-primary">你在哪里高考？</h2>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">省份 / 直辖市 *</label>
        <Select
          showSearch
          placeholder="请选择省份"
          value={profile.provinceId || undefined}
          onChange={async (v) => {
            const p = provinces.find((x) => x.id === v)
            updateProfile({
              provinceId: v,
              provinceName: p?.name || '',
              subjects: [],
            })
            await loadProvinceData(v)
          }}
          options={provinces.map((p) => ({ value: p.id, label: `${p.name}（${p.mode === 'major+college' ? '专业+院校' : '院校专业组'} · ${p.total}个）` }))}
          className="w-full"
        />
      </div>
      {dataLoading && <p className="text-sm text-primary">正在加载该省真实录取数据…</p>}
      {dataError && <p className="text-sm text-error">数据加载失败：{dataError}</p>}

      {province && (
        <>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">选科组合 *</label>
            {province.subjects === '3+3' ? (
              <Checkbox.Group
                options={subjectOptions}
                value={profile.subjects}
                onChange={(v) => updateProfile({ subjects: v as string[] })}
              />
            ) : (
              <div className="space-y-3">
                <Radio.Group
                  value={profile.subjectType}
                  onChange={(e) => updateProfile({ subjectType: e.target.value, subjects: [] })}
                >
                  <Radio value="physics">物理类</Radio>
                  <Radio value="history">历史类</Radio>
                </Radio.Group>
                <div>
                  <span className="text-sm text-text-secondary">再选科目：</span>
                  <Checkbox.Group
                    options={subjectOptions.filter((s) => s !== '物理' && s !== '历史')}
                    value={profile.subjects}
                    onChange={(v) => updateProfile({ subjects: [profile.subjectType === 'physics' ? '物理' : '历史', ...(v as string[])] })}
                  />
                </div>
              </div>
            )}
          </div>
          {profile.subjects.length > 0 && (
            <p className="text-sm text-primary">
              已选：{profile.subjects.join(' + ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Step2Score() {
  const { profile, updateProfile } = useAppStore()

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-text-primary">你的成绩是？</h2>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">高考总分 *</label>
        <InputNumber
          min={0}
          max={750}
          value={profile.score || undefined}
          onChange={(v) => updateProfile({ score: v })}
          placeholder="请输入高考总分"
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">全省位次（从一分一段表查询）</label>
        <InputNumber
          min={1}
          value={profile.rank || undefined}
          onChange={(v) => updateProfile({ rank: v })}
          placeholder="如已知位次，可提高推荐精度"
          className="w-full"
        />
      </div>
      {!profile.rank && profile.score && (
        <div className="bg-primary-bg rounded-lg p-3 text-sm text-primary-dark">
          已根据你的分数估算位次约 {Math.round((750 - profile.score) * 100 + 500)} 名（建议从考试院官网查询准确位次）
        </div>
      )}
    </div>
  )
}

function Step3Preference() {
  const { profile, updateProfile } = useAppStore()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">你的偏好是？</h2>
        <span className="text-xs text-text-secondary">可跳过，使用默认偏好</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">地域偏好</label>
        <Checkbox.Group
          options={regionOptions}
          value={profile.regions}
          onChange={(v) => updateProfile({ regions: v as string[] })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">专业方向偏好</label>
        <Checkbox.Group
          options={majorCategories}
          value={profile.categories}
          onChange={(v) => updateProfile({ categories: v as string[] })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">院校层次偏好</label>
        <Checkbox.Group
          options={['985', '211', '双一流']}
          value={profile.levels}
          onChange={(v) => updateProfile({ levels: v as string[] })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">学费上限（元/年）</label>
        <InputNumber
          min={0}
          value={profile.maxTuition || undefined}
          onChange={(v) => updateProfile({ maxTuition: v })}
          placeholder="不限"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">体检结论</label>
        <Select
          value={profile.physicalExam}
          onChange={(v) => updateProfile({ physicalExam: v })}
          options={[
            { value: 'normal', label: '正常' },
            { value: 'colorWeak', label: '色弱' },
            { value: 'colorBlind', label: '色盲' },
            { value: 'vision', label: '视力异常' },
            { value: 'height', label: '身高受限' },
            { value: 'other', label: '其他' },
          ]}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">风险偏好</label>
        <Radio.Group
          value={profile.riskPreference}
          onChange={(e) => updateProfile({ riskPreference: e.target.value })}
        >
          <Radio value="conservative">保守（多保底）</Radio>
          <Radio value="balanced">均衡</Radio>
          <Radio value="aggressive">激进（多冲刺）</Radio>
        </Radio.Group>
      </div>
    </div>
  )
}
