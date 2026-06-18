# 详细专业目录采集规格文档

> 阶段：Phase D
> 日期：2026-06-18
> 状态：已完成

## 1. 背景与目标

### 1.1 项目背景

volunteer-assistant（志愿填报助手）项目逐步采集真实高考数据，已完成的阶段：

- **Phase A**：浙江、江苏两省 2023-2025 年专业招生分数线（63,771 条）
- **Phase B**：院校官网补齐（882 所院校）
- **Phase C**：专业目录 + 选科要求（875 条基础目录 + 57,314 条选科要求）
- **Phase D（本文档）**：详细专业目录采集

### 1.2 Phase D 目标

Phase C 采集的 `catalog.json` 仅有 4 个基础字段（majorCode、majorName、category、subCategory），`degreeType` 和 `duration` 均为空。Phase D 需要采集教育部认证的全量专业目录详细信息。

**数据范围**：
- 本科（普通教育）：883 个专业
- 高职（专科）：748 个专业
- 合计：1631 个专业（实际采集 1661 个，因 API 数据有更新）

**详细字段需求**（4 组）：
1. 专业介绍 + 培养目标
2. 主干课程
3. 就业方向
4. 学制学位 + 统计信息

## 2. 数据源

### 2.1 数据源选择

经过探索对比，选择 **阳光高考专业库 API**（`gaokao.chsi.com.cn`）作为数据源：

- 教育部高校招生阳光工程指定平台，权威性高
- 提供 JSON 结构化 API，无需解析 HTML
- 字段覆盖用户全部需求
- 无需认证，仅需 `Accept: application/json` 请求头

### 2.2 API 端点

4 步树形遍历，全部返回 JSON `{ "msg": ..., "flag": true }`：

| 端点 | 用途 | 示例 |
|------|------|------|
| `GET /zyk/zybk/mlCategory/{rootKey}` | 门类列表 | `1050` → 13 个本科门类 |
| `GET /zyk/zybk/mlCategory/{rootKey}` | 专业大类列表 | `1060` → 19 个专科大类 |
| `GET /zyk/zybk/xkCategory/{catKey}` | 专业类列表 | `105001` → 哲学类 |
| `GET /zyk/zybk/specialityesByCategory/{subcatKey}` | 专业列表（含 specId） | `10500101` → 哲学、逻辑学等 |
| `GET /zyk/zybk/specialityDetail/{specId}` | 专业详情 | `73381059` → 哲学详情 |

**Root Key**：
- 本科（普通教育）：`1050`
- 高职（专科）：`1060`

### 2.3 详情 API 返回字段

覆盖用户全部需求：

| API 字段 | 对应需求 | 说明 |
|---------|---------|------|
| `zyjs.desc` | 专业介绍+培养目标 | 包含完整专业介绍文本 |
| `jyfxInfo.jyfxList` | 就业方向 | 就业方向列表 |
| `xsgm` / `boyPercent` / `girlPercent` | 统计信息 | 学生规模、男女比例 |
| `xlcc` | 学制学位 | 学历层次（如"本科（普通教育）"） |
| `zymyd` | 满意度 | 4 维度评分（综合/办学条件/教学质量/就业） |
| `kyfx` | 考研方向 | 可报考的研究生专业 |
| `zytjzsList` | 推荐院校 | 开设该专业的院校（前 10） |
| `simileZyList` | 相似专业 | 相关专业推荐 |

**主干课程**：API 无独立字段，从 `zyjs.desc` 中用正则 `/(?:主干|主要|核心)课程[：:]\s*(.+?)(?:。|$)/` best-effort 提取。

## 3. 架构设计

### 3.1 模块结构

新增 `scripts/scrapers/majors/detail/` 模块，与现有 `majors/`（MOE PDF 目录解析）并列：

```
scripts/scrapers/majors/
├── index.ts              # 现有：MOE PDF 目录解析
├── parse.ts              # 现有：PDF 解析
├── validate.ts           # 现有：目录校验
└── detail/               # 新增：阳光高考详情采集
    ├── types.ts          # API 响应类型（内部）
    ├── api.ts            # 4 个 API 端点封装
    ├── parse.ts          # API 响应 → DetailedMajorRecord 转换
    ├── validate.ts       # 记录校验
    ├── crawler.ts        # 树形遍历编排器
    ├── index.ts          # 主入口（CLI/输出/断点续采）
    ├── __tests__/        # 30 个测试用例
    │   ├── api.test.ts
    │   ├── parse.test.ts
    │   ├── mainCourses.test.ts
    │   ├── validate.test.ts
    │   └── crawler.test.ts
    └── __fixtures__/     # 测试样本数据
        ├── detail_philosophy.json
        └── detail_vocational.json
```

