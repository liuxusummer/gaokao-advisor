import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Switch, Tag, message, Modal, Dropdown } from 'antd'
import {
  DeleteOutlined,
  UpOutlined,
  DownOutlined,
  WarningFilled,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'
import { detectRisks } from '../services/riskDetector'
import { exportToExcel, exportToPdf, copyToClipboard } from '../services/exporter'
import CollegeNameLink from '../components/CollegeNameLink'

const tierLabels = {
  rush: { text: '冲', color: 'text-tier-rush', bg: 'bg-tier-rush/10' },
  stable: { text: '稳', color: 'text-tier-stable', bg: 'bg-tier-stable/10' },
  safe: { text: '保', color: 'text-tier-safe', bg: 'bg-tier-safe/10' },
}

export default function VolunteerList() {
  const navigate = useNavigate()
  const { profile, volunteerList, removeVolunteer, moveVolunteer, updateVolunteer, setRiskReport, riskReport, clearVolunteerList, dataCache } = useAppStore()

  useEffect(() => {
    const risks = detectRisks(volunteerList, profile, dataCache?.subjectRequirements)
    setRiskReport(risks)
  }, [volunteerList, profile, setRiskReport, dataCache?.subjectRequirements])

  const highCount = riskReport.filter((r) => r.level === 'high').length
  const mediumCount = riskReport.filter((r) => r.level === 'medium').length

  const handleSubmit = () => {
    if (highCount > 0) {
      Modal.confirm({
        title: '仍有高风险未处理',
        content: `志愿表中存在 ${highCount} 项高风险，确认强制提交吗？`,
        okText: '确认提交',
        cancelText: '去修改',
        onOk: () => message.success('已提交（原型演示，未真实提交）'),
      })
    } else {
      message.success('提交成功（原型演示，未真实提交）')
    }
  }

  const handleExport = async ({ key }: { key: string }) => {
    if (volunteerList.length === 0) {
      message.warning('志愿表为空')
      return
    }
    try {
      if (key === 'excel') {
        exportToExcel(volunteerList, profile)
        message.success('Excel 已下载')
      } else if (key === 'pdf') {
        exportToPdf(volunteerList, profile)
      } else if (key === 'copy') {
        const ok = await copyToClipboard(volunteerList, profile)
        if (ok) message.success('已复制到剪贴板')
        else message.error('复制失败，请检查浏览器权限')
      }
    } catch (err) {
      message.error('导出失败：' + (err instanceof Error ? err.message : '未知错误'))
    }
  }

  const exportMenu = {
    items: [
      { key: 'excel', label: '导出 Excel', icon: <FileExcelOutlined /> },
      { key: 'pdf', label: '导出 PDF', icon: <FilePdfOutlined /> },
      { key: 'copy', label: '复制到剪贴板', icon: <CopyOutlined /> },
    ],
    onClick: handleExport,
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary">我的志愿表</h1>
          <p className="text-sm text-text-secondary mt-1">已添加 {volunteerList.length} 个志愿</p>
        </div>
        <div className="flex gap-2">
          <Dropdown.Button menu={exportMenu} icon={<ExportOutlined />}>
            导出
          </Dropdown.Button>
          <Button type="primary" icon={<SafetyOutlined />} onClick={() => navigate('/risk')} className="bg-primary border-0">
            风险报告
          </Button>
        </div>
      </div>

      {/* Risk Summary */}
      {volunteerList.length > 0 && (
        <div className={`rounded-xl p-4 mb-5 flex flex-wrap items-center justify-between gap-3 ${highCount > 0 ? 'bg-error/10 border border-error/20' : mediumCount > 0 ? 'bg-warning/10 border border-warning/20' : 'bg-success/10 border border-success/20'}`}>
          <div className="flex items-center gap-4">
            {highCount > 0 && (
              <span className="flex items-center gap-1 text-error font-semibold text-sm">
                <WarningFilled /> 高风险 {highCount}
              </span>
            )}
            {mediumCount > 0 && (
              <span className="flex items-center gap-1 text-warning font-semibold text-sm">
                <ExclamationCircleOutlined /> 中风险 {mediumCount}
              </span>
            )}
            {highCount === 0 && mediumCount === 0 && (
              <span className="flex items-center gap-1 text-success font-semibold text-sm">
                <CheckCircleOutlined /> 当前无明显风险
              </span>
            )}
          </div>
          <Button type="link" onClick={() => navigate('/risk')} className="text-primary p-0">
            查看详情
          </Button>
        </div>
      )}

      {volunteerList.length === 0 ? (
        <Empty description="还没有添加志愿，去推荐结果看看吧">
          <Button type="primary" className="mt-4 bg-primary" onClick={() => navigate('/recommend')}>
            去推荐
          </Button>
        </Empty>
      ) : (
        <>
          <div className="space-y-3 mb-24">
            {volunteerList.map((item, index) => {
              const itemRisks = riskReport.filter((r) => r.affectedIndexes.includes(index + 1))
              const high = itemRisks.some((r) => r.level === 'high')
              const medium = itemRisks.some((r) => r.level === 'medium')
              const tier = tierLabels[item.tier]

              return (
                <div
                  key={item.id}
                  className={`bg-bg-card rounded-xl p-4 shadow-md border-l-4 ${
                    high ? 'border-error' : medium ? 'border-warning' : 'border-success'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-text-secondary font-mono">{index + 1}</span>
                        <CollegeNameLink college={item.college} className="text-base" />
                        <span className="text-text-secondary">·</span>
                        <span className="font-semibold text-text-primary">{item.major.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tier.bg} ${tier.color}`}>
                          {tier.text} {item.probability}%
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {item.college.tags?.map((l) => (
                          <Tag key={l} color={l === '985' ? 'success' : l === '211' ? 'blue' : 'default'} className="m-0">
                            {l}
                          </Tag>
                        ))}
                        <span className="text-xs text-text-secondary">{item.college.province}{item.college.city}</span>
                        {item.major.tuition && <span className="text-xs text-text-secondary">学费 {item.major.tuition}/年</span>}
                      </div>
                      {itemRisks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {itemRisks.slice(0, 2).map((r) => (
                            <div
                              key={r.id}
                              className={`text-xs flex items-start gap-1 ${
                                r.level === 'high' ? 'text-error' : r.level === 'medium' ? 'text-warning' : 'text-success'
                              }`}
                            >
                              {r.level === 'high' ? <WarningFilled /> : r.level === 'medium' ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
                              <span>{r.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-1">
                        <button
                          disabled={index === 0}
                          onClick={() => moveVolunteer(index, index - 1)}
                          className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary disabled:opacity-40 hover:bg-bg-hover"
                        >
                          <UpOutlined className="text-xs" />
                        </button>
                        <button
                          disabled={index === volunteerList.length - 1}
                          onClick={() => moveVolunteer(index, index + 1)}
                          className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary disabled:opacity-40 hover:bg-bg-hover"
                        >
                          <DownOutlined className="text-xs" />
                        </button>
                        <button
                          onClick={() => removeVolunteer(item.id)}
                          className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-error hover:bg-error/10"
                        >
                          <DeleteOutlined className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {profile.provinceId !== 'zhejiang' && profile.provinceId !== 'shandong' && profile.provinceId !== 'liaoning' && (
                    <div className="mt-3 pt-3 border-t border-border-color flex items-center justify-between">
                      <span className="text-sm text-text-secondary">服从专业组内调剂</span>
                      <Switch
                        checked={item.obeyAdjust}
                        onChange={(v) => updateVolunteer(item.id, { obeyAdjust: v })}
                        className={item.obeyAdjust ? 'bg-primary' : ''}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom Actions */}
          <div className="fixed bottom-0 left-0 right-0 md:static md:mt-6 bg-bg-card md:bg-transparent border-t border-border-color md:border-0 p-4 md:p-0 z-40">
            <div className="max-w-3xl mx-auto flex gap-3">
              <Button size="large" className="flex-1" onClick={() => clearVolunteerList()}>
                清空
              </Button>
              <Button
                type="primary"
                size="large"
                className={`flex-1 ${highCount > 0 ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary/90'}`}
                onClick={handleSubmit}
              >
                {highCount > 0 ? `有 ${highCount} 项高风险` : '提交志愿表'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
