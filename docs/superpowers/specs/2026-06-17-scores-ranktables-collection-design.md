# 专业录取分数线与一分一段表采集系统设计

> **版本**：v1.0
> **日期**：2026-06-17
> **状态**：待评审
> **文档类型**：技术设计文档
> **关联文档**：[2026-06-17-college-data-collection-design.md](./2026-06-17-college-data-collection-design.md)

---

## 1. 背景与目标

### 1.1 背景

院校基础信息采集已完成（`colleges.json`，2919 条记录）。下一步需采集专业级录取分数线和一分一段表，为推荐引擎、风险预警、数据中心等模块提供历史录取数据支撑。

### 1.2 目标

- 采集浙江、江苏两省 2023/2024/2025 年的专业级录取分数线
- 采集浙江、江苏两省 2023/2024/2025 年的一分一段表
- 数据存储在本地，可溯源至权威来源
- 复用已有采集架构（`shared/` 基础设施）

### 1.3 范围

**本批次范围**：
- 省份：浙江、江苏
- 年份：2023、2024、2025
- 分数线粒度：院校+专业级录取分
- 一分一段表：全省逐分段排名

**不在本批次范围**（后续阶段）：
- 其他省份
- 招生章程详情
- 选科要求

### 1.4 关键约束

| 约束 | 说明 |
|------|------|
| 分数线数据源 | 阳光高考平台（教育部主管，院校上报） |
| 一分一段表数据源 | 浙江省教育考试院 + 江苏省教育考试院 |
| 采集方式 | 自动化脚本采集，复用已有架构 |
| 溯源粒度 | URL + 采集日期 + 脚本版本号 |
| 技术栈 | Node.js + TypeScript（与已有采集器同栈） |
| 权威性 | 阳光高考（院校上报）+ 省考试院（官方发布） |

---

## 2. 整体架构与目录布局

复用已有采集架构，新增 `scores/` 和 `rank_tables/` 两个采集器，共享 `shared/` 基础设施。

```
volunteer-assistant/
├── scripts/
│   └── scrapers/
│       ├── colleges/                    # 已有：院校基础信息
│       ├── scores/                      # 新增：专业录取分数线
│       │   ├── gaokao_score.ts          # 阳光高考专业录取分抓取+解析
│       │   ├── index.ts                 # 分数线采集编排入口
│       │   ├── __fixtures__/
│       │   │   └── gaokao_score_sample.html
│       │   └── __tests__/
│       │       ├── gaokao_score.test.ts
│       │       └── e2e.test.ts
│       ├── rank_tables/                 # 新增：一分一段表
│       │   ├── zhejiang.ts              # 浙江省考试院抓取+解析
│       │   ├── jiangsu.ts               # 江苏省考试院抓取+解析
│       │   ├── index.ts                 # 一分一段表采集编排入口
│       │   ├── __fixtures__/
│       │   │   ├── zhejiang_sample.html
│       │   │   └── jiangsu_sample.html
│       │   └── __tests__/
│       │       ├── zhejiang.test.ts
│       │       ├── jiangsu.test.ts
│       │       └── e2e.test.ts
│       ├── shared/                      # 已有：http/cache/logger/meta
│       │   └── pdf.ts                   # 新增：PDF 解析工具（若考试院发布 PDF）
│       │   └── colleges_loader.ts       # 新增：加载院校白名单
│       ├── types.ts                     # 扩展：新增 Score/RankTable 类型
│       └── config.ts                    # 扩展：新增数据源 URL/年份配置
├── public/
│   └── data/
│       ├── common/
│       │   └── colleges.json            # 已有
│       └── scores/                      # 新增：按省/年组织
│           ├── zhejiang/
│           │   ├── scores_2023.json
│           │   ├── scores_2024.json
│           │   ├── scores_2025.json
│           │   └── rank_table_2023.json ... rank_table_2025.json
│           └── jiangsu/
│               └── (同上结构)
└── raw/                                 # 已有：原始响应缓存
    ├── scores/
    │   └── <college_id>.html
    └── rank_tables/
        └── <province>_<year>.html
```