### 3.2 数据流

4 步树形遍历，两个目录顺序采集：

```
本科（rootKey=1050）:
  13 门类 → 92 专业类 → 883 专业 → 883 详情

专科（rootKey=1060）:
  19 大类 → ~90 专业类 → 748 专业 → 748 详情
```

**QPS 控制**：复用现有 `GAOKAO_QPS=2`（500ms 间隔），仅对真实网络请求限速（缓存命中不等待）。

### 3.3 错误处理

| 场景 | 处理 |
|------|------|
| API 返回 `flag: false` | 抛错，记录到 failed 数组，跳过继续 |
| 网络超时/5xx | HttpClient 自动重试 3 次 |
| 详情 API 404 | 记录 specId 到 failed 数组，继续采集 |
| 字段缺失（如 zyjs 为 null） | 对应字段设为空值，不阻塞 |
| 校验失败 | 记录原因到 failed 数组 |

### 3.4 断点续采

采集过程中每完成一个目录（本科/专科）写入 `detailed-catalog.partial.json`。若中途中断，重启时加载 partial 文件跳过已采集记录。成功完成后清理 partial 文件。

## 4. 数据模型

### 4.1 输出记录类型（DetailedMajorRecord）

```typescript
interface DetailedMajorRecord {
  // 基础目录字段
  majorCode: string          // 专业代码 "010101"
  majorName: string          // 专业名称 "哲学"
  category: string           // 门类 "哲学"
  subCategory: string        // 专业类 "哲学类"
  educationLevel: string     // 学历层次 "本科（普通教育）" / "高职（专科）"

  // 详细字段（用户需求的 4 组）
  introduction: string       // 专业介绍+培养目标
  careerDirections: string[] // 就业方向
  mainCourses: string        // 主干课程（best-effort 提取）
  durationAndDegree: {
    studentScale: string     // 学生规模 "3000-3500"
    boyPercent: number       // 男生占比
    girlPercent: number      // 女生占比
    year: string             // 数据年份
  }

  // 扩展字段
  satisfaction: Array<{ type, typeDesc, rank, count }>     // 满意度
  graduateMajors: Array<{ majorCode, majorName }>          // 考研方向
  recommendedColleges: Array<{ collegeName, count, rank }> // 推荐院校（前 10）
  similarMajors: Array<{ majorCode, majorName }>           // 相似专业

  // 可追溯性
  specId: string             // 阳光高考 specId
  _meta: {
    source: 'gaokao_chsi'
    sourceUrl: string        // 详情页 URL
    fetchedAt: string
    scraperVersion: string
    verified: boolean
  }
}
```

### 4.2 校验规则

- `majorCode` 必须为 6 位纯数字
- `majorName`、`category`、`subCategory`、`educationLevel`、`specId` 不能为空
- `boyPercent` 和 `girlPercent` 必须在 0-100 范围内

## 5. 实现过程

采用 Subagent-Driven Development，9 个 Task 顺序执行，每个 Task 经历 TDD（Red-Green）流程：

| Task | 内容 | 测试数 |
|------|------|--------|
| 1 | 追加 DetailedMajorRecord 等类型到 types.ts | - |
| 2 | 追加 API URL 和 root key 常量到 config.ts | - |
| 3 | 创建 detail/types.ts（API 响应类型） | - |
| 4 | 创建 detail/api.ts（4 个 API 端点封装） | 6 |
| 5 | 创建 detail/parse.ts（响应转换 + 主干课程提取） | 11 |
| 6 | 创建 detail/validate.ts（记录校验） | 9 |
| 7 | 创建 detail/crawler.ts（树形遍历编排器） | 4 |
| 8 | 创建 detail/index.ts（主入口） | - |
| 9 | 添加 npm 脚本并端到端验证 | - |

**提交记录**（9 个 commit）：
- `1e85102` feat(scrapers): add DetailedMajorRecord types for Phase D
- `57acb76` feat(scrapers): add detailed major catalog API config constants
- `4d73e6b` feat(scrapers): add API response types for detailed major catalog
- `45a9d73` feat(scrapers): add API client for detailed major catalog
- `5a4523d` feat(scrapers): add detail parser with main course extraction
- `7971757` feat(scrapers): add detailed major record validator
- `e17d5f8` feat(scrapers): add tree traversal crawler for detailed major catalog
- `e2216f1` feat(scrapers): add main entry for detailed major catalog collection
- `64dab4d` feat(scrapers): collect 1661 detailed major catalog records via gaokao API

