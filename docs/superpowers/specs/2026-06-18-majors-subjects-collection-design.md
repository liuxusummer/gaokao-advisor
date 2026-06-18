# 院校专业目录 + 选科要求采集设计

**日期**：2026-06-18
**状态**：已批准
**前置**：colleges.json（2919 条院校记录，含 moeCode）、scores（浙江/江苏投档线）

## 1. 背景与目标

### 1.1 问题背景

志愿填报助手已有院校基础信息、投档线、一分一段表数据，但缺少两个核心数据：

1. **专业目录**：教育部发布的本科专业目录，含专业代码、名称、学科门类、专业类
2. **选科要求**：各院校专业对选考科目的要求（新高考核心数据）

没有专业目录，投档线数据无法按专业筛选；没有选科要求，新高考考生无法判断"我能报哪些专业"。

### 1.2 目标

采集近三年（2024 版适用于 2024-2025 届）院校专业目录和选科要求，覆盖浙江、江苏两个省份。

### 1.3 数据源（已确认）

| 数据 | 数据源 | 格式 | URL | 采集方式 |
|------|--------|------|-----|---------|
| **专业目录** | 教育部 2026 年版 | PDF | `https://t4.chei.com.cn/news/getfile/2293468785-2293468784-5b411ed81523254b4ad6ad9cbcb3a6a0.pdf` | 一次性下载解析 |
| **浙江选科要求** | zjzs.net | HTML 表格 | `https://www.zjzs.net/col/xk2024/{国标码}.html` | 按院校循环抓取 |
| **江苏选科要求** | jseea.cn | Excel | `https://www.jseea.cn/webfile/upload/2022/01-18/13-55-050949-615118096.xlsx` | 一次性下载解析 |

**关键事实**：
- 浙江选科要求 HTML 无需登录，可直接抓取
- 江苏选科要求 Excel 发布于 2022-01-18，适用于 2024-2025 届（提前 3 年公布）
- 阳光高考选科要求需登录，不可用
- `colleges.json` 的 `moeCode`（10 位）后 5 位即国标码，用于构造浙江 URL

## 2. 架构

### 2.1 模块结构

新建两个独立采集器：

```
scripts/scrapers/
├── majors/                     # 新建：专业目录采集器
│   ├── index.ts                # 主流程：下载 PDF → 解析 → 输出 catalog.json
│   ├── parse.ts                # PDF 文本解析为 MajorCatalogRecord[]
│   ├── validate.ts             # 校验器
│   ├── __tests__/
│   │   ├── parse.test.ts
│   │   ├── validate.test.ts
│   │   └── e2e.test.ts
│   └── __fixtures__/
│       └── catalog_sample.txt  # PDF 提取的文本样本
└── subjects/                   # 新建：选科要求采集器
    ├── index.ts                # 主流程：浙江 HTML + 江苏 Excel
    ├── zhejiang.ts             # 浙江选科要求解析（HTML）
    ├── jiangsu.ts              # 江苏选科要求解析（Excel）
    ├── validate.ts             # 校验器
    ├── __tests__/
    │   ├── zhejiang.test.ts
    │   ├── jiangsu.test.ts
    │   ├── validate.test.ts
    │   └── e2e.test.ts
    └── __fixtures__/
        ├── zhejiang_sample.html
        └── jiangsu_sample.xlsx
```

### 2.2 与现有代码的关系

- **复用** `shared/http.ts`（fetch + fetchBinary）、`shared/cache.ts`、`shared/logger.ts`、`shared/pdf.ts`、`shared/colleges_loader.ts`
- **复用** `xlsx` 库（已在 scores 模块使用）
- **复用** `cheerio` 库（已在 colleges 模块使用）
- **复用** `matchCollege` 院校名匹配策略（colleges/website_enricher.ts）
- **不修改**现有模块（colleges、scores、rank_tables）
- **新增类型**到 `types.ts`：`MajorCatalogRecord`、`SubjectRequirementRecord`

### 2.3 国标码转换

`colleges.json` 的 `moeCode`（10 位，如 `"4111010001"`）后 5 位即国标码（`"10001"`），用于构造浙江选科要求 URL：

