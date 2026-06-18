# 院校基础数据采集系统设计

> **版本**：v1.0
> **日期**：2026-06-17
> **状态**：待评审
> **文档类型**：技术设计文档
> **关联文档**：[requirements.md](../../requirements.md)、[technical-design.md](../../technical-design.md)

---

## 1. 背景与目标

### 1.1 背景

智填志愿前端原型已构建完成，当前使用 `src/data/mock.ts` 中的 mock 数据。下一步需采集真实院校基础信息，替换 mock 数据，为推荐引擎、风险预警、数据中心等模块提供权威数据底座。

### 1.2 目标

- 采集全国所有正规院校的基础信息（含官网链接，用于核验真伪）
- 数据存储在本地，可溯源至权威来源
- 从源头杜绝野鸡大学
- 采集流程可重复执行，支持年度更新

### 1.3 范围

**本批次范围**：
- 全国院校基础信息（约 2600+ 所）
- 字段：身份标识、基础属性、关键链接、溯源元信息

**不在本批次范围**（后续阶段）：
- 各专业招生分数线
- 一分一段表
- 各省政策规则
- 招生章程详情

### 1.4 关键约束

| 约束 | 说明 |
|------|------|
| 数据源 | 教育部全国高等学校名单 + 阳光高考平台 |
| 采集方式 | 自动化脚本采集 |
| 溯源粒度 | URL + 采集日期 + 脚本版本号 |
| 技术栈 | Node.js + TypeScript（与前端项目同栈） |
| 反野鸡大学 | 教育部名单作为白名单，未在名单中的院校一律丢弃 |

---

## 2. 整体架构与目录布局

采集脚本作为项目内的独立工具链，与前端代码同仓不同目录，共享 TypeScript 类型。

```
volunteer-assistant/
├── scripts/
│   └── scrapers/
│       ├── colleges/                    # 院校采集器
│       │   ├── moe_list.ts              # 教育部名单抓取（白名单源）
│       │   ├── gaokao_detail.ts         # 阳光高考详情抓取（字段补充）
│       │   ├── merge.ts                 # 双源交叉合并 + 校验
│       │   └── index.ts                 # 采集编排入口
│       ├── shared/
│       │   ├── http.ts                  # 统一 HTTP 客户端（重试/限速/User-Agent）
│       │   ├── cache.ts                 # 原始响应缓存（避免重复抓取）
│       │   ├── logger.ts                # 结构化日志
│       │   └── meta.ts                  # 溯源字段生成工具
│       ├── types.ts                     # 采集层类型定义
│       └── config.ts                    # 采集配置（超时/并发/输出路径）
├── public/
│   └── data/
│       └── common/
│           ├── colleges.json            # 最终产出（供前端使用）
│           └── colleges.meta.json       # 采集元信息（来源/日期/版本/统计）
├── raw/                                 # 原始抓取响应（git-ignored，本地保留）
│   └── colleges/
│       ├── moe_list.html
│       └── gaokao_detail/<school_id>.html
└── src/data/                            # 前端 mock（保留，待真实数据替换后清理）
```

### 2.1 关键设计点

1. **白名单优先**：教育部名单作为"真伪校验门"，未在名单中的院校直接丢弃，从源头杜绝野鸡大学
2. **双源交叉**：教育部名单提供权威 ID 和基础字段，阳光高考补充官网 URL、招生办电话、办学性质等
3. **原始响应留档**：`raw/` 目录保留抓取到的原始 HTML，便于事后核查（不入 git，避免仓库膨胀）
4. **溯源字段统一**：所有产出 JSON 的每条记录都附 `_meta` 字段，由 `shared/meta.ts` 统一生成
5. **采集器可独立运行**：`npm run scrape:colleges` 触发完整流程，也可单步执行

---

## 3. 数据 Schema 与溯源字段设计

### 3.1 院校记录 Schema（`colleges.json` 单条记录）

