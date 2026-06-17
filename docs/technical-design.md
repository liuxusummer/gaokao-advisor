# 智填志愿 — AI 高考志愿填报助手 技术方案文档

> **版本**：v1.0
> **日期**：2026-06-17
> **状态**：待评审
> **文档类型**：技术设计文档（TDD）
> **关联文档**：[requirements.md](./requirements.md)

---

## 目录

1. [技术栈总览](#1-技术栈总览)
2. [项目目录结构](#2-项目目录结构)
3. [模块依赖关系与交互机制](#3-模块依赖关系与交互机制)
4. [推荐引擎模块设计](#4-推荐引擎模块设计)
5. [风险预警模块设计](#5-风险预警模块设计)
6. [兴趣测评模块设计](#6-兴趣测评模块设计)
7. [AI 对话模块设计](#7-ai-对话模块设计)
8. [数据层设计](#8-数据层设计)
9. [其余模块设计](#9-其余模块设计)
10. [性能优化策略](#10-性能优化策略)
11. [测试策略](#11-测试策略)
12. [部署与 CICD](#12-部署与-cicd)
13. [开发规范](#13-开发规范)
14. [扩展性设计](#14-扩展性设计)
15. [附录](#15-附录)

---

## 1. 技术栈总览

### 1.1 技术选型

| 类别 | 选型 | 版本 | 说明 |
|------|------|------|------|
| **框架** | React + TypeScript | 18.x / 5.x | 生态成熟，类型安全 |
| **构建** | Vite | 5.x | 快速构建，热更新 |
| **路由** | React Router | v6 | 嵌套路由 + 懒加载 |
| **UI 组件** | Ant Design（优先）+ shadcn/ui（备选）+ 自定义 | 5.x | 以美观为前提，不锁死组件库 |
| **样式** | Tailwind CSS | 3.x | 原子化样式，快速定制 |
| **动画** | Framer Motion | 11.x | 页面过渡、交互反馈 |
| **状态管理** | Zustand | 5.x | 轻量级，支持持久化中间件 |
| **数据存储** | Dexie.js（IndexedDB）+ localStorage | 4.x | 分层存储 |
| **图表** | ECharts + 自定义主题 | 5.x | 视觉上限高，可定制 |
| **LLM 集成** | OpenAI 兼容格式（Fetch API） | — | 用户填 Base URL + Key + Model |
| **联网搜索** | LLM 内置联网工具 | — | 依赖 GLM/通义等厂商能力 |
| **测试** | Vitest + React Testing Library + Playwright | latest | 完整测试金字塔 |
| **部署** | GitHub Pages + GitHub Actions | — | 零成本静态托管 |
| **代码质量** | ESLint + Prettier + Husky | latest | 规范 + 提交前检查 |

### 1.2 关键设计决策

1. **UI 美观 P0**：优先用 AntD，任何组件若默认样式不够美观，替换为 shadcn/ui 或自定义组件 + Tailwind 精调
2. **数据全部打包**：通过路由懒加载 + 数据分片加载优化首屏（首屏仅加载首页 + 公共数据，省份数据按需加载到内存）
3. **LLM 可选**：未配置 LLM 时，所有核心功能（推荐/测评/风险预警/数据中心）完整可用
4. **模块解耦**：Feature-based + 共享层，模块间通过 Store 订阅通信，不直接依赖
5. **高扩展性**：核心服务面向接口编程，插件化注册（检测器/引擎/导出器/策略）
6. **不过度设计**：v1.0 实现核心功能，扩展点预留但不实现，避免引入不必要的复杂度

---

## 2. 项目目录结构

采用 **Feature-based + 共享层** 结构：

```
volunteer-assistant/
├── public/
│   └── data/                          # 静态数据 JSON（随应用打包）
│       ├── common/                    # 公共数据
│       │   ├── colleges.json          # 全国院校基础信息
│       │   ├── majors.json            # 专业目录（13门类92类883专业）
│       │   ├── holland_mapping.json   # 霍兰德代码-专业映射
│       │   ├── physical_exam.json     # 体检受限规则
│       │   └── provinces.json         # 省份配置（志愿模式/数量等）
│       ├── scores/                    # 历年录取分数（按省份）
│       │   ├── zhejiang/
│       │   │   ├── 2022.json
│       │   │   ├── 2023.json
│       │   │   └── ...
│       │   └── ...
│       ├── rank_tables/               # 一分一段表（按省份）
│       │   └── by_province/
│       ├── policies/                  # 各省政策规则
│       │   └── by_province/
│       └── assessment/                # 测评题目
│           ├── holland_60.json
│           └── subject_15.json
├── src/
│   ├── app/                           # 应用入口与全局配置
│   │   ├── App.tsx                    # 根组件 + 路由
│   │   ├── router.tsx                 # 路由配置
│   │   └── providers.tsx              # 全局 Provider（AntD ConfigProvider 等）
│   ├── features/                      # 功能模块（Feature-based）
│   │   ├── profile/                   # 用户画像模块
│   │   │   ├── components/            # 模块内组件
│   │   │   ├── hooks/                 # 模块内 hooks
│   │   │   ├── services/              # 模块内业务逻辑
│   │   │   ├── store.ts               # 模块内状态（Zustand）
│   │   │   ├── types.ts               # 模块内类型
│   │   │   └── index.ts               # 模块导出
│   │   ├── recommendation/            # 推荐引擎模块
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   │   ├── rankConverter.ts   # 等效位次换算
│   │   │   │   ├── probabilityCalc.ts # 录取概率计算
│   │   │   │   ├── gradientDivider.ts # 冲稳保梯度划分
│   │   │   │   ├── multiSorter.ts     # 多维度排序
│   │   │   │   └── recommender.ts     # 推荐引擎入口
│   │   │   ├── store.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── assessment/                # 兴趣测评模块
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   │   ├── hollandEngine.ts   # 霍兰德计分引擎
│   │   │   │   ├── subjectEngine.ts   # 学科兴趣计分引擎
│   │   │   │   └── majorMatcher.ts    # 专业匹配器
│   │   │   ├── store.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── risk-warning/              # 风险预警模块
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   │   ├── slideDetector.ts   # 滑档风险检测
│   │   │   │   ├── rejectDetector.ts  # 退档风险检测
│   │   │   │   ├── physicalChecker.ts # 体检受限检查
│   │   │   │   └── reportGenerator.ts # 风险报告生成
│   │   │   ├── store.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── volunteer-list/            # 志愿表管理模块
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   │   ├── listManager.ts     # 志愿表增删改查
│   │   │   │   └── exporter.ts        # 导出（PDF/Excel/图片）
│   │   │   ├── store.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── ai-chat/                   # AI 对话模块
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   │   ├── llmClient.ts       # LLM API 客户端
│   │   │   │   ├── promptBuilder.ts   # Prompt 构建
│   │   │   │   └── citationParser.ts  # 引用解析
│   │   │   ├── store.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── data-center/               # 数据中心模块
│   │       ├── components/
│   │       ├── services/
│   │       │   ├── collegeQuery.ts    # 院校查询
│   │       │   ├── majorQuery.ts      # 专业查询
│   │       │   └── scoreQuery.ts      # 分数线查询
│   │       ├── store.ts
│   │       ├── types.ts
│   │       └── index.ts
│   ├── shared/                        # 共享层
│   │   ├── components/                # 全局通用组件
│   │   │   ├── ui/                    # 基础 UI（Button/Card/Layout 等）
│   │   │   ├── charts/                # 图表组件（ECharts 封装）
│   │   │   └── layout/                # 布局组件
│   │   ├── hooks/                     # 全局 hooks
│   │   │   ├── useDatabase.ts         # 数据库访问
│   │   │   ├── useLocalStorage.ts     # localStorage 访问
│   │   │   └── useDebounce.ts
│   │   ├── services/                  # 全局服务
│   │   │   ├── db/                    # Dexie 数据库定义与访问层
│   │   │   │   ├── database.ts        # Dexie 实例与表定义
│   │   │   │   ├── collegeRepo.ts     # 院校数据访问
│   │   │   │   ├── majorRepo.ts       # 专业数据访问
│   │   │   │   ├── scoreRepo.ts       # 分数线数据访问
│   │   │   │   └── rankTableRepo.ts   # 一分一段表访问
│   │   │   ├── dataLoader.ts          # 数据加载器（JSON → IndexedDB）
│   │   │   ├── dataUpdater.ts         # 增量更新检查
│   │   │   └── citationTracker.ts     # 数据溯源追踪
│   │   ├── stores/                    # 全局状态
│   │   │   ├── appStore.ts            # 应用全局状态
│   │   │   ├── userStore.ts           # 用户画像状态（跨模块共享）
│   │   │   └── settingsStore.ts       # 设置（LLM 配置等）
│   │   ├── types/                     # 全局类型定义
│   │   │   ├── college.ts
│   │   │   ├── major.ts
│   │   │   ├── score.ts
│   │   │   ├── policy.ts
│   │   │   └── index.ts
│   │   ├── utils/                     # 工具函数
│   │   │   ├── crypto.ts              # API Key 加密
│   │   │   ├── format.ts              # 格式化
│   │   │   ├── validate.ts            # 校验
│   │   │   └── export.ts              # 导出工具
│   │   └── constants/                 # 常量
│   │       ├── provinces.ts           # 省份配置
│   │       ├── subjects.ts            # 选科配置
│   │       └── riskRules.ts           # 风险规则常量
│   ├── styles/                        # 全局样式
│   │   ├── globals.css                # Tailwind + 全局样式
│   │   ├── theme.ts                   # AntD 主题定制
│   │   └── echartsTheme.ts            # ECharts 主题
│   └── main.tsx                       # 入口
├── tests/                             # 测试
│   ├── unit/                          # 单元测试
│   │   ├── recommendation/
│   │   ├── risk-warning/
│   │   └── assessment/
│   ├── integration/                   # 集成测试
│   └── e2e/                           # E2E 测试（Playwright）
├── scripts/                           # 脚本
│   ├── build-data.mjs                 # 数据构建脚本（JSON 处理）
│   └── deploy.mjs                     # 部署脚本
├── .github/
│   └── workflows/
│       ├── ci.yml                     # CI（lint/test/build）
│       └── deploy.yml                 # CD（部署到 GitHub Pages）
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

### 2.1 设计要点

1. **Feature-based**：每个功能模块自包含 components/hooks/services/store/types，可独立开发和测试
2. **共享层**：UI 组件、数据访问层、全局状态、类型、工具函数统一管理，避免重复
3. **数据层集中**：`shared/services/db/` 统一管理 Dexie 数据库访问，各模块通过 Repo 模式访问数据
4. **全局状态分层**：`shared/stores/` 放跨模块共享状态（用户画像/设置），各模块 `store.ts` 放模块内状态
5. **数据与代码分离**：`public/data/` 放静态 JSON，`scripts/build-data.mjs` 处理数据构建

---

## 3. 模块依赖关系与交互机制

### 3.1 模块依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        App Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Profile  │ │Recommend-│ │Assess-   │ │Risk-     │      │
│  │ Module   │ │ation     │ │ment      │ │Warning   │      │
│  │          │ │Module    │ │Module    │ │Module    │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │            │            │            │             │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐                  │
│  │Volunteer-│ │AI Chat   │ │Data      │                   │
│  │List      │ │Module    │ │Center    │                   │
│  │Module    │ │          │ │Module    │                   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                  │
└───────┼────────────┼────────────┼──────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Shared Layer                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Stores   │ │ DB Repos │ │ Services │ │ Utils    │      │
│  │(Zustand) │ │(Dexie)   │ │(DataLoad │ │(Crypto/  │      │
│  │          │ │          │ │/Updater/ │ │ Format)  │      │
│  │userStore │ │collegeRep│ │Citation) │ │          │      │
│  │settings  │ │majorRepo │ │          │ │          │      │
│  │appStore  │ │scoreRepo │ │          │ │          │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 模块间解耦原则

1. **单向依赖**：Feature 模块 → Shared 层，Feature 模块之间不直接依赖，通过 Shared Store 通信
2. **接口契约**：每个模块通过 `index.ts` 导出明确的公共接口，内部实现对外不可见
3. **事件总线（可选扩展）**：对于跨模块异步通信，使用轻量事件总线（基于 Zustand 订阅）
4. **依赖注入**：核心服务（如推荐引擎、风险检测器）通过工厂函数创建，便于测试时替换

### 3.3 模块间交互机制

**场景 1：用户画像 → 推荐引擎**

```
Profile Module → userStore (Zustand) → Recommendation Module 订阅 userStore
```

- Profile 模块写入 `userStore`（成绩/位次/选科/偏好）
- Recommendation 模块通过 `useUserStore()` 订阅，用户画像变更时自动触发推荐
- 解耦：Recommendation 不依赖 Profile 模块，仅依赖 `userStore` 接口

**场景 2：推荐结果 → 志愿表 → 风险预警**

```
Recommendation → recommendationStore → VolunteerList 读取 → volunteerListStore
                                                          → RiskWarning 读取检测
```

- Recommendation 写入 `recommendationStore`
- VolunteerList 从 `recommendationStore` 读取候选，用户操作后写入 `volunteerListStore`
- RiskWarning 从 `volunteerListStore` 读取志愿表，执行检测，写入 `riskStore`

**场景 3：AI 对话 → 任意模块**

```
AI Chat Module → 读取 userStore / recommendationStore / volunteerListStore
              → 调用 LLM → 写入 chatStore
```

- AI Chat 是消费者，读取其他模块的 Store 状态作为对话上下文
- 不修改其他模块状态，仅通过对话建议影响用户决策

**场景 4：测评结果 → 推荐引擎**

```
Assessment Module → assessmentStore → Recommendation 读取作为排序权重
```

- Assessment 写入 `assessmentStore`（霍兰德代码/学科兴趣）
- Recommendation 读取 `assessmentStore`，在多维度排序中应用专业兴趣权重

### 3.4 核心接口契约

```typescript
// 推荐引擎接口
interface IRecommender {
  recommend(profile: UserProfile, assessment?: AssessmentResult): Promise<Recommendation[]>;
}

// 风险检测器接口
interface IRiskDetector {
  type: RiskType;
  detect(context: RiskContext): RiskItem[];
}

// 测评引擎接口
interface IAssessmentEngine {
  type: AssessmentType;
  loadQuestions(): Promise<Question[]>;
  score(answers: Answer[]): AssessmentResult;
}

// LLM 客户端接口
interface ILLMClient {
  chat(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
  search(query: string): Promise<SearchResult[]>;
}

// 数据访问 Repo 接口
interface ICollegeRepo {
  getById(id: string): Promise<College | undefined>;
  query(filter: CollegeFilter): Promise<College[]>;
}

// 导出器接口
interface IExporter {
  format: 'pdf' | 'excel' | 'image';
  export(data: VolunteerList, options?: ExportOptions): Promise<Blob>;
}
```

**设计要点**：
- 所有核心服务面向接口编程，便于测试时 Mock
- 模块间通过 Store 订阅机制通信，不直接调用
- 预留扩展接口，新增功能不影响现有模块

---

## 4. 推荐引擎模块设计

### 4.1 模块职责

基于用户画像（成绩/位次/选科/偏好）和可选的测评结果，生成冲稳保三档梯度志愿推荐方案。

### 4.2 内部架构

```
recommendation/
├── services/
│   ├── recommender.ts          # 推荐引擎入口（编排各子服务）
│   ├── rankConverter.ts        # 等效位次换算
│   ├── candidateFilter.ts      # 候选池筛选（选科/体检/学费/地域）
│   ├── probabilityCalc.ts      # 录取概率计算
│   ├── gradientDivider.ts      # 冲稳保梯度划分
│   ├── multiSorter.ts          # 多维度排序
│   └── citationBuilder.ts      # 推荐理由与溯源构建
├── hooks/
│   ├── useRecommendation.ts    # 推荐结果订阅 hook
│   └── useRecommendationParams.ts  # 推荐参数控制 hook
├── components/
│   ├── RecommendationPanel.tsx # 推荐结果主面板
│   ├── VolunteerCard.tsx       # 单条志愿卡片
│   ├── GradientColumn.tsx      # 冲/稳/保分栏
│   ├── ProbabilityBadge.tsx    # 录取概率徽章
│   ├── TrendChart.tsx          # 近3年位次趋势图
│   └── WeightSlider.tsx        # 多维度权重滑块
├── store.ts                    # 模块状态
├── types.ts                    # 模块类型
└── index.ts                    # 公共接口导出
```

### 4.3 推荐流程（Pipeline 模式）

```
UserProfile + AssessmentResult
        │
        ▼
[1] RankConverter.convert()
    输入：当年位次 + 省份 + 科类
    输出：近3-5年等效位次列表
    依赖：rankTableRepo
        │
        ▼
[2] CandidateFilter.filter()
    输入：等效位次 + 用户画像
    输出：候选院校专业列表（已过滤选科/体检/学费/地域）
    依赖：collegeRepo, majorRepo, scoreRepo, physicalExam 规则
        │
        ▼
[3] ProbabilityCalc.calculate()
    输入：候选列表 + 等效位次
    输出：每个候选的录取概率 + 大小年波动标记
    依赖：scoreRepo（近3年录取位次）
        │
        ▼
[4] GradientDivider.divide()
    输入：带概率的候选列表 + 省份志愿数量配置
    输出：冲/稳/保三档列表（按数量配比）
    依赖：provinceConfig
        │
        ▼
[5] MultiSorter.sort()
    输入：三档列表 + 多维度权重（含测评结果）
    输出：三档内排序后的列表
    依赖：assessmentStore（可选）
        │
        ▼
[6] CitationBuilder.build()
    输入：排序后的推荐列表
    输出：每条推荐附理由 + 数据来源链接
    依赖：citationTracker
        │
        ▼
Recommendation[] → recommendationStore
```

### 4.4 核心算法实现要点

**等效位次换算**（`rankConverter.ts`）：
- 从 `rankTableRepo` 查近 5 年一分一段表
- 对每年表二分查找：累计位次 = 考生位次 → 返回对应分数
- 输出 `EquivalentRank[]`：`[{ year, rank, score }]`

**录取概率计算**（`probabilityCalc.ts`）：
- 取目标院校专业近 3 年录取最低位次
- 加权平均：`基准位次 = 去年×0.5 + 前年×0.3 + 大前年×0.2`
- 偏差率：`(考生位次 - 基准位次) / 基准位次`
- 概率映射：
  - 偏差率 < -15% → 90%+（保）
  - -15% ~ -5% → 80%-90%（保）
  - -5% ~ +5% → 60%-80%（稳）
  - +5% ~ +15% → 20%-40%（冲）
  - > +15% → 不推荐
- 大小年检测：计算 3 年位次标准差，>15% 降概率 10%，>25% 降 20%

**冲稳保梯度划分**（`gradientDivider.ts`）：
- 按概率排序候选列表
- 根据省份志愿数量配置（如 96 个）分配三档数量
- 冲：概率 20-40%，位次上浮 5-15%
- 稳：概率 60-80%，位次 ±5%
- 保：概率 90%+，位次下浮 10-20%

**多维度排序**（`multiSorter.ts`）：
- 维度：录取概率(30%) + 院校层次(25%) + 专业兴趣(20%) + 地域(15%) + 学费(5%) + 就业(5%)
- 权重可通过 `WeightSlider` 动态调整
- 专业兴趣维度读取 `assessmentStore`（未测评时该维度权重为 0，自动分配给其他维度）

### 4.5 扩展性设计

```typescript
// 推荐策略接口（可替换算法）
interface IRecommendationStrategy {
  recommend(profile: UserProfile, assessment?: AssessmentResult): Promise<Recommendation[]>;
}

// 默认实现：位次法 + 冲稳保
class RankBasedStrategy implements IRecommendationStrategy { ... }

// 未来扩展：ML 概率预测
class MLBasedStrategy implements IRecommendationStrategy { ... }

// 推荐引擎入口（策略模式）
class Recommender {
  constructor(private strategy: IRecommendationStrategy) {}
  async recommend(...) { return this.strategy.recommend(...); }
}
```

### 4.6 模块状态（store.ts）

```typescript
interface RecommendationState {
  recommendations: Recommendation[];
  loading: boolean;
  error: string | null;
  weights: DimensionWeights;  // 多维度权重
  gradientRatio: { rush: number; stable: number; guarantee: number };
  
  // Actions
  generate: (profile: UserProfile, assessment?: AssessmentResult) => Promise<void>;
  updateWeights: (weights: Partial<DimensionWeights>) => void;
  updateGradientRatio: (ratio: Partial<GradientRatio>) => void;
  clear: () => void;
}
```

---

## 5. 风险预警模块设计

### 5.1 模块职责

检测用户志愿表的滑档和退档风险，生成红/黄/绿三级风险报告。

### 5.2 内部架构

```
risk-warning/
├── services/
│   ├── riskDetector.ts         # 风险检测入口（编排各检测器）
│   ├── detectors/              # 检测器集合（可扩展）
│   │   ├── slideRiskDetector.ts      # 滑档风险检测
│   │   ├── adjustRejectDetector.ts   # 不服从调剂检测
│   │   ├── physicalRejectDetector.ts # 体检受限检测
│   │   ├── subjectRejectDetector.ts  # 单科成绩检测
│   │   ├── selectSubjectDetector.ts  # 选科匹配检测
│   │   ├── politicalRejectDetector.ts# 政审体检面试检测
│   │   ├── gradeDiffDetector.ts      # 专业级差检测
│   │   └── majorGroupDetector.ts     # 专业组结构检测
│   ├── reportGenerator.ts      # 风险报告生成
│   └── suggestionBuilder.ts    # 修复建议构建
├── hooks/
│   └── useRiskReport.ts        # 风险报告订阅 hook
├── components/
│   ├── RiskOverview.tsx        # 风险总览（红黄绿灯）
│   ├── RiskItem.tsx            # 单条风险展示
│   ├── RiskSuggestion.tsx      # 修复建议
│   └── RiskReportExport.tsx    # 报告导出
├── store.ts
├── types.ts
└── index.ts
```

### 5.3 检测器插件化架构

```typescript
// 风险检测器接口（所有检测器实现此接口）
interface IRiskDetector {
  type: RiskType;  // 'slide' | 'reject'
  detect(context: RiskContext): RiskItem[];
}

// 检测上下文
interface RiskContext {
  volunteerList: VolunteerItem[];
  profile: UserProfile;
  provinceConfig: ProvinceConfig;
}

// 检测器注册表（插件化，可动态新增）
class DetectorRegistry {
  private detectors: IRiskDetector[] = [];
  register(detector: IRiskDetector) { this.detectors.push(detector); }
  detectAll(context: RiskContext): RiskItem[] {
    return this.detectors.flatMap(d => d.detect(context));
  }
}

// 风险检测入口
class RiskDetector {
  constructor(private registry: DetectorRegistry) {}
  detect(context: RiskContext): RiskReport {
    const items = this.registry.detectAll(context);
    return this.reportGenerator.generate(items);
  }
}
```

**扩展性**：新增风险规则只需实现 `IRiskDetector` 接口并注册，不影响现有检测器。

### 5.4 风险报告数据结构

```typescript
interface RiskReport {
  overallLevel: 'high' | 'medium' | 'low';  // 综合风险等级
  slideRisks: RiskItem[];   // 滑档风险
  rejectRisks: RiskItem[];  // 退档风险
  summary: string;          // 摘要
  suggestions: Suggestion[];// 修复建议
}

interface RiskItem {
  id: string;
  type: 'slide' | 'reject';
  level: 'high' | 'medium' | 'low';
  category: string;         // 如"服从调剂"/"身体条件"/"单科成绩"
  title: string;            // 风险标题
  description: string;      // 风险说明
  reason: string;           // 原因解释
  suggestion: string;       // 具体建议
  affectedVolunteers: number[];  // 受影响的志愿序号
  citation: Citation;       // 数据来源
}
```

### 5.5 检测规则

**滑档风险检测**（`slideRiskDetector.ts`）：

| 检测项 | 高风险 | 中风险 | 低风险 |
|--------|--------|--------|--------|
| 冲稳保比例 | 冲 >50% 或 保 <10% | 冲 40-50% 或 保 10-15% | 冲 20-30%、稳 40-60%、保 10-20% |
| 保底院校位次差 | 保底院校位次仅低于考生 <5% | 保底院校位次低于考生 5-10% | 保底院校位次低于考生 ≥10% |
| 志愿间梯度 | 相邻志愿位次差 <2%（梯度断层） | 相邻志愿位次差 2-5% | 相邻志愿位次差 5-15% |
| 数据年限 | 仅参考 1 年数据 | 参考 2 年数据 | 参考 3 年及以上数据 |
| 大小年波动 | 目标院校近 3 年位次标准差 >15% | 标准差 8-15% | 标准差 <8% |

**退档风险检测**（`rejectDetector.ts` 等）：

| 检测项 | 高风险（红） | 中风险（黄） | 低风险（绿） |
|--------|-------------|-------------|-------------|
| 服从调剂 | 未勾选服从调剂（院校专业组模式） | — | 已勾选服从调剂 |
| 身体条件 | 色盲/色弱填报医学、化学等限报专业 | 身高处于临界值 | 体检结论无受限 |
| 单科成绩 | 单科成绩低于章程要求 | 单科成绩接近要求线（差距 ≤3 分） | 单科成绩高于要求 ≥5 分 |
| 选科匹配 | 选科不含必选科目 | — | 选科完全匹配 |
| 政审/体检/面试 | 填报军警公安类但未参加政审/体检 | 政审/体检结果未知 | 已取得合格结论 |
| 专业级差 | 院校有级差且排序未考虑级差 | 院校有级差但分数优势明显 | 院校无级差 |
| 专业组结构 | 专业组内仅 1 个专业且不服从调剂 | 专业组内含不可接受专业且服从调剂 | 专业组内专业均可接受 |

---

## 6. 兴趣测评模块设计

### 6.1 模块职责

通过霍兰德 RIASEC 测评和学科兴趣测评，评估考生专业倾向，输出匹配专业方向。

### 6.2 内部架构

```
assessment/
├── services/
│   ├── assessmentEngine.ts    # 测评引擎入口
│   ├── engines/               # 测评引擎集合（可扩展）
│   │   ├── hollandEngine.ts   # 霍兰德 RIASEC 计分
│   │   ├── subjectEngine.ts   # 学科兴趣计分
│   │   └── mbtiEngine.ts      # 预留 MBTI 扩展
│   ├── majorMatcher.ts        # 专业匹配器
│   └── resultIntegrator.ts    # 多测评结果整合
├── hooks/
│   ├── useAssessment.ts       # 测评状态订阅
│   └── useAssessmentProgress.ts
├── components/
│   ├── AssessmentIntro.tsx    # 测评介绍页
│   ├── QuestionCard.tsx       # 题目卡片
│   ├── ProgressIndicator.tsx  # 进度指示
│   ├── HollandRadar.tsx       # 霍兰德雷达图
│   ├── SubjectBar.tsx         # 学科兴趣柱状图
│   └── ResultSummary.tsx      # 结果摘要
├── store.ts
├── types.ts
└── index.ts
```

### 6.3 测评引擎插件化

```typescript
// 测评引擎接口
interface IAssessmentEngine {
  type: AssessmentType;  // 'holland' | 'subject' | 'mbti'
  loadQuestions(): Promise<Question[]>;
  score(answers: Answer[]): AssessmentResult;
}

// 测评引擎注册表
class AssessmentEngineRegistry {
  private engines = new Map<AssessmentType, IAssessmentEngine>();
  register(engine: IAssessmentEngine) { ... }
  getEngine(type: AssessmentType): IAssessmentEngine { ... }
}
```

### 6.4 专业匹配流程

```
霍兰德代码 (如 SAE) + 学科兴趣 (如 数学/物理/英语)
        │
        ▼
[MajorMatcher] 查询 holland_mapping.json + 学科-专业映射表
        │
        ▼
[ResultIntegrator] 交叉验证
        │  一致 → 高置信度
        │  不一致 → 标注差异，建议深入测评
        ▼
AssessmentResult → assessmentStore → 推荐引擎读取
```

### 6.5 霍兰德 RIASEC 与学科门类映射

| 霍兰德代码 | 对应学科门类 |
|-----------|------------|
| R 现实型 | 工学、农学 |
| I 研究型 | 理学、医学（基础）、工学（计算机/电子） |
| A 艺术型 | 艺术学、文学（新闻/汉语言）、建筑学 |
| S 社会型 | 教育学、医学（临床/护理）、法学（社会学） |
| E 企业型 | 经济学、管理学、法学 |
| C 常规型 | 管理学（会计）、经济学（财政） |

---

## 7. AI 对话模块设计

### 7.1 模块职责

提供可选的 AI 对话咨询能力，基于内置知识库 + LLM 回答政策/推荐/院校专业问题。

### 7.2 内部架构

```
ai-chat/
├── services/
│   ├── llmClient.ts           # LLM API 客户端（OpenAI 兼容）
│   ├── promptBuilder.ts       # Prompt 构建（注入知识库上下文）
│   ├── knowledgeBase.ts       # 内置知识库（政策/规则）
│   ├── citationParser.ts      # 引用解析（提取 LLM 回答中的来源）
│   ├── chatHistory.ts         # 对话历史管理
│   └── streamingHandler.ts    # 流式响应处理
├── hooks/
│   ├── useChat.ts             # 对话状态订阅
│   └── useLLMConfig.ts        # LLM 配置订阅
├── components/
│   ├── ChatWindow.tsx         # 对话窗口
│   ├── MessageBubble.tsx      # 消息气泡
│   ├── CitationCard.tsx       # 引用来源卡片
│   ├── LLMConfigPanel.tsx     # LLM 配置面板
│   ├── ChatInput.tsx          # 输入框
│   └── TypingIndicator.tsx    # 打字指示器
├── store.ts
├── types.ts
└── index.ts
```

### 7.3 LLM 客户端设计

```typescript
// LLM 配置
interface LLMConfig {
  baseURL: string;      // 如 https://open.bigmodel.cn/api/paas/v4
  apiKey: string;       // 加密存储
  model: string;        // 如 glm-4-plus
  temperature: number;  // 默认 0.3
  enableSearch: boolean;// 是否启用联网搜索
}

// LLM 客户端（OpenAI 兼容格式）
class LLMClient {
  constructor(private config: LLMConfig) {}
  
  // 流式对话
  async *chat(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decrypt(this.config.apiKey)}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        temperature: this.config.temperature,
        tools: this.config.enableSearch ? [{ type: 'web_search' }] : undefined,
      }),
    });
    // 解析 SSE 流
    yield* this.parseSSEStream(response.body);
  }
}
```

### 7.4 Prompt 构建策略

```typescript
class PromptBuilder {
  buildSystemPrompt(context: ChatContext): string {
    return `
你是一个高考志愿填报助手，基于以下内置知识库回答用户问题。
规则：
1. 回答必须基于提供的知识库，不得编造信息
2. 涉及政策/分数线/位次时，引用内置数据库数据
3. 联网搜索结果必须附来源链接
4. 不得承诺录取结果
5. 回答末尾标注"以上信息仅供参考，请以官方发布为准"

【用户画像】${JSON.stringify(context.profile)}
【当前志愿表】${JSON.stringify(context.volunteerList)}
【推荐结果】${JSON.stringify(context.recommendations)}
【内置政策知识库】${this.knowledgeBase.getRelevant(context.query)}
`;
  }
}
```

### 7.5 防幻觉机制

1. **System Prompt 注入知识库**：LLM 基于内置数据回答，不依赖自身知识
2. **关键数据校验**：LLM 回答中的分数线/位次/政策与内置数据库交叉验证
3. **引用强制**：联网搜索结果必须附来源，`citationParser` 提取并展示
4. **免责声明**：每条回答末尾自动追加免责声明
5. **降级策略**：LLM 不可用时，提示用户"AI 暂不可用，请使用核心推荐功能"

### 7.6 隐私与安全

- API Key 加密存储于本地（IndexedDB），使用 Web Crypto API
- API Key 不上传任何服务器
- 对话历史本地存储
- 不收集用户对话内容用于训练

---

## 8. 数据层设计

### 8.1 数据层架构

```
shared/services/db/
├── database.ts              # Dexie 数据库定义
├── repos/                   # Repo 模式（数据访问对象）
│   ├── collegeRepo.ts       # 院校数据访问
│   ├── majorRepo.ts         # 专业数据访问
│   ├── scoreRepo.ts         # 分数线数据访问
│   ├── rankTableRepo.ts     # 一分一段表访问
│   ├── policyRepo.ts        # 政策数据访问
│   └── userProfileRepo.ts   # 用户画像持久化
└── migrations/              # 数据库迁移脚本
    └── v1.ts

shared/services/
├── dataLoader.ts            # JSON → IndexedDB 加载器
├── dataUpdater.ts           # 增量更新检查与拉取
├── citationTracker.ts       # 数据溯源追踪
└── cacheManager.ts          # 内存缓存层
```

### 8.2 Dexie 数据库定义

```typescript
// database.ts
import Dexie, { Table } from 'dexie';

class VolunteerDatabase extends Dexie {
  colleges!: Table<College, string>;
  majors!: Table<Major, string>;
  admissionScores!: Table<AdmissionScore, number>;
  rankTables!: Table<RankTableEntry, number>;
  policies!: Table<Policy, string>;
  userProfiles!: Table<UserProfile, string>;
  volunteerLists!: Table<VolunteerList, string>;
  assessmentResults!: Table<AssessmentResult, string>;
  chatHistories!: Table<ChatMessage, number>;

  constructor() {
    super('VolunteerAssistantDB');
    this.version(1).stores({
      colleges: 'id, name, province, type, level',
      majors: 'id, name, category, discipline, hollandCode',
      admissionScores: '++id, [collegeId+majorId], [province+year], year',
      rankTables: '++id, [province+subjectType+year], score, rank',
      policies: 'id, province, year',
      userProfiles: '++id, updatedAt',
      volunteerLists: '++id, profileId, createdAt',
      assessmentResults: '++id, profileId, type',
      chatHistories: '++id, profileId, createdAt',
    });
  }
}
```

### 8.3 数据加载流程

```
应用启动
  │
  ▼
[1] 检查 IndexedDB 是否已初始化
    │
    ├─ 已初始化 → 检查数据版本
    │              │
    │              ├─ 最新 → 直接使用
    │              └─ 过期 → 触发增量更新
    │
    └─ 未初始化 → [2] DataLoader 从 public/data/ 加载 JSON
                     │
                     ▼
                 [3] 批量写入 IndexedDB（事务）
                     │
                     ▼
                 [4] 记录数据版本号到 localStorage
```

### 8.4 增量更新机制

```typescript
class DataUpdater {
  private VERSION_URL = 'https://raw.githubusercontent.com/.../data/version.json';
  
  async checkUpdate(): Promise<boolean> {
    const localVersion = localStorage.getItem('dataVersion');
    const remote = await fetch(this.VERSION_URL).then(r => r.json());
    return remote.version !== localVersion;
  }
  
  async update(): Promise<void> {
    // 拉取增量数据（如当年一分一段表）
    const incrementalData = await this.fetchIncremental();
    // 写入 IndexedDB
    await this.applyIncremental(incrementalData);
    // 更新版本号
    localStorage.setItem('dataVersion', newVersion);
  }
}
```

### 8.5 数据溯源追踪

```typescript
// 每条数据附带溯源信息
interface Citation {
  source: string;        // '阳光高考' | '浙江省教育考试院' | ...
  sourceType: 'official' | 'search' | 'internal';
  url: string;           // 来源链接
  fetchedAt: string;     // 采集日期
  confidence: 'high' | 'medium' | 'low';  // 权威级别
}

// CitationTracker 在数据加载时记录溯源信息
class CitationTracker {
  track(dataId: string, citation: Citation): void;
  getCitation(dataId: string): Citation | undefined;
  buildCitationList(recommendations: Recommendation[]): CitationSummary;
}
```

### 8.6 性能优化

1. **内存缓存**：`CacheManager` 对热点数据（当前省份的院校/分数线）做 LRU 缓存
2. **索引优化**：Dexie 复合索引支持 `[province+year]`、`[collegeId+majorId]` 等高效查询
3. **懒加载**：省份数据按用户选择后加载到内存（已打包，从 IndexedDB 读取）
4. **批量操作**：数据初始化使用 Dexie 事务批量写入，避免多次 IO

---

## 9. 其余模块设计

### 9.1 用户画像模块（Profile）

```
profile/
├── components/
│   ├── ProfileForm.tsx        # 画像录入表单
│   ├── ScoreInput.tsx         # 成绩位次输入（带一分一段表校验）
│   ├── SubjectSelector.tsx    # 选科选择器
│   ├── PreferencePanel.tsx    # 偏好设置（地域/院校/学费）
│   └── PhysicalExamSelector.tsx # 体检结论选择
├── services/
│   ├── profileValidator.ts    # 画像校验（位次与分数匹配）
│   └── rankTableLookup.ts     # 一分一段表查询
├── store.ts                   # 写入 userStore（共享）
└── types.ts
```

**交互**：写入 `shared/stores/userStore.ts`，其他模块订阅。

### 9.2 志愿表管理模块（VolunteerList）

```
volunteer-list/
├── components/
│   ├── VolunteerTable.tsx     # 志愿表（支持拖拽排序）
│   ├── VolunteerRow.tsx       # 单行志愿
│   ├── MultiPlanCompare.tsx   # 多方案对比
│   └── ExportPanel.tsx        # 导出面板
├── services/
│   ├── listManager.ts         # 增删改查/排序
│   └── exporters/             # 导出器（插件化）
│       ├── pdfExporter.ts
│       ├── excelExporter.ts
│       ├── imageExporter.ts
│       └── exporterRegistry.ts
├── store.ts                   # volunteerListStore
└── types.ts
```

**导出器插件化**：实现 `IExporter` 接口，新增格式只需注册新导出器。

```typescript
interface IExporter {
  format: 'pdf' | 'excel' | 'image';
  export(data: VolunteerList, options?: ExportOptions): Promise<Blob>;
}

class ExporterRegistry {
  private exporters = new Map<string, IExporter>();
  register(exporter: IExporter) { this.exporters.set(exporter.format, exporter); }
  getExporter(format: string): IExporter | undefined { return this.exporters.get(format); }
}
```

### 9.3 数据中心模块（DataCenter）

```
data-center/
├── components/
│   ├── CollegeBrowser.tsx     # 院校浏览
│   ├── MajorBrowser.tsx       # 专业浏览
│   ├── ScoreQuery.tsx         # 分数线查询
│   ├── RankTableViewer.tsx    # 一分一段表查看
│   └── DetailDrawer.tsx       # 详情抽屉
├── services/
│   ├── collegeQuery.ts        # 院校查询（调用 collegeRepo）
│   ├── majorQuery.ts          # 专业查询（调用 majorRepo）
│   └── scoreQuery.ts          # 分数线查询（调用 scoreRepo）
├── store.ts                   # 查询状态（筛选条件/分页）
└── types.ts
```

**交互**：只读访问 `shared/services/db/repos/`，不修改数据。

---

## 10. 性能优化策略

### 10.1 首屏加载优化

| 策略 | 说明 |
|------|------|
| **路由懒加载** | `React.lazy` + `Suspense`，按路由分割代码 |
| **数据分片** | 首屏仅加载首页 + 公共数据，省份数据用户选择后从 IndexedDB 读取 |
| **Tree Shaking** | ECharts/AntD 按需引入，减小包体 |
| **Gzip/Brotli** | GitHub Pages 自动启用 Gzip |
| **预加载** | 用户选择省份后预加载该省数据到内存缓存 |
| **Manual Chunks** | Vite 配置手动分包（react-vendor/antd-vendor/echarts-vendor） |

### 10.2 运行时性能

| 策略 | 说明 |
|------|------|
| **虚拟列表** | 院校/专业列表用 `react-window` 虚拟滚动 |
| **防抖节流** | 查询输入/滑块调整使用防抖 |
| **Web Worker** | 推荐算法/风险检测放入 Web Worker，避免阻塞 UI |
| **内存缓存** | `CacheManager` LRU 缓存热点数据 |
| **选择器优化** | Zustand 选择器避免不必要的重渲染 |

### 10.3 Web Worker 设计

```typescript
// recommendation.worker.ts
self.onmessage = async (e) => {
  const { profile, assessment, weights } = e.data;
  const recommendations = await recommender.recommend(profile, assessment, weights);
  self.postMessage(recommendations);
};

// 主线程
const worker = new Worker(new URL('./recommendation.worker.ts', import.meta.url), { type: 'module' });
worker.postMessage({ profile, assessment, weights });
worker.onmessage = (e) => setRecommendations(e.data);
```

**适用场景**：推荐引擎、风险检测、测评计分等计算密集型任务。

### 10.4 Vite 配置要点

```typescript
// vite.config.ts
export default defineConfig({
  base: '/volunteer-assistant/',  // GitHub Pages 子路径
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'echarts-vendor': ['echarts'],
          'dexie-vendor': ['dexie'],
        },
      },
    },
  },
});
```

---

## 11. 测试策略

### 11.1 测试金字塔

```
        ┌───────────┐
        │   E2E     │  Playwright（核心流程）
        │  (10%)    │
        ├───────────┤
        │ Integration│  React Testing Library（组件交互）
        │   (30%)    │
        ├───────────┤
        │   Unit    │  Vitest（算法/工具/服务）
        │  (60%)    │
        └───────────┘
```

### 11.2 单元测试重点

| 模块 | 测试重点 | 覆盖率目标 |
|------|---------|-----------|
| 推荐引擎 | 等效位次换算/概率计算/梯度划分/多维度排序 | > 90% |
| 风险预警 | 滑档检测/退档检测/体检规则/风险等级判定 | > 90% |
| 测评引擎 | 霍兰德计分/学科兴趣计分/专业匹配 | > 85% |
| 数据层 | Repo 查询/数据加载/增量更新 | > 80% |
| 工具函数 | 加密/格式化/校验 | > 90% |

### 11.3 测试用例示例

```typescript
// rankConverter.test.ts
describe('RankConverter', () => {
  it('应正确换算等效位次', async () => {
    const converter = new RankConverter(rankTableRepo);
    const result = await converter.convert({
      rank: 18000,
      province: 'zhejiang',
      subjectType: 'physics',
      year: 2026,
    });
    expect(result).toHaveLength(5);  // 近5年
    expect(result[0].year).toBe(2025);
    expect(result[0].equivalentScore).toBeGreaterThan(0);
  });
});

// slideRiskDetector.test.ts
describe('SlideRiskDetector', () => {
  it('冲>50%应判定为高风险', () => {
    const detector = new SlideRiskDetector();
    const items = detector.detect({
      volunteerList: generateList({ rush: 60, stable: 30, guarantee: 10 }),
      profile: mockProfile,
      provinceConfig: mockConfig,
    });
    expect(items.some(i => i.level === 'high')).toBe(true);
  });
});
```

### 11.4 E2E 测试场景

1. 完整填报流程：首页 → 录入画像 → 生成推荐 → 加入志愿表 → 风险检测 → 导出
2. LLM 未接入时核心功能验证
3. LLM 接入后对话功能验证
4. 离线模式功能验证
5. 多省份切换验证

---

## 12. 部署与 CICD

### 12.1 GitHub Pages 部署

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run test:unit
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

### 12.2 CI 流程

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run test:e2e
      - run: npm run build
```

---

## 13. 开发规范

### 13.1 代码规范

| 工具 | 用途 | 配置 |
|------|------|------|
| ESLint | 代码检查 | `@typescript-eslint/recommended` + React 规则 |
| Prettier | 代码格式化 | 2 空格缩进，单引号，无分号（可选） |
| Husky + lint-staged | 提交前检查 | 自动修复 + 类型检查 |
| Commitlint | 提交规范 | Conventional Commits |

### 13.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `VolunteerCard.tsx` |
| 工具/服务文件 | camelCase | `rankConverter.ts` |
| 类型文件 | camelCase | `types.ts` |
| 常量 | UPPER_SNAKE_CASE | `MAX_VOLUNTEER_COUNT` |
| Hook | use 前缀 | `useRecommendation` |
| 接口 | I 前缀（可选） | `IRecommender` |
| 枚举 | PascalCase | `RiskLevel.High` |

### 13.3 Git 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 生产分支，受保护 |
| `develop` | 开发分支 |
| `feature/*` | 功能分支 |
| `fix/*` | 修复分支 |
| `release/*` | 发布分支 |

### 13.4 提交规范（Conventional Commits）

```
<type>(<scope>): <subject>

types: feat | fix | docs | style | refactor | test | chore
scope: 模块名（如 recommendation | risk-warning | ai-chat）
```

示例：
```
feat(recommendation): 实现等效位次换算算法
fix(risk-warning): 修复体检受限检测误报
docs(readme): 更新部署说明
```

---

## 14. 扩展性设计

### 14.1 扩展点清单

| 扩展场景 | 扩展机制 | 接口 |
|---------|---------|------|
| 新增省份 | `provinces.ts` 添加配置 + `public/data/` 添加该省数据 JSON | — |
| 新增 LLM 厂商 | 只需支持 OpenAI 兼容格式即可，用户填 Base URL | `ILLMClient` |
| 新增测评类型 | `assessment/services/engines/` 新增 Engine | `IAssessmentEngine` |
| 新增风险规则 | `risk-warning/services/detectors/` 新增 Detector | `IRiskDetector` |
| 新增导出格式 | `volunteer-list/services/exporters/` 新增 Exporter | `IExporter` |
| 新增推荐算法 | `recommendation/services/` 新增 Strategy | `IRecommendationStrategy` |
| 新增图表类型 | `shared/components/charts/` 新增组件，基于 ECharts 封装 | — |

### 14.2 扩展原则

1. **接口优先**：所有可扩展点定义明确接口，新增功能实现接口即可
2. **注册机制**：通过 Registry 模式动态注册，无需修改现有代码
3. **单一职责**：每个扩展点只解决一类问题，避免接口膨胀
4. **向后兼容**：扩展不破坏现有功能，旧代码无需修改
5. **不过度设计**：v1.0 仅实现核心扩展点，避免预留过多无用接口

### 14.3 未来优化方向（v2.0+）

| 方向 | 说明 |
|------|------|
| ML 概率预测 | 引入机器学习模型预测录取概率，替代规则引擎 |
| 多语言支持 | i18n 国际化，支持英语等语言 |
| PWA 离线 | 升级为 PWA，支持安装到桌面 |
| 数据众包 | 用户贡献数据，社区维护更新 |
| 家长协同 | 多用户共享志愿表，在线讨论 |
| 移动端原生 | React Native 封装为原生 App |

---

## 15. 附录

### 15.1 技术栈版本汇总

| 依赖 | 版本 | 用途 |
|------|------|------|
| react | ^18.3 | UI 框架 |
| react-dom | ^18.3 | React DOM 渲染 |
| react-router-dom | ^6.26 | 路由 |
| typescript | ^5.5 | 类型系统 |
| vite | ^5.4 | 构建工具 |
| antd | ^5.20 | UI 组件库 |
| tailwindcss | ^3.4 | 原子化 CSS |
| framer-motion | ^11.3 | 动画 |
| zustand | ^4.5 | 状态管理 |
| dexie | ^4.0 | IndexedDB 封装 |
| echarts | ^5.5 | 图表 |
| react-window | ^1.8 | 虚拟列表 |
| vitest | ^2.0 | 单元测试 |
| @testing-library/react | ^16.0 | 组件测试 |
| @playwright/test | ^1.47 | E2E 测试 |
| eslint | ^9.9 | 代码检查 |
| prettier | ^3.3 | 代码格式化 |
| husky | ^9.1 | Git hooks |
| lint-staged | ^15.2 | 提交前检查 |

### 15.2 关键接口汇总

```typescript
// 推荐引擎
interface IRecommendationStrategy {
  recommend(profile: UserProfile, assessment?: AssessmentResult): Promise<Recommendation[]>;
}

// 风险检测器
interface IRiskDetector {
  type: RiskType;
  detect(context: RiskContext): RiskItem[];
}

// 测评引擎
interface IAssessmentEngine {
  type: AssessmentType;
  loadQuestions(): Promise<Question[]>;
  score(answers: Answer[]): AssessmentResult;
}

// LLM 客户端
interface ILLMClient {
  chat(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
  search(query: string): Promise<SearchResult[]>;
}

// 数据访问 Repo
interface ICollegeRepo {
  getById(id: string): Promise<College | undefined>;
  query(filter: CollegeFilter): Promise<College[]>;
}

// 导出器
interface IExporter {
  format: 'pdf' | 'excel' | 'image';
  export(data: VolunteerList, options?: ExportOptions): Promise<Blob>;
}
```

### 15.3 数据流全景图

```
用户输入
  │
  ▼
[Profile Module] ──写入──→ userStore
                              │
                              ▼
                    [Recommendation Module] ──读取──→ assessmentStore
                              │
                              ▼
                    recommendationStore
                              │
                              ▼
                    [VolunteerList Module] ──写入──→ volunteerListStore
                              │
                              ▼
                    [RiskWarning Module] ──检测──→ riskStore
                              │
                              ▼
                    [AI Chat Module] ──读取所有 Store──→ chatStore
                              │
                              ▼
                          UI 渲染
```

### 15.4 模块职责矩阵

| 模块 | 输入 | 输出 | 依赖 |
|------|------|------|------|
| Profile | 用户操作 | userStore | — |
| Recommendation | userStore + assessmentStore | recommendationStore | db/repos |
| Assessment | 用户答题 | assessmentStore | holland_mapping.json |
| RiskWarning | volunteerListStore + userStore | riskStore | physical_exam.json |
| VolunteerList | recommendationStore + 用户操作 | volunteerListStore | — |
| AIChat | 所有 Store + LLM | chatStore | llmClient |
| DataCenter | 用户查询 | 查询结果 | db/repos |
| Shared/DB | JSON 数据 | IndexedDB | dexie |

---

## 文档变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-06-17 | 初始版本 | 智填志愿团队 |

---

> **文档评审要点**：
> 1. 技术选型是否合理？是否满足"美观 P0"和"高扩展性"要求？
> 2. 模块拆分是否清晰？模块间解耦是否充分？
> 3. 核心模块架构（推荐引擎/风险预警/测评/AI 对话/数据层）是否准确？
> 4. 扩展性设计是否满足后续优化改进需求？
> 5. 性能优化策略是否可行？
> 6. 测试策略是否覆盖核心算法？
