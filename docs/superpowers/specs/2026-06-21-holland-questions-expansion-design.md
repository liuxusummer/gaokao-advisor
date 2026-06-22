# 霍兰德题量扩充设计

**日期**：2026-06-21
**关联 PRD**：`docs/requirements.md` 11.1（霍兰德 RIASEC 测评）
**状态**：已批准，待实现

## 1. 背景与目标

PRD 11.1 要求霍兰德测评 60 题（每维度 10 题），当前 `src/data/mock.ts` 仅 12 题（每维度 2 题），题量仅为需求的 1/5，影响测评信度。

**目标**：
1. 新建 `public/data/assessment/holland_60.json` 完整 60 题题库
2. 新建 `src/services/hollandQuestions.ts` 加载服务（fetch + fallback）
3. 修改 `HollandAssessment.tsx` 改用异步加载
4. 计分引擎 `hollandEngine.ts` 无需改动（已按 dimension 聚合）

## 2. 范围

**包含**：
- 60 题完整题库 JSON 文件
- 题库加载服务（fetch + fallback）
- HollandAssessment 组件异步加载改造
- 加载服务单元测试
- 计分引擎 60 题场景测试

**不包含**：
- 测评结果与推荐联动（改进点 2，后续独立 spec）
- 霍兰德测评 UI 重设计（保持现有单题滚动答题模式）
- `hollandEngine.ts` 计分逻辑改动

## 3. 霍兰德 RIASEC 维度定义

| 维度 | 代码 | 名称 | 核心特征 |
|------|------|------|---------|
| R | Realistic | 现实型 | 操作机械、工具、动手制作、户外活动、修理设备 |
| I | Investigative | 研究型 | 科学研究、数据分析、逻辑推理、探索发现、实验观察 |
| A | Artistic | 艺术型 | 艺术创作、设计、音乐、文学写作、创意表达 |
| S | Social | 社会型 | 帮助他人、教育辅导、沟通协作、社区服务、关怀照顾 |
| E | Enterprising | 企业型 | 领导管理、说服影响、商业创业、组织策划、竞争谈判 |
| C | Conventional | 常规型 | 数据整理、文档管理、按规则办事、细节核对、行政事务 |

## 4. 架构

```
新增文件：
  public/data/assessment/holland_60.json          # 60 题完整题库
  src/services/hollandQuestions.ts                 # 题库加载服务
  src/services/hollandQuestions.test.ts            # 加载服务测试

修改文件：
  src/features/assessment/components/HollandAssessment.tsx  # 改用异步加载
  src/features/assessment/services/hollandEngine.test.ts     # 补充 60 题场景测试
```

**不修改**：
- `src/data/mock.ts` — 保留 12 题作为 fallback
- `src/features/assessment/services/hollandEngine.ts` — 计分逻辑不变
- `src/features/assessment/types.ts` — 类型不变

## 5. holland_60.json 数据结构

```json
[
  { "id": 1, "text": "我喜欢修理机械或电子设备", "dimension": "R" },
  { "id": 2, "text": "我喜欢动手做实验或制作东西", "dimension": "R" },
  ...
  { "id": 60, "text": "...", "dimension": "C" }
]
```

**维度分布**（每维度 10 题）：
- R（现实型）：id 1-10
- I（研究型）：id 11-20
- A（艺术型）：id 21-30
- S（社会型）：id 31-40
- E（企业型）：id 41-50
- C（常规型）：id 51-60

每题字段：
- `id`: number — 题目编号（1-60）
- `text`: string — 题目文本（第一人称陈述句）
- `dimension`: string — 霍兰德维度（"R" | "I" | "A" | "S" | "E" | "C"）

## 6. hollandQuestions.ts 加载服务

### 6.1 类型定义

```typescript
export interface HollandQuestion {
  id: number
  text: string
  dimension: string
}
```

### 6.2 公共 API

```typescript
const QUESTION_URL = '/data/assessment/holland_60.json'
let cachedQuestions: HollandQuestion[] | null = null

/**
 * 加载霍兰德题库（60 题）
 * fetch 失败时降级到 mock.ts 的 12 题
 */
export async function loadHollandQuestions(): Promise<HollandQuestion[]>
```