```typescript
interface CollegeRecord {
  // === 身份标识 ===
  id: string                  // 教育部院校代码（5 位国标码，如 '10003' 清华）
  moeCode: string             // 教育部名单原始代码（保留原值用于溯源核对）
  name: string                // 院校名称（以教育部名单为准）
  aliases?: string[]          // 曾用名/简称（如"北航"）

  // === 基础属性 ===
  province: string            // 所在省份（如 '北京'）
  city: string                // 所在城市（如 '北京'）
  level: string[]             // 办学层次：['985','211','双一流'] / ['普通本科'] 等
  type: string                // 院校类型：综合/理工/师范/农林/医药/财经/政法/民族/军事/艺术/体育/语言
  nature: 'public' | 'private' | 'joint'  // 办学性质：公办/民办/中外合办
  affiliation: string         // 主管部门（如 '教育部'/'浙江省'）

  // === 关键链接（用于核验真伪） ===
  officialWebsite: string     // 院校官网（阳光高考补充；可能为空，空时前端展示"官网待核验"标签）
  gaokaoUrl: string           // 阳光高考详情页 URL（用于溯源跳转）
  admissionUrl?: string       // 招生网 URL（如有）

  // === 学科信息（可选，后续阶段补充） ===
  subjectCategories?: string[]  // 招生学科门类
  majorCount?: number           // 本科专业数

  // === 溯源元信息（每条记录必填） ===
  _meta: {
    source: 'moe_list' | 'gaokao' | 'merged'  // 数据来源
    sourceUrl: string           // 主要来源 URL
    fetchedAt: string           // ISO 8601 采集时间
    scraperVersion: string      // 采集脚本版本（semver，如 '1.0.0'）
    verified: boolean           // 是否通过教育部白名单校验
  }
}
```

### 3.2 采集元信息文件（`colleges.meta.json`）

```typescript
interface CollegesMeta {
  totalCount: number                          // 院校总数
  publicCount: number                         // 公办数量
  privateCount: number                        // 民办数量
  byProvince: Record<string, number>          // 各省院校数
  byLevel: Record<string, number>             // 各层次统计
  generatedAt: string                         // ISO 8601 生成时间
  scraperVersion: string                      // 采集器版本
  sources: Array<{
    name: string                              // '教育部全国高等学校名单'
    url: string                               // 名单发布页 URL
    fetchedAt: string                         // 抓取时间
    recordCount: number                       // 该源贡献记录数
  }>
  schemaVersion: string                       // 数据 schema 版本（如 '1.0.0'）
}
```

### 3.3 溯源字段使用规则

| 场景 | 字段使用 |
|------|---------|
| 前端展示"数据来源" | 读取 `_meta.source` + `_meta.sourceUrl`，渲染为可点击链接 |
| 前端展示"更新日期" | 读取 `colleges.meta.json` 的 `generatedAt` |
| 数据校验 | 启动时校验 `verified=true` 的记录数 = 总数（白名单全覆盖） |
| 版本升级 | `scraperVersion` 不匹配时触发重新采集 |
| 用户核验真伪 | 点击 `officialWebsite` 跳转官网，或点击 `gaokaoUrl` 跳转阳光高考详情页 |

### 3.4 数据质量校验规则

采集完成后自动执行：

1. **白名单校验**：所有记录 `verified=true`，未在教育部名单中的丢弃
2. **必填字段校验**：`id/name/province/city/level/type/nature` 不能为空（`officialWebsite` 允许为空，见规则 3）
3. **官网缺失标记**：`officialWebsite` 为空时 `verified` 仍为 true，但前端展示"官网待核验"标签
4. **ID 唯一性**：`id` 全局唯一，重复时保留教育部名单版本
5. **省份一致性**：教育部名单省份与阳光高考省份必须一致，不一致以教育部为准并记日志

---

## 4. 采集流程与数据源策略

### 4.1 数据源选择

