# 测评结果与推荐联动设计

**日期**：2026-06-21
**关联 PRD**：`docs/requirements.md` 9.5（多维度加权排序）、11.3（测评结果应用于推荐排序）
**状态**：已批准，待实现

## 1. 背景与目标

PRD 9.5 要求推荐排序按 6 维度加权打分：录取概率 30% + 院校层次 25% + 专业兴趣 20% + 地域 15% + 学费 5% + 就业 5%。
PRD 11.3 要求测评结果（霍兰德 + 学科兴趣 + MBTI）应用于推荐排序的"专业兴趣"维度。

当前 `src/services/recommender.ts:163-172` 使用四级 tiebreaker 排序（梯度→概率→院校层次→MBTI），仅读取 `profile.mbtiType`，未读取 `assessmentResult`（霍兰德分数）和 `subjectAssessmentResult`（学科兴趣），且权重不可调。

**目标**：
1. 新建 `src/services/rankScorer.ts` 加权打分纯函数服务
2. `recommender.ts` 排序逻辑改用 `rankScorer`，整合三源测评结果
3. `store/index.ts` 新增 `recommendWeights` 状态 + 调整 action
4. `Recommend.tsx` 顶部加可折叠"高级设置"区域，6 个 Slider 调权重

## 2. 范围

**包含**：
- `rankScorer.ts` 加权打分服务（含 6 维度得分计算 + 三源等权融合 + deriveHollandCategories 辅助函数）
- `rankScorer.test.ts` 单元测试
- `recommender.ts` 排序逻辑改造（保留梯度分桶，桶内按总分排序）
- `store/index.ts` 新增 `recommendWeights` 状态
- `Recommend.tsx` 新增 Collapse + Slider 高级设置区域
- `resultIntegrator.ts` 导出 `HOLLAND_TO_SUBJECTS` 常量（仅添加 export 关键字，不改逻辑）
- 就业前景得分硬编码映射（按 12 个专业大类）
- `recommender.test.ts` 联动测试（如不存在则新建）

**不包含**：
- 测评结果整合逻辑改动（`resultIntegrator.ts` 的 `integrateResults` 函数保持现状）
- 推荐筛选条件改动（学费/地域/选科等硬过滤保持现状）
- 概率计算逻辑改动（保持现有 deviation 公式）
- FR-03 锁定后重新推荐（独立 spec）
- FR-06 多方案保存对比（独立 spec）

## 3. 架构与文件结构

```
新增文件：
  src/services/rankScorer.ts              # 加权打分纯函数服务 + deriveHollandCategories
  src/services/rankScorer.test.ts         # 单元测试

修改文件：
  src/store/index.ts                      # 新增 recommendWeights 状态 + action
  src/services/recommender.ts             # 排序逻辑改用 rankScorer
  src/pages/Recommend.tsx                 # 顶部加 Collapse + Slider 高级设置
  src/features/assessment/services/resultIntegrator.ts  # 导出 HOLLAND_TO_SUBJECTS 常量
  src/services/recommender.test.ts        # 联动测试（如不存在则新建）
```

数据流：
```
UserProfile + AssessmentResult + SubjectAssessmentResult + MbtiMapping
    ↓
recommender.generateRecommendations(profile, cache, options?)
    ↓ 整合三源测评 → AssessmentInput
    ↓ 过滤候选 → 计算 probability/tier
    ↓ 调用 rankScorer.scoreCandidate(candidate, weights, assessment, profile)
    ↓ 桶内按总分降序排序
    ↓ 按梯度配额截断
RecommendationItem[]
```

## 4. rankScorer.ts 服务设计

### 4.1 类型定义

