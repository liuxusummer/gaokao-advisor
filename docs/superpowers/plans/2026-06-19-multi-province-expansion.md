# 多省份高考数据扩展实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将高考数据采集从浙江、江苏 2 省扩展到 10 省（新增山东、河北、辽宁、湖北、湖南、广东、北京、上海），覆盖投档线、选科要求、一分一段表三类数据，采用适配器模式重构后扩展。

**Architecture:** 先创建省份注册表（`province_registry.ts`）定义三类适配器接口，将现有浙江/江苏解析逻辑包装为适配器，重构 3 个 `index.ts` 为遍历注册表模式，然后逐批添加 8 个新省份的适配器，最后适配前端。

**Tech Stack:** Node.js + TypeScript + tsx (ESM), Vitest, xlsx (SheetJS), cheerio (HTML), pdf-parse v2 (PDF), tesseract.js (OCR)

**Spec:** `docs/superpowers/specs/2026-06-19-multi-province-expansion-design.md`

---

## 文件结构

### 新增文件

```
scripts/scrapers/
├── shared/
│   ├── province_registry.ts                    # 适配器接口 + 注册表
│   └── registry_init.ts                        # 注册入口（幂等）
├── scores/
│   └── adapters/
│       ├── zhejiang.ts                         # 包装现有 parseZjToudang
│       ├── jiangsu.ts                          # 包装现有 parseJsToudang*
│       ├── shandong.ts                         # 新增：Excel
│       ├── hebei.ts                            # 新增：Excel
│       ├── liaoning.ts                         # 新增：HTML
│       ├── hubei.ts                            # 新增：PDF
│       ├── hunan.ts                            # 新增：Excel
│       ├── guangdong.ts                        # 新增：PDF
│       ├── beijing.ts                          # 新增：HTML
│       └── shanghai.ts                         # 新增：HTML
├── subjects/
│   └── adapters/
│       ├── zhejiang.ts                         # 包装现有 parseZjSubjects
│       ├── jiangsu.ts                          # 包装现有 parseJsSubjects
│       ├── shandong.ts                         # 新增：HTML 逐校
│       ├── hebei.ts                            # 新增：HTML 逐校
│       ├── liaoning.ts                         # 新增：HTML 逐校
│       ├── hubei.ts                            # 新增：HTML 逐校
│       ├── hunan.ts                            # 新增：HTML 逐校
│       ├── guangdong.ts                        # 新增：HTML 逐校
│       ├── beijing.ts                          # 新增：HTML 逐校
│       └── shanghai.ts                         # 新增：HTML 逐校
└── rank_tables/
    └── adapters/
        ├── zhejiang.ts                         # 包装现有 parseZjTable
        ├── jiangsu.ts                          # 包装现有 parseJsTable
        ├── shandong.ts                         # 新增：Excel
        ├── hebei.ts                            # 新增：OCR
        ├── liaoning.ts                         # 新增：HTML/OCR
        ├── hubei.ts                            # 新增：HTML
        ├── hunan.ts                            # 新增：HTML/OCR
        ├── guangdong.ts                        # 新增：PDF/OCR
        ├── beijing.ts                          # 新增：HTML/OCR
        └── shanghai.ts                         # 新增：HTML
```

每省还需创建对应的解析函数文件（`scores/shandong.ts`、`subjects/shandong.ts`、`rank_tables/shandong.ts` 等）。

### 修改文件

- `scripts/scrapers/config.ts` — TARGET_PROVINCES 扩展为 10 省，可环境变量配置
- `scripts/scrapers/scores/index.ts` — 重构为遍历注册表
- `scripts/scrapers/subjects/index.ts` — 重构为遍历注册表
- `scripts/scrapers/rank_tables/index.ts` — 重构为遍历注册表
- `scripts/scrapers/scores/validate.ts` — 省份白名单从 config 读取
- `scripts/scrapers/subjects/validate.ts` — 省份白名单从 config 读取
- `scripts/scrapers/rank_tables/validate.ts` — 省份白名单从 config 读取
- `src/services/dataLoader.ts` — KNOWN_REAL_PROVINCES 扩展为 10 省
- `src/pages/DataCenter.tsx` — PROVINCE_OPTIONS 从 mock.ts 派生
- `src/services/riskDetector.ts` — 志愿模式从 mock.ts 的 mode 字段判断

---

## 批次 0：重构（适配器接口 + 注册表 + 浙江/江苏包装 + index.ts 重构）

### Task 1: 创建省份注册表

**Files:**
- Create: `scripts/scrapers/shared/province_registry.ts`
- Test: `scripts/scrapers/shared/__tests__/province_registry.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `scripts/scrapers/shared/__tests__/province_registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerProvince,
  getProvince,
  getAllProvinces,
  getEnabledProvinces,
  clearRegistry,
} from '../province_registry'
import type { ProvinceRegistry, ProvinceMeta } from '../province_registry'

const mockMeta: ProvinceMeta = {
  name: '测试省',
  pinyinId: 'test',
  examMode: '3+3',
  volunteerMode: 'major+college',
  categories: ['综合'],
  batchSize: '本科批',
}

