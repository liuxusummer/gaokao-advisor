# 多省份高考数据扩展设计

> 日期：2026-06-19
> 阶段：Phase E
> 目标：将高考数据采集从浙江、江苏 2 省扩展到 10 省（新增山东、河北、辽宁、湖北、湖南、广东、北京、上海），覆盖投档线、选科要求、一分一段表三类数据，适配现有系统架构

## 1. 背景与目标

### 1.1 现状

项目已完成 4 个阶段的数据采集：
- Phase A：浙江、江苏 2023-2025 年投档线（63,771 条）
- Phase B：882 所院校官网补齐
- Phase C：875 条基础专业目录 + 57,314 条选科要求（仅浙江、江苏）
- Phase D：1661 条详细专业目录（省份无关）

**问题**：投档线、选科要求、一分一段表仅覆盖浙江、江苏 2 省，前端 `mock.ts` 已定义 10 省但实际只有 2 省有真实数据。

### 1.2 目标

- **省份范围**：10 省（浙江、江苏 + 新增山东、河北、辽宁、湖北、湖南、广东、北京、上海）
- **数据类型**：投档线 + 选科要求 + 一分一段表（3 类 × 10 省 × 3 年）
- **架构要求**：先重构为适配器模式，再扩展新省份
- **数据源**：全部使用省级教育考试院官方源
- **适配性**：数据格式适配现有 `ScoreRecord`、`SubjectRequirementRecord`、`RankTableRecord` 类型

### 1.3 考试模式分类

| 考试模式 | 志愿模式 | 省份 | 科类 |
|---------|---------|------|------|
| 3+3 | 专业+院校 | 浙江、山东 | 综合 |
| 3+3 | 院校专业组 | 北京、上海 | 综合 |
| 3+1+2 | 专业+院校 | 河北、辽宁 | 物理类+历史类 |
| 3+1+2 | 院校专业组 | 江苏、湖北、湖南、广东 | 物理类+历史类 |

## 2. 适配器架构与省份注册表

### 2.1 核心接口设计

新增 `scripts/scrapers/shared/province_registry.ts`，定义三类数据的适配器接口和省份注册表。

```typescript
/** 省份元信息 */
export interface ProvinceMeta {
  name: string                    // "山东"
  pinyinId: string                // "shandong"
  examMode: '3+3' | '3+1+2'
  volunteerMode: 'major+college' | 'college-group'
  categories: string[]            // ["综合"] | ["物理类", "历史类"]
  batchSize: string               // "普通类常规批第1次" | "本科批"
}

/** 投档线适配器接口 */
export interface ScoreScraper {
  readonly province: string
  scrape(client: HttpClient, year: number): Promise<{ records: ScoreRecord[]; failed: FailedRecord[] }>
}

/** 选科要求适配器接口 */
export interface SubjectScraper {
  readonly province: string
  scrape(client: HttpClient, year: number): Promise<{ records: SubjectRequirementRecord[]; failed: FailedRecord[] }>
}

/** 一分一段表适配器接口 */
export interface RankTableScraper {
  readonly province: string
  scrape(client: HttpClient, year: number): Promise<{ records: RankTableRecord[]; failed: FailedRecord[] }>
}

/** 省份注册表 */
export interface ProvinceRegistry {
  meta: ProvinceMeta
  scoreScraper?: ScoreScraper
  subjectScraper?: SubjectScraper
  rankTableScraper?: RankTableScraper
}
```

### 2.2 注册表 API

```typescript
const REGISTRY: Map<string, ProvinceRegistry> = new Map()

export function registerProvince(registry: ProvinceRegistry): void
export function getProvince(name: string): ProvinceRegistry | undefined
export function getAllProvinces(): ProvinceRegistry[]
export function getEnabledProvinces(): ProvinceRegistry[]  // 按 TARGET_PROVINCES 过滤
```

### 2.3 重构后的 index.ts 编排模式

从硬编码 if 块变为遍历注册表：

```typescript
// scores/index.ts 重构后
const provinces = args.province
  ? [getProvince(args.province)!].filter(Boolean)
  : getEnabledProvinces()

for (const reg of provinces) {
  if (!reg.scoreScraper) continue
  for (const year of TARGET_YEARS) {
    const { records, failed } = await reg.scoreScraper.scrape(client, year)
    // 统一的院校匹配、校验、写入逻辑（复用现有 matchColleges、validateScoreRecord）
  }
}
```

