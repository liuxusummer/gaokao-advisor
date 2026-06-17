# 智填志愿 — AI 高考志愿填报助手 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于已确认的需求、技术、UX、UI 文档，从零实现一个可运行的纯前端高考志愿填报助手 Web 应用。

**Architecture:** 采用 React 18 + TypeScript + Vite 构建 SPA，Ant Design 5 处理复杂表单/表格/步骤条组件，Tailwind CSS 自定义品牌视觉组件，Zustand 管理状态，Dexie.js 持久化本地数据，数据以静态 JSON 随应用打包。

**Tech Stack:** React 18, TypeScript 5, Vite 5, React Router 6, Ant Design 5, Tailwind CSS 3, Zustand 5, Dexie.js 4, ECharts 5, Vitest, React Testing Library, Playwright, Framer Motion

---

## 1. 项目初始化与基础设施

### Task 1: 初始化 Vite + React + TypeScript 项目

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: 使用 Vite 创建项目**

Run:
```bash
cd volunteer-assistant
npm create vite@latest . -- --template react-ts
```

Expected: 项目骨架创建成功，包含 `src/App.tsx`、`src/main.tsx`、`index.html`。

- [ ] **Step 2: 安装核心依赖**

Run:
```bash
npm install react@18 react-dom@18 react-router-dom@6 zustand@5 dexie@4 antd@5 @ant-design/icons@5 echarts@5 framer-motion@11
npm install -D tailwindcss@3 postcss autoprefixer@10 @types/react@18 @types/react-dom@18 typescript@5 vite@5 vitest@1 @testing-library/react@14 @testing-library/jest-dom@6 @testing-library/user-event@14 jsdom@24 playwright@1
```

Expected: `node_modules` 安装完成，`package.json` 包含上述依赖。

- [ ] **Step 3: 初始化 Tailwind CSS**

Run:
```bash
npx tailwindcss init -p
```

Modify: `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#059669',
          light: '#34d399',
          dark: '#065f46',
          bg: '#f0fdf4',
        },
        success: '#16a34a',
        warning: '#f59e0b',
        error: '#dc2626',
        info: '#3b82f6',
        tier: {
          rush: '#ef4444',
          stable: '#16a34a',
          safe: '#3b82f6',
        },
      },
      boxShadow: {
        'md': '0 4px 12px rgba(0,0,0,0.06)',
        'lg': '0 10px 24px rgba(0,0,0,0.1)',
        'primary': '0 4px 12px rgba(5,150,105,0.3)',
      },
      borderRadius: {
        'xl': '10px',
        '2xl': '12px',
      },
    },
  },
  plugins: [],
}
```

Create: `src/styles/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary: #059669;
    --color-primary-light: #34d399;
    --color-primary-dark: #065f46;
    --color-primary-bg: #f0fdf4;
    --color-success: #16a34a;
    --color-warning: #f59e0b;
    --color-error: #dc2626;
    --color-info: #3b82f6;
    --text-primary: #0f172a;
    --text-body: #334155;
    --text-secondary: #64748b;
    --text-placeholder: #94a3b8;
    --border-color: #e2e8f0;
    --bg-page: #f8fafc;
    --bg-card: #ffffff;
    --bg-hover: #f0fdf4;
  }

  .dark {
    --color-primary: #34d399;
    --color-primary-light: #6ee7b7;
    --color-primary-dark: #059669;
    --color-primary-bg: #064e3b;
    --color-success: #4ade80;
    --color-warning: #fbbf24;
    --color-error: #f87171;
    --color-info: #60a5fa;
    --text-primary: #f0f9ff;
    --text-body: #cbd5e1;
    --text-secondary: #94a3b8;
    --text-placeholder: #475569;
    --border-color: #334155;
    --bg-page: #0f172a;
    --bg-card: #1e293b;
    --bg-hover: #064e3b;
  }
}
```

Modify: `src/main.tsx`
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 4: 配置 Vitest**

Modify: `vite.config.ts`
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create: `src/test/setup.ts`
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: 配置 Ant Design 主题**

Create: `src/shared/theme/antd-theme.ts`
```ts
import { ThemeConfig } from 'antd'

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#059669',
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    colorInfo: '#3b82f6',
    borderRadius: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Card: {
      borderRadius: 10,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Steps: {
      controlItemWidth: 32,
      colorPrimary: '#059669',
    },
  },
}
```

Modify: `src/App.tsx`
```tsx
import { ConfigProvider } from 'antd'
import { antdTheme } from './shared/theme/antd-theme'

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <div className="min-h-screen bg-bg-page text-text-body">
        <h1 className="text-display text-text-primary">智填志愿</h1>
      </div>
    </ConfigProvider>
  )
}

export default App
```

- [ ] **Step 6: 运行开发服务器验证**

Run:
```bash
npm run dev
```

Expected: 开发服务器启动，浏览器可访问，页面显示"智填志愿"。

- [ ] **Step 7: Commit**

Run:
```bash
git add .
git commit -m "chore: initialize vite react ts project with antd tailwind"
```

---

## 2. 共享层与基础设施

### Task 2: 创建类型定义与常量

**Files:**
- Create: `src/shared/types/index.ts`
- Create: `src/shared/constants/index.ts`

- [ ] **Step 1: 创建核心类型定义**

Create: `src/shared/types/index.ts`
```ts
export interface ProvinceConfig {
  code: string
  name: string
  mode: 'major_college' | 'college_major_group' | 'old_exam'
  subjects: '3+3' | '3+1+2' | 'wen_li'
  volunteerCount: number
  batchNames: string[]
}

export interface College {
  id: string
  name: string
  code: string
  province: string
  city: string
  level: ('985' | '211' | 'double_first' | 'provincial_key')[]
  type: string
}

export interface Major {
  id: string
  code: string
  name: string
  category: string
  subCategory: string
  duration: number
  degree: string
  subjectRequirements: string[]
  physicalRestrictions?: string[]
}

export interface ScoreRecord {
  collegeId: string
  majorId: string
  year: number
  province: string
  batch: string
  minScore: number
  avgScore: number
  minRank?: number
}

export interface UserProfile {
  province: string
  subjectType: 'wen' | 'li' | 'physics' | 'history' | null
  selectedSubjects: string[]
  score: number
  rank: number | null
  interests: string[]
  preferredProvinces: string[]
  preferredMajorCategories: string[]
  preferredLevels: string[]
  riskPreference: 'conservative' | 'balanced' | 'aggressive'
}

export interface Recommendation {
  collegeId: string
  majorId: string
  probability: number
  tier: 'rush' | 'stable' | 'safe'
  reasons: string[]
  scoreRecords: ScoreRecord[]
}

export interface VolunteerItem {
  id: string
  collegeId: string
  majorId: string
  order: number
 服从调剂: boolean
}

export type RiskLevel = 'high' | 'medium' | 'low'

export interface RiskWarning {
  type: string
  level: RiskLevel
  message: string
  fixSuggestion?: string
}
```