### 2.1 关键设计点

1. **复用基础设施**：`HttpClient`/`Cache`/`logger`/`meta` 直接复用，无需重写
2. **按省/年组织产出**：`public/data/scores/<province>/scores_<year>.json`，便于前端按需加载
3. **与 colleges.json 关联**：分数线记录通过 `collegeId` 关联院校基础信息，`collegeId` 对应 `CollegeRecord.id`（教育部代码）
4. **PDF 兜底**：`shared/pdf.ts` 预留 PDF 解析能力，若考试院发布 PDF 一分一段表则启用
5. **独立编排入口**：`npm run scrape:scores` 和 `npm run scrape:rank_tables` 可独立运行

---

## 3. 数据 Schema 与溯源字段设计

### 3.1 专业录取分数线记录（`scores_<year>.json` 单条记录）

```typescript
interface ScoreRecord {
  // === 身份标识 ===
  collegeId: string           // 院校 ID（对应 colleges.json 的 id，教育部代码）
  collegeName: string         // 院校名称（冗余存储，便于直接展示）
  year: number                // 录取年份（2023/2024/2025）

  // === 专业信息 ===
  majorName: string           // 专业名称（如"计算机科学与技术"）
  majorCode?: string          // 专业代码（如有，如"080901"）
  majorGroup?: string         // 专业组代码（新高考模式，如"01"）
  majorGroupName?: string     // 专业组名称（如"物理类"）

  // === 录取数据 ===
  province: string            // 生源省份（'浙江' / '江苏'）
  category: string            // 科类：'物理类' / '历史类' / '综合' / '理科' / '文科'
  batch: string               // 录取批次：'本科批' / '专科批' / '提前批'
  minScore: number            // 录取最低分
  minRank: number             // 录取最低位次
  avgScore?: number           // 录取平均分（如有）
  maxScore?: number           // 录取最高分（如有）
  planCount?: number          // 计划招生数（如有）
  actualCount?: number        // 实际录取数（如有）

  // === 溯源元信息 ===
  _meta: {
    source: 'gaokao'          // 数据来源（当前仅阳光高考）
    sourceUrl: string         // 阳光高考详情页 URL
    fetchedAt: string         // ISO 8601 采集时间
    scraperVersion: string    // 采集脚本版本
    verified: boolean         // 是否通过校验（collegeId 存在于 colleges.json）
  }
}
```

### 3.2 一分一段表记录（`rank_table_<year>.json`）

```typescript
interface RankTableRecord {
  province: string            // 省份（'浙江' / '江苏'）
  year: number                // 年份
  category: string            // 科类：'物理类' / '历史类' / '综合' / '理科' / '文科'
  score: number               // 分数（如 650）
  rank: number                // 位次（该分数对应全省排名）
  count: number               // 该分数段人数（同分人数）
  cumulativeCount: number     // 累计人数（该分数及以上总人数）

  // === 溯源元信息 ===
  _meta: {
    source: 'zjzs' | 'jseea'  // 数据来源（浙江/江苏考试院）
    sourceUrl: string         // 考试院发布页 URL
    fetchedAt: string         // ISO 8601 采集时间
    scraperVersion: string    // 采集脚本版本
    verified: boolean         // 是否通过校验（字段完整性）
  }
}

interface RankTableFile {
  province: string
  year: number
  categories: Record<string, RankTableRecord[]>  // 按 category 分组
  _meta: {
    generatedAt: string
    scraperVersion: string
    source: string
    sourceUrl: string
    recordCount: number
  }
}
```

### 3.3 采集元信息文件（`scores.meta.json`）

