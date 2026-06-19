# 学科兴趣测评（FR-04 子功能 4.2 + 4.3）设计

## 背景

FR-04（专业兴趣测评）包含三个子功能：
- 4.1 霍兰德 RIASEC 测评 — 当前部分实现（12 题简化版，简单条形图）
- **4.2 学科兴趣测评** — 完全未实现
- **4.3 测评结果整合** — 完全未实现

本设计实现子功能 4.2（15 题学科兴趣测评）和 4.3（霍兰德与学科兴趣交叉验证 + 推荐联动），同时将现有霍兰德测评代码迁移到 feature-based 目录结构。

## 决策摘要

| 决策项 | 选择 | 理由 |
|---|---|---|
| 实现范围 | 4.2 + 4.3 | 完整实现测评整合，联动推荐引擎 |
| 代码组织 | Feature-based（`src/features/assessment/`） | 符合 technical-design.md 规划，测评功能内聚 |
| Store 结构 | 新增独立字段 | 保持现有 `assessmentResult` 兼容，新增 `subjectAssessmentResult` 和 `integratedAssessment` |
| 题库存储 | JSON 文件 + fetch | 符合 technical-design.md 规划，题库与代码分离 |
| 推荐联动 | 写入 `profile.categories` | Recommender 已读该字段，自动生效 |
| UI 入口 | 双卡片入口 | 符合 ui-design.md 规划，用户选择测评类型 |

## 架构

```
src/features/assessment/
├── components/
│   ├── AssessmentEntry.tsx       # 双卡片入口页 + 整合结果展示
│   ├── HollandAssessment.tsx     # 霍兰德测评（从现有 Assessment.tsx 迁移）
│   ├── SubjectAssessment.tsx     # 学科兴趣测评（新建）
│   ├── HollandResult.tsx         # 霍兰德结果展示（迁移 + 改进为雷达图）
│   └── SubjectResult.tsx         # 学科兴趣结果展示（新建，柱状图）
├── services/
│   ├── hollandEngine.ts          # 霍兰德计分引擎（从现有逻辑提取）
│   ├── subjectEngine.ts          # 学科兴趣计分引擎（新建）
│   ├── majorMatcher.ts           # 专业大类匹配器（新建）
│   └── resultIntegrator.ts       # 结果整合引擎（新建，4.3）
├── types.ts                      # 测评相关类型定义
└── index.ts                      # 模块导出

public/data/assessment/
├── subject_15.json               # 15 题学科兴趣题库
└── subject_major_mapping.json    # 12 条学科-专业大类映射

src/pages/Assessment.tsx          # 改为薄包装，根据视图状态渲染 features/assessment 组件
```

## 详细设计

### 1. 数据层

#### 1.1 题库 `public/data/assessment/subject_15.json`

15 道题，5 级李克特量表（1=完全不喜欢，5=非常喜欢）：

**12 道学科兴趣题**，每题标注一个学科维度：

| 维度 key | 学科方向 | 示例题目 |
|---|---|---|
| math | 数学/逻辑 | "我喜欢用数学方法解决实际问题" |
| physics | 物理/机械 | "我对机械设备的运作原理感到好奇" |
| chemistry | 化学/实验 | "我喜欢做化学实验，观察物质反应" |
| biology | 生物/生命 | "我对生命的奥秘和生物体结构感兴趣" |
| chinese | 语文/写作 | "我喜欢阅读文学作品或进行写作" |
| history | 历史/文化 | "我对历史事件和文明演变感兴趣" |
| geography | 地理/环境 | "我喜欢研究地理环境与气候现象" |
| politics | 政治/社会 | "我关注社会问题和公共政策" |
| foreign_lang | 外语/交流 | "我喜欢学习外语和跨文化交流" |
| art | 艺术/审美 | "我对音乐、绘画或设计有浓厚兴趣" |
| computer | 计算机/技术 | "我喜欢编程或探索计算机技术" |
| economics | 经济/管理 | "我对商业运作和经济规律感兴趣" |

**3 道行为倾向题**，标注 behavior 维度：

| 维度 key | 倾向 | 示例题目 |
|---|---|---|
| theory_practice | 理论/实践 | "我更倾向于学习理论知识而非动手实践" |
| individual_team | 独立/协作 | "我更喜欢独立完成工作而非团队协作" |
| creative_structured | 创造/规范 | "我更喜欢自由创造而非按规范执行" |

每题结构：
```json
{
  "id": 1,
  "text": "我喜欢用数学方法解决实际问题",
  "dimension": "math",
  "type": "subject"
}
```

#### 1.2 学科-专业映射 `public/data/assessment/subject_major_mapping.json`

12 条映射（来自 requirements.md 第 955-968 行）：

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

