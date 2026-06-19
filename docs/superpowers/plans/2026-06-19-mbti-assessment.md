# MBTI 人格测评 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增可选 MBTI 人格测评功能，用户可选择 MBTI 类型，作为推荐引擎第四级排序 tiebreaker，并提供外链跳转测评网站。

**Architecture:** 在现有 assessment feature 模块下新增 mbtiMapper 服务、MbtiCard/MbtiResult 组件。UserProfile 新增 mbtiType 字段，IntegratedAssessment 新增 MBTI 维度。recommender.ts 新增第四级排序 tiebreaker。MBTI 为可选维度，未选择时所有行为退化为现有逻辑。

**Tech Stack:** React 18+、TypeScript、Vite、Zustand（persist）、Ant Design 5、Tailwind CSS、vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-06-19-mbti-assessment-design.md`

**Test command:** `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run`（项目无 test script，直接用 vitest）

**Lint/Build commands:** `export PATH="/opt/homebrew/bin:$PATH" && npm run lint` / `npm run build`

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `public/data/assessment/mbti_category_mapping.json` | Create | 16 型人格 → 专业大类映射数据 |
| `src/features/assessment/types.ts` | Modify | 新增 MbtiMapping 接口、IntegratedAssessment 新增 MBTI 字段 |
| `src/features/assessment/services/mbtiMapper.ts` | Create | MBTI 映射加载与查询服务 |
| `src/features/assessment/services/mbtiMapper.test.ts` | Create | mbtiMapper 单元测试 |
| `src/features/assessment/services/resultIntegrator.ts` | Modify | integrateResults 新增 MBTI 参数 |
| `src/features/assessment/services/resultIntegrator.test.ts` | Modify | 扩展 MBTI 相关测试 |
| `src/features/assessment/index.ts` | Modify | 导出新服务 |
| `src/store/index.ts` | Modify | UserProfile 新增 mbtiType 字段 |
| `src/pages/Settings.test.tsx` | Modify | profile fixture 新增 mbtiType |
| `src/pages/Chat.test.tsx` | Modify | profile fixture 新增 mbtiType |
| `src/services/recommender.ts` | Modify | 新增 MBTI 第四级排序 tiebreaker |
| `src/services/recommender.test.ts` | Create | recommender MBTI 测试 |
| `src/features/assessment/components/MbtiCard.tsx` | Create | MBTI 入口卡片（下拉选择 + 外链） |
| `src/features/assessment/components/MbtiCard.test.tsx` | Create | MbtiCard 组件测试 |
| `src/features/assessment/components/MbtiResult.tsx` | Create | MBTI 结果展示组件 |
| `src/features/assessment/components/AssessmentEntry.tsx` | Modify | 新增第三张 MBTI 卡片 + 整合 |

---

### Task 1: MBTI 映射数据文件

**Files:**
- Create: `public/data/assessment/mbti_category_mapping.json`

- [ ] **Step 1: 创建 16 型人格映射 JSON**

```json
{
  "INTJ": { "name": "建筑师", "categories": ["工学", "理学", "经济学"], "description": "富有想象力又有战略思维的人，凡事都有计划" },
  "INTP": { "name": "逻辑学家", "categories": ["理学", "工学", "哲学"], "description": "对知识有着永不满足的渴望，喜欢逻辑分析" },
  "ENTJ": { "name": "指挥官", "categories": ["经济学", "管理学", "法学"], "description": "天生的领导者，果断且意志坚定" },
  "ENTP": { "name": "辩论家", "categories": ["法学", "经济学", "文学"], "description": "聪明好奇的思想者，喜欢智力交锋" },
  "INFJ": { "name": "提倡者", "categories": ["文学", "哲学", "教育学"], "description": "安静而神秘，同时鼓舞人心且不知疲倦的理想主义者" },
  "INFP": { "name": "调停者", "categories": ["文学", "艺术学", "教育学"], "description": "诗意善良的利他主义者，渴望帮助善因" },
  "ENFJ": { "name": "主人公", "categories": ["教育学", "文学", "管理学"], "description": "富有魅力和鼓舞力的领导者，能让听众入迷" },
  "ENFP": { "name": "竞选者", "categories": ["艺术学", "文学", "教育学"], "description": "热情有创意爱社交的自由精神" },
  "ISTJ": { "name": "物流师", "categories": ["工学", "管理学", "医学"], "description": "实际且注重事实的人，可靠性不容怀疑" },
  "ISFJ": { "name": "守卫者", "categories": ["医学", "教育学", "管理学"], "description": "非常专注而温暖的守护者，时刻准备保护爱着的人" },
  "ESTJ": { "name": "总经理", "categories": ["管理学", "经济学", "法学"], "description": "出色的管理者，在管理事情或人的方面无与伦比" },
  "ESFJ": { "name": "执政官", "categories": ["教育学", "医学", "管理学"], "description": "极有同情心，爱交往受欢迎的人们，总是热心提供帮助" },
  "ISTP": { "name": "鉴赏家", "categories": ["工学", "理学", "农学"], "description": "大胆而实际的实验家，擅长使用任何形式的工具" },
  "ISFP": { "name": "探险家", "categories": ["艺术学", "文学", "农学"], "description": "灵活有魅力的艺术家，时刻准备探索发现新事物" },
  "ESTP": { "name": "企业家", "categories": ["经济学", "管理学", "工学"], "description": "聪明精力充沛的人，真正享受生活在边缘地带" },
  "ESFP": { "name": "表演者", "categories": ["艺术学", "教育学", "文学"], "description": "自发的精力充沛而热情的表演者，生活在他们周围永不无聊" }
}
```

- [ ] **Step 2: 验证 JSON 格式正确**

Run: `export PATH="/opt/homebrew/bin:$PATH" && node -e "const d = require('./public/data/assessment/mbti_category_mapping.json'); console.log(Object.keys(d).length, 'types')"`
Expected: `16 types`

- [ ] **Step 3: Commit**

```bash
git add public/data/assessment/mbti_category_mapping.json
git commit -m "feat(assessment): add MBTI 16-type to major category mapping data"
```

---

### Task 2: 类型定义更新

**Files:**
- Modify: `src/features/assessment/types.ts`

- [ ] **Step 1: 在 types.ts 末尾新增 MbtiMapping 接口，并扩展 IntegratedAssessment**

在 `src/features/assessment/types.ts` 中，修改 `IntegratedAssessment` 接口，在 `confidence` 和 `timestamp` 之间新增两个字段：

```typescript
export interface IntegratedAssessment {
  hollandCode: string
  topSubjects: string[]
  agreedCategories: string[]
  confidence: ConfidenceLevel
  mbtiType: string | null
  mbtiCategories: string[]
  timestamp: number
}
```

在文件末尾新增 `MbtiMapping` 接口和 `MbtiMappingRecord` 类型：

```typescript
export interface MbtiMapping {
  name: string
  categories: string[]
  description: string
}