```typescript
interface ScoresMeta {
  provinces: Array<{
    name: string                              // '浙江' / '江苏'
    years: number[]                           // [2023, 2024, 2025]
    scoreRecordCount: Record<number, number>  // {2023: 1200, 2024: 1350, ...}
    rankTableRecordCount: Record<number, number>
  }>
  generatedAt: string
  scraperVersion: string
  schemaVersion: string
  sources: Array<{
    name: string
    url: string
    coverage: string                          // '分数线' / '一分一段表'
  }>
}
```

### 3.4 溯源字段使用规则

| 场景 | 字段使用 |
|------|---------|
| 前端展示"数据来源" | 读取 `_meta.source` + `_meta.sourceUrl`，渲染为可点击链接 |
| 前端展示"更新日期" | 读取 `scores.meta.json` 的 `generatedAt` |
| 数据校验 | 分数线 `verified=true` 要求 `collegeId` 存在于 `colleges.json` |
| 用户核验 | 点击 `sourceUrl` 跳转阳光高考详情页或考试院发布页 |
| 跨表关联 | 通过 `collegeId` 关联 `colleges.json` 获取院校基础信息 |

### 3.5 数据质量校验规则

**分数线校验**：
1. `collegeId` 必须存在于 `colleges.json`，否则 `verified=false` 并记入 `rejected.json`
2. 必填字段：`collegeId/collegeName/year/majorName/province/category/batch/minScore/minRank`
3. `minScore` 范围合理性：0-750（高考满分区间）
4. `minRank` 为正整数
5. 同一 `(collegeId, year, majorName, province, category)` 唯一，重复时保留第一条

**一分一段表校验**：
1. 必填字段：`province/year/category/score/rank/count/cumulativeCount`
2. `score` 范围：0-750
3. `rank` 和 `cumulativeCount` 为正整数
4. 同一 `(province, year, category)` 内 `score` 唯一且降序
5. `cumulativeCount` 随 `score` 递减而递增（单调性校验）

---

## 4. 采集流程与数据源策略

### 4.1 数据源选择

| 数据源 | 角色 | URL | 抓取内容 | 限速策略 |
|--------|------|-----|---------|---------|
| **阳光高考平台** | 专业录取分数线 | `gaokao.chsi.com.cn/sch/schoolInfo-<id>.dhtml` → "历年录取分数"栏目 | 院校+专业级录取分（按年份/省份/科类） | 每秒 ≤ 2 请求，指数退避重试 |
| **浙江省教育考试院** | 一分一段表 | `zjzs.net` 或 `www.zjzs.net` 的公告/数据栏目 | 浙江省一分一段表（综合类，新高考） | 单页静态，1 次请求/年 |
| **江苏省教育考试院** | 一分一段表 | `jseea.cn` 的数据查询栏目 | 江苏省一分一段表（物理类/历史类，新高考） | 单页静态，1 次请求/年 |

**为何选这些源**：
- 阳光高考是教育部主管平台，专业级录取数据由院校上报，权威性满足要求
- 一分一段表直接来自省考试院，是最权威的全省排名数据
- 浙江自 2017 年起新高考（综合类，不分文理），江苏自 2021 年起新高考（物理类/历史类）

### 4.2 分数线采集流程（5 步）

```
[Step 1] 加载院校白名单
   │  读取 public/data/common/colleges.json
   │  筛选在浙江/江苏招生的院校（或全量，由阳光高考数据决定覆盖范围）
   │  输出：待抓取院校列表
   ▼
[Step 2] 抓取阳光高考详情页
   │  对每个院校，抓取详情页 HTML
   │  cacheKey: scores_<collegeId>
   │  限速：2 QPS
   ▼
[Step 3] 解析历年录取分数
   │  从详情页提取"历年录取分数"栏目
   │  按年份（2023/2024/2025）+ 省份（浙江/江苏）筛选
   │  解析专业级数据：majorName/majorGroup/category/minScore/minRank 等
   ▼
[Step 4] 关联院校白名单
   │  通过 collegeId 关联 colleges.json
   │  collegeId 不在白名单的记录 → verified=false，记入 rejected.json
   ▼
[Step 5] 校验与产出
   │  执行第 3.5 节校验规则
   │  按 province/year 分组写入 scores_<year>.json
   │  生成 scores.meta.json
```