`subjects/index.ts` 和 `rank_tables/index.ts` 同理重构。

### 2.4 现有浙江/江苏代码的重构方式

**不重写解析逻辑**，仅包装为适配器。在 `scripts/scrapers/scores/adapters/` 下新建包装文件：

```typescript
// scripts/scrapers/scores/adapters/zhejiang.ts
export const zhejiangScoreScraper: ScoreScraper = {
  province: '浙江',
  async scrape(client, year) {
    // 复用现有 parseZjToudang 逻辑
  }
}
```

现有 `zhejiang.ts`、`jiangsu.ts` 解析函数保持不变，适配器仅做包装和调用。

### 2.5 配置重构

`config.ts` 中 `TARGET_PROVINCES` 改为可配置：

```typescript
export const TARGET_PROVINCES = (process.env.TARGET_PROVINCES?.split(',') as string[])
  ?? ['浙江', '江苏', '山东', '河北', '辽宁', '湖北', '湖南', '广东', '北京', '上海']
```

省份特定 URL 配置移到各适配器文件内部，不再集中在 config.ts。

### 2.6 文件结构

```
scripts/scrapers/
├── shared/
│   └── province_registry.ts          # 新增：适配器接口 + 注册表
├── scores/
│   ├── adapters/                     # 新增：适配器目录
│   │   ├── zhejiang.ts               # 包装现有 parseZjToudang
│   │   ├── jiangsu.ts                # 包装现有 parseJsToudang*
│   │   ├── shandong.ts               # 新增
│   │   ├── hebei.ts                  # 新增
│   │   ├── liaoning.ts               # 新增
│   │   ├── hubei.ts                  # 新增
│   │   ├── hunan.ts                  # 新增
│   │   ├── guangdong.ts              # 新增
│   │   ├── beijing.ts                # 新增
│   │   └── shanghai.ts               # 新增
│   ├── zhejiang.ts                   # 现有解析函数（不变）
│   ├── jiangsu.ts                    # 现有解析函数（不变）
│   ├── validate.ts                   # 修改：省份白名单从 config 读取
│   └── index.ts                      # 重构：遍历注册表
├── subjects/
│   ├── adapters/                     # 同上结构
│   └── index.ts                      # 重构
└── rank_tables/
    ├── adapters/                     # 同上结构
    └── index.ts                      # 重构
```

## 3. 8 省数据源适配策略

### 3.1 省份分组与采集难度

| 批次 | 省份 | 考试模式 | 投档线格式 | 一分一段表格式 | 选科要求格式 |
|------|------|---------|-----------|--------------|-------------|
| 第 1 批 | 山东 | 3+3 | Excel | Excel | HTML 查询系统 |
| 第 2 批 | 河北、湖南 | 3+1+2 | Excel | 图片/HTML（OCR） | HTML 查询系统 |
| 第 3 批 | 湖北、广东 | 3+1+2 | PDF | PDF/图片（OCR） | HTML 查询系统 |
| 第 4 批 | 北京、上海、辽宁 | 3+3/3+1+2 | HTML/图片 | HTML/图片（OCR） | HTML 查询系统 |

### 3.2 投档线适配策略

| 省份 | 解析方式 | 复用现有代码 | 关键差异点 |
|------|---------|-------------|-----------|
| 山东 | xlsx 解析 | 参考 parseZjToudang | 专业级、综合科类、`普通类常规批第1次` |
| 河北 | xlsx 解析 | 参考 parseJsToudangExcel | 院校专业组级、物理类+历史类双表 |
| 湖南 | xlsx 解析 | 参考 parseJsToudangExcel | 院校专业组级、物理类+历史类双表 |
| 湖北 | PDF 表格解析 | 新增（pdf-parse 文本提取） | 院校专业组级、首选物理+首选历史 |
| 广东 | PDF 表格解析 | 新增 | 院校专业组级、物理类+历史类 |
| 北京 | HTML 解析（cheerio） | 新增 | 院校专业组级、综合 |
| 上海 | HTML 解析（cheerio） | 新增 | 院校专业组级、综合 |
| 辽宁 | HTML/图片解析 | 新增（可能需 OCR） | 专业级、物理学科类+历史学科类 |

### 3.3 一分一段表适配策略

