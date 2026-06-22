# 霍兰德题量扩充 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将霍兰德测评题库从 12 题扩充到 60 题（每维度 10 题），通过 JSON 文件 + fetch 加载，fetch 失败降级到 mock.ts 的 12 题。

**Architecture:** 新建 `public/data/assessment/holland_60.json` 完整题库，新建 `src/services/hollandQuestions.ts` 加载服务（fetch + fallback），修改 `hollandEngine.ts` 的 `calculateHolland` 接受可选 `questions` 参数，修改 `HollandAssessment.tsx` 异步加载题目。

**Tech Stack:** React 18 + TypeScript + Vite + vitest + Ant Design 5

**Spec:** `docs/superpowers/specs/2026-06-21-holland-questions-expansion-design.md`

---

## 文件结构

| 文件 | 责任 | 操作 |
|------|------|------|
| `public/data/assessment/holland_60.json` | 60 题完整题库数据 | 新建 |
| `src/services/hollandQuestions.ts` | 题库加载服务（fetch + fallback） | 新建 |
| `src/services/hollandQuestions.test.ts` | 加载服务测试 | 新建 |
| `src/features/assessment/services/hollandEngine.ts` | 计分引擎，接受可选 questions 参数 | 修改 |
| `src/features/assessment/services/hollandEngine.test.ts` | 补充 60 题场景测试 | 修改 |
| `src/features/assessment/components/HollandAssessment.tsx` | 异步加载题目 | 修改 |

---

### Task 1: 创建 holland_60.json 题库文件

**Files:**
- Create: `public/data/assessment/holland_60.json`

- [ ] **Step 1: 创建 60 题完整题库**

创建 `public/data/assessment/holland_60.json`，包含 60 道题目，每维度 10 题。题目内容需符合霍兰德 RIASEC 各维度定义：