### 4.3 一分一段表采集流程（4 步）

```
[Step 1] 抓取省考试院发布页
   │  浙江：zjzs.net 搜索"一分一段表 2025/2024/2023"
   │  江苏：jseea.cn 搜索"一分一段表 2025/2024/2023"
   │  定位到具体数据页 URL（可能是 HTML 表格或 PDF 附件）
   ▼
[Step 2] 抓取数据页
   │  HTML 表格：直接抓取解析
   │  PDF 附件：下载 + 用 shared/pdf.ts 解析
   ▼
[Step 3] 解析一分一段表
   │  浙江：综合类（新高考不分文理），单表
   │  江苏：物理类 + 历史类，双表
   │  提取 score/rank/count/cumulativeCount
   ▼
[Step 4] 校验与产出
   │  执行第 3.5 节校验规则（单调性、唯一性）
   │  写入 rank_table_<year>.json
```

### 4.4 关键策略说明

**分数线覆盖策略**：
- 阳光高考的专业录取数据依赖院校上报，覆盖率不可能 100%
- 对缺失院校/年份，不降级粒度，标记为"数据待补充"
- 前端展示时对缺失数据明确提示"该院校未上报录取数据"

**一分一段表格式适配**：
- 浙江考试院：2023-2025 均为综合类（不分文理），单表
- 江苏考试院：2023-2025 均为物理类+历史类，双表
- 若某年发布为 PDF，启用 `shared/pdf.ts` 解析；若为 HTML 表格，用 Cheerio 解析
- PDF 解析使用 `pdf-parse` 库（轻量，纯 JS）

**容错与重试**：
- 复用 `HttpClient` 的重试机制（5xx 重试 3 次，指数退避）
- 单个院校抓取失败不阻塞整体流程，记入 `failed.json`
- 一分一段表抓取失败则该省该年数据缺失，记入日志

**增量采集**：
- 复用 `Cache` 机制，`--force` 强制刷新
- 年度更新时只需新增年份配置，重跑即可

---

## 5. 采集脚本模块设计

### 5.1 模块依赖关系

```
┌─────────────────────────────────────────────────────┐
│        scripts/scrapers/scores/index.ts              │
│        （分数线采集编排：串联 5 步流程）              │
└──────────┬──────────────────────────────────────────┘
           │ 调用
           ▼
┌─────────────────────┐
│   gaokao_score.ts   │
│  - fetchScorePage() │  抓取阳光高考详情页
│  - parseScores()    │  解析专业级录取分
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│              shared/                                │
│  - http.ts (复用)    - cache.ts (复用)              │
│  - logger.ts (复用)  - meta.ts (复用)               │
│  - colleges_loader.ts (新增：加载院校白名单)        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│      scripts/scrapers/rank_tables/index.ts          │
│      （一分一段表采集编排：串联 4 步流程）           │
└──────────┬──────────────────────────────────────────┘
           │ 调用
           ▼
┌─────────────────────┐  ┌─────────────────────┐
│   zhejiang.ts       │  │   jiangsu.ts        │
│  - fetchZjTable()   │  │  - fetchJsTable()   │
│  - parseZjTable()   │  │  - parseJsTable()   │
└──────────┬──────────┘  └──────────┬──────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
              ┌──────────────────┐
              │  shared/         │
              │  - http.ts       │  (复用)
              │  - pdf.ts        │  (新增：PDF 解析)
              │  - logger.ts     │  (复用)
              │  - meta.ts       │  (复用)
              └──────────────────┘
```

### 5.2 各模块职责

#### `shared/colleges_loader.ts` — 院校白名单加载（新增）

