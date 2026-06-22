# FR-08/03/06 一分一段表查询 + 锁定后重新推荐 + 多方案对比 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按依赖顺序实现三个独立需求：FR-08 一分一段表查询入口（DataCenter 第 4 Tab）、FR-03 志愿锁定后重新推荐（VolunteerItem.locked + exclude 选项）、FR-06 多方案保存对比（schemes 状态 + SchemeCompare 页）。

**Architecture:** FR-08 新增 `RankTableSearch` 组件 + `probeRankTableYears` 辅助函数；FR-03 给 `VolunteerItem` 加 `locked` 字段、给 `RecommendOptions` 加 `exclude` 选项、给 store 加 `setVolunteerList` action；FR-06 新增 `VolunteerScheme` 类型 + 4 个 store action + `SchemeCompare` 对比页 + `/schemes` 路由。

**Tech Stack:** React 18 + TypeScript + Vite + Zustand（persist）+ Ant Design 5 + Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-06-22-fr08-03-06-ranktable-lock-schemes-design.md`

**Test command:** `npx vitest run`（项目根目录，需先 `export PATH="/opt/homebrew/bin:$PATH"`）

**Typecheck:** `npx tsc --noEmit`

**Lint:** `npx eslint src --ext .ts,.tsx`

---

## File Structure

```
新增文件：
  src/pages/DataCenter/components/RankTableSearch.tsx        # FR-08 一分一段表查询组件
  src/pages/DataCenter/components/RankTableSearch.test.tsx   # FR-08 组件测试
  src/pages/SchemeCompare.tsx                                # FR-06 方案对比页
  src/pages/SchemeCompare.test.tsx                           # FR-06 页面测试

修改文件：
  src/services/dataLoader.ts                                 # FR-08 加 probeRankTableYears
  src/services/dataLoader.test.ts                            # FR-08 测试扩展
  src/store/index.ts                                         # FR-03 locked + setVolunteerList；FR-06 schemes
  src/store/index.test.ts                                    # FR-06 schemes action 测试
  src/services/recommender.ts                                # FR-03 加 exclude 选项
  src/services/recommender.test.ts                           # FR-03 exclude 测试
  src/pages/DataCenter.tsx                                   # FR-08 加第 4 个 Tab
  src/pages/VolunteerList.tsx                                # FR-03 锁定 UI + FR-06 保存方案按钮
  src/router/index.tsx                                       # FR-06 加 /schemes 路由
```

---

## FR-08 一分一段表查询入口

## Task 1: probeRankTableYears 辅助函数

**Files:**
- Modify: `src/services/dataLoader.ts`
- Modify: `src/services/dataLoader.test.ts`

**Why:** `RankTableSearch` 组件需要先探测可用年份，再让用户选择。该函数带内存缓存避免重复 fetch。

- [ ] **Step 1: 写测试 - probeRankTableYears 基础行为**

在 `src/services/dataLoader.test.ts` 末尾追加测试块。**该文件当前不存在，需新建**，文件顶部需添加 import：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

然后追加测试块：

```typescript
describe('probeRankTableYears', () => {
  beforeEach(() => {
    // 重置模块内缓存
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('返回可用年份数组（降序）', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      return Promise.resolve({
        ok: url.includes('2024') || url.includes('2025'),
      } as Response)
    }))
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('beijing')
    expect(years).toEqual([2025, 2024])
  })

  it('无数据省份返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)))
    const { probeRankTableYears } = await import('./dataLoader')
    const years = await probeRankTableYears('unknown')
    expect(years).toEqual([])
  })

  it('内存缓存：第二次调用不重复 fetch', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response))
    vi.stubGlobal('fetch', fetchMock)
    const { probeRankTableYears } = await import('./dataLoader')
    await probeRankTableYears('shanghai')
    const firstCallCount = fetchMock.mock.calls.length
    await probeRankTableYears('shanghai')
    expect(fetchMock.mock.calls.length).toBe(firstCallCount)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/services/dataLoader.test.ts`
Expected: 3 个新测试 FAIL（probeRankTableYears 未定义）

- [ ] **Step 3: 实现 probeRankTableYears**

在 `src/services/dataLoader.ts` 末尾追加：

```typescript
const rankTableYearsCache = new Map<string, number[]>()

