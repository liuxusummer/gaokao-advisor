# 院校专业目录 + 选科要求采集实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 采集教育部专业目录（PDF）和浙江/江苏选科要求（HTML/Excel），补齐志愿填报助手的核心数据层。

**Architecture:** 两个独立采集器：majors 模块解析教育部 PDF 生成专业目录，subjects 模块抓取浙江 HTML + 解析江苏 Excel 生成选科要求。复用现有 shared 工具（http/cache/pdf/logger）。

**Tech Stack:** Node.js + TypeScript + tsx + cheerio（HTML）+ xlsx（Excel）+ pdf-parse（PDF）+ Vitest

**Spec:** [2026-06-18-majors-subjects-collection-design.md](../specs/2026-06-18-majors-subjects-collection-design.md)

---

## 文件结构

**新建：**
- `scripts/scrapers/majors/parse.ts` — 专业目录 PDF 文本解析
- `scripts/scrapers/majors/validate.ts` — 专业目录校验器
- `scripts/scrapers/majors/index.ts` — 专业目录主流程
- `scripts/scrapers/majors/__tests__/parse.test.ts`
- `scripts/scrapers/majors/__tests__/validate.test.ts`
- `scripts/scrapers/majors/__tests__/e2e.test.ts`
- `scripts/scrapers/majors/__fixtures__/catalog_sample.txt`
- `scripts/scrapers/subjects/parse_requirement.ts` — 选科要求文本解析
- `scripts/scrapers/subjects/zhejiang.ts` — 浙江 HTML 解析
- `scripts/scrapers/subjects/jiangsu.ts` — 江苏 Excel 解析
- `scripts/scrapers/subjects/validate.ts` — 选科要求校验器
- `scripts/scrapers/subjects/index.ts` — 选科要求主流程
- `scripts/scrapers/subjects/__tests__/parse_requirement.test.ts`
- `scripts/scrapers/subjects/__tests__/zhejiang.test.ts`
- `scripts/scrapers/subjects/__tests__/jiangsu.test.ts`
- `scripts/scrapers/subjects/__tests__/validate.test.ts`
- `scripts/scrapers/subjects/__tests__/e2e.test.ts`
- `scripts/scrapers/subjects/__fixtures__/zhejiang_sample.html`
- `scripts/scrapers/subjects/__fixtures__/jiangsu_sample.xlsx`（或 .txt 文本样本）

**修改：**
- `scripts/scrapers/types.ts` — 新增 MajorCatalogRecord、SubjectRequirementRecord 等类型
- `scripts/scrapers/config.ts` — 新增专业目录和选科要求 URL 配置
- `package.json` — 新增 `scrape:majors` 和 `scrape:subjects` npm script

---

## Part 1: 专业目录采集（majors）

## Task 1: 新增类型定义和配置

**Files:**
- Modify: `scripts/scrapers/types.ts`（末尾追加）
- Modify: `scripts/scrapers/config.ts`（末尾追加）

- [ ] **Step 1: 在 types.ts 末尾追加专业目录和选科要求类型**

在 `scripts/scrapers/types.ts` 文件末尾追加：

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
  source: 'moe'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

// === 选科要求 ===

export interface SubjectRequirementRecord {
  collegeId: string
  collegeName: string
  province: string          // "浙江" | "江苏"
  year: number              // 2024
  level: string             // "本科" | "专科"
  majorName: string
  majorCode?: string
  subjectRequirement: string
  requirementType: RequirementType
  requiredSubjects: string[]
  subMajors?: string[]
  majorGroup?: string
  majorGroupName?: string
  _meta: SubjectMeta
}

export type RequirementType =
  | 'none'
  | 'one_required'
  | 'two_required'
  | 'three_required'
  | 'any_of_two'
  | 'any_of_three'
  | 'unknown'

export interface SubjectMeta {
  source: 'zjzs' | 'jseea'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}
```

- [ ] **Step 2: 在 config.ts 末尾追加 URL 配置**

在 `scripts/scrapers/config.ts` 文件末尾追加：

```typescript

// === 专业目录与选科要求采集配置 ===

// 教育部本科专业目录 PDF（2026 年版）
export const MOE_CATALOG_PDF_URL = 'https://t4.chei.com.cn/news/getfile/2293468785-2293468784-5b411ed81523254b4ad6ad9cbcb3a6a0.pdf'
export const MOE_CATALOG_PAGE_URL = 'https://gaokao.chsi.com.cn/gkxx/zcdh/202604/20260428/2293468784.html'

// 浙江省选科要求 URL 模板（{国标码} 替换为 5 位院校国标码）
export const ZJ_SUBJECTS_URL_TEMPLATE = 'https://www.zjzs.net/col/xk2024/{guobiaoCode}.html'

// 江苏省选科要求 Excel（2024 版，适用于 2024-2025 届）
export const JS_SUBJECTS_XLSX_URL = 'https://www.jseea.cn/webfile/upload/2022/01-18/13-55-050949-615118096.xlsx'
export const JS_SUBJECTS_PAGE_URL = 'https://www.jseea.cn/webfile/index/index_zkxx/2022-01-18/27031.html'

// 13 个学科门类
export const MAJOR_CATEGORIES = [
  '哲学', '经济学', '法学', '教育学', '文学', '历史学',
  '理学', '工学', '农学', '医学', '管理学', '艺术学', '交叉学科'
]
```

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/types.ts scripts/scrapers/config.ts
git commit -m "feat(scrapers): 新增专业目录和选科要求类型定义及配置"
```

---

## Task 2: 创建专业目录 fixture 文件

**Files:**
- Create: `scripts/scrapers/majors/__fixtures__/catalog_sample.txt`

- [ ] **Step 1: 创建专业目录文本样本**

创建 `scripts/scrapers/majors/__fixtures__/catalog_sample.txt`：

