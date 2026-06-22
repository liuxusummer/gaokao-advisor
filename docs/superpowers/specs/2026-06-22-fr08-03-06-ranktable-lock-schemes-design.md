# FR-08/03/06 一分一段表查询 + 锁定后重新推荐 + 多方案对比设计

**日期**：2026-06-22
**关联 PRD**：`docs/requirements.md` FR-08（一分一段表查询）、FR-03（志愿锁定后重新推荐）、FR-06（多方案保存对比）
**状态**：已批准，待实现

## 1. 背景与目标

三个独立需求合并一个 spec，按依赖顺序实现：

1. **FR-08 一分一段表查询入口**：DataCenter.tsx 当前 3 Tab（院校/专业/分数线），缺"一分一段表查询"Tab。数据已采集在 `public/data/scores/{province}/rank_table_{year}.json`，`loadRankTable` 函数已存在，但无查询入口。
2. **FR-03 志愿锁定后重新推荐**：PRD 要求"支持用户手动锁定某些志愿后重新推荐其余志愿"。当前 `VolunteerItem` 无 `locked` 字段，`generateRecommendations` 无 `exclude` 机制。
3. **FR-06 多方案保存对比**：PRD 要求"多方案保存（保存多套志愿方案对比）"。当前 store 仅有单个 `volunteerList`，无方案概念。

**目标**：
- FR-08：DataCenter 加第 4 个 Tab，支持省份+年份+科类选择，全表浏览一分一段表
- FR-03：VolunteerItem 加 `locked` 字段，recommender 加 `exclude` 选项，VolunteerList 加锁定 UI + 重新推荐按钮
- FR-06：store 加 `schemes` 状态，VolunteerList 加保存方案按钮，新建 SchemeCompare 对比页

## 2. 范围

**包含**：
- FR-08：`RankTableSearch.tsx` 组件 + `probeRankTableYears` 辅助函数 + DataCenter Tab 集成
- FR-03：`VolunteerItem.locked` 字段 + `RecommendOptions.exclude` + VolunteerList 锁定 UI + 重新推荐逻辑
- FR-06：`VolunteerScheme` 类型 + store schemes 状态 + 4 个 action + `SchemeCompare.tsx` 对比页 + VolunteerList 保存方案按钮
- 所有新功能的单元测试和页面测试

**不包含**：
- 一分一段表数据采集（已完成）
- 推荐权重调整 UI（已完成）
- 方案导入（PRD 提及但不在本次范围）
- 撤销/重做（PRD 提及但不在本次范围）

## 3. 架构与文件结构

```
新增文件：
  src/pages/DataCenter/components/RankTableSearch.tsx        # FR-08 一分一段表查询组件
  src/pages/DataCenter/components/RankTableSearch.test.tsx
  src/pages/SchemeCompare.tsx                                # FR-06 方案对比页
  src/pages/SchemeCompare.test.tsx

修改文件：
  src/pages/DataCenter.tsx                                   # FR-08 加第 4 个 Tab
  src/services/dataLoader.ts                                 # FR-08 加 probeRankTableYears
  src/services/dataLoader.test.ts                            # FR-08 测试
  src/store/index.ts                                         # FR-03 加 locked + FR-06 加 schemes
  src/services/recommender.ts                                # FR-03 加 exclude 选项
  src/services/recommender.test.ts                           # FR-03 联动测试
  src/pages/VolunteerList.tsx                                # FR-03 锁定 UI + FR-06 保存方案按钮
  src/pages/VolunteerList.test.tsx                           # 测试（如不存在则新建）
  src/router/index.tsx                                       # FR-06 加 /schemes 路由
```

**数据流**：
```
FR-08: DataCenter Tab → RankTableSearch → probeRankTableYears + loadRankTable → 表格渲染
FR-03: VolunteerList 锁定按钮 → updateVolunteer(id, {locked}) → "重新推荐"按钮 
       → generateRecommendations(profile, cache, {exclude, weights, assessment}) 
       → 未锁定项被新推荐替换
FR-06: VolunteerList "保存方案" → saveScheme(name, volunteerList) → schemes[] 持久化 
       → "方案对比"按钮 → 跳转 /schemes → SchemeCompare 页（并排表格/切换查看）
```