export type MbtiMappingRecord = Record<string, MbtiMapping>
```

- [ ] **Step 2: 验证类型检查通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc --noEmit`
Expected: 编译错误（因为 resultIntegrator.ts 还没更新 IntegratedAssessment 的返回值），这是预期的——下一步会修复

- [ ] **Step 3: Commit**

```bash
git add src/features/assessment/types.ts
git commit -m "feat(assessment): add MbtiMapping type and extend IntegratedAssessment with MBTI fields"
```

---

### Task 3: Store 更新（UserProfile 新增 mbtiType）

**Files:**
- Modify: `src/store/index.ts`
- Modify: `src/pages/Settings.test.tsx`
- Modify: `src/pages/Chat.test.tsx`

- [ ] **Step 1: 在 UserProfile 接口新增 mbtiType 字段**

在 `src/store/index.ts` 的 `UserProfile` 接口中，在 `riskPreference` 后新增：

```typescript
export interface UserProfile {
  provinceId: string
  provinceName: string
  subjectType: 'physics' | 'history' | 'comprehensive'
  subjects: string[]
  score: number | null
  rank: number | null
  regions: string[]
  levels: string[]
  categories: string[]
  maxTuition: number | null
  physicalExam: 'normal' | 'colorWeak' | 'colorBlind' | 'vision' | 'height' | 'other'
  riskPreference: 'conservative' | 'balanced' | 'aggressive'
  mbtiType: string | null
}
```

- [ ] **Step 2: 在 defaultProfile 新增 mbtiType 默认值**

在 `src/store/index.ts` 的 `defaultProfile` 对象中，在 `riskPreference: 'balanced'` 后新增：

```typescript
const defaultProfile: UserProfile = {
  provinceId: '',
  provinceName: '',
  subjectType: 'physics',
  subjects: [],
  score: null,
  rank: null,
  regions: [],
  levels: [],
  categories: [],
  maxTuition: null,
  physicalExam: 'normal',
  riskPreference: 'balanced',
  mbtiType: null,
}
```

- [ ] **Step 3: 更新 Settings.test.tsx 的 profile fixture**

在 `src/pages/Settings.test.tsx` 第 20-27 行的 profile 对象中，在 `riskPreference: 'balanced'` 后新增 `mbtiType: null`：

```typescript
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
        mbtiType: null,
      },
```

- [ ] **Step 4: 更新 Chat.test.tsx 的两处 profile fixture**

在 `src/pages/Chat.test.tsx` 中有两处 profile 对象（约第 25 行和第 97 行），每处在 `riskPreference: 'balanced'` 后新增 `mbtiType: null`：