```typescript
export interface RecommendWeights {
  probability: number    // 录取概率权重（默认 30）
  collegeLevel: number   // 院校层次权重（默认 25）
  majorInterest: number  // 专业兴趣权重（默认 20）
  region: number         // 地域权重（默认 15）
  tuition: number        // 学费权重（默认 5）
  employment: number     // 就业权重（默认 5）
}

export const DEFAULT_WEIGHTS: RecommendWeights = {
  probability: 30,
  collegeLevel: 25,
  majorInterest: 20,
  region: 15,
  tuition: 5,
  employment: 5,
}

export interface AssessmentInput {
  hollandCategories: string[]   // 霍兰德推荐的专业大类（从 hollandCode 映射）
  subjectCategories: string[]   // 学科兴趣推荐的专业大类（subjectAssessmentResult.recommendedCategories）
  mbtiCategories: string[]      // MBTI 推荐的专业大类（mbtiMapping[mbtiType].categories）
}

export interface CandidateInput {
  probability: number       // 0-100
  collegeLevel: number      // 0-3（985=3, 211=2, 双一流=1, 其他=0）
  majorCategory: string     // 专业大类
  collegeProvince: string   // 院校所在省（已归一化短名，如"浙江"）
  tuition: number           // 学费（元/年）
  employmentScore: number   // 0-100 就业前景得分（由 EMPLOYMENT_SCORE_MAP 查得）
}

export interface ProfileInput {
  regions: string[]         // 用户偏好地域（短名）
  maxTuition: number | null // 用户可接受最高学费
}
```

### 4.2 核心函数

```typescript
/**
 * 计算单个候选的加权总分（0-100）
 * 各维度得分归一化到 0-100，再按权重加权平均
 */
export function scoreCandidate(
  candidate: CandidateInput,
  weights: RecommendWeights,
  assessment: AssessmentInput,
  profile: ProfileInput
): number
```

### 4.3 各维度得分计算

| 维度 | 得分公式 | 说明 |
|------|---------|------|
| probability | `candidate.probability` | 直接用 0-100 概率值 |
| collegeLevel | `candidate.collegeLevel / 3 * 100` | 985=100, 211=66.7, 双一流=33.3, 其他=0 |
| majorInterest | `(hollandMatch + subjectMatch + mbtiMatch) / 3 * 100` | 三源等权融合，每源匹配=1，不匹配=0 |
| region | `profile.regions.length === 0 ? 50 : (profile.regions.includes(candidate.collegeProvince) ? 100 : 0)` | 用户未设地域偏好（regions=[]）时得 50（中性）；设了偏好时匹配=100，不匹配=0 |
| tuition | `100 * (1 - candidate.tuition / profile.maxTuition)` | 线性归一化：tuition=0 得 100，tuition=maxTuition 得 0；用户未设 maxTuition 时所有候选都得 50（中性）；超 maxTuition 已被过滤，不会进入打分 |
| employment | `candidate.employmentScore` | 直接查 EMPLOYMENT_SCORE_MAP |

**特殊情况处理**：
- `profile.regions.length === 0`：region 得分 = 50（中性，不奖不罚）
- `profile.maxTuition === null`：tuition 得分 = 50（中性）
- `assessment` 三源均为空（用户未做任何测评）：majorInterest 得分 = 50（中性）

**权重归一化**：如果用户调整后 6 个权重之和不为 100，按比例归一化（如全设 0 则回退到 DEFAULT_WEIGHTS）。

### 4.4 就业前景得分映射

基于 12 个专业大类（`majorCategories`），硬编码 0-100 得分：

```typescript
export const EMPLOYMENT_SCORE_MAP: Record<string, number> = {
  '哲学': 40,
  '经济学': 75,
  '法学': 70,
  '教育学': 65,
  '文学': 55,
  '历史学': 40,
  '理学': 60,
  '工学': 85,
  '农学': 50,
  '医学': 80,
  '管理学': 75,
  '艺术学': 50,
}
```

得分依据：参考 2024-2026 年公开就业报告（麦可思、智联招聘）的就业率、薪资、需求量综合估算。未在表中的类别默认 50。

## 5. store 改造

### 5.1 新增状态

```typescript
interface AppState {
  // ... 现有字段
  recommendWeights: RecommendWeights
  setRecommendWeights: (w: Partial<RecommendWeights>) => void
  resetRecommendWeights: () => void
}
```

### 5.2 初始值与 action