| 数据源 | 角色 | URL | 抓取内容 | 限速策略 |
|--------|------|-----|---------|---------|
| **教育部全国高等学校名单** | 白名单 + 基础字段 | moe.gov.cn 下的名单发布页（具体路径在 `config.ts` 中配置，年度更新时维护） | 院校代码、名称、省份、城市、层次、类型、主管部门、办学性质 | 单页静态，1 次请求 |
| **阳光高考平台** | 字段补充 + 官网链接 | gaokao.chsi.com.cn 下的院校搜索接口（具体路径在 `config.ts` 中配置） | 官网 URL、招生办电话、招生章程链接、院校简介 | 每秒 ≤ 2 请求，指数退避重试 |

**为何选这两个源**：
- 教育部名单是**唯一权威**的"是否正规高校"判定依据，野鸡大学不在其中
- 阳光高考是教育部主管的高校招生平台，详情页含官方维护的官网链接，可信度高
- 两源均无强反爬，HTML 静态渲染，Cheerio 足够

### 4.2 采集流程（5 步）

```
[Step 1] 抓取教育部名单
   │  输入：教育部名单页 URL
   │  输出：raw/colleges/moe_list.html + parsed/moe_list.json
   │  解析：HTML 表格 → 院校记录（id/name/province/city/level/type/nature/affiliation）
   ▼
[Step 2] 抓取阳光高考院校列表
   │  输入：阳光高考搜索接口（按省份分页）
   │  输出：raw/colleges/gaokao_list/<province>_<page>.html
   │  解析：列表页 → 院校摘要（gaokaoId/name/officialWebsite/gaokaoUrl）
   ▼
[Step 3] 双源匹配
   │  按"院校名称"精确匹配（教育部名单为基准）
   │  匹配失败的阳光高考记录 → 丢弃（不在白名单）
   │  匹配失败的教育部记录 → 保留，官网字段标记为"待核验"
   │  输出：parsed/matched.json
   ▼
[Step 4] 字段合并与去重
   │  教育部字段优先：id/name/province/city/level/type/nature/affiliation
   │  阳光高考补充：officialWebsite/gaokaoUrl/admissionUrl
   │  生成 _meta 字段（source='merged', verified=true）
   ▼
[Step 5] 校验与产出
   │  执行第 3.4 节校验规则
   │  生成 colleges.json + colleges.meta.json
   │  输出统计报告到控制台和 logs/scrape-<timestamp>.log
```

### 4.3 关键策略说明

**匹配策略**：
- 主键匹配：教育部院校代码（5 位）与阳光高考院校代码若能对齐则优先用代码匹配
- 名称兜底：代码无法对齐时，按"院校名称"精确字符串匹配（去除"大学/学院"后缀差异）
- 模糊匹配禁用：避免误匹配导致数据污染，匹配失败一律走"待核验"分支

**容错与重试**：
- HTTP 客户端统一封装：超时 30s，5xx 重试 3 次，指数退避（1s/2s/4s）
- 单条院校抓取失败不阻塞整体流程，记录到 `failed.json`，结束后汇总报告
- 阳光高考限速：每秒 2 请求，避免触发反爬

**增量采集**（为后续年度更新预留）：
- `cache.ts` 按 URL 哈希缓存响应到 `raw/`，重跑时优先读缓存
- 通过 `--force` 参数强制刷新，默认走缓存
- 年度更新时只需重跑 Step 1（教育部名单可能新增/撤销院校）

---

## 5. 采集脚本模块设计

### 5.1 模块依赖关系

```
┌─────────────────────────────────────────────────────┐
│              scripts/scrapers/colleges/index.ts      │
│              （编排入口：串联 5 步流程）              │
└──────────┬──────────────────────────────────────────┘
           │ 调用
           ▼
┌─────────────────────┐  ┌─────────────────────┐
│   moe_list.ts       │  │  gaokao_detail.ts   │
│  教育部名单抓取      │  │  阳光高考抓取        │
│  - fetchMoeList()   │  │  - fetchGaokaoList()│
│  - parseMoeList()   │  │  - parseGaokaoList()│
└──────────┬──────────┘  └──────────┬──────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
              ┌──────────────────┐
              │   merge.ts       │
              │  - matchColleges│  双源匹配
              │  - mergeFields  │  字段合并
              │  - validateRec  │  校验
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  shared/         │
              │  - http.ts       │  HTTP 客户端
              │  - cache.ts      │  响应缓存
              │  - logger.ts     │  日志
              │  - meta.ts       │  溯源字段
              └──────────────────┘
```