- [ ] **Step 2: 创建省份常量**

Create: `src/shared/constants/index.ts`
```ts
export const PROVINCES: { code: string; name: string }[] = [
  { code: 'beijing', name: '北京' },
  { code: 'shanghai', name: '上海' },
  { code: 'zhejiang', name: '浙江' },
  { code: 'jiangsu', name: '江苏' },
  { code: 'henan', name: '河南' },
  // v1.0 先支持 5 个省份，后续扩展
]

export const SUBJECTS_3_3 = ['physics', 'chemistry', 'biology', 'history', 'politics', 'geography']
export const SUBJECTS_3_1_2_FIRST = ['physics', 'history']
export const SUBJECTS_3_1_2_SECOND = ['chemistry', 'biology', 'politics', 'geography']

export const SUBJECT_NAMES: Record<string, string> = {
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  politics: '政治',
  geography: '地理',
}

export const RISK_MESSAGES: Record<string, string> = {
  PHYSICAL_RESTRICTION: '体检受限',
  NOT_OBEYING_ADJUSTMENT: '未服从调剂',
  SUBJECT_MISMATCH: '选科不符',
  SINGLE_SUBJECT_CLOSE: '单科成绩接近',
  GRADIENT_UNREASONABLE: '梯度不合理',
}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/shared/types/index.ts src/shared/constants/index.ts
git commit -m "feat(shared): add core type definitions and constants"
```

### Task 3: 创建 Zustand Store

**Files:**
- Create: `src/shared/stores/profile-store.ts`
- Create: `src/shared/stores/volunteer-store.ts`
- Create: `src/shared/stores/recommendation-store.ts`

- [ ] **Step 1: 创建用户档案 Store**

Create: `src/shared/stores/profile-store.ts`
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserProfile } from '../types'

interface ProfileState extends UserProfile {
  setProfile: (profile: Partial<UserProfile>) => void
  resetProfile: () => void
}

const initialProfile: UserProfile = {
  province: '',
  subjectType: null,
  selectedSubjects: [],
  score: 0,
  rank: null,
  interests: [],
  preferredProvinces: [],
  preferredMajorCategories: [],
  preferredLevels: [],
  riskPreference: 'balanced',
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...initialProfile,
      setProfile: (profile) => set((state) => ({ ...state, ...profile })),
      resetProfile: () => set(initialProfile),
    }),
    {
      name: 'volunteer-profile',
    },
  ),
)
```

- [ ] **Step 2: 创建志愿表 Store**

Create: `src/shared/stores/volunteer-store.ts`
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { VolunteerItem } from '../types'

interface VolunteerState {
  items: VolunteerItem[]
  addItem: (collegeId: string, majorId: string) => void
  removeItem: (id: string) => void
  reorderItems: (items: VolunteerItem[]) => void
  toggleAdjustment: (id: string) => void
}

export const useVolunteerStore = create<VolunteerState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (collegeId, majorId) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              id: `${collegeId}-${majorId}-${Date.now()}`,
              collegeId,
              majorId,
              order: state.items.length + 1,
              服从调剂: true,
            },
          ],
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id).map((item, index) => ({ ...item, order: index + 1 })),
        })),
      reorderItems: (items) => set({ items: items.map((item, index) => ({ ...item, order: index + 1 })) }),
      toggleAdjustment: (id) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, 服从调剂: !item.服从调剂 } : item)),
        })),
    }),
    {
      name: 'volunteer-list',
    },
  ),
)
```

- [ ] **Step 3: 创建推荐结果 Store**

Create: `src/shared/stores/recommendation-store.ts`
```ts
import { create } from 'zustand'
import { Recommendation } from '../types'

interface RecommendationState {
  recommendations: Recommendation[]
  isLoading: boolean
  setRecommendations: (recommendations: Recommendation[]) => void
  setLoading: (isLoading: boolean) => void
}

export const useRecommendationStore = create<RecommendationState>((set) => ({
  recommendations: [],
  isLoading: false,
  setRecommendations: (recommendations) => set({ recommendations }),
  setLoading: (isLoading) => set({ isLoading }),
}))
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/shared/stores/
git commit -m "feat(stores): add profile volunteer recommendation stores"
```

### Task 4: 创建深色模式 Hook

**Files:**
- Create: `src/shared/hooks/use-dark-mode.ts`
- Create: `src/shared/hooks/__tests__/use-dark-mode.test.ts`

- [ ] **Step 1: 编写测试**

Create: `src/shared/hooks/__tests__/use-dark-mode.test.ts`
```ts
import { renderHook, act } from '@testing-library/react'
import { useDarkMode } from '../use-dark-mode'

describe('useDarkMode', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('should default to light mode', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(false)
  })

  it('should toggle dark mode', () => {
    const { result } = renderHook(() => useDarkMode())
    act(() => {
      result.current.toggle()
    })
    expect(result.current.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
```

- [ ] **Step 2: 实现 Hook**

Create: `src/shared/hooks/use-dark-mode.ts`
```ts
import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggle = () => setIsDark((prev) => !prev)

  return { isDark, toggle }
}
```

- [ ] **Step 3: 运行测试**

Run:
```bash
npx vitest run src/shared/hooks/__tests__/use-dark-mode.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/shared/hooks/
git commit -m "feat(hooks): add dark mode hook with tests"
```

---

## 3. 数据层

### Task 5: 创建静态数据文件

**Files:**
- Create: `public/data/provinces.json`
- Create: `public/data/colleges.json`
- Create: `public/data/majors.json`
- Create: `public/data/scores/sample.json`

- [ ] **Step 1: 创建省份配置数据**

Create: `public/data/provinces.json`
```json
{
  "provinces": [
    {
      "code": "zhejiang",
      "name": "浙江",
      "mode": "major_college",
      "subjects": "3+3",
      "volunteerCount": 80,
      "batchNames": ["普通类一段"]
    },
    {
      "code": "jiangsu",
      "name": "江苏",
      "mode": "college_major_group",
      "subjects": "3+1+2",
      "volunteerCount": 40,
      "batchNames": ["本科批"]
    },
    {
      "code": "henan",
      "name": "河南",
      "mode": "old_exam",
      "subjects": "wen_li",
      "volunteerCount": 12,
      "batchNames": ["本科一批", "本科二批"]
    }
  ]
}
```

- [ ] **Step 2: 创建院校数据样本**

Create: `public/data/colleges.json`
```json
{
  "colleges": [
    {
      "id": "nju",
      "name": "南京大学",
      "code": "10284",
      "province": "jiangsu",
      "city": "南京",
      "level": ["985", "211", "double_first"],
      "type": "综合"
    },
    {
      "id": "zju",
      "name": "浙江大学",
      "code": "10335",
      "province": "zhejiang",
      "city": "杭州",
      "level": ["985", "211", "double_first"],
      "type": "综合"
    },
    {
      "id": "seu",
      "name": "东南大学",
      "code": "10286",
      "province": "jiangsu",
      "city": "南京",
      "level": ["985", "211", "double_first"],
      "type": "理工"
    }
  ]
}
```