```typescript
// 职责：
// 1. loadColleges(): 读取 public/data/common/colleges.json，返回 Map<id, CollegeRecord>
// 2. verifyCollegeId(id): 校验 collegeId 是否在白名单中
// 3. 复用：分数线采集时关联院校基础信息

export function loadColleges(): Map<string, CollegeRecord> {
  // 读取 colleges.json，构建 id → record 的 Map
}

export function verifyCollegeId(id: string, colleges: Map<string, CollegeRecord>): boolean {
  return colleges.has(id)
}
```

#### `shared/pdf.ts` — PDF 解析工具（新增）

```typescript
// 职责：
// 1. parsePdf(buffer: Buffer): 提取 PDF 文本内容
// 2. 使用 pdf-parse 库（轻量纯 JS）
// 3. 仅在一分一段表为 PDF 格式时启用

import pdfParse from 'pdf-parse'

export async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  return data.text
}
```

#### `scores/gaokao_score.ts` — 阳光高考分数线抓取+解析

```typescript
// 职责：
// 1. buildScoreUrl(collegeId): 构造阳光高考详情页 URL
//    URL 格式：https://gaokao.chsi.com.cn/sch/schoolInfo-<collegeId>.dhtml
// 2. fetchScorePage(http, collegeId): 抓取详情页 HTML
// 3. parseScores(html, collegeId, collegeName, years, provinces):
//    解析"历年录取分数"栏目
//    - 按年份（2023/2024/2025）+ 省份（浙江/江苏）筛选
//    - 提取专业级数据：majorName/majorGroup/category/batch/minScore/minRank
//    - 每条记录附 _meta（source='gaokao', sourceUrl=详情页URL, verified=true）
// 4. 输出：ScoreRecord[]

// 注意事项：
// - 阳光高考详情页"历年录取"可能是 AJAX 动态加载，需在实现时确认
//   若为动态加载：通过浏览器开发者工具定位 API 接口，直接请求 JSON
//   若为静态 HTML：用 Cheerio 解析
// - 页面结构可能因院校而异，解析器需容错
```

#### `scores/index.ts` — 分数线采集编排

```typescript
async function main() {
  const args = parseArgs()
  logger.info('开始分数线采集', { years: TARGET_YEARS, provinces: TARGET_PROVINCES })

  // Step 1: 加载院校白名单
  const colleges = loadColleges()
  logger.info('院校白名单加载完成', { count: colleges.size })

  // Step 2-3: 抓取+解析阳光高考详情页
  const allScores: ScoreRecord[] = []
  const failed: FailedRecord[] = []

  for (const [collegeId, college] of colleges) {
    try {
      const html = await http.fetch(buildScoreUrl(collegeId), {
        cacheKey: `score_${collegeId}`,
        forceRefresh: args.force,
      })
      const scores = parseScores(html.html, collegeId, college.name, TARGET_YEARS, TARGET_PROVINCES)
      allScores.push(...scores)
      logger.info('院校分数解析完成', { collegeId, collegeName: college.name, count: scores.length })
    } catch (error) {
      failed.push({ url: buildScoreUrl(collegeId), error: (error as Error).message, retryCount: 3 })
    }
    await sleep(1000 / GAOKAO_QPS)  // 限速
  }

  // Step 4: 关联白名单校验
  const verified = allScores.map(s => ({
    ...s,
    _meta: { ...s._meta, verified: verifyCollegeId(s.collegeId, colleges) }
  }))

  // Step 5: 校验与产出
  for (const province of TARGET_PROVINCES) {
    for (const year of TARGET_YEARS) {
      const records = verified.filter(s => s.province === province && s.year === year)
      const validated = records.map(validateScoreRecord).filter(Boolean) as ScoreRecord[]
      await writeOutput(province, year, validated)
    }
  }
  await writeMeta(verified)
}
```

#### `rank_tables/zhejiang.ts` — 浙江一分一段表抓取+解析