### 5.2 各模块职责

#### `shared/http.ts` — 统一 HTTP 客户端

```typescript
interface FetchOptions {
  cacheKey?: string                       // 启用缓存时的 key
  forceRefresh?: boolean                  // 忽略缓存
  timeout?: number                        // 默认 30s
  rateLimit?: { perSecond: number }       // 限速
}

interface FetchResult {
  html: string
  fromCache: boolean
  fetchedAt: string
  url: string
}

// 关键能力：
// 1. 自动重试：5xx 重试 3 次，指数退避 1s/2s/4s
// 2. 限速队列：基于令牌桶，保证全局 QPS 不超限
// 3. 缓存读写：cacheKey 命中时直接返回 raw/ 中的文件
// 4. User-Agent：设置为 Mozilla 标识，避免被简单反爬拦截
```

#### `shared/cache.ts` — 响应缓存

```typescript
// 缓存策略：
// - 存储路径：raw/<scope>/<hash(url)>.html
// - 命中条件：文件存在 && --force 未启用
// - 缓存失效：手动删除 raw/ 目录或 scraperVersion 升级
// - 不入 git：raw/ 加入 .gitignore
```

#### `shared/meta.ts` — 溯源字段生成

```typescript
function buildMeta(
  source: SourceType,
  url: string,
  verified: boolean
): Meta {
  return {
    source,
    sourceUrl: url,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified,
  }
}
```

#### `moe_list.ts` — 教育部名单抓取

```typescript
// 职责：
// 1. fetchMoeList(): 抓取教育部名单页 HTML（单页或分页）
// 2. parseMoeList(html): Cheerio 解析表格，提取字段
//    - 表格列：序号、学校名称、学校标识码、主管部门、所在省、所在地、办学层次、办学性质
//    - 映射到 CollegeRecord 的基础字段
// 3. 输出：MoeRecord[]（白名单基准数据）

// 注意事项：
// - 教育部名单页可能为 Excel/PDF 下载而非 HTML，需在实现时确认
//   若为 Excel：用 xlsx 库解析
//   若为 HTML 表格：用 Cheerio 解析
// - 名单页 URL 可能随年度更新，配置在 config.ts 中便于维护
```

#### `gaokao_detail.ts` — 阳光高考抓取

```typescript
// 职责：
// 1. fetchGaokaoList(): 按省份分页抓取院校列表
//    - 阳光高考支持按省份筛选，每页 20 条
//    - 共 31 个省级行政区（含港澳台，按需过滤）
// 2. parseGaokaoList(html): 解析列表页，提取 gaokaoId/name/officialWebsite/gaokaoUrl
// 3. 输出：GaokaoRecord[]（补充字段来源）

// 限速：
// - 全局 QPS = 2，通过 http.ts 的令牌桶控制
// - 分页间隔 500ms
```

#### `merge.ts` — 双源合并

```typescript
// 职责：
// 1. matchColleges(moe, gaokao): 双源匹配
//    - 优先按院校代码匹配（若阳光高考返回代码）
//    - 否则按名称精确匹配（去除"大学/学院"后缀）
//    - 匹配失败的阳光高考记录 → 丢弃（不在白名单）
//    - 匹配失败的教育部记录 → 保留，officialWebsite 留空
// 2. mergeFields(matched): 字段合并
//    - 教育部字段优先
//    - 阳光高考补充 officialWebsite/gaokaoUrl
// 3. validateRecord(record): 执行第 3.4 节校验规则
//    - 必填字段非空
//    - ID 唯一
//    - 省份一致性
// 4. 输出：CollegeRecord[] + 校验报告
```

#### `index.ts` — 编排入口

