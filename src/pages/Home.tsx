import { useNavigate } from 'react-router-dom'
import {
  AimOutlined,
  StarOutlined,
  DatabaseOutlined,
  MessageOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  BookOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { useAppStore } from '../store'

export default function Home() {
  const navigate = useNavigate()
  const { profile, recommendations } = useAppStore()

  const hasProfile = profile.provinceId && profile.score

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-bg to-bg-card p-6 md:p-12 mb-6 md:mb-10">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl md:text-4xl font-bold text-primary-dark mb-4 leading-tight">
            让每一分都不浪费
            <br />
            让每一个家庭都不焦虑
          </h1>
          <p className="text-sm md:text-base text-text-secondary mb-6">
            免费 · 可解释 · 数据溯源 · 政策校验 · 离线可用
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              onClick={() => navigate(hasProfile ? '/recommend' : '/profile')}
              className="bg-gradient-to-r from-primary to-primary-light border-0 shadow-primary"
            >
              {hasProfile ? '查看推荐志愿' : '立即生成推荐'}
            </Button>
            <Button
              size="large"
              icon={<AimOutlined />}
              onClick={() => navigate('/recommend')}
              className="border-primary text-primary hover:text-primary hover:bg-primary-bg"
            >
              查看示例
            </Button>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-40 h-40 md:w-60 md:h-60 opacity-10 pointer-events-none">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="4" className="text-primary" />
            <path d="M60 100L90 130L140 70" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
          </svg>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-8 md:mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">快捷功能</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <QuickCard icon={<AimOutlined />} title="智能推荐" desc="输入成绩生成冲稳保方案" onClick={() => navigate('/recommend')} />
          <QuickCard icon={<StarOutlined />} title="兴趣测评" desc="霍兰德+学科兴趣测评" onClick={() => navigate('/assessment')} />
          <QuickCard icon={<DatabaseOutlined />} title="数据中心" desc="院校/专业/分数线查询" onClick={() => navigate('/data')} />
          <QuickCard icon={<MessageOutlined />} title="AI 问答" desc="政策规则与推荐解释" onClick={() => navigate('/chat')} />
        </div>
      </section>

      {/* Trust */}
      <section className="bg-bg-card rounded-xl p-5 md:p-6 shadow-md mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">为什么选择智填志愿</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-bg flex items-center justify-center text-primary flex-shrink-0">
              <CheckCircleOutlined />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary text-sm">高准确率</h3>
              <p className="text-xs text-text-secondary mt-1">政策匹配错误率 &lt; 5%，每条推荐附数据来源</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-bg flex items-center justify-center text-primary flex-shrink-0">
              <BookOutlined />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary text-sm">权威溯源</h3>
              <p className="text-xs text-text-secondary mt-1">数据来自教育部、阳光高考网、各省考试院</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-bg flex items-center justify-center text-primary flex-shrink-0">
              <SafetyOutlined />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary text-sm">风险预警</h3>
              <p className="text-xs text-text-secondary mt-1">滑档/退档实时检测，一键修复建议</p>
            </div>
          </div>
        </div>
      </section>

      {/* Continue */}
      {hasProfile && recommendations.length === 0 && (
        <section className="bg-primary-bg border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-primary-dark">继续上次操作</h3>
            <p className="text-xs text-text-secondary mt-1">你已填写成绩信息，可继续生成推荐</p>
          </div>
          <Button type="primary" onClick={() => navigate('/recommend')} className="bg-primary border-0">
            继续
          </Button>
        </section>
      )}

      <p className="text-xs text-text-secondary mt-8 text-center">
        免责声明：本工具推荐仅供参考，最终录取以各省教育考试院官方发布为准。
      </p>
    </div>
  )
}

function QuickCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-bg-card rounded-xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
    >
      <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-text-primary text-sm mb-1">{title}</h3>
      <p className="text-xs text-text-secondary">{desc}</p>
    </button>
  )
}