## 4. FR-08 一分一段表查询

### 4.1 RankTableSearch 组件

```tsx
// src/pages/DataCenter/components/RankTableSearch.tsx
interface RankTableSearchProps {
  provinceId: string
  provinceName: string
}
```

**UI 结构**：
1. 顶部筛选栏：年份 Select（2023/2024/2025，仅显示有数据的年份）+ 科类 Select（综合/物理类/历史类，根据省份 subjectType 自动选默认）
2. 搜索框：Input.Search，按分数或位次过滤表格
3. 表格：Ant Design Table，列 = 分数 | 位次 | 同分人数 | 累计人数
4. 空状态：省份无数据时显示 Empty
5. 分页：默认 50 条/页，`scroll={{ y: 500 }}` 固定表头

### 4.2 probeRankTableYears 辅助函数

```typescript
// src/services/dataLoader.ts 新增
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

### 4.3 科类映射

根据 `profile.subjectType` 映射到一分一段表的 category：
- `physics` → `物理类`
- `history` → `历史类`
- `comprehensive` → `综合`

省份科类选项：3+3 省份（上海/北京/浙江）只有"综合"，3+1+2 省份有"物理类"/"历史类"。从探测到的数据 `categories` keys 动态填充 Select 选项。

### 4.4 DataCenter Tab 集成

```tsx
// src/pages/DataCenter.tsx Tab items 数组追加
{
  key: 'rankTable',
  label: '一分一段表',
  children: <RankTableSearch provinceId={profile.provinceId} provinceName={profile.provinceName} />
}
```

## 5. FR-03 志愿锁定后重新推荐

### 5.1 VolunteerItem 加 locked 字段

```typescript
// src/store/index.ts
export interface VolunteerItem {
  id: string
  college: College
  major: Major
  tier: 'rush' | 'stable' | 'safe'
  probability: number
  minRank?: number
  obeyAdjust?: boolean
  locked?: boolean  // 新增：是否锁定，默认 false
}
```

### 5.2 recommender 加 exclude 选项

```typescript
// src/services/recommender.ts
export interface RecommendOptions {
  weights?: RecommendWeights
  assessment?: AssessmentInput
  exclude?: Array<{ collegeId: string; majorId: string }>  // 新增
}
```

在 `generateRecommendations` 函数内，`for (const [, records] of recordMap)` 循环开始前构造 excludeSet：

```typescript
const excludeSet = options?.exclude
  ? new Set(options.exclude.map(e => `${e.collegeId}-${e.majorId}`))
  : null
```

在 for-of 循环内，`college` 和 `major` 确定后（`getOrCreateMajor` 调用之后），现有过滤条件之前追加：

```typescript
if (excludeSet && excludeSet.has(`${college.id}-${major.id}`)) continue
```

### 5.3 store 新增 setVolunteerList action

```typescript
// src/store/index.ts
interface AppState {
  // ... 现有字段
  setVolunteerList: (items: VolunteerItem[]) => void
}

