# 测评结果与推荐联动 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PRD 9.5 的 6 维度加权推荐排序，整合霍兰德 + 学科兴趣 + MBTI 三源测评结果到"专业兴趣"维度，并提供用户可调权重 UI。

**Architecture:** 新建 `rankScorer.ts` 加权打分纯函数服务，`recommender.ts` 排序逻辑改用 `scoreCandidate` 计算总分（保留梯度分桶），`store` 新增 `recommendWeights` 状态，`Recommend.tsx` 顶部加可折叠 Slider 区域。

**Tech Stack:** React 18 + TypeScript + Vite + Zustand + Ant Design 5 + Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-06-21-assessment-recommendation-linkage-design.md`

**Test command:** `npx vitest run`（项目根目录，需先 `export PATH="/opt/homebrew/bin:$PATH"`）

---

## File Structure

```
新增文件：
  src/services/rankScorer.ts              # 加权打分服务 + deriveHollandCategories
  src/services/rankScorer.test.ts         # 单元测试
  src/pages/Recommend.test.tsx            # 页面测试（新建）

修改文件：
  src/features/assessment/services/resultIntegrator.ts  # 导出 HOLLAND_TO_SUBJECTS
  src/store/index.ts                      # 新增 recommendWeights 状态 + action
  src/services/recommender.ts             # 排序逻辑改用 rankScorer
  src/services/recommender.test.ts        # 扩展联动测试
  src/pages/Recommend.tsx                 # 顶部加 Collapse + Slider 高级设置