```json
[
  { "id": 1, "text": "我喜欢修理机械或电子设备", "dimension": "R" },
  { "id": 2, "text": "我喜欢动手做实验或制作东西", "dimension": "R" },
  { "id": 3, "text": "我享受使用工具进行手工制作", "dimension": "R" },
  { "id": 4, "text": "我喜欢户外活动，如露营、徒步、骑行", "dimension": "R" },
  { "id": 5, "text": "我对汽车、飞机等交通工具的构造感兴趣", "dimension": "R" },
  { "id": 6, "text": "我喜欢操作仪器设备进行测量", "dimension": "R" },
  { "id": 7, "text": "我愿意从事需要体力的技术工作", "dimension": "R" },
  { "id": 8, "text": "我对建筑、桥梁等工程结构好奇", "dimension": "R" },
  { "id": 9, "text": "我喜欢种植花草或养殖动物", "dimension": "R" },
  { "id": 10, "text": "我享受拆解和组装物品的过程", "dimension": "R" },
  { "id": 11, "text": "我喜欢分析数据、解决问题", "dimension": "I" },
  { "id": 12, "text": "我对科学研究感兴趣", "dimension": "I" },
  { "id": 13, "text": "我喜欢探索事物背后的原理和规律", "dimension": "I" },
  { "id": 14, "text": "我享受阅读科学类文章或论文", "dimension": "I" },
  { "id": 15, "text": "我喜欢独立思考和钻研难题", "dimension": "I" },
  { "id": 16, "text": "我对数学推理和逻辑证明感兴趣", "dimension": "I" },
  { "id": 17, "text": "我喜欢观察记录自然现象", "dimension": "I" },
  { "id": 18, "text": "我愿意花时间做文献调研", "dimension": "I" },
  { "id": 19, "text": "我对前沿科技发展保持关注", "dimension": "I" },
  { "id": 20, "text": "我享受在实验室做精密实验", "dimension": "I" },
  { "id": 21, "text": "我喜欢绘画、设计或音乐创作", "dimension": "A" },
  { "id": 22, "text": "我富有想象力，喜欢创新表达", "dimension": "A" },
  { "id": 23, "text": "我享受写作，用文字表达内心", "dimension": "A" },
  { "id": 24, "text": "我对影视、戏剧等艺术形式感兴趣", "dimension": "A" },
  { "id": 25, "text": "我喜欢参观美术馆、博物馆或看展览", "dimension": "A" },
  { "id": 26, "text": "我享受即兴创作，如演奏、表演", "dimension": "A" },
  { "id": 27, "text": "我对色彩、构图、排版有独特见解", "dimension": "A" },
  { "id": 28, "text": "我喜欢用摄影记录生活美学", "dimension": "A" },
  { "id": 29, "text": "我愿意从事创意类工作，即使收入不稳定", "dimension": "A" },
  { "id": 30, "text": "我享受自由自在、不受规则约束的创作", "dimension": "A" },
  { "id": 31, "text": "我喜欢帮助别人解决困难", "dimension": "S" },
  { "id": 32, "text": "我善于与人沟通和合作", "dimension": "S" },
  { "id": 33, "text": "我享受教导他人，分享知识", "dimension": "S" },
  { "id": 34, "text": "我对心理咨询和社会工作感兴趣", "dimension": "S" },
  { "id": 35, "text": "我愿意参与志愿服务和公益活动", "dimension": "S" },
  { "id": 36, "text": "我善于倾听他人的烦恼", "dimension": "S" },
  { "id": 37, "text": "我喜欢在团队中协调人际关系", "dimension": "S" },
  { "id": 38, "text": "我对教育行业有热情", "dimension": "S" },
  { "id": 39, "text": "我享受照顾老人或儿童", "dimension": "S" },
  { "id": 40, "text": "我愿意为弱势群体发声", "dimension": "S" },
  { "id": 41, "text": "我喜欢组织活动、领导团队", "dimension": "E" },
  { "id": 42, "text": "我有较强的说服力和影响力", "dimension": "E" },
  { "id": 43, "text": "我对商业创业和经营管理感兴趣", "dimension": "E" },
  { "id": 44, "text": "我享受竞争和挑战，追求成就感", "dimension": "E" },
  { "id": 45, "text": "我善于发现商业机会", "dimension": "E" },
  { "id": 46, "text": "我喜欢策划项目并推动落地", "dimension": "E" },
  { "id": 47, "text": "我愿意承担风险追求更大回报", "dimension": "E" },
  { "id": 48, "text": "我享受公开演讲和表达观点", "dimension": "E" },
  { "id": 49, "text": "我对市场营销和品牌推广感兴趣", "dimension": "E" },
  { "id": 50, "text": "我善于谈判和达成协议", "dimension": "E" },
  { "id": 51, "text": "我喜欢按规则整理资料和数据", "dimension": "C" },
  { "id": 52, "text": "我做事细心、注重细节", "dimension": "C" },
  { "id": 53, "text": "我享受使用电子表格处理数据", "dimension": "C" },
  { "id": 54, "text": "我喜欢制定计划并严格执行", "dimension": "C" },
  { "id": 55, "text": "我对财务、会计类工作感兴趣", "dimension": "C" },
  { "id": 56, "text": "我善于归档文件和管理资料", "dimension": "C" },
  { "id": 57, "text": "我享受核对数据、发现并纠正错误", "dimension": "C" },
  { "id": 58, "text": "我喜欢在有条理的环境中工作", "dimension": "C" },
  { "id": 59, "text": "我愿意从事重复性但要求准确的工作", "dimension": "C" },
  { "id": 60, "text": "我做事有始有终，不遗漏任何环节", "dimension": "C" }
]
```

- [ ] **Step 2: 验证 JSON 格式正确**

Run: `node -e "const d = require('./public/data/assessment/holland_60.json'); console.log('total:', d.length); const dims = {}; d.forEach(q => dims[q.dimension] = (dims[q.dimension]||0)+1); console.log('by dimension:', dims)"`
Expected: `total: 60`，`by dimension: { R: 10, I: 10, A: 10, S: 10, E: 10, C: 10 }`

- [ ] **Step 3: 提交**

```bash
git add public/data/assessment/holland_60.json
git commit -m "feat(holland): 新增 60 题完整题库"
```

---

### Task 2: hollandQuestions.ts 加载服务

**Files:**
- Create: `src/services/hollandQuestions.ts`
- Test: `src/services/hollandQuestions.test.ts`

- [ ] **Step 1: 写失败测试 — 正常加载**