// 实现
setVolunteerList: (items) => set({ volunteerList: items }),
```

### 5.4 VolunteerList UI 改造

每个 VolunteerCard 加锁定按钮：

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

顶部按钮区加"锁定后重新推荐"按钮：

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

### 5.5 handleRegenerateExcludingLocked 逻辑

VolunteerList 组件需新增 `regenerating` state（`const [regenerating, setRegenerating] = useState(false)`），并从 store 解构 `recommendWeights`、`integratedAssessment`、`subjectAssessmentResult`、`setVolunteerList`。

```typescript
const handleRegenerateExcludingLocked = async () => {
  setRegenerating(true)
  try {
    const lockedItems = volunteerList.filter(v => v.locked)
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
    
    // 用新推荐替换未锁定项，保留锁定项
    const lockedSet = new Set(lockedItems.map(v => v.id))
    const remainingLocked = volunteerList.filter(v => lockedSet.has(v.id))
    
    // 新推荐转换为 VolunteerItem
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
    
    // 合并：锁定项 + 新推荐
    setVolunteerList([...remainingLocked, ...newVolunteers])
    message.success(`已重新推荐，保留 ${remainingLocked.length} 个锁定志愿，新增 ${newVolunteers.length} 个推荐`)
  } catch (err) {
    message.error('重新推荐失败：' + (err instanceof Error ? err.message : '未知错误'))
  } finally {
    setRegenerating(false)
  }
}
```

## 6. FR-06 多方案保存对比

### 6.1 store 新增 schemes 状态

```typescript
// src/store/index.ts
export interface VolunteerScheme {
  id: string
  name: string
  items: VolunteerItem[]
  createdAt: number
  updatedAt: number
}

interface AppState {
  // ... 现有字段
  schemes: VolunteerScheme[]
  saveScheme: (name: string, items?: VolunteerItem[]) => string
  renameScheme: (id: string, name: string) => void
  deleteScheme: (id: string) => void
  loadScheme: (id: string) => void
}
```

### 6.2 store action 实现

```typescript
schemes: [],

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

### 6.3 VolunteerList UI 改造

VolunteerList 组件需新增 `nameInput` state（`const [nameInput, setNameInput] = useState('')`），并从 store 解构 `schemes`、`saveScheme`。

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

`handleSaveScheme`：

```typescript
const handleSaveScheme = () => {
  if (volunteerList.length === 0) {
    message.warning('志愿表为空，无法保存方案')
    return
  }
  Modal.confirm({
    title: '保存方案',
    content: <Input placeholder="方案名称（可选）" onChange={(e) => setNameInput(e.target.value)} />,
    onOk: () => {
      const id = saveScheme(nameInput)
      message.success('方案已保存')
    },
  })
}
```

### 6.4 SchemeCompare 页面

路由：`/schemes` → `<SchemeCompare />`

**两种模式**（Radio.Group 切换）：

**模式 A：并排对比**（默认）
- 顶部 Checkbox.Group 选择要对比的方案（2-4 套）
- 选中后渲染表格：每套方案一列，行 = 志愿顺序（1-N）
- 单元格显示"院校 专业"或空
- 差异高亮：同一行不同方案的院校不同时，背景色标记

**模式 B：单套查看**
- 顶部 Select 选择方案
- 显示该方案的完整志愿表（复用 VolunteerCard 渲染，只读模式）

```tsx
export default function SchemeCompare() {
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
        <h1 className="text-xl md:text-2xl font-bold">方案对比</h1>
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
```

### 6.5 CompareView 子组件

```tsx
function CompareView({ schemes, selectedIds, setSelectedIds }) {
  const selectedSchemes = schemes.filter(s => selectedIds.includes(s.id))
  const maxRows = Math.max(...selectedSchemes.map(s => s.items.length), 0)
  
  return (
    <div>
      <Checkbox.Group
        options={schemes.map(s => ({ label: s.name, value: s.id }))}
        value={selectedIds}
        onChange={setSelectedIds}
        className="mb-4"
      />
      {selectedSchemes.length < 2 ? (
        <Empty description="请至少选择 2 套方案进行对比" />
      ) : (
        <Table
          dataSource={Array.from({ length: maxRows }, (_, i) => ({ key: i, index: i + 1 }))}
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: '志愿', dataIndex: 'index', key: 'index', fixed: 'left', width: 60 },
            ...selectedSchemes.map(s => ({
              title: s.name,
              key: s.id,
              render: (_, row) => {
                const item = s.items[row.index - 1]
                return item ? (
                  <div className={isDifferent(row.index - 1, selectedSchemes) ? 'bg-yellow-50' : ''}>
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

// 差异检测：同一行不同方案的院校是否不同
function isDifferent(rowIndex: number, schemes: VolunteerScheme[]): boolean {
  const colleges = schemes.map(s => s.items[rowIndex]?.college.id).filter(Boolean)
  return new Set(colleges).size > 1
}
```