```typescript
async function main() {
  logger.info('开始院校数据采集', { version: SCRAPER_VERSION })

  // Step 1: 教育部名单
  const moeHtml = await http.fetch(MOE_LIST_URL, { cacheKey: 'moe_list' })
  const moeRecords = parseMoeList(moeHtml.html)

  // Step 2: 阳光高考列表
  const gaokaoRecords: GaokaoRecord[] = []
  for (const province of PROVINCES) {
    for (const page of pages(province)) {
      const html = await http.fetch(gaokaoUrl(province, page), {
        cacheKey: `gaokao_${province}_${page}`,
        rateLimit: { perSecond: 2 },
      })
      gaokaoRecords.push(...parseGaokaoList(html.html))
    }
  }

  // Step 3-4: 匹配与合并
  const merged = matchAndMerge(moeRecords, gaokaoRecords)

  // Step 5: 校验与产出
  const validated = merged.map(validateRecord).filter(Boolean)
  await writeOutput(validated)
  await writeMeta(validated)

  logger.info('采集完成', { total: validated.length })
}
```

### 5.3 配置与 npm scripts

```jsonc
// package.json 新增
{
  "scripts": {
    "scrape:colleges": "tsx scripts/scrapers/colleges/index.ts",
    "scrape:colleges:force": "tsx scripts/scrapers/colleges/index.ts --force",
    "scrape:colleges:dry": "tsx scripts/scrapers/colleges/index.ts --dry-run"
  },
  "devDependencies": {
    "tsx": "^4.x",
    "cheerio": "^1.x",
    "axios": "^1.x"
  }
}
```

**`--dry-run` 模式**：仅解析已缓存的 `raw/` 文件，不发起网络请求，用于离线调试解析逻辑。

---

## 6. 错误处理、测试与运维策略

### 6.1 错误分级与处理矩阵

| 错误类型 | 示例 | 处理策略 | 退出码 |
|---------|------|---------|--------|
| **致命错误** | 教育部名单页无法访问、HTML 结构变更导致解析 0 条 | 立即终止，输出错误日志，不产出文件 | 2 |
| **可恢复错误** | 单条阳光高考页面 5xx、超时 | 重试 3 次（指数退避），仍失败则记录到 `failed.json`，继续处理其他 | 0（带警告） |
| **数据质量警告** | 官网缺失、省份不一致、名称匹配失败 | 记录到 `warnings.json`，不阻塞产出 | 0（带警告） |
| **校验失败** | 必填字段为空、ID 重复 | 单条丢弃，记录到 `rejected.json`，继续处理其他 | 1（部分失败） |

**产出文件清单**（每次采集后）：

```
public/data/common/
├── colleges.json              # 正式产出（通过校验的记录）
├── colleges.meta.json         # 全局元信息
└── reports/
    ├── failed.json            # 抓取失败记录（网络错误）
    ├── warnings.json          # 数据质量警告
    └── rejected.json          # 校验失败被丢弃的记录
```

### 6.2 测试策略

采用**快照测试 + 解析器单元测试 + 端到端冒烟测试**三层。

#### 单元测试：解析器（重点）

解析逻辑是采集器的核心，必须独立可测。使用**固定 HTML fixture**避免网络依赖：

```
scripts/scrapers/colleges/
├── __fixtures__/
│   ├── moe_list_sample.html      # 教育部名单样例（含 5-10 条）
│   ├── gaokao_list_sample.html   # 阳光高考列表样例
│   └── gaokao_detail_sample.html # 详情页样例
└── __tests__/
    ├── moe_list.test.ts          # 解析教育部名单
    ├── gaokao_detail.test.ts     # 解析阳光高考
    ├── merge.test.ts             # 双源匹配与合并
    └── validate.test.ts          # 校验规则
```

**测试覆盖点**：
- 教育部名单解析：表格列映射、空值处理、特殊字符（如"（中外合作办学）"后缀）
- 阳光高考解析：分页元数据、官网链接提取、缺失字段兜底
- 合并逻辑：代码匹配、名称匹配、匹配失败分支、字段优先级
- 校验规则：必填字段、ID 唯一性、省份一致性、白名单校验