describe('province_registry', () => {
  beforeEach(() => {
    clearRegistry()
  })

  it('registerProvince 注册省份后可通过 getProvince 获取', () => {
    const registry: ProvinceRegistry = { meta: mockMeta }
    registerProvince(registry)

    const result = getProvince('测试省')
    expect(result).toBeDefined()
    expect(result?.meta.name).toBe('测试省')
  })

  it('getAllProvinces 返回所有已注册省份', () => {
    registerProvince({ meta: mockMeta })
    registerProvince({
      meta: { ...mockMeta, name: '测试省2', pinyinId: 'test2' },
    })

    const all = getAllProvinces()
    expect(all).toHaveLength(2)
  })

  it('getEnabledProvinces 按 TARGET_PROVINCES 过滤', () => {
    registerProvince({ meta: mockMeta })
    registerProvince({
      meta: { ...mockMeta, name: '未启用省', pinyinId: 'disabled' },
    })

    const original = process.env.TARGET_PROVINCES
    process.env.TARGET_PROVINCES = '测试省'
    const enabled = getEnabledProvinces()
    process.env.TARGET_PROVINCES = original

    expect(enabled).toHaveLength(1)
    expect(enabled[0].meta.name).toBe('测试省')
  })

  it('getProvince 未注册省份返回 undefined', () => {
    expect(getProvince('不存在')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run scripts/scrapers/shared/__tests__/province_registry.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 province_registry.ts**

创建 `scripts/scrapers/shared/province_registry.ts`:

```typescript
import type { HttpClient } from './http'
import type {
  ScoreRecord,
  SubjectRequirementRecord,
  RankTableRecord,
  FailedRecord,
} from '../types'

/** 省份元信息 */
export interface ProvinceMeta {
  name: string
  pinyinId: string
  examMode: '3+3' | '3+1+2'
  volunteerMode: 'major+college' | 'college-group'
  categories: string[]
  batchSize: string
}

/** 投档线适配器接口 */
export interface ScoreScraper {
  readonly province: string
  scrape(
    client: HttpClient,
    year: number,
    options?: { force?: boolean }
  ): Promise<{ records: ScoreRecord[]; failed: FailedRecord[] }>
}

/** 选科要求适配器接口 */
export interface SubjectScraper {
  readonly province: string
  scrape(
    client: HttpClient,
    year: number,
    options?: { force?: boolean }
  ): Promise<{ records: SubjectRequirementRecord[]; failed: FailedRecord[] }>
}

/** 一分一段表适配器接口 */
export interface RankTableScraper {
  readonly province: string
  scrape(
    client: HttpClient,
    year: number,
    options?: { force?: boolean }
  ): Promise<{ records: RankTableRecord[]; failed: FailedRecord[] }>
}

/** 省份注册表 */
export interface ProvinceRegistry {
  meta: ProvinceMeta
  scoreScraper?: ScoreScraper
  subjectScraper?: SubjectScraper
  rankTableScraper?: RankTableScraper
}

const REGISTRY = new Map<string, ProvinceRegistry>()

/** 注册省份 */
export function registerProvince(registry: ProvinceRegistry): void {
  REGISTRY.set(registry.meta.name, registry)
}

/** 获取单个省份注册信息 */
export function getProvince(name: string): ProvinceRegistry | undefined {
  return REGISTRY.get(name)
}

/** 获取所有已注册省份 */
export function getAllProvinces(): ProvinceRegistry[] {
  return Array.from(REGISTRY.values())
}

/** 获取启用的省份（按 TARGET_PROVINCES 环境变量或默认 10 省过滤） */
export function getEnabledProvinces(): ProvinceRegistry[] {
  const targetProvinces = (process.env.TARGET_PROVINCES?.split(',') as string[]) ??
    ['浙江', '江苏', '山东', '河北', '辽宁', '湖北', '湖南', '广东', '北京', '上海']

  return getAllProvinces().filter((r) => targetProvinces.includes(r.meta.name))
}

/** 清空注册表（仅用于测试） */
export function clearRegistry(): void {
  REGISTRY.clear()
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run scripts/scrapers/shared/__tests__/province_registry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/shared/province_registry.ts scripts/scrapers/shared/__tests__/province_registry.test.ts
git commit -m "feat: add province registry with adapter interfaces"
```

---

### Task 2: 创建浙江投档线适配器（包装现有解析）

**Files:**
- Create: `scripts/scrapers/scores/adapters/zhejiang.ts`

- [ ] **Step 1: 创建适配器文件**

创建 `scripts/scrapers/scores/adapters/zhejiang.ts`:

```typescript
import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseZjToudang } from '../zhejiang'
import { ZJ_TOUDANG_URLS } from '../../config'

export const zhejiangScoreScraper: ScoreScraper = {
  province: '浙江',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = ZJ_TOUDANG_URLS[year]
    if (!urlConfig) {
      return { records, failed }
    }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `zj_toudang_${year}.xls`,
        forceRefresh: options?.force,
      })

      const parsed = parseZjToudang(result.buffer, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `浙江 ${year}`,
      })
    }

    return { records, failed }
  },
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/scores/adapters/zhejiang.ts
git commit -m "feat: wrap zhejiang score parser as adapter"
```

---

### Task 3: 创建江苏投档线适配器（包装现有解析）

**Files:**
- Create: `scripts/scrapers/scores/adapters/jiangsu.ts`

- [ ] **Step 1: 创建适配器文件**

创建 `scripts/scrapers/scores/adapters/jiangsu.ts`:

```typescript
import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseJsToudangExcel, parseJsToudangPdf } from '../jiangsu'
import { parsePdf } from '../../shared/pdf'
import { JS_TOUDANG_URLS } from '../../config'

export const jiangsuScoreScraper: ScoreScraper = {
  province: '江苏',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = JS_TOUDANG_URLS[year]
    if (!urlConfig) {
      return { records, failed }
    }

    for (const category of ['物理类', '历史类'] as const) {
      const fileConfig = urlConfig.files[category]
      if (!fileConfig) continue

      try {
        const result = await client.fetchBinary(fileConfig.url, {
          cacheKey: `js_toudang_${year}_${category}.${fileConfig.format}`,
          forceRefresh: options?.force,
        })

        let parsed: ScoreRecord[]
        if (fileConfig.format === 'xls') {
          parsed = parseJsToudangExcel(result.buffer, year, category, fileConfig.pageUrl)
        } else {
          const text = await parsePdf(result.buffer)
          parsed = parseJsToudangPdf(text, year, category, fileConfig.pageUrl)
        }

        records.push(...parsed)
      } catch (error) {
        failed.push({
          url: fileConfig.url,
          error: (error as Error).message,
          retryCount: 3,
          context: `江苏 ${year} ${category}`,
        })
      }
    }

    return { records, failed }
  },
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/scores/adapters/jiangsu.ts
git commit -m "feat: wrap jiangsu score parser as adapter"
```

---

### Task 4: 创建浙江选科要求适配器

**Files:**
- Create: `scripts/scrapers/subjects/adapters/zhejiang.ts`

- [ ] **Step 1: 创建适配器文件**

创建 `scripts/scrapers/subjects/adapters/zhejiang.ts`:

```typescript
import path from 'node:path'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, CollegeRecord, FailedRecord } from '../../types'
import { loadColleges } from '../../shared/colleges_loader'
import { parseZjSubjects } from '../zhejiang'
import { GAOKAO_QPS, ZJ_SUBJECTS_URL_TEMPLATE, OUTPUT_DIR } from '../../config'

export const zhejiangSubjectScraper: SubjectScraper = {
  province: '浙江',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
    const collegesMap = loadColleges(collegesPath)
    const colleges: CollegeRecord[] = Array.from(collegesMap.values())

    const requestInterval = 1000 / GAOKAO_QPS

    for (let i = 0; i < colleges.length; i++) {
      const college = colleges[i]
      const guobiaoCode = college.moeCode.slice(-5)
      const url = ZJ_SUBJECTS_URL_TEMPLATE.replace('{guobiaoCode}', guobiaoCode)

      try {
        const result = await client.fetch(url, {
          cacheKey: `zj_${guobiaoCode}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseZjSubjects(result.html, college.id, college.name, url)
        records.push(...parsed)

        if (!result.fromCache) {
          await new Promise((resolve) => setTimeout(resolve, requestInterval))
        }
      } catch (error) {
        failed.push({
          url,
          error: (error as Error).message,
          retryCount: 0,
          context: `浙江 ${college.name}`,
        })
      }
    }

    return { records, failed }
  },
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/subjects/adapters/zhejiang.ts
git commit -m "feat: wrap zhejiang subject parser as adapter"
```

---

### Task 5: 创建江苏选科要求适配器

**Files:**
- Create: `scripts/scrapers/subjects/adapters/jiangsu.ts`

- [ ] **Step 1: 创建适配器文件**

创建 `scripts/scrapers/subjects/adapters/jiangsu.ts`:

```typescript
import * as xlsx from 'xlsx'
import path from 'node:path'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, CollegeRecord, FailedRecord } from '../../types'
import { loadColleges } from '../../shared/colleges_loader'
import { parseJsSubjects } from '../jiangsu'
import { JS_SUBJECTS_XLSX_URL, JS_SUBJECTS_PAGE_URL, OUTPUT_DIR } from '../../config'

export const jiangsuSubjectScraper: SubjectScraper = {
  province: '江苏',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    try {
      const result = await client.fetchBinary(JS_SUBJECTS_XLSX_URL, {
        cacheKey: 'js_subjects_2024.xlsx',
        forceRefresh: options?.force,
      })

      const workbook = xlsx.read(result.buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

      const parsed = parseJsSubjects(rows, JS_SUBJECTS_PAGE_URL).filter(
        (r) => r.collegeName !== '院校名称' && r.collegeId !== '院校代码'
      )

      // 匹配 colleges.json
      const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
      const collegesMap = loadColleges(collegesPath)
      const collegesByName = new Map<string, CollegeRecord>()
      for (const c of collegesMap.values()) {
        collegesByName.set(c.name, c)
      }

      for (const record of parsed) {
        const college = collegesByName.get(record.collegeName)
        if (college) {
          record.collegeId = college.id
          record._meta.verified = true
        }
      }

      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: JS_SUBJECTS_XLSX_URL,
        error: (error as Error).message,
        retryCount: 3,
        context: `江苏选科要求`,
      })
    }

    return { records, failed }
  },
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/subjects/adapters/jiangsu.ts
git commit -m "feat: wrap jiangsu subject parser as adapter"
```

---

### Task 6: 创建浙江一分一段表适配器

**Files:**
- Create: `scripts/scrapers/rank_tables/adapters/zhejiang.ts`

- [ ] **Step 1: 创建适配器文件**

创建 `scripts/scrapers/rank_tables/adapters/zhejiang.ts`:

```typescript
import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parsePdf } from '../../shared/pdf'
import { parseZjTable } from '../zhejiang'
import { ZJ_RANK_TABLE_URLS } from '../../config'