export async function probeRankTableYears(provinceName: string): Promise<number[]> {
  if (rankTableYearsCache.has(provinceName)) {
    return rankTableYearsCache.get(provinceName)!
  }
  const years = [2023, 2024, 2025]
  const results = await Promise.all(
    years.map(async (year) => {
      try {
        const response = await fetch(`/data/scores/${provinceName}/rank_table_${year}.json`)
        return response.ok ? year : null
      } catch {
        return null
      }
    })
  )
  const available = results.filter((y): y is number => y !== null).sort((a, b) => b - a)
  rankTableYearsCache.set(provinceName, available)
  return available
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/services/dataLoader.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/dataLoader.ts src/services/dataLoader.test.ts
git commit -m "feat(FR-08): add probeRankTableYears helper with in-memory cache"
```

---

## Task 2: RankTableSearch 组件

**Files:**
- Create: `src/pages/DataCenter/components/RankTableSearch.tsx`
- Create: `src/pages/DataCenter/components/RankTableSearch.test.tsx`

**Why:** 一分一段表查询 UI，支持省份+年份+科类选择、搜索过滤、表格展示。

- [ ] **Step 1: 写测试 - 组件渲染与交互**

创建 `src/pages/DataCenter/components/RankTableSearch.test.tsx`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RankTableSearch from './RankTableSearch'

// loadRankTable 返回扁平的 RankTableEntry[]（字段：province/year/category/score/rank/count/cumulativeCount）
const mockEntries = [
  { province: 'beijing', year: 2025, category: '物理类', score: 600, rank: 1000, count: 50, cumulativeCount: 1000 },
  { province: 'beijing', year: 2025, category: '物理类', score: 599, rank: 1050, count: 30, cumulativeCount: 1030 },
]

vi.mock('../../../services/dataLoader', () => ({
  probeRankTableYears: vi.fn().mockResolvedValue([2025, 2024]),
  loadRankTable: vi.fn().mockResolvedValue(mockEntries),
}))

const renderComponent = (props = {}) => {
  return render(
    <MemoryRouter>
      <RankTableSearch provinceId="11" provinceName="beijing" {...props} />
    </MemoryRouter>
  )
}

describe('RankTableSearch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('渲染年份和科类选择器', async () => {
    renderComponent()
    await waitFor(() => expect(screen.getByText('一分一段表')).toBeInTheDocument())
    expect(screen.getByText('年份')).toBeInTheDocument()
    expect(screen.getByText('科类')).toBeInTheDocument()
  })

  it('加载并显示一分一段表数据', async () => {
    renderComponent()
    await waitFor(() => expect(screen.getByText('600')).toBeInTheDocument())
    expect(screen.getByText('1000')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument() // 同分人数 count
  })

  it('搜索框输入分数后过滤表格', async () => {
    renderComponent()
    await waitFor(() => expect(screen.getByText('600')).toBeInTheDocument())
    const input = screen.getByPlaceholderText('搜索分数或位次')
    fireEvent.change(input, { target: { value: '600' } })
    expect(screen.getByText('600')).toBeInTheDocument()
    expect(screen.queryByText('599')).not.toBeInTheDocument()
  })

  it('无数据省份显示 Empty', async () => {
    const { loadRankTable } = await import('../../../services/dataLoader')
    ;(loadRankTable as any).mockResolvedValueOnce([])
    const { probeRankTableYears } = await import('../../../services/dataLoader')
    ;(probeRankTableYears as any).mockResolvedValueOnce([])
    renderComponent({ provinceName: 'unknown' })
    await waitFor(() => expect(screen.getByText('暂无数据')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/pages/DataCenter/components/RankTableSearch.test.tsx`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 实现 RankTableSearch 组件**

创建 `src/pages/DataCenter/components/RankTableSearch.tsx`：

```typescript
import { useEffect, useState, useMemo } from 'react'
import { Select, Input, Table, Empty, Spin } from 'antd'
import { probeRankTableYears, loadRankTable, type RankTableEntry } from '../../../services/dataLoader'

interface RankTableSearchProps {
  provinceId: string
  provinceName: string
}

export default function RankTableSearch({ provinceId, provinceName }: RankTableSearchProps) {
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | undefined>()
  const [allData, setAllData] = useState<RankTableEntry[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // 1. 探测年份
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    probeRankTableYears(provinceName).then((ys) => {
      if (cancelled) return
      setYears(ys)
      if (ys.length > 0) setSelectedYear(ys[0])
      else setLoading(false)
    })
    return () => { cancelled = true }
  }, [provinceName])

  // 2. 加载完整一分一段表（扁平数组），派生科类选项
  useEffect(() => {
    if (!selectedYear) return
    let cancelled = false
    setLoading(true)
    loadRankTable(provinceName, selectedYear).then((entries) => {
      if (cancelled) return
      setAllData(entries)
      const cats = Array.from(new Set(entries.map(e => e.category)))
      if (cats.length > 0) setSelectedCategory(cats[0])
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [selectedYear, provinceName])

  // 派生：科类选项
  const categories = useMemo(
    () => Array.from(new Set(allData.map(e => e.category))),
    [allData]
  )

  // 派生：当前科类下的数据
  const categoryData = useMemo(
    () => allData.filter(e => e.category === selectedCategory),
    [allData, selectedCategory]
  )

  // 派生：搜索过滤
  const filteredData = useMemo(() => {
    if (!search.trim()) return categoryData
    const q = search.trim()
    return categoryData.filter(d => String(d.score).includes(q) || String(d.rank).includes(q))
  }, [categoryData, search])

  if (years.length === 0 && !loading) {
    return <Empty description="暂无数据" />
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">一分一段表</h2>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span>年份</span>
          <Select
            value={selectedYear}
            onChange={setSelectedYear}
            options={years.map(y => ({ value: y, label: `${y} 年` }))}
            className="w-32"
            placeholder="选择年份"
          />
        </div>
        <div className="flex items-center gap-2">
          <span>科类</span>
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories.map(c => ({ value: c, label: c }))}
            className="w-32"
            placeholder="选择科类"
          />
        </div>
        <Input.Search
          placeholder="搜索分数或位次"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
          allowClear
        />
      </div>
      <Spin spinning={loading}>
        <Table
          dataSource={filteredData.map((d, i) => ({ ...d, key: i }))}
          columns={[
            { title: '分数', dataIndex: 'score', key: 'score' },
            { title: '位次', dataIndex: 'rank', key: 'rank' },
            { title: '同分人数', dataIndex: 'count', key: 'count' },
            { title: '累计人数', dataIndex: 'cumulativeCount', key: 'cumulativeCount' },
          ]}
          pagination={{ pageSize: 50 }}
          scroll={{ y: 500 }}
          size="small"
        />
      </Spin>
    </div>
  )
}
```

> **注意**：`loadRankTable` 返回扁平的 `RankTableEntry[]`（不是 `{ categories: {...} }`），字段为 `count`（非 `sameScoreCount`）。科类从 `entry.category` 派生，客户端过滤，避免重复 fetch。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/pages/DataCenter/components/RankTableSearch.test.tsx`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/DataCenter/components/RankTableSearch.tsx src/pages/DataCenter/components/RankTableSearch.test.tsx
git commit -m "feat(FR-08): add RankTableSearch component with year/category/search filters"
```

---

## Task 3: DataCenter Tab 集成

**Files:**
- Modify: `src/pages/DataCenter.tsx`

**Why:** 将 RankTableSearch 作为第 4 个 Tab 集成到数据中心页面。

- [ ] **Step 1: 读取 DataCenter.tsx 当前结构**

Read: `src/pages/DataCenter.tsx`，定位 Tab items 数组与 profile 解构位置。

- [ ] **Step 2: 修改 DataCenter.tsx，加第 4 个 Tab**

在文件顶部添加 import：
```typescript
import RankTableSearch from './components/RankTableSearch'
```

在 Tab items 数组末尾追加：
```typescript
{
  key: 'rankTable',
  label: '一分一段表',
  children: <RankTableSearch provinceId={profile.provinceId} provinceName={profile.provinceName} />,
}
```

注意：若 `profile` 未在组件内解构，需从 store 获取 `profile` 字段（参考已有 Tab 的用法）。

- [ ] **Step 3: 运行 typecheck 和现有测试**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck 通过，所有测试 PASS（无回归）

- [ ] **Step 4: Commit**

```bash
git add src/pages/DataCenter.tsx
git commit -m "feat(FR-08): integrate RankTableSearch as 4th tab in DataCenter"
```

---

## FR-03 志愿锁定后重新推荐

## Task 4: store 加 locked 字段 + setVolunteerList action

**Files:**
- Modify: `src/store/index.ts`

**Why:** VolunteerItem 需要 `locked` 字段记录用户锁定状态；VolunteerList 重新推荐后需要 `setVolunteerList` 一次性替换整个列表。

- [ ] **Step 1: 读取 store/index.ts 当前结构**

Read: `src/store/index.ts`，定位 `VolunteerItem` 接口和 `AppState` 接口。

- [ ] **Step 2: 修改 VolunteerItem 接口**

在 `VolunteerItem` 接口末尾追加：
```typescript
locked?: boolean
```

- [ ] **Step 3: 修改 AppState 接口，加 setVolunteerList**

在 `AppState` 接口的 action 区域追加：
```typescript
setVolunteerList: (items: VolunteerItem[]) => void
```

- [ ] **Step 4: 实现 setVolunteerList action**

在 store 实现区域（其他 action 旁边）追加：
```typescript
setVolunteerList: (items) => set({ volunteerList: items }),
```

- [ ] **Step 5: 运行 typecheck 和现有测试**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck 通过，所有测试 PASS（locked 为可选字段，无回归）

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts
git commit -m "feat(FR-03): add locked field to VolunteerItem and setVolunteerList action"
```

---

## Task 5: recommender 加 exclude 选项

**Files:**
- Modify: `src/services/recommender.ts`
- Modify: `src/services/recommender.test.ts`

**Why:** 锁定后重新推荐时，需要排除已锁定的 college+major 组合，避免重复推荐。

- [ ] **Step 1: 写测试 - exclude 行为**

在 `src/services/recommender.test.ts` 末尾追加测试块：

```typescript
describe('generateRecommendations with exclude', () => {
  it('被排除的 college+major 不出现在结果中', async () => {
    const profile = /* 复用已有测试中的 profile fixture */
    const cache = /* 复用已有测试中的 cache fixture */
    const exclude = [{ collegeId: 'c1', majorId: 'm1' }]
    const recs = await generateRecommendations(profile, cache, { exclude })
    expect(recs.find(r => r.college.id === 'c1' && r.major.id === 'm1')).toBeUndefined()
  })

  it('未传 exclude 时行为不变', async () => {
    const profile = /* fixture */
    const cache = /* fixture */
    const recs = await generateRecommendations(profile, cache)
    // 与现有测试断言一致
    expect(recs.length).toBeGreaterThan(0)
  })
})
```

注意：fixture 需复用文件内已有的 profile/cache 构造，避免重复定义。如果文件内无现成 fixture，参考其他测试用例的构造方式。

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/services/recommender.test.ts`
Expected: 新测试 FAIL（exclude 未生效）

- [ ] **Step 3: 修改 RecommendOptions 接口**

在 `src/services/recommender.ts` 的 `RecommendOptions` 接口追加：
```typescript
exclude?: Array<{ collegeId: string; majorId: string }>
```

- [ ] **Step 4: 在 generateRecommendations 内构造 excludeSet**

在函数开头（参数解构后）追加：
```typescript
const excludeSet = options?.exclude
  ? new Set(options.exclude.map(e => `${e.collegeId}-${e.majorId}`))
  : null
```

- [ ] **Step 5: 在 for-of 循环内追加过滤**

定位 `for (const [, records] of recordMap)` 循环，在 `college` 和 `major` 确定后（`getOrCreateMajor` 调用之后），现有过滤条件之前追加：
```typescript
if (excludeSet && excludeSet.has(`${college.id}-${major.id}`)) continue
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npx vitest run src/services/recommender.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/recommender.ts src/services/recommender.test.ts
git commit -m "feat(FR-03): add exclude option to generateRecommendations"
```

---

## Task 6: VolunteerList 锁定 UI + 重新推荐逻辑

**Files:**
- Modify: `src/pages/VolunteerList.tsx`

**Why:** 用户需要锁定志愿并触发"锁定后重新推荐"，保留锁定项、替换未锁定项。

- [ ] **Step 1: 读取 VolunteerList.tsx 当前结构**

Read: `src/pages/VolunteerList.tsx`，定位：
- 顶部按钮区
- VolunteerCard 渲染位置
- store 解构字段
- 现有 import 列表

- [ ] **Step 2: 添加 import**

在文件顶部追加：
```typescript
import { LockOutlined, UnlockOutlined, ReloadOutlined } from '@ant-design/icons'
import { generateRecommendations } from '../services/recommender'
import { loadProvinceData, loadMajorMapping } from '../services/dataLoader'
import { deriveHollandCategories } from '../services/rankScorer'
import type { AssessmentInput } from '../services/rankScorer'
import type { VolunteerItem } from '../store'
import { message } from 'antd'
import { useState } from 'react'
```

注意：仅添加尚未 import 的项；若已存在则跳过。

- [ ] **Step 3: 从 store 解构新字段**

在 store 解构语句追加：
```typescript
const { /* 现有字段 */ recommendWeights, integratedAssessment, subjectAssessmentResult, setVolunteerList } = useAppStore()
```

- [ ] **Step 4: 添加 regenerating state**

在组件函数体顶部追加：
```typescript
const [regenerating, setRegenerating] = useState(false)
```

- [ ] **Step 5: 实现 handleRegenerateExcludingLocked**

在组件函数体内追加：

```typescript
const handleRegenerateExcludingLocked = async () => {
  const lockedItems = volunteerList.filter(v => v.locked)
  if (lockedItems.length === 0) {
    message.warning('请先锁定至少一个志愿')
    return
  }
  setRegenerating(true)
  try {
    const exclude = lockedItems.map(v => ({ collegeId: v.college.id, majorId: v.major.id }))
    const cache = await loadProvinceData(profile.provinceId)
    const majorMapping = await loadMajorMapping()
    const assessment: AssessmentInput = {
      hollandCategories: deriveHollandCategories(integratedAssessment?.hollandCode, majorMapping),
      subjectCategories: subjectAssessmentResult?.recommendedCategories ?? [],
      mbtiCategories: integratedAssessment?.mbtiCategories ?? [],
    }
    const newRecs = await generateRecommendations(profile, cache || undefined, {
      weights: recommendWeights,
      assessment,
      exclude,
    })
    const lockedSet = new Set(lockedItems.map(v => v.id))
    const remainingLocked = volunteerList.filter(v => lockedSet.has(v.id))
    const newVolunteers: VolunteerItem[] = newRecs.map(r => ({
      id: `${r.college.id}-${r.major.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      college: r.college,
      major: r.major,
      tier: r.tier,
      probability: r.probability,
      minRank: r.minRanks[0]?.rank,
      obeyAdjust: true,
      locked: false,
    }))
    setVolunteerList([...remainingLocked, ...newVolunteers])
    message.success(`已重新推荐，保留 ${remainingLocked.length} 个锁定志愿，新增 ${newVolunteers.length} 个推荐`)
  } catch (err) {
    message.error('重新推荐失败：' + (err instanceof Error ? err.message : '未知错误'))
  } finally {
    setRegenerating(false)
  }
}
```

注意：`profile` 字段需从 store 解构（若未解构则补上）。

- [ ] **Step 6: 在 VolunteerCard 加锁定按钮**

定位 VolunteerCard 渲染（每个志愿项的按钮区），追加：
```tsx
<Button
  size="small"
  icon={item.locked ? <LockOutlined /> : <UnlockOutlined />}
  onClick={() => updateVolunteer(item.id, { locked: !item.locked })}
  type={item.locked ? 'primary' : 'default'}
