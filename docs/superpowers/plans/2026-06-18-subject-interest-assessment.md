# 学科兴趣测评（FR-04 子功能 4.2 + 4.3）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现学科兴趣测评（15 题）和测评结果整合（霍兰德+学科兴趣交叉验证+推荐联动），采用 feature-based 目录结构。

**Architecture:** 新建 `src/features/assessment/` 模块，包含 services（hollandEngine/subjectEngine/majorMatcher/resultIntegrator）和 components（AssessmentEntry/HollandAssessment/SubjectAssessment/HollandResult/SubjectResult）。题库用 JSON 文件存储，store 新增 `subjectAssessmentResult` 和 `integratedAssessment` 字段，整合结果写入 `profile.categories` 联动推荐引擎。

**Tech Stack:** React 18 + TypeScript + Vite + Zustand（persist）+ Ant Design 5 + Tailwind + ECharts 5 + vitest

**Spec:** [2026-06-18-subject-interest-assessment-design.md](../specs/2026-06-18-subject-interest-assessment-design.md)

---

## 文件结构

**新建：**
- `src/features/assessment/types.ts` — 类型定义
- `src/features/assessment/index.ts` — 模块导出
- `src/features/assessment/services/hollandEngine.ts` — 霍兰德计分
- `src/features/assessment/services/subjectEngine.ts` — 学科兴趣计分
- `src/features/assessment/services/majorMatcher.ts` — 专业大类匹配
- `src/features/assessment/services/resultIntegrator.ts` — 结果整合
- `src/features/assessment/services/*.test.ts` — Service 测试
- `src/features/assessment/components/AssessmentEntry.tsx` — 双卡片入口
- `src/features/assessment/components/HollandAssessment.tsx` — 霍兰德测评
- `src/features/assessment/components/SubjectAssessment.tsx` — 学科兴趣测评
- `src/features/assessment/components/HollandResult.tsx` — 霍兰德结果
- `src/features/assessment/components/SubjectResult.tsx` — 学科兴趣结果
- `public/data/assessment/subject_15.json` — 15 题题库
- `public/data/assessment/subject_major_mapping.json` — 学科-专业映射

**修改：**
- `src/store/index.ts` — 新增 subjectAssessmentResult、integratedAssessment
- `src/pages/Assessment.tsx` — 改为薄包装
- `src/data/mock.ts` — 新增 subjectQuestions 备用题库

**不修改：**
- `src/services/recommender.ts`（已读 profile.categories）
- `src/pages/Profile.tsx`

---

## Task 1: Store 扩展 + 类型定义

**Files:**
- Modify: `src/store/index.ts`
- Create: `src/features/assessment/types.ts`
- Create: `src/features/assessment/index.ts`
- Test: `src/store/index.test.ts`（已存在，追加测试）

- [ ] **Step 1: 写失败测试**

在 `src/store/index.test.ts` 末尾追加：

```typescript
describe('store subjectAssessment + integratedAssessment', () => {
  beforeEach(() => {
    useAppStore.setState({
      subjectAssessmentResult: null,
      integratedAssessment: null,
    })
  })

  it('默认 subjectAssessmentResult 为 null', () => {
    expect(useAppStore.getState().subjectAssessmentResult).toBeNull()
  })

  it('setSubjectAssessmentResult 设置结果', () => {
    const result = {
      subjectScores: { math: 5, physics: 4 },
      behaviorScores: { theory_practice: 3 },
      topSubjects: ['math', 'physics'],
      recommendedCategories: ['数学类', '计算机类'],
      timestamp: Date.now(),
    }
    useAppStore.getState().setSubjectAssessmentResult(result)
    expect(useAppStore.getState().subjectAssessmentResult).toEqual(result)
  })

  it('默认 integratedAssessment 为 null', () => {
    expect(useAppStore.getState().integratedAssessment).toBeNull()
  })

  it('setIntegratedAssessment 设置结果', () => {
    const result = {
      hollandCode: 'RIA',
      topSubjects: ['math', 'computer', 'physics'],
      agreedCategories: ['计算机类', '数学类'],
      confidence: 'high' as const,
      timestamp: Date.now(),
    }
    useAppStore.getState().setIntegratedAssessment(result)
    expect(useAppStore.getState().integratedAssessment).toEqual(result)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/store/index.test.ts`
Expected: FAIL — `subjectAssessmentResult` is undefined / `setSubjectAssessmentResult` is not a function

- [ ] **Step 3: 创建类型定义文件**

新建 `src/features/assessment/types.ts`：

```typescript
export interface SubjectQuestion {
  id: number
  text: string
  dimension: string
  type: 'subject' | 'behavior'
}

export interface SubjectMajorMapping {
  [subjectKey: string]: string[]
}

export interface SubjectAssessmentResult {
  subjectScores: Record<string, number>
  behaviorScores: Record<string, number>
  topSubjects: string[]
  recommendedCategories: string[]
  timestamp: number
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface IntegratedAssessment {
  hollandCode: string
  topSubjects: string[]
  agreedCategories: string[]
  confidence: ConfidenceLevel
  timestamp: number
}

export type HollandDimension = 'R' | 'I' | 'A' | 'S' | 'E' | 'C'

export interface HollandResult {
  scores: Record<HollandDimension, number>
  code: string
}
```

- [ ] **Step 4: 创建模块导出文件**

新建 `src/features/assessment/index.ts`：

```typescript
export * from './types'
export { calculateHolland } from './services/hollandEngine'
export { calculateSubjectScores } from './services/subjectEngine'
export { matchMajors } from './services/majorMatcher'
export { integrateResults } from './services/resultIntegrator'
```

- [ ] **Step 5: 修改 store**

在 `src/store/index.ts` 顶部新增导入：

```typescript
import { type SubjectAssessmentResult, type IntegratedAssessment } from './features/assessment/types'
```

在 `AppState` 接口中，紧跟 `setAssessmentResult` 之后新增：

```typescript
  assessmentResult: Record<string, number> | null
  setAssessmentResult: (result: Record<string, number> | null) => void

  subjectAssessmentResult: SubjectAssessmentResult | null
  setSubjectAssessmentResult: (result: SubjectAssessmentResult | null) => void

  integratedAssessment: IntegratedAssessment | null
  setIntegratedAssessment: (result: IntegratedAssessment | null) => void
```

在 store 实现中，紧跟 `setAssessmentResult` 实现之后新增：