第一处（约第 25 行）：
```typescript
      profile: {
        provinceId: '',
        provinceName: '',
        subjectType: 'physics',
        subjects: [],
        score: null,
        rank: null,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
```

第二处（约第 97 行）：
```typescript
      profile: {
        provinceId: 'zhejiang',
        provinceName: '浙江',
        subjectType: 'physics',
        subjects: ['物理'],
        score: 600,
        rank: 20000,
        regions: [],
        levels: [],
        categories: [],
        maxTuition: null,
        physicalExam: 'normal',
        riskPreference: 'balanced',
        mbtiType: null,
      },
```

- [ ] **Step 5: 验证类型检查和现有测试通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc --noEmit && npx vitest run src/store/index.test.ts src/pages/Settings.test.tsx src/pages/Chat.test.tsx`
Expected: tsc 通过（resultIntegrator 的编译错误在 Task 5 修复），3 个测试文件全部 PASS

注意：tsc 可能仍报 resultIntegrator.ts 错误（IntegratedAssessment 缺少新字段），这是预期的，Task 5 会修复。

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts src/pages/Settings.test.tsx src/pages/Chat.test.tsx
git commit -m "feat(store): add mbtiType field to UserProfile and update test fixtures"
```

---

### Task 4: mbtiMapper 服务 + 测试（TDD）

**Files:**
- Create: `src/features/assessment/services/mbtiMapper.test.ts`
- Create: `src/features/assessment/services/mbtiMapper.ts`

- [ ] **Step 1: 编写 mbtiMapper 测试（失败测试）**

创建 `src/features/assessment/services/mbtiMapper.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadMbtiMapping, getMbtiCategories } from './mbtiMapper'
import type { MbtiMappingRecord } from '../types'

const mockMapping: MbtiMappingRecord = {
  INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: 'desc' },
  ENFP: { name: '竞选者', categories: ['艺术学', '文学', '教育学'], description: 'desc' },
}

describe('loadMbtiMapping', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功加载映射返回完整对象', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapping,
    })
    const mapping = await loadMbtiMapping()
    expect(mapping).toEqual(mockMapping)
    expect(Object.keys(mapping!)).toHaveLength(2)
  })

  it('fetch 失败返回 null', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const mapping = await loadMbtiMapping()
    expect(mapping).toBeNull()
  })

  it('response 非 ok 返回 null', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    })
    const mapping = await loadMbtiMapping()
    expect(mapping).toBeNull()
  })
})

describe('getMbtiCategories', () => {
  it('有效类型返回对应专业大类数组', () => {
    const result = getMbtiCategories('INTJ', mockMapping)
    expect(result).toEqual(['工学', '理学', '经济学'])
  })

  it('无效类型返回空数组', () => {
    const result = getMbtiCategories('XXXX', mockMapping)
    expect(result).toEqual([])
  })

  it('mbtiType 为 null 返回空数组', () => {
    const result = getMbtiCategories(null, mockMapping)
    expect(result).toEqual([])
  })

  it('mapping 为 null 返回空数组', () => {
    const result = getMbtiCategories('INTJ', null)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/mbtiMapper.test.ts`
Expected: FAIL — 模块 `./mbtiMapper` 不存在

- [ ] **Step 3: 实现 mbtiMapper 服务**

创建 `src/features/assessment/services/mbtiMapper.ts`：

```typescript
import type { MbtiMappingRecord } from '../types'

export async function loadMbtiMapping(): Promise<MbtiMappingRecord | null> {
  try {
    const response = await fetch('/data/assessment/mbti_category_mapping.json')
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export function getMbtiCategories(
  mbtiType: string | null,
  mapping: MbtiMappingRecord | null
): string[] {
  if (!mbtiType || !mapping) return []
  return mapping[mbtiType]?.categories ?? []
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/mbtiMapper.test.ts`
Expected: PASS — 全部 7 个测试通过

- [ ] **Step 5: Commit**

```bash
git add src/features/assessment/services/mbtiMapper.ts src/features/assessment/services/mbtiMapper.test.ts
git commit -m "feat(assessment): add mbtiMapper service with load and query functions"
```

---

### Task 5: resultIntegrator 扩展 + 测试（TDD）

**Files:**
- Modify: `src/features/assessment/services/resultIntegrator.test.ts`
- Modify: `src/features/assessment/services/resultIntegrator.ts`

- [ ] **Step 1: 扩展 resultIntegrator 测试，新增 MBTI 相关测试用例**

在 `src/features/assessment/services/resultIntegrator.test.ts` 文件末尾新增以下测试。首先在文件顶部导入区新增 `MbtiMappingRecord` 类型导入：

```typescript
import type { SubjectAssessmentResult, MbtiMappingRecord } from '../types'
```