>
  {item.locked ? '已锁定' : '锁定'}
</Button>
```

- [ ] **Step 7: 顶部按钮区加"锁定后重新推荐"按钮**

定位顶部按钮区，追加：
```tsx
<Button
  icon={<ReloadOutlined />}
  onClick={handleRegenerateExcludingLocked}
  disabled={!volunteerList.some(v => v.locked)}
  loading={regenerating}
>
  锁定后重新推荐
</Button>
```

- [ ] **Step 8: 运行 typecheck 和现有测试**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck 通过，所有测试 PASS

- [ ] **Step 9: Commit**

```bash
git add src/pages/VolunteerList.tsx
git commit -m "feat(FR-03): add lock UI and regenerate-excluding-locked in VolunteerList"
```

---

## FR-06 多方案保存对比

## Task 7: store 加 schemes 状态 + 4 个 action

**Files:**
- Modify: `src/store/index.ts`
- Modify: `src/store/index.test.ts`（若不存在则新建）

**Why:** 多方案保存需要持久化存储多套志愿方案，支持保存/重命名/删除/加载。

- [ ] **Step 1: 写测试 - schemes action 行为**

在 `src/store/index.test.ts` 末尾追加（若文件不存在，先 SearchCodebase 确认；若无测试文件则新建）：

```typescript
describe('schemes actions', () => {
  beforeEach(() => {
    useAppStore.setState({ schemes: [], volunteerList: [] })
  })

  it('saveScheme 新增方案并返回 id', () => {
    const id = useAppStore.getState().saveScheme('方案A', [])
    const schemes = useAppStore.getState().schemes
    expect(schemes).toHaveLength(1)
    expect(schemes[0].id).toBe(id)
    expect(schemes[0].name).toBe('方案A')
  })

  it('saveScheme 未传 items 时使用当前 volunteerList', () => {
    useAppStore.setState({ volunteerList: [/* mock item */] })
    const id = useAppStore.getState().saveScheme('方案B')
    const scheme = useAppStore.getState().schemes.find(s => s.id === id)
    expect(scheme?.items).toHaveLength(1)
  })

  it('saveScheme name 为空时自动命名"方案 N"', () => {
    useAppStore.getState().saveScheme('', [])
    useAppStore.getState().saveScheme('', [])
    const schemes = useAppStore.getState().schemes
    expect(schemes[0].name).toBe('方案 1')
    expect(schemes[1].name).toBe('方案 2')
  })

  it('renameScheme 修改方案名', () => {
    const id = useAppStore.getState().saveScheme('old', [])
    useAppStore.getState().renameScheme(id, 'new')
    expect(useAppStore.getState().schemes[0].name).toBe('new')
  })

  it('deleteScheme 删除方案', () => {
    const id = useAppStore.getState().saveScheme('A', [])
    useAppStore.getState().deleteScheme(id)
    expect(useAppStore.getState().schemes).toHaveLength(0)
  })

  it('loadScheme 将方案 items 加载到 volunteerList', () => {
    const mockItem = { id: 'v1', college: { id: 'c1', name: 'X' }, major: { id: 'm1', name: 'Y' }, tier: 'rush', probability: 0.5 } as any
    const id = useAppStore.getState().saveScheme('A', [mockItem])
    useAppStore.getState().loadScheme(id)
    expect(useAppStore.getState().volunteerList).toHaveLength(1)
    expect(useAppStore.getState().volunteerList[0].id).toBe('v1')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/store/index.test.ts`
Expected: 新测试 FAIL（schemes 未定义）

- [ ] **Step 3: 修改 store/index.ts，加 VolunteerScheme 类型和 schemes 状态**

在 `VolunteerItem` 接口之后追加：
```typescript
export interface VolunteerScheme {
  id: string
  name: string
  items: VolunteerItem[]
  createdAt: number
  updatedAt: number
}
```

在 `AppState` 接口追加：
```typescript
schemes: VolunteerScheme[]
saveScheme: (name: string, items?: VolunteerItem[]) => string
renameScheme: (id: string, name: string) => void
deleteScheme: (id: string) => void
loadScheme: (id: string) => void
```

- [ ] **Step 4: 实现 4 个 action**

在 store 初始 state 追加：
```typescript
schemes: [],
```

在 action 实现区域追加：
```typescript
saveScheme: (name, items) => {
  const id = `scheme-${Date.now()}`
  const now = Date.now()
  const scheme: VolunteerScheme = {
    id,
    name: name || `方案 ${useAppStore.getState().schemes.length + 1}`,
    items: items ?? useAppStore.getState().volunteerList,
    createdAt: now,
    updatedAt: now,
  }
  set((state) => ({ schemes: [...state.schemes, scheme] }))
  return id
},

renameScheme: (id, name) => set((state) => ({
  schemes: state.schemes.map(s => s.id === id ? { ...s, name, updatedAt: Date.now() } : s),
})),

deleteScheme: (id) => set((state) => ({
  schemes: state.schemes.filter(s => s.id !== id),
})),

loadScheme: (id) => {
  const scheme = useAppStore.getState().schemes.find(s => s.id === id)
  if (scheme) {
    set({ volunteerList: [...scheme.items] })
  }
},
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/store/index.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts src/store/index.test.ts
git commit -m "feat(FR-06): add schemes state with save/rename/delete/load actions"
```

---

## Task 8: SchemeCompare 对比页

**Files:**
- Create: `src/pages/SchemeCompare.tsx`
- Create: `src/pages/SchemeCompare.test.tsx`

**Why:** 提供并排对比和单套查看两种模式，让用户对比多套方案。

- [ ] **Step 1: 写测试 - 页面渲染与模式切换**

创建 `src/pages/SchemeCompare.test.tsx`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store'
import SchemeCompare from './SchemeCompare'

const mockItem = (id: string, collegeId: string, collegeName: string, majorName: string) => ({
  id,
  college: { id: collegeId, name: collegeName },
  major: { id: `m-${id}`, name: majorName },
  tier: 'rush',
  probability: 0.5,
} as any)

const renderPage = () => render(<MemoryRouter><SchemeCompare /></MemoryRouter>)

describe('SchemeCompare', () => {
  beforeEach(() => {
    useAppStore.setState({ schemes: [] })
  })

  it('无方案时显示 Empty', () => {
    renderPage()
    expect(screen.getByText(/暂无保存的方案/)).toBeInTheDocument()
  })

  it('默认显示并排对比模式', () => {
    useAppStore.setState({
      schemes: [{
        id: 's1', name: '方案A', items: [mockItem('v1', 'c1', '北大', '计算机')],
        createdAt: 0, updatedAt: 0,
      }],
    })
    renderPage()
    expect(screen.getByText('并排对比')).toBeInTheDocument()
  })

  it('切换到单套查看模式', () => {
    useAppStore.setState({
      schemes: [{
        id: 's1', name: '方案A', items: [mockItem('v1', 'c1', '北大', '计算机')],
        createdAt: 0, updatedAt: 0,
      }],
    })
    renderPage()
    fireEvent.click(screen.getByText('单套查看'))
    expect(screen.getByText('北大')).toBeInTheDocument()
  })

  it('并排对比选择 2 套方案后显示两列表格', () => {
    useAppStore.setState({
      schemes: [
        { id: 's1', name: 'A', items: [mockItem('v1', 'c1', '北大', '计算机')], createdAt: 0, updatedAt: 0 },
        { id: 's2', name: 'B', items: [mockItem('v2', 'c2', '清华', '软件')], createdAt: 0, updatedAt: 0 },
      ],
    })
    renderPage()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    expect(screen.getByText('北大')).toBeInTheDocument()
    expect(screen.getByText('清华')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/pages/SchemeCompare.test.tsx`
Expected: FAIL（页面不存在）

- [ ] **Step 3: 实现 SchemeCompare 页面**

创建 `src/pages/SchemeCompare.tsx`：

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Table, Select, Empty, Checkbox, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useAppStore, type VolunteerScheme } from '../store'

export default function SchemeCompare() {
  const navigate = useNavigate()
  const { schemes } = useAppStore()
  const [mode, setMode] = useState<'compare' | 'single'>('compare')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [singleId, setSingleId] = useState<string>(schemes[0]?.id ?? '')

  if (schemes.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Empty description="暂无保存的方案，请先在志愿表页保存方案" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} type="text" />
          <h1 className="text-xl md:text-2xl font-bold">方案对比</h1>
        </div>
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
          <Radio.Button value="compare">并排对比</Radio.Button>
          <Radio.Button value="single">单套查看</Radio.Button>
        </Radio.Group>
      </div>

      {mode === 'compare' ? (
        <CompareView schemes={schemes} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      ) : (
        <SingleView schemes={schemes} singleId={singleId} setSingleId={setSingleId} />
      )}
    </div>
  )
}

function CompareView({ schemes, selectedIds, setSelectedIds }: {
  schemes: VolunteerScheme[]
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
}) {
  const selectedSchemes = schemes.filter(s => selectedIds.includes(s.id))
  const maxRows = Math.max(...selectedSchemes.map(s => s.items.length), 0)

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-text-secondary mb-2">选择要对比的方案（至少 2 套）：</div>
        <Checkbox.Group
          options={schemes.map(s => ({ label: `${s.name}（${s.items.length} 个志愿）`, value: s.id }))}
          value={selectedIds}
          onChange={setSelectedIds}
        />
      </div>
      {selectedSchemes.length < 2 ? (
        <Empty description="请至少选择 2 套方案进行对比" />
      ) : (
        <Table
          dataSource={Array.from({ length: maxRows }, (_, i) => ({ key: i, index: i + 1 }))}
          scroll={{ x: 'max-content' }}
          pagination={false}
          size="small"
          columns={[
            { title: '志愿', dataIndex: 'index', key: 'index', fixed: 'left', width: 60 },
            ...selectedSchemes.map(s => ({
              title: s.name,
              key: s.id,
              render: (_: any, row: any) => {
                const item = s.items[row.index - 1]
                const isDiff = isDifferent(row.index - 1, selectedSchemes)
                return item ? (
                  <div className={isDiff ? 'bg-yellow-50 p-2 rounded' : 'p-2'}>
                    <div className="font-medium">{item.college.name}</div>
                    <div className="text-xs text-text-secondary">{item.major.name}</div>
                  </div>
                ) : <span className="text-text-secondary">-</span>
              }
            }))
          ]}
        />
      )}
    </div>
  )
}

function isDifferent(rowIndex: number, schemes: VolunteerScheme[]): boolean {
  const colleges = schemes.map(s => s.items[rowIndex]?.college.id).filter(Boolean)
  return new Set(colleges).size > 1
}

function SingleView({ schemes, singleId, setSingleId }: {
  schemes: VolunteerScheme[]
  singleId: string
  setSingleId: (id: string) => void
}) {
  const scheme = schemes.find(s => s.id === singleId)

  return (
    <div>
      <Select
        value={singleId}
        onChange={setSingleId}
        options={schemes.map(s => ({ value: s.id, label: `${s.name}（${s.items.length} 个志愿）` }))}
        className="w-64 mb-4"
      />
      {scheme && (
        <div className="space-y-3">
          {scheme.items.map((item, i) => (
            <div key={item.id} className="bg-bg-card rounded-xl p-4 shadow-md">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">#{i + 1}</span>
                <span className="font-semibold">{item.college.name}</span>
                <span className="text-text-secondary">·</span>
                <span>{item.major.name}</span>
                {item.locked && <span className="text-xs text-orange-500 ml-2">已锁定</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/pages/SchemeCompare.test.tsx`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/SchemeCompare.tsx src/pages/SchemeCompare.test.tsx
git commit -m "feat(FR-06): add SchemeCompare page with compare/single modes"
```

---

## Task 9: VolunteerList 保存方案按钮 + 路由注册

**Files:**
- Modify: `src/pages/VolunteerList.tsx`
- Modify: `src/router/index.tsx`

**Why:** 提供保存方案入口和方案对比页路由。

- [ ] **Step 1: 修改 router/index.tsx，加 /schemes 路由**

Read: `src/router/index.tsx`，定位路由配置数组。

在文件顶部追加 import：
```typescript
import SchemeCompare from '../pages/SchemeCompare'
```

在路由数组中追加：
```typescript
{ path: 'schemes', element: <SchemeCompare /> }
```

- [ ] **Step 2: 修改 VolunteerList.tsx，加保存方案按钮**

在文件顶部追加 import（若未存在）：
```typescript
import { SaveOutlined, SwapOutlined } from '@ant-design/icons'
import { Modal, Input } from 'antd'
import { useNavigate } from 'react-router-dom'
```

从 store 解构新字段：
```typescript
const { /* 现有 */ schemes, saveScheme } = useAppStore()
const navigate = useNavigate()
```

实现 handleSaveScheme（使用闭包局部变量避免 stale state 陷阱，不使用 useState）：
```typescript
const handleSaveScheme = () => {
  if (volunteerList.length === 0) {
    message.warning('志愿表为空，无法保存方案')
    return
  }
  let schemeName = ''
  Modal.confirm({
    title: '保存方案',
    content: <Input placeholder="方案名称（可选）" onChange={(e) => { schemeName = e.target.value }} />,
    onOk: () => {
      saveScheme(schemeName)
      message.success('方案已保存')
    },
  })
}
```

> **注意**：不使用 `useState` 存储 `schemeName`，因为 `Modal.confirm` 的 `onOk` 闭包会捕获初始 state 值（空字符串），导致保存的始终是空名。改用闭包局部变量在 onChange 时同步更新，onOk 时读取最新值。

顶部按钮区追加：
```tsx
<Button icon={<SaveOutlined />} onClick={handleSaveScheme}>保存方案</Button>
<Button
  icon={<SwapOutlined />}
  onClick={() => navigate('/schemes')}
  disabled={schemes.length === 0}
>
  方案对比 ({schemes.length})
</Button>
```

- [ ] **Step 3: 运行 typecheck 和全量测试**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck 通过，所有测试 PASS（含原有 368 + 新增测试）

- [ ] **Step 4: 运行 lint**

Run: `npx eslint src --ext .ts,.tsx`
Expected: 无错误（warning 可接受）

- [ ] **Step 5: Commit**

```bash
git add src/pages/VolunteerList.tsx src/router/index.tsx
git commit -m "feat(FR-06): add save-scheme button in VolunteerList and /schemes route"
```

---

## Final Verification

- [ ] **全量测试通过**

Run: `npx vitest run`
Expected: 所有测试 PASS，无回归

- [ ] **Typecheck 通过**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Lint 通过**

Run: `npx eslint src --ext .ts,.tsx`
Expected: 无错误

- [ ] **手动验证（可选）**

启动 dev server，验证：
1. 数据中心页有第 4 个 Tab"一分一段表"，可选择年份/科类，表格显示数据
2. 志愿表页每个志愿项有"锁定"按钮，锁定后顶部"锁定后重新推荐"按钮可点击
3. 点击"锁定后重新推荐"后，锁定项保留，未锁定项被新推荐替换
4. 志愿表页有"保存方案"按钮，点击后弹窗输入名称
5. 志愿表页有"方案对比"按钮，点击后跳转 /schemes 页
6. /schemes 页支持并排对比和单套查看两种模式

---

## Notes for Subagent Execution

- 每个 Task 独立可派发，按 Task 1 → 9 顺序执行
- Task 1-3 为 FR-08，Task 4-6 为 FR-03，Task 7-9 为 FR-06
- Task 之间无强依赖（除 Task 9 依赖 Task 7/8 的 store action 和页面），但建议顺序执行以避免合并冲突
- 每个 Task 完成后单独 commit，便于回滚
- 测试 fixture（profile/cache）需复用文件内已有构造，避免重复定义
- 若 `src/store/index.test.ts` 不存在，Task 7 需新建该文件并补全 import
- 若 `src/pages/VolunteerList.test.tsx` 不存在，不强制新建（页面测试以 typecheck + 手动验证为准）