```typescript
// 职责：
// 1. fetchZjTable(http, year): 抓取浙江省某年一分一段表
//    - 定位发布页 URL（配置在 config.ts）
//    - 可能是 HTML 表格或 PDF 附件
// 2. parseZjTable(htmlOrText, year): 解析为 RankTableRecord[]
//    - 浙江：综合类（新高考不分文理），单表
//    - 提取 score/rank/count/cumulativeCount
// 3. 输出：RankTableRecord[]

// 注意事项：
// - 浙江考试院一分一段表通常为 HTML 表格或 Excel 附件
// - 若为 Excel：复用 colleges 采集器的 xlsx 解析经验
// - 若为 PDF：使用 shared/pdf.ts
```

#### `rank_tables/jiangsu.ts` — 江苏一分一段表抓取+解析

```typescript
// 职责：
// 1. fetchJsTable(http, year, category): 抓取江苏省某年某科类一分一段表
//    - 江苏：物理类 + 历史类，需分别抓取
// 2. parseJsTable(htmlOrText, year, category): 解析为 RankTableRecord[]
// 3. 输出：RankTableRecord[]

// 注意事项：
// - 江苏考试院一分一段表通常为 HTML 表格
// - 需区分物理类/历史类两个页面或两个表格
```

#### `rank_tables/index.ts` — 一分一段表采集编排

```typescript
async function main() {
  const args = parseArgs()
  logger.info('开始一分一段表采集', { years: TARGET_YEARS, provinces: TARGET_PROVINCES })

  // 浙江（综合类单表）
  for (const year of TARGET_YEARS) {
    try {
      const content = await fetchZjTable(http, year)
      const records = parseZjTable(content, year)
      const validated = records.map(validateRankRecord).filter(Boolean) as RankTableRecord[]
      await writeRankTable('浙江', year, { '综合': validated })
    } catch (error) {
      logger.error('浙江一分一段表抓取失败', { year, error: (error as Error).message })
    }
  }

  // 江苏（物理类 + 历史类双表）
  for (const year of TARGET_YEARS) {
    const categories: Record<string, RankTableRecord[]> = {}
    for (const category of ['物理类', '历史类']) {
      try {
        const content = await fetchJsTable(http, year, category)
        const records = parseJsTable(content, year, category)
        categories[category] = records.map(validateRankRecord).filter(Boolean) as RankTableRecord[]
      } catch (error) {
        logger.error('江苏一分一段表抓取失败', { year, category, error: (error as Error).message })
      }
    }
    await writeRankTable('江苏', year, categories)
  }
}
```

### 5.3 配置扩展（`config.ts` 新增）

```typescript
// 分数线采集配置
export const TARGET_YEARS = [2023, 2024, 2025]
export const TARGET_PROVINCES = ['浙江', '江苏']

// 阳光高考详情页 URL 模板
export const GAOKAO_SCHOOL_DETAIL_URL = 'https://gaokao.chsi.com.cn/sch/schoolInfo-{collegeId}.dhtml'

// 浙江省考试院一分一段表 URL（年度更新时维护，实现时确认实际发布页路径）
export const ZJ_RANK_TABLE_URLS: Record<number, string> = {
  2023: '',  // 实现时填入 zjzs.net 实际发布页 URL
  2024: '',
  2025: '',
}

// 江苏省考试院一分一段表 URL（年度更新时维护，实现时确认实际发布页路径）
export const JS_RANK_TABLE_URLS: Record<number, Record<string, string>> = {
  2023: { '物理类': '', '历史类': '' },
  2024: { '物理类': '', '历史类': '' },
  2025: { '物理类': '', '历史类': '' },
}

// 产出路径
export const SCORES_OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'data', 'scores')
```

### 5.4 npm scripts 扩展

```jsonc
{
  "scripts": {
    "scrape:scores": "tsx scripts/scrapers/scores/index.ts",
    "scrape:scores:force": "tsx scripts/scrapers/scores/index.ts --force",
    "scrape:rank_tables": "tsx scripts/scrapers/rank_tables/index.ts",
    "scrape:rank_tables:force": "tsx scripts/scrapers/rank_tables/index.ts --force",
    "scrape:all": "npm run scrape:colleges && npm run scrape:scores && npm run scrape:rank_tables"
  }
}
```