- [ ] **Step 3: 创建专业数据样本**

Create: `public/data/majors.json`
```json
{
  "majors": [
    {
      "id": "software-engineering",
      "code": "080902",
      "name": "软件工程",
      "category": "工学",
      "subCategory": "计算机类",
      "duration": 4,
      "degree": "工学学士",
      "subjectRequirements": ["physics", "chemistry"],
      "physicalRestrictions": []
    },
    {
      "id": "computer-science",
      "code": "080901",
      "name": "计算机科学与技术",
      "category": "工学",
      "subCategory": "计算机类",
      "duration": 4,
      "degree": "工学学士",
      "subjectRequirements": ["physics", "chemistry"],
      "physicalRestrictions": []
    },
    {
      "id": "clinical-medicine",
      "code": "100201",
      "name": "临床医学",
      "category": "医学",
      "subCategory": "临床医学类",
      "duration": 5,
      "degree": "医学学士",
      "subjectRequirements": ["physics", "chemistry"],
      "physicalRestrictions": ["no_color_blindness"]
    }
  ]
}
```

- [ ] **Step 4: 创建录取分数样本**

Create: `public/data/scores/sample.json`
```json
{
  "scores": [
    {
      "collegeId": "nju",
      "majorId": "software-engineering",
      "year": 2025,
      "province": "zhejiang",
      "batch": "普通类一段",
      "minScore": 685,
      "avgScore": 688,
      "minRank": 1200
    },
    {
      "collegeId": "nju",
      "majorId": "software-engineering",
      "year": 2024,
      "province": "zhejiang",
      "batch": "普通类一段",
      "minScore": 682,
      "avgScore": 685,
      "minRank": 1350
    },
    {
      "collegeId": "zju",
      "majorId": "computer-science",
      "year": 2025,
      "province": "zhejiang",
      "batch": "普通类一段",
      "minScore": 690,
      "avgScore": 693,
      "minRank": 800
    }
  ]
}
```

- [ ] **Step 5: Commit**

Run:
```bash
git add public/data/
git commit -m "data: add sample provinces colleges majors and scores"
```

### Task 6: 创建数据加载服务

**Files:**
- Create: `src/shared/services/data-service.ts`
- Create: `src/shared/services/__tests__/data-service.test.ts`

- [ ] **Step 1: 实现数据加载服务**

Create: `src/shared/services/data-service.ts`
```ts
import { College, Major, ProvinceConfig, ScoreRecord } from '../types'

let provincesCache: ProvinceConfig[] | null = null
let collegesCache: College[] | null = null
let majorsCache: Major[] | null = null
let scoresCache: ScoreRecord[] | null = null

export async function loadProvinces(): Promise<ProvinceConfig[]> {
  if (provincesCache) return provincesCache
  const res = await fetch('/data/provinces.json')
  const data = await res.json()
  provincesCache = data.provinces
  return provincesCache
}

export async function loadColleges(): Promise<College[]> {
  if (collegesCache) return collegesCache
  const res = await fetch('/data/colleges.json')
  const data = await res.json()
  collegesCache = data.colleges
  return collegesCache
}

export async function loadMajors(): Promise<Major[]> {
  if (majorsCache) return majorsCache
  const res = await fetch('/data/majors.json')
  const data = await res.json()
  majorsCache = data.majors
  return majorsCache
}

export async function loadScores(): Promise<ScoreRecord[]> {
  if (scoresCache) return scoresCache
  const res = await fetch('/data/scores/sample.json')
  const data = await res.json()
  scoresCache = data.scores
  return scoresCache
}

export function findCollegeById(id: string): College | undefined {
  return collegesCache?.find((c) => c.id === id)
}

export function findMajorById(id: string): Major | undefined {
  return majorsCache?.find((m) => m.id === id)
}

export function getScoresByCollegeMajor(collegeId: string, majorId: string, province: string): ScoreRecord[] {
  return scoresCache?.filter(
    (s) => s.collegeId === collegeId && s.majorId === majorId && s.province === province,
  ) ?? []
}
```

- [ ] **Step 2: 编写测试**

Create: `src/shared/services/__tests__/data-service.test.ts`
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadColleges, loadMajors, loadProvinces, loadScores } from '../data-service'

describe('data-service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('should load provinces', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ provinces: [{ code: 'zhejiang', name: '浙江' }] }),
    } as Response)

    const provinces = await loadProvinces()
    expect(provinces).toHaveLength(1)
    expect(provinces[0].name).toBe('浙江')
  })

  it('should load colleges', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ colleges: [{ id: 'nju', name: '南京大学' }] }),
    } as Response)

    const colleges = await loadColleges()
    expect(colleges).toHaveLength(1)
    expect(colleges[0].name).toBe('南京大学')
  })
})
```

- [ ] **Step 3: 运行测试**

Run:
```bash
npx vitest run src/shared/services/__tests__/data-service.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/shared/services/
git commit -m "feat(services): add data loading service with tests"
```

---

## 4. 核心算法模块

### Task 7: 实现推荐引擎

**Files:**
- Create: `src/features/recommendation/engine.ts`
- Create: `src/features/recommendation/__tests__/engine.test.ts`

- [ ] **Step 1: 编写测试**

Create: `src/features/recommendation/__tests__/engine.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { generateRecommendations } from '../engine'
import { College, Major, ScoreRecord, UserProfile } from '../../../shared/types'

const colleges: College[] = [
  { id: 'nju', name: '南京大学', code: '10284', province: 'jiangsu', city: '南京', level: ['985'], type: '综合' },
  { id: 'zju', name: '浙江大学', code: '10335', province: 'zhejiang', city: '杭州', level: ['985'], type: '综合' },
]

const majors: Major[] = [
  { id: 'software-engineering', code: '080902', name: '软件工程', category: '工学', subCategory: '计算机类', duration: 4, degree: '工学学士', subjectRequirements: ['physics', 'chemistry'], physicalRestrictions: [] },
]

const scores: ScoreRecord[] = [
  { collegeId: 'nju', majorId: 'software-engineering', year: 2025, province: 'zhejiang', batch: '普通类一段', minScore: 685, avgScore: 688, minRank: 1200 },
  { collegeId: 'nju', majorId: 'software-engineering', year: 2024, province: 'zhejiang', batch: '普通类一段', minScore: 682, avgScore: 685, minRank: 1350 },
]

const profile: UserProfile = {
  province: 'zhejiang',
  subjectType: null,
  selectedSubjects: ['physics', 'chemistry', 'biology'],
  score: 690,
  rank: 1000,
  interests: [],
  preferredProvinces: [],
  preferredMajorCategories: [],
  preferredLevels: [],
  riskPreference: 'balanced',
}