```typescript
const guobiaoCode = college.moeCode.slice(-5)
const zjUrl = `https://www.zjzs.net/col/xk2024/${guobiaoCode}.html`
```

### 2.4 采集规模与耗时

| 采集项 | 请求数 | 耗时估计 |
|--------|--------|---------|
| 专业目录 PDF | 1 | < 1 分钟 |
| 浙江选科要求 | 2919（每院校 1 个 HTML） | 约 25 分钟（QPS=2） |
| 江苏选科要求 | 1（Excel 下载） | < 1 分钟 |
| **总计** | ~2921 | **约 26 分钟** |

## 3. 数据 Schema

### 3.1 新增类型定义

在 `scripts/scrapers/types.ts` 中新增：

```typescript
// === 专业目录 ===

export interface MajorCatalogRecord {
  majorCode: string         // 专业代码，如 "080901"（含 K/T 后缀，如 "080910TK"）
  majorName: string         // 专业名称，如 "计算机科学与技术"
  category: string          // 学科门类，如 "工学"（13 个门类）
  subCategory: string       // 专业类，如 "计算机类"（93 个专业类）
  degreeType: string        // 学位类型，如 "工学学士"（部分专业可能为空）
  duration: string          // 学制，如 "四年"（部分专业可能为空）
  notes?: string            // 备注，如 "国家控制布点专业"
  _meta: CatalogMeta
}

export interface CatalogMeta {
  source: 'moe'             // 教育部
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean         // 专业代码格式校验通过为 true
}

// === 选科要求 ===

export interface SubjectRequirementRecord {
  collegeId: string         // colleges.json 中的 id（moeCode）
  collegeName: string       // 院校名称
  province: string          // 生源省份："浙江" | "江苏"
  year: number              // 适用年份：2024（该版本适用于 2024-2025）
  level: string             // 层次："本科" | "专科"
  majorName: string         // 专业(类)名称，如 "数学类" 或 "计算机科学与技术"
  majorCode?: string        // 专业代码（江苏 Excel 有，浙江 HTML 无）
  subjectRequirement: string // 原始选科要求文本
  requirementType: RequirementType  // 解析后的类型
  requiredSubjects: string[] // 解析后的必选科目（空数组表示不提科目要求）
  subMajors?: string[]      // 类中所含专业（浙江有，江苏无）
  majorGroup?: string       // 专业组代码（江苏专有，如 "01"）
  majorGroupName?: string   // 专业组名称（江苏专有）
  _meta: SubjectMeta
}

export type RequirementType =
  | 'none'           // 不提科目要求
  | 'one_required'   // 1 门必选
  | 'two_required'   // 2 门必选
  | 'three_required' // 3 门必选
  | 'any_of_two'     // 2 门选考 1 门
  | 'any_of_three'   // 3 门选考 1-2 门
  | 'unknown'        // 未识别格式

export interface SubjectMeta {
  source: 'zjzs' | 'jseea'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean         // collegeId 关联 colleges.json 成功为 true
}
```

### 3.2 选科要求文本解析规则

| 原始文本 | requirementType | requiredSubjects |
|---------|-----------------|------------------|
| `不提科目要求` | `none` | `[]` |
| `物理(1门科目考生必须选考方可报考)` | `one_required` | `["物理"]` |
| `物理,化学(2门科目考生均须选考方可报考)` | `two_required` | `["物理", "化学"]` |
| `物理,化学,生物(3门科目考生均须选考方可报考)` | `three_required` | `["物理", "化学", "生物"]` |
| `物理,化学(2门科目考生选考其中1门即可报考)` | `any_of_two` | `["物理", "化学"]` |
| 其他 | `unknown` | `[]` |

### 3.3 输出文件格式

```
public/data/
├── majors/
│   ├── catalog.json              # MajorCatalogRecord[]（约 816 条）
│   └── catalog.meta.json
└── subjects/
    ├── 浙江/
    │   ├── subjects_2024.json    # SubjectRequirementRecord[]
    │   └── subjects_2024.meta.json
    └── 江苏/
        ├── subjects_2024.json
        └── subjects_2024.meta.json