### 5.5 错误处理与日志

复用已有错误分级策略：

| 错误类型 | 示例 | 处理策略 | 退出码 |
|---------|------|---------|--------|
| **致命错误** | `colleges.json` 不存在、阳光高考站点不可达 | 立即终止 | 2 |
| **可恢复错误** | 单个院校详情页 5xx | 重试 3 次，记入 `failed.json`，继续 | 0（带警告） |
| **数据质量警告** | 院校未上报数据、某年份缺失 | 记入 `warnings.json` | 0（带警告） |
| **校验失败** | `collegeId` 不在白名单、分数越界 | 单条丢弃，记入 `rejected.json` | 1（部分失败） |

---

## 6. 测试、合规与运维策略

### 6.1 测试策略

采用与 colleges 采集器一致的三层测试：fixture 单元测试 + 端到端冒烟测试。

#### 单元测试：解析器（重点）

```
scripts/scrapers/scores/
├── __fixtures__/
│   └── gaokao_score_sample.html      # 阳光高考详情页样例（含 2-3 院校的专业级分数）
└── __tests__/
    ├── gaokao_score.test.ts          # 解析专业级录取分
    └── e2e.test.ts                   # 端到端冒烟

scripts/scrapers/rank_tables/
├── __fixtures__/
│   ├── zhejiang_sample.html          # 浙江一分一段表样例（综合类）
│   └── jiangsu_sample.html           # 江苏一分一段表样例（物理类+历史类）
└── __tests__/
    ├── zhejiang.test.ts              # 解析浙江一分一段表
    ├── jiangsu.test.ts               # 解析江苏一分一段表
    └── e2e.test.ts                   # 端到端冒烟
```

**测试覆盖点**：

| 模块 | 覆盖点 |
|------|--------|
| `gaokao_score` | 详情页结构解析、年份/省份筛选、专业级字段提取、空数据兜底、AJAX 接口降级 |
| `zhejiang` | 综合类单表解析、score/rank/count/cumulativeCount 提取、单调性校验 |
| `jiangsu` | 物理类/历史类双表解析、科类区分、字段提取 |
| `validate` | 必填字段、分数范围（0-750）、位次正整数、唯一性、单调性 |
| `e2e` | 完整流程：parse → validate → output，`_meta` 字段完整，跨表关联（`collegeId` 关联 `colleges.json`） |

#### 端到端冒烟测试

- **不依赖真实网络**：使用 `--dry-run` + fixture
- 验证完整流程：`fetch → parse → validate → output`
- 断言产出文件结构、记录数、`_meta` 字段、跨表关联（`collegeId` 关联 `colleges.json`）

### 6.2 法律与合规

| 维度 | 措施 |
|------|------|
| **robots.txt** | 采集前检查阳光高考/浙江考试院/江苏考试院的 robots.txt |
| **请求频率** | 阳光高考限速 2 QPS（约 2900 院校需 25 分钟）；考试院单页请求无压力 |
| **数据版权** | 录取分数为公开事实数据；一分一段表为官方公开数据；产出 JSON 注明来源 |
| **User-Agent** | 复用已有 `VolunteerAssistant/1.0` 标识 |
| **用途声明** | 仅用于公益志愿填报助手，不商用、不转售 |

### 6.3 数据更新与版本管理

**版本号策略**（`scraperVersion`，遵循 semver）：

| 变更类型 | 示例 | 版本号变化 |
|---------|------|-----------|
| MAJOR | Schema 字段变更、产出格式不兼容 | 1.0.0 → 2.0.0 |
| MINOR | 新增年份、新增省份 | 1.0.0 → 1.1.0 |
| PATCH | 修复解析 bug、调整限速 | 1.0.0 → 1.0.1 |

**年度更新流程**：