然后在文件末尾（最后一个 `})` 之前）新增以下测试块：

```typescript
  const mbtiMapping: MbtiMappingRecord = {
    INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: 'desc' },
    ENFP: { name: '竞选者', categories: ['艺术学', '文学', '教育学'], description: 'desc' },
  }

  it('传入 mbtiType 和 mbtiMapping 时写入 MBTI 字段', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping, 'INTJ', mbtiMapping)
    expect(result.mbtiType).toBe('INTJ')
    expect(result.mbtiCategories).toEqual(['工学', '理学', '经济学'])
  })

  it('mbtiType 为 null 时 mbtiCategories 为空数组', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping, null, mbtiMapping)
    expect(result.mbtiType).toBeNull()
    expect(result.mbtiCategories).toEqual([])
  })

  it('mbtiMapping 为 null 时 mbtiCategories 为空数组', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const result = integrateResults(hollandScores, subjectResult, majorMapping, 'INTJ', null)
    expect(result.mbtiType).toBe('INTJ')
    expect(result.mbtiCategories).toEqual([])
  })

  it('置信度计算不受 MBTI 影响', () => {
    const hollandScores = { R: 10, I: 8, A: 6, S: 4, E: 2, C: 2 }
    const resultWithoutMbti = integrateResults(hollandScores, subjectResult, majorMapping, null, null)
    const resultWithMbti = integrateResults(hollandScores, subjectResult, majorMapping, 'INTJ', mbtiMapping)
    expect(resultWithoutMbti.confidence).toBe(resultWithMbti.confidence)
  })
```

- [ ] **Step 2: 运行测试验证失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/resultIntegrator.test.ts`
Expected: FAIL — 新增的 4 个 MBTI 测试失败（integrateResults 签名不匹配，返回值缺少 mbtiType/mbtiCategories）

- [ ] **Step 3: 更新 integrateResults 函数签名和实现**

修改 `src/features/assessment/services/resultIntegrator.ts`，扩展函数签名新增两个参数，并在返回值中写入 MBTI 字段：

```typescript
import type { IntegratedAssessment, SubjectAssessmentResult, SubjectMajorMapping, HollandDimension, MbtiMappingRecord } from '../types'

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
  majorMapping: SubjectMajorMapping,
  mbtiType: string | null = null,
  mbtiMapping: MbtiMappingRecord | null = null
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

  const mbtiCategories = mbtiType && mbtiMapping
    ? mbtiMapping[mbtiType]?.categories ?? []
    : []

  return {
    hollandCode,
    topSubjects: subjectResult.topSubjects,
    agreedCategories,
    confidence,
    mbtiType,
    mbtiCategories,
    timestamp: Date.now(),
  }
}
```

注意：新增参数使用默认值 `= null`，确保 AssessmentEntry 现有调用 `integrateResults(assessmentResult, subjectAssessmentResult, mapping)` 不会破坏（Task 8 会更新调用传入 MBTI 参数）。

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/services/resultIntegrator.test.ts`
Expected: PASS — 全部 8 个测试通过（原 4 个 + 新增 4 个）

- [ ] **Step 5: Commit**

```bash
git add src/features/assessment/services/resultIntegrator.ts src/features/assessment/services/resultIntegrator.test.ts
git commit -m "feat(assessment): extend integrateResults with optional MBTI parameters"
```

---

### Task 6: 模块导出更新

**Files:**
- Modify: `src/features/assessment/index.ts`

- [ ] **Step 1: 在 index.ts 新增 mbtiMapper 导出**

修改 `src/features/assessment/index.ts`，在末尾新增两行导出：

```typescript
export * from './types'
export { calculateHolland } from './services/hollandEngine'
export { calculateSubjectScores } from './services/subjectEngine'
export { matchMajors, loadMajorMapping } from './services/majorMatcher'
export { integrateResults } from './services/resultIntegrator'
export { loadMbtiMapping, getMbtiCategories } from './services/mbtiMapper'
```

注意：同时补充导出 `loadMajorMapping`（当前 index.ts 未导出此函数，但 AssessmentEntry 直接从 majorMatcher 导入，这里补导出保持模块完整性）。

- [ ] **Step 2: 验证类型检查通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc --noEmit`
Expected: 通过（无错误）

- [ ] **Step 3: Commit**

```bash
git add src/features/assessment/index.ts
git commit -m "feat(assessment): export mbtiMapper services from module index"
```

---

### Task 7: recommender MBTI 整合 + 测试（TDD）

**Files:**
- Create: `src/services/recommender.test.ts`
- Modify: `src/services/recommender.ts`

- [ ] **Step 1: 编写 recommender MBTI 测试**

创建 `src/services/recommender.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateRecommendations } from './recommender'
import { useAppStore } from '../store'
import type { UserProfile } from '../store'