### 6.3 加载逻辑

1. 若 `cachedQuestions` 非空，直接返回（内存缓存）
2. `fetch(QUESTION_URL)`，解析 JSON
3. 校验：
   - 是数组
   - 长度 >= 12（至少有 fallback 题量）
   - 每项有 `id`（number）、`text`（string）、`dimension`（string）字段
4. 校验通过：缓存并返回
5. fetch 或校验失败：返回 `fallbackQuestions`（从 `mock.ts` 导入的 12 题）

### 6.4 fallback 来源

```typescript
import { hollandQuestions as fallbackQuestions } from '../data/mock'
```

mock.ts 的 `hollandQuestions` 保留不删除，作为 fetch 失败时的降级数据。

## 7. HollandAssessment.tsx 改造

### 7.1 当前实现

```typescript
import { hollandQuestions } from '../../data/mock'
// 直接使用 hollandQuestions 渲染题目
```

### 7.2 改造后

```typescript
import { useState, useEffect } from 'react'
import { hollandQuestions as fallbackQuestions } from '../../data/mock'
import { loadHollandQuestions } from '../../services/hollandQuestions'

// 组件内
const [questions, setQuestions] = useState(fallbackQuestions)
const [loading, setLoading] = useState(true)

useEffect(() => {
  loadHollandQuestions().then((qs) => {
    setQuestions(qs)
    setLoading(false)
  })
}, [])

// 渲染
if (loading) return <Spin />
// 其余逻辑不变，用 questions 替代原 hollandQuestions
```

### 7.3 不变的部分

- 单题滚动答题模式
- 5 级李克特量表 options
- 完成时调用 `calculateHolland(answers)`
- 结果写入 `setAssessmentResult(result.scores)`

## 8. 计分引擎兼容性

`hollandEngine.ts` 的 `calculateHolland` 已按 dimension 聚合：

```typescript
hollandQuestions.forEach((q) => {
  const dim = q.dimension as HollandDimension
  scores[dim] += answers[q.id] || 0
})
```

**注意**：`calculateHolland` 当前直接 import `hollandQuestions` from `mock.ts`。这意味着即使用户做了 60 题，计分引擎仍只看 mock.ts 的 12 题。

**需要修改**：`calculateHolland` 接受第二个参数 `questions`，默认值为 `hollandQuestions`（mock.ts）：

```typescript
export function calculateHolland(
  answers: Record<number, number>,
  questions: HollandQuestion[] = hollandQuestions
): HollandResult
```

`HollandAssessment.tsx` 调用时传入加载的 60 题：

```typescript
const result = calculateHolland(answers, questions)
```

## 9. 测试策略

### 9.1 hollandQuestions.test.ts（加载服务）

- **正常加载**：mock fetch 返回 60 题，验证返回长度 60 和结构
- **fetch 失败**：mock fetch reject，验证返回 fallback 12 题
- **JSON 校验失败**：mock fetch 返回无效数据（非数组/缺字段），验证返回 fallback
- **内存缓存**：第二次调用不 fetch

### 9.2 hollandEngine.test.ts 补充

- **60 题计分**：构造 60 题答案（每维度 10 题，每题 5 分），验证维度得分最大 50
- **霍兰德代码正确性**：构造特定得分分布（如 R 最高、I 次之、A 第三），验证代码为 "RIA"
- **传入自定义 questions**：验证 `calculateHolland(answers, customQuestions)` 使用传入题目而非默认

### 9.3 HollandAssessment.test.tsx（如存在）

- 加载中显示 Spin
- 加载完成显示题目

## 10. 验收标准

- [ ] `public/data/assessment/holland_60.json` 包含 60 题，每维度 10 题
- [ ] `loadHollandQuestions()` 正常加载 60 题
- [ ] fetch 失败时降级到 12 题
- [ ] HollandAssessment 组件异步加载题目，加载中显示 Spin
- [ ] `calculateHolland` 支持传入自定义 questions 参数
- [ ] 60 题计分结果正确（维度得分、霍兰德代码）
- [ ] 加载服务单元测试通过
- [ ] 计分引擎 60 题场景测试通过
- [ ] lint / tsc clean