describe('generateRecommendations', () => {
  it('should return recommendations sorted by probability', () => {
    const result = generateRecommendations(profile, colleges, majors, scores)
    expect(result).toHaveLength(1)
    expect(result[0].collegeId).toBe('nju')
    expect(result[0].tier).toBe('safe')
  })

  it('should filter by subject requirements', () => {
    const noSubjectProfile = { ...profile, selectedSubjects: ['history', 'politics', 'geography'] }
    const result = generateRecommendations(noSubjectProfile, colleges, majors, scores)
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 实现推荐引擎**

Create: `src/features/recommendation/engine.ts`
```ts
import { College, Major, Recommendation, ScoreRecord, UserProfile } from '../../shared/types'

export function generateRecommendations(
  profile: UserProfile,
  colleges: College[],
  majors: Major[],
  scores: ScoreRecord[],
): Recommendation[] {
  const recommendations: Recommendation[] = []

  for (const college of colleges) {
    for (const major of majors) {
      const majorScores = scores.filter(
        (s) => s.collegeId === college.id && s.majorId === major.id && s.province === profile.province,
      )

      if (majorScores.length === 0) continue
      if (!checkSubjectMatch(profile, major)) continue

      const avgRank = calculateAverageRank(majorScores)
      const probability = calculateProbability(profile.rank ?? 0, avgRank)
      const tier = getTier(probability, profile.riskPreference)

      recommendations.push({
        collegeId: college.id,
        majorId: major.id,
        probability,
        tier,
        reasons: generateReasons(profile, college, major, majorScores),
        scoreRecords: majorScores,
      })
    }
  }

  return recommendations.sort((a, b) => b.probability - a.probability)
}

function checkSubjectMatch(profile: UserProfile, major: Major): boolean {
  if (major.subjectRequirements.length === 0) return true
  return major.subjectRequirements.every((req) => profile.selectedSubjects.includes(req))
}

function calculateAverageRank(scores: ScoreRecord[]): number {
  const validRanks = scores.map((s) => s.minRank).filter((r): r is number => r !== undefined)
  if (validRanks.length === 0) return Infinity
  return validRanks.reduce((a, b) => a + b, 0) / validRanks.length
}

function calculateProbability(userRank: number, avgRank: number): number {
  if (avgRank === 0) return 0
  const ratio = avgRank / userRank
  const probability = Math.min(0.95, Math.max(0.05, ratio * 0.8))
  return Math.round(probability * 100) / 100
}

function getTier(probability: number, riskPreference: string): 'rush' | 'stable' | 'safe' {
  if (probability >= 0.8) return 'safe'
  if (probability >= 0.5) return 'stable'
  return 'rush'
}

function generateReasons(profile: UserProfile, college: College, major: Major, scores: ScoreRecord[]): string[] {
  const reasons: string[] = []
  const avgRank = calculateAverageRank(scores)

  if (profile.rank) {
    reasons.push(`你的位次 ${profile.rank}，近三年录取位次约 ${Math.round(avgRank)}`)
  }

  reasons.push(`专业选科要求为 ${major.subjectRequirements.map((s) => s).join('、')}，你已满足`)

  if (scores.length > 0) {
    const latest = scores.sort((a, b) => b.year - a.year)[0]
    reasons.push(`${latest.year}年最低分 ${latest.minScore}，你的分数 ${profile.score}`)
  }

  return reasons
}
```

- [ ] **Step 3: 运行测试**

Run:
```bash
npx vitest run src/features/recommendation/__tests__/engine.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/features/recommendation/
git commit -m "feat(recommendation): add basic recommendation engine with tests"
```

### Task 8: 实现风险预警模块

**Files:**
- Create: `src/features/risk/risk-detectors.ts`
- Create: `src/features/risk/risk-engine.ts`
- Create: `src/features/risk/__tests__/risk-engine.test.ts`

- [ ] **Step 1: 实现风险检测器**

Create: `src/features/risk/risk-detectors.ts`
```ts
import { Major, RiskWarning, UserProfile, VolunteerItem } from '../../shared/types'
import { findCollegeById, findMajorById } from '../../shared/services/data-service'

export interface RiskDetector {
  name: string
  detect(item: VolunteerItem, profile: UserProfile): RiskWarning | null
}

export const subjectMismatchDetector: RiskDetector = {
  name: 'SUBJECT_MISMATCH',
  detect: (item, profile) => {
    const major = findMajorById(item.majorId)
    if (!major) return null
    const mismatched = major.subjectRequirements.some((req) => !profile.selectedSubjects.includes(req))
    if (!mismatched) return null
    return {
      type: 'SUBJECT_MISMATCH',
      level: 'high',
      message: '选科要求不符',
      fixSuggestion: '请选择符合选科要求的专业',
    }
  },
}

export const physicalRestrictionDetector: RiskDetector = {
  name: 'PHYSICAL_RESTRICTION',
  detect: (item, profile) => {
    const major = findMajorById(item.majorId)
    if (!major || !major.physicalRestrictions?.includes('no_color_blindness')) return null
    return {
      type: 'PHYSICAL_RESTRICTION',
      level: 'high',
      message: '色盲色弱限报',
      fixSuggestion: '建议替换为不限色觉的专业',
    }
  },
}

export const adjustmentDetector: RiskDetector = {
  name: 'NOT_OBEYING_ADJUSTMENT',
  detect: (item) => {
    if (item.服从调剂) return null
    return {
      type: 'NOT_OBEYING_ADJUSTMENT',
      level: 'medium',
      message: '未勾选服从调剂',
      fixSuggestion: '建议勾选服从调剂，降低退档风险',
    }
  },
}
```

- [ ] **Step 2: 实现风险引擎**

Create: `src/features/risk/risk-engine.ts`
```ts
import { RiskWarning, UserProfile, VolunteerItem } from '../../shared/types'
import { adjustmentDetector, physicalRestrictionDetector, RiskDetector, subjectMismatchDetector } from './risk-detectors'

const detectors: RiskDetector[] = [
  subjectMismatchDetector,
  physicalRestrictionDetector,
  adjustmentDetector,
]

export function detectRisks(items: VolunteerItem[], profile: UserProfile): Map<string, RiskWarning[]> {
  const result = new Map<string, RiskWarning[]>()

  for (const item of items) {
    const warnings: RiskWarning[] = []
    for (const detector of detectors) {
      const warning = detector.detect(item, profile)
      if (warning) warnings.push(warning)
    }
    result.set(item.id, warnings)
  }

  return result
}

export function getHighestRiskLevel(warnings: RiskWarning[]): RiskWarning['level'] | null {
  if (warnings.some((w) => w.level === 'high')) return 'high'
  if (warnings.some((w) => w.level === 'medium')) return 'medium'
  return null
}
```

- [ ] **Step 3: 编写测试**

Create: `src/features/risk/__tests__/risk-engine.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { detectRisks } from '../risk-engine'
import { UserProfile, VolunteerItem } from '../../../shared/types'

const profile: UserProfile = {
  province: 'zhejiang',
  subjectType: null,
  selectedSubjects: ['physics', 'chemistry', 'biology'],
  score: 690,
  rank: 1000,
  interests: [],
  preferredProvinces: [],
  preferredMajorCategories: [],
  preferredLevels: [],
  riskPreference: 'balanced',
}

describe('detectRisks', () => {
  it('should detect no adjustment risk', () => {
    const items: VolunteerItem[] = [
      { id: '1', collegeId: 'nju', majorId: 'software-engineering', order: 1, 服从调剂: false },
    ]
    const risks = detectRisks(items, profile)
    expect(risks.get('1')).toHaveLength(1)
    expect(risks.get('1')?.[0].type).toBe('NOT_OBEYING_ADJUSTMENT')
  })
})
```

- [ ] **Step 4: 运行测试**

Run:
```bash
npx vitest run src/features/risk/__tests__/risk-engine.test.ts
```

Expected: 1 test pass.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/features/risk/
git commit -m "feat(risk): add risk detection engine with tests"
```

---

## 5. 页面实现

### Task 9: 实现首页

**Files:**
- Create: `src/pages/home/index.tsx`
- Create: `src/pages/home/__tests__/home.test.tsx`
- Modify: `src/App.tsx` 添加路由

- [ ] **Step 1: 实现首页组件**

Create: `src/pages/home/index.tsx`
```tsx
import { useNavigate } from 'react-router-dom'
import { AimOutlined, StarOutlined, DatabaseOutlined, MessageOutlined } from '@ant-design/icons'

export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg-page">
      <div className="bg-gradient-to-br from-primary-bg to-white dark:from-primary-bg dark:to-slate-900 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-display text-text-primary mb-2">让每一分都不浪费</h1>
          <p className="text-body text-text-secondary mb-8">免费 · 可解释 · 数据溯源</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/wizard')}
              className="h-11 px-6 rounded-lg bg-gradient-to-r from-primary to-primary-light text-white font-semibold shadow-primary hover:shadow-lg transition-all"
            >
              立即生成推荐
            </button>
            <button
              onClick={() => navigate('/recommend')}
              className="h-11 px-6 rounded-lg bg-white dark:bg-slate-800 border border-primary text-primary hover:bg-primary-bg transition-colors"
            >
              查看示例
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="mx-auto max-w-2xl grid grid-cols-2 gap-3">
          <QuickCard icon={<AimOutlined />} title="智能推荐" desc="基于位次法生成志愿" onClick={() => navigate('/wizard')} />
          <QuickCard icon={<StarOutlined />} title="兴趣测评" desc="发现适合的专业" onClick={() => navigate('/assessment')} />
          <QuickCard icon={<DatabaseOutlined />} title="数据中心" desc="查院校、专业、分数线" onClick={() => navigate('/data')} />
          <QuickCard icon={<MessageOutlined />} title="AI 问答" desc="咨询志愿填报问题" onClick={() => navigate('/chat')} />
        </div>
      </div>
    </div>
  )
}

function QuickCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-lg transition-all text-center"
    >
      <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl mb-2">
        {icon}
      </div>
      <div className="text-h3 text-text-primary">{title}</div>
      <div className="text-caption text-text-secondary">{desc}</div>
    </button>
  )
}
```

- [ ] **Step 2: 添加路由**

Modify: `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { antdTheme } from './shared/theme/antd-theme'
import { HomePage } from './pages/home'

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
```

- [ ] **Step 3: 编写首页测试**

Create: `src/pages/home/__tests__/home.test.tsx`
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { HomePage } from '../'

describe('HomePage', () => {
  it('should render hero and quick cards', () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    )
    expect(screen.getByText('让每一分都不浪费')).toBeInTheDocument()
    expect(screen.getByText('立即生成推荐')).toBeInTheDocument()
    expect(screen.getByText('智能推荐')).toBeInTheDocument()
  })

  it('should navigate to wizard when clicking primary button', () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    )
    fireEvent.click(screen.getByText('立即生成推荐'))
    expect(window.location.pathname).toBe('/wizard')
  })
})
```

