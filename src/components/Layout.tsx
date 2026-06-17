import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  HomeOutlined,
  AimOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  MessageOutlined,
  SettingOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'

const navItems = [
  { key: '/', label: '首页', icon: HomeOutlined },
  { key: '/recommend', label: '推荐', icon: AimOutlined },
  { key: '/volunteer-list', label: '志愿表', icon: FileTextOutlined },
  { key: '/data', label: '数据', icon: DatabaseOutlined },
  { key: '/chat', label: 'AI', icon: MessageOutlined },
]

const topNavItems = [
  { key: '/', label: '首页' },
  { key: '/recommend', label: '推荐' },
  { key: '/volunteer-list', label: '志愿表' },
  { key: '/assessment', label: '测评' },
  { key: '/data', label: '数据' },
  { key: '/chat', label: 'AI 问答' },
]

export default function Layout() {
  const location = useLocation()
  const { darkMode, riskReport } = useAppStore()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const highRiskCount = riskReport.filter((r) => r.level === 'high').length

  return (
    <div className="min-h-screen bg-bg-page text-text-body">
      {isMobile ? (
        <MobileHeader highRiskCount={highRiskCount} />
      ) : (
        <DesktopHeader highRiskCount={highRiskCount} />
      )}

      <main className={`${isMobile ? 'pb-20' : ''}`}>
        <Outlet />
      </main>

      {isMobile && <MobileTabBar current={location.pathname} />}
    </div>
  )
}

function DesktopHeader({ highRiskCount }: { highRiskCount: number }) {
  const location = useLocation()
  const { darkMode, setDarkMode } = useAppStore()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 bg-bg-card/80 backdrop-blur border-b border-border-color">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold text-lg">
            智
          </div>
          <span className="text-lg font-bold text-text-primary">智填志愿</span>
        </Link>

        <nav className="flex items-center gap-1">
          {topNavItems.map((item) => {
            const active = location.pathname === item.key || location.pathname.startsWith(`${item.key}/`)
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'text-primary bg-primary-bg' : 'text-text-secondary hover:text-primary hover:bg-bg-hover'
                }`}
              >
                {item.label}
                {item.key === '/volunteer-list' && highRiskCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-error text-white text-xs">
                    {highRiskCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:bg-bg-hover transition-colors"
            aria-label="切换深色模式"
          >
            {darkMode ? <SunOutlined /> : <MoonOutlined />}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:bg-bg-hover transition-colors"
            aria-label="设置"
          >
            <SettingOutlined />
          </button>
        </div>
      </div>
    </header>
  )
}

function MobileHeader({ highRiskCount }: { highRiskCount: number }) {
  const navigate = useNavigate()
  const { darkMode, setDarkMode } = useAppStore()
  void highRiskCount

  return (
    <header className="sticky top-0 z-50 bg-bg-card border-b border-border-color px-4 h-14 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold text-sm">
          智
        </div>
        <span className="font-bold text-text-primary">智填志愿</span>
      </Link>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary"
        >
          {darkMode ? <SunOutlined /> : <MoonOutlined />}
        </button>
        <button onClick={() => navigate('/settings')} className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary">
          <SettingOutlined />
        </button>
      </div>
    </header>
  )
}

function MobileTabBar({ current }: { current: string }) {
  const navigate = useNavigate()
  const { riskReport } = useAppStore()
  const highRiskCount = riskReport.filter((r) => r.level === 'high').length

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border-color h-16 px-2 flex items-center justify-around z-50">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = current === item.key || (item.key !== '/' && current.startsWith(item.key))
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            className="flex flex-col items-center justify-center gap-1 w-14 h-14 relative"
          >
            <div className="relative">
              <Icon className={`text-xl ${active ? 'text-primary' : 'text-text-secondary'}`} />
              {item.key === '/volunteer-list' && highRiskCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-error text-white text-[10px] flex items-center justify-center">
                  {highRiskCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] ${active ? 'text-primary font-medium' : 'text-text-secondary'}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