```
普通高等学校本科专业目录（2026年）

学科门类：哲学
哲学类
010101	哲学	哲学学士	四年
010102	逻辑学	哲学学士	四年

学科门类：经济学
经济学类
020101	经济学	经济学学士	四年
020401	国际经济与贸易	经济学学士	四年

学科门类：工学
计算机类
080901	计算机科学与技术	工学学士	四年
080910TK	信息安全	管理学学士	四年	国家控制布点专业
080910T	密码科学与技术	工学学士	四年
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/majors/__fixtures__/catalog_sample.txt
git commit -m "test(majors): 新增专业目录文本 fixture"
```

---

## Task 3: 编写专业目录解析测试（TDD）

**Files:**
- Create: `scripts/scrapers/majors/__tests__/parse.test.ts`

- [ ] **Step 1: 编写测试文件**

创建 `scripts/scrapers/majors/__tests__/parse.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseCatalog } from '../parse'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'catalog_sample.txt')
const fixtureText = fs.readFileSync(fixturePath, 'utf-8')

describe('parseCatalog', () => {
  it('正常解析多个专业', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    expect(records.length).toBeGreaterThanOrEqual(7)
  })

  it('专业代码含 K 后缀', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const infoSec = records.find(r => r.majorName === '信息安全')
    expect(infoSec).toBeDefined()
    expect(infoSec!.majorCode).toBe('080910TK')
  })

  it('专业代码含 T 后缀', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const crypto = records.find(r => r.majorName === '密码科学与技术')
    expect(crypto).toBeDefined()
    expect(crypto!.majorCode).toBe('080910T')
  })

  it('标题行被跳过', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    const hasTitle = records.some(r => r.majorName.includes('普通高等学校'))
    expect(hasTitle).toBe(false)
  })

  it('空行被跳过', () => {
    const text = '\n\n010101\t哲学\t哲学学士\t四年\n\n'
    const records = parseCatalog(text, 'https://example.com/catalog.pdf')
    expect(records).toHaveLength(1)
  })

  it('空文本返回空数组', () => {
    const records = parseCatalog('', 'https://example.com/catalog.pdf')
    expect(records).toEqual([])
  })

  it('_meta 字段正确填充', () => {
    const records = parseCatalog(fixtureText, 'https://example.com/catalog.pdf')
    expect(records[0]._meta.source).toBe('moe')
    expect(records[0]._meta.sourceUrl).toBe('https://example.com/catalog.pdf')
    expect(records[0]._meta.verified).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/majors/__tests__/parse.test.ts 2>&1 | tail -15`
Expected: FAIL — `Cannot find module '../parse'`

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/majors/__tests__/parse.test.ts
git commit -m "test(majors): 新增专业目录解析测试（失败）"
```

---

## Task 4: 实现专业目录解析函数

**Files:**
- Create: `scripts/scrapers/majors/parse.ts`

- [ ] **Step 1: 实现解析函数**

创建 `scripts/scrapers/majors/parse.ts`：

```typescript
import { SCRAPER_VERSION, MAJOR_CATEGORIES } from '../config'
import type { MajorCatalogRecord } from '../types'

/**
 * 解析教育部专业目录 PDF 提取的文本。
 *
 * 文本格式（每行一个专业，制表符分隔）：
 *   学科门类：哲学        ← 门类行（跳过）
 *   哲学类               ← 专业类行（无制表符，记录当前 subCategory）
 *   010101\t哲学\t哲学学士\t四年    ← 专业行
 *   080910TK\t信息安全\t管理学学士\t四年\t国家控制布点专业  ← 含备注
 */
export function parseCatalog(text: string, sourceUrl: string): MajorCatalogRecord[] {
  if (!text) return []

  const records: MajorCatalogRecord[] = []
  const lines = text.split(/\r?\n/)
  let currentCategory = ''
  let currentSubCategory = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过标题行
    if (trimmed.includes('普通高等学校') || trimmed.includes('专业目录')) continue

    // 门类行：以"学科门类"开头
    if (trimmed.startsWith('学科门类')) {
      const match = trimmed.match(/学科门类[：:]\s*(.+)$/)
      if (match) currentCategory = match[1].trim()
      continue
    }

    // 专业行：以专业代码开头（6 位数字 + 可选 K/T）
    const codeMatch = trimmed.match(/^(\d{6}[KT]?)\s+/)
    if (codeMatch) {
      const parts = trimmed.split(/\t|\s{2,}/).filter(Boolean)
      if (parts.length < 4) continue

      const majorCode = parts[0]
      const majorName = parts[1]
      const degreeType = parts[2] || ''
      const duration = parts[3] || ''
      const notes = parts[4] || undefined

      records.push({
        majorCode,
        majorName,
        category: currentCategory,
        subCategory: currentSubCategory,
        degreeType,
        duration,
        notes,
        _meta: {
          source: 'moe',
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          scraperVersion: SCRAPER_VERSION,
          verified: /^\d{6}[KT]?$/.test(majorCode),
        },
      })
      continue
    }

    // 专业类行：无制表符且非门类行，记录为 subCategory
    if (!trimmed.includes('\t') && !trimmed.match(/^\d/)) {
      currentSubCategory = trimmed
    }
  }

  return records
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/majors/__tests__/parse.test.ts 2>&1 | tail -15`
Expected: PASS — 7 个用例通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/majors/parse.ts
git commit -m "feat(majors): 实现专业目录解析函数"
```

---

## Task 5: 实现专业目录校验器

**Files:**
- Create: `scripts/scrapers/majors/validate.ts`
- Create: `scripts/scrapers/majors/__tests__/validate.test.ts`

- [ ] **Step 1: 编写校验器测试**

