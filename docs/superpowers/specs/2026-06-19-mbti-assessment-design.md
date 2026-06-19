# MBTI 人格测评（可选）设计

## 背景

FR-04（专业兴趣测评）已实现霍兰德 RIASEC 测评 + 学科兴趣测评 + 交叉验证整合。用户希望在此基础上新增**可选 MBTI 人格测评**：

- 用户可以选择/填入自己的 MBTI 人格类型
- MBTI 作为推荐考虑因素纳入推荐引擎
- 如果用户不知道自己的 MBTI，提供外链跳转到测评网站

MBTI 为**可选**维度，不影响现有霍兰德 + 学科兴趣测评流程，未选择时推荐引擎按原逻辑运行。

## 决策摘要

| 决策项 | 选择 | 理由 |
|---|---|---|
| 入口位置 | 测评页新增第三张卡片 | 与霍兰德、学科兴趣并列，测评集中管理 |
| 推荐影响 | 排序 tiebreaker（第四级） | 保留全部候选，同分时 MBTI 匹配优先，不过度过滤 |
| 选择 UI | 下拉选择 + 外链 | 简单直接，用户预知类型即可选择，未知可跳转测评 |
| 映射粒度 | 16 型全量映射 | 精准个性化，每型独立映射专业大类 |
| 实现范围 | 核心 + 结果展示（方案 B） | 用户体验完整，与现有测评模块风格统一 |
| 外链目标 | 16personalities.com 中文版 | 最知名的免费 MBTI 测评站点，支持中文 |

## 架构

```
src/features/assessment/
├── components/
│   ├── AssessmentEntry.tsx       # 修改：新增第三张 MBTI 卡片
│   ├── MbtiCard.tsx              # 新增：MBTI 入口卡片（下拉选择 + 外链）
│   └── MbtiResult.tsx            # 新增：MBTI 结果展示
├── services/
│   └── mbtiMapper.ts             # 新增：MBTI 映射加载与查询
├── types.ts                      # 修改：IntegratedAssessment 新增 MBTI 字段
└── index.ts                      # 修改：导出新组件和服务

public/data/assessment/
└── mbti_category_mapping.json    # 新增：16 型人格 → 专业大类映射

src/store/index.ts                # 修改：UserProfile 新增 mbtiType 字段
src/services/recommender.ts       # 修改：新增 MBTI 权重加分逻辑
```

## 详细设计

### 1. 数据层

#### 1.1 UserProfile 新增字段

```typescript
// src/store/index.ts
export interface UserProfile {
  // ...现有字段保持不变...
  mbtiType: string | null  // 16 型人格代码，如 'INTJ'；未选择为 null
}
```

`defaultProfile` 新增 `mbtiType: null`。

#### 1.2 IntegratedAssessment 新增字段

```typescript
// src/features/assessment/types.ts
export interface IntegratedAssessment {
  hollandCode: string
  topSubjects: string[]
  agreedCategories: string[]
  confidence: ConfidenceLevel
  mbtiType: string | null      // 新增：用户选择的 MBTI 类型
  mbtiCategories: string[]     // 新增：MBTI 映射的专业大类列表
  timestamp: number
}
```

#### 1.3 MBTI 映射数据 `public/data/assessment/mbti_category_mapping.json`

16 型人格映射到项目使用的 12 个专业大类（哲学、经济学、法学、教育学、文学、历史学、理学、工学、农学、医学、管理学、艺术学）。每型映射 3 个最匹配的专业大类。

**NT 分析家**（理性、战略、逻辑）：

| 类型 | 名称 | 映射专业大类 |
|---|---|---|
| INTJ | 建筑师 | 工学, 理学, 经济学 |
| INTP | 逻辑学家 | 理学, 工学, 哲学 |
| ENTJ | 指挥官 | 经济学, 管理学, 法学 |
| ENTP | 辩论家 | 法学, 经济学, 文学 |

**NF 外交家**（理想、共情、人文）：

| 类型 | 名称 | 映射专业大类 |
|---|---|---|
| INFJ | 提倡者 | 文学, 哲学, 教育学 |
| INFP | 调停者 | 文学, 艺术学, 教育学 |
| ENFJ | 主人公 | 教育学, 文学, 管理学 |
| ENFP | 竞选者 | 艺术学, 文学, 教育学 |

**SJ 守护者**（稳定、秩序、实用）：

| 类型 | 名称 | 映射专业大类 |
|---|---|---|
| ISTJ | 物流师 | 工学, 管理学, 医学 |
| ISFJ | 守卫者 | 医学, 教育学, 管理学 |
| ESTJ | 总经理 | 管理学, 经济学, 法学 |
| ESFJ | 执政官 | 教育学, 医学, 管理学 |

**SP 探险家**（实践、灵活、动手）：