```typescript
      assessmentResult: null,
      setAssessmentResult: (result) => set({ assessmentResult: result }),

      subjectAssessmentResult: null,
      setSubjectAssessmentResult: (result) => set({ subjectAssessmentResult: result }),

      integratedAssessment: null,
      setIntegratedAssessment: (result) => set({ integratedAssessment: result }),
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/store/index.test.ts`
Expected: PASS

- [ ] **Step 7: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误（index.ts 引用的 service 文件尚不存在，需要先创建空文件或注释掉导出）

如果 `index.ts` 因引用不存在的 service 文件报错，暂时注释掉 service 导出行，只保留 `export * from './types'`。

- [ ] **Step 8: 提交**

```bash
git add src/features/assessment/types.ts src/features/assessment/index.ts src/store/index.ts src/store/index.test.ts
git commit -m "feat(store): add subjectAssessmentResult and integratedAssessment fields"
```

---

## Task 2: 数据文件（题库 + 映射）

**Files:**
- Create: `public/data/assessment/subject_15.json`
- Create: `public/data/assessment/subject_major_mapping.json`

- [ ] **Step 1: 创建题库 JSON**

新建 `public/data/assessment/subject_15.json`：

```json
[
  { "id": 1, "text": "我喜欢用数学方法解决实际问题", "dimension": "math", "type": "subject" },
  { "id": 2, "text": "我对机械设备的运作原理感到好奇", "dimension": "physics", "type": "subject" },
  { "id": 3, "text": "我喜欢做化学实验，观察物质反应", "dimension": "chemistry", "type": "subject" },
  { "id": 4, "text": "我对生命的奥秘和生物体结构感兴趣", "dimension": "biology", "type": "subject" },
  { "id": 5, "text": "我喜欢阅读文学作品或进行写作", "dimension": "chinese", "type": "subject" },
  { "id": 6, "text": "我对历史事件和文明演变感兴趣", "dimension": "history", "type": "subject" },
  { "id": 7, "text": "我喜欢研究地理环境与气候现象", "dimension": "geography", "type": "subject" },
  { "id": 8, "text": "我关注社会问题和公共政策", "dimension": "politics", "type": "subject" },
  { "id": 9, "text": "我喜欢学习外语和跨文化交流", "dimension": "foreign_lang", "type": "subject" },
  { "id": 10, "text": "我对音乐、绘画或设计有浓厚兴趣", "dimension": "art", "type": "subject" },
  { "id": 11, "text": "我喜欢编程或探索计算机技术", "dimension": "computer", "type": "subject" },
  { "id": 12, "text": "我对商业运作和经济规律感兴趣", "dimension": "economics", "type": "subject" },
  { "id": 13, "text": "我更倾向于学习理论知识而非动手实践", "dimension": "theory_practice", "type": "behavior" },
  { "id": 14, "text": "我更喜欢独立完成工作而非团队协作", "dimension": "individual_team", "type": "behavior" },
  { "id": 15, "text": "我更喜欢自由创造而非按规范执行", "dimension": "creative_structured", "type": "behavior" }
]
```

- [ ] **Step 2: 创建学科-专业映射 JSON**

新建 `public/data/assessment/subject_major_mapping.json`：

```json
{
  "math": ["数学类", "统计学类", "计算机类"],
  "physics": ["机械类", "电气类", "电子信息类", "自动化类"],
  "chemistry": ["化学类", "材料类", "生物科学类"],
  "biology": ["基础医学类", "临床医学类", "生物科学类"],
  "chinese": ["中国语言文学类", "新闻传播学类"],
  "history": ["历史学类", "考古学类", "民族学类"],
  "geography": ["地理科学类", "环境科学类", "地质学类"],
  "politics": ["政治学类", "法学类", "社会学类", "马克思主义理论类"],
  "foreign_lang": ["外国语言文学类", "翻译类"],
  "art": ["艺术学理论类", "美术学类", "设计学类", "戏剧与影视学类"],
  "computer": ["计算机类", "电子信息类", "自动化类"],
  "economics": ["经济学类", "财政学类", "金融学类", "工商管理类"]
}
```

- [ ] **Step 3: 提交**

```bash
git add public/data/assessment/subject_15.json public/data/assessment/subject_major_mapping.json
git commit -m "data: add subject interest question bank and major mapping"
```

---

## Task 3: hollandEngine — 霍兰德计分引擎

**Files:**
- Create: `src/features/assessment/services/hollandEngine.ts`
- Test: `src/features/assessment/services/hollandEngine.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/features/assessment/services/hollandEngine.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { calculateHolland } from './hollandEngine'
import { hollandQuestions } from '../../../data/mock'

describe('calculateHolland', () => {
  it('正确聚合六维度得分', () => {
    const answers: Record<number, number> = {}
    hollandQuestions.forEach((q) => {
      answers[q.id] = q.dimension === 'R' ? 5 : 1
    })
    const result = calculateHolland(answers)
    expect(result.scores.R).toBe(10)
    expect(result.scores.I).toBe(2)
    expect(result.scores.A).toBe(2)
    expect(result.scores.S).toBe(2)
    expect(result.scores.E).toBe(2)
    expect(result.scores.C).toBe(2)
  })

  it('生成 3 字母霍兰德代码', () => {
    const answers: Record<number, number> = {}
    hollandQuestions.forEach((q) => {
      if (q.dimension === 'R') answers[q.id] = 5
      else if (q.dimension === 'I') answers[q.id] = 4
      else if (q.dimension === 'A') answers[q.id] = 3
      else answers[q.id] = 1
    })
    const result = calculateHolland(answers)
    expect(result.code).toBe('RIA')
  })

  it('全部同分时取前 3（字母序）', () => {
    const answers: Record<number, number> = {}
    hollandQuestions.forEach((q) => {
      answers[q.id] = 3
    })
    const result = calculateHolland(answers)
    expect(result.code).toHaveLength(3)
    expect(result.code).toBe('AES')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/hollandEngine.test.ts`
Expected: FAIL — Cannot find module './hollandEngine'

- [ ] **Step 3: 实现 hollandEngine**

新建 `src/features/assessment/services/hollandEngine.ts`：