| 省份 | 解析方式 | 复用现有代码 |
|------|---------|-------------|
| 山东 | xlsx 解析 | 参考 parseZjRankTable（PDF→Excel） |
| 河北 | OCR（tesseract.js） | 复用 ocrImage + 参考 parseJsRankTable |
| 湖南 | HTML/OCR | 参考 parseJsRankTable |
| 湖北 | HTML 解析（cheerio） | 新增 |
| 广东 | PDF/OCR | 新增 |
| 北京 | HTML/OCR | 新增 |
| 上海 | HTML 解析 | 新增 |
| 辽宁 | HTML/OCR | 新增 |

### 3.4 选科要求适配策略

8 省均为 HTML 查询系统，采用统一策略：
1. 从 `colleges.json` 按省份筛选院校列表
2. 逐校请求查询页面（类似浙江的 URL 模板模式）
3. 用 cheerio 解析 HTML 表格
4. 复用现有 `parseRequirement` 解析选科要求文本

每省差异仅在 URL 模板和 HTML 表格结构，适配器封装这些差异。

### 3.5 数据格式归一化

所有省份解析结果统一归一化到现有类型：

- **3+3 省份**：`category = '综合'`，无 `majorGroup`
- **3+1+2 院校专业组省份**：`category = '物理类' | '历史类'`，有 `majorGroup`
- **3+1+2 专业+院校省份**（河北、辽宁）：`category = '物理类' | '历史类'`，无 `majorGroup`

### 3.6 官方数据源 URL

| 省份 | 官网 | 投档线 | 一分一段表 | 选科要求 |
|------|------|--------|-----------|---------|
| 山东 | sdzs.cn | Excel 下载 | Excel 下载 | HTML 查询系统 |
| 河北 | hebeea.edu.cn | Excel 下载 | 图片（OCR） | HTML 查询系统 |
| 辽宁 | lnzsks.com | HTML/图片 | HTML/图片 | HTML 查询系统 |
| 湖北 | hbea.edu.cn | PDF 下载 | HTML | HTML 查询系统 |
| 湖南 | hneeb.cn | Excel 下载 | HTML/图片 | HTML 查询系统 |
| 广东 | eea.gd.gov.cn | PDF 下载 | PDF/图片 | HTML 查询系统 |
| 北京 | bjeea.cn | HTML/图片 | HTML/图片 | HTML 查询系统 |
| 上海 | shmeea.edu.cn | HTML | HTML | HTML 查询系统 |

## 4. 前端适配与校验更新

### 4.1 前端适配点

| 文件 | 当前状态 | 修改内容 |
|------|---------|---------|
| `src/services/dataLoader.ts` | KNOWN_REAL_PROVINCES 仅 2 省 | 扩展为 10 省 |
| `src/pages/DataCenter.tsx` | PROVINCE_OPTIONS 硬编码 2 省 | 从 mock.ts 派生 |
| `src/services/riskDetector.ts` | 硬编码省份列表 | 从 mock.ts 的 mode 字段判断 |
| `src/data/mock.ts` | 已有 10 省定义 | 无需修改 |

### 4.2 dataLoader.ts 适配

```typescript
// 修改后：扩展为 10 省
const KNOWN_REAL_PROVINCES = new Set([
  'zhejiang', 'jiangsu', 'shandong', 'hebei', 'liaoning',
  'hubei', 'hunan', 'guangdong', 'beijing', 'shanghai'
])
```

保持同步函数签名，简单可靠。

### 4.3 DataCenter.tsx 适配

```typescript
// 从 mock.ts 派生省份选项
import { provinces } from '@/data/mock'
const PROVINCE_OPTIONS = provinces.map(p => ({ value: p.id, label: p.name }))
```

### 4.4 riskDetector.ts 适配

```typescript
// 从 mock.ts 的 mode 字段判断志愿模式
import { provinces } from '@/data/mock'
const provinceConfig = provinces.find(p => p.id === profile.provinceId)
if (provinceConfig?.mode !== 'major+college') {
  // 院校专业组模式检查服从调剂
}
```

### 4.5 校验逻辑更新

3 个 validate.ts 文件的省份白名单从硬编码改为从 config 读取：

```typescript
import { PROVINCES } from '../config'
const VALID_PROVINCES = PROVINCES  // 31 省全量白名单
```

### 4.6 scores.meta.json 更新

`buildScoresMeta()` 中的省份列表改为动态：

```typescript
for (const province of TARGET_PROVINCES) { ... }
```

## 5. 分批执行策略与测试

### 5.1 分批执行计划