| 类型 | 名称 | 映射专业大类 |
|---|---|---|
| ISTP | 鉴赏家 | 工学, 理学, 农学 |
| ISFP | 探险家 | 艺术学, 文学, 农学 |
| ESTP | 企业家 | 经济学, 管理学, 工学 |
| ESFP | 表演者 | 艺术学, 教育学, 文学 |

JSON 结构示例：

```json
{
  "INTJ": {
    "name": "建筑师",
    "categories": ["工学", "理学", "经济学"],
    "description": "富有想象力又有战略思维的人，凡事都有计划"
  },
  "INTP": {
    "name": "逻辑学家",
    "categories": ["理学", "工学", "哲学"],
    "description": "对知识有着永不满足的渴望，喜欢逻辑分析"
  }
}
```

每型包含 `name`（中文名称）、`categories`（映射专业大类数组）、`description`（简短人格描述，1 句话）。

### 2. 服务层

#### 2.1 `src/features/assessment/services/mbtiMapper.ts`

```typescript
export interface MbtiMapping {
  name: string
  categories: string[]
  description: string
}

// 加载 MBTI 映射 JSON，失败返回 null
export async function loadMbtiMapping(): Promise<Record<string, MbtiMapping> | null>

// 查询指定 MBTI 类型的映射，无效类型返回 null
export function getMbtiCategories(
  mbtiType: string | null,
  mapping: Record<string, MbtiMapping> | null
): string[]
```

- `loadMbtiMapping`：fetch `/data/assessment/mbti_category_mapping.json`，失败时返回 null（与 subjectEngine 错误处理一致）
- `getMbtiCategories`：纯函数，根据 mbtiType 查询映射，返回专业大类数组；mbtiType 为 null 或 mapping 为 null 或类型不存在时返回空数组

### 3. UI 组件

#### 3.1 `MbtiCard.tsx`（入口卡片）

作为 AssessmentEntry 的第三张卡片，与霍兰德、学科兴趣并列。

**未选择状态**：
- 标题："MBTI 人格测评"
- 说明文字："选择你的 MBTI 人格类型，优化专业推荐"
- Ant Design `Select` 下拉选择器：16 型人格选项，格式 `INTJ - 建筑师`
- 外链文字："不知道自己的人格？点击测评 →"，点击在新标签页打开 `https://www.16personalities.com/chinese-personality-test`（16personalities 中文版免费测评）

**已选择状态**：
- 显示当前 MBTI 类型代码 + 名称（如 "INTJ 建筑师"）
- 显示人格简述（description）
- 显示匹配的专业大类（Tag 列表）
- "修改"按钮：切换回下拉选择状态

**交互逻辑**：
- 用户选择 MBTI 类型后，立即写入 `store.updateProfile({ mbtiType })`
- 触发 AssessmentEntry 的 useEffect 重新调用 integrateResults

#### 3.2 `MbtiResult.tsx`（结果展示）

与 HollandResult、SubjectResult 风格一致的结果卡片：

- 人格类型代码 + 名称（大字突出）
- 人格简述
- 匹配专业大类 Tag 列表
- 无 ECharts 图表（MBTI 为单值，无需可视化图表）

#### 3.3 AssessmentEntry 改造

- 新增第三张 MBTI 卡片（MbtiCard）
- 整合结果卡片区域新增 MBTI 信息（若已选择）
- useEffect 依赖新增 `profile.mbtiType` 和 `mbtiMapping`，变化时重新调用 integrateResults
- integrateResults 调用时传入 mbtiType 参数

### 4. 推荐引擎整合

#### 4.1 `recommender.ts` 排序 tiebreaker 整合

当前推荐引擎使用多级排序：`tier`（冲/稳/保）→ `probability`（录取概率）→ `levelWeight`（院校层次 985/211/双一流）。MBTI 作为**第四级 tiebreaker** 加入排序，并在推荐理由中标注匹配。

**排序整合**（在 `candidates.sort` 中新增第四级）：

```typescript
// 推荐函数开头加载 MBTI 映射（一次加载，循环外复用）
const mbtiMapping = profile.mbtiType ? await loadMbtiMapping() : null
const mbtiCategories = mbtiMapping?.[profile.mbtiType]?.categories ?? []
const mbtiMatch = (category: string) => mbtiCategories.includes(category) ? 1 : 0

// 排序阶段（现有三级 + 新增第四级 MBTI tiebreaker）
candidates.sort((a, b) => {
  if (a.tier !== b.tier) {
    const order = { rush: 0, stable: 1, safe: 2 }
    return order[a.tier] - order[b.tier]
  }
  if (b.probability !== a.probability) return b.probability - a.probability
  if (levelWeight(b.college) !== levelWeight(a.college)) {
    return levelWeight(b.college) - levelWeight(a.college)
  }
  // 新增：MBTI 匹配的专业优先排在前面
  return mbtiMatch(b.major.category) - mbtiMatch(a.major.category)
})
```