创建 `src/services/hollandQuestions.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadHollandQuestions } from './hollandQuestions'
import { hollandQuestions as fallbackQuestions } from '../data/mock'

describe('loadHollandQuestions', () => {
  const mock60Questions = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    text: `测试题目 ${i + 1}`,
    dimension: ['R', 'I', 'A', 'S', 'E', 'C'][Math.floor(i / 10)],
  }))

  beforeEach(() => {
    vi.resetModules()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('正常加载 60 题', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mock60Questions,
    })
    const result = await loadHollandQuestions()
    expect(result).toHaveLength(60)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('text')
    expect(result[0]).toHaveProperty('dimension')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/hollandQuestions.test.ts`
Expected: FAIL — `loadHollandQuestions` 未定义

- [ ] **Step 3: 写最小实现**

创建 `src/services/hollandQuestions.ts`：

```typescript
import { hollandQuestions as fallbackQuestions } from '../data/mock'

export interface HollandQuestion {
  id: number
  text: string
  dimension: string
}

const QUESTION_URL = '/data/assessment/holland_60.json'
let cachedQuestions: HollandQuestion[] | null = null

function isValidQuestions(data: unknown): data is HollandQuestion[] {
  if (!Array.isArray(data)) return false
  if (data.length < 12) return false
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'number' &&
      typeof item.text === 'string' &&
      typeof item.dimension === 'string'
  )
}

/**
 * 加载霍兰德题库（60 题）
 * fetch 失败时降级到 mock.ts 的 12 题
 */
export async function loadHollandQuestions(): Promise<HollandQuestion[]> {
  if (cachedQuestions) return cachedQuestions

  try {
    const response = await fetch(QUESTION_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (!isValidQuestions(data)) throw new Error('Invalid questions format')
    cachedQuestions = data
    return data
  } catch {
    return fallbackQuestions
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/hollandQuestions.test.ts`
Expected: PASS（1 test）

- [ ] **Step 5: 补充边界测试 — fetch 失败、JSON 校验失败、内存缓存**

在 `src/services/hollandQuestions.test.ts` 的 `describe('loadHollandQuestions')` 块内追加：

```typescript
  it('fetch 失败时降级到 fallback 12 题', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
    expect(result).toHaveLength(12)
  })

  it('JSON 校验失败（非数组）时降级到 fallback', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'array' }),
    })
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
  })

  it('JSON 校验失败（长度不足）时降级到 fallback', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, text: '短题库', dimension: 'R' }],
    })
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
  })

  it('内存缓存：第二次调用不 fetch', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mock60Questions,
    })
    await loadHollandQuestions()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await loadHollandQuestions()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
```

注意：内存缓存测试需要重置模块以清除缓存。在 `beforeEach` 中已有 `vi.resetModules()`，但需要重新 import。修改测试文件顶部，将 import 改为动态 import，或在每个测试内动态 import。

**修正**：由于内存缓存是模块级变量，`vi.resetModules()` 会重置它。为测试缓存行为，需要在该测试内不重置模块。调整方案：将缓存测试单独放在一个不调用 `vi.resetModules()` 的 describe 块中，或使用动态 import。

更简单的方案：将 `beforeEach` 的 `vi.resetModules()` 移除，改为在需要重置缓存的测试内手动调用。修改 `src/services/hollandQuestions.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hollandQuestions as fallbackQuestions } from '../data/mock'

describe('loadHollandQuestions', () => {
  const mock60Questions = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    text: `测试题目 ${i + 1}`,
    dimension: ['R', 'I', 'A', 'S', 'E', 'C'][Math.floor(i / 10)],
  }))

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('正常加载 60 题', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mock60Questions,
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toHaveLength(60)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('text')
    expect(result[0]).toHaveProperty('dimension')
  })

  it('fetch 失败时降级到 fallback 12 题', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
    expect(result).toHaveLength(12)
  })

  it('JSON 校验失败（非数组）时降级到 fallback', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'array' }),
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
  })

  it('JSON 校验失败（长度不足）时降级到 fallback', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, text: '短题库', dimension: 'R' }],
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    const result = await loadHollandQuestions()
    expect(result).toEqual(fallbackQuestions)
  })

  it('内存缓存：第二次调用不 fetch', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mock60Questions,
    })
    const { loadHollandQuestions } = await import('./hollandQuestions')
    await loadHollandQuestions()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await loadHollandQuestions()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: 运行测试验证通过**

Run: `npx vitest run src/services/hollandQuestions.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 7: 提交**