| 批次 | 范围 | 产出 | 验证标准 |
|------|------|------|---------|
| 批次 0：重构 | 适配器接口 + 注册表 + 浙江/江苏适配器包装 + index.ts 重构 | 现有 2 省数据不回归 | 现有 210 个测试全通过 + 2 省数据重新采集成功 |
| 批次 1：山东 | 3 个适配器 | 山东 3 类数据 | 数据量合理 + 字段完整 |
| 批次 2：河北+湖南 | 6 个适配器 | 2 省 3 类数据 | 同上 |
| 批次 3：湖北+广东 | 6 个适配器（含 PDF 解析） | 2 省 3 类数据 | 同上 |
| 批次 4：北京+上海+辽宁 | 9 个适配器（含 HTML/OCR） | 3 省 3 类数据 | 同上 |
| 批次 5：前端适配 | dataLoader + DataCenter + riskDetector | 前端支持 10 省 | 前端能加载 10 省数据 |

### 5.2 测试策略

| 测试类型 | 覆盖内容 |
|---------|---------|
| 适配器单元测试 | 每个适配器的 scrape 方法（mock HttpClient） |
| 解析器测试 | 每省的解析函数（用 fixture 数据测试） |
| 校验测试 | 更新后的省份白名单校验 |
| 回归测试 | 现有 210 个测试全通过 |
| 端到端测试 | 实际采集并验证数据量、字段完整性 |

每省每类数据准备一个 fixture 样本文件（Excel/PDF/HTML 片段），用于离线测试。

### 5.3 错误处理与容错

- **数据源不可用**：记录到 failed 报告，跳过该省继续采集
- **解析失败**：记录原始数据到 raw 目录，便于调试
- **部分数据缺失**：如某省只有 2024 年数据，2023/2025 年跳过并记录
- **OCR 识别错误**：`verified: false`，需人工抽检

### 5.4 CLI 参数扩展

```bash
# 采集所有目标省份
npm run scrape:scores

# 采集指定省份
npx tsx scripts/scrapers/scores/index.ts --province=山东

# 通过环境变量控制目标省份范围
TARGET_PROVINCES=山东,河北 npm run scrape:scores
```

### 5.5 预期数据量估算

| 数据类型 | 现有（2 省） | 预期（10 省） | 增量 |
|---------|------------|-------------|------|
| 投档线 | ~63,771 条 | ~300,000 条 | ~236,000 条 |
| 选科要求 | ~57,314 条 | ~280,000 条 | ~223,000 条 |
| 一分一段表 | ~39,408 行 | ~200,000 行 | ~160,000 行 |

### 5.6 数据产出目录结构

```
public/data/
├── scores/
│   ├── 浙江/  江苏/  (现有)
│   ├── 山东/  河北/  辽宁/  湖北/  湖南/  广东/  北京/  上海/  (新增 8 省)
│   └── scores.meta.json
├── subjects/
│   ├── 浙江/  江苏/  (现有)
│   └── 山东/  河北/  辽宁/  湖北/  湖南/  广东/  北京/  上海/  (新增 8 省)
└── common/
    └── ... (省份无关，不变)
```

每省目录下文件命名不变：`scores_{year}.json`、`subjects_{year}.json`、`rank_table_{year}.json`。

## 6. 关键设计决策

### 6.1 为什么选择适配器模式而非保持硬编码 if 块

- 硬编码 if 块每加一省需修改 3 个 index.ts + config.ts + 3 个 validate.ts + 前端 2 个文件
- 适配器模式新增省份只需：创建适配器文件 + 注册到注册表，index.ts 无需修改
- 统一接口便于测试和复用

### 6.2 为什么不重写现有浙江/江苏解析逻辑

- 现有解析逻辑经过充分测试（210 个测试用例），稳定可靠
- 重写有回归风险
- 适配器仅做包装，保持解析函数不变，风险最低

### 6.3 为什么选科要求统一用 HTML 逐校爬取

- 8 省的选科要求均为 HTML 查询系统，无单文件下载
- 逐校爬取模式已在浙江验证可行（54,085 条记录）
- 复用现有 `parseRequirement` 解析选科要求文本

### 6.4 为什么保持 isRealDataAvailable 为同步函数

- 改为异步函数（HEAD 请求验证）会影响所有调用方
- 同步函数 + 扩展集合更简单可靠
- 数据未采集完成时可通过集合配置控制