#### 端到端冒烟测试

- **不依赖真实网络**：使用 `--dry-run` 模式 + 预置 `raw/` fixture
- 验证完整流程：`fetch → parse → merge → validate → output`
- 断言产出文件存在、记录数符合预期、`_meta` 字段完整

#### 测试命令

```jsonc
{
  "scripts": {
    "test:scrapers": "vitest run scripts/scrapers",
    "test:scrapers:watch": "vitest scripts/scrapers"
  }
}
```

### 6.3 数据更新与版本管理

**版本号策略**（`scraperVersion`，遵循 semver）：

| 变更类型 | 示例 | 版本号变化 |
|---------|------|-----------|
| MAJOR | Schema 字段变更、产出格式不兼容 | 1.0.0 → 2.0.0 |
| MINOR | 新增采集字段、新增数据源 | 1.0.0 → 1.1.0 |
| PATCH | 修复解析 bug、调整限速参数 | 1.0.0 → 1.0.1 |

**年度更新流程**：

1. 教育部每年 6-7 月发布最新名单 → 更新 `config.ts` 中的 URL
2. 运行 `npm run scrape:colleges:force`（强制刷新缓存）
3. 对比 `colleges.meta.json` 与上一年度的差异（新增/撤销院校）
4. 提交 PR，review 后合并到 main 分支

### 6.4 法律与合规

| 维度 | 措施 |
|------|------|
| **robots.txt** | 采集前检查教育部/阳光高考的 robots.txt，遵守 Disallow 规则 |
| **请求频率** | 阳光高考限速 2 QPS，避免对服务造成压力 |
| **数据版权** | 院校基础信息为公开事实数据，无版权问题；产出 JSON 注明来源 |
| **User-Agent** | 设置真实可联系的 UA（如 `VolunteerAssistant/1.0 (educational project)`） |
| **用途声明** | 仅用于公益志愿填报助手，不商用、不转售 |

### 6.5 监控与可观测性

采集脚本运行时的关键指标：

```
[采集报告] ============================================
版本: 1.0.0 | 耗时: 8m 32s | 时间: 2026-06-17T10:23:11Z
------------------------------------------------------
教育部名单: 2631 条
阳光高考:   2589 条（抓取失败 42 条）
匹配成功:   2547 条
匹配失败:   阳光高考侧 42 条（丢弃），教育部侧 84 条（待核验）
------------------------------------------------------
最终产出:   2631 条（含 84 条官网待核验）
校验拒绝:   0 条
警告:       84 条（官网缺失）
======================================================
```

报告同时写入 `logs/scrape-<timestamp>.log`，便于历史追溯。

---

## 7. 实施计划

### 7.1 实施顺序

1. **基础设施层**：`shared/` 模块（http/cache/logger/meta）+ `types.ts` + `config.ts`
2. **教育部名单采集器**：`moe_list.ts` + fixture + 单元测试
3. **阳光高考采集器**：`gaokao_detail.ts` + fixture + 单元测试
4. **合并与校验**：`merge.ts` + 单元测试
5. **编排入口**：`index.ts` + 端到端冒烟测试
6. **首次全量采集**：运行真实采集，产出 `colleges.json`
7. **前端集成**：替换 mock 数据，接入溯源字段展示

### 7.2 验收标准

- [ ] 教育部名单解析正确，记录数与官方发布一致
- [ ] 阳光高考列表解析正确，官网链接可访问
- [ ] 双源匹配率 ≥ 95%（允许少量名称差异导致的未匹配）
- [ ] 产出 `colleges.json` 记录数 ≥ 2600 条
- [ ] 所有记录 `verified=true`，无野鸡大学
- [ ] `_meta` 字段完整，溯源 URL 可访问
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 端到端冒烟测试通过
- [ ] `npm run scrape:colleges` 可一键执行完整流程

---

## 文档变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-06-17 | 初始版本 | 智填志愿团队 |