创建 `scripts/scrapers/majors/__tests__/validate.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { validateCatalogRecord } from '../validate'
import type { MajorCatalogRecord } from '../../types'

function makeRecord(overrides: Partial<MajorCatalogRecord> = {}): MajorCatalogRecord {
  return {
    majorCode: '080901',
    majorName: '计算机科学与技术',
    category: '工学',
    subCategory: '计算机类',
    degreeType: '工学学士',
    duration: '四年',
    _meta: {
      source: 'moe',
      sourceUrl: 'https://example.com',
      fetchedAt: '2026-06-18T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateCatalogRecord', () => {
  it('正常记录通过', () => {
    const result = validateCatalogRecord(makeRecord())
    expect(result.valid).toBe(true)
  })

  it('majorCode 格式错误 → 失败', () => {
    const result = validateCatalogRecord(makeRecord({ majorCode: 'abc123' }))
    expect(result.valid).toBe(false)
  })

  it('majorName 为空 → 失败', () => {
    const result = validateCatalogRecord(makeRecord({ majorName: '' }))
    expect(result.valid).toBe(false)
  })

  it('category 不在 13 门类 → 失败', () => {
    const result = validateCatalogRecord(makeRecord({ category: '不存在' }))
    expect(result.valid).toBe(false)
  })

  it('degreeType 为空 → 通过（可选字段）', () => {
    const result = validateCatalogRecord(makeRecord({ degreeType: '' }))
    expect(result.valid).toBe(true)
  })
})
```

- [ ] **Step 2: 实现校验器**

创建 `scripts/scrapers/majors/validate.ts`：

```typescript
import { MAJOR_CATEGORIES } from '../config'
import type { MajorCatalogRecord } from '../types'

export interface CatalogValidationResult {
  valid: boolean
  reason?: string
}

export function validateCatalogRecord(record: MajorCatalogRecord): CatalogValidationResult {
  if (!record.majorCode || !/^\d{6}[KT]?$/.test(record.majorCode)) {
    return { valid: false, reason: `majorCode 格式错误: ${record.majorCode}` }
  }

  if (!record.majorName) {
    return { valid: false, reason: 'majorName 为空' }
  }

  if (!record.category || !MAJOR_CATEGORIES.includes(record.category)) {
    return { valid: false, reason: `category 不在 13 门类: ${record.category}` }
  }

  if (!record.subCategory) {
    return { valid: false, reason: 'subCategory 为空' }
  }

  return { valid: true }
}
```

- [ ] **Step 3: 运行测试验证通过**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/majors/__tests__/validate.test.ts 2>&1 | tail -15`
Expected: PASS — 5 个用例通过

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/majors/validate.ts scripts/scrapers/majors/__tests__/validate.test.ts
git commit -m "feat(majors): 实现专业目录校验器"
```

---

## Task 6: 实现专业目录主流程

**Files:**
- Create: `scripts/scrapers/majors/index.ts`

- [ ] **Step 1: 实现主流程**

创建 `scripts/scrapers/majors/index.ts`：

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { parsePdf } from '../shared/pdf'
import { parseCatalog } from './parse'
import { validateCatalogRecord } from './validate'
import {
  SCRAPER_VERSION,
  MOE_CATALOG_PDF_URL,
  MOE_CATALOG_PAGE_URL,
  RAW_DIR,
  OUTPUT_DIR,
  REPORTS_DIR,
  LOGS_DIR,
} from '../config'
import type { MajorCatalogRecord } from '../types'

const logger = createLogger('majors')

interface CliArgs {
  force: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return { force: args.includes('--force') }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始专业目录采集', { force: args.force })