### 6.6 SingleView 子组件

```tsx
function SingleView({ schemes, singleId, setSingleId }) {
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 6.7 路由注册

```tsx
// src/router/index.tsx
{ path: 'schemes', element: <SchemeCompare /> }
```

## 7. 测试策略

### 7.1 FR-08 测试

**RankTableSearch.test.tsx**（新建）：
1. 渲染时显示年份/科类选择器
2. `probeRankTableYears` 返回可用年份后，年份 Select 选项更新
3. 选择年份+科类后加载一分一段表数据，表格显示分数/位次/同分人数/累计人数列
4. 搜索框输入分数后表格过滤
5. 无数据省份显示 Empty

**dataLoader.test.ts**（扩展）：
6. `probeRankTableYears` 返回可用年份数组（mock fetch）
7. 无数据省份返回空数组
8. 内存缓存：第二次调用不重复 fetch

### 7.2 FR-03 测试

**recommender.test.ts**（扩展）：
1. 传入 exclude 参数后，被排除的 college+major 不出现在结果中
2. 未传 exclude 时行为不变（兼容性）

**VolunteerList.test.tsx**（新建或扩展）：
3. 锁定按钮点击后调用 `updateVolunteer(id, {locked: true})`
4. "锁定后重新推荐"按钮在无锁定项时 disabled
5. 点击重新推荐后调用 `generateRecommendations` 并传入 exclude
6. 重新推荐后锁定项保留，未锁定项被替换

### 7.3 FR-06 测试

**store.test.ts**（扩展）：
1. `saveScheme` 新增方案到 schemes 数组，返回 id
2. `saveScheme` 未传 items 时使用当前 volunteerList
3. `saveScheme` name 为空时自动命名"方案 N"
4. `renameScheme` 修改方案名
5. `deleteScheme` 删除方案
6. `loadScheme` 将方案 items 加载到 volunteerList

**SchemeCompare.test.tsx**（新建）：
7. 无方案时显示 Empty
8. 默认显示并排对比模式
9. 切换到单套查看模式显示 Select + 单套志愿表
10. 并排对比模式选择 2 套方案后显示两列表格
11. 差异高亮：同一行不同院校时背景色标记

### 7.4 现有测试回归

运行全量测试确保 368 个现有测试全部通过，无回归。

## 8. 兼容性与迁移

- `VolunteerItem.locked` 为可选字段，旧版本持久化数据加载时无此字段，默认 `undefined`（falsy，等同未锁定）
- `RecommendOptions.exclude` 为可选参数，未传入时行为不变
- `schemes` 状态有默认空数组 `[]`，旧版本持久化数据加载时无此字段会使用初始值
- `setVolunteerList` 为新 action，不影响现有 `addVolunteer`/`removeVolunteer`/`moveVolunteer`/`updateVolunteer`/`clearVolunteerList`

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 一分一段表数据量大（500-1000 行）影响渲染 | 使用 Ant Design Table 分页（50 条/页）+ 固定表头 |
| `probeRankTableYears` 每次调用都 fetch 3 个 URL | 内存缓存 `Map<province, years[]>`，第二次调用直接返回 |
| 重新推荐后锁定项与新推荐顺序混乱 | 锁定项保留在前，新推荐追加在后，用户可手动 `moveVolunteer` 调整 |
| 方案对比表格列数过多（4 套方案）横向溢出 | `scroll={{ x: 'max-content' }}` 横向滚动，第一列 `fixed: 'left'` |
| localStorage 容量限制（多方案持久化） | 方案数量无硬限制，但 UI 提示"方案较多时建议删除旧方案" |
| `loadScheme` 覆盖当前 volunteerList 导致丢失 | 调用前 `Modal.confirm` 确认"加载方案将覆盖当前志愿表，是否继续？" |