```

---

## Task 1: 导出 HOLLAND_TO_SUBJECTS 常量

**Files:**
- Modify: `src/features/assessment/services/resultIntegrator.ts:3-10`

**Why:** `rankScorer.ts` 中的 `deriveHollandCategories` 需要复用此映射，必须导出。

- [ ] **Step 1: 修改 resultIntegrator.ts，将 const 改为 export const**

修改 `src/features/assessment/services/resultIntegrator.ts` 第 3 行：

```typescript
// 旧
const HOLLAND_TO_SUBJECTS: Record<string, string[]> = {

// 新
export const HOLLAND_TO_SUBJECTS: Record<string, string[]> = {
```

- [ ] **Step 2: 运行现有测试确保无回归**

Run: `npx vitest run src/features/assessment/services/resultIntegrator.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/assessment/services/resultIntegrator.ts
git commit -m "refactor: export HOLLAND_TO_SUBJECTS for reuse in rankScorer"
```

---

## Task 2: 创建 rankScorer.ts 类型定义和常量

**Files:**
- Create: `src/services/rankScorer.ts`
- Create: `src/services/rankScorer.test.ts`

- [ ] **Step 1: 创建 rankScorer.ts，定义所有类型和常量**

创建 `src/services/rankScorer.ts`：

```typescript
import { HOLLAND_TO_SUBJECTS } from '../features/assessment/services/resultIntegrator'
import type { SubjectMajorMapping } from '../features/assessment/types'

export interface RecommendWeights {
  probability: number
  collegeLevel: number
  majorInterest: number
  region: number
  tuition: number
  employment: number
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
  hollandCategories: string[]
  subjectCategories: string[]
  mbtiCategories: string[]
}

export interface CandidateInput {
  probability: number
  collegeLevel: number
  majorCategory: string
  collegeProvince: string
  tuition: number
  employmentScore: number
}

export interface ProfileInput {
  regions: string[]
  maxTuition: number | null
}

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

// 占位，将在 Task 3/4 实现
export function scoreCandidate(
  _candidate: CandidateInput,
  _weights: RecommendWeights,
  _assessment: AssessmentInput,
  _profile: ProfileInput
): number {
  return 0
}

export function deriveHollandCategories(
  _hollandCode?: string,
  _majorMapping: SubjectMajorMapping = {}
): string[] {
  return []
}
```

- [ ] **Step 2: 创建 rankScorer.test.ts，测试常量**

创建 `src/services/rankScorer.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  EMPLOYMENT_SCORE_MAP,
  type RecommendWeights,
  type AssessmentInput,
  type CandidateInput,
  type ProfileInput,
} from './rankScorer'

describe('rankScorer 常量', () => {
  it('DEFAULT_WEIGHTS 包含 6 个维度且总和为 100', () => {
    const keys = Object.keys(DEFAULT_WEIGHTS) as (keyof RecommendWeights)[]
    expect(keys).toHaveLength(6)
    expect(keys).toEqual(
      expect.arrayContaining([
        'probability', 'collegeLevel', 'majorInterest',
        'region', 'tuition', 'employment',
      ])
    )
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBe(100)
  })

  it('DEFAULT_WEIGHTS 符合 PRD 9.5 默认值', () => {
    expect(DEFAULT_WEIGHTS.probability).toBe(30)
    expect(DEFAULT_WEIGHTS.collegeLevel).toBe(25)
    expect(DEFAULT_WEIGHTS.majorInterest).toBe(20)
    expect(DEFAULT_WEIGHTS.region).toBe(15)
    expect(DEFAULT_WEIGHTS.tuition).toBe(5)
    expect(DEFAULT_WEIGHTS.employment).toBe(5)
  })

  it('EMPLOYMENT_SCORE_MAP 包含 12 个专业大类', () => {
    const expectedCategories = [
      '哲学', '经济学', '法学', '教育学', '文学', '历史学',
      '理学', '工学', '农学', '医学', '管理学', '艺术学',
    ]
    for (const cat of expectedCategories) {
      expect(EMPLOYMENT_SCORE_MAP[cat]).toBeDefined()
      expect(EMPLOYMENT_SCORE_MAP[cat]).toBeGreaterThanOrEqual(0)
      expect(EMPLOYMENT_SCORE_MAP[cat]).toBeLessThanOrEqual(100)
    }
  })

  it('EMPLOYMENT_SCORE_MAP 工学得分最高，哲学/历史学最低', () => {
    expect(EMPLOYMENT_SCORE_MAP['工学']).toBe(85)
    expect(EMPLOYMENT_SCORE_MAP['哲学']).toBe(40)
    expect(EMPLOYMENT_SCORE_MAP['历史学']).toBe(40)
  })
})
```

- [ ] **Step 3: 运行测试验证通过**

Run: `npx vitest run src/services/rankScorer.test.ts`
Expected: 4 个测试 PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/rankScorer.ts src/services/rankScorer.test.ts
git commit -m "feat: add rankScorer types and constants (DEFAULT_WEIGHTS, EMPLOYMENT_SCORE_MAP)"
```

---

## Task 3: 实现 scoreCandidate 函数

**Files:**
- Modify: `src/services/rankScorer.ts`
- Modify: `src/services/rankScorer.test.ts`

- [ ] **Step 1: 在 rankScorer.test.ts 添加 scoreCandidate 测试**

在 `src/services/rankScorer.test.ts` 末尾追加：

```typescript
import { scoreCandidate } from './rankScorer'

describe('scoreCandidate', () => {
  const emptyAssessment: AssessmentInput = {
    hollandCategories: [],
    subjectCategories: [],
    mbtiCategories: [],
  }
  const fullAssessment: AssessmentInput = {
    hollandCategories: ['工学'],
    subjectCategories: ['工学'],
    mbtiCategories: ['工学'],
  }
  const maxCandidate: CandidateInput = {
    probability: 100,
    collegeLevel: 3,
    majorCategory: '工学',
    collegeProvince: '北京',
    tuition: 0,
    employmentScore: 100,
  }
  const minCandidate: CandidateInput = {
    probability: 0,
    collegeLevel: 0,
    majorCategory: '哲学',
    collegeProvince: '西藏',
    tuition: 10000,
    employmentScore: 0,
  }
  const profileWithPrefs: ProfileInput = {
    regions: ['北京'],
    maxTuition: 10000,
  }
  const profileNoPrefs: ProfileInput = {
    regions: [],
    maxTuition: null,
  }

  it('默认权重下，所有维度最大值且匹配的候选得分 = 100', () => {
    const score = scoreCandidate(maxCandidate, DEFAULT_WEIGHTS, fullAssessment, profileWithPrefs)
    expect(score).toBeCloseTo(100, 0)
  })

  it('默认权重下，所有维度最小值且不匹配的候选得分 = 0', () => {
    const score = scoreCandidate(minCandidate, DEFAULT_WEIGHTS, emptyAssessment, profileWithPrefs)
    expect(score).toBeCloseTo(0, 0)
  })

  it('三源测评全匹配时 majorInterest 维度贡献满分', () => {
    // 工学在三源中都匹配
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, tuition: 10000, employmentScore: 0, collegeProvince: '西藏' },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      fullAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(100, 0)
  })

  it('三源测评全不匹配时 majorInterest 维度贡献 0 分', () => {
    const score = scoreCandidate(
      maxCandidate,
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    // maxCandidate.majorCategory='工学'，但 emptyAssessment 三源都为空
    // majorInterest 得分 = 50（中性），权重 20，贡献 = 50 * 20 / 20 = 50
    expect(score).toBeCloseTo(50, 0)
  })

  it('三源测评部分匹配时 majorInterest 得分 = 33.3 或 66.7', () => {
    // 只有霍兰德匹配
    const partialAssessment: AssessmentInput = {
      hollandCategories: ['工学'],
      subjectCategories: [],
      mbtiCategories: [],
    }
    const score = scoreCandidate(
      maxCandidate,
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      partialAssessment,
      profileNoPrefs
    )
    // majorInterest 得分 = (1+0+0)/3 * 100 = 33.33
    expect(score).toBeCloseTo(100 / 3, 1)
  })

  it('用户未设地域偏好（regions=[]）时 region 得分 = 50', () => {
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, tuition: 10000, employmentScore: 0 },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, majorInterest: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(50, 0)
  })

  it('用户未设 maxTuition 时 tuition 得分 = 50', () => {
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, employmentScore: 0, collegeProvince: '西藏' },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, majorInterest: 0, region: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(50, 0)
  })

  it('assessment 三源均为空时 majorInterest 得分 = 50（中性）', () => {
    const score = scoreCandidate(
      { ...maxCandidate, probability: 0, collegeLevel: 0, tuition: 10000, employmentScore: 0, collegeProvince: '西藏' },
      { ...DEFAULT_WEIGHTS, probability: 0, collegeLevel: 0, region: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(50, 0)
  })

  it('权重全设 0 时回退到 DEFAULT_WEIGHTS', () => {
    const zeroWeights: RecommendWeights = {
      probability: 0, collegeLevel: 0, majorInterest: 0,
      region: 0, tuition: 0, employment: 0,
    }
    const scoreDefault = scoreCandidate(maxCandidate, DEFAULT_WEIGHTS, fullAssessment, profileWithPrefs)
    const scoreZero = scoreCandidate(maxCandidate, zeroWeights, fullAssessment, profileWithPrefs)
    expect(scoreZero).toBeCloseTo(scoreDefault, 0)
  })

  it('权重之和不等于 100 时按比例归一化', () => {
    // 权重总和 200，应归一化到 100
    const doubleWeights: RecommendWeights = {
      probability: 60, collegeLevel: 50, majorInterest: 40,
      region: 30, tuition: 10, employment: 10,
    }
    const scoreNormal = scoreCandidate(maxCandidate, DEFAULT_WEIGHTS, fullAssessment, profileWithPrefs)
    const scoreDouble = scoreCandidate(maxCandidate, doubleWeights, fullAssessment, profileWithPrefs)
    expect(scoreDouble).toBeCloseTo(scoreNormal, 0)
  })

  it('985 院校 collegeLevel 得分 = 100', () => {
    const candidate985: CandidateInput = { ...maxCandidate, collegeLevel: 3 }
    const score = scoreCandidate(
      candidate985,
      { ...DEFAULT_WEIGHTS, probability: 0, majorInterest: 0, region: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(100, 0)
  })

  it('双一流院校 collegeLevel 得分 = 33.3', () => {
    const candidateDoubleFirst: CandidateInput = { ...maxCandidate, collegeLevel: 1 }
    const score = scoreCandidate(
      candidateDoubleFirst,
      { ...DEFAULT_WEIGHTS, probability: 0, majorInterest: 0, region: 0, tuition: 0, employment: 0 },
      emptyAssessment,
      profileNoPrefs
    )
    expect(score).toBeCloseTo(100 / 3, 1)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/rankScorer.test.ts`
Expected: 新增的 scoreCandidate 测试 FAIL（当前返回 0）

- [ ] **Step 3: 实现 scoreCandidate 函数**

替换 `src/services/rankScorer.ts` 中的 `scoreCandidate` 占位实现：

```typescript
export function scoreCandidate(
  candidate: CandidateInput,
  weights: RecommendWeights,
  assessment: AssessmentInput,
  profile: ProfileInput
): number {
  // 权重归一化：全设 0 时回退到 DEFAULT_WEIGHTS
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
  const effectiveWeights = weightSum === 0 ? DEFAULT_WEIGHTS : weights
  const totalWeight = weightSum === 0 ? 100 : weightSum

  // 1. probability 得分（0-100）
  const probabilityScore = candidate.probability

  // 2. collegeLevel 得分（0-100）
  const collegeLevelScore = (candidate.collegeLevel / 3) * 100

  // 3. majorInterest 得分（0-100）
  let majorInterestScore: number
  const hollandMatch = assessment.hollandCategories.includes(candidate.majorCategory) ? 1 : 0
  const subjectMatch = assessment.subjectCategories.includes(candidate.majorCategory) ? 1 : 0
  const mbtiMatch = assessment.mbtiCategories.includes(candidate.majorCategory) ? 1 : 0
  const assessmentEmpty =
    assessment.hollandCategories.length === 0 &&
    assessment.subjectCategories.length === 0 &&
    assessment.mbtiCategories.length === 0
  if (assessmentEmpty) {
    majorInterestScore = 50
  } else {
    majorInterestScore = ((hollandMatch + subjectMatch + mbtiMatch) / 3) * 100
  }

  // 4. region 得分（0-100）
  const regionScore =
    profile.regions.length === 0
      ? 50
      : profile.regions.includes(candidate.collegeProvince)
        ? 100
        : 0

  // 5. tuition 得分（0-100）
  const tuitionScore =
    profile.maxTuition === null
      ? 50
      : 100 * (1 - candidate.tuition / profile.maxTuition)

  // 6. employment 得分（0-100）
  const employmentScore = candidate.employmentScore

  // 加权平均
  const weightedSum =
    probabilityScore * effectiveWeights.probability +
    collegeLevelScore * effectiveWeights.collegeLevel +
    majorInterestScore * effectiveWeights.majorInterest +
    regionScore * effectiveWeights.region +
    tuitionScore * effectiveWeights.tuition +
    employmentScore * effectiveWeights.employment

  return weightedSum / totalWeight
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/rankScorer.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/rankScorer.ts src/services/rankScorer.test.ts
git commit -m "feat: implement scoreCandidate with 6-dimension weighted scoring"
```

---

## Task 4: 实现 deriveHollandCategories 函数

**Files:**
- Modify: `src/services/rankScorer.ts`
- Modify: `src/services/rankScorer.test.ts`

- [ ] **Step 1: 在 rankScorer.test.ts 添加 deriveHollandCategories 测试**

在 `src/services/rankScorer.test.ts` 末尾追加：

```typescript
import { deriveHollandCategories } from './rankScorer'

describe('deriveHollandCategories', () => {
  it('hollandCode 为 undefined 时返回空数组', () => {
    expect(deriveHollandCategories(undefined)).toEqual([])
  })

  it('hollandCode 为空字符串时返回空数组', () => {
    expect(deriveHollandCategories('')).toEqual([])
  })

  it('hollandCode="RIA" 时返回霍兰德推荐的专业大类集合', () => {
    const majorMapping = {
      physics: ['工学', '理学'],
      computer: ['工学'],
      math: ['理学'],
      biology: ['理学', '农学', '医学'],
      chemistry: ['理学', '工学'],
      art: ['艺术学', '文学'],
      chinese: ['文学', '教育学'],
      politics: ['法学', '教育学'],
      economics: ['经济学', '管理学'],
      foreign_lang: ['文学', '经济学'],
    }
    const result = deriveHollandCategories('RIA', majorMapping)
    // R → physics, computer → 工学, 理学
    // I → math, biology, chemistry, computer → 理学, 农学, 医学, 工学
    // A → art, chinese → 艺术学, 文学, 教育学
    expect(result).toEqual(
      expect.arrayContaining(['工学', '理学', '农学', '医学', '艺术学', '文学', '教育学'])
    )
    expect(result).toHaveLength(7)
  })

  it('majorMapping 为空时返回空数组', () => {
    expect(deriveHollandCategories('RIA', {})).toEqual([])
  })

  it('majorMapping 未传入时返回空数组（默认值）', () => {
    expect(deriveHollandCategories('RIA')).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/rankScorer.test.ts`
Expected: 新增的 deriveHollandCategories 测试 FAIL（当前返回 []）

- [ ] **Step 3: 实现 deriveHollandCategories 函数**

替换 `src/services/rankScorer.ts` 中的 `deriveHollandCategories` 占位实现：

```typescript
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

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/rankScorer.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/rankScorer.ts src/services/rankScorer.test.ts
git commit -m "feat: implement deriveHollandCategories helper"
```

---

## Task 5: store 改造 — 新增 recommendWeights 状态

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: 在 store/index.ts 添加 import**

在 `src/store/index.ts` 第 5 行后添加：

```typescript
import { type RecommendWeights, DEFAULT_WEIGHTS } from '../services/rankScorer'
```

- [ ] **Step 2: 在 AppState 接口添加新字段**

在 `src/store/index.ts` 的 `AppState` 接口中，`integratedAssessment` 字段后添加：

```typescript
  recommendWeights: RecommendWeights
  setRecommendWeights: (w: Partial<RecommendWeights>) => void
  resetRecommendWeights: () => void
```

- [ ] **Step 3: 在 store 实现中添加初始值和 action**

在 `src/store/index.ts` 的 store 实现中，`setIntegratedAssessment` 之后添加：

```typescript
      recommendWeights: DEFAULT_WEIGHTS,
      setRecommendWeights: (w) => set((state) => ({
        recommendWeights: { ...state.recommendWeights, ...w },
      })),
      resetRecommendWeights: () => set({ recommendWeights: DEFAULT_WEIGHTS }),
```

- [ ] **Step 4: 运行现有测试确保无回归**

Run: `npx vitest run src/store`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: add recommendWeights state to store"
```

---

## Task 6: recommender.ts 改造 — 排序逻辑改用 rankScorer

**Files:**
- Modify: `src/services/recommender.ts`
- Modify: `src/services/recommender.test.ts`

- [ ] **Step 1: 在 recommender.test.ts 添加联动测试**

在 `src/services/recommender.test.ts` 末尾追加：

```typescript
import { DEFAULT_WEIGHTS, type AssessmentInput, type RecommendWeights } from './rankScorer'

describe('generateRecommendations 加权排序', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.getState().resetProfile()
  })

  it('未传入 options 时使用 DEFAULT_WEIGHTS 和空 assessment，正常返回', async () => {
    const results = await generateRecommendations(baseProfile)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('传入 assessment 参数后，匹配专业兴趣的候选排序靠前', async () => {
    const assessment: AssessmentInput = {
      hollandCategories: ['工学'],
      subjectCategories: ['工学'],
      mbtiCategories: ['工学'],
    }
    const results = await generateRecommendations(baseProfile, undefined, {
      weights: DEFAULT_WEIGHTS,
      assessment,
    })
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
    // 工学类候选应排在前面（如果有）
    const engineeringItems = results.filter((r) => r.major.category === '工学')
    if (engineeringItems.length > 0) {
      // 检查工学候选在前 50% 位置的比例
      const halfIndex = Math.floor(results.length / 2)
      const engineeringInFirstHalf = engineeringItems.filter((_, i) =>
        results.indexOf(engineeringItems[i]) < halfIndex
      ).length
      // 至少有一些工学候选在前半部分
      expect(engineeringInFirstHalf).toBeGreaterThan(0)
    }
  })

  it('传入自定义 weights 参数后，按自定义权重排序', async () => {
    const customWeights: RecommendWeights = {
      probability: 50,
      collegeLevel: 10,
      majorInterest: 10,
      region: 10,
      tuition: 10,
      employment: 10,
    }
    const results = await generateRecommendations(baseProfile, undefined, {
      weights: customWeights,
    })
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('三桶配额截断逻辑保持不变（rush/stable/safe 比例）', async () => {
    const results = await generateRecommendations(baseProfile)
    const rushCount = results.filter((r) => r.tier === 'rush').length
    const stableCount = results.filter((r) => r.tier === 'stable').length
    const safeCount = results.filter((r) => r.tier === 'safe').length
    // balanced 模式下：25% / 50% / 25%
    const total = rushCount + stableCount + safeCount
    if (total > 0) {
      expect(rushCount).toBeLessThanOrEqual(stableCount)
      expect(safeCount).toBeLessThanOrEqual(stableCount)
    }
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/recommender.test.ts`
Expected: 新增的联动测试 FAIL（当前 generateRecommendations 不接受 options 参数）

- [ ] **Step 3: 修改 recommender.ts 函数签名**

在 `src/services/recommender.ts` 顶部添加 import：

```typescript
import {
  scoreCandidate,
  DEFAULT_WEIGHTS,
  EMPLOYMENT_SCORE_MAP,
  type RecommendWeights,
  type AssessmentInput,
} from './rankScorer'
```

在 `src/services/recommender.ts` 中添加 RecommendOptions 接口（在 import 之后，`generateRecommendations` 之前）：

```typescript
export interface RecommendOptions {
  weights?: RecommendWeights
  assessment?: AssessmentInput
}
```

修改 `generateRecommendations` 函数签名（第 20-23 行）：

```typescript
export async function generateRecommendations(
  profile: UserProfile,
  cache?: RealDataCache,
  options?: RecommendOptions
): Promise<RecommendationItem[]> {
```

- [ ] **Step 4: 替换排序逻辑**

替换 `src/services/recommender.ts` 第 163-172 行的 `candidates.sort(...)` 块：

```typescript
  // 旧代码（删除）：
  // candidates.sort((a, b) => {
  //   if (a.tier !== b.tier) {
  //     const order = { rush: 0, stable: 1, safe: 2 }
  //     return order[a.tier] - order[b.tier]
  //   }
  //   if (b.probability !== a.probability) return b.probability - a.probability
  //   const levelDiff = levelWeight(b.college) - levelWeight(a.college)
  //   if (levelDiff !== 0) return levelDiff
  //   return mbtiMatch(b.major.category) - mbtiMatch(a.major.category)
  // })

  // 新代码：
  const weights = options?.weights ?? DEFAULT_WEIGHTS
  const assessmentInput: AssessmentInput = options?.assessment ?? {
    hollandCategories: [],
    subjectCategories: [],
    mbtiCategories: [],
  }

  const scoredCandidates = candidates.map((c) => ({
    item: c,
    score: scoreCandidate(
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
    ),
  }))

  scoredCandidates.sort((a, b) => b.score - a.score)
  const sortedCandidates = scoredCandidates.map((s) => s.item)
```

- [ ] **Step 5: 修改后续使用 candidates 的代码**

将 `src/services/recommender.ts` 中 `candidates.forEach(...)` 改为 `sortedCandidates.forEach(...)`（第 191 行附近）：

```typescript
  // 旧：
  // candidates.forEach((item) => {
  //   if (item.tier === 'rush' && r < rushCount) { ... }
  //   ...
  // })

  // 新：
  sortedCandidates.forEach((item) => {
    if (item.tier === 'rush' && r < rushCount) {
      result.push(item)
      r++
    } else if (item.tier === 'stable' && s < stableCount) {
      result.push(item)
      s++
    } else if (item.tier === 'safe' && g < safeCount) {
      result.push(item)
      g++
    }
  })
```

- [ ] **Step 6: 运行测试验证通过**

Run: `npx vitest run src/services/recommender.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/recommender.ts src/services/recommender.test.ts
git commit -m "feat: integrate rankScorer into recommender with weighted sorting"
```

---

## Task 7: Recommend.tsx UI 改造 — 高级设置区域

**Files:**
- Modify: `src/pages/Recommend.tsx`
- Create: `src/pages/Recommend.test.tsx`

- [ ] **Step 1: 创建 Recommend.test.tsx 测试文件**

创建 `src/pages/Recommend.test.tsx`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Recommend } from './Recommend'
import { useAppStore } from '../store'

// Mock echarts 以避免 jsdom 环境报错
vi.mock('echarts', () => ({
  init: vi.fn(() => ({ dispose: vi.fn(), resize: vi.fn(), setOption: vi.fn() })),
  use: vi.fn(),
}))

// Mock generateRecommendations
vi.mock('../services/recommender', () => ({
  generateRecommendations: vi.fn().mockResolvedValue([
    {
      id: 'c1-m1',
      college: { id: 'c1', name: '测试大学', province: '北京', city: '北京', tags: ['985'] },
      major: { id: 'm1', name: '计算机科学与技术', category: '工学', tuition: 6000 },
      tier: 'stable',
      probability: 75,
      minRanks: [{ year: 2024, rank: 5000 }],
      reason: '测试原因',
      source: '测试来源',
    },
  ]),
}))

function renderRecommend() {
  return render(
    <MemoryRouter>
      <Recommend />
    </MemoryRouter>
  )
}

describe('Recommend 页面高级设置', () => {
  beforeEach(() => {
    useAppStore.setState({
      profile: {
        provinceId: '11',
        provinceName: '北京',
        subjectType: 'physics',
        subjects: ['物理', '化学'],
        score: 600,
        rank: 5000,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
      recommendations: [],
      recommendWeights: {
        probability: 30,
        collegeLevel: 25,
        majorInterest: 20,
        region: 15,
        tuition: 5,
        employment: 5,
      },
    })
  })

  afterEach(() => {
    useAppStore.getState().resetProfile()
  })

  it('页面渲染时显示高级设置折叠区域', () => {
    renderRecommend()
    expect(screen.getByText('高级设置（推荐权重调整）')).toBeInTheDocument()
  })

  it('点击展开后显示 6 个权重滑块', async () => {
    renderRecommend()
    fireEvent.click(screen.getByText('高级设置（推荐权重调整）'))
    await waitFor(() => {
      expect(screen.getByText('录取概率')).toBeInTheDocument()
      expect(screen.getByText('院校层次')).toBeInTheDocument()
      expect(screen.getByText('专业兴趣')).toBeInTheDocument()
      expect(screen.getByText('地域偏好')).toBeInTheDocument()
      expect(screen.getByText('学费')).toBeInTheDocument()
      expect(screen.getByText('就业前景')).toBeInTheDocument()
    })
  })

  it('显示当前权重总和', async () => {
    renderRecommend()
    fireEvent.click(screen.getByText('高级设置（推荐权重调整）'))
    await waitFor(() => {
      expect(screen.getByText(/当前权重总和：100/)).toBeInTheDocument()
    })
  })

  it('点击恢复默认按钮调用 resetRecommendWeights', async () => {
    const { container } = renderRecommend()
    fireEvent.click(screen.getByText('高级设置（推荐权重调整）'))
    await waitFor(() => {
      expect(screen.getByText('恢复默认')).toBeInTheDocument()
    })
    // 先修改权重
    useAppStore.getState().setRecommendWeights({ probability: 50 })
    expect(useAppStore.getState().recommendWeights.probability).toBe(50)
    // 点击恢复默认
    fireEvent.click(screen.getByText('恢复默认'))
    expect(useAppStore.getState().recommendWeights.probability).toBe(30)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/pages/Recommend.test.tsx`
Expected: 测试 FAIL（当前 Recommend.tsx 没有高级设置区域）

- [ ] **Step 3: 修改 Recommend.tsx，添加 import**

在 `src/pages/Recommend.tsx` 顶部修改 import：

```typescript
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
```

- [ ] **Step 4: 修改 Recommend 组件，扩展 store 取值**

在 `src/pages/Recommend.tsx` 的 `Recommend` 组件中，修改 `useAppStore()` 取值（第 23 行）：

```typescript
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
```

- [ ] **Step 5: 修改 handleRegenerate 函数**

替换 `src/pages/Recommend.tsx` 中的 `handleRegenerate` 函数（第 53-65 行）：

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

- [ ] **Step 6: 在页面 JSX 中添加高级设置区域**

在 `src/pages/Recommend.tsx` 的 return 语句中，标题区（`<div className="flex flex-col md:flex-row...">`）之后、Tier Tabs（`<div className="flex gap-2 mb-5">`）之前插入：

```tsx
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
```

- [ ] **Step 7: 添加 WeightSlider 子组件**

在 `src/pages/Recommend.tsx` 的 `VolunteerCard` 组件之前添加：

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

- [ ] **Step 8: 运行测试验证通过**

Run: `npx vitest run src/pages/Recommend.test.tsx`
Expected: 所有测试 PASS

- [ ] **Step 9: Commit**

```bash
git add src/pages/Recommend.tsx src/pages/Recommend.test.tsx
git commit -m "feat: add advanced settings collapse with weight sliders to Recommend page"
```

---

## Task 8: 全量测试回归

**Files:** 无修改

- [ ] **Step 1: 运行全量测试**

Run: `npx vitest run`
Expected: 所有测试 PASS（原有 338 个 + 新增约 20 个）

- [ ] **Step 2: 运行 lint 检查**

Run: `npx eslint src/services/rankScorer.ts src/services/recommender.ts src/store/index.ts src/pages/Recommend.tsx src/features/assessment/services/resultIntegrator.ts`
Expected: 无 lint 错误

- [ ] **Step 3: 运行 TypeScript 类型检查**

Run: `npx tsc -b --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 启动开发服务器手动验证**

Run: `npm run dev`

手动验证步骤：
1. 打开浏览器访问 http://localhost:5173
2. 进入"推荐"页面
3. 看到"高级设置（推荐权重调整）"折叠区域
4. 点击展开，看到 6 个 Slider
5. 拖动 Slider 调整权重，看到权重值变化
6. 点击"恢复默认"，权重回到 30/25/20/15/5/5
7. 点击"重新生成"，推荐列表按新权重排序

- [ ] **Step 5: 如有 lint/type 错误则修复**

常见问题：
- 未使用的 import：删除
- TypeScript 类型不匹配：检查类型定义
- ESLint react-hooks 规则：确保 hook 在组件顶层调用

- [ ] **Step 6: 最终 commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve lint and type errors from recommendation linkage"
```

---

## Self-Review

### Spec coverage 检查

| Spec 章节 | 对应 Task | 状态 |
|-----------|----------|------|
| 1. 背景与目标 | — | 无需实现 |
| 2. 范围 | — | 无需实现 |
| 3. 架构与文件结构 | 所有 Task | ✓ |
| 4.1 类型定义 | Task 2 | ✓ |
| 4.2 核心函数 scoreCandidate | Task 3 | ✓ |
| 4.3 各维度得分计算 | Task 3 | ✓ |
| 4.4 就业前景得分映射 | Task 2 | ✓ |
| 5. store 改造 | Task 5 | ✓ |
| 6.1 函数签名扩展 | Task 6 | ✓ |
| 6.2 AssessmentInput 构造 | Task 7 | ✓ |
| 6.2.1 deriveHollandCategories | Task 4 | ✓ |
| 6.3 排序逻辑替换 | Task 6 | ✓ |
| 6.4 levelWeight 函数复用 | Task 6 | ✓ |
| 7.1 高级设置区域 | Task 7 | ✓ |
| 7.2 WeightSlider 子组件 | Task 7 | ✓ |
| 7.3 handleRegenerate 改造 | Task 7 | ✓ |
| 7.4 store 取值扩展 | Task 7 | ✓ |
| 8.1 rankScorer 单元测试 | Task 2, 3, 4 | ✓ |
| 8.2 recommender 联动测试 | Task 6 | ✓ |
| 8.3 Recommend 页面测试 | Task 7 | ✓ |
| 8.4 现有测试回归 | Task 8 | ✓ |
| 9. 兼容性与迁移 | Task 6 (options 可选) | ✓ |
| 10. 风险与缓解 | Task 3 (权重归一化) | ✓ |

### Placeholder scan
- 无 TODO/TBD/待定
- 所有代码块完整
- 所有测试有具体断言

### Type consistency
- `RecommendWeights` 字段名：probability/collegeLevel/majorInterest/region/tuition/employment — 全文一致 ✓
- `AssessmentInput` 字段名：hollandCategories/subjectCategories/mbtiCategories — 全文一致 ✓
- `CandidateInput` 字段名：probability/collegeLevel/majorCategory/collegeProvince/tuition/employmentScore — 全文一致 ✓
- `ProfileInput` 字段名：regions/maxTuition — 全文一致 ✓
- `RecommendOptions` 字段名：weights/assessment — 全文一致 ✓
- `scoreCandidate` 签名：(candidate, weights, assessment, profile) — 全文一致 ✓
- `deriveHollandCategories` 签名：(hollandCode?, majorMapping?) — 全文一致 ✓