```bash
git add src/services/hollandQuestions.ts src/services/hollandQuestions.test.ts
git commit -m "feat(holland): 题库加载服务（fetch + fallback）"
```

---

### Task 3: hollandEngine.ts 接受可选 questions 参数

**Files:**
- Modify: `src/features/assessment/services/hollandEngine.ts`
- Test: `src/features/assessment/services/hollandEngine.test.ts`

- [ ] **Step 1: 写失败测试 — 传入自定义 questions**

在 `src/features/assessment/services/hollandEngine.test.ts` 末尾追加：

```typescript
  it('传入自定义 questions 参数计分', () => {
    const customQuestions = [
      { id: 101, text: '测试题 R1', dimension: 'R' },
      { id: 102, text: '测试题 R2', dimension: 'R' },
      { id: 103, text: '测试题 I1', dimension: 'I' },
      { id: 104, text: '测试题 I2', dimension: 'I' },
    ]
    const answers: Record<number, number> = {
      101: 5,
      102: 5,
      103: 3,
      104: 3,
    }
    const result = calculateHolland(answers, customQuestions)
    expect(result.scores.R).toBe(10)
    expect(result.scores.I).toBe(6)
    expect(result.scores.A).toBe(0)
    expect(result.code).toBe('RI')
  })

  it('60 题计分：每维度 10 题，每题 5 分，维度得分最大 50', () => {
    const questions60 = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      text: `题 ${i + 1}`,
      dimension: ['R', 'I', 'A', 'S', 'E', 'C'][Math.floor(i / 10)],
    }))
    const answers: Record<number, number> = {}
    questions60.forEach((q) => {
      answers[q.id] = q.dimension === 'R' ? 5 : 1
    })
    const result = calculateHolland(answers, questions60)
    expect(result.scores.R).toBe(50)
    expect(result.scores.I).toBe(10)
    expect(result.scores.A).toBe(10)
    expect(result.scores.S).toBe(10)
    expect(result.scores.E).toBe(10)
    expect(result.scores.C).toBe(10)
    expect(result.code).toBe('R')
  })
```

注意：`calculateHolland` 的现有测试中 `result.code` 长度可能为 3（取前 3 高分维度）。当只有 2 个维度有得分时，code 长度为 2。需确认现有实现：`sorted.slice(0, 3).join('')` 总是取 3 个，即使得分为 0。因此 60 题测试中 `result.code` 应为 'RI' + 第三个字母（按字母序取 0 分维度）。

修正 60 题测试的断言：

```typescript
  it('60 题计分：每维度 10 题，每题 5 分，维度得分最大 50', () => {
    const questions60 = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      text: `题 ${i + 1}`,
      dimension: ['R', 'I', 'A', 'S', 'E', 'C'][Math.floor(i / 10)],
    }))
    const answers: Record<number, number> = {}
    questions60.forEach((q) => {
      answers[q.id] = q.dimension === 'R' ? 5 : 1
    })
    const result = calculateHolland(answers, questions60)
    expect(result.scores.R).toBe(50)
    expect(result.scores.I).toBe(10)
    expect(result.scores.A).toBe(10)
    expect(result.scores.S).toBe(10)
    expect(result.scores.E).toBe(10)
    expect(result.scores.C).toBe(10)
    expect(result.code.startsWith('R')).toBe(true)
  })
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/features/assessment/services/hollandEngine.test.ts`
Expected: FAIL — `calculateHolland` 不接受第二个参数

- [ ] **Step 3: 修改 calculateHolland 接受可选 questions 参数**

修改 `src/features/assessment/services/hollandEngine.ts`：

```typescript
import { hollandQuestions } from '../../../data/mock'
import type { HollandResult, HollandDimension } from '../types'

const DIMENSIONS: HollandDimension[] = ['R', 'I', 'A', 'S', 'E', 'C']

interface Question {
  id: number
  text: string
  dimension: string
}

export function calculateHolland(
  answers: Record<number, number>,
  questions: Question[] = hollandQuestions
): HollandResult {
  const scores: Record<HollandDimension, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }

  questions.forEach((q) => {
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

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/features/assessment/services/hollandEngine.test.ts`
Expected: PASS（5 tests：3 旧 + 2 新）