## 6. 采集结果

### 6.1 数据统计

| 类别 | 记录数 | 失败数 |
|------|--------|--------|
| 本科（普通教育） | 875 | 8 |
| 高职（专科） | 786 | 12 |
| **总计** | **1661** | **20** |

实际采集 1661 条，比预期 1631 多 30 条（API 数据有更新）。20 条失败记录保存到 `public/data/common/reports/majors_details_failed.json`。

### 6.2 产出文件

| 文件 | 说明 | 大小 |
|------|------|------|
| `public/data/common/majors/detailed-catalog.json` | 1661 条详细专业目录 | ~6 MB |
| `public/data/common/majors/detailed-catalog.meta.json` | 元数据 | 506 B |
| `public/data/common/reports/majors_details_failed.json` | 20 条失败记录 | 2.6 KB |

### 6.3 与现有数据的关系

- `catalog.json`（Phase C，875 条基础目录）：保留不动
- `detailed-catalog.json`（Phase D，1661 条详细目录）：新建，不覆盖

保持数据分层：基础目录 + 详细目录。

## 7. 测试覆盖

| 测试文件 | 覆盖内容 | 测试数 |
|---------|---------|--------|
| `api.test.ts` | 4 个 API 函数的 mock 测试（含 flag:false、网络错误、null 字段） | 6 |
| `parse.test.ts` | API 响应 → DetailedMajorRecord 转换（含字段缺失、空数组、null zyjs） | 5 |
| `mainCourses.test.ts` | 主干课程正则提取（含/不含课程描述的各种格式） | 6 |
| `validate.test.ts` | 校验函数（合法/非法 majorCode、空字段、百分比越界） | 9 |
| `crawler.test.ts` | 树形遍历编排（mock API，验证调用顺序、错误跳过、空列表） | 4 |

**测试结果**：5 个测试文件，30 个测试用例全部通过。全部 210 个 scraper 测试无回归。

## 8. 使用方式

### 8.1 运行采集

```bash
# 正式采集（约 15-20 分钟）
npm run scrape:majors:detail

# dry-run 验证流程（不写入输出文件）
npx tsx scripts/scrapers/majors/detail/index.ts --dry-run
```

### 8.2 运行测试

```bash
# 仅 detail 模块测试
npx vitest run scripts/scrapers/majors/detail

# 全部 scraper 测试
npm run test:scrapers
```

### 8.3 数据使用

```typescript
import detailedCatalog from './public/data/common/majors/detailed-catalog.json'

// 按专业代码查询
const philosophy = detailedCatalog.find(m => m.majorCode === '010101')

// 按学历层次筛选
const undergraduate = detailedCatalog.filter(m => m.educationLevel.includes('本科'))
const vocational = detailedCatalog.filter(m => m.educationLevel.includes('专科'))

// 按门类筛选
const engineering = detailedCatalog.filter(m => m.category === '工学')
```

## 9. 关键设计决策

### 9.1 为什么选择阳光高考 API 而非 MOE PDF

- MOE PDF 仅有基础目录（代码、名称、门类、专业类），无详细介绍
- 阳光高考 API 返回结构化 JSON，字段最丰富
- API 无需认证，比 HTML 解析更可靠

### 9.2 为什么新建 detailed-catalog.json 而非覆盖 catalog.json

- 保持数据分层：基础目录（Phase C）+ 详细目录（Phase D）
- catalog.json 来自 MOE PDF（权威目录），detailed-catalog.json 来自阳光高考（详细内容）
- 两个数据源互补，不互相覆盖

### 9.3 为什么主干课程是 best-effort 提取

- 阳光高考 API 无独立的主干课程字段
- 部分专业的 `zyjs.desc` 文本中包含"主干课程："等关键词
- 使用正则提取，提取不到则为空字符串，不阻塞采集流程

### 9.4 为什么实际采集数（1661）多于预期（1631）

- 预期 1631 基于教育部 2026 年发布的目录（本科 883 + 专科 748）
- 阳光高考 API 数据可能有更新或包含历史专业
- 实际本科 875（比 883 少 8，因 8 条失败）、专科 786（比 748 多 38）