```

**浙江**：所有院校的选科要求合并到一个文件，每条记录含 `collegeId` 区分
**江苏**：Excel 全量解析后输出到一个文件，每条记录含 `collegeId` 和 `majorGroup`

### 3.4 与现有数据的关联

- `SubjectRequirementRecord.collegeId` 关联 `CollegeRecord.id`（即 moeCode）
- `SubjectRequirementRecord.majorName` 可关联 `ScoreRecord.majorName`
- `MajorCatalogRecord.majorCode` 可关联 `ScoreRecord.majorCode`

## 4. 采集流程

### 4.1 专业目录采集流程（majors）

```
Step 1: 下载教育部专业目录 PDF
  → fetchBinary(MOE_CATALOG_PDF_URL)
  → 缓存到 raw/majors/catalog.pdf

Step 2: PDF 文本提取
  → parsePdf(buffer) → 文本字符串
  → 缓存到 raw/majors/catalog.txt

Step 3: 解析为 MajorCatalogRecord[]
  → parseCatalog(text)
  → 按行解析：专业代码 | 学科门类 | 专业类 | 专业名称 | 学位类型 | 学制 | 备注
  → 跳过标题行、页眉页脚、空行

Step 4: 校验 + 产出
  → validateCatalogRecord() 过滤无效记录
  → 写入 public/data/majors/catalog.json
  → 生成 catalog.meta.json
```

**PDF 解析关键点**：
- PDF 文本按行分割，每行一个专业
- 专业代码格式：6 位数字 + 可选 K/T 后缀（如 `080910TK`）
- 跳过"普通高等学校本科专业目录"等标题行
- 跳过页码、页眉页脚

### 4.2 浙江选科要求采集流程

```
Step 1: 加载 colleges.json
  → 提取所有院校的 moeCode
  → 计算国标码：moeCode.slice(-5)

Step 2: 循环抓取每所院校的选科要求 HTML
  → URL: https://www.zjzs.net/col/xk2024/{国标码}.html
  → 限速 QPS=2（每 500ms 一个请求）
  → 缓存到 raw/subjects/zj_{国标码}.html
  → 404 时记录"该院校无浙江招生选科要求"，跳过

Step 3: 解析 HTML 表格
  → parseZjSubjects(html, collegeId, collegeName)
  → cheerio 解析 table，提取 4 列：层次、专业(类)名称、选考科目要求、类中所含专业
  → 调用 parseRequirement() 解析选科要求文本

Step 4: 关联 colleges.json
  → collegeId 已知（来自 Step 1），verified=true

Step 5: 校验 + 产出
  → validateSubjectRecord() 过滤无效记录
  → 合并所有院校记录到 subjects_2024.json
  → 生成 subjects_2024.meta.json
```

**HTML 表格结构**：
```html
<table>
  <tr><th>层次</th><th>专业(类)名称</th><th>选考科目要求</th><th>类中所含专业</th></tr>
  <tr><td>本科</td><td>数学类</td><td>物理,化学(2门科目考生均须选考方可报考)</td><td>数学与应用数学、信息与计算科学</td></tr>
</table>
```

### 4.3 江苏选科要求采集流程

```
Step 1: 下载江苏选科要求 Excel
  → fetchBinary(JS_SUBJECTS_XLSX_URL)
  → 缓存到 raw/subjects/js_subjects_2024.xlsx

Step 2: 解析 Excel
  → xlsx.read(buffer, { type: 'buffer' })
  → sheet_to_json(sheet, { header: 1 }) → 二维数组
  → 跳过标题行（通过"院校名称"关键词定位表头）

Step 3: 逐行解析
  → parseJsSubjects(rows)
  → 字段映射：院校代码、院校名称、专业组代码、专业组名称、专业代码、专业名称、选考科目要求
  → 调用 parseRequirement() 解析选科要求文本
  → 按 collegeName 匹配 colleges.json（复用 matchCollege 策略）

Step 4: 校验 + 产出
  → validateSubjectRecord() 过滤无效记录
  → 写入 public/data/subjects/江苏/subjects_2024.json
  → 生成 subjects_2024.meta.json