#### 1.3 Store 扩展

新增两个独立字段，保持现有 `assessmentResult`（霍兰德六维度得分）兼容：

```typescript
interface SubjectAssessmentResult {
  subjectScores: Record<string, number>   // 12 学科维度得分
  behaviorScores: Record<string, number>  // 3 行为倾向得分
  topSubjects: string[]                    // 前 3 高分学科 key
  recommendedCategories: string[]          // 推荐专业大类
  timestamp: number
}

interface IntegratedAssessment {
  hollandCode: string                      // 霍兰德 3 字母代码
  topSubjects: string[]                    // 学科兴趣前 3
  agreedCategories: string[]               // 交叉验证一致的专业大类
  confidence: 'high' | 'medium' | 'low'    // 置信度
  timestamp: number
}

// AppState 新增：
subjectAssessmentResult: SubjectAssessmentResult | null
integratedAssessment: IntegratedAssessment | null
setSubjectAssessmentResult: (r: SubjectAssessmentResult | null) => void
setIntegratedAssessment: (r: IntegratedAssessment | null) => void
```

所有新字段纳入 zustand persist，自动持久化到 localStorage。

### 2. Service 层

#### 2.1 hollandEngine.ts（从现有 Assessment.tsx 提取）

```typescript
export function calculateHolland(answers: Record<number, number>): {
  scores: Record<'R' | 'I' | 'A' | 'S' | 'E' | 'C', number>
  code: string  // 3 字母代码，如 "RIA"
}
```

逻辑：按 dimension（R/I/A/S/E/C）聚合每题得分，排序取前 3 组成代码。

#### 2.2 subjectEngine.ts（新建）

```typescript
export function calculateSubjectScores(answers: Record<number, number>): {
  subjectScores: Record<string, number>   // 12 维度得分
  behaviorScores: Record<string, number>  // 3 行为倾向得分
  topSubjects: string[]                    // 前 3 高分学科 key
}
```

逻辑：
1. 读取 `subject_15.json` 题库
2. 按 dimension 聚合每题得分（1-5）
3. 12 学科维度按得分降序排序，取前 3
4. 全部同分时取前 3（按 dimension 字母序）

#### 2.3 majorMatcher.ts（新建）

```typescript
export function matchMajors(topSubjects: string[]): string[]
```

逻辑：读取 `subject_major_mapping.json`，取 topSubjects 对应的专业大类列表的并集（去重）。

#### 2.4 resultIntegrator.ts（新建，4.3 核心）

```typescript
export function integrateResults(
  hollandScores: Record<string, number>,
  subjectResult: SubjectAssessmentResult
): IntegratedAssessment
```

逻辑：
1. 从 hollandScores 排序取前 3 组成 hollandCode
2. 霍兰德代码 → 学科门类映射（内置常量）：
   - R（现实型）→ physics, computer
   - I（研究型）→ math, biology, chemistry, computer
   - A（艺术型）→ art, chinese
   - S（社会型）→ politics, chinese
   - E（企业型）→ economics, foreign_lang
   - C（常规型）→ computer, economics
3. 霍兰德映射的学科门类对应的推荐专业大类 ∩ 学科兴趣 topSubjects 的推荐专业大类 = `agreedCategories`
4. 置信度：`agreedCategories.length >= 3` = high，`1-2` = medium，`0` = low

### 3. UI 层

#### 3.1 AssessmentEntry.tsx（双卡片入口）

- 两个大卡片：霍兰德测评 / 学科兴趣测评
- 每个卡片显示：标题、简述、完成状态（已完成✓ / 未完成）、"开始/重新测评"按钮
- 当两种测评都完成时，顶部显示整合结果卡片：
  - 霍兰德代码（如 "RIA"）
  - 学科兴趣 top3（如 "数学、计算机、物理"）
  - 一致专业大类（Tag 标签列表）
  - 置信度徽章（high=绿色/medium=黄色/low=灰色）
  - "应用到推荐偏好"按钮 → `updateProfile({ categories: agreedCategories })` + toast "已应用到推荐偏好"

#### 3.2 HollandAssessment.tsx（迁移现有霍兰德测评）

- 介绍页 → 答题页（12 题）→ 结果页
- 结果展示改用 ECharts 雷达图（替代现有简单条形图）
- 计分逻辑调用 `hollandEngine.calculateHolland`
- 结果写入 `setAssessmentResult(scores)`

#### 3.3 SubjectAssessment.tsx（新建学科兴趣测评）

- 介绍页：说明 15 题、约 3 分钟、5 级评分
- 答题页：15 题滚动列表，每题 5 级 Radio.Group（完全不喜欢→非常喜欢）
- 进度条显示当前进度（第 x/15 题）
- 提交后调用 `subjectEngine.calculateSubjectScores` + `majorMatcher.matchMajors`
- 结果写入 `setSubjectAssessmentResult`
- 跳转结果页