```typescript
// 初始值
recommendWeights: DEFAULT_WEIGHTS,

// action
setRecommendWeights: (w) => set((state) => ({
  recommendWeights: { ...state.recommendWeights, ...w }
})),
resetRecommendWeights: () => set({ recommendWeights: DEFAULT_WEIGHTS }),
```

### 5.3 持久化

`recommendWeights` 加入 `partialize` 持久化范围（已默认持久化所有非 dataCache 字段，无需特殊处理）。

## 6. recommender.ts 改造

### 6.1 函数签名扩展

```typescript
export interface RecommendOptions {
  weights?: RecommendWeights
  assessment?: AssessmentInput
}

export async function generateRecommendations(
  profile: UserProfile,
  cache?: RealDataCache,
  options?: RecommendOptions
): Promise<RecommendationItem[]>
```

### 6.2 AssessmentInput 构造

`generateRecommendations` 是纯函数，不直接读 store。`AssessmentInput` 由调用方（`Recommend.tsx`）构造并传入。若 `options.assessment` 未传入，使用空对象 `{ hollandCategories: [], subjectCategories: [], mbtiCategories: [] }`（majorInterest 维度得 50 中性分）。

```typescript
// 调用方（Recommend.tsx）构造 assessment
const majorMapping = await loadMajorMapping()
const assessment: AssessmentInput = {
  hollandCategories: deriveHollandCategories(integratedAssessment?.hollandCode, majorMapping),
  subjectCategories: subjectAssessmentResult?.recommendedCategories ?? [],
  mbtiCategories: integratedAssessment?.mbtiCategories ?? [],
}
```

### 6.2.1 deriveHollandCategories 辅助函数

在 `rankScorer.ts` 中导出（避免新建文件）：

```typescript
import { HOLLAND_TO_SUBJECTS } from '../features/assessment/services/resultIntegrator'
import type { SubjectMajorMapping } from '../features/assessment/types'

/**
 * 从霍兰德代码（如 "RIA"）反推推荐的专业大类集合
 * 复用 resultIntegrator.ts 的 HOLLAND_TO_SUBJECTS 映射 + subjectMapper 的 subject→major 映射
 */
export function deriveHollandCategories(
  hollandCode?: string,
  majorMapping: SubjectMajorMapping = {}
): string[] {
  if (!hollandCode) return []
  const categories = new Set<string>()
  for (const dim of hollandCode) {
    const subjects = HOLLAND_TO_SUBJECTS[dim]
    if (subjects) {
      for (const s of subjects) {
        const majors = majorMapping[s]
        if (majors) majors.forEach((m) => categories.add(m))
      }
    }
  }
  return Array.from(categories)
}
```

**前置依赖**：
- `resultIntegrator.ts` 需导出 `HOLLAND_TO_SUBJECTS` 常量（当前为模块内部 const，需添加 `export` 关键字）
- `majorMatcher.ts` 已导出 `loadMajorMapping()`（异步），调用方先 await 加载再传入

### 6.3 排序逻辑替换

替换 `recommender.ts:163-172` 的四级 tiebreaker：

```typescript
// 旧：四级 tiebreaker
candidates.sort((a, b) => { ... })

// 新：桶内按 rankScorer 总分排序
const weights = options?.weights ?? DEFAULT_WEIGHTS
const assessmentInput = options?.assessment ?? { hollandCategories: [], subjectCategories: [], mbtiCategories: [] }

candidates.forEach((c) => {
  const score = scoreCandidate(
    {
      probability: c.probability,
      collegeLevel: levelWeight(c.college),
      majorCategory: c.major.category,
      collegeProvince: normalizeProvince(c.college.province),
      tuition: c.major.tuition ?? 0,
      employmentScore: EMPLOYMENT_SCORE_MAP[c.major.category] ?? 50,
    },
    weights,
    assessmentInput,
    { regions: profile.regions, maxTuition: profile.maxTuition }
  )
  ;(c as RecommendationItem & { _score: number })._score = score
})

candidates.sort((a, b) => (b as any)._score - (a as any)._score)
```

**保留梯度分桶**：rush/stable/safe 三桶配额截断逻辑（`recommender.ts:174-202`）不变，仅桶内排序方式改变。