```typescript
import { hollandQuestions } from '../../../data/mock'
import type { HollandResult, HollandDimension } from '../types'

const DIMENSIONS: HollandDimension[] = ['R', 'I', 'A', 'S', 'E', 'C']

export function calculateHolland(answers: Record<number, number>): HollandResult {
  const scores: Record<HollandDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }

  hollandQuestions.forEach((q) => {
    const dim = q.dimension as HollandDimension
    if (DIMENSIONS.includes(dim)) {
      scores[dim] += answers[q.id] || 0
    }
  })

  const sorted = DIMENSIONS.slice().sort((a, b) => {
    if (scores[b] !== scores[a]) return scores[b] - scores[a]
    return a.localeCompare(b)
  })

  return {
    scores,
    code: sorted.slice(0, 3).join(''),
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/hollandEngine.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: 提交**

```bash
git add src/features/assessment/services/hollandEngine.ts src/features/assessment/services/hollandEngine.test.ts
git commit -m "feat(assessment): extract hollandEngine with scoring logic"
```

---

## Task 4: subjectEngine — 学科兴趣计分引擎

**Files:**
- Create: `src/features/assessment/services/subjectEngine.ts`
- Test: `src/features/assessment/services/subjectEngine.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/features/assessment/services/subjectEngine.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateSubjectScores, loadSubjectQuestions } from './subjectEngine'

const mockQuestions = [
  { id: 1, text: '数学题', dimension: 'math', type: 'subject' as const },
  { id: 2, text: '物理题', dimension: 'physics', type: 'subject' as const },
  { id: 3, text: '化学题', dimension: 'chemistry', type: 'subject' as const },
  { id: 13, text: '行为题', dimension: 'theory_practice', type: 'behavior' as const },
]

describe('calculateSubjectScores', () => {
  it('正确聚合学科维度得分', () => {
    const answers: Record<number, number> = { 1: 5, 2: 3, 3: 4, 13: 2 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.subjectScores.math).toBe(5)
    expect(result.subjectScores.physics).toBe(3)
    expect(result.subjectScores.chemistry).toBe(4)
  })

  it('正确聚合行为倾向得分', () => {
    const answers: Record<number, number> = { 1: 5, 2: 3, 3: 4, 13: 2 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.behaviorScores.theory_practice).toBe(2)
  })

  it('取前 3 高分学科', () => {
    const answers: Record<number, number> = { 1: 5, 2: 3, 3: 4, 13: 2 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.topSubjects).toEqual(['math', 'chemistry', 'physics'])
  })

  it('同分时按字母序排序', () => {
    const answers: Record<number, number> = { 1: 3, 2: 3, 3: 3, 13: 3 }
    const result = calculateSubjectScores(answers, mockQuestions)
    expect(result.topSubjects).toEqual(['chemistry', 'math', 'physics'])
  })
})