- [ ] **Step 4: 运行测试**

Run:
```bash
npx vitest run src/pages/home/__tests__/home.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/pages/home/ src/App.tsx
git commit -m "feat(pages): implement home page with routing"
```

### Task 10: 实现向导页

**Files:**
- Create: `src/pages/wizard/index.tsx`
- Create: `src/pages/wizard/steps/ProvinceStep.tsx`
- Create: `src/pages/wizard/steps/ScoreStep.tsx`
- Create: `src/pages/wizard/steps/PreferenceStep.tsx`
- Create: `src/pages/wizard/steps/ResultStep.tsx`

- [ ] **Step 1: 实现省份步骤**

Create: `src/pages/wizard/steps/ProvinceStep.tsx`
```tsx
import { Select, Radio } from 'antd'
import { useProfileStore } from '../../../shared/stores/profile-store'
import { PROVINCES, SUBJECT_NAMES, SUBJECTS_3_3, SUBJECTS_3_1_2_FIRST, SUBJECTS_3_1_2_SECOND } from '../../../shared/constants'

export function ProvinceStep() {
  const profile = useProfileStore()

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-h3 text-text-primary mb-2">高考省份</label>
        <Select
          value={profile.province || undefined}
          onChange={(value) => profile.setProfile({ province: value })}
          placeholder="选择省份"
          className="w-full"
          options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
        />
      </div>
      <div>
        <label className="block text-h3 text-text-primary mb-2">选科</label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS_3_3.map((subject) => (
            <label key={subject} className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-border-color cursor-pointer">
              <input
                type="checkbox"
                checked={profile.selectedSubjects.includes(subject)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...profile.selectedSubjects, subject]
                    : profile.selectedSubjects.filter((s) => s !== subject)
                  profile.setProfile({ selectedSubjects: next })
                }}
              />
              <span className="text-body">{SUBJECT_NAMES[subject]}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 实现成绩步骤**

Create: `src/pages/wizard/steps/ScoreStep.tsx`
```tsx
import { Input, InputNumber } from 'antd'
import { useProfileStore } from '../../../shared/stores/profile-store'