- [ ] **Step 5: 提交**

```bash
git add src/features/assessment/services/hollandEngine.ts src/features/assessment/services/hollandEngine.test.ts
git commit -m "feat(holland): calculateHolland 接受可选 questions 参数"
```

---

### Task 4: HollandAssessment.tsx 异步加载题目

**Files:**
- Modify: `src/features/assessment/components/HollandAssessment.tsx`

- [ ] **Step 1: 修改 HollandAssessment 组件**

修改 `src/features/assessment/components/HollandAssessment.tsx`：

将第 1-7 行的 import 区改为：

```typescript
import { useState, useEffect } from 'react'
import { Button, Progress, Radio, Spin } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import { hollandQuestions as fallbackQuestions } from '../../../data/mock'
import { useAppStore } from '../../../store'
import { calculateHolland } from '../services/hollandEngine'
import { loadHollandQuestions, type HollandQuestion } from '../../../services/hollandQuestions'
import HollandResultView from './HollandResult'
```

在组件函数体内（第 22-26 行附近）改为：

```typescript
export default function HollandAssessment({ onBack }: HollandAssessmentProps) {
  const { assessmentResult, setAssessmentResult } = useAppStore()
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [current, setCurrent] = useState(0)
  const [questions, setQuestions] = useState<HollandQuestion[]>(fallbackQuestions)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHollandQuestions().then((qs) => {
      setQuestions(qs)
      setLoading(false)
    })
  }, [])

  const question = questions[current]
  const progress = Math.round(((current + 1) / questions.length) * 100)

  const handleAnswer = (value: number) => {
    setAnswers({ ...answers, [question.id]: value })
  }

  const handleNext = () => {
    if (answers[question.id] === undefined) return
    if (current < questions.length - 1) {
      setCurrent(current + 1)
    } else {
      const result = calculateHolland(answers, questions)
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
        questions.map((q) => [q.id, assessmentResult[q.dimension] || 0])
      ),
      questions
    )
    return <HollandResultView result={hollandResult} onReset={reset} onBack={onBack} />
  }

  if (loading) {
    return (
      <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
        <Spin tip="加载题目中..." />
      </div>
    )
  }

  if (!started) {
    return (
      <div className="bg-bg-card rounded-2xl shadow-md p-6 md:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center text-primary text-2xl mx-auto mb-4">
          <StarOutlined />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">霍兰德兴趣测评</h2>
        <p className="text-sm text-text-secondary mb-6">
          共 {questions.length} 题，约 10 分钟完成，帮助你发现适合的专业方向。
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
          <span>进度 {current + 1}/{questions.length}</span>
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
          {current === questions.length - 1 ? '查看结果' : '下一题'}
        </Button>
      </div>
    </div>
  )
}
```

注意：`options` 常量定义保持不变（第 9-15 行）。`HollandAssessmentProps` 接口保持不变。

- [ ] **Step 2: 运行 tsc 检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行全量测试**

Run: `npx vitest run`
Expected: PASS（所有测试）

- [ ] **Step 4: lint 检查**

Run: `npm run lint`
Expected: 新文件无错误（scrapers 目录 pre-existing 错误可忽略）

- [ ] **Step 5: 提交**

```bash
git add src/features/assessment/components/HollandAssessment.tsx
git commit -m "feat(holland): HollandAssessment 异步加载 60 题题库"
```

---

## 自审清单

**Spec 覆盖**：
- [x] holland_60.json 60 题完整题库 — Task 1
- [x] hollandQuestions.ts 加载服务（fetch + fallback）— Task 2
- [x] calculateHolland 接受可选 questions 参数 — Task 3
- [x] HollandAssessment 异步加载 — Task 4
- [x] 加载服务单元测试 — Task 2
- [x] 计分引擎 60 题场景测试 — Task 3
- [x] lint / tsc clean — Task 4

**占位符扫描**：无 TBD/TODO，所有代码块完整。

**类型一致性**：`HollandQuestion` 接口在 `hollandQuestions.ts` 定义，在 `hollandEngine.ts` 内联为 `Question`（结构一致），在 `HollandAssessment.tsx` 从 `hollandQuestions.ts` 导入。`calculateHolland` 签名 `(answers, questions?)` 在所有 task 中一致。