#### 3.4 SubjectResult.tsx（新建学科兴趣结果）

- ECharts 柱状图展示 12 学科维度得分
- 前 3 高分学科高亮显示（不同颜色）
- 推荐专业大类列表（Tag 标签）
- 行为倾向简要描述（理论/实践、独立/协作、创造/规范）
- "返回测评入口"按钮

#### 3.5 HollandResult.tsx（迁移 + 改进）

- ECharts 雷达图展示六维度得分
- 霍兰德代码显示
- "返回测评入口"按钮

### 4. Assessment.tsx 改造

`src/pages/Assessment.tsx` 变为薄包装：
- 管理视图状态：`'entry' | 'holland' | 'subject'`
- 根据状态渲染对应组件
- 从 store 读取测评结果，传给 AssessmentEntry 判断完成状态

### 5. 整合联动流程（4.3）

1. 用户完成霍兰德测评 → `setAssessmentResult(hollandScores)`
2. 用户完成学科兴趣测评 → `setSubjectAssessmentResult(subjectResult)`
3. 两种结果都存在时，AssessmentEntry 调用 `resultIntegrator.integrateResults` → `setIntegratedAssessment`
4. 用户点击"应用到推荐偏好" → `updateProfile({ categories: integratedAssessment.agreedCategories })` + toast
5. Recommender 已读 `profile.categories`，下次推荐自动应用专业大类筛选

### 6. 错误处理

| 错误场景 | 处理方式 |
|---|---|
| 题库 JSON 加载失败 | 回退到 mock.ts 中的备用题库（需新增 subjectQuestions） |
| 测评中途切换 | 确认对话框"确定要离开吗？未完成的测评将不保存" |
| 整合时缺少一方结果 | 不显示整合卡片，提示"完成两种测评后查看整合结果" |
| 题目未答完 | 禁用提交按钮，提示"请完成所有题目" |

### 7. 测试策略

项目使用 vitest，测试分两层：

#### Service 层单元测试

- `hollandEngine.test.ts`：计分正确性、代码生成、边界（全同分）
- `subjectEngine.test.ts`：计分正确性、top3 排序、边界（全同分、空答案）
- `majorMatcher.test.ts`：映射正确性、多学科并集、去重
- `resultIntegrator.test.ts`：交叉验证逻辑、置信度判定（high/medium/low）、边界

#### 组件测试

- AssessmentEntry：双卡片渲染、完成状态、整合卡片显示条件
- SubjectAssessment：答题流、提交逻辑
- SubjectResult：柱状图渲染、推荐专业展示

## 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/features/assessment/types.ts` | 新建 | 类型定义 |
| `src/features/assessment/index.ts` | 新建 | 模块导出 |
| `src/features/assessment/services/hollandEngine.ts` | 新建 | 霍兰德计分（从 Assessment.tsx 提取） |
| `src/features/assessment/services/subjectEngine.ts` | 新建 | 学科兴趣计分 |
| `src/features/assessment/services/majorMatcher.ts` | 新建 | 专业大类匹配 |
| `src/features/assessment/services/resultIntegrator.ts` | 新建 | 结果整合 |
| `src/features/assessment/components/AssessmentEntry.tsx` | 新建 | 双卡片入口 |
| `src/features/assessment/components/HollandAssessment.tsx` | 新建 | 霍兰德测评（迁移） |
| `src/features/assessment/components/SubjectAssessment.tsx` | 新建 | 学科兴趣测评 |
| `src/features/assessment/components/HollandResult.tsx` | 新建 | 霍兰德结果（迁移+改进） |
| `src/features/assessment/components/SubjectResult.tsx` | 新建 | 学科兴趣结果 |
| `src/pages/Assessment.tsx` | 修改 | 改为薄包装 |
| `src/store/index.ts` | 修改 | 新增 subjectAssessmentResult、integratedAssessment |
| `src/data/mock.ts` | 修改 | 新增 subjectQuestions 备用题库 |
| `public/data/assessment/subject_15.json` | 新建 | 15 题题库 |
| `public/data/assessment/subject_major_mapping.json` | 新建 | 学科-专业映射 |
| `src/features/assessment/services/*.test.ts` | 新建 | Service 层测试 |
| `src/features/assessment/components/*.test.tsx` | 新建 | 组件测试 |

## 不在范围内

- 不扩展霍兰德题库到 60 题（保持现有 12 题）
- 不修改 recommender.ts（已读 profile.categories，无需改动）
- 不修改 Profile.tsx（用户通过测评入口的"应用到偏好"按钮写入）
- 不新增后端服务