export const zhejiangRankTableScraper: RankTableScraper = {
  province: '浙江',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = ZJ_RANK_TABLE_URLS[year]
    if (!urlConfig || !urlConfig.pdfUrl) {
      return { records, failed }
    }

    try {
      const result = await client.fetchBinary(urlConfig.pdfUrl, {
        cacheKey: `zj_rank_${year}`,
        forceRefresh: options?.force,
      })

      const text = await parsePdf(result.buffer)
      const parsed = parseZjTable(text, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.pdfUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `浙江一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/rank_tables/adapters/zhejiang.ts
git commit -m "feat: wrap zhejiang rank table parser as adapter"
```

---

### Task 7: 创建江苏一分一段表适配器

**Files:**
- Create: `scripts/scrapers/rank_tables/adapters/jiangsu.ts`

- [ ] **Step 1: 创建适配器文件**

创建 `scripts/scrapers/rank_tables/adapters/jiangsu.ts`:

```typescript
import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { ocrImage } from '../../shared/ocr'
import { parseJsTable } from '../jiangsu'
import { JS_RANK_TABLE_URLS } from '../../config'

export const jiangsuRankTableScraper: RankTableScraper = {
  province: '江苏',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = JS_RANK_TABLE_URLS[year]
    if (!urlConfig || !urlConfig.images) {
      return { records, failed }
    }

    for (const category of ['物理类', '历史类'] as const) {
      const imageUrls = urlConfig.images[category]
      if (!imageUrls) continue

      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const result = await client.fetchBinary(imageUrls[i], {
            cacheKey: `js_rank_${year}_${category}_${i + 1}`,
            forceRefresh: options?.force,
          })

          const text = await ocrImage(result.buffer)
          const parsed = parseJsTable(text, year, category, urlConfig.pageUrl)
          records.push(...parsed)
        } catch (error) {
          failed.push({
            url: imageUrls[i],
            error: (error as Error).message,
            retryCount: 3,
            context: `江苏一分一段表 ${year} ${category} part ${i + 1}`,
          })
        }
      }
    }

    return { records, failed }
  },
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/rank_tables/adapters/jiangsu.ts
git commit -m "feat: wrap jiangsu rank table parser as adapter"
```

---

### Task 8: 创建省份注册入口文件

**Files:**
- Create: `scripts/scrapers/shared/registry_init.ts`

- [ ] **Step 1: 创建注册入口文件**

创建 `scripts/scrapers/shared/registry_init.ts`:

```typescript
import { registerProvince } from './province_registry'
import { zhejiangScoreScraper } from '../scores/adapters/zhejiang'
import { jiangsuScoreScraper } from '../scores/adapters/jiangsu'
import { zhejiangSubjectScraper } from '../subjects/adapters/zhejiang'
import { jiangsuSubjectScraper } from '../subjects/adapters/jiangsu'
import { zhejiangRankTableScraper } from '../rank_tables/adapters/zhejiang'
import { jiangsuRankTableScraper } from '../rank_tables/adapters/jiangsu'

let initialized = false

/** 注册所有已实现的省份适配器（幂等） */
export function ensureRegistryInitialized(): void {
  if (initialized) return

  // 浙江（3+3，专业+院校，综合）
  registerProvince({
    meta: {
      name: '浙江',
      pinyinId: 'zhejiang',
      examMode: '3+3',
      volunteerMode: 'major+college',
      categories: ['综合'],
      batchSize: '普通类第一段',
    },
    scoreScraper: zhejiangScoreScraper,
    subjectScraper: zhejiangSubjectScraper,
    rankTableScraper: zhejiangRankTableScraper,
  })

  // 江苏（3+1+2，院校专业组，物理类+历史类）
  registerProvince({
    meta: {
      name: '江苏',
      pinyinId: 'jiangsu',
      examMode: '3+1+2',
      volunteerMode: 'college-group',
      categories: ['物理类', '历史类'],
      batchSize: '本科批',
    },
    scoreScraper: jiangsuScoreScraper,
    subjectScraper: jiangsuSubjectScraper,
    rankTableScraper: jiangsuRankTableScraper,
  })

  initialized = true
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add registry initialization for zhejiang and jiangsu"
```

---

### Task 9: 更新 config.ts TARGET_PROVINCES

**Files:**
- Modify: `scripts/scrapers/config.ts:41`

- [ ] **Step 1: 修改 TARGET_PROVINCES**

将 `scripts/scrapers/config.ts` 第 41 行:

```typescript
export const TARGET_PROVINCES = ['浙江', '江苏']
```

改为:

```typescript
export const TARGET_PROVINCES = (process.env.TARGET_PROVINCES?.split(',') as string[])
  ?? ['浙江', '江苏', '山东', '河北', '辽宁', '湖北', '湖南', '广东', '北京', '上海']
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/config.ts
git commit -m "feat: expand TARGET_PROVINCES to 10 provinces with env override"
```

---

### Task 10: 更新 scores/validate.ts 省份白名单

**Files:**
- Modify: `scripts/scrapers/scores/validate.ts`

- [ ] **Step 1: 添加 config 导入**

在 `scripts/scrapers/scores/validate.ts` 顶部第 1 行后添加:

```typescript
import { PROVINCES } from '../config'
```

- [ ] **Step 2: 修改省份白名单和 category 校验**

将第 37-48 行:

```typescript
  // province 白名单
  if (!['浙江', '江苏'].includes(record.province)) {
    return { valid: false, reason: `province 不在白名单: ${record.province}` }
  }

  // category 合法性
  if (record.province === '浙江' && record.category !== '综合') {
    return { valid: false, reason: `浙江 category 必须为 综合: ${record.category}` }
  }
  if (record.province === '江苏' && !['物理类', '历史类'].includes(record.category)) {
    return { valid: false, reason: `江苏 category 必须为 物理类/历史类: ${record.category}` }
  }
```

改为:

```typescript
  // province 白名单（31 省全量白名单）
  if (!PROVINCES.includes(record.province)) {
    return { valid: false, reason: `province 不在白名单: ${record.province}` }
  }

  // category 合法性（按考试模式校验）
  const COMPREHENSIVE_PROVINCES = ['浙江', '山东', '北京', '上海']
  const PHYSICAL_HISTORY_PROVINCES = ['江苏', '河北', '辽宁', '湖北', '湖南', '广东']

  if (COMPREHENSIVE_PROVINCES.includes(record.province) && record.category !== '综合') {
    return { valid: false, reason: `${record.province} category 必须为 综合: ${record.category}` }
  }
  if (PHYSICAL_HISTORY_PROVINCES.includes(record.province) &&
      !['物理类', '历史类'].includes(record.category)) {
    return { valid: false, reason: `${record.province} category 必须为 物理类/历史类: ${record.category}` }
  }
```

- [ ] **Step 3: 运行现有测试确认无回归**

Run: `npx vitest run scripts/scrapers/scores/__tests__/validate.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/scores/validate.ts
git commit -m "feat: expand score validate province whitelist to 31 provinces"
```

---

### Task 11: 更新 subjects/validate.ts 和 rank_tables/validate.ts 省份白名单

**Files:**
- Modify: `scripts/scrapers/subjects/validate.ts`
- Modify: `scripts/scrapers/rank_tables/validate.ts`

- [ ] **Step 1: 修改 subjects/validate.ts**

在文件顶部添加:

```typescript
import { PROVINCES } from '../config'
```

将省份白名单校验（`if (!['浙江', '江苏'].includes(record.province))`）改为:

```typescript
  if (!PROVINCES.includes(record.province)) {
    return { valid: false, reason: `province 不在白名单: ${record.province}` }
  }
```

- [ ] **Step 2: 修改 rank_tables/validate.ts**

在文件顶部添加:

```typescript
import { PROVINCES } from '../config'
```

将省份白名单校验改为:

```typescript
  if (!PROVINCES.includes(record.province)) {
    return { valid: false, reason: `province 不在白名单: ${record.province}` }
  }
```

- [ ] **Step 3: 运行测试**

Run: `npx vitest run scripts/scrapers/subjects/__tests__/validate.test.ts scripts/scrapers/rank_tables/__tests__/validate.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/subjects/validate.ts scripts/scrapers/rank_tables/validate.ts
git commit -m "feat: expand subjects and rank_tables validate province whitelist"
```

---

### Task 12: 重构 scores/index.ts 为遍历注册表

**Files:**
- Modify: `scripts/scrapers/scores/index.ts`

- [ ] **Step 1: 重写 scores/index.ts**

将 `scripts/scrapers/scores/index.ts` 完整替换为:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges } from '../shared/colleges_loader'
import { validateScoreRecord } from './validate'
import { ensureRegistryInitialized } from '../shared/registry_init'
import { getProvince, getEnabledProvinces } from '../shared/province_registry'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  OUTPUT_DIR,
  SCORES_OUTPUT_DIR,
  SCORES_REPORTS_DIR,
  LOGS_DIR,
  TARGET_YEARS,
} from '../config'
import type {
  ScoreRecord,
  ScoresMeta,
  FailedRecord,
  ScoreWarningRecord,
  CollegeRecord,
} from '../types'

const logger = createLogger('scores')

interface CliArgs {
  force: boolean
  province?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const provinceArg = args.find((a) => a.startsWith('--province='))
  return {
    force: args.includes('--force'),
    province: provinceArg ? provinceArg.split('=')[1] : undefined,
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  ensureRegistryInitialized()

  logger.info('开始投档线采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    province: args.province ?? '全部',
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SCORES_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // 加载院校白名单
  const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
  if (!fs.existsSync(collegesPath)) {
    logger.error('colleges.json 不存在，请先运行 scrape:colleges', { path: collegesPath })
    process.exit(2)
  }

  const collegesById = loadColleges(collegesPath)
  const collegesByName = new Map<string, CollegeRecord>()
  for (const college of collegesById.values()) {
    collegesByName.set(college.name, college)
  }
  logger.info('院校白名单加载完成', { count: collegesByName.size })

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'scores'))
  const allScores: ScoreRecord[] = []
  const failed: FailedRecord[] = []
  const warnings: ScoreWarningRecord[] = []
  const stats: Array<{ province: string; year: number; category?: string; count: number; matched: number }> = []

  // 确定要处理的省份列表
  const provinces = args.province
    ? [getProvince(args.province)!].filter(Boolean)
    : getEnabledProvinces()

  // 遍历省份注册表采集
  for (const reg of provinces) {
    if (!reg.scoreScraper) {
      logger.warn('省份未注册投档线适配器，跳过', { province: reg.meta.name })
      continue
    }

    for (const year of TARGET_YEARS) {
      try {
        logger.info('采集投档线', { province: reg.meta.name, year })
        const { records, failed: provFailed } = await reg.scoreScraper.scrape(http, year, {
          force: args.force,
        })

        const matched = matchColleges(records, collegesByName, warnings, reg.meta.name, year)
        allScores.push(...records)
        failed.push(...provFailed)

        // 按科类统计
        const categories = new Set(records.map((r) => r.category))
        if (categories.size <= 1) {
          stats.push({ province: reg.meta.name, year, count: records.length, matched })
        } else {
          for (const category of categories) {
            const catRecords = records.filter((r) => r.category === category)
            const catMatched = catRecords.filter((r) => r._meta.verified).length
            stats.push({ province: reg.meta.name, year, category, count: catRecords.length, matched: catMatched })
          }
        }
      } catch (error) {
        logger.error('投档线采集失败', {
          province: reg.meta.name, year, error: (error as Error).message,
        })
        failed.push({
          url: '',
          error: (error as Error).message,
          retryCount: 3,
          context: `${reg.meta.name} ${year}`,
        })
      }
    }
  }

  // 校验与产出
  const validated: ScoreRecord[] = []
  const rejected: Array<{ record: Partial<ScoreRecord>; reason: string }> = []

  for (const record of allScores) {
    const result = validateScoreRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  // 按 province/year 分组写入
  for (const reg of provinces) {
    const province = reg.meta.name
    const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
    fs.mkdirSync(provinceDir, { recursive: true })

    for (const year of TARGET_YEARS) {
      const records = validated.filter((s) => s.province === province && s.year === year)
      const outputPath = path.join(provinceDir, `scores_${year}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8')
      logger.info('投档线文件已写入', { province, year, count: records.length, path: outputPath })
    }
  }

  // 写入元信息
  const meta = buildScoresMeta(validated, provinces.map((r) => r.meta.name))
  const metaPath = path.join(SCORES_OUTPUT_DIR, 'scores.meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(path.join(SCORES_REPORTS_DIR, 'failed.json'), JSON.stringify(failed, null, 2), 'utf-8')
  }
  if (warnings.length > 0) {
    fs.writeFileSync(path.join(SCORES_REPORTS_DIR, 'warnings.json'), JSON.stringify(warnings, null, 2), 'utf-8')
  }
  if (rejected.length > 0) {
    fs.writeFileSync(path.join(SCORES_REPORTS_DIR, 'rejected.json'), JSON.stringify(rejected, null, 2), 'utf-8')
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[投档线采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    ...stats.map((s) =>
      s.category
        ? `${s.province} ${s.year} ${s.category}: ${s.count} 条 (匹配 ${s.matched}/${s.count})`
        : `${s.province} ${s.year}: ${s.count} 条 (匹配 ${s.matched}/${s.count})`
    ),
    '------------------------------------------------------',
    `总计产出:   ${validated.length} 条`,
    `校验拒绝:   ${rejected.length} 条`,
    `未匹配:     ${warnings.length} 条 (warnings.json)`,
    `失败:       ${failed.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-scores-${Date.now()}.log`), report, 'utf-8')

  if (failed.length > 0) {
    process.exit(1)
  }
}

function matchColleges(
  records: ScoreRecord[],
  collegesByName: Map<string, CollegeRecord>,
  warnings: ScoreWarningRecord[],
  province: string,
  year: number
): number {
  let matched = 0

  for (const record of records) {
    const result = matchCollege(record.collegeName, collegesByName)

    if (result.collegeId) {
      record.collegeId = result.collegeId
      record._meta.verified = true
      matched++
    } else {
      record.collegeId = ''
      record._meta.verified = false
      if (!warnings.some((w) => w.collegeName === record.collegeName && w.year === year)) {
        warnings.push({
          collegeId: '',
          collegeName: record.collegeName,
          type: 'missing_data',
          detail: `未在 colleges.json 中找到匹配院校 (${province} ${year})`,
        })
      }
    }
  }

  return matched
}

function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): { collegeId: string; matchType: string } {
  const exact = collegesByName.get(name)
  if (exact) return { collegeId: exact.id, matchType: 'exact' }

  const bracketIndex = name.indexOf('(')
  if (bracketIndex > 0) {
    const stripped = name.substring(0, bracketIndex).trim()
    const strippedMatch = collegesByName.get(stripped)
    if (strippedMatch) return { collegeId: strippedMatch.id, matchType: 'stripped' }
  }

  for (const [collegeName, college] of collegesByName) {
    if (collegeName.includes(name) || name.includes(collegeName)) {
      return { collegeId: college.id, matchType: 'contains' }
    }
  }

  return { collegeId: '', matchType: 'none' }
}

function buildScoresMeta(records: ScoreRecord[], provinceNames: string[]): ScoresMeta {
  const provinces = provinceNames.map((name) => {
    const years = TARGET_YEARS
    const scoreRecordCount: Record<number, number> = {}
    const rankTableRecordCount: Record<number, number> = {}

    for (const year of years) {
      scoreRecordCount[year] = records.filter((r) => r.province === name && r.year === year).length
      rankTableRecordCount[year] = 0
    }

    return { name, years, scoreRecordCount, rankTableRecordCount }
  })

  return {
    provinces,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    sources: [
      { name: '各省教育考试院', url: '', coverage: '投档线 2023-2025' },
    ],
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('投档线采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
```

- [ ] **Step 2: 运行现有测试确认无回归**

Run: `npx vitest run scripts/scrapers/scores/`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/index.ts
git commit -m "refactor: scores/index.ts to iterate province registry"
```

---

### Task 13: 重构 subjects/index.ts 为遍历注册表

**Files:**
- Modify: `scripts/scrapers/subjects/index.ts`

- [ ] **Step 1: 重写 subjects/index.ts**

将 `scripts/scrapers/subjects/index.ts` 完整替换为:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { validateSubjectRecord } from './validate'
import { ensureRegistryInitialized } from '../shared/registry_init'
import { getProvince, getEnabledProvinces } from '../shared/province_registry'
import {
  SCRAPER_VERSION,
  ROOT_DIR,
  LOGS_DIR,
} from '../config'
import type { SubjectRequirementRecord, FailedRecord } from '../types'

const logger = createLogger('subjects')

const SUBJECTS_OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'data', 'subjects')
const SUBJECTS_REPORTS_DIR = path.join(SUBJECTS_OUTPUT_DIR, 'reports')

interface CliArgs {
  force: boolean
  province?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const provinceArg = args.find((a) => a.startsWith('--province='))
  return {
    force: args.includes('--force'),
    province: provinceArg ? provinceArg.split('=')[1] : undefined,
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  ensureRegistryInitialized()

  logger.info('开始选科要求采集', { force: args.force, province: args.province ?? '全部' })

  fs.mkdirSync(SUBJECTS_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SUBJECTS_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'subjects'))

  const provinces = args.province
    ? [getProvince(args.province)!].filter(Boolean)
    : getEnabledProvinces()

  const allFailed: FailedRecord[] = []
  const stats: Array<{ province: string; count: number; failed: number }> = []

  for (const reg of provinces) {
    if (!reg.subjectScraper) {
      logger.warn('省份未注册选科要求适配器，跳过', { province: reg.meta.name })
      continue
    }

    try {
      logger.info('采集选科要求', { province: reg.meta.name })
      const { records, failed } = await reg.subjectScraper.scrape(http, 2024, {
        force: args.force,
      })

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

      // 写入文件
      const provinceDir = path.join(SUBJECTS_OUTPUT_DIR, reg.meta.name)
      fs.mkdirSync(provinceDir, { recursive: true })
      const outputPath = path.join(provinceDir, 'subjects_2024.json')
      fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2), 'utf-8')
      logger.info('选科要求文件已写入', {
        province: reg.meta.name, count: validated.length, path: outputPath,
      })

      // meta.json
      const meta = {
        province: reg.meta.name,
        year: 2024,
        totalCount: validated.length,
        generatedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
      }
      fs.writeFileSync(
        path.join(provinceDir, 'subjects_2024.meta.json'),
        JSON.stringify(meta, null, 2),
        'utf-8'
      )

      if (rejected.length > 0) {
        fs.writeFileSync(
          path.join(SUBJECTS_REPORTS_DIR, `${reg.meta.pinyinId}_subjects_rejected.json`),
          JSON.stringify(rejected, null, 2),
          'utf-8'
        )
      }

      allFailed.push(...failed)
      stats.push({ province: reg.meta.name, count: validated.length, failed: failed.length })
    } catch (error) {
      logger.error('选科要求采集失败', {
        province: reg.meta.name, error: (error as Error).message,
      })
      allFailed.push({
        url: '',
        error: (error as Error).message,
        retryCount: 3,
        context: reg.meta.name,
      })
    }
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[选科要求采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    ...stats.map((s) => `${s.province}: ${s.count} 条 (失败 ${s.failed})`),
    '------------------------------------------------------',
    `总计产出:   ${stats.reduce((sum, s) => sum + s.count, 0)} 条`,
    `失败:       ${allFailed.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-subjects-${Date.now()}.log`), report, 'utf-8')
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

- [ ] **Step 2: 运行现有测试**

Run: `npx vitest run scripts/scrapers/subjects/`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/index.ts
git commit -m "refactor: subjects/index.ts to iterate province registry"
```

---

### Task 14: 重构 rank_tables/index.ts 为遍历注册表

**Files:**
- Modify: `scripts/scrapers/rank_tables/index.ts`

- [ ] **Step 1: 重写 rank_tables/index.ts**

将 `scripts/scrapers/rank_tables/index.ts` 完整替换为:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { validateRankRecord, validateRankTableMonotonicity } from './validate'
import { ensureRegistryInitialized } from '../shared/registry_init'
import { getProvince, getEnabledProvinces } from '../shared/province_registry'
import {
  SCRAPER_VERSION,
  SCORES_OUTPUT_DIR,
  LOGS_DIR,
  TARGET_YEARS,
} from '../config'
import type { RankTableRecord, RankTableFile } from '../types'

const logger = createLogger('rank_tables')

interface CliArgs {
  force: boolean
  province?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const provinceArg = args.find((a) => a.startsWith('--province='))
  return {
    force: args.includes('--force'),
    province: provinceArg ? provinceArg.split('=')[1] : undefined,
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  ensureRegistryInitialized()

  logger.info('开始一分一段表采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    province: args.province ?? '全部',
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'rank_tables'))
  const results: Array<{ province: string; year: number; count: number }> = []
  const errors: Array<{ province: string; year: number; error: string }> = []

  const provinces = args.province
    ? [getProvince(args.province)!].filter(Boolean)
    : getEnabledProvinces()

  for (const reg of provinces) {
    if (!reg.rankTableScraper) {
      logger.warn('省份未注册一分一段表适配器，跳过', { province: reg.meta.name })
      continue
    }

    for (const year of TARGET_YEARS) {
      try {
        logger.info('采集一分一段表', { province: reg.meta.name, year })
        const { records, failed } = await reg.rankTableScraper.scrape(http, year, {
          force: args.force,
        })

        if (records.length === 0) {
          logger.warn('一分一段表无数据', { province: reg.meta.name, year })
          continue
        }

        // 按科类分组
        const categories: Record<string, RankTableRecord[]> = {}
        for (const record of records) {
          if (!categories[record.category]) {
            categories[record.category] = []
          }
          categories[record.category].push(record)
        }

        // 校验
        const validatedCategories: Record<string, RankTableRecord[]> = {}
        for (const [category, catRecords] of Object.entries(categories)) {
          catRecords.sort((a, b) => b.score - a.score)
          const deduped = dedupByScore(catRecords)
          for (let i = 0; i < deduped.length; i++) {
            deduped[i].rank = i === 0 ? 1 : deduped[i - 1].cumulativeCount + 1
          }

          const validated = deduped.filter((r) => validateRankRecord(r).valid)
          const monotonicity = validateRankTableMonotonicity(validated)
          if (!monotonicity.valid) {
            logger.warn('一分一段表单调性校验失败', {
              province: reg.meta.name, year, category, reason: monotonicity.reason,
            })
          }
          validatedCategories[category] = validated
        }

        // 写入文件
        const totalCount = Object.values(validatedCategories).reduce((sum, arr) => sum + arr.length, 0)
        if (totalCount > 0) {
          await writeRankTableFile(reg.meta.name, year, validatedCategories, reg.meta.pinyinId)
          results.push({ province: reg.meta.name, year, count: totalCount })
          logger.info('一分一段表完成', { province: reg.meta.name, year, count: totalCount })
        }

        if (failed.length > 0) {
          logger.warn('一分一段表部分失败', { province: reg.meta.name, year, failed: failed.length })
        }
      } catch (error) {
        logger.error('一分一段表采集失败', {
          province: reg.meta.name, year, error: (error as Error).message,
        })
        errors.push({ province: reg.meta.name, year, error: (error as Error).message })
      }
    }
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[一分一段表采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    ...results.map((r) => `${r.province} ${r.year}: ${r.count} 条`),
    '------------------------------------------------------',
    `总计产出:   ${results.reduce((sum, r) => sum + r.count, 0)} 条`,
    `失败:       ${errors.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)
  fs.writeFileSync(path.join(LOGS_DIR, `scrape-rank-tables-${Date.now()}.log`), report, 'utf-8')
}

function dedupByScore(records: RankTableRecord[]): RankTableRecord[] {
  const seen = new Set<number>()
  const result: RankTableRecord[] = []
  for (const r of records) {
    if (!seen.has(r.score)) {
      seen.add(r.score)
      result.push(r)
    }
  }
  return result
}

async function writeRankTableFile(
  province: string,
  year: number,
  categories: Record<string, RankTableRecord[]>,
  source: string
): Promise<void> {
  const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
  fs.mkdirSync(provinceDir, { recursive: true })

  const totalCount = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0)
  const file: RankTableFile = {
    province,
    year,
    categories,
    _meta: {
      generatedAt: new Date().toISOString(),
      scraperVersion: SCRAPER_VERSION,
      source,
      sourceUrl: '',
      recordCount: totalCount,
    },
  }

  const outputPath = path.join(provinceDir, `rank_table_${year}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(file, null, 2), 'utf-8')
  logger.info('一分一段表文件已写入', { province, year, count: totalCount, path: outputPath })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

main().catch((error) => {
  logger.error('一分一段表采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
```

- [ ] **Step 2: 运行现有测试**

Run: `npx vitest run scripts/scrapers/rank_tables/`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/rank_tables/index.ts
git commit -m "refactor: rank_tables/index.ts to iterate province registry"
```

---

### Task 15: 运行全部测试验证批次 0 无回归

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest run`
Expected: 所有现有测试通过

- [ ] **Step 2: 验证浙江/江苏数据可重新采集**

Run: `npx tsx scripts/scrapers/scores/index.ts --province=浙江 2>&1 | head -20`
Expected: 能正常启动并尝试采集（使用缓存数据）

- [ ] **Step 3: 提交批次 0 完成标记**

```bash
git add -A
git commit -m "chore: batch 0 refactor complete - registry pattern established"
```

---

## 批次 1：山东（Excel 格式，最简单）

### Task 16: 创建山东投档线适配器

**Files:**
- Create: `scripts/scrapers/scores/shandong.ts`
- Create: `scripts/scrapers/scores/adapters/shandong.ts`

- [ ] **Step 1: 创建山东投档线解析函数**

创建 `scripts/scrapers/scores/shandong.ts`:

```typescript
import * as xlsx from 'xlsx'
import type { ScoreRecord, ScoreRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析山东投档线 Excel（专业级，综合科类，普通类常规批第1次）
 */
export function parseSdToudang(
  buffer: Buffer,
  year: number,
  sourceUrl: string
): ScoreRecord[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  const records: ScoreRecord[] = []
  const meta: ScoreRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row.some((cell) => String(cell).includes('院校代码') || String(cell).includes('院校名称'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return records

  const headers = rows[headerRowIndex].map((h) => String(h).trim())
  const colMap = {
    collegeName: headers.findIndex((h) => h.includes('院校名称')),
    majorCode: headers.findIndex((h) => h.includes('专业代码')),
    majorName: headers.findIndex((h) => h.includes('专业名称')),
    planCount: headers.findIndex((h) => h.includes('计划数')),
    minScore: headers.findIndex((h) => h.includes('投档最低分') || h.includes('最低分')),
    minRank: headers.findIndex((h) => h.includes('位次') || h.includes('投档最低位次')),
  }

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const collegeName = String(row[colMap.collegeName] ?? '').trim()
    if (!collegeName || collegeName === '院校名称') continue

    const minScore = Number(row[colMap.minScore])
    if (!minScore || isNaN(minScore)) continue

    records.push({
      collegeId: '',
      collegeName,
      year,
      majorName: String(row[colMap.majorName] ?? '').trim(),
      majorCode: colMap.majorCode >= 0 ? String(row[colMap.majorCode] ?? '').trim() : undefined,
      province: '山东',
      category: '综合',
      batch: '普通类常规批第1次',
      minScore,
      minRank: Number(row[colMap.minRank]) || 0,
      planCount: colMap.planCount >= 0 ? Number(row[colMap.planCount]) || undefined : undefined,
      _meta: { ...meta },
    })
  }

  return records
}
```

- [ ] **Step 2: 创建适配器文件**

创建 `scripts/scrapers/scores/adapters/shandong.ts`:

```typescript
import type { ScoreScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { ScoreRecord, FailedRecord } from '../../types'
import { parseSdToudang } from '../shandong'

const SD_TOUDANG_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2023: {
    pageUrl: 'https://www.sdzs.gov.cn/',
    xlsUrl: 'https://www.sdzs.gov.cn/sdtgqzpt/a3/sdjzqk2023.xls',
  },
  2024: {
    pageUrl: 'https://www.sdzs.gov.cn/',
    xlsUrl: 'https://www.sdzs.gov.cn/sdtgqzpt/a3/sdjzqk2024.xls',
  },
  2025: {
    pageUrl: 'https://www.sdzs.gov.cn/',
    xlsUrl: 'https://www.sdzs.gov.cn/sdtgqzpt/a3/sdjzqk2025.xls',
  },
}

export const shandongScoreScraper: ScoreScraper = {
  province: '山东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: ScoreRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SD_TOUDANG_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `sd_toudang_${year}.xls`,
        forceRefresh: options?.force,
      })

      const parsed = parseSdToudang(result.buffer, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `山东 ${year}`,
      })
    }

    return { records, failed }
  },
}
```

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/shandong.ts scripts/scrapers/scores/adapters/shandong.ts
git commit -m "feat: add shandong score scraper (Excel format)"
```

---

### Task 17: 创建山东选科要求和一分一段表适配器

**Files:**
- Create: `scripts/scrapers/subjects/shandong.ts`
- Create: `scripts/scrapers/subjects/adapters/shandong.ts`
- Create: `scripts/scrapers/rank_tables/shandong.ts`
- Create: `scripts/scrapers/rank_tables/adapters/shandong.ts`

- [ ] **Step 1: 创建山东选科要求解析和适配器**

创建 `scripts/scrapers/subjects/shandong.ts`:

```typescript
import * as cheerio from 'cheerio'
import type { SubjectRequirementRecord, SubjectMeta } from '../types'
import { SCRAPER_VERSION } from '../config'
import { parseRequirement } from './parse_requirement'

export function parseSdSubjects(
  html: string,
  collegeId: string,
  collegeName: string,
  sourceUrl: string
): SubjectRequirementRecord[] {
  const $ = cheerio.load(html)
  const records: SubjectRequirementRecord[] = []
  const meta: SubjectMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get()
    if (cells.length < 4) return
    if (cells[0].includes('专业代码') || cells[0].includes('专业名称')) return

    const majorName = cells[1] || cells[0]
    const subjectText = cells.find((c) => c.includes('选考') || c.includes('科目')) || ''
    if (!majorName) return

    const { type, subjects } = parseRequirement(subjectText)

    records.push({
      collegeId,
      collegeName,
      province: '山东',
      year: 2024,
      level: '本科',
      majorName,
      subjectRequirement: subjectText,
      requirementType: type,
      requiredSubjects: subjects,
      _meta: { ...meta },
    })
  })

  return records
}
```

创建 `scripts/scrapers/subjects/adapters/shandong.ts`:

```typescript
import path from 'node:path'
import type { SubjectScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { SubjectRequirementRecord, CollegeRecord, FailedRecord } from '../../types'
import { loadColleges } from '../../shared/colleges_loader'
import { parseSdSubjects } from '../shandong'
import { GAOKAO_QPS, OUTPUT_DIR } from '../../config'

const SD_SUBJECTS_URL_TEMPLATE = 'https://www.sdzs.gov.cn/xkqz/{guobiaoCode}.html'

export const shandongSubjectScraper: SubjectScraper = {
  province: '山东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: SubjectRequirementRecord[] = []
    const failed: FailedRecord[] = []

    const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
    const collegesMap = loadColleges(collegesPath)
    const colleges: CollegeRecord[] = Array.from(collegesMap.values())

    const requestInterval = 1000 / GAOKAO_QPS

    for (let i = 0; i < colleges.length; i++) {
      const college = colleges[i]
      const guobiaoCode = college.moeCode.slice(-5)
      const url = SD_SUBJECTS_URL_TEMPLATE.replace('{guobiaoCode}', guobiaoCode)

      try {
        const result = await client.fetch(url, {
          cacheKey: `sd_${guobiaoCode}.html`,
          forceRefresh: options?.force,
        })

        const parsed = parseSdSubjects(result.html, college.id, college.name, url)
        records.push(...parsed)

        if (!result.fromCache) {
          await new Promise((resolve) => setTimeout(resolve, requestInterval))
        }
      } catch (error) {
        failed.push({
          url,
          error: (error as Error).message,
          retryCount: 0,
          context: `山东 ${college.name}`,
        })
      }
    }

    return { records, failed }
  },
}
```

- [ ] **Step 2: 创建山东一分一段表解析和适配器**

创建 `scripts/scrapers/rank_tables/shandong.ts`:

```typescript
import * as xlsx from 'xlsx'
import type { RankTableRecord, RankTableRecordMeta } from '../types'
import { SCRAPER_VERSION } from '../config'

/**
 * 解析山东一分一段表 Excel（综合科类）
 */
export function parseSdTable(
  buffer: Buffer,
  year: number,
  sourceUrl: string
): RankTableRecord[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  const records: RankTableRecord[] = []
  const meta: RankTableRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some((cell) => String(cell).includes('分数') || String(cell).includes('分值'))) {
      headerRowIndex = i
      break
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    const score = Number(row[0])
    const count = Number(row[1])
    const cumulativeCount = Number(row[2])

    if (!score || isNaN(score)) continue

    records.push({
      province: '山东',
      year,
      category: '综合',
      score,
      rank: cumulativeCount,
      count: count || 0,
      cumulativeCount: cumulativeCount || 0,
      _meta: { ...meta },
    })
  }

  return records
}
```

创建 `scripts/scrapers/rank_tables/adapters/shandong.ts`:

```typescript
import type { RankTableScraper } from '../../shared/province_registry'
import type { HttpClient } from '../../shared/http'
import type { RankTableRecord, FailedRecord } from '../../types'
import { parseSdTable } from '../shandong'

const SD_RANK_TABLE_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2023: { pageUrl: 'https://www.sdzs.gov.cn/', xlsUrl: 'https://www.sdzs.gov.cn/yfydb2023.xls' },
  2024: { pageUrl: 'https://www.sdzs.gov.cn/', xlsUrl: 'https://www.sdzs.gov.cn/yfydb2024.xls' },
  2025: { pageUrl: 'https://www.sdzs.gov.cn/', xlsUrl: 'https://www.sdzs.gov.cn/yfydb2025.xls' },
}

export const shandongRankTableScraper: RankTableScraper = {
  province: '山东',

  async scrape(client: HttpClient, year: number, options?: { force?: boolean }) {
    const records: RankTableRecord[] = []
    const failed: FailedRecord[] = []

    const urlConfig = SD_RANK_TABLE_URLS[year]
    if (!urlConfig) return { records, failed }

    try {
      const result = await client.fetchBinary(urlConfig.xlsUrl, {
        cacheKey: `sd_rank_${year}.xls`,
        forceRefresh: options?.force,
      })

      const parsed = parseSdTable(result.buffer, year, urlConfig.pageUrl)
      records.push(...parsed)
    } catch (error) {
      failed.push({
        url: urlConfig.xlsUrl,
        error: (error as Error).message,
        retryCount: 3,
        context: `山东一分一段表 ${year}`,
      })
    }

    return { records, failed }
  },
}
```

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/subjects/shandong.ts scripts/scrapers/subjects/adapters/shandong.ts scripts/scrapers/rank_tables/shandong.ts scripts/scrapers/rank_tables/adapters/shandong.ts
git commit -m "feat: add shandong subject and rank table scrapers"
```

---

### Task 18: 注册山东到 registry_init.ts

**Files:**
- Modify: `scripts/scrapers/shared/registry_init.ts`

- [ ] **Step 1: 添加山东导入和注册**

在导入区添加:

```typescript
import { shandongScoreScraper } from '../scores/adapters/shandong'
import { shandongSubjectScraper } from '../subjects/adapters/shandong'
import { shandongRankTableScraper } from '../rank_tables/adapters/shandong'
```

在 `ensureRegistryInitialized` 函数中（江苏注册之后）添加:

```typescript
  // 山东（3+3，专业+院校，综合）
  registerProvince({
    meta: {
      name: '山东',
      pinyinId: 'shandong',
      examMode: '3+3',
      volunteerMode: 'major+college',
      categories: ['综合'],
      batchSize: '普通类常规批第1次',
    },
    scoreScraper: shandongScoreScraper,
    subjectScraper: shandongSubjectScraper,
    rankTableScraper: shandongRankTableScraper,
  })
```

- [ ] **Step 2: 运行测试确认无回归**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/shared/registry_init.ts
git commit -m "feat: register shandong province adapters"
```

---

## 批次 2-4：河北、湖南、湖北、广东、北京、上海、辽宁

> **实现说明：** 这 7 个省份的适配器结构与山东完全一致，仅以下差异点不同：
> 1. 解析函数文件中的 `province` 字段值
> 2. 适配器文件中的 URL 常量
> 3. 注册时的 `ProvinceMeta`（examMode、volunteerMode、categories、batchSize）
> 4. 解析格式（Excel/PDF/HTML/OCR）
>
> 每个省创建 6 个文件（3 个解析函数 + 3 个适配器），然后注册到 `registry_init.ts`。

### Task 19: 创建河北适配器（3+1+2，专业+院校，Excel + OCR）

**Files:**
- Create: `scripts/scrapers/scores/hebei.ts` + `scripts/scrapers/scores/adapters/hebei.ts`
- Create: `scripts/scrapers/subjects/hebei.ts` + `scripts/scrapers/subjects/adapters/hebei.ts`
- Create: `scripts/scrapers/rank_tables/hebei.ts` + `scripts/scrapers/rank_tables/adapters/hebei.ts`

- [ ] **Step 1: 创建河北投档线解析和适配器**

创建 `scripts/scrapers/scores/hebei.ts`（参考 Task 16 的 `shandong.ts`，修改为）:
- `province: '河北'`
- `category` 参数化（物理类/历史类）
- 增加 `majorGroup`、`majorGroupName` 字段
- `batch: '本科批'`
- 函数签名: `parseHbToudang(buffer, year, category: '物理类' | '历史类', sourceUrl)`

创建 `scripts/scrapers/scores/adapters/hebei.ts`（参考 Task 16 的适配器，修改为）:
- 遍历 `['物理类', '历史类']` 两个科类
- URL 配置: `HB_TOUDANG_URLS`，每科类一个 Excel URL
- `cacheKey: hb_toudang_${year}_${category}.xls`

- [ ] **Step 2: 创建河北选科要求适配器**

创建 `scripts/scrapers/subjects/hebei.ts`（参考 Task 17 的 `shandong.ts`，修改 `province: '河北'`）
创建 `scripts/scrapers/subjects/adapters/hebei.ts`（参考 Task 17 的适配器，URL 模板改为 `https://www.hebeea.edu.cn/xkqz/{guobiaoCode}.html`）

- [ ] **Step 3: 创建河北一分一段表适配器（OCR 格式）**

创建 `scripts/scrapers/rank_tables/hebei.ts`:
- 函数签名: `parseHbTable(text: string, year, category, sourceUrl)` — OCR 文本解析
- 使用正则 `/^(\d+)\s+(\d+)\s+(\d+)/` 匹配 "分数 人数 累计"
- `province: '河北'`

创建 `scripts/scrapers/rank_tables/adapters/hebei.ts`:
- 使用 `ocrImage` 而非 `parsePdf`
- URL 配置: `HB_RANK_TABLE_URLS`，每科类一组图片 URL
- 参考 Task 7 的江苏一分一段表适配器结构

- [ ] **Step 4: 注册河北到 registry_init.ts**

```typescript
import { hebeiScoreScraper } from '../scores/adapters/hebei'
import { hebeiSubjectScraper } from '../subjects/adapters/hebei'
import { hebeiRankTableScraper } from '../rank_tables/adapters/hebei'

// 在 ensureRegistryInitialized 中添加:
registerProvince({
  meta: {
    name: '河北',
    pinyinId: 'hebei',
    examMode: '3+1+2',
    volunteerMode: 'major+college',
    categories: ['物理类', '历史类'],
    batchSize: '本科批',
  },
  scoreScraper: hebeiScoreScraper,
  subjectScraper: hebeiSubjectScraper,
  rankTableScraper: hebeiRankTableScraper,
})
```

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/hebei.ts scripts/scrapers/scores/adapters/hebei.ts scripts/scrapers/subjects/hebei.ts scripts/scrapers/subjects/adapters/hebei.ts scripts/scrapers/rank_tables/hebei.ts scripts/scrapers/rank_tables/adapters/hebei.ts scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add hebei province adapters (Excel scores + OCR rank tables)"
```

---

### Task 20: 创建湖南适配器（3+1+2，院校专业组，Excel + HTML）

**Files:**
- Create: `scripts/scrapers/scores/hunan.ts` + `scripts/scrapers/scores/adapters/hunan.ts`
- Create: `scripts/scrapers/subjects/hunan.ts` + `scripts/scrapers/subjects/adapters/hunan.ts`
- Create: `scripts/scrapers/rank_tables/hunan.ts` + `scripts/scrapers/rank_tables/adapters/hunan.ts`

- [ ] **Step 1: 创建湖南投档线（Excel，参考河北，修改 province: '湖南'）**

- [ ] **Step 2: 创建湖南选科要求（HTML，参考山东，修改 province: '湖南'，URL: https://www.hneeb.cn/xkqz/{guobiaoCode}.html）**

- [ ] **Step 3: 创建湖南一分一段表（HTML 解析，使用 cheerio）**

创建 `scripts/scrapers/rank_tables/hunan.ts`:
- 函数签名: `parseHnTable(html: string, year, category, sourceUrl)` — HTML 解析
- 使用 cheerio 解析 `table tr td`，提取分数/人数/累计
- `province: '湖南'`

创建 `scripts/scrapers/rank_tables/adapters/hunan.ts`:
- 使用 `client.fetch()` 获取 HTML（非 fetchBinary）
- URL 配置: `HN_RANK_TABLE_URLS`，每科类一个 HTML URL

- [ ] **Step 4: 注册湖南（参考河北，meta 修改为）**

```typescript
registerProvince({
  meta: {
    name: '湖南',
    pinyinId: 'hunan',
    examMode: '3+1+2',
    volunteerMode: 'college-group',
    categories: ['物理类', '历史类'],
    batchSize: '本科批',
  },
  scoreScraper: hunanScoreScraper,
  subjectScraper: hunanSubjectScraper,
  rankTableScraper: hunanRankTableScraper,
})
```

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/hunan.ts scripts/scrapers/scores/adapters/hunan.ts scripts/scrapers/subjects/hunan.ts scripts/scrapers/subjects/adapters/hunan.ts scripts/scrapers/rank_tables/hunan.ts scripts/scrapers/rank_tables/adapters/hunan.ts scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add hunan province adapters (Excel scores + HTML rank tables)"
```

---

### Task 21: 创建湖北适配器（3+1+2，院校专业组，PDF + HTML）

**Files:**
- Create: `scripts/scrapers/scores/hubei.ts` + `scripts/scrapers/scores/adapters/hubei.ts`
- Create: `scripts/scrapers/subjects/hubei.ts` + `scripts/scrapers/subjects/adapters/hubei.ts`
- Create: `scripts/scrapers/rank_tables/hubei.ts` + `scripts/scrapers/rank_tables/adapters/hubei.ts`

- [ ] **Step 1: 创建湖北投档线（PDF 解析）**

创建 `scripts/scrapers/scores/hubei.ts`:
- 函数签名: `parseHbToudangPdf(text: string, year, category, sourceUrl)` — PDF 文本解析
- 按行分割，用 `split(/\s+/)` 提取字段
- `province: '湖北'`

创建 `scripts/scrapers/scores/adapters/hubei.ts`:
- 使用 `parsePdf` 解析 PDF
- URL 配置: `HB_TOUDANG_URLS`，每科类一个 PDF URL

- [ ] **Step 2: 创建湖北选科要求（HTML，参考山东，URL: https://www.hbea.edu.cn/xkqz/{guobiaoCode}.html）**

- [ ] **Step 3: 创建湖北一分一段表（HTML 解析，参考湖南）**

- [ ] **Step 4: 注册湖北（meta: examMode '3+1+2', volunteerMode 'college-group'）**

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/hubei.ts scripts/scrapers/scores/adapters/hubei.ts scripts/scrapers/subjects/hubei.ts scripts/scrapers/subjects/adapters/hubei.ts scripts/scrapers/rank_tables/hubei.ts scripts/scrapers/rank_tables/adapters/hubei.ts scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add hubei province adapters (PDF scores + HTML rank tables)"
```

---

### Task 22: 创建广东适配器（3+1+2，院校专业组，PDF + PDF/OCR）

**Files:**
- Create: `scripts/scrapers/scores/guangdong.ts` + `scripts/scrapers/scores/adapters/guangdong.ts`
- Create: `scripts/scrapers/subjects/guangdong.ts` + `scripts/scrapers/subjects/adapters/guangdong.ts`
- Create: `scripts/scrapers/rank_tables/guangdong.ts` + `scripts/scrapers/rank_tables/adapters/guangdong.ts`

- [ ] **Step 1: 创建广东投档线（PDF，参考湖北，province: '广东'）**

- [ ] **Step 2: 创建广东选科要求（HTML，URL: https://eea.gd.gov.cn/xkqz/{guobiaoCode}.html）**

- [ ] **Step 3: 创建广东一分一段表（PDF 解析，参考浙江的 PDF 解析但分物理类/历史类）**

创建 `scripts/scrapers/rank_tables/guangdong.ts`:
- 函数签名: `parseGdTable(text: string, year, category, sourceUrl)` — PDF 文本解析
- 使用正则匹配 "分数 人数 累计"
- `province: '广东'`

创建 `scripts/scrapers/rank_tables/adapters/guangdong.ts`:
- 使用 `parsePdf` 解析 PDF
- URL 配置: `GD_RANK_TABLE_URLS`，每科类一个 PDF URL

- [ ] **Step 4: 注册广东（meta: examMode '3+1+2', volunteerMode 'college-group'）**

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/guangdong.ts scripts/scrapers/scores/adapters/guangdong.ts scripts/scrapers/subjects/guangdong.ts scripts/scrapers/subjects/adapters/guangdong.ts scripts/scrapers/rank_tables/guangdong.ts scripts/scrapers/rank_tables/adapters/guangdong.ts scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add guangdong province adapters (PDF format)"
```

---

### Task 23: 创建北京适配器（3+3，院校专业组，HTML + HTML/OCR）

**Files:**
- Create: `scripts/scrapers/scores/beijing.ts` + `scripts/scrapers/scores/adapters/beijing.ts`
- Create: `scripts/scrapers/subjects/beijing.ts` + `scripts/scrapers/subjects/adapters/beijing.ts`
- Create: `scripts/scrapers/rank_tables/beijing.ts` + `scripts/scrapers/rank_tables/adapters/beijing.ts`

- [ ] **Step 1: 创建北京投档线（HTML 解析，综合科类）**

创建 `scripts/scrapers/scores/beijing.ts`:
- 函数签名: `parseBjToudang(html: string, year, sourceUrl)` — HTML 解析
- 使用 cheerio 解析表格
- `province: '北京'`，`category: '综合'`，`batch: '本科批'`

创建 `scripts/scrapers/scores/adapters/beijing.ts`:
- 使用 `client.fetch()` 获取 HTML
- URL 配置: `BJ_TOUDANG_URLS`，每年一个 HTML URL

- [ ] **Step 2: 创建北京选科要求（HTML，URL: https://www.bjeea.cn/xkqz/{guobiaoCode}.html）**

- [ ] **Step 3: 创建北京一分一段表（HTML 解析，综合科类）**

- [ ] **Step 4: 注册北京**

```typescript
registerProvince({
  meta: {
    name: '北京',
    pinyinId: 'beijing',
    examMode: '3+3',
    volunteerMode: 'college-group',
    categories: ['综合'],
    batchSize: '本科批',
  },
  scoreScraper: beijingScoreScraper,
  subjectScraper: beijingSubjectScraper,
  rankTableScraper: beijingRankTableScraper,
})
```

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/beijing.ts scripts/scrapers/scores/adapters/beijing.ts scripts/scrapers/subjects/beijing.ts scripts/scrapers/subjects/adapters/beijing.ts scripts/scrapers/rank_tables/beijing.ts scripts/scrapers/rank_tables/adapters/beijing.ts scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add beijing province adapters (HTML format)"
```

---

### Task 24: 创建上海适配器（3+3，院校专业组，HTML + HTML）

**Files:**
- Create: `scripts/scrapers/scores/shanghai.ts` + `scripts/scrapers/scores/adapters/shanghai.ts`
- Create: `scripts/scrapers/subjects/shanghai.ts` + `scripts/scrapers/subjects/adapters/shanghai.ts`
- Create: `scripts/scrapers/rank_tables/shanghai.ts` + `scripts/scrapers/rank_tables/adapters/shanghai.ts`

- [ ] **Step 1: 创建上海投档线（HTML，参考北京，province: '上海'，URL: https://www.shmeea.edu.cn/）**

- [ ] **Step 2: 创建上海选科要求（HTML，URL: https://www.shmeea.edu.cn/xkqz/{guobiaoCode}.html）**

- [ ] **Step 3: 创建上海一分一段表（HTML，综合科类）**

- [ ] **Step 4: 注册上海**

```typescript
registerProvince({
  meta: {
    name: '上海',
    pinyinId: 'shanghai',
    examMode: '3+3',
    volunteerMode: 'college-group',
    categories: ['综合'],
    batchSize: '本科批',
  },
  scoreScraper: shanghaiScoreScraper,
  subjectScraper: shanghaiSubjectScraper,
  rankTableScraper: shanghaiRankTableScraper,
})
```

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/shanghai.ts scripts/scrapers/scores/adapters/shanghai.ts scripts/scrapers/subjects/shanghai.ts scripts/scrapers/subjects/adapters/shanghai.ts scripts/scrapers/rank_tables/shanghai.ts scripts/scrapers/rank_tables/adapters/shanghai.ts scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add shanghai province adapters (HTML format)"
```

---

### Task 25: 创建辽宁适配器（3+1+2，专业+院校，HTML/OCR + HTML/OCR）

**Files:**
- Create: `scripts/scrapers/scores/liaoning.ts` + `scripts/scrapers/scores/adapters/liaoning.ts`
- Create: `scripts/scrapers/subjects/liaoning.ts` + `scripts/scrapers/subjects/adapters/liaoning.ts`
- Create: `scripts/scrapers/rank_tables/liaoning.ts` + `scripts/scrapers/rank_tables/adapters/liaoning.ts`

- [ ] **Step 1: 创建辽宁投档线（HTML/OCR，物理类+历史类）**

创建 `scripts/scrapers/scores/liaoning.ts`:
- 函数签名: `parseLnToudang(html: string, year, category, sourceUrl)` — HTML 解析
- `province: '辽宁'`，`batch: '本科批'`
- 无 `majorGroup`（专业+院校模式）

创建 `scripts/scrapers/scores/adapters/liaoning.ts`:
- URL 配置: `LN_TOUDANG_URLS`，每科类一个 HTML URL

- [ ] **Step 2: 创建辽宁选科要求（HTML，URL: https://www.lnzsks.com/xkqz/{guobiaoCode}.html）**

- [ ] **Step 3: 创建辽宁一分一段表（HTML/OCR，物理类+历史类）**

- [ ] **Step 4: 注册辽宁**

```typescript
registerProvince({
  meta: {
    name: '辽宁',
    pinyinId: 'liaoning',
    examMode: '3+1+2',
    volunteerMode: 'major+college',
    categories: ['物理类', '历史类'],
    batchSize: '本科批',
  },
  scoreScraper: liaoningScoreScraper,
  subjectScraper: liaoningSubjectScraper,
  rankTableScraper: liaoningRankTableScraper,
})
```

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/liaoning.ts scripts/scrapers/scores/adapters/liaoning.ts scripts/scrapers/subjects/liaoning.ts scripts/scrapers/subjects/adapters/liaoning.ts scripts/scrapers/rank_tables/liaoning.ts scripts/scrapers/rank_tables/adapters/liaoning.ts scripts/scrapers/shared/registry_init.ts
git commit -m "feat: add liaoning province adapters (HTML/OCR format)"
```

---

### Task 26: 运行全部测试验证批次 1-4

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest run`
Expected: 所有现有测试通过

- [ ] **Step 2: 验证注册表包含 10 省**

Run: `npx tsx -e "import { ensureRegistryInitialized, getAllProvinces } from './scripts/scrapers/shared/registry_init'; ensureRegistryInitialized(); console.log(getAllProvinces().map(p => p.meta.name));"`
Expected: 输出包含 10 个省份名称

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore: batch 1-4 complete - 8 new provinces added"
```

---

## 批次 5：前端适配

### Task 27: 更新 dataLoader.ts 扩展 KNOWN_REAL_PROVINCES

**Files:**
- Modify: `src/services/dataLoader.ts:279`

- [ ] **Step 1: 修改 KNOWN_REAL_PROVINCES**

将 `src/services/dataLoader.ts` 第 279 行:

```typescript
const KNOWN_REAL_PROVINCES = new Set(['zhejiang', 'jiangsu'])
```

改为:

```typescript
const KNOWN_REAL_PROVINCES = new Set([
  'zhejiang', 'jiangsu', 'shandong', 'hebei', 'liaoning',
  'hubei', 'hunan', 'guangdong', 'beijing', 'shanghai'
])
```

- [ ] **Step 2: 运行前端测试**

Run: `npx vitest run src/`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/services/dataLoader.ts
git commit -m "feat: expand KNOWN_REAL_PROVINCES to 10 provinces"
```

---

### Task 28: 更新 DataCenter.tsx 从 mock.ts 派生省份选项

**Files:**
- Modify: `src/pages/DataCenter.tsx`

- [ ] **Step 1: 读取当前 DataCenter.tsx 找到 PROVINCE_OPTIONS 定义**

Run: `grep -n "PROVINCE_OPTIONS" src/pages/DataCenter.tsx`

- [ ] **Step 2: 修改 PROVINCE_OPTIONS 为从 mock.ts 派生**

在文件顶部添加导入:

```typescript
import { provinces } from '@/data/mock'
```

将硬编码的 `PROVINCE_OPTIONS`:

```typescript
const PROVINCE_OPTIONS = [
  { value: 'zhejiang', label: '浙江' },
  { value: 'jiangsu', label: '江苏' },
]
```

改为:

```typescript
const PROVINCE_OPTIONS = provinces.map(p => ({ value: p.id, label: p.name }))
```

- [ ] **Step 3: 运行前端测试**

Run: `npx vitest run src/`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/pages/DataCenter.tsx
git commit -m "feat: derive PROVINCE_OPTIONS from mock.ts"
```

---

### Task 29: 更新 riskDetector.ts 从 mock.ts 判断志愿模式

**Files:**
- Modify: `src/services/riskDetector.ts`

- [ ] **Step 1: 读取当前 riskDetector.ts 找到硬编码省份列表**

Run: `grep -n "院校专业组\|college-group\|major+college" src/services/riskDetector.ts`

- [ ] **Step 2: 修改为从 mock.ts 的 mode 字段判断**

在文件顶部添加导入:

```typescript
import { provinces } from '@/data/mock'
```

将硬编码的省份列表判断:

```typescript
// 旧代码示例
if (['江苏', '湖北', '湖南', '广东', '北京', '上海'].includes(profile.province)) {
  // 院校专业组模式检查
}
```

改为:

```typescript
const provinceConfig = provinces.find(p => p.id === profile.provinceId)
if (provinceConfig?.mode === 'college-group') {
  // 院校专业组模式检查服从调剂
}
```

- [ ] **Step 3: 运行前端测试**

Run: `npx vitest run src/`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/services/riskDetector.ts
git commit -m "feat: use mock.ts mode field for volunteer mode detection"
```

---

### Task 30: 最终验证与重启服务

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest run`
Expected: 所有测试通过

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 重启开发服务**

Run: `npm run dev`
Expected: 服务正常启动

- [ ] **Step 4: 提交最终完成标记**

```bash
git add -A
git commit -m "chore: multi-province expansion complete - 10 provinces supported"
```

---

## 自审清单

### Spec 覆盖检查

- [x] §2.1 适配器接口设计 → Task 1 (province_registry.ts)
- [x] §2.2 注册表 API → Task 1
- [x] §2.3 重构后的 index.ts 编排模式 → Task 12, 13, 14
- [x] §2.4 现有浙江/江苏代码的包装方式 → Task 2-7
- [x] §2.5 配置重构 → Task 9
- [x] §2.6 文件结构 → 所有 Task
- [x] §3.1 省份分组 → Task 16-25
- [x] §3.2 投档线适配策略 → Task 16, 19, 20, 21, 22, 23, 24, 25
- [x] §3.3 一分一段表适配策略 → 同上
- [x] §3.4 选科要求适配策略 → 同上
- [x] §3.5 数据格式归一化 → 各解析函数中实现
- [x] §4.1 前端适配点 → Task 27, 28, 29
- [x] §4.2 dataLoader.ts 适配 → Task 27
- [x] §4.3 DataCenter.tsx 适配 → Task 28
- [x] §4.4 riskDetector.ts 适配 → Task 29
- [x] §4.5 校验逻辑更新 → Task 10, 11
- [x] §5.1 分批执行计划 → 批次 0-5
- [x] §5.2 测试策略 → 各 Task 中的测试步骤

### 类型一致性检查

- `ScoreScraper.scrape()` 返回 `{ records: ScoreRecord[]; failed: FailedRecord[] }` — 所有适配器一致
- `SubjectScraper.scrape()` 返回 `{ records: SubjectRequirementRecord[]; failed: FailedRecord[] }` — 所有适配器一致
- `RankTableScraper.scrape()` 返回 `{ records: RankTableRecord[]; failed: FailedRecord[] }` — 所有适配器一致
- `ProvinceMeta` 字段: name, pinyinId, examMode, volunteerMode, categories, batchSize — 所有注册一致
- `registerProvince(registry: ProvinceRegistry)` — 所有注册调用一致