const baseProfile: UserProfile = {
  provinceId: '',
  provinceName: '',
  subjectType: 'physics',
  subjects: ['物理', '化学'],
  score: 600,
  rank: 20000,
  regions: [],
  levels: [],
  categories: [],
  maxTuition: null,
  physicalExam: 'normal',
  riskPreference: 'balanced',
  mbtiType: null,
}

describe('generateRecommendations MBTI 整合', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.getState().resetProfile()
  })

  it('用户未选择 MBTI 时推荐正常返回', async () => {
    const results = await generateRecommendations(baseProfile)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('用户已选择 MBTI 时推荐正常返回', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: 'desc' },
      }),
    })
    const profileWithMbti = { ...baseProfile, mbtiType: 'INTJ' }
    const results = await generateRecommendations(profileWithMbti)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('MBTI 映射加载失败时推荐正常返回', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const profileWithMbti = { ...baseProfile, mbtiType: 'INTJ' }
    const results = await generateRecommendations(profileWithMbti)
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
  })

  it('MBTI 匹配的专业推荐理由包含 MBTI 标注', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: 'desc' },
      }),
    })
    const profileWithMbti = { ...baseProfile, mbtiType: 'INTJ' }
    const results = await generateRecommendations(profileWithMbti)
    const mbtiMatched = results.find(
      (r) => r.reason.includes('MBTI') && r.reason.includes('INTJ')
    )
    // mock 数据中工学专业（如计算机科学与技术）应被 MBTI 匹配
    expect(mbtiMatched).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/recommender.test.ts`
Expected: 部分测试 FAIL — MBTI 匹配的专业推荐理由不包含 MBTI 标注（因为 recommender 还没整合 MBTI）

注意：前 3 个测试可能 PASS（因为推荐正常返回不依赖 MBTI），第 4 个测试会 FAIL。

- [ ] **Step 3: 修改 recommender.ts 整合 MBTI**

在 `src/services/recommender.ts` 中做以下修改：

**3a. 在文件顶部新增导入**（第 11 行后，`import type { UserProfile }` 后新增）：

```typescript
import { loadMbtiMapping } from '../features/assessment/services/mbtiMapper'
```

**3b. 在 generateRecommendations 函数内，`const maxTuition = ...` 行后（约第 33 行后）新增 MBTI 映射加载**：

```typescript
  const maxTuition = profile.maxTuition || Infinity

  const mbtiMapping = profile.mbtiType ? await loadMbtiMapping() : null
  const mbtiCategories = mbtiMapping?.[profile.mbtiType]?.categories ?? []
  const mbtiMatch = (category: string) => (mbtiCategories.includes(category) ? 1 : 0)
```

**3c. 在 reasonParts 构建处（约第 132-134 行，`if (profile.categories.includes(major.category))` 块后）新增 MBTI 理由**：

```typescript
    if (profile.categories.includes(major.category)) {
      reasonParts.push(`专业方向匹配你的偏好`)
    }
    if (mbtiCategories.includes(major.category)) {
      reasonParts.push(`与你的 MBTI 人格(${profile.mbtiType})匹配`)
    }
```

**3d. 在 candidates.sort 排序函数中（约第 155-162 行），新增第四级 MBTI tiebreaker**：

将现有排序函数：
```typescript
  candidates.sort((a, b) => {
    if (a.tier !== b.tier) {
      const order = { rush: 0, stable: 1, safe: 2 }
      return order[a.tier] - order[b.tier]
    }
    if (b.probability !== a.probability) return b.probability - a.probability
    return levelWeight(b.college) - levelWeight(a.college)
  })
```

替换为：
```typescript
  candidates.sort((a, b) => {
    if (a.tier !== b.tier) {
      const order = { rush: 0, stable: 1, safe: 2 }
      return order[a.tier] - order[b.tier]
    }
    if (b.probability !== a.probability) return b.probability - a.probability
    const levelDiff = levelWeight(b.college) - levelWeight(a.college)
    if (levelDiff !== 0) return levelDiff
    return mbtiMatch(b.major.category) - mbtiMatch(a.major.category)
  })
```

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/services/recommender.test.ts`
Expected: PASS — 全部 4 个测试通过

- [ ] **Step 5: Commit**

```bash
git add src/services/recommender.ts src/services/recommender.test.ts
git commit -m "feat(recommender): add MBTI as fourth-level sort tiebreaker and reason annotation"
```

---

### Task 8: MbtiCard 组件 + 测试（TDD）

**Files:**
- Create: `src/features/assessment/components/MbtiCard.test.tsx`
- Create: `src/features/assessment/components/MbtiCard.tsx`

- [ ] **Step 1: 编写 MbtiCard 测试**

创建 `src/features/assessment/components/MbtiCard.test.tsx`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MbtiCard from './MbtiCard'
import { useAppStore } from '../../../store'