```

**江苏 Excel 字段映射**（预期 7 列）：
| 列 | 字段 | 示例 |
|----|------|------|
| 1 | 院校代码 | "10001" |
| 2 | 院校名称 | "北京大学" |
| 3 | 专业组代码 | "01" |
| 4 | 专业组名称 | "北京大学01专业组(不限)" |
| 5 | 专业代码 | "070101" |
| 6 | 专业名称 | "数学类" |
| 7 | 选考科目要求 | "物理,化学(2门科目考生均须选考方可报考)" |

### 4.4 选科要求解析函数（parseRequirement）

```typescript
export function parseRequirement(text: string): {
  type: RequirementType
  subjects: string[]
} {
  const trimmed = text.trim()

  if (trimmed.includes('不提科目要求')) {
    return { type: 'none', subjects: [] }
  }

  // 提取括号前的科目
  const bracketMatch = trimmed.match(/^([^(]+)\(/)
  if (!bracketMatch) {
    return { type: 'unknown', subjects: [] }
  }

  const subjectsStr = bracketMatch[1].trim()
  const subjects = subjectsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean)

  // 根据括号内文本判断类型
  if (trimmed.includes('均须选考')) {
    if (subjects.length === 1) return { type: 'one_required', subjects }
    if (subjects.length === 2) return { type: 'two_required', subjects }
    if (subjects.length === 3) return { type: 'three_required', subjects }
    return { type: 'unknown', subjects }
  }

  if (trimmed.includes('必须选考')) {
    return { type: 'one_required', subjects }
  }

  if (trimmed.includes('选考其中1门')) {
    return { type: 'any_of_two', subjects }
  }

  if (trimmed.includes('选考其中2门')) {
    return { type: 'any_of_three', subjects }
  }

  return { type: 'unknown', subjects }
}
```

### 4.5 错误处理与报告

**报告文件**（写入 `public/data/subjects/reports/`）：

1. **`majors_failed.json`**：专业目录解析失败
2. **`zj_subjects_failed.json`**：浙江 HTML 抓取失败（404、解析错误）
3. **`zj_subjects_empty.json`**：浙江院校无选科要求（404，正常情况）
4. **`js_subjects_unmatched.json`**：江苏院校名未匹配 colleges.json

**控制台报告**：
```
[专业目录采集报告] ============================================
版本: 1.0.0 | 耗时: 0m 45s
专业总数:   816 条
校验失败:   0 条
======================================================

[选科要求采集报告] ============================================
版本: 1.0.0 | 耗时: 26m 15s
------------------------------------------------------
浙江: 抓取 2919 所院校，成功 1850 所，无数据 1069 所
浙江记录: 15234 条
江苏: 解析 Excel 15234 行，匹配 1200 所院校
江苏记录: 15234 条
------------------------------------------------------
总计产出:   30468 条
未匹配:     85 条
======================================================
```

### 4.6 缓存策略

| 缓存项 | 路径 | cacheKey | 说明 |
|--------|------|----------|------|
| 专业目录 PDF | `raw/majors/` | `catalog.pdf.bin` | 一次性下载 |
| 专业目录文本 | `raw/majors/` | `catalog.txt` | PDF 提取后缓存 |
| 浙江 HTML | `raw/subjects/` | `zj_{国标码}.html` | 每院校 1 个文件 |
| 江苏 Excel | `raw/subjects/` | `js_subjects_2024.xlsx.bin` | 一次性下载 |

- `--force` 参数强制刷新所有缓存
- 支持断点续传（中途中断后重跑，已缓存的 HTML 不会重复请求）

### 4.7 CLI 接口

```bash
# 采集专业目录
npm run scrape:majors

# 采集选科要求（浙江 + 江苏）
npm run scrape:subjects

# 仅采集浙江选科要求
npm run scrape:subjects -- --province=浙江

# 强制刷新缓存
npm run scrape:subjects -- --force
```

## 5. 校验规则

### 5.1 validateCatalogRecord（专业目录）

| 规则 | 检查内容 | 失败行为 |
|------|---------|---------|
| majorCode 必填 | 非空，匹配 `^\d{6}[KT]?$` | reject |
| majorName 必填 | 非空 | reject |
| category 必填 | 非空，属于 13 个门类 | reject |
| subCategory 必填 | 非空 | reject |
| degreeType 可选 | 可为空 | — |
| duration 可选 | 可为空 | — |

### 5.2 validateSubjectRecord（选科要求）

| 规则 | 检查内容 | 失败行为 |
|------|---------|---------|
| collegeName 必填 | 非空 | reject |
| province 白名单 | `∈ ['浙江', '江苏']` | reject |
| majorName 必填 | 非空 | reject |
| subjectRequirement 必填 | 非空 | reject |
| requirementType 合法 | `≠ 'unknown'`（unknown 记入 warnings，不 reject） | warn |
| requiredSubjects 合法 | type=none 时为空数组，其他类型非空 | reject |
| year 合理 | `>= 2024` | reject |
| verified 不校验 | 溯源标记，不影响数据有效性 | — |

## 6. 测试策略

### 6.1 测试文件与用例

1. **`majors/__tests__/parse.test.ts`**（约 6 用例）
   - 正常解析：完整文本 → 正确字段映射
   - 专业代码含 K 后缀：`080910TK` → majorCode 正确
   - 专业代码含 T 后缀：`080910T` → majorCode 正确
   - 标题行跳过
   - 空行跳过
   - 空文本返回空数组

2. **`majors/__tests__/validate.test.ts`**（约 5 用例）
   - 正常记录通过
   - majorCode 格式错误 → 失败
   - majorName 为空 → 失败
   - category 不在 13 门类 → 失败
   - degreeType 为空 → 通过（可选字段）

3. **`subjects/__tests__/parse_requirement.test.ts`**（约 8 用例）
   - "不提科目要求" → none, []
   - "物理(1门科目考生必须选考方可报考)" → one_required, ["物理"]
   - "物理,化学(2门科目考生均须选考方可报考)" → two_required
   - "物理,化学,生物(3门科目考生均须选考方可报考)" → three_required
   - "物理,化学(2门科目考生选考其中1门即可报考)" → any_of_two
   - "物理,化学,生物(3门科目考生选考其中2门即可报考)" → any_of_three
   - 全角逗号处理
   - 未识别格式 → unknown, []

4. **`subjects/__tests__/zhejiang.test.ts`**（约 5 用例）
   - 正常解析：HTML 表格 → 正确字段映射
   - 多行专业：一个院校多个专业 → 多条记录
   - subMajors 解析
   - 空表格返回空数组
   - 404 页面返回空数组

5. **`subjects/__tests__/jiangsu.test.ts`**（约 5 用例）
   - 正常解析：Excel 行 → 正确字段映射
   - 专业组名拆分
   - 标题行跳过
   - 空行跳过
   - 多行解析

6. **`subjects/__tests__/validate.test.ts`**（约 6 用例）
   - 正常记录通过
   - province 非白名单 → 失败
   - majorName 为空 → 失败
   - requirementType=unknown → 通过（仅 warn）
   - requiredSubjects 与 type 不一致 → 失败
   - verified=false → 通过

7. **`majors/__tests__/e2e.test.ts`** + **`subjects/__tests__/e2e.test.ts`**（各 1-2 用例）

### 6.2 Fixture 文件

- `majors/__fixtures__/catalog_sample.txt`：PDF 提取的文本样本（含 5 个专业）
- `subjects/__fixtures__/zhejiang_sample.html`：浙江 HTML 表格样本（1 个院校 3 个专业）
- `subjects/__fixtures__/jiangsu_sample.xlsx`：江苏 Excel 样本（5 行数据）

### 6.3 测试原则

- **不测试真实网络请求**：所有 HTTP 调用通过 fixture 文件模拟
- **不修改现有测试**：majors 和 subjects 是独立模块
- **验证字段更新**：端到端测试确认所有字段被正确填充
- **验证溯源**：`_meta` 字段完整

## 7. 成功标准

- 所有测试通过（约 35 个用例）
- 现有 scrapers 测试无回归
- 专业目录：816+ 条记录
- 浙江选科要求：1000+ 所院校有数据（部分院校无浙江招生）
- 江苏选科要求：1200+ 所院校有数据
- 每条记录可溯源（`_meta` 完整）