**推荐理由整合**（在 reasonParts 中新增）：

```typescript
if (mbtiCategories.includes(major.category)) {
  reasonParts.push(`与你的 MBTI 人格(${profile.mbtiType})匹配`)
}
```

**设计要点**：
- MBTI 作为第四级 tiebreaker：仅在 tier、probability、levelWeight 都相同时才起作用，不影响核心录取概率排序
- MBTI 仅影响排序，**不作为硬过滤条件**：即使专业不在 MBTI 映射中，仍会出现在推荐列表
- 若用户未选择 MBTI（`mbtiType === null`），`mbtiCategories` 为空数组，`mbtiMatch` 恒返回 0，排序退化为现有三级，推荐结果与当前完全一致
- 映射加载失败时（`loadMbtiMapping` 返回 null），`mbtiCategories` 为空数组，同上退化

**性能考虑**：
- `loadMbtiMapping` 在推荐函数开头调用一次，结果复用于所有专业的排序比较
- `mbtiMatch` 为 O(1) 查找（`Array.includes` 在 3 元素数组上），不影响排序性能

#### 4.2 `resultIntegrator.ts` 整合

`integrateResults` 函数签名扩展：

```typescript
export function integrateResults(
  hollandResult: HollandResult | null,
  subjectResult: SubjectAssessmentResult | null,
  majorMapping: SubjectMajorMapping | null,
  mbtiType: string | null,                                    // 新增
  mbtiMapping: Record<string, MbtiMapping> | null             // 新增
): IntegratedAssessment
```

- 接收 mbtiType 和 mbtiMapping 参数
- 查询 MBTI 映射获取 mbtiCategories
- 写入 IntegratedAssessment.mbtiType 和 mbtiCategories
- **置信度计算不变**：MBTI 为可选维度，不影响霍兰德 + 学科兴趣的置信度（high ≥ 3 交集 / medium 1-2 / low 0）

### 5. Store 改造

`src/store/index.ts`：

- `UserProfile` 接口新增 `mbtiType: string | null`
- `defaultProfile` 新增 `mbtiType: null`
- 无需新增 store action：复用现有 `updateProfile` 即可写入 mbtiType

### 6. 测试策略

#### 6.1 `mbtiMapper.test.ts`

- `loadMbtiMapping` 成功加载返回完整映射对象
- `loadMbtiMapping` fetch 失败返回 null
- `getMbtiCategories` 有效类型返回对应专业大类数组
- `getMbtiCategories` 无效类型返回空数组
- `getMbtiCategories` mbtiType 为 null 返回空数组
- `getMbtiCategories` mapping 为 null 返回空数组

#### 6.2 `recommender.test.ts`（扩展）

- 用户已选择 MBTI 时，同 tier/probability/levelWeight 的候选中，MBTI 匹配的专业排在前面
- 用户未选择 MBTI（null）时，推荐排序结果与无 MBTI 逻辑一致
- MBTI 映射加载失败时，推荐正常返回（排序退化为三级）
- MBTI 匹配的专业推荐理由包含"与你的 MBTI 人格匹配"

#### 6.3 `resultIntegrator.test.ts`（扩展）

- 传入 mbtiType 和 mbtiMapping 时，IntegratedAssessment 正确写入 mbtiType 和 mbtiCategories
- mbtiType 为 null 时，mbtiCategories 为空数组
- 置信度计算不受 MBTI 影响

#### 6.4 `MbtiCard.test.tsx`

- 未选择状态渲染下拉选择器和外链
- 已选择状态渲染类型名称、描述、匹配专业大类 Tag
- 选择下拉项后调用 updateProfile
- 外链 href 指向 16personalities.com

## 边界情况

1. **用户未选择 MBTI**：推荐引擎排序退化为三级（无 MBTI tiebreaker），IntegratedAssessment 中 mbtiType 为 null、mbtiCategories 为空数组
2. **MBTI 映射加载失败**：mbtiMapper 返回 null，推荐引擎排序退化为三级（无 MBTI tiebreaker），MbtiCard 显示已选类型但匹配专业大类为空
3. **用户选择后修改**：MbtiCard 支持切换回下拉选择状态，重新选择后更新 store
4. **MBTI 类型不在映射中**：getMbtiCategories 返回空数组，不影响推荐
5. **持久化**：mbtiType 通过 Zustand persist 自动持久化到 localStorage，刷新不丢失

## 非目标

- 不实现 MBTI 测评问卷（用户通过外链到 16personalities 完成测评）
- 不修改推荐结果数据结构（不新增 mbtiMatch 标记字段，方案 C 留待后续迭代）
- 不在 Profile 向导中加入 MBTI 选择（入口仅在测评页）
- 不为 MBTI 设计 ECharts 可视化图表（单值无需图表）
