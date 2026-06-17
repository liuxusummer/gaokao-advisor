import { useNavigate } from 'react-router-dom'
import { Button, Empty, Tag } from 'antd'
import {
  WarningFilled,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  SafetyOutlined,
  BookOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'

export default function RiskReport() {
  const navigate = useNavigate()
  const { riskReport, volunteerList } = useAppStore()

  const high = riskReport.filter((r) => r.level === 'high')
  const medium = riskReport.filter((r) => r.level === 'medium')
  const low = riskReport.filter((r) => r.level === 'low')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button icon={<LeftOutlined />} onClick={() => navigate('/volunteer-list')}>
          返回
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">风险预警报告</h1>
      </div>

      {volunteerList.length === 0 ? (
        <Empty description="志愿表为空，无法检测风险">
          <Button type="primary" className="mt-4 bg-primary" onClick={() => navigate('/recommend')}>
            去添加志愿
          </Button>
        </Empty>
      ) : (
        <>
          <div className={`rounded-2xl p-6 mb-6 text-center ${high.length > 0 ? 'bg-error/10 border border-error/20' : medium.length > 0 ? 'bg-warning/10 border border-warning/20' : 'bg-success/10 border border-success/20'}`}>
            <div className="flex justify-center mb-3">
              {high.length > 0 ? (
                <WarningFilled className="text-4xl text-error" />
              ) : medium.length > 0 ? (
                <ExclamationCircleOutlined className="text-4xl text-warning" />
              ) : (
                <CheckCircleOutlined className="text-4xl text-success" />
              )}
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-2">
              {high.length > 0 ? '存在高风险，建议处理后再提交' : medium.length > 0 ? '存在中风险，建议关注' : '当前志愿表风险较低'}
            </h2>
            <div className="flex justify-center gap-6 mt-4">
              <span className="text-error font-semibold">高风险 {high.length}</span>
              <span className="text-warning font-semibold">中风险 {medium.length}</span>
              <span className="text-success font-semibold">低风险 {low.length}</span>
            </div>
          </div>

          <div className="space-y-3">
            {[...high, ...medium, ...low].map((risk) => (
              <div
                key={risk.id}
                className={`bg-bg-card rounded-xl p-4 shadow-md border-l-4 ${
                  risk.level === 'high' ? 'border-error' : risk.level === 'medium' ? 'border-warning' : 'border-success'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {risk.level === 'high' ? (
                      <WarningFilled className="text-error" />
                    ) : risk.level === 'medium' ? (
                      <ExclamationCircleOutlined className="text-warning" />
                    ) : (
                      <CheckCircleOutlined className="text-success" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-text-primary">{risk.title}</h3>
                      <Tag color={risk.type === 'slide' ? 'orange' : 'red'} className="m-0">
                        {risk.type === 'slide' ? '滑档风险' : '退档风险'}
                      </Tag>
                    </div>
                    <p className="text-sm text-text-body mt-1">{risk.description}</p>
                    <p className="text-xs text-text-secondary mt-2">原因：{risk.reason}</p>
                    <div className="mt-3 bg-primary-bg rounded-lg p-3">
                      <p className="text-sm text-primary-dark">
                        <SafetyOutlined className="mr-1" />
                        建议：{risk.suggestion}
                      </p>
                    </div>
                    {risk.affectedIndexes.length > 0 && (
                      <p className="text-xs text-text-secondary mt-2">
                        影响志愿：第 {risk.affectedIndexes.join('、')} 个
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-primary-bg rounded-xl text-sm text-primary-dark flex items-start gap-2">
            <BookOutlined className="mt-0.5" />
            <div>
              <p className="font-medium">数据来源</p>
              <p className="mt-1 opacity-80">
                风险规则基于教育部《普通高等学校招生体检工作指导意见》、各省考试院志愿填报政策及历史录取数据。
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