vi.mock('../../../features/assessment/services/mbtiMapper', () => ({
  loadMbtiMapping: vi.fn().mockResolvedValue({
    INTJ: { name: '建筑师', categories: ['工学', '理学', '经济学'], description: '富有想象力又有战略思维' },
    ENFP: { name: '竞选者', categories: ['艺术学', '文学', '教育学'], description: '热情有创意' },
  }),
}))

describe('MbtiCard', () => {
  beforeEach(() => {
    useAppStore.setState({
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
        mbtiType: null,
      },
    })
  })

  it('未选择状态渲染下拉选择器和外链', async () => {
    render(<MbtiCard />)
    expect(screen.getByText('MBTI 人格测评')).toBeInTheDocument()
    expect(screen.getByText('不知道自己的人格？点击测评 →')).toBeInTheDocument()
    const link = screen.getByText('不知道自己的人格？点击测评 →').closest('a')
    expect(link).toHaveAttribute('href', 'https://www.16personalities.com/chinese-personality-test')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('选择下拉项后调用 updateProfile', async () => {
    render(<MbtiCard />)
    // 等待映射加载完成
    const select = await screen.findByRole('combobox')
    fireEvent.mouseDown(select)
    // Ant Design Select 选项在 portal 中
    const option = await screen.findByText('INTJ - 建筑师')
    fireEvent.click(option)
    expect(useAppStore.getState().profile.mbtiType).toBe('INTJ')
  })

  it('已选择状态渲染类型名称和匹配专业大类', async () => {
    useAppStore.setState({
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
        mbtiType: 'INTJ',
      },
    })
    render(<MbtiCard />)
    expect(await screen.findByText('INTJ 建筑师')).toBeInTheDocument()
    expect(screen.getByText('工学')).toBeInTheDocument()
    expect(screen.getByText('理学')).toBeInTheDocument()
    expect(screen.getByText('经济学')).toBeInTheDocument()
  })

  it('点击修改按钮切换回选择状态', async () => {
    useAppStore.setState({
      profile: {
        provinceId: '', provinceName: '', subjectType: 'physics', subjects: [],
        score: null, rank: null, regions: [], levels: [], categories: [],
        maxTuition: null, physicalExam: 'normal', riskPreference: 'balanced',
        mbtiType: 'INTJ',
      },
    })
    render(<MbtiCard />)
    const editBtn = await screen.findByText('修改')
    fireEvent.click(editBtn)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/components/MbtiCard.test.tsx`
Expected: FAIL — 组件 `./MbtiCard` 不存在

- [ ] **Step 3: 实现 MbtiCard 组件**

创建 `src/features/assessment/components/MbtiCard.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { Select, Tag, Button } from 'antd'
import { SolutionOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../store'
import { loadMbtiMapping } from '../services/mbtiMapper'
import type { MbtiMappingRecord } from '../types'

const MBTI_TEST_URL = 'https://www.16personalities.com/chinese-personality-test'

export default function MbtiCard() {
  const { profile, updateProfile } = useAppStore()
  const [mapping, setMapping] = useState<MbtiMappingRecord | null>(null)
  const [editing, setEditing] = useState(!profile.mbtiType)

  useEffect(() => {
    loadMbtiMapping().then(setMapping)
  }, [])

  const currentMbti = profile.mbtiType
  const currentMapping = currentMbti && mapping ? mapping[currentMbti] : null

  const options = mapping
    ? Object.entries(mapping).map(([code, info]) => ({
        value: code,
        label: `${code} - ${info.name}`,
      }))
    : []

  const handleChange = (value: string) => {
    updateProfile({ mbtiType: value })
    setEditing(false)
  }

  const handleEdit = () => {
    setEditing(true)
  }

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-6 border-2 border-transparent hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-primary text-xl">
          <SolutionOutlined />
        </div>
        {currentMbti && !editing && (
          <Button size="small" icon={<EditOutlined />} onClick={handleEdit}>
            修改
          </Button>
        )}
      </div>

      <h3 className="text-base font-bold text-text-primary mb-2">MBTI 人格测评</h3>

      {currentMbti && !editing && currentMapping ? (
        <div>
          <p className="text-lg font-bold text-primary mb-1">
            {currentMbti} {currentMapping.name}
          </p>
          <p className="text-sm text-text-secondary mb-3">{currentMapping.description}</p>
          <p className="text-xs text-text-secondary mb-2">匹配专业大类</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {currentMapping.categories.map((cat) => (
              <Tag key={cat} color="blue">{cat}</Tag>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-text-secondary mb-3">
            选择你的 MBTI 人格类型，优化专业推荐
          </p>
          <Select
            placeholder="选择你的人格类型"
            options={options}
            onChange={handleChange}
            className="w-full mb-3"
            value={undefined}
            data-testid="mbti-select"
          />
          <a
            href={MBTI_TEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            不知道自己的人格？点击测评 <LinkOutlined />
          </a>
        </div>
      )}
    </div>
  )
}
```

注意：外链文字调整为"不知道自己的人格？点击测评"（后跟 LinkOutlined 图标），测试中匹配"不知道自己的人格？点击测评 →"需调整为匹配"不知道自己的人格？点击测评"。请在测试中更新匹配文字：

在 `MbtiCard.test.tsx` 中将 `screen.getByText('不知道自己的人格？点击测评 →')` 改为 `screen.getByText(/不知道自己的人格？点击测评/)`。

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run src/features/assessment/components/MbtiCard.test.tsx`
Expected: PASS — 全部 4 个测试通过

- [ ] **Step 5: Commit**

```bash
git add src/features/assessment/components/MbtiCard.tsx src/features/assessment/components/MbtiCard.test.tsx
git commit -m "feat(assessment): add MbtiCard component with dropdown selection and external link"
```

---

### Task 9: MbtiResult 组件

**Files:**
- Create: `src/features/assessment/components/MbtiResult.tsx`

- [ ] **Step 1: 实现 MbtiResult 组件**

创建 `src/features/assessment/components/MbtiResult.tsx`：

```typescript
import { Tag } from 'antd'
import type { IntegratedAssessment } from '../types'

interface MbtiResultProps {
  assessment: IntegratedAssessment
}

export default function MbtiResult({ assessment }: MbtiResultProps) {
  if (!assessment.mbtiType) {
    return null
  }

  return (
    <div className="bg-bg-card rounded-2xl shadow-md p-5 md:p-6">
      <h3 className="text-base font-bold text-text-primary mb-3">MBTI 人格</h3>
      <p className="text-2xl font-bold text-primary mb-2">{assessment.mbtiType}</p>
      <p className="text-sm text-text-secondary mb-3">{assessment.mbtiCategories.join('、')}</p>
      <div className="flex flex-wrap gap-2">
        {assessment.mbtiCategories.map((cat) => (
          <Tag key={cat} color="blue">{cat}</Tag>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add src/features/assessment/components/MbtiResult.tsx
git commit -m "feat(assessment): add MbtiResult display component"
```

---

### Task 10: AssessmentEntry 整合 MBTI 卡片

**Files:**
- Modify: `src/features/assessment/components/AssessmentEntry.tsx`

- [ ] **Step 1: 在 AssessmentEntry 中新增 MBTI 卡片和整合逻辑**

修改 `src/features/assessment/components/AssessmentEntry.tsx`：

**1a. 新增导入**（第 1-6 行导入区）：

在 `import { loadMajorMapping } from '../services/majorMatcher'` 后新增：

```typescript
import { loadMbtiMapping } from '../services/mbtiMapper'
import MbtiCard from './MbtiCard'
```

**1b. 新增 mbtiMapping state**（在 `const [mapping, setMapping] = useState<Record<string, string[]>>({})` 后）：

```typescript
  const [mapping, setMapping] = useState<Record<string, string[]>>({})
  const [mbtiMapping, setMbtiMapping] = useState<Record<string, { name: string; categories: string[]; description: string }> | null>(null)
```

**1c. 新增 loadMbtiMapping useEffect**（在现有 `useEffect(() => { loadMajorMapping().then(setMapping) }, [])` 后）：

```typescript
  useEffect(() => {
    loadMbtiMapping().then(setMbtiMapping)
  }, [])
```

**1d. 更新 integrateResults 调用**（在 `useEffect` 中，传入 MBTI 参数）：

将：
```typescript
  useEffect(() => {
    if (assessmentResult && subjectAssessmentResult && Object.keys(mapping).length > 0) {
      const integrated = integrateResults(assessmentResult, subjectAssessmentResult, mapping)
      setIntegratedAssessment(integrated)
    }
  }, [assessmentResult, subjectAssessmentResult, mapping, setIntegratedAssessment])
```

替换为：
```typescript
  useEffect(() => {
    if (assessmentResult && subjectAssessmentResult && Object.keys(mapping).length > 0) {
      const integrated = integrateResults(
        assessmentResult,
        subjectAssessmentResult,
        mapping,
        profile.mbtiType,
        mbtiMapping
      )
      setIntegratedAssessment(integrated)
    }
  }, [assessmentResult, subjectAssessmentResult, mapping, profile.mbtiType, mbtiMapping, setIntegratedAssessment])
```

注意：需要从 store 解构 `profile`。在 `const { assessmentResult, ... } = useAppStore()` 中新增 `profile`：

```typescript
  const {
    assessmentResult,
    subjectAssessmentResult,
    integratedAssessment,
    setIntegratedAssessment,
    updateProfile,
    profile,
  } = useAppStore()
```

**1e. 在整合结果卡片中新增 MBTI 信息展示**（在"交叉验证一致的专业大类"区块后，"应用到推荐偏好"按钮前）：

```typescript
          {integratedAssessment.mbtiType && integratedAssessment.mbtiCategories.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-text-secondary mb-2">
                MBTI 人格匹配专业大类（{integratedAssessment.mbtiType}）
              </p>
              <div className="flex flex-wrap gap-2">
                {integratedAssessment.mbtiCategories.map((cat) => (
                  <Tag key={cat} color="blue">{cat}</Tag>
                ))}
              </div>
            </div>
          )}
```

**1f. 新增第三张 MBTI 卡片**（在学科兴趣卡片 `</div>` 后，grid 结束 `</div>` 前）：

将现有的两卡片 grid：
```typescript
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 霍兰德卡片 */}
        ...
        {/* 学科兴趣卡片 */}
        ...
      </div>
```

改为三卡片 grid（`md:grid-cols-2` 改为 `md:grid-cols-3`），并在学科兴趣卡片后新增 MBTI 卡片：

```typescript
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={onSelectHolland}
          className="bg-bg-card rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/30"
        >
          {/* ...霍兰德卡片内容保持不变... */}
        </div>

        <div
          onClick={onSelectSubject}
          className="bg-bg-card rounded-2xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/30"
        >
          {/* ...学科兴趣卡片内容保持不变... */}
        </div>

        <MbtiCard />
      </div>
```

注意：MbtiCard 不需要 onClick（它内部有自己的交互），直接放在 grid 中即可。

- [ ] **Step 2: 验证类型检查通过**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 3: 运行全部测试验证无回归**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run`
Expected: 全部测试 PASS（包括新增的 MBTI 测试和现有测试）

- [ ] **Step 4: 运行 lint 和 build 验证**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npm run lint && npm run build`
Expected: lint 无错误，build 成功

- [ ] **Step 5: Commit**

```bash
git add src/features/assessment/components/AssessmentEntry.tsx
git commit -m "feat(assessment): integrate MbtiCard into AssessmentEntry with 3-card grid layout"
```

---

### Task 11: 最终验证 + 重启服务

**Files:**
- 无文件修改

- [ ] **Step 1: 运行全部测试**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx vitest run`
Expected: 全部测试 PASS

- [ ] **Step 2: 运行 lint**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npm run lint`
Expected: 无错误

- [ ] **Step 3: 运行类型检查和 build**

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx tsc --noEmit && npm run build`
Expected: 通过

- [ ] **Step 4: 重启开发服务**

根据 AGENTS.md 规则"每次改完代码后，都需要重启服务"：

Run: `export PATH="/opt/homebrew/bin:$PATH" && npm run dev`
Expected: Vite 开发服务器启动成功

- [ ] **Step 5: 最终 Commit（如有遗漏的修改）**

```bash
git status
# 如有未提交的修改：
git add -A
git commit -m "chore: final verification for MBTI assessment feature"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ UserProfile 新增 mbtiType → Task 3
- ✅ IntegratedAssessment 新增 mbtiType/mbtiCategories → Task 2 + Task 5
- ✅ MBTI 映射 JSON 16 型 → Task 1
- ✅ mbtiMapper 服务（loadMbtiMapping + getMbtiCategories）→ Task 4
- ✅ MbtiCard 组件（下拉选择 + 外链 + 已选择状态）→ Task 8
- ✅ MbtiResult 组件 → Task 9
- ✅ AssessmentEntry 新增第三张卡片 + 整合 → Task 10
- ✅ recommender 第四级 tiebreaker + 理由标注 → Task 7
- ✅ resultIntegrator 扩展 MBTI 参数 → Task 5
- ✅ 测试策略（mbtiMapper/recommender/resultIntegrator/MbtiCard）→ Task 4/7/5/8
- ✅ 边界情况（未选择/加载失败/修改/无效类型/持久化）→ 各 Task 覆盖

**2. Placeholder scan:**
- 无 TODO/TBD/占位符
- 所有代码块均为完整实现

**3. Type consistency:**
- `MbtiMapping` 接口在 Task 2 定义，Task 4/5/8/10 引用 ✓
- `MbtiMappingRecord` 类型在 Task 2 定义，Task 4/5 引用 ✓
- `mbtiType: string | null` 在 UserProfile/IntegratedAssessment/integrateResults 参数中一致 ✓
- `mbtiCategories: string[]` 在 IntegratedAssessment/integrateResults 返回值中一致 ✓
- `loadMbtiMapping` / `getMbtiCategories` 函数名在 Task 4/6/8/10 中一致 ✓
- `integrateResults` 新增参数使用默认值 `= null`，确保向后兼容 ✓