  fs.mkdirSync(path.join(OUTPUT_DIR, 'majors'), { recursive: true })
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(RAW_DIR, 'majors'))

  // Step 1: 下载 PDF
  logger.info('Step 1: 下载教育部专业目录 PDF', { url: MOE_CATALOG_PDF_URL })
  const pdfResult = await http.fetchBinary(MOE_CATALOG_PDF_URL, {
    cacheKey: 'catalog.pdf',
    forceRefresh: args.force,
  })
  logger.info('PDF 下载完成', { size: pdfResult.buffer.length })

  // Step 2: PDF 文本提取
  logger.info('Step 2: PDF 文本提取')
  const text = await parsePdf(pdfResult.buffer)

  // 缓存提取的文本
  const textCachePath = path.join(RAW_DIR, 'majors', 'catalog.txt')
  fs.writeFileSync(textCachePath, text, 'utf-8')

  // Step 3: 解析
  logger.info('Step 3: 解析专业目录')
  const records = parseCatalog(text, MOE_CATALOG_PAGE_URL)
  logger.info('解析完成', { count: records.length })

  // Step 4: 校验
  const validated: MajorCatalogRecord[] = []
  const rejected: Array<{ record: MajorCatalogRecord; reason: string }> = []

  for (const record of records) {
    const result = validateCatalogRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  logger.info('校验完成', { valid: validated.length, rejected: rejected.length })

  // Step 5: 写入 catalog.json
  const outputPath = path.join(OUTPUT_DIR, 'majors', 'catalog.json')
  fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2), 'utf-8')
  logger.info('catalog.json 已写入', { path: outputPath, count: validated.length })

  // 写入 meta.json
  const meta = {
    totalCount: validated.length,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [
      {
        name: '教育部普通高等学校本科专业目录',
        url: MOE_CATALOG_PAGE_URL,
        fetchedAt: pdfResult.fetchedAt,
        recordCount: validated.length,
      },
    ],
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'majors', 'catalog.meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8'
  )

  // 写入 rejected 报告
  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'majors_rejected.json'),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[专业目录采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `专业总数:   ${validated.length} 条`,
    `校验失败:   ${rejected.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(
    path.join(LOGS_DIR, `scrape-majors-${Date.now()}.log`),
    report,
    'utf-8'
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('专业目录采集异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
```

- [ ] **Step 2: 运行全部 majors 测试验证无回归**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/majors 2>&1 | tail -15`
Expected: PASS — 12 个用例通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/majors/index.ts
git commit -m "feat(majors): 实现专业目录主流程"
```

---

## Task 7: 新增 majors npm script 并采集

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 package.json scripts 中新增命令**

在 `"scrape:colleges:websites"` 行后新增：

```json
    "scrape:majors": "tsx scripts/scrapers/majors/index.ts",
```

- [ ] **Step 2: 运行采集**

Run: `PATH="/opt/homebrew/bin:$PATH" npm run scrape:majors 2>&1 | tail -20`
Expected: 采集成功，输出报告显示 800+ 条专业记录

- [ ] **Step 3: 验证产出**

Run: `PATH="/opt/homebrew/bin:$PATH" node -e "const d=require('./public/data/majors/catalog.json');console.log('专业总数:',d.length);console.log('样本:',JSON.stringify(d[0],null,2))"`
Expected: 800+ 条记录，第一条记录字段完整

- [ ] **Step 4: 提交**

```bash
git add package.json public/data/majors/
git commit -m "data: 采集专业目录数据"
```

---

## Part 2: 选科要求采集（subjects）

## Task 8: 创建选科要求 fixture 文件

**Files:**
- Create: `scripts/scrapers/subjects/__fixtures__/zhejiang_sample.html`
- Create: `scripts/scrapers/subjects/__fixtures__/jiangsu_sample.txt`

- [ ] **Step 1: 创建浙江 HTML fixture**

创建 `scripts/scrapers/subjects/__fixtures__/zhejiang_sample.html`：

```html
<!DOCTYPE html>
<html>
<head><title>北京大学选考科目要求</title></head>
<body>
<h1>北京大学选考科目要求</h1>
<table border="1">
  <thead>
    <tr>
      <th>层次</th>
      <th>专业(类)名称</th>
      <th>选考科目要求</th>
      <th>类中所含专业</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>本科</td>
      <td>数学类</td>
      <td>物理,化学(2门科目考生均须选考方可报考)</td>
      <td>数学与应用数学、信息与计算科学</td>
    </tr>
    <tr>
      <td>本科</td>
      <td>物理学类</td>
      <td>物理,化学(2门科目考生均须选考方可报考)</td>
      <td>物理学、天文学</td>
    </tr>
    <tr>
      <td>本科</td>
      <td>法学</td>
      <td>不提科目要求</td>
      <td>法学</td>
    </tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: 创建江苏 Excel 文本样本**

创建 `scripts/scrapers/subjects/__fixtures__/jiangsu_sample.txt`（模拟 Excel 解析后的二维数组，每行制表符分隔）：

```
院校代码	院校名称	专业组代码	专业组名称	专业代码	专业名称	选考科目要求
10001	北京大学	01	北京大学01专业组(不限)	070101	数学类	物理,化学(2门科目考生均须选考方可报考)
10001	北京大学	02	北京大学02专业组(思想政治)	030101	法学	思想政治(1门科目考生必须选考方可报考)
10002	中国人民大学	01	中国人民大学01专业组(不限)	020101	经济学	物理(1门科目考生必须选考方可报考)
10003	清华大学	01	清华大学01专业组(物理)	080901	计算机类	物理,化学(2门科目考生均须选考方可报考)
10003	清华大学	02	清华大学02专业组(历史)	060101	历史学类	历史(1门科目考生必须选考方可报考)
```

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/__fixtures__/
git commit -m "test(subjects): 新增选科要求 fixture"
```

---

## Task 9: 编写选科要求解析测试（TDD）

**Files:**
- Create: `scripts/scrapers/subjects/__tests__/parse_requirement.test.ts`

- [ ] **Step 1: 编写 parseRequirement 测试**

创建 `scripts/scrapers/subjects/__tests__/parse_requirement.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { parseRequirement } from '../parse_requirement'

describe('parseRequirement', () => {
  it('不提科目要求 → none', () => {
    const result = parseRequirement('不提科目要求')
    expect(result.type).toBe('none')
    expect(result.subjects).toEqual([])
  })

  it('1 门必选', () => {
    const result = parseRequirement('物理(1门科目考生必须选考方可报考)')
    expect(result.type).toBe('one_required')
    expect(result.subjects).toEqual(['物理'])
  })

  it('2 门必选', () => {
    const result = parseRequirement('物理,化学(2门科目考生均须选考方可报考)')
    expect(result.type).toBe('two_required')
    expect(result.subjects).toEqual(['物理', '化学'])
  })

  it('3 门必选', () => {
    const result = parseRequirement('物理,化学,生物(3门科目考生均须选考方可报考)')
    expect(result.type).toBe('three_required')
    expect(result.subjects).toEqual(['物理', '化学', '生物'])
  })

  it('2 门选考 1 门', () => {
    const result = parseRequirement('物理,化学(2门科目考生选考其中1门即可报考)')
    expect(result.type).toBe('any_of_two')
    expect(result.subjects).toEqual(['物理', '化学'])
  })

  it('3 门选考 2 门', () => {
    const result = parseRequirement('物理,化学,生物(3门科目考生选考其中2门即可报考)')
    expect(result.type).toBe('any_of_three')
    expect(result.subjects).toEqual(['物理', '化学', '生物'])
  })

  it('全角逗号处理', () => {
    const result = parseRequirement('物理，化学(2门科目考生均须选考方可报考)')
    expect(result.type).toBe('two_required')
    expect(result.subjects).toEqual(['物理', '化学'])
  })

  it('未识别格式 → unknown', () => {
    const result = parseRequirement('特殊要求')
    expect(result.type).toBe('unknown')
    expect(result.subjects).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects/__tests__/parse_requirement.test.ts 2>&1 | tail -15`
Expected: FAIL — `Cannot find module '../parse_requirement'`

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/__tests__/parse_requirement.test.ts
git commit -m "test(subjects): 新增选科要求解析测试（失败）"
```

---

## Task 10: 实现选科要求解析函数

**Files:**
- Create: `scripts/scrapers/subjects/parse_requirement.ts`

- [ ] **Step 1: 实现 parseRequirement**

创建 `scripts/scrapers/subjects/parse_requirement.ts`：

```typescript
import type { RequirementType } from '../types'

export interface ParsedRequirement {
  type: RequirementType
  subjects: string[]
}

/**
 * 解析选科要求文本为结构化类型和科目列表。
 *
 * 支持的格式：
 *   - "不提科目要求" → none, []
 *   - "物理(1门科目考生必须选考方可报考)" → one_required, ["物理"]
 *   - "物理,化学(2门科目考生均须选考方可报考)" → two_required, ["物理","化学"]
 *   - "物理,化学(2门科目考生选考其中1门即可报考)" → any_of_two
 */
export function parseRequirement(text: string): ParsedRequirement {
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
  // 支持半角和全角逗号
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

- [ ] **Step 2: 运行测试验证通过**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects/__tests__/parse_requirement.test.ts 2>&1 | tail -15`
Expected: PASS — 8 个用例通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/parse_requirement.ts
git commit -m "feat(subjects): 实现选科要求解析函数"
```

---

## Task 11: 编写浙江选科要求解析测试

**Files:**
- Create: `scripts/scrapers/subjects/__tests__/zhejiang.test.ts`

- [ ] **Step 1: 编写测试**

创建 `scripts/scrapers/subjects/__tests__/zhejiang.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjSubjects } from '../zhejiang'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseZjSubjects', () => {
  it('正常解析 3 条记录', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    expect(records).toHaveLength(3)
  })

  it('字段正确映射', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    const math = records[0]
    expect(math.collegeId).toBe('4111010001')
    expect(math.collegeName).toBe('北京大学')
    expect(math.province).toBe('浙江')
    expect(math.level).toBe('本科')
    expect(math.majorName).toBe('数学类')
    expect(math.subjectRequirement).toContain('物理,化学')
    expect(math.requirementType).toBe('two_required')
    expect(math.requiredSubjects).toEqual(['物理', '化学'])
  })

  it('subMajors 解析为数组', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    expect(records[0].subMajors).toEqual(['数学与应用数学', '信息与计算科学'])
  })

  it('不提科目要求正确解析', () => {
    const records = parseZjSubjects(
      fixtureHtml,
      '4111010001',
      '北京大学',
      'https://www.zjzs.net/col/xk2024/10001.html'
    )
    const law = records.find(r => r.majorName === '法学')
    expect(law).toBeDefined()
    expect(law!.requirementType).toBe('none')
    expect(law!.requiredSubjects).toEqual([])
  })

  it('空 HTML 返回空数组', () => {
    const records = parseZjSubjects('', '4111010001', '北京大学', 'https://example.com')
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects/__tests__/zhejiang.test.ts 2>&1 | tail -15`
Expected: FAIL — `Cannot find module '../zhejiang'`

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/__tests__/zhejiang.test.ts
git commit -m "test(subjects): 新增浙江选科要求解析测试（失败）"
```

---

## Task 12: 实现浙江选科要求解析

**Files:**
- Create: `scripts/scrapers/subjects/zhejiang.ts`

- [ ] **Step 1: 实现 parseZjSubjects**

创建 `scripts/scrapers/subjects/zhejiang.ts`：

```typescript
import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'
import type { SubjectRequirementRecord } from '../types'

/**
 * 解析浙江省选科要求 HTML 页面。
 *
 * HTML 结构：
 *   <table>
 *     <tr><th>层次</th><th>专业(类)名称</th><th>选考科目要求</th><th>类中所含专业</th></tr>
 *     <tr><td>本科</td><td>数学类</td><td>物理,化学(...)</td><td>数学与应用数学、信息与计算科学</td></tr>
 *   </table>
 */
export function parseZjSubjects(
  html: string,
  collegeId: string,
  collegeName: string,
  sourceUrl: string
): SubjectRequirementRecord[] {
  if (!html) return []

  const $ = cheerio.load(html)
  const records: SubjectRequirementRecord[] = []

  $('table tbody tr').each((_, el) => {
    const $row = $(el)
    const cells = $row.find('td')
    if (cells.length < 3) return

    const level = $(cells[0]).text().trim()
    const majorName = $(cells[1]).text().trim()
    const subjectReqText = $(cells[2]).text().trim()
    const subMajorsText = cells.length >= 4 ? $(cells[3]).text().trim() : ''

    if (!majorName || !subjectReqText) return

    const parsed = parseRequirement(subjectReqText)
    const subMajors = subMajorsText
      ? subMajorsText.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
      : undefined

    records.push({
      collegeId,
      collegeName,
      province: '浙江',
      year: 2024,
      level,
      majorName,
      subjectRequirement: subjectReqText,
      requirementType: parsed.type,
      requiredSubjects: parsed.subjects,
      subMajors: subMajors && subMajors.length > 0 ? subMajors : undefined,
      _meta: {
        source: 'zjzs',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: true,
      },
    })
  })

  return records
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects/__tests__/zhejiang.test.ts 2>&1 | tail -15`
Expected: PASS — 5 个用例通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/zhejiang.ts
git commit -m "feat(subjects): 实现浙江选科要求解析"
```

---

## Task 13: 编写江苏选科要求解析测试

**Files:**
- Create: `scripts/scrapers/subjects/__tests__/jiangsu.test.ts`

- [ ] **Step 1: 编写测试**

创建 `scripts/scrapers/subjects/__tests__/jiangsu.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseJsSubjects } from '../jiangsu'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_sample.txt')
const fixtureText = fs.readFileSync(fixturePath, 'utf-8')

// 将文本样本转为二维数组（模拟 xlsx sheet_to_json 输出）
function textToRows(text: string): string[][] {
  return text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t'))
}

describe('parseJsSubjects', () => {
  const rows = textToRows(fixtureText)

  it('正常解析 5 条记录（跳过标题行）', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    expect(records).toHaveLength(5)
  })

  it('字段正确映射', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    const first = records[0]
    expect(first.collegeName).toBe('北京大学')
    expect(first.province).toBe('江苏')
    expect(first.year).toBe(2024)
    expect(first.majorName).toBe('数学类')
    expect(first.majorCode).toBe('070101')
    expect(first.majorGroup).toBe('01')
    expect(first.majorGroupName).toBe('北京大学01专业组(不限)')
    expect(first.requirementType).toBe('two_required')
    expect(first.requiredSubjects).toEqual(['物理', '化学'])
  })

  it('专业组名拆分', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    const law = records.find(r => r.majorName === '法学')
    expect(law).toBeDefined()
    expect(law!.majorGroup).toBe('02')
    expect(law!.majorGroupName).toBe('北京大学02专业组(思想政治)')
  })

  it('多院校解析', () => {
    const records = parseJsSubjects(rows, 'https://example.com/js.xlsx')
    const colleges = new Set(records.map(r => r.collegeName))
    expect(colleges.size).toBe(3) // 北京大学、中国人民大学、清华大学
  })

  it('空数组返回空', () => {
    const records = parseJsSubjects([], 'https://example.com/js.xlsx')
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects/__tests__/jiangsu.test.ts 2>&1 | tail -15`
Expected: FAIL — `Cannot find module '../jiangsu'`

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/__tests__/jiangsu.test.ts
git commit -m "test(subjects): 新增江苏选科要求解析测试（失败）"
```

---

## Task 14: 实现江苏选科要求解析

**Files:**
- Create: `scripts/scrapers/subjects/jiangsu.ts`

- [ ] **Step 1: 实现 parseJsSubjects**

创建 `scripts/scrapers/subjects/jiangsu.ts`：

```typescript
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'
import type { SubjectRequirementRecord } from '../types'

/**
 * 解析江苏选科要求 Excel 的二维数组。
 *
 * 预期 7 列：院校代码、院校名称、专业组代码、专业组名称、专业代码、专业名称、选考科目要求
 * 第一行为标题行，跳过。
 */
export function parseJsSubjects(
  rows: string[][],
  sourceUrl: string
): SubjectRequirementRecord[] {
  if (!rows || rows.length === 0) return []

  const records: SubjectRequirementRecord[] = []

  // 跳过标题行（第一行包含"院校名称"）
  const startIndex = rows[0].some(cell => cell.includes('院校名称')) ? 1 : 0

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 7) continue

    const collegeCode = row[0]?.trim() || ''
    const collegeName = row[1]?.trim() || ''
    const majorGroup = row[2]?.trim() || ''
    const majorGroupName = row[3]?.trim() || ''
    const majorCode = row[4]?.trim() || ''
    const majorName = row[5]?.trim() || ''
    const subjectReqText = row[6]?.trim() || ''

    if (!collegeName || !majorName || !subjectReqText) continue

    const parsed = parseRequirement(subjectReqText)

    // collegeId 用院校代码（国标码）构造，后续主流程会匹配 colleges.json
    records.push({
      collegeId: collegeCode,
      collegeName,
      province: '江苏',
      year: 2024,
      level: '本科',
      majorName,
      majorCode: majorCode || undefined,
      subjectRequirement: subjectReqText,
      requirementType: parsed.type,
      requiredSubjects: parsed.subjects,
      majorGroup: majorGroup || undefined,
      majorGroupName: majorGroupName || undefined,
      _meta: {
        source: 'jseea',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false, // 待主流程匹配 colleges.json 后更新
      },
    })
  }

  return records
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects/__tests__/jiangsu.test.ts 2>&1 | tail -15`
Expected: PASS — 5 个用例通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/jiangsu.ts
git commit -m "feat(subjects): 实现江苏选科要求解析"
```

---

## Task 15: 实现选科要求校验器

**Files:**
- Create: `scripts/scrapers/subjects/validate.ts`
- Create: `scripts/scrapers/subjects/__tests__/validate.test.ts`

- [ ] **Step 1: 编写校验器测试**

创建 `scripts/scrapers/subjects/__tests__/validate.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { validateSubjectRecord } from '../validate'
import type { SubjectRequirementRecord } from '../../types'

function makeRecord(overrides: Partial<SubjectRequirementRecord> = {}): SubjectRequirementRecord {
  return {
    collegeId: '4111010001',
    collegeName: '北京大学',
    province: '浙江',
    year: 2024,
    level: '本科',
    majorName: '数学类',
    subjectRequirement: '物理,化学(2门科目考生均须选考方可报考)',
    requirementType: 'two_required',
    requiredSubjects: ['物理', '化学'],
    _meta: {
      source: 'zjzs',
      sourceUrl: 'https://example.com',
      fetchedAt: '2026-06-18T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateSubjectRecord', () => {
  it('正常记录通过', () => {
    const result = validateSubjectRecord(makeRecord())
    expect(result.valid).toBe(true)
  })

  it('province 非白名单 → 失败', () => {
    const result = validateSubjectRecord(makeRecord({ province: '上海' }))
    expect(result.valid).toBe(false)
  })

  it('majorName 为空 → 失败', () => {
    const result = validateSubjectRecord(makeRecord({ majorName: '' }))
    expect(result.valid).toBe(false)
  })

  it('requirementType=unknown → 通过（仅 warn）', () => {
    const result = validateSubjectRecord(makeRecord({
      requirementType: 'unknown',
      requiredSubjects: [],
    }))
    expect(result.valid).toBe(true)
  })

  it('requiredSubjects 与 type 不一致 → 失败', () => {
    // type=two_required 但 requiredSubjects 为空
    const result = validateSubjectRecord(makeRecord({ requiredSubjects: [] }))
    expect(result.valid).toBe(false)
  })

  it('verified=false → 通过', () => {
    const result = validateSubjectRecord(makeRecord({
      _meta: { ...makeRecord()._meta, verified: false },
    }))
    expect(result.valid).toBe(true)
  })
})
```

- [ ] **Step 2: 实现校验器**

创建 `scripts/scrapers/subjects/validate.ts`：

```typescript
import type { SubjectRequirementRecord, RequirementType } from '../types'

export interface SubjectValidationResult {
  valid: boolean
  reason?: string
}

const VALID_PROVINCES = ['浙江', '江苏']

export function validateSubjectRecord(record: SubjectRequirementRecord): SubjectValidationResult {
  if (!record.collegeName) {
    return { valid: false, reason: 'collegeName 为空' }
  }

  if (!VALID_PROVINCES.includes(record.province)) {
    return { valid: false, reason: `province 非白名单: ${record.province}` }
  }

  if (!record.majorName) {
    return { valid: false, reason: 'majorName 为空' }
  }

  if (!record.subjectRequirement) {
    return { valid: false, reason: 'subjectRequirement 为空' }
  }

  // requiredSubjects 与 type 一致性检查
  if (record.requirementType === 'none' && record.requiredSubjects.length > 0) {
    return { valid: false, reason: 'type=none 但 requiredSubjects 非空' }
  }

  if (record.requirementType !== 'none' && record.requirementType !== 'unknown' && record.requiredSubjects.length === 0) {
    return { valid: false, reason: `type=${record.requirementType} 但 requiredSubjects 为空` }
  }

  if (record.year < 2024) {
    return { valid: false, reason: `year 不合理: ${record.year}` }
  }

  return { valid: true }
}
```

- [ ] **Step 3: 运行测试验证通过**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects/__tests__/validate.test.ts 2>&1 | tail -15`
Expected: PASS — 6 个用例通过

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/subjects/validate.ts scripts/scrapers/subjects/__tests__/validate.test.ts
git commit -m "feat(subjects): 实现选科要求校验器"
```

---

## Task 16: 实现选科要求主流程

**Files:**
- Create: `scripts/scrapers/subjects/index.ts`

- [ ] **Step 1: 实现主流程**

创建 `scripts/scrapers/subjects/index.ts`：

```typescript
import fs from 'node:fs'
import path from 'node:path'
import * as xlsx from 'xlsx'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges } from '../shared/colleges_loader'
import { parseZjSubjects } from './zhejiang'
import { parseJsSubjects } from './jiangsu'
import { validateSubjectRecord } from './validate'
import {
  SCRAPER_VERSION,
  GAOKAO_QPS,
  ZJ_SUBJECTS_URL_TEMPLATE,
  JS_SUBJECTS_XLSX_URL,
  JS_SUBJECTS_PAGE_URL,
  RAW_DIR,
  OUTPUT_DIR,
  REPORTS_DIR,
  LOGS_DIR,
} from '../config'
import type { SubjectRequirementRecord, CollegeRecord } from '../types'

const logger = createLogger('subjects')

interface CliArgs {
  force: boolean
  province?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const provinceArg = args.find(a => a.startsWith('--province='))
  return {
    force: args.includes('--force'),
    province: provinceArg ? provinceArg.split('=')[1] : undefined,
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始选科要求采集', { force: args.force, province: args.province })

  fs.mkdirSync(path.join(OUTPUT_DIR, 'subjects'), { recursive: true })
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // 加载 colleges.json
  const colleges = loadColleges()
  logger.info('colleges.json 加载完成', { count: colleges.length })

  const runZhejiang = !args.province || args.province === '浙江'
  const runJiangsu = !args.province || args.province === '江苏'

  let zjRecords: SubjectRequirementRecord[] = []
  let jsRecords: SubjectRequirementRecord[] = []

  if (runZhejiang) {
    zjRecords = await collectZhejiang(colleges, args.force)
  }

  if (runJiangsu) {
    jsRecords = await collectJiangsu(colleges, args.force)
  }

  // 写入输出文件
  if (runZhejiang) {
    writeOutput(zjRecords, '浙江', 'zjzs', 'https://www.zjzs.net/')
  }
  if (runJiangsu) {
    writeOutput(jsRecords, '江苏', 'jseea', 'https://www.jseea.cn/')
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[选科要求采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `浙江记录: ${zjRecords.length} 条`,
    `江苏记录: ${jsRecords.length} 条`,
    '------------------------------------------------------',
    `总计产出:   ${zjRecords.length + jsRecords.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-subjects-${Date.now()}.log`), report, 'utf-8')
}

async function collectZhejiang(
  colleges: CollegeRecord[],
  force: boolean
): Promise<SubjectRequirementRecord[]> {
  logger.info('Step 1: 采集浙江选科要求', { collegeCount: colleges.length })

  const http = new HttpClient(path.join(RAW_DIR, 'subjects'))
  const allRecords: SubjectRequirementRecord[] = []
  const failed: Array<{ collegeId: string; collegeName: string; error: string }> = []
  const empty: Array<{ collegeId: string; collegeName: string }> = []
  const requestInterval = 1000 / GAOKAO_QPS

  for (let i = 0; i < colleges.length; i++) {
    const college = colleges[i]
    const guobiaoCode = college.moeCode.slice(-5)
    const url = ZJ_SUBJECTS_URL_TEMPLATE.replace('{guobiaoCode}', guobiaoCode)

    if ((i + 1) % 100 === 0) {
      logger.info('浙江选科要求进度', { current: i + 1, total: colleges.length, records: allRecords.length })
    }

    try {
      const result = await http.fetch(url, {
        cacheKey: `zj_${guobiaoCode}.html`,
        forceRefresh: force,
      })

      const records = parseZjSubjects(result.html, college.id, college.name, url)
      if (records.length === 0) {
        empty.push({ collegeId: college.id, collegeName: college.name })
      } else {
        allRecords.push(...records)
      }

      if (!result.fromCache) {
        await sleep(requestInterval)
      }
    } catch (error) {
      failed.push({
        collegeId: college.id,
        collegeName: college.name,
        error: (error as Error).message,
      })
    }
  }

  logger.info('浙江选科要求采集完成', {
    records: allRecords.length,
    failed: failed.length,
    empty: empty.length,
  })

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'zj_subjects_failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (empty.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'zj_subjects_empty.json'),
      JSON.stringify(empty, null, 2),
      'utf-8'
    )
  }

  return allRecords
}

async function collectJiangsu(
  colleges: CollegeRecord[],
  force: boolean
): Promise<SubjectRequirementRecord[]> {
  logger.info('Step 2: 采集江苏选科要求')

  const http = new HttpClient(path.join(RAW_DIR, 'subjects'))

  // 下载 Excel
  logger.info('下载江苏选科要求 Excel', { url: JS_SUBJECTS_XLSX_URL })
  const excelResult = await http.fetchBinary(JS_SUBJECTS_XLSX_URL, {
    cacheKey: 'js_subjects_2024.xlsx',
    forceRefresh: force,
  })

  // 解析 Excel
  const workbook = xlsx.read(excelResult.buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

  logger.info('Excel 解析完成', { rows: rows.length })

  const records = parseJsSubjects(rows, JS_SUBJECTS_PAGE_URL)

  // 匹配 colleges.json（按院校名）
  const collegesByName = new Map<string, CollegeRecord>()
  for (const c of colleges) {
    collegesByName.set(c.name, c)
  }

  const unmatched: Array<{ collegeName: string; reason: string }> = []
  let matched = 0

  for (const record of records) {
    const college = collegesByName.get(record.collegeName)
    if (college) {
      record.collegeId = college.id
      record._meta.verified = true
      matched++
    } else {
      unmatched.push({
        collegeName: record.collegeName,
        reason: '未在 colleges.json 中找到匹配院校',
      })
    }
  }

  logger.info('江苏选科要求匹配完成', {
    total: records.length,
    matched,
    unmatched: unmatched.length,
  })

  if (unmatched.length > 0) {
    // 去重后写入
    const uniqueUnmatched = Array.from(
      new Map(unmatched.map(u => [u.collegeName, u])).values()
    )
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'js_subjects_unmatched.json'),
      JSON.stringify(uniqueUnmatched, null, 2),
      'utf-8'
    )
  }

  return records
}

function writeOutput(
  records: SubjectRequirementRecord[],
  province: string,
  source: string,
  sourceUrl: string
) {
  // 校验
  const validated: SubjectRequirementRecord[] = []
  const rejected: Array<{ record: SubjectRequirementRecord; reason: string }> = []

  for (const record of records) {
    const result = validateSubjectRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  const provinceDir = path.join(OUTPUT_DIR, 'subjects', province)
  fs.mkdirSync(provinceDir, { recursive: true })

  const outputPath = path.join(provinceDir, 'subjects_2024.json')
  fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2), 'utf-8')
  logger.info(`${province} subjects_2024.json 已写入`, { path: outputPath, count: validated.length })

  // meta.json
  const meta = {
    province,
    year: 2024,
    totalCount: validated.length,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [{ name: source, url: sourceUrl, recordCount: validated.length }],
  }
  fs.writeFileSync(
    path.join(provinceDir, 'subjects_2024.meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8'
  )

  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, `${province.toLowerCase()}_subjects_rejected.json`),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('选科要求采集异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
```

- [ ] **Step 2: 运行全部 subjects 测试验证无回归**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers/subjects 2>&1 | tail -15`
Expected: PASS — 24 个用例通过

- [ ] **Step 3: 运行全部 scrapers 测试验证无回归**

Run: `PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/scrapers 2>&1 | tail -15`
Expected: PASS — 所有测试通过

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/subjects/index.ts
git commit -m "feat(subjects): 实现选科要求主流程"
```

---

## Task 17: 新增 subjects npm script 并采集

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 package.json scripts 中新增命令**

在 `"scrape:majors"` 行后新增：

```json
    "scrape:subjects": "tsx scripts/scrapers/subjects/index.ts",
```

- [ ] **Step 2: 运行采集（长时间运行，约 26 分钟）**

Run: `PATH="/opt/homebrew/bin:$PATH" npm run scrape:subjects 2>&1 | tail -40`

这是一个长时间运行的任务（2919 个浙江 HTML 请求 + 1 个江苏 Excel 下载）。请耐心等待完成。

Expected: 采集成功，输出报告显示浙江和江苏记录数

- [ ] **Step 3: 验证浙江产出**

Run: `PATH="/opt/homebrew/bin:$PATH" node -e "const d=require('./public/data/subjects/浙江/subjects_2024.json');console.log('浙江记录:',d.length);console.log('样本:',JSON.stringify(d[0],null,2))"`
Expected: 10000+ 条记录，第一条字段完整

- [ ] **Step 4: 验证江苏产出**

Run: `PATH="/opt/homebrew/bin:$PATH" node -e "const d=require('./public/data/subjects/江苏/subjects_2024.json');console.log('江苏记录:',d.length);console.log('样本:',JSON.stringify(d[0],null,2))"`
Expected: 10000+ 条记录，第一条字段完整

- [ ] **Step 5: 提交**

```bash
git add package.json public/data/subjects/
git commit -m "data: 采集选科要求数据（浙江+江苏）"
```

---

## 自审检查

**1. Spec 覆盖检查：**
- ✅ §1 数据源：Task 1 配置 URL + Task 8 fixture
- ✅ §2 架构（模块结构）：Task 4/5/6（majors）+ Task 10/12/14/15/16（subjects）
- ✅ §3 数据 Schema：Task 1 类型定义
- ✅ §4 采集流程：Task 6（majors 主流程）+ Task 16（subjects 主流程）
- ✅ §4.4 parseRequirement：Task 10
- ✅ §4.5 错误处理与报告：Task 6/16 实现报告文件
- ✅ §4.6 缓存策略：Task 6/16 使用 HttpClient cacheKey
- ✅ §4.7 CLI 接口：Task 7/17 新增 npm script
- ✅ §5 校验规则：Task 5（majors）+ Task 15（subjects）
- ✅ §6 测试策略：Task 3/5/9/11/13/15
- ✅ §7 成功标准：Task 7/17 验证产出

**2. 占位符扫描：** 无 TBD/TODO，所有代码示例完整。

**3. 类型一致性：**
- `MajorCatalogRecord` 在 Task 1 定义，Task 4/5/6 使用 ✓
- `SubjectRequirementRecord` 在 Task 1 定义，Task 12/14/15/16 使用 ✓
- `RequirementType` 在 Task 1 定义，Task 10/15 使用 ✓
- `parseRequirement` 在 Task 10 定义，Task 12/14 调用 ✓
- `parseCatalog` 在 Task 4 定义，Task 6 调用 ✓
- `parseZjSubjects` 在 Task 12 定义，Task 16 调用 ✓
- `parseJsSubjects` 在 Task 14 定义，Task 16 调用 ✓
- `validateCatalogRecord` 在 Task 5 定义，Task 6 调用 ✓
- `validateSubjectRecord` 在 Task 15 定义，Task 16 调用 ✓