1. 每年 6-8 月各省考试院发布当年一分一段表 → 更新 `config.ts` 中的 URL
2. 阳光高考院校陆续上报当年录取数据（通常 8-9 月）→ 重跑 `scrape:scores:force`
3. 对比 `scores.meta.json` 与上一年度的差异
4. 提交 PR，review 后合并

### 6.4 监控与可观测性

**分数线采集报告**：

```
[分数线采集报告] ============================================
版本: 1.0.0 | 耗时: 25m 12s | 时间: 2026-06-17T14:30:00Z
------------------------------------------------------
院校白名单: 2919 所
抓取成功:   2850 所（失败 69 所）
------------------------------------------------------
浙江 2023: 1200 条专业级分数
浙江 2024: 1350 条
浙江 2025: 800 条（部分院校未上报）
江苏 2023: 1100 条
江苏 2024: 1280 条
江苏 2025: 750 条
------------------------------------------------------
总计产出:   6480 条
校验拒绝:   12 条（collegeId 不在白名单）
警告:       69 条（院校抓取失败）
======================================================
```

**一分一段表采集报告**：

```
[一分一段表采集报告] ============================================
版本: 1.0.0 | 耗时: 45s | 时间: 2026-06-17T14:55:00Z
------------------------------------------------------
浙江 2023: 综合类 1050 条
浙江 2024: 综合类 1080 条
浙江 2025: 综合类 1100 条
江苏 2023: 物理类 980 条 + 历史类 850 条
江苏 2024: 物理类 1000 条 + 历史类 870 条
江苏 2025: 物理类 1020 条 + 历史类 890 条
------------------------------------------------------
总计产出:   8840 条
校验拒绝:   0 条
======================================================
```

### 6.5 已知限制与应对

| 限制 | 影响 | 应对 |
|------|------|------|
| 阳光高考覆盖率非 100% | 部分院校/年份无专业级分数 | 前端明确提示"该院校未上报数据"，不降级粒度 |
| 阳光高考详情页可能 AJAX 动态加载 | Cheerio 无法解析 | 实现时先验证页面结构，必要时改用 API 接口 |
| 考试院一分一段表格式年度间可能变化 | 解析器需适配 | 模块化设计，每省独立解析器，便于单独修复 |
| 2025 年数据可能未完整发布 | 2025 分数线覆盖率低 | 正常现象，标记为"数据待补充"，后续重跑 |

---

## 7. 实施计划

### 7.1 实施顺序

1. **类型与配置扩展**：`types.ts` 新增 Score/RankTable 类型，`config.ts` 新增数据源配置
2. **shared 层扩展**：`colleges_loader.ts` + `pdf.ts`
3. **分数线采集器**：`gaokao_score.ts` + fixture + 单元测试
4. **分数线编排**：`scores/index.ts` + 端到端测试
5. **浙江一分一段表**：`zhejiang.ts` + fixture + 单元测试
6. **江苏一分一段表**：`jiangsu.ts` + fixture + 单元测试
7. **一分一段表编排**：`rank_tables/index.ts` + 端到端测试
8. **首次全量采集**：运行真实采集，产出数据
9. **前端集成准备**：验证数据格式，准备接入

### 7.2 验收标准

- [ ] 分数线采集器解析阳光高考详情页正确，专业级字段完整
- [ ] 分数线记录 `collegeId` 可关联 `colleges.json`，`verified=true`
- [ ] 浙江一分一段表解析正确，综合类单表，单调性校验通过
- [ ] 江苏一分一段表解析正确，物理类+历史类双表，单调性校验通过
- [ ] 产出 `scores_<year>.json` 按 province/year 分组，结构正确
- [ ] 产出 `rank_table_<year>.json` 结构正确，含 categories 分组
- [ ] `_meta` 字段完整，溯源 URL 可访问
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 端到端冒烟测试通过
- [ ] `npm run scrape:scores` 和 `npm run scrape:rank_tables` 可独立运行

---

## 文档变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-06-17 | 初始版本 | 智填志愿团队 |