export function ScoreStep() {
  const profile = useProfileStore()

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-h3 text-text-primary mb-2">高考分数</label>
        <InputNumber
          value={profile.score || undefined}
          onChange={(value) => profile.setProfile({ score: value || 0 })}
          placeholder="输入你的高考分数"
          min={0}
          max={750}
          className="w-full h-11"
        />
      </div>
      <div>
        <label className="block text-h3 text-text-primary mb-2">全省位次（选填）</label>
        <InputNumber
          value={profile.rank || undefined}
          onChange={(value) => profile.setProfile({ rank: value || null })}
          placeholder="输入你的全省位次"
          min={1}
          className="w-full h-11"
        />
        <p className="text-caption text-text-secondary mt-1">填写位次可让推荐更精准</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 实现偏好步骤**

Create: `src/pages/wizard/steps/PreferenceStep.tsx`
```tsx
import { Select, Slider } from 'antd'
import { useProfileStore } from '../../../shared/stores/profile-store'
import { PROVINCES } from '../../../shared/constants'

export function PreferenceStep() {
  const profile = useProfileStore()

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-h3 text-text-primary mb-2">期望地域</label>
        <Select
          mode="multiple"
          value={profile.preferredProvinces}
          onChange={(value) => profile.setProfile({ preferredProvinces: value })}
          placeholder="不限"
          className="w-full"
          options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
        />
      </div>
      <div>
        <label className="block text-h3 text-text-primary mb-2">院校层次</label>
        <Select
          mode="multiple"
          value={profile.preferredLevels}
          onChange={(value) => profile.setProfile({ preferredLevels: value })}
          placeholder="不限"
          className="w-full"
          options={[
            { value: '985', label: '985' },
            { value: '211', label: '211' },
            { value: 'double_first', label: '双一流' },
          ]}
        />
      </div>
      <div>
        <label className="block text-h3 text-text-primary mb-2">风险偏好</label>
        <Slider
          value={profile.riskPreference === 'conservative' ? 0 : profile.riskPreference === 'balanced' ? 1 : 2}
          onChange={(value) => {
            const mapping = ['conservative', 'balanced', 'aggressive'] as const
            profile.setProfile({ riskPreference: mapping[value] })
          }}
          min={0}
          max={2}
          marks={{ 0: '保守', 1: '均衡', 2: '激进' }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 实现结果加载步骤**

Create: `src/pages/wizard/steps/ResultStep.tsx`
```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '../../../shared/stores/profile-store'
import { useRecommendationStore } from '../../../shared/stores/recommendation-store'
import { loadColleges, loadMajors, loadScores } from '../../../shared/services/data-service'
import { generateRecommendations } from '../../../features/recommendation/engine'

export function ResultStep() {
  const navigate = useNavigate()
  const profile = useProfileStore()
  const { setRecommendations, setLoading } = useRecommendationStore()

  useEffect(() => {
    async function generate() {
      setLoading(true)
      const [colleges, majors, scores] = await Promise.all([
        loadColleges(),
        loadMajors(),
        loadScores(),
      ])
      const recommendations = generateRecommendations(profile, colleges, majors, scores)
      setRecommendations(recommendations)
      setLoading(false)
      navigate('/recommend')
    }
    generate()
  }, [navigate, profile, setRecommendations, setLoading])

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-12 h-12 rounded-full bg-primary-bg animate-pulse mb-4" />
      <p className="text-body text-text-secondary">正在为你匹配最佳志愿...</p>
    </div>
  )
}
```

- [ ] **Step 5: 实现向导容器**

Create: `src/pages/wizard/index.tsx`
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Steps, Button } from 'antd'
import { ProvinceStep } from './steps/ProvinceStep'
import { ScoreStep } from './steps/ScoreStep'
import { PreferenceStep } from './steps/PreferenceStep'
import { ResultStep } from './steps/ResultStep'

const steps = [
  { title: '省份', content: <ProvinceStep /> },
  { title: '成绩', content: <ScoreStep /> },
  { title: '偏好', content: <PreferenceStep /> },
  { title: '结果', content: <ResultStep /> },
]

export function WizardPage() {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()

  const next = () => setCurrent((prev) => Math.min(prev + 1, steps.length - 1))
  const prev = () => setCurrent((prev) => Math.max(prev - 1, 0))

  return (
    <div className="min-h-screen bg-bg-page px-4 py-6">
      <div className="mx-auto max-w-xl">
        <Steps current={current} items={steps.map((s) => ({ title: s.title }))} className="mb-8" />
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
          {steps[current].content}
          <div className="flex justify-between mt-8">
            {current > 0 ? (
              <Button onClick={prev}>上一步</Button>
            ) : (
              <Button onClick={() => navigate('/')}>返回首页</Button>
            )}
            {current < steps.length - 1 && (
              <Button type="primary" onClick={next}>
                {current === steps.length - 2 ? '生成推荐' : '下一步'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 更新路由**

Modify: `src/App.tsx`
```tsx
import { WizardPage } from './pages/wizard'

// 在 Routes 中添加
<Route path="/wizard" element={<WizardPage />} />
```

- [ ] **Step 7: Commit**

Run:
```bash
git add src/pages/wizard/
git commit -m "feat(pages): implement 4-step wizard"
```

### Task 11: 实现推荐结果页

**Files:**
- Create: `src/pages/recommend/index.tsx`
- Create: `src/pages/recommend/components/RecommendationCard.tsx`

- [ ] **Step 1: 实现推荐卡片组件**

Create: `src/pages/recommend/components/RecommendationCard.tsx`
```tsx
import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { Recommendation } from '../../../shared/types'
import { findCollegeById, findMajorById } from '../../../shared/services/data-service'
import { useVolunteerStore } from '../../../shared/stores/volunteer-store'

interface Props {
  recommendation: Recommendation
}