**`_score` 字段处理**：内部排序用，不暴露到 `RecommendationItem` 类型；如需展示可在 UI 层单独计算。

### 6.4 levelWeight 函数复用

`levelWeight(college)` 保持现状（985=3, 211=2, 双一流=1, 其他=0），作为 `CandidateInput.collegeLevel` 传入。

## 7. Recommend.tsx UI 改造

### 7.1 高级设置区域

在页面顶部（标题区下方、Tier Tabs 上方）插入可折叠的"高级设置"区域：

```tsx
import { Collapse, Slider } from 'antd'
import { loadMajorMapping } from '../features/assessment/services/majorMatcher'
import { deriveHollandCategories, type AssessmentInput } from '../services/rankScorer'

const { Panel } = Collapse

// 在组件中：
const { recommendWeights, setRecommendWeights, resetRecommendWeights } = useAppStore()

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
```

### 7.2 WeightSlider 子组件

```tsx
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
```

### 7.3 handleRegenerate 改造

```typescript
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
```

### 7.4 store 取值扩展

```typescript
const {
  profile, recommendations, setRecommendations, addVolunteer, volunteerList,
  loadProvinceData,
  recommendWeights, setRecommendWeights, resetRecommendWeights,
  integratedAssessment, subjectAssessmentResult,
} = useAppStore()
```

## 8. 测试策略

### 8.1 rankScorer.test.ts（单元测试，新建）

覆盖场景：
1. 默认权重下，所有维度最大值的候选得分 = 100
2. 默认权重下，所有维度最小值的候选得分 = 0
3. 三源测评全匹配时 majorInterest 得分 = 100
4. 三源测评全不匹配时 majorInterest 得分 = 0
5. 三源测评部分匹配时 majorInterest 得分 = 33.3 或 66.7
6. 用户未设地域偏好（regions=[]）时 region 得分 = 50
7. 用户未设 maxTuition 时 tuition 得分 = 50
8. assessment 三源均为空时 majorInterest 得分 = 50
9. 权重全设 0 时回退到 DEFAULT_WEIGHTS
10. 权重之和不等于 100 时按比例归一化
11. 985 院校 collegeLevel 得分 = 100，双一流 = 33.3，其他 = 0
12. EMPLOYMENT_SCORE_MAP 查询已知/未知类别

### 8.2 recommender.test.ts（联动测试，新建或扩展）

覆盖场景：
1. 传入 assessment 参数后，匹配专业兴趣的候选排序靠前
2. 传入 weights 参数后，按自定义权重排序
3. 未传入 options 时，使用 DEFAULT_WEIGHTS 和空 assessment，行为与改造前一致（兼容性）
4. 三桶配额截断逻辑保持不变

### 8.3 Recommend.test.tsx（页面测试，扩展）

覆盖场景：
1. 高级设置区域默认折叠
2. 点击展开后显示 6 个 Slider
3. 拖动 Slider 调用 setRecommendWeights
4. 点击"恢复默认"调用 resetRecommendWeights
5. 重新生成时传入当前 weights 和 assessment

### 8.4 现有测试回归

运行全量测试确保 338 个现有测试全部通过，无回归。

## 9. 兼容性与迁移

- `generateRecommendations` 的 `options` 参数为可选，未传入时使用 DEFAULT_WEIGHTS 和空 assessment，行为与改造前一致
- `recommendWeights` 状态有默认值 DEFAULT_WEIGHTS，旧版本持久化数据加载时无此字段会使用初始值
- `RecommendationItem` 类型不变，`_score` 为内部排序字段不暴露

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 就业前景得分硬编码可能过时 | 在代码注释中标注数据来源日期，后续可改为从外部 JSON 加载 |
| 用户调极端权重（如全设 0） | 回退到 DEFAULT_WEIGHTS |
| 三源测评数据缺失 | majorInterest 得分 = 50（中性），不影响其他维度排序 |
| `_score` 字段污染类型 | 使用 `(c as any)._score` 内部赋值，不修改 RecommendationItem 类型定义 |