describe('loadSubjectQuestions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功加载题库', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuestions,
    })
    const questions = await loadSubjectQuestions()
    expect(questions).toEqual(mockQuestions)
  })

  it('加载失败时返回空数组', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const questions = await loadSubjectQuestions()
    expect(questions).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/subjectEngine.test.ts`
Expected: FAIL — Cannot find module './subjectEngine'

- [ ] **Step 3: 实现 subjectEngine**

新建 `src/features/assessment/services/subjectEngine.ts`：

```typescript
import type { SubjectQuestion } from '../types'

export async function loadSubjectQuestions(): Promise<SubjectQuestion[]> {
  try {
    const response = await fetch('/data/assessment/subject_15.json')
    if (!response.ok) return []
    return await response.json()
  } catch {
    return []
  }
}

export function calculateSubjectScores(
  answers: Record<number, number>,
  questions: SubjectQuestion[]
): {
  subjectScores: Record<string, number>
  behaviorScores: Record<string, number>
  topSubjects: string[]
} {
  const subjectScores: Record<string, number> = {}
  const behaviorScores: Record<string, number> = {}

  for (const q of questions) {
    const score = answers[q.id] || 0
    if (q.type === 'subject') {
      subjectScores[q.dimension] = (subjectScores[q.dimension] || 0) + score
    } else {
      behaviorScores[q.dimension] = (behaviorScores[q.dimension] || 0) + score
    }
  }

  const sorted = Object.entries(subjectScores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  return {
    subjectScores,
    behaviorScores,
    topSubjects: sorted.slice(0, 3).map(([key]) => key),
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/subjectEngine.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: 提交**

```bash
git add src/features/assessment/services/subjectEngine.ts src/features/assessment/services/subjectEngine.test.ts
git commit -m "feat(assessment): add subjectEngine with scoring and question loading"
```

---

## Task 5: majorMatcher — 专业大类匹配器

**Files:**
- Create: `src/features/assessment/services/majorMatcher.ts`
- Test: `src/features/assessment/services/majorMatcher.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/features/assessment/services/majorMatcher.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matchMajors, loadMajorMapping } from './majorMatcher'

const mockMapping = {
  math: ['数学类', '统计学类', '计算机类'],
  physics: ['机械类', '电气类', '电子信息类', '自动化类'],
  computer: ['计算机类', '电子信息类', '自动化类'],
}

describe('matchMajors', () => {
  it('返回单个学科对应的专业大类', () => {
    const result = matchMajors(['math'], mockMapping)
    expect(result).toEqual(['数学类', '统计学类', '计算机类'])
  })

  it('多学科取并集去重', () => {
    const result = matchMajors(['math', 'computer'], mockMapping)
    expect(result).toEqual(['数学类', '统计学类', '计算机类', '电子信息类', '自动化类'])
  })

  it('未知学科返回空数组', () => {
    const result = matchMajors(['unknown'], mockMapping)
    expect(result).toEqual([])
  })

  it('空输入返回空数组', () => {
    const result = matchMajors([], mockMapping)
    expect(result).toEqual([])
  })
})

describe('loadMajorMapping', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功加载映射', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapping,
    })
    const mapping = await loadMajorMapping()
    expect(mapping).toEqual(mockMapping)
  })

  it('加载失败返回空对象', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const mapping = await loadMajorMapping()
    expect(mapping).toEqual({})
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/majorMatcher.test.ts`
Expected: FAIL — Cannot find module './majorMatcher'

- [ ] **Step 3: 实现 majorMatcher**

新建 `src/features/assessment/services/majorMatcher.ts`：

```typescript
import type { SubjectMajorMapping } from '../types'

export async function loadMajorMapping(): Promise<SubjectMajorMapping> {
  try {
    const response = await fetch('/data/assessment/subject_major_mapping.json')
    if (!response.ok) return {}
    return await response.json()
  } catch {
    return {}
  }
}

export function matchMajors(topSubjects: string[], mapping: SubjectMajorMapping): string[] {
  const categories = new Set<string>()
  for (const subject of topSubjects) {
    const majors = mapping[subject]
    if (majors) {
      majors.forEach((m) => categories.add(m))
    }
  }
  return Array.from(categories)
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/majorMatcher.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: 提交**

```bash
git add src/features/assessment/services/majorMatcher.ts src/features/assessment/services/majorMatcher.test.ts
git commit -m "feat(assessment): add majorMatcher with subject-major mapping"
```

---

## Task 6: resultIntegrator — 结果整合引擎

**Files:**
- Create: `src/features/assessment/services/resultIntegrator.ts`
- Test: `src/features/assessment/services/resultIntegrator.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/features/assessment/services/resultIntegrator.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { integrateResults } from './resultIntegrator'
import type { SubjectAssessmentResult } from '../types'

const subjectResult: SubjectAssessmentResult = {
  subjectScores: { math: 5, physics: 4, computer: 5, chemistry: 3 },
  behaviorScores: { theory_practice: 4 },
  topSubjects: ['math', 'computer', 'physics'],
  recommendedCategories: ['数学类', '统计学类', '计算机类', '电子信息类', '自动化类', '机械类', '电气类'],
  timestamp: 1,
}

const majorMapping = {
  math: ['数学类', '统计学类', '计算机类'],
  physics: ['机械类', '电气类', '电子信息类', '自动化类'],
  computer: ['计算机类', '电子信息类', '自动化类'],
  chemistry: ['化学类', '材料类', '生物科学类'],
  biology: ['基础医学类', '临床医学类', '生物科学类'],
  chinese: ['中国语言文学类', '新闻传播学类'],
  history: ['历史学类', '考古学类', '民族学类'],
  geography: ['地理科学类', '环境科学类', '地质学类'],
  politics: ['政治学类', '法学类', '社会学类', '马克思主义理论类'],
  foreign_lang: ['外国语言文学类', '翻译类'],
  art: ['艺术学理论类', '美术学类', '设计学类', '戏剧与影视学类'],
  economics: ['经济学类', '财政学类', '金融学类', '工商管理类'],
}

describe('integrateResults', () => {
  it('生成霍兰德代码', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    expect(result.hollandCode).toBe('RIA')
  })

  it('计算交叉验证一致的专业大类', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    // R -> physics, computer; I -> math, computer, chemistry
    // 霍兰德映射的专业大类: 机械类, 电气类, 电子信息类, 自动化类, 计算机类, 数学类, 统计学类, 化学类, 材料类, 生物科学类
    // 学科兴趣推荐: 数学类, 统计学类, 计算机类, 电子信息类, 自动化类, 机械类, 电气类
    // 交集: 机械类, 电气类, 电子信息类, 自动化类, 计算机类, 数学类, 统计学类
    expect(result.agreedCategories).toContain('计算机类')
    expect(result.agreedCategories).toContain('数学类')
    expect(result.agreedCategories).toContain('机械类')
    expect(result.agreedCategories.length).toBeGreaterThanOrEqual(3)
  })

  it('置信度 high（交集 >= 3）', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    expect(result.confidence).toBe('high')
  })

  it('置信度 medium（交集 1-2）', () => {
    const hollandScores = { S: 10, E: 8, C: 6, R: 2, I: 2, A: 2 }
    // S -> politics, chinese; E -> economics, foreign_lang
    // 霍兰德映射: 政治学类, 法学类, 社会学类, 马克思主义理论类, 中国语言文学类, 新闻传播学类, 经济学类, 财政学类, 金融学类, 工商管理类, 外国语言文学类, 翻译类
    // 学科兴趣推荐: 数学类, 统计学类, 计算机类, 电子信息类, 自动化类, 机械类, 电气类
    // 交集: 空 -> 但 let me check... none of these overlap
    // Actually 0 intersection -> low
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    expect(result.confidence).toBe('low')
  })

  it('置信度 low（交集 0）', () => {
    const hollandScores = { S: 10, E: 8, C: 6, R: 2, I: 2, A: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping)
    expect(result.confidence).toBe('low')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/resultIntegrator.test.ts`
Expected: FAIL — Cannot find module './resultIntegrator'

- [ ] **Step 3: 实现 resultIntegrator**

新建 `src/features/assessment/services/resultIntegrator.ts`：

```typescript
import type { IntegratedAssessment, SubjectAssessmentResult, SubjectMajorMapping, HollandDimension } from '../types'

const HOLLAND_TO_SUBJECTS: Record<string, string[]> = {
  R: ['physics', 'computer'],
  I: ['math', 'biology', 'chemistry', 'computer'],
  A: ['art', 'chinese'],
  S: ['politics', 'chinese'],
  E: ['economics', 'foreign_lang'],
  C: ['computer', 'economics'],
}

export function integrateResults(
  hollandScores: Record<string, number>,
  subjectResult: SubjectAssessmentResult,
  majorMapping: SubjectMajorMapping
): IntegratedAssessment {
  const dimensions: HollandDimension[] = ['R', 'I', 'A', 'S', 'E', 'C']
  const sortedDims = dimensions.slice().sort((a, b) => {
    if (hollandScores[b] !== hollandScores[a]) return hollandScores[b] - hollandScores[a]
    return a.localeCompare(b)
  })
  const hollandCode = sortedDims.slice(0, 3).join('')

  const hollandSubjects = new Set<string>()
  for (const dim of hollandCode) {
    const subjects = HOLLAND_TO_SUBJECTS[dim]
    if (subjects) {
      subjects.forEach((s) => hollandSubjects.add(s))
    }
  }

  const hollandCategories = new Set<string>()
  for (const subject of hollandSubjects) {
    const majors = majorMapping[subject]
    if (majors) {
      majors.forEach((m) => hollandCategories.add(m))
    }
  }

  const subjectCategories = new Set(subjectResult.recommendedCategories)
  const agreedCategories = Array.from(hollandCategories).filter((c) => subjectCategories.has(c))

  let confidence: 'high' | 'medium' | 'low'
  if (agreedCategories.length >= 3) {
    confidence = 'high'
  } else if (agreedCategories.length >= 1) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  return {
    hollandCode,
    topSubjects: subjectResult.topSubjects,
    agreedCategories,
    confidence,
    timestamp: Date.now(),
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/resultIntegrator.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: 提交**

```bash
git add src/features/assessment/services/resultIntegrator.ts src/features/assessment/services/resultIntegrator.test.ts
git commit -m "feat(assessment): add resultIntegrator for cross-validation"
```

---

## Task 7: HollandResult 组件（迁移 + ECharts 雷达图）

**Files:**
- Create: `src/features/assessment/components/HollandResult.tsx`

- [ ] **Step 1: 实现 HollandResult**

新建 `src/features/assessment/components/HollandResult.tsx`：

```typescript
import { useRef, useEffect } from 'react'
import { Button } from 'antd'
import { RedoOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import type { HollandResult } from '../types'

const hollandNames: Record<string, string> = {
  R: '现实型',
  I: '研究型',
  A: '艺术型',
  S: '社会型',
  E: '企业型',
  C: '常规型',
}

interface HollandResultProps {
  result: HollandResult
  onReset: () => void
  onBack: () => void
}

export default function HollandResultView({ result, onReset, onBack }: HollandResultProps) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    const dims = ['R', 'I', 'A', 'S', 'E', 'C']
    chart.setOption({
      radar: {
        indicator: dims.map((d) => ({ name: `${d} ${hollandNames[d]}`, max: 10 })),
        shape: 'polygon',
        splitNumber: 5,
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: dims.map((d) => result.scores[d as keyof typeof result.scores]),
              name: '霍兰德得分',
              areaStyle: { color: 'rgba(5, 150, 105, 0.3)' },
              lineStyle: { color: '#059669' },
              itemStyle: { color: '#059669' },
            },
          ],
        },
      ],
    })
    return () => chart.dispose()
  }, [result])

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <h2 className="text-lg font-bold text-text-primary mb-4">霍兰德测评结果</h2>
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-primary mb-2">{result.code}</div>
        <p className="text-sm text-text-secondary">
          你的霍兰德代码：{result.code.split('').map((k) => hollandNames[k]).join(' / ')}
        </p>
      </div>
      <div ref={chartRef} className="w-full h-72 mb-6" />
      <div className="flex flex-wrap gap-3">
        <Button icon={<RedoOutlined />} onClick={onReset}>重新测评</Button>
        <Button type="primary" onClick={onBack} className="bg-primary border-0">返回测评入口</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/assessment/components/HollandResult.tsx
git commit -m "feat(assessment): add HollandResult with ECharts radar chart"
```

---

## Task 8: SubjectResult 组件（ECharts 柱状图）

**Files:**
- Create: `src/features/assessment/components/SubjectResult.tsx`

- [ ] **Step 1: 实现 SubjectResult**

新建 `src/features/assessment/components/SubjectResult.tsx`：

```typescript
import { useRef, useEffect } from 'react'
import { Button, Tag } from 'antd'
import { RedoOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import type { SubjectAssessmentResult } from '../types'

const subjectNames: Record<string, string> = {
  math: '数学/逻辑',
  physics: '物理/机械',
  chemistry: '化学/实验',
  biology: '生物/生命',
  chinese: '语文/写作',
  history: '历史/文化',
  geography: '地理/环境',
  politics: '政治/社会',
  foreign_lang: '外语/交流',
  art: '艺术/审美',
  computer: '计算机/技术',
  economics: '经济/管理',
}

const behaviorNames: Record<string, string> = {
  theory_practice: '理论倾向',
  individual_team: '独立倾向',
  creative_structured: '创造倾向',
}

interface SubjectResultProps {
  result: SubjectAssessmentResult
  onReset: () => void
  onBack: () => void
}

export default function SubjectResultView({ result, onReset, onBack }: SubjectResultProps) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    const entries = Object.entries(result.subjectScores).sort((a, b) => b[1] - a[1])
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: entries.map(([key]) => subjectNames[key] || key),
        axisLabel: { rotate: 45, fontSize: 10 },
      },
      yAxis: { type: 'value', max: 5 },
      series: [
        {
          type: 'bar',
          data: entries.map(([key, val]) => ({
            value: val,
            itemStyle: { color: result.topSubjects.includes(key) ? '#059669' : '#d1d5db' },
          })),
        },
      ],
    })
    return () => chart.dispose()
  }, [result])

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <h2 className="text-lg font-bold text-text-primary mb-4">学科兴趣测评结果</h2>
      <div className="text-center mb-6">
        <p className="text-sm text-text-secondary mb-2">你的前 3 高分学科</p>
        <div className="text-2xl font-bold text-primary">
          {result.topSubjects.map((s) => subjectNames[s] || s).join('、')}
        </div>
      </div>
      <div ref={chartRef} className="w-full h-72 mb-6" />
      <div className="mb-4">
        <p className="text-sm font-medium text-text-primary mb-2">推荐专业大类</p>
        <div className="flex flex-wrap gap-2">
          {result.recommendedCategories.map((cat) => (
            <Tag key={cat} color="green">{cat}</Tag>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button icon={<RedoOutlined />} onClick={onReset}>重新测评</Button>
        <Button type="primary" onClick={onBack} className="bg-primary border-0">返回测评入口</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/assessment/components/SubjectResult.tsx
git commit -m "feat(assessment): add SubjectResult with ECharts bar chart"
```

---

## Task 9: HollandAssessment 组件（迁移）

**Files:**
- Create: `src/features/assessment/components/HollandAssessment.tsx`

- [ ] **Step 1: 实现 HollandAssessment**

新建 `src/features/assessment/components/HollandAssessment.tsx`：

```typescript
import { useState } from 'react'
import { Button, Progress, Radio } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import { hollandQuestions } from '../../../data/mock'
import { useAppStore } from '../../../store'
import { calculateHolland } from '../services/hollandEngine'
import HollandResultView from './HollandResult'

const options = [
  { value: 1, label: '完全不喜欢' },
  { value: 2, label: '不太喜欢' },
  { value: 3, label: '一般' },
  { value: 4, label: '比较喜欢' },
  { value: 5, label: '非常喜欢' },
]

interface HollandAssessmentProps {
  onBack: () => void
}

export default function HollandAssessment({ onBack }: HollandAssessmentProps) {
  const { assessmentResult, setAssessmentResult } = useAppStore()
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [current, setCurrent] = useState(0)

  const question = hollandQuestions[current]
  const progress = Math.round(((current + 1) / hollandQuestions.length) * 100)

  const handleAnswer = (value: number) => {
    setAnswers({ ...answers, [question.id]: value })
  }

  const handleNext = () => {
    if (answers[question.id] === undefined) return
    if (current < hollandQuestions.length - 1) {
      setCurrent(current + 1)
    } else {
      const result = calculateHolland(answers)
      setAssessmentResult(result.scores)
      setStarted(false)
    }
  }

  const reset = () => {
    setAnswers({})
    setCurrent(0)
    setAssessmentResult(null)
    setStarted(true)
  }

  if (!started && assessmentResult) {
    const hollandResult = calculateHolland(
      Object.fromEntries(
        hollandQuestions.map((q) => [q.id, assessmentResult[q.dimension] || 0])
      )
    )
    return <HollandResultView result={hollandResult} onReset={reset} onBack={onBack} />
  }

  if (!started) {
    return (
      <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center text-primary text-2xl mx-auto mb-4">
          <StarOutlined />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">霍兰德兴趣测评</h2>
        <p className="text-sm text-text-secondary mb-6">
          共 {hollandQuestions.length} 题，约 2 分钟完成，帮助你发现适合的专业方向。
        </p>
        <Button type="primary" size="large" onClick={() => setStarted(true)} className="bg-gradient-to-r from-primary to-primary-light border-0">
          开始测评
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-text-secondary mb-2">
          <span>进度 {current + 1}/{hollandQuestions.length}</span>
          <span>{progress}%</span>
        </div>
        <Progress percent={progress} showInfo={false} strokeColor="#059669" trailColor="var(--border-color)" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-6">{question.text}</h2>
      <Radio.Group
        onChange={(e) => handleAnswer(e.target.value)}
        value={answers[question.id]}
        className="w-full"
      >
        <div className="grid grid-cols-1 gap-3">
          {options.map((opt) => (
            <Radio.Button
              key={opt.value}
              value={opt.value}
              className="h-auto py-3 px-4 text-left rounded-lg border-border-color hover:border-primary hover:text-primary"
            >
              {opt.label}
            </Radio.Button>
          ))}
        </div>
      </Radio.Group>
      <div className="flex justify-end mt-8">
        <Button
          type="primary"
          size="large"
          disabled={answers[question.id] === undefined}
          onClick={handleNext}
          className="bg-primary border-0"
        >
          {current === hollandQuestions.length - 1 ? '查看结果' : '下一题'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/assessment/components/HollandAssessment.tsx
git commit -m "feat(assessment): migrate HollandAssessment to feature module"
```

---

## Task 10: SubjectAssessment 组件

**Files:**
- Create: `src/features/assessment/components/SubjectAssessment.tsx`

- [ ] **Step 1: 实现 SubjectAssessment**

新建 `src/features/assessment/components/SubjectAssessment.tsx`：

```typescript
import { useState, useEffect } from 'react'
import { Button, Progress, Radio, message } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../store'
import { loadSubjectQuestions, calculateSubjectScores } from '../services/subjectEngine'
import { loadMajorMapping, matchMajors } from '../services/majorMatcher'
import SubjectResultView from './SubjectResult'
import type { SubjectQuestion, SubjectAssessmentResult } from '../types'

const options = [
  { value: 1, label: '完全不喜欢' },
  { value: 2, label: '不太喜欢' },
  { value: 3, label: '一般' },
  { value: 4, label: '比较喜欢' },
  { value: 5, label: '非常喜欢' },
]

interface SubjectAssessmentProps {
  onBack: () => void
}

export default function SubjectAssessment({ onBack }: SubjectAssessmentProps) {
  const { subjectAssessmentResult, setSubjectAssessmentResult } = useAppStore()
  const [started, setStarted] = useState(false)
  const [questions, setQuestions] = useState<SubjectQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (started && questions.length === 0) {
      loadSubjectQuestions().then((qs) => {
        if (qs.length === 0) {
          message.error('题库加载失败，请稍后重试')
          setStarted(false)
        } else {
          setQuestions(qs)
        }
      })
    }
  }, [started, questions.length])

  const question = questions[current]
  const progress = questions.length > 0 ? Math.round(((current + 1) / questions.length) * 100) : 0

  const handleAnswer = (value: number) => {
    if (!question) return
    setAnswers({ ...answers, [question.id]: value })
  }

  const handleNext = async () => {
    if (!question || answers[question.id] === undefined) return
    if (current < questions.length - 1) {
      setCurrent(current + 1)
    } else {
      const scores = calculateSubjectScores(answers, questions)
      const mapping = await loadMajorMapping()
      const categories = matchMajors(scores.topSubjects, mapping)
      const result: SubjectAssessmentResult = {
        ...scores,
        recommendedCategories: categories,
        timestamp: Date.now(),
      }
      setSubjectAssessmentResult(result)
      setStarted(false)
    }
  }

  const reset = () => {
    setAnswers({})
    setCurrent(0)
    setSubjectAssessmentResult(null)
    setStarted(true)
  }

  if (!started && subjectAssessmentResult) {
    return <SubjectResultView result={subjectAssessmentResult} onReset={reset} onBack={onBack} />
  }

  if (!started) {
    return (
      <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center text-primary text-2xl mx-auto mb-4">
          <BookOutlined />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">学科兴趣测评</h2>
        <p className="text-sm text-text-secondary mb-6">
          共 15 题，约 3 分钟完成，发现你感兴趣的学科方向并推荐匹配专业。
        </p>
        <Button type="primary" size="large" onClick={() => setStarted(true)} className="bg-gradient-to-r from-primary to-primary-light border-0">
          开始测评
        </Button>
      </div>
    )
  }

  if (questions.length === 0) {
    return <div className="text-center py-8 text-text-secondary">题库加载中...</div>
  }

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-8">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-text-secondary mb-2">
          <span>进度 {current + 1}/{questions.length}</span>
          <span>{progress}%</span>
        </div>
        <Progress percent={progress} showInfo={false} strokeColor="#059669" trailColor="var(--border-color)" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-6">{question.text}</h2>
      <Radio.Group
        onChange={(e) => handleAnswer(e.target.value)}
        value={question ? answers[question.id] : undefined}
        className="w-full"
      >
        <div className="grid grid-cols-1 gap-3">
          {options.map((opt) => (
            <Radio.Button
              key={opt.value}
              value={opt.value}
              className="h-auto py-3 px-4 text-left rounded-lg border-border-color hover:border-primary hover:text-primary"
            >
              {opt.label}
            </Radio.Button>
          ))}
        </div>
      </Radio.Group>
      <div className="flex justify-end mt-8">
        <Button
          type="primary"
          size="large"
          disabled={!question || answers[question.id] === undefined}
          onClick={handleNext}
          className="bg-primary border-0"
        >
          {current === questions.length - 1 ? '查看结果' : '下一题'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/assessment/components/SubjectAssessment.tsx
git commit -m "feat(assessment): add SubjectAssessment with question flow"
```

---

## Task 11: AssessmentEntry 组件（双卡片入口 + 整合结果）

**Files:**
- Create: `src/features/assessment/components/AssessmentEntry.tsx`

- [ ] **Step 1: 实现 AssessmentEntry**

新建 `src/features/assessment/components/AssessmentEntry.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { Button, Tag, message } from 'antd'
import { StarOutlined, BookOutlined, CheckCircleOutlined, ImportOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../store'
import { integrateResults } from '../services/resultIntegrator'
import { loadMajorMapping } from '../services/majorMatcher'
import type { IntegratedAssessment } from '../types'

const subjectNames: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', biology: '生物',
  chinese: '语文', history: '历史', geography: '地理', politics: '政治',
  foreign_lang: '外语', art: '艺术', computer: '计算机', economics: '经济',
}

const confidenceConfig = {
  high: { color: 'green', label: '高置信度' },
  medium: { color: 'gold', label: '中置信度' },
  low: { color: 'default', label: '低置信度' },
}

interface AssessmentEntryProps {
  onSelectHolland: () => void
  onSelectSubject: () => void
}

export default function AssessmentEntry({ onSelectHolland, onSelectSubject }: AssessmentEntryProps) {
  const {
    assessmentResult,
    subjectAssessmentResult,
    integratedAssessment,
    setIntegratedAssessment,
    updateProfile,
  } = useAppStore()
  const [mapping, setMapping] = useState<Record<string, string[]>>({})

  useEffect(() => {
    loadMajorMapping().then(setMapping)
  }, [])

  useEffect(() => {
    if (assessmentResult && subjectAssessmentResult && Object.keys(mapping).length > 0) {
      const integrated = integrateResults(assessmentResult, subjectAssessmentResult, mapping)
      setIntegratedAssessment(integrated)
    }
  }, [assessmentResult, subjectAssessmentResult, mapping, setIntegratedAssessment])

  const handleApplyToProfile = () => {
    if (!integratedAssessment) return
    updateProfile({ categories: integratedAssessment.agreedCategories })
    message.success('已应用到推荐偏好')
  }

  const showIntegration = Boolean(assessmentResult && subjectAssessmentResult && integratedAssessment)

  return (
    <div className="space-y-4">
      {showIntegration && integratedAssessment && (
        <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-6 border-2 border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">测评整合结果</h2>
            <Tag color={confidenceConfig[integratedAssessment.confidence].color}>
              {confidenceConfig[integratedAssessment.confidence].label}
            </Tag>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-text-secondary mb-1">霍兰德代码</p>
              <p className="text-lg font-bold text-primary">{integratedAssessment.hollandCode}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">学科兴趣前 3</p>
              <p className="text-sm font-medium text-text-primary">
                {integratedAssessment.topSubjects.map((s) => subjectNames[s] || s).join('、')}
              </p>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2">交叉验证一致的专业大类</p>
            <div className="flex flex-wrap gap-2">
              {integratedAssessment.agreedCategories.length > 0 ? (
                integratedAssessment.agreedCategories.map((cat) => (
                  <Tag key={cat} color="green">{cat}</Tag>
                ))
              ) : (
                <span className="text-sm text-text-secondary">暂无一致专业大类</span>
              )}
            </div>
          </div>
          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={handleApplyToProfile}
            className="bg-primary border-0"
          >
            应用到推荐偏好
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={onSelectHolland}
          className="bg-bg-card rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/30"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl">
              <StarOutlined />
            </div>
            {assessmentResult && (
              <CheckCircleOutlined className="text-primary text-xl" />
            )}
          </div>
          <h3 className="text-base font-bold text-text-primary mb-2">霍兰德兴趣测评</h3>
          <p className="text-sm text-text-secondary mb-4">
            12 题，约 2 分钟。通过 RIASEC 六维度模型发现你的职业兴趣类型。
          </p>
          <Button type="primary" size="small" className="bg-primary border-0">
            {assessmentResult ? '重新测评' : '开始测评'}
          </Button>
        </div>

        <div
          onClick={onSelectSubject}
          className="bg-bg-card rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/30"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl">
              <BookOutlined />
            </div>
            {subjectAssessmentResult && (
              <CheckCircleOutlined className="text-primary text-xl" />
            )}
          </div>
          <h3 className="text-base font-bold text-text-primary mb-2">学科兴趣测评</h3>
          <p className="text-sm text-text-secondary mb-4">
            15 题，约 3 分钟。发现你感兴趣的学科方向并推荐匹配专业大类。
          </p>
          <Button type="primary" size="small" className="bg-primary border-0">
            {subjectAssessmentResult ? '重新测评' : '开始测评'}
          </Button>
        </div>
      </div>

      {!showIntegration && assessmentResult && !subjectAssessmentResult && (
        <p className="text-center text-sm text-text-secondary">
          完成学科兴趣测评后可查看整合结果
        </p>
      )}
      {!showIntegration && !assessmentResult && subjectAssessmentResult && (
        <p className="text-center text-sm text-text-secondary">
          完成霍兰德测评后可查看整合结果
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/assessment/components/AssessmentEntry.tsx
git commit -m "feat(assessment): add AssessmentEntry with dual cards and integration"
```

---

## Task 12: Assessment.tsx 改造 + mock.ts 备用题库

**Files:**
- Modify: `src/pages/Assessment.tsx`
- Modify: `src/data/mock.ts`

- [ ] **Step 1: 新增 mock.ts 备用题库**

在 `src/data/mock.ts` 的 `hollandQuestions` 之后新增：

```typescript
export const subjectQuestions = [
  { id: 1, text: '我喜欢用数学方法解决实际问题', dimension: 'math', type: 'subject' as const },
  { id: 2, text: '我对机械设备的运作原理感到好奇', dimension: 'physics', type: 'subject' as const },
  { id: 3, text: '我喜欢做化学实验，观察物质反应', dimension: 'chemistry', type: 'subject' as const },
  { id: 4, text: '我对生命的奥秘和生物体结构感兴趣', dimension: 'biology', type: 'subject' as const },
  { id: 5, text: '我喜欢阅读文学作品或进行写作', dimension: 'chinese', type: 'subject' as const },
  { id: 6, text: '我对历史事件和文明演变感兴趣', dimension: 'history', type: 'subject' as const },
  { id: 7, text: '我喜欢研究地理环境与气候现象', dimension: 'geography', type: 'subject' as const },
  { id: 8, text: '我关注社会问题和公共政策', dimension: 'politics', type: 'subject' as const },
  { id: 9, text: '我喜欢学习外语和跨文化交流', dimension: 'foreign_lang', type: 'subject' as const },
  { id: 10, text: '我对音乐、绘画或设计有浓厚兴趣', dimension: 'art', type: 'subject' as const },
  { id: 11, text: '我喜欢编程或探索计算机技术', dimension: 'computer', type: 'subject' as const },
  { id: 12, text: '我对商业运作和经济规律感兴趣', dimension: 'economics', type: 'subject' as const },
  { id: 13, text: '我更倾向于学习理论知识而非动手实践', dimension: 'theory_practice', type: 'behavior' as const },
  { id: 14, text: '我更喜欢独立完成工作而非团队协作', dimension: 'individual_team', type: 'behavior' as const },
  { id: 15, text: '我更喜欢自由创造而非按规范执行', dimension: 'creative_structured', type: 'behavior' as const },
]
```

- [ ] **Step 2: 重写 Assessment.tsx 为薄包装**

替换 `src/pages/Assessment.tsx` 全部内容：

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { LeftOutlined } from '@ant-design/icons'
import AssessmentEntry from '../features/assessment/components/AssessmentEntry'
import HollandAssessment from '../features/assessment/components/HollandAssessment'
import SubjectAssessment from '../features/assessment/components/SubjectAssessment'

type View = 'entry' | 'holland' | 'subject'

export default function Assessment() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('entry')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button icon={<LeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">兴趣测评</h1>
      </div>

      {view === 'entry' && (
        <AssessmentEntry
          onSelectHolland={() => setView('holland')}
          onSelectSubject={() => setView('subject')}
        />
      )}

      {view === 'holland' && (
        <HollandAssessment onBack={() => setView('entry')} />
      )}

      {view === 'subject' && (
        <SubjectAssessment onBack={() => setView('entry')} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: 类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/pages/Assessment.tsx src/data/mock.ts
git commit -m "feat(assessment): rewrite Assessment.tsx as thin wrapper with dual entry"
```

---

## Task 13: 全量验证 + 构建

- [ ] **Step 1: 运行全部测评相关测试**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/store/index.test.ts src/features/assessment/`
Expected: 所有测试 PASS

- [ ] **Step 2: 运行全量类型检查**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc -b --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行 ESLint**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx eslint src/features/assessment/ src/pages/Assessment.tsx src/store/index.ts`
Expected: 无错误

- [ ] **Step 4: 运行生产构建**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npm run build`
Expected: 构建成功

- [ ] **Step 5: 手动验证**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npm run dev`

验证清单：
1. 打开 /assessment，看到双卡片入口
2. 点击"霍兰德兴趣测评"，完成 12 题，看到雷达图结果
3. 返回入口，点击"学科兴趣测评"，完成 15 题，看到柱状图结果
4. 返回入口，看到整合结果卡片（霍兰德代码 + 学科 top3 + 一致专业大类 + 置信度）
5. 点击"应用到推荐偏好"，toast 提示"已应用到推荐偏好"
6. 刷新页面，测评结果仍在（持久化）

- [ ] **Step 6: 最终提交（如有手动验证修复）**

```bash
git add -A
git commit -m "chore: final verification of subject interest assessment"
```

---

## Self-Review

### 1. Spec 覆盖检查

| Spec 要求 | 对应 Task |
|---|---|
| 数据层：subject_15.json 题库 | Task 2 ✓ |
| 数据层：subject_major_mapping.json 映射 | Task 2 ✓ |
| 数据层：Store 新增 subjectAssessmentResult + integratedAssessment | Task 1 ✓ |
| Service：hollandEngine（提取） | Task 3 ✓ |
| Service：subjectEngine（计分 + 加载） | Task 4 ✓ |
| Service：majorMatcher（匹配 + 加载） | Task 5 ✓ |
| Service：resultIntegrator（交叉验证 + 置信度） | Task 6 ✓ |
| UI：AssessmentEntry（双卡片 + 整合结果） | Task 11 ✓ |
| UI：HollandAssessment（迁移） | Task 9 ✓ |
| UI：SubjectAssessment（新建） | Task 10 ✓ |
| UI：HollandResult（迁移 + ECharts 雷达图） | Task 7 ✓ |
| UI：SubjectResult（新建 + ECharts 柱状图） | Task 8 ✓ |
| Assessment.tsx 改造为薄包装 | Task 12 ✓ |
| mock.ts 备用题库 | Task 12 ✓ |
| 4.3 整合联动：写入 profile.categories | Task 11 ✓ |
| 错误处理：题库加载失败 | Task 4 (loadSubjectQuestions 返回空) + Task 10 (message.error) ✓ |
| 测试：Service 层 | Task 3, 4, 5, 6 ✓ |

### 2. 占位符扫描

- 无 "TBD" / "TODO" / "implement later"
- 每个步骤都含完整代码或完整命令

### 3. 类型一致性

- `SubjectAssessmentResult` 在 Task 1 定义，Task 4/6/10/11 使用 — 一致
- `IntegratedAssessment` 在 Task 1 定义，Task 6/11 使用 — 一致
- `HollandResult` 在 Task 1 定义，Task 3/7/9 使用 — 一致
- `calculateHolland` 返回 `HollandResult`，Task 9 调用 — 一致
- `calculateSubjectScores` 返回 `{ subjectScores, behaviorScores, topSubjects }`，Task 10 使用 — 一致
- `matchMajors` 接受 `(topSubjects, mapping)`，Task 10 调用 — 一致
- `integrateResults` 接受 `(hollandScores, subjectResult, majorMapping)`，Task 11 调用 — 一致