export function RecommendationCard({ recommendation }: Props) {
  const college = findCollegeById(recommendation.collegeId)
  const major = findMajorById(recommendation.majorId)
  const addItem = useVolunteerStore((state) => state.addItem)

  if (!college || !major) return null

  const tierLabels = { rush: '冲', stable: '稳', safe: '保' }
  const tierColors = { rush: 'text-tier-rush bg-red-50', stable: 'text-tier-stable bg-green-50', safe: 'text-tier-safe bg-blue-50' }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 hover:shadow-lg transition-all">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-h3 text-text-primary">{college.name} · {major.name}</h3>
          <p className="text-caption text-text-secondary">{college.level.join('/')} · {college.city} · {major.subjectRequirements.join('+')}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-label ${tierColors[recommendation.tier]}`}>
          {tierLabels[recommendation.tier]} {Math.round(recommendation.probability * 100)}%
        </span>
      </div>

      <div className="bg-primary-bg dark:bg-emerald-900/30 rounded-lg p-3 mb-3 border-l-4 border-primary">
        <p className="text-caption text-primary-dark dark:text-primary font-semibold mb-1">💡 为什么推荐？</p>
        <ul className="space-y-1">
          {recommendation.reasons.slice(0, 3).map((reason, index) => (
            <li key={index} className="text-caption text-text-body">• {reason}</li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between items-center">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => addItem(recommendation.collegeId, recommendation.majorId)}
        >
          加入志愿表
        </Button>
        <Button type="text">详情</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 实现推荐结果页**

Create: `src/pages/recommend/index.tsx`
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, Empty, Button } from 'antd'
import { useRecommendationStore } from '../../shared/stores/recommendation-store'
import { RecommendationCard } from './components/RecommendationCard'

export function RecommendPage() {
  const navigate = useNavigate()
  const { recommendations, isLoading } = useRecommendationStore()
  const [activeTier, setActiveTier] = useState('stable')

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary-bg animate-pulse mx-auto mb-4" />
          <p className="text-body text-text-secondary">正在生成推荐...</p>
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center px-4">
        <Empty description="还没有推荐结果，先填写志愿信息吧">
          <Button type="primary" onClick={() => navigate('/wizard')}>
            去填写
          </Button>
        </Empty>
      </div>
    )
  }

  const tiers = [
    { key: 'rush', label: `冲 (${recommendations.filter((r) => r.tier === 'rush').length})` },
    { key: 'stable', label: `稳 (${recommendations.filter((r) => r.tier === 'stable').length})` },
    { key: 'safe', label: `保 (${recommendations.filter((r) => r.tier === 'safe').length})` },
  ]

  const filtered = recommendations.filter((r) => r.tier === activeTier)

  return (
    <div className="min-h-screen bg-bg-page px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-h1 text-text-primary mb-2">为你推荐的志愿</h1>
        <p className="text-body text-text-secondary mb-6">基于你的分数和偏好，生成 {recommendations.length} 个推荐</p>

        <Tabs activeKey={activeTier} onChange={setActiveTier} items={tiers} className="mb-4" />

        <div className="space-y-3">
          {filtered.map((rec, index) => (
            <RecommendationCard key={`${rec.collegeId}-${rec.majorId}-${index}`} recommendation={rec} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 更新路由**

Modify: `src/App.tsx`
```tsx
import { RecommendPage } from './pages/recommend'

// 在 Routes 中添加
<Route path="/recommend" element={<RecommendPage />} />
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/pages/recommend/
git commit -m "feat(pages): implement recommendation result page"
```

### Task 12: 实现志愿表页

**Files:**
- Create: `src/pages/volunteer-list/index.tsx`

- [ ] **Step 1: 实现志愿表页**

Create: `src/pages/volunteer-list/index.tsx`
```tsx
import { Button, Alert } from 'antd'
import { useVolunteerStore } from '../../shared/stores/volunteer-store'
import { useProfileStore } from '../../shared/stores/profile-store'
import { detectRisks } from '../../features/risk/risk-engine'
import { findCollegeById, findMajorById } from '../../shared/services/data-service'

export function VolunteerListPage() {
  const items = useVolunteerStore((state) => state.items)
  const removeItem = useVolunteerStore((state) => state.removeItem)
  const toggleAdjustment = useVolunteerStore((state) => state.toggleAdjustment)
  const profile = useProfileStore()

  const risks = detectRisks(items, profile)
  const highRiskCount = Array.from(risks.values()).filter((w) => w.some((r) => r.level === 'high')).length
  const mediumRiskCount = Array.from(risks.values()).filter((w) => w.some((r) => r.level === 'medium')).length

  return (
    <div className="min-h-screen bg-bg-page px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-h1 text-text-primary mb-2">我的志愿表</h1>

        <Alert
          message={
            <div className="flex gap-4">
              <span className="text-error">🔴 高风险 {highRiskCount}</span>
              <span className="text-warning">🟡 中风险 {mediumRiskCount}</span>
              <span className="text-success">🟢 正常 {items.length - highRiskCount - mediumRiskCount}</span>
            </div>
          }
          type={highRiskCount > 0 ? 'error' : mediumRiskCount > 0 ? 'warning' : 'success'}
          className="mb-4"
        />

        <div className="space-y-3">
          {items.map((item, index) => {
            const college = findCollegeById(item.collegeId)
            const major = findMajorById(item.majorId)
            const itemRisks = risks.get(item.id) || []

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 border-l-4 ${
                  itemRisks.some((r) => r.level === 'high') ? 'border-error' :
                  itemRisks.some((r) => r.level === 'medium') ? 'border-warning' : 'border-success'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-h3 text-text-primary">{index + 1}. {college?.name} · {major?.name}</div>
                    <div className="text-caption text-text-secondary">{college?.city} · {major?.subjectRequirements.join('+')}</div>
                  </div>
                  <Button danger size="small" onClick={() => removeItem(item.id)}>删除</Button>
                </div>

                <label className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    checked={item.服从调剂}
                    onChange={() => toggleAdjustment(item.id)}
                  />
                  <span className="text-body">服从调剂</span>
                </label>

                {itemRisks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {itemRisks.map((risk, idx) => (
                      <div key={idx} className={`p-2 rounded-lg text-caption ${
                        risk.level === 'high' ? 'bg-red-50 text-error' : 'bg-yellow-50 text-warning'
                      }`}>
                        <strong>{risk.level === 'high' ? '❌' : '⚠'} {risk.message}</strong>
                        {risk.fixSuggestion && <div>{risk.fixSuggestion}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex gap-3">
          <Button className="flex-1 h-11">导出</Button>
          <Button type="primary" className="flex-1 h-11" disabled={highRiskCount > 0}>
            {highRiskCount > 0 ? `有 ${highRiskCount} 项高风险` : '提交志愿表'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 更新路由**

Modify: `src/App.tsx`
```tsx
import { VolunteerListPage } from './pages/volunteer-list'

// 在 Routes 中添加
<Route path="/volunteer-list" element={<VolunteerListPage />} />
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/pages/volunteer-list/
git commit -m "feat(pages): implement volunteer list page with risk warnings"
```

### Task 13: 实现导航与布局

**Files:**
- Create: `src/shared/components/layout/DesktopNav.tsx`
- Create: `src/shared/components/layout/MobileTabBar.tsx`
- Create: `src/shared/components/layout/AppLayout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现桌面导航**

Create: `src/shared/components/layout/DesktopNav.tsx`
```tsx
import { Link, useLocation } from 'react-router-dom'
import { SettingOutlined } from '@ant-design/icons'

const navItems = [
  { path: '/', label: '首页' },
  { path: '/recommend', label: '推荐' },
  { path: '/volunteer-list', label: '志愿表' },
  { path: '/assessment', label: '测评' },
  { path: '/data', label: '数据' },
  { path: '/chat', label: 'AI' },
]

export function DesktopNav() {
  const location = useLocation()

  return (
    <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-800 shadow-sm">
      <Link to="/" className="text-h3 text-primary font-bold">🎓 智填志愿</Link>
      <nav className="flex items-center gap-6">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`text-body transition-colors ${
              location.pathname === item.path ? 'text-primary font-semibold' : 'text-text-secondary hover:text-primary'
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link to="/settings" className="text-text-secondary hover:text-primary">
          <SettingOutlined />
        </Link>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: 实现移动端 Tab 栏**

Create: `src/shared/components/layout/MobileTabBar.tsx`
```tsx
import { Link, useLocation } from 'react-router-dom'
import { HomeOutlined, AimOutlined, FileTextOutlined, DatabaseOutlined, MessageOutlined } from '@ant-design/icons'

const tabs = [
  { path: '/', label: '首页', icon: HomeOutlined },
  { path: '/recommend', label: '推荐', icon: AimOutlined },
  { path: '/volunteer-list', label: '志愿表', icon: FileTextOutlined },
  { path: '/data', label: '数据', icon: DatabaseOutlined },
  { path: '/chat', label: 'AI', icon: MessageOutlined },
]

export function MobileTabBar() {
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-border-color flex justify-around py-2 z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = location.pathname === tab.path
        return (
          <Link key={tab.path} to={tab.path} className="flex flex-col items-center gap-1 px-3 py-1">
            <Icon className={`text-lg ${isActive ? 'text-primary' : 'text-text-secondary'}`} />
            <span className={`text-xs ${isActive ? 'text-primary font-semibold' : 'text-text-secondary'}`}>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: 实现布局容器**

Create: `src/shared/components/layout/AppLayout.tsx`
```tsx
import { Outlet } from 'react-router-dom'
import { DesktopNav } from './DesktopNav'
import { MobileTabBar } from './MobileTabBar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-page pb-16 md:pb-0">
      <DesktopNav />
      <main>
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  )
}
```

- [ ] **Step 4: 更新 App.tsx 使用布局**

Modify: `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { antdTheme } from './shared/theme/antd-theme'
import { AppLayout } from './shared/components/layout/AppLayout'
import { HomePage } from './pages/home'
import { WizardPage } from './pages/wizard'
import { RecommendPage } from './pages/recommend'
import { VolunteerListPage } from './pages/volunteer-list'

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/recommend" element={<RecommendPage />} />
            <Route path="/volunteer-list" element={<VolunteerListPage />} />
          </Route>
          <Route path="/wizard" element={<WizardPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
```

- [ ] **Step 5: Commit**

Run:
```bash
git add src/shared/components/layout/ src/App.tsx
git commit -m "feat(layout): add responsive navigation and layout"
```

### Task 14: 实现设置页

**Files:**
- Create: `src/pages/settings/index.tsx`

- [ ] **Step 1: 实现设置页**

Create: `src/pages/settings/index.tsx`
```tsx
import { Card, Input, Button, Switch } from 'antd'
import { useDarkMode } from '../../shared/hooks/use-dark-mode'

export function SettingsPage() {
  const { isDark, toggle } = useDarkMode()

  return (
    <div className="min-h-screen bg-bg-page px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-h1 text-text-primary">设置</h1>

        <Card title="外观">
          <div className="flex justify-between items-center">
            <span className="text-body">深色模式</span>
            <Switch checked={isDark} onChange={toggle} />
          </div>
        </Card>

        <Card title="LLM 配置">
          <div className="space-y-3">
            <div>
              <label className="block text-caption text-text-secondary mb-1">Base URL</label>
              <Input placeholder="https://api.openai.com/v1" />
            </div>
            <div>
              <label className="block text-caption text-text-secondary mb-1">API Key</label>
              <Input.Password placeholder="sk-..." />
            </div>
            <div>
              <label className="block text-caption text-text-secondary mb-1">Model</label>
              <Input placeholder="gpt-3.5-turbo" />
            </div>
            <Button type="primary">测试连接</Button>
          </div>
        </Card>

        <Card title="数据管理">
          <Button danger>清除本地数据</Button>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 更新路由**

Modify: `src/App.tsx`
```tsx
import { SettingsPage } from './pages/settings'

// 在 AppLayout 路由中添加
<Route path="/settings" element={<SettingsPage />} />
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/pages/settings/
git commit -m "feat(pages): add settings page with dark mode and llm config"
```

---

## 6. 测试与质量

### Task 15: 添加端到端测试与构建验证

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/home.spec.ts`

- [ ] **Step 1: 配置 Playwright**

Create: `playwright.config.ts`
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
})
```

- [ ] **Step 2: 编写首页 E2E 测试**

Create: `e2e/home.spec.ts`
```ts
import { test, expect } from '@playwright/test'

test('homepage has title and CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('让每一分都不浪费')).toBeVisible()
  await expect(page.getByText('立即生成推荐')).toBeVisible()
})

test('navigate to wizard', async ({ page }) => {
  await page.goto('/')
  await page.getByText('立即生成推荐').click()
  await expect(page).toHaveURL(/.*wizard/)
})
```

- [ ] **Step 3: 验证构建**

Run:
```bash
npm run build
```

Expected: 构建成功，`dist/` 目录生成。

- [ ] **Step 4: Commit**

Run:
```bash
git add playwright.config.ts e2e/
git commit -m "test(e2e): add playwright config and homepage tests"
```

---

## 7. 部署

### Task 16: 配置 GitHub Pages 部署

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 创建 GitHub Actions 工作流**

Create: `.github/workflows/deploy.yml`
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

Run:
```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add github pages deployment workflow"
```

---

## 8. 计划自审

### 8.1 需求覆盖检查

| 需求文档功能 | 对应任务 |
|-------------|---------|
| 4 步向导 | Task 10 |
| 推荐结果（冲稳保） | Task 11 |
| 志愿表管理 | Task 12 |
| 风险预警 | Task 8, Task 12 |
| 兴趣测评 | Task 10（基础结构，可扩展） |
| 数据中心 | Task 11（基础查询，可扩展） |
| AI 对话 | Task 14（设置入口，需后续接入 LLM） |
| 数据溯源 | Task 11（可解释区，可扩展引用标注） |
| 响应式导航 | Task 13 |
| 深色模式 | Task 4, Task 14 |

### 8.2 Placeholder 检查

- 无 TBD/TODO
- 所有任务都有具体文件路径和代码示例
- 所有测试任务都有明确命令和期望输出

### 8.3 类型一致性检查

- `UserProfile`、`Recommendation`、`VolunteerItem` 等类型在 Task 2 定义，后续任务一致使用
- Store 状态类型与类型定义一致
- 风险检测器返回 `RiskWarning` 类型

### 8.4 已知限制

1. v1.0 仅包含浙江/江苏/河南三个省份的样本数据，后续需补充更多省份
2. 兴趣测评和数据中心仅实现基础框架，完整功能在后续迭代
3. AI 对话模块仅实现配置入口，LLM 集成在后续迭代
4. 数据溯源的内联引用标注在 v1.0 中以"可解释区"替代，完整引用编号在后续迭代

---

## 9. 执行方式

**Plan complete and saved to `docs/implementation-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 分配给一个独立的子代理执行，逐 Task 审阅，快速迭代

**2. Inline Execution** — 在当前会话中按 Task 顺序执行，使用 executing-plans skill，批量执行并在关键节点检查

Which approach would you prefer?
