# 详细专业目录采集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过阳光高考 API 树形遍历采集全量 1631 个专业（本科 883 + 专科 748）的详细目录数据，含专业介绍、就业方向、统计信息等。

**Architecture:** 4 步 API 树形遍历（门类→专业类→专业列表→专业详情），输出到 `public/data/common/majors/detailed-catalog.json`。复用现有 HttpClient（含缓存+重试）和 GAOKAO_QPS 限速模式。

**Tech Stack:** Node.js + TypeScript + tsx + vitest + axios（通过 HttpClient）

---

## File Structure

```
scripts/scrapers/
├── types.ts                          # 修改：追加 DetailedMajorRecord 等输出类型
├── config.ts                         # 修改：追加 API URL 常量
└── majors/
    └── detail/                       # 新建目录
        ├── types.ts                  # 新建：API 响应类型（内部类型）
        ├── api.ts                    # 新建：4 个 API 端点封装
        ├── parse.ts                  # 新建：API 响应 → DetailedMajorRecord 转换 + 主干课程提取
        ├── validate.ts               # 新建：记录校验
        ├── crawler.ts                # 新建：树形遍历编排器
        ├── index.ts                  # 新建：主入口（CLI 参数、输出写入、进度日志、断点续采）
        ├── __tests__/
        │   ├── api.test.ts           # API mock 测试
        │   ├── parse.test.ts         # 解析转换测试
        │   ├── validate.test.ts      # 校验测试
        │   ├── crawler.test.ts       # 编排器测试
        │   └── mainCourses.test.ts   # 主干课程提取测试
        └── __fixtures__/
            ├── detail_philosophy.json    # 哲学专业详情 API 响应快照
            └── detail_vocational.json    # 专科专业详情 API 响应快照

public/data/common/majors/
└── detailed-catalog.json             # 输出：1631 条详细目录
```

---

### Task 1: 追加输出类型到 types.ts

**Files:**
- Modify: `scripts/scrapers/types.ts`（文件末尾追加）

- [ ] **Step 1: 追加 DetailedMajorRecord 及相关类型**

在 `scripts/scrapers/types.ts` 文件末尾追加：

```typescript
// ===== Phase D: 详细专业目录 =====

export interface DetailedMajorRecord {
  // 基础目录字段
  majorCode: string
  majorName: string
  category: string
  subCategory: string
  educationLevel: string

  // 详细字段
  introduction: string
  careerDirections: string[]
  mainCourses: string
  durationAndDegree: {
    studentScale: string
    boyPercent: number
    girlPercent: number
    year: string
  }

  // 扩展字段
  satisfaction: Array<{
    type: string
    typeDesc: string
    rank: number
    count: number
  }>
  graduateMajors: Array<{
    majorCode: string
    majorName: string
  }>
  recommendedColleges: Array<{
    collegeName: string
    count: number
    rank: number
  }>
  similarMajors: Array<{
    majorCode: string
    majorName: string
  }>

  // 可追溯性
  specId: string
  _meta: DetailedCatalogMeta
}

export interface DetailedCatalogMeta {
  source: 'gaokao_chsi'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

export interface DetailedCatalogFileMeta {
  totalCount: number
  undergraduateCount: number
  vocationalCount: number
  generatedAt: string
  scraperVersion: string
  sources: Array<{
    name: string
    url: string
    recordCount: number
  }>
}
```

- [ ] **Step 2: 验证类型编译通过**

Run: `npx tsc --noEmit scripts/scrapers/types.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add scripts/scrapers/types.ts
git commit -m "feat(scrapers): add DetailedMajorRecord types for Phase D"
```

---

### Task 2: 追加配置常量到 config.ts

**Files:**
- Modify: `scripts/scrapers/config.ts`（文件末尾追加）

- [ ] **Step 1: 追加 API URL 和 root key 常量**

在 `scripts/scrapers/config.ts` 文件末尾追加：

```typescript
// ===== Phase D: 详细专业目录 API =====

export const MAJOR_DETAIL_API_BASE = 'https://gaokao.chsi.com.cn/zyk/zybk'

export const UNDERGRADUATE_ROOT_KEY = '1050'
export const VOCATIONAL_ROOT_KEY = '1060'

export const MAJOR_DETAIL_OUTPUT_DIR = path.join(OUTPUT_DIR, 'majors')
export const MAJOR_DETAIL_OUTPUT_FILE = path.join(MAJOR_DETAIL_OUTPUT_DIR, 'detailed-catalog.json')
export const MAJOR_DETAIL_META_FILE = path.join(MAJOR_DETAIL_OUTPUT_DIR, 'detailed-catalog.meta.json')
export const MAJOR_DETAIL_PARTIAL_FILE = path.join(MAJOR_DETAIL_OUTPUT_DIR, 'detailed-catalog.partial.json')
export const MAJOR_DETAIL_FAILED_FILE = path.join(REPORTS_DIR, 'majors_detail_failed.json')
```

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit scripts/scrapers/config.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add scripts/scrapers/config.ts
git commit -m "feat(scrapers): add detailed major catalog API config constants"
```

---

### Task 3: 创建 detail/types.ts（API 响应类型）

**Files:**
- Create: `scripts/scrapers/majors/detail/types.ts`

- [ ] **Step 1: 创建 API 响应类型文件**

```typescript
// 阳光高考专业库 API 响应类型（内部使用）

/** 通用 API 响应包装 */
export interface ApiResponse<T> {
  msg: T
  flag: boolean
}

/** 门类/专业类列表项（mlCategory 和 xkCategory 共用） */
export interface CategoryItem {
  key: string
  name: string
}

/** 专业列表项（specialityesByCategory 返回） */
export interface MajorListItem {
  zydm: string
  zymc: string
  specId: string
  zymyd: string
  hasZyjs: boolean
}

/** 专业详情中的专业介绍 */
export interface MajorIntro {
  desc: string
  zymx: string | null
}

/** 专业详情中的就业方向项 */
export interface CareerDirectionItem {
  jyfx: string
  url4Xzpt: string
}

/** 专业详情中的就业方向信息 */
export interface CareerDirectionInfo {
  jyfxList: CareerDirectionItem[]
}

/** 专业详情中的满意度项 */
export interface SatisfactionItem {
  type: string
  typeDesc: string
  rank: number
  count: number
}

/** 专业详情中的考研方向项 */
export interface GraduateMajorItem {
  zydm: string
  zymc: string
}

/** 专业详情中的推荐院校项 */
export interface RecommendedCollegeItem {
  schId: string
  yxmc: string
  count: number
  rank: number
}

/** 专业详情中的相似专业项 */
export interface SimilarMajorItem {
  zydm: string
  zymc: string
  specId: string
}

/** 专业详情（specialityDetail 返回） */
export interface MajorDetailResponse {
  zydm: string
  zymc: string
  ml: string
  mlCode: string
  xk: string
  xkCode: string
  xlcc: string
  specId: string
  xsgm: string
  boyPercent: number
  girlPercent: number
  zyjs: MajorIntro | null
  jyfxInfo: CareerDirectionInfo | null
  zymyd: SatisfactionItem[]
  kyfx: GraduateMajorItem[]
  zytjzsList: RecommendedCollegeItem[]
  simileZyList: SimilarMajorItem[]
  year: string
}
```

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit scripts/scrapers/majors/detail/types.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add scripts/scrapers/majors/detail/types.ts
git commit -m "feat(scrapers): add API response types for detailed major catalog"
```

---

### Task 4: 创建 detail/api.ts（API 封装）+ 测试

**Files:**
- Create: `scripts/scrapers/majors/detail/api.ts`
- Test: `scripts/scrapers/majors/detail/__tests__/api.test.ts`

- [ ] **Step 1: 编写 api.test.ts 失败测试**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { HttpClient } from '../../shared/http.js'
import { fetchCategories, fetchSubcategories, fetchMajors, fetchMajorDetail } from '../api.js'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isAxiosError: (e: unknown) => e && typeof e === 'object' && 'isAxiosError' in e,
  },
}))
import axios from 'axios'

describe('detail/api', () => {
  let tmpDir: string
  let client: HttpClient

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detail-api-test-'))
    client = new HttpClient(tmpDir)
    vi.clearAllMocks()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('fetchCategories', () => {
    it('正常返回门类列表', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: [{ key: '105001', name: '哲学' }, { key: '105002', name: '经济学' }],
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchCategories(client, '1050')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ key: '105001', name: '哲学' })
    })

    it('flag 为 false 时抛错', async () => {
      const mockResponse = {
        data: JSON.stringify({ msg: null, flag: false }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      await expect(fetchCategories(client, '1050')).rejects.toThrow(/flag.*false/)
    })
  })

  describe('fetchSubcategories', () => {
    it('正常返回专业类列表', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: [{ key: '10500101', name: '哲学类' }],
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchSubcategories(client, '105001')
      expect(result).toEqual([{ key: '10500101', name: '哲学类' }])
    })
  })

  describe('fetchMajors', () => {
    it('正常返回专业列表', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: [
            { zydm: '010101', zymc: '哲学', specId: '73381059', zymyd: '4.2', hasZyjs: true },
          ],
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchMajors(client, '10500101')
      expect(result).toHaveLength(1)
      expect(result[0].specId).toBe('73381059')
    })
  })

  describe('fetchMajorDetail', () => {
    it('正常返回专业详情', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: {
            zydm: '010101',
            zymc: '哲学',
            ml: '哲学',
            mlCode: '01',
            xk: '哲学类',
            xkCode: '0101',
            xlcc: '本科（普通教育）',
            specId: '73381059',
            xsgm: '3000-3500',
            boyPercent: 38,
            girlPercent: 62,
            zyjs: { desc: '本专业学生主要学习...', zymx: null },
            jyfxInfo: { jyfxList: [{ jyfx: '考研', url4Xzpt: '' }] },
            zymyd: [{ type: '3', typeDesc: '综合满意度', rank: 4.2, count: 3479 }],
            kyfx: [{ zydm: '010100', zymc: '哲学' }],
            zytjzsList: [{ schId: '73395168', yxmc: '黑龙江大学', count: 828, rank: 4.6 }],
            simileZyList: [{ zydm: '010102', zymc: '逻辑学', specId: '73381063' }],
            year: '2025',
          },
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchMajorDetail(client, '73381059')
      expect(result.zymc).toBe('哲学')
      expect(result.zyjs?.desc).toBe('本专业学生主要学习...')
      expect(result.boyPercent).toBe(38)
    })

    it('zyjs 为 null 时不抛错', async () => {
      const mockResponse = {
        data: JSON.stringify({
          msg: {
            zydm: '410121', zymc: '高标准农田建设与应用技术', ml: '农林牧渔', mlCode: '41',
            xk: '农业类', xkCode: '4101', xlcc: '高职（专科）', specId: 'cbwwxpqalt4ryqj4',
            xsgm: '', boyPercent: 0, girlPercent: 0,
            zyjs: null, jyfxInfo: null,
            zymyd: [], kyfx: [], zytjzsList: [], simileZyList: [],
            year: '2025',
          },
          flag: true,
        }),
        status: 200,
      }
      ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const result = await fetchMajorDetail(client, 'cbwwxpqalt4ryqj4')
      expect(result.zyjs).toBeNull()
      expect(result.jyfxInfo).toBeNull()
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/api.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 api.ts 实现**

```typescript
import { HttpClient } from '../../shared/http.js'
import { MAJOR_DETAIL_API_BASE } from '../../config.js'
import type { ApiResponse, CategoryItem, MajorListItem, MajorDetailResponse } from './types.js'

function parseJsonResponse<T>(data: string): ApiResponse<T> {
  const parsed = JSON.parse(data)
  if (!parsed.flag) {
    throw new Error(`API returned flag=false`)
  }
  return parsed as ApiResponse<T>
}

export async function fetchCategories(
  client: HttpClient,
  rootKey: string,
): Promise<CategoryItem[]> {
  const url = `${MAJOR_DETAIL_API_BASE}/mlCategory/${rootKey}`
  const result = await client.fetch(url, {
    cacheKey: `mlCategory_${rootKey}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<CategoryItem[]>(result.html)
  return response.msg
}

export async function fetchSubcategories(
  client: HttpClient,
  categoryKey: string,
): Promise<CategoryItem[]> {
  const url = `${MAJOR_DETAIL_API_BASE}/xkCategory/${categoryKey}`
  const result = await client.fetch(url, {
    cacheKey: `xkCategory_${categoryKey}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<CategoryItem[]>(result.html)
  return response.msg
}

export async function fetchMajors(
  client: HttpClient,
  subcategoryKey: string,
): Promise<MajorListItem[]> {
  const url = `${MAJOR_DETAIL_API_BASE}/specialityesByCategory/${subcategoryKey}`
  const result = await client.fetch(url, {
    cacheKey: `specialityesByCategory_${subcategoryKey}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<MajorListItem[]>(result.html)
  return response.msg
}

export async function fetchMajorDetail(
  client: HttpClient,
  specId: string,
): Promise<MajorDetailResponse> {
  const url = `${MAJOR_DETAIL_API_BASE}/specialityDetail/${specId}`
  const result = await client.fetch(url, {
    cacheKey: `specialityDetail_${specId}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<MajorDetailResponse>(result.html)
  return response.msg
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/api.test.ts`
Expected: PASS — 全部 6 个测试通过

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/majors/detail/api.ts scripts/scrapers/majors/detail/__tests__/api.test.ts
git commit -m "feat(scrapers): add API client for detailed major catalog"
```

---

### Task 5: 创建 detail/parse.ts（响应转换 + 主干课程提取）+ 测试

**Files:**
- Create: `scripts/scrapers/majors/detail/parse.ts`
- Test: `scripts/scrapers/majors/detail/__tests__/parse.test.ts`
- Test: `scripts/scrapers/majors/detail/__tests__/mainCourses.test.ts`

- [ ] **Step 1: 创建测试 fixture（哲学专业详情快照）**

创建 `scripts/scrapers/majors/detail/__fixtures__/detail_philosophy.json`：

```json
{
  "zydm": "010101",
  "zymc": "哲学",
  "ml": "哲学",
  "mlCode": "01",
  "xk": "哲学类",
  "xkCode": "0101",
  "xlcc": "本科（普通教育）",
  "specId": "73381059",
  "xsgm": "3000-3500",
  "boyPercent": 38,
  "girlPercent": 62,
  "zyjs": {
    "desc": "本专业学生主要学习马克思主义哲学基本原理、中国哲学和西方哲学等方面的专业知识，以及伦理学、逻辑学、美学、宗教学、科学技术哲学、管理哲学、政治哲学等方面的基础知识；受到中西方哲学的基本理论和发展线索的系统教育，以及创造性思维的培养和业务能力的训练；要求学生比较系统地掌握马克思主义哲学、中国哲学和西方哲学的理论和历史；具有一定的社会科学、人文科学、自然科学、思维科学的相关知识；掌握哲学学科的基本研究方法、治学方法和相应的社会调查能力；了解国内外哲学界最重要的理论前沿和发展动态；了解国内外最重大的实践问题和发展动态；具有分析和解决社会现实问题的初步能力。",
    "zymx": null
  },
  "jyfxInfo": {
    "jyfxList": [
      { "jyfx": "公务员(省级机关)", "url4Xzpt": "https://xz.chsi.com.cn/occupation/occudetail.action?id=rfqa0wx9f481vmhj" },
      { "jyfx": "考研", "url4Xzpt": "" },
      { "jyfx": "高中教师", "url4Xzpt": "https://xz.chsi.com.cn/occupation/occudetail.action?id=j0fd675hgqprjpke" }
    ]
  },
  "zymyd": [
    { "type": "3", "typeDesc": "综合满意度", "rank": 4.2, "count": 3479 },
    { "type": "0", "typeDesc": "办学条件满意度", "rank": 4.1, "count": 3716 },
    { "type": "1", "typeDesc": "教学质量满意度", "rank": 4.2, "count": 3416 },
    { "type": "2", "typeDesc": "就业满意度", "rank": 3.4, "count": 3313 }
  ],
  "kyfx": [
    { "zydm": "010100", "zymc": "哲学" },
    { "zydm": "010101", "zymc": "马克思主义哲学" },
    { "zydm": "010102", "zymc": "中国哲学" },
    { "zydm": "010103", "zymc": "外国哲学" }
  ],
  "zytjzsList": [
    { "schId": "73395168", "yxmc": "黑龙江大学", "count": 828, "rank": 4.6 },
    { "schId": "73394848", "yxmc": "山西大学", "count": 443, "rank": 4.5 },
    { "schId": "73396677", "yxmc": "西北政法大学", "count": 429, "rank": 4.3 }
  ],
  "simileZyList": [
    { "zydm": "010102", "zymc": "逻辑学", "specId": "73381063" },
    { "zydm": "010103", "zymc": "宗教学", "specId": "73381067" },
    { "zydm": "010104", "zymc": "伦理学", "specId": "164248791" }
  ],
  "year": "2025"
}
```

- [ ] **Step 2: 创建专科测试 fixture**

创建 `scripts/scrapers/majors/detail/__fixtures__/detail_vocational.json`：

```json
{
  "zydm": "410101",
  "zymc": "种子生产与经营",
  "ml": "农林牧渔",
  "mlCode": "41",
  "xk": "农业类",
  "xkCode": "4101",
  "xlcc": "高职（专科）",
  "specId": "73385468",
  "xsgm": "1000-2000",
  "boyPercent": 55,
  "girlPercent": 45,
  "zyjs": {
    "desc": "本专业培养具备作物遗传育种、种子生产与经营等方面的基本理论和基本知识，能在种子生产、加工、经营等相关领域从事技术与管理工作的高素质技术技能人才。主干课程：作物栽培学、作物育种学、种子生产技术、种子检验技术、种子加工与贮藏、种子经营管理。",
    "zymx": null
  },
  "jyfxInfo": {
    "jyfxList": [
      { "jyfx": "种子公司技术员", "url4Xzpt": "" },
      { "jyfx": "农业技术推广", "url4Xzpt": "" }
    ]
  },
  "zymyd": [
    { "type": "3", "typeDesc": "综合满意度", "rank": 4.2, "count": 120 }
  ],
  "kyfx": [],
  "zytjzsList": [
    { "schId": "73395000", "yxmc": "某农业大学", "count": 200, "rank": 4.0 }
  ],
  "simileZyList": [],
  "year": "2025"
}
```

- [ ] **Step 3: 编写 mainCourses.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { extractMainCourses } from '../parse.js'

describe('extractMainCourses', () => {
  it('从 desc 中提取主干课程（冒号格式）', () => {
    const desc = '本专业培养具备...主干课程：作物栽培学、作物育种学、种子生产技术。'
    const result = extractMainCourses(desc)
    expect(result).toBe('作物栽培学、作物育种学、种子生产技术')
  })

  it('从 desc 中提取主要课程', () => {
    const desc = '主要课程：哲学概论、马克思主义哲学、中国哲学史。'
    const result = extractMainCourses(desc)
    expect(result).toBe('哲学概论、马克思主义哲学、中国哲学史')
  })

  it('从 desc 中提取核心课程', () => {
    const desc = '核心课程：高等数学、线性代数、概率论。'
    const result = extractMainCourses(desc)
    expect(result).toBe('高等数学、线性代数、概率论')
  })

  it('desc 中无课程信息时返回空字符串', () => {
    const desc = '本专业学生主要学习马克思主义哲学基本原理。'
    const result = extractMainCourses(desc)
    expect(result).toBe('')
  })

  it('desc 为空时返回空字符串', () => {
    const result = extractMainCourses('')
    expect(result).toBe('')
  })

  it('课程列表到句号结尾时正确截断', () => {
    const desc = '主干课程：课程A、课程B、课程C。后续其他内容。'
    const result = extractMainCourses(desc)
    expect(result).toBe('课程A、课程B、课程C')
  })
})
```

- [ ] **Step 4: 编写 parse.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseDetail } from '../parse.js'
import type { MajorDetailResponse } from '../types.js'

const philosophyFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '__fixtures__', 'detail_philosophy.json'), 'utf-8'),
) as MajorDetailResponse

const vocationalFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '__fixtures__', 'detail_vocational.json'), 'utf-8'),
) as MajorDetailResponse

describe('parseDetail', () => {
  it('正确转换本科专业详情', () => {
    const record = parseDetail(philosophyFixture, '哲学', '哲学类', '本科（普通教育）')

    expect(record.majorCode).toBe('010101')
    expect(record.majorName).toBe('哲学')
    expect(record.category).toBe('哲学')
    expect(record.subCategory).toBe('哲学类')
    expect(record.educationLevel).toBe('本科（普通教育）')
    expect(record.introduction).toContain('马克思主义哲学')
    expect(record.careerDirections).toEqual(['公务员(省级机关)', '考研', '高中教师'])
    expect(record.durationAndDegree.studentScale).toBe('3000-3500')
    expect(record.durationAndDegree.boyPercent).toBe(38)
    expect(record.durationAndDegree.girlPercent).toBe(62)
    expect(record.durationAndDegree.year).toBe('2025')
    expect(record.satisfaction).toHaveLength(4)
    expect(record.graduateMajors).toHaveLength(4)
    expect(record.recommendedColleges).toHaveLength(3)
    expect(record.similarMajors).toHaveLength(3)
    expect(record.specId).toBe('73381059')
    expect(record._meta.source).toBe('gaokao_chsi')
    expect(record._meta.sourceUrl).toBe('https://gaokao.chsi.com.cn/zyk/zybk/detail/73381059')
  })

  it('正确转换专科专业详情（含主干课程提取）', () => {
    const record = parseDetail(vocationalFixture, '农林牧渔', '农业类', '高职（专科）')

    expect(record.majorCode).toBe('410101')
    expect(record.educationLevel).toBe('高职（专科）')
    expect(record.mainCourses).toBe('作物栽培学、作物育种学、种子生产技术')
    expect(record.careerDirections).toEqual(['种子公司技术员', '农业技术推广'])
  })

  it('zyjs 为 null 时 introduction 为空字符串', () => {
    const detail: MajorDetailResponse = {
      ...philosophyFixture,
      zyjs: null,
    }
    const record = parseDetail(detail, '哲学', '哲学类', '本科（普通教育）')
    expect(record.introduction).toBe('')
    expect(record.mainCourses).toBe('')
  })

  it('jyfxInfo 为 null 时 careerDirections 为空数组', () => {
    const detail: MajorDetailResponse = {
      ...philosophyFixture,
      jyfxInfo: null,
    }
    const record = parseDetail(detail, '哲学', '哲学类', '本科（普通教育）')
    expect(record.careerDirections).toEqual([])
  })

  it('recommendedColleges 最多取 10 条', () => {
    const detail: MajorDetailResponse = {
      ...philosophyFixture,
      zytjzsList: Array.from({ length: 15 }, (_, i) => ({
        schId: `sch_${i}`,
        yxmc: `大学${i}`,
        count: 100 - i,
        rank: 4.0,
      })),
    }
    const record = parseDetail(detail, '哲学', '哲学类', '本科（普通教育）')
    expect(record.recommendedColleges).toHaveLength(10)
  })
})
```

- [ ] **Step 5: 运行测试确认失败**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/parse.test.ts scripts/scrapers/majors/detail/__tests__/mainCourses.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 6: 创建 parse.ts 实现**

```typescript
import { SCRAPER_VERSION, MAJOR_DETAIL_API_BASE } from '../../config.js'
import type { MajorDetailResponse } from './types.js'
import type { DetailedMajorRecord } from '../../types.js'

/**
 * 从专业介绍文本中提取主干课程信息（best-effort）
 */
export function extractMainCourses(desc: string): string {
  if (!desc) return ''
  const match = desc.match(/(?:主干|主要|核心)课程[：:]\s*(.+?)(?:。|$)/)
  return match ? match[1].trim() : ''
}

export function parseDetail(
  detail: MajorDetailResponse,
  categoryName: string,
  subCategoryName: string,
  educationLevel: string,
): DetailedMajorRecord {
  const introduction = detail.zyjs?.desc ?? ''
  const mainCourses = extractMainCourses(introduction)

  const careerDirections = (detail.jyfxInfo?.jyfxList ?? []).map((item) => item.jyfx)

  const satisfaction = detail.zymyd.map((item) => ({
    type: item.type,
    typeDesc: item.typeDesc,
    rank: item.rank,
    count: item.count,
  }))

  const graduateMajors = detail.kyfx.map((item) => ({
    majorCode: item.zydm,
    majorName: item.zymc,
  }))

  const recommendedColleges = detail.zytjzsList.slice(0, 10).map((item) => ({
    collegeName: item.yxmc,
    count: item.count,
    rank: item.rank,
  }))

  const similarMajors = detail.simileZyList.map((item) => ({
    majorCode: item.zydm,
    majorName: item.zymc,
  }))

  return {
    majorCode: detail.zydm,
    majorName: detail.zymc,
    category: categoryName,
    subCategory: subCategoryName,
    educationLevel,
    introduction,
    careerDirections,
    mainCourses,
    durationAndDegree: {
      studentScale: detail.xsgm,
      boyPercent: detail.boyPercent,
      girlPercent: detail.girlPercent,
      year: detail.year,
    },
    satisfaction,
    graduateMajors,
    recommendedColleges,
    similarMajors,
    specId: detail.specId,
    _meta: {
      source: 'gaokao_chsi',
      sourceUrl: `${MAJOR_DETAIL_API_BASE}/detail/${detail.specId}`,
      fetchedAt: new Date().toISOString(),
      scraperVersion: SCRAPER_VERSION,
      verified: true,
    },
  }
}
```

- [ ] **Step 7: 运行测试确认通过**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/parse.test.ts scripts/scrapers/majors/detail/__tests__/mainCourses.test.ts`
Expected: PASS — 全部测试通过

- [ ] **Step 8: Commit**

```bash
git add scripts/scrapers/majors/detail/parse.ts scripts/scrapers/majors/detail/__tests__/parse.test.ts scripts/scrapers/majors/detail/__tests__/mainCourses.test.ts scripts/scrapers/majors/detail/__fixtures__/
git commit -m "feat(scrapers): add detail parser with main course extraction"
```

---

### Task 6: 创建 detail/validate.ts + 测试

**Files:**
- Create: `scripts/scrapers/majors/detail/validate.ts`
- Test: `scripts/scrapers/majors/detail/__tests__/validate.test.ts`

- [ ] **Step 1: 编写 validate.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { validateDetailedRecord } from '../validate.js'
import type { DetailedMajorRecord } from '../../../types.js'

function makeRecord(overrides: Partial<DetailedMajorRecord> = {}): DetailedMajorRecord {
  return {
    majorCode: '010101',
    majorName: '哲学',
    category: '哲学',
    subCategory: '哲学类',
    educationLevel: '本科（普通教育）',
    introduction: '本专业...',
    careerDirections: ['考研'],
    mainCourses: '',
    durationAndDegree: {
      studentScale: '3000-3500',
      boyPercent: 38,
      girlPercent: 62,
      year: '2025',
    },
    satisfaction: [],
    graduateMajors: [],
    recommendedColleges: [],
    similarMajors: [],
    specId: '73381059',
    _meta: {
      source: 'gaokao_chsi',
      sourceUrl: 'https://example.com/detail/73381059',
      fetchedAt: '2026-06-18T10:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateDetailedRecord', () => {
  it('合法记录返回 valid: true', () => {
    const result = validateDetailedRecord(makeRecord())
    expect(result.valid).toBe(true)
  })

  it('majorCode 非 6 位数字时无效', () => {
    const result = validateDetailedRecord(makeRecord({ majorCode: '12345' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('majorCode')
  })

  it('majorCode 含字母时无效', () => {
    const result = validateDetailedRecord(makeRecord({ majorCode: '01010A' }))
    expect(result.valid).toBe(false)
  })

  it('majorName 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ majorName: '' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('majorName')
  })

  it('category 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ category: '' }))
    expect(result.valid).toBe(false)
  })

  it('specId 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ specId: '' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('specId')
  })

  it('boyPercent 超出 0-100 时无效', () => {
    const result = validateDetailedRecord(makeRecord({
      durationAndDegree: { studentScale: '', boyPercent: 150, girlPercent: 62, year: '2025' },
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('boyPercent')
  })

  it('girlPercent 为负数时无效', () => {
    const result = validateDetailedRecord(makeRecord({
      durationAndDegree: { studentScale: '', boyPercent: 38, girlPercent: -10, year: '2025' },
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('girlPercent')
  })

  it('educationLevel 为空时无效', () => {
    const result = validateDetailedRecord(makeRecord({ educationLevel: '' }))
    expect(result.valid).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/validate.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 validate.ts 实现**

```typescript
import type { DetailedMajorRecord } from '../../types.js'

export function validateDetailedRecord(record: DetailedMajorRecord): {
  valid: boolean
  reason?: string
} {
  if (!record.majorCode || !/^\d{6}$/.test(record.majorCode)) {
    return { valid: false, reason: `majorCode 格式非法: "${record.majorCode}"` }
  }
  if (!record.majorName) {
    return { valid: false, reason: 'majorName 为空' }
  }
  if (!record.category) {
    return { valid: false, reason: 'category 为空' }
  }
  if (!record.subCategory) {
    return { valid: false, reason: 'subCategory 为空' }
  }
  if (!record.educationLevel) {
    return { valid: false, reason: 'educationLevel 为空' }
  }
  if (!record.specId) {
    return { valid: false, reason: 'specId 为空' }
  }
  const { boyPercent, girlPercent } = record.durationAndDegree
  if (boyPercent < 0 || boyPercent > 100) {
    return { valid: false, reason: `boyPercent 越界: ${boyPercent}` }
  }
  if (girlPercent < 0 || girlPercent > 100) {
    return { valid: false, reason: `girlPercent 越界: ${girlPercent}` }
  }
  return { valid: true }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/validate.test.ts`
Expected: PASS — 全部 10 个测试通过

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/majors/detail/validate.ts scripts/scrapers/majors/detail/__tests__/validate.test.ts
git commit -m "feat(scrapers): add detailed major record validator"
```

---

### Task 7: 创建 detail/crawler.ts（树形遍历编排器）+ 测试

**Files:**
- Create: `scripts/scrapers/majors/detail/crawler.ts`
- Test: `scripts/scrapers/majors/detail/__tests__/crawler.test.ts`

- [ ] **Step 1: 编写 crawler.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { crawlCatalog } from '../crawler.js'
import type { CategoryItem, MajorListItem, MajorDetailResponse } from '../types.js'

// Mock API 函数
vi.mock('../api.js', () => ({
  fetchCategories: vi.fn(),
  fetchSubcategories: vi.fn(),
  fetchMajors: vi.fn(),
  fetchMajorDetail: vi.fn(),
}))

import { fetchCategories, fetchSubcategories, fetchMajors, fetchMajorDetail } from '../api.js'

const mockCategories: CategoryItem[] = [
  { key: '105001', name: '哲学' },
]
const mockSubcategories: CategoryItem[] = [
  { key: '10500101', name: '哲学类' },
]
const mockMajors: MajorListItem[] = [
  { zydm: '010101', zymc: '哲学', specId: '73381059', zymyd: '4.2', hasZyjs: true },
  { zydm: '010102', zymc: '逻辑学', specId: '73381063', zymyd: '3.5', hasZyjs: true },
]

function makeMockDetail(specId: string, zymc: string): MajorDetailResponse {
  return {
    zydm: '010101', zymc, ml: '哲学', mlCode: '01', xk: '哲学类', xkCode: '0101',
    xlcc: '本科（普通教育）', specId, xsgm: '1000-2000', boyPercent: 50, girlPercent: 50,
    zyjs: { desc: '介绍', zymx: null },
    jyfxInfo: { jyfxList: [{ jyfx: '考研', url4Xzpt: '' }] },
    zymyd: [], kyfx: [], zytjzsList: [], simileZyList: [],
    year: '2025',
  }
}

describe('crawlCatalog', () => {
  it('完整遍历门类→专业类→专业→详情', async () => {
    vi.mocked(fetchCategories).mockResolvedValue(mockCategories)
    vi.mocked(fetchSubcategories).mockResolvedValue(mockSubcategories)
    vi.mocked(fetchMajors).mockResolvedValue(mockMajors)
    vi.mocked(fetchMajorDetail)
      .mockResolvedValueOnce(makeMockDetail('73381059', '哲学'))
      .mockResolvedValueOnce(makeMockDetail('73381063', '逻辑学'))

    const onProgress = vi.fn()
    const records = await crawlCatalog('1050', '本科（普通教育）', onProgress)

    expect(records).toHaveLength(2)
    expect(records[0].majorName).toBe('哲学')
    expect(records[1].majorName).toBe('逻辑学')
    expect(fetchCategories).toHaveBeenCalledWith(expect.anything(), '1050')
    expect(fetchSubcategories).toHaveBeenCalledWith(expect.anything(), '105001')
    expect(fetchMajors).toHaveBeenCalledWith(expect.anything(), '10500101')
    expect(fetchMajorDetail).toHaveBeenCalledWith(expect.anything(), '73381059')
    expect(fetchMajorDetail).toHaveBeenCalledWith(expect.anything(), '73381063')
  })

  it('onProgress 回调被正确调用', async () => {
    vi.mocked(fetchCategories).mockResolvedValue(mockCategories)
    vi.mocked(fetchSubcategories).mockResolvedValue(mockSubcategories)
    vi.mocked(fetchMajors).mockResolvedValue(mockMajors)
    vi.mocked(fetchMajorDetail)
      .mockResolvedValueOnce(makeMockDetail('73381059', '哲学'))
      .mockResolvedValueOnce(makeMockDetail('73381063', '逻辑学'))

    const onProgress = vi.fn()
    await crawlCatalog('1050', '本科（普通教育）', onProgress)

    expect(onProgress).toHaveBeenCalled()
    // 至少调用 2 次（2 个专业）
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('详情 API 失败时跳过当前专业继续采集', async () => {
    vi.mocked(fetchCategories).mockResolvedValue(mockCategories)
    vi.mocked(fetchSubcategories).mockResolvedValue(mockSubcategories)
    vi.mocked(fetchMajors).mockResolvedValue(mockMajors)
    vi.mocked(fetchMajorDetail)
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce(makeMockDetail('73381063', '逻辑学'))

    const onProgress = vi.fn()
    const records = await crawlCatalog('1050', '本科（普通教育）', onProgress)

    expect(records).toHaveLength(1)
    expect(records[0].majorName).toBe('逻辑学')
  })

  it('空门类列表返回空数组', async () => {
    vi.mocked(fetchCategories).mockResolvedValue([])
    const records = await crawlCatalog('1050', '本科（普通教育）')
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/crawler.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 crawler.ts 实现**

```typescript
import { HttpClient } from '../../shared/http.js'
import { GAOKAO_QPS } from '../../config.js'
import { fetchCategories, fetchSubcategories, fetchMajors, fetchMajorDetail } from './api.js'
import { parseDetail } from './parse.js'
import { validateDetailedRecord } from './validate.js'
import type { DetailedMajorRecord } from '../../types.js'

export interface FailedMajor {
  specId: string
  majorName: string
  reason: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function crawlCatalog(
  client: HttpClient,
  rootKey: string,
  educationLevel: string,
  onProgress?: (current: number, total: number, majorName: string) => void,
): Promise<{ records: DetailedMajorRecord[]; failed: FailedMajor[] }> {
  const records: DetailedMajorRecord[] = []
  const failed: FailedMajor[] = []

  // Step 1: 门类
  const categories = await fetchCategories(client, rootKey)

  for (const cat of categories) {
    // Step 2: 专业类
    const subcats = await fetchSubcategories(client, cat.key)

    for (const subcat of subcats) {
      // Step 3: 专业列表
      const majors = await fetchMajors(client, subcat.key)

      let current = 0
      for (const major of majors) {
        current++
        try {
          // Step 4: 专业详情
          const detail = await fetchMajorDetail(client, major.specId)
          const record = parseDetail(detail, cat.name, subcat.name, educationLevel)
          const validation = validateDetailedRecord(record)
          if (validation.valid) {
            records.push(record)
          } else {
            failed.push({
              specId: major.specId,
              majorName: major.zymc,
              reason: `校验失败: ${validation.reason}`,
            })
          }
        } catch (err) {
          failed.push({
            specId: major.specId,
            majorName: major.zymc,
            reason: err instanceof Error ? err.message : String(err),
          })
        }

        if (onProgress) {
          onProgress(current, majors.length, major.zymc)
        }

        await sleep(1000 / GAOKAO_QPS)
      }
    }
  }

  return { records, failed }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run scripts/scrapers/majors/detail/__tests__/crawler.test.ts`
Expected: PASS — 全部 4 个测试通过

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/majors/detail/crawler.ts scripts/scrapers/majors/detail/__tests__/crawler.test.ts
git commit -m "feat(scrapers): add tree traversal crawler for detailed major catalog"
```

---

### Task 8: 创建 detail/index.ts（主入口）

**Files:**
- Create: `scripts/scrapers/majors/detail/index.ts`

- [ ] **Step 1: 创建 index.ts 主入口**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../../shared/http.js'
import {
  SCRAPER_VERSION,
  RAW_DIR,
  MAJOR_DETAIL_OUTPUT_DIR,
  MAJOR_DETAIL_OUTPUT_FILE,
  MAJOR_DETAIL_META_FILE,
  MAJOR_DETAIL_PARTIAL_FILE,
  MAJOR_DETAIL_FAILED_FILE,
  REPORTS_DIR,
  UNDERGRADUATE_ROOT_KEY,
  VOCATIONAL_ROOT_KEY,
  GAOKAO_QPS,
} from '../../config.js'
import { crawlCatalog, type FailedMajor } from './crawler.js'
import type { DetailedMajorRecord, DetailedCatalogFileMeta } from '../../types.js'

function parseArgs(): { force: boolean; dryRun: boolean } {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadPartial(): DetailedMajorRecord[] {
  if (fs.existsSync(MAJOR_DETAIL_PARTIAL_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(MAJOR_DETAIL_PARTIAL_FILE, 'utf-8'))
      console.log(`[断点续采] 加载 ${data.length} 条已采集记录`)
      return data
    } catch {
      console.warn('[断点续采] partial 文件解析失败，从头开始')
    }
  }
  return []
}

function savePartial(records: DetailedMajorRecord[]): void {
  fs.writeFileSync(MAJOR_DETAIL_PARTIAL_FILE, JSON.stringify(records, null, 2), 'utf-8')
}

function getExistingSpecIds(records: DetailedMajorRecord[]): Set<string> {
  return new Set(records.map((r) => r.specId))
}

async function main(): Promise<void> {
  const { force, dryRun } = parseArgs()

  // 创建目录
  fs.mkdirSync(MAJOR_DETAIL_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(REPORTS_DIR, { recursive: true })

  const client = new HttpClient(path.join(RAW_DIR, 'majors_detail'))

  // 断点续采
  const existingRecords = loadPartial()
  const existingSpecIds = getExistingSpecIds(existingRecords)
  if (existingSpecIds.size > 0) {
    console.log(`[断点续采] 跳过 ${existingSpecIds.size} 个已采集 specId`)
  }

  const allRecords: DetailedMajorRecord[] = [...existingRecords]
  const allFailed: FailedMajor[] = []
  let undergradCount = 0
  let vocationalCount = 0

  // 采集本科
  console.log('\n=== 采集本科（普通教育）专业目录 ===')
  console.log(`QPS: ${GAOKAO_QPS}（间隔 ${1000 / GAOKAO_QPS}ms）\n`)

  const undergradResult = await crawlCatalog(
    client,
    UNDERGRADUATE_ROOT_KEY,
    '本科（普通教育）',
    (current, total, majorName) => {
      const percent = ((current / total) * 100).toFixed(1)
      console.log(`  [本科] ${majorName} (${current}/${total}, ${percent}%)`)
    },
  )
  allRecords.push(...undergradResult.records)
  allFailed.push(...undergradResult.failed)
  undergradCount = undergradResult.records.length
  console.log(`\n[本科] 完成: ${undergradCount} 条记录, ${undergradResult.failed.length} 条失败`)

  // 保存 partial
  savePartial(allRecords)

  // 采集专科
  console.log('\n=== 采集高职（专科）专业目录 ===\n')

  const vocationalResult = await crawlCatalog(
    client,
    VOCATIONAL_ROOT_KEY,
    '高职（专科）',
    (current, total, majorName) => {
      const percent = ((current / total) * 100).toFixed(1)
      console.log(`  [专科] ${majorName} (${current}/${total}, ${percent}%)`)
    },
  )
  allRecords.push(...vocationalResult.records)
  allFailed.push(...vocationalResult.failed)
  vocationalCount = vocationalResult.records.length
  console.log(`\n[专科] 完成: ${vocationalCount} 条记录, ${vocationalResult.failed.length} 条失败`)

  // 汇总
  console.log('\n=== 采集完成 ===')
  console.log(`本科: ${undergradCount} 条`)
  console.log(`专科: ${vocationalCount} 条`)
  console.log(`总计: ${allRecords.length} 条记录, ${allFailed.length} 条失败`)

  if (dryRun) {
    console.log('\n[dry-run] 跳过写入输出文件')
    return
  }

  // 写入主输出文件
  fs.writeFileSync(MAJOR_DETAIL_OUTPUT_FILE, JSON.stringify(allRecords, null, 2), 'utf-8')
  console.log(`\n写入: ${MAJOR_DETAIL_OUTPUT_FILE}`)

  // 写入 meta 文件
  const meta: DetailedCatalogFileMeta = {
    totalCount: allRecords.length,
    undergraduateCount: undergradCount,
    vocationalCount,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [
      {
        name: '阳光高考专业库-本科（普通教育）',
        url: `https://gaokao.chsi.com.cn/zyk/zybk/mlCategory/${UNDERGRADUATE_ROOT_KEY}`,
        recordCount: undergradCount,
      },
      {
        name: '阳光高考专业库-高职（专科）',
        url: `https://gaokao.chsi.com.cn/zyk/zybk/mlCategory/${VOCATIONAL_ROOT_KEY}`,
        recordCount: vocationalCount,
      },
    ],
  }
  fs.writeFileSync(MAJOR_DETAIL_META_FILE, JSON.stringify(meta, null, 2), 'utf-8')
  console.log(`写入: ${MAJOR_DETAIL_META_FILE}`)

  // 写入失败报告
  if (allFailed.length > 0) {
    fs.writeFileSync(MAJOR_DETAIL_FAILED_FILE, JSON.stringify(allFailed, null, 2), 'utf-8')
    console.log(`写入失败报告: ${MAJOR_DETAIL_FAILED_FILE}`)
  }

  // 清理 partial 文件
  if (fs.existsSync(MAJOR_DETAIL_PARTIAL_FILE)) {
    fs.unlinkSync(MAJOR_DETAIL_PARTIAL_FILE)
    console.log('清理断点续采临时文件')
  }
}

main().catch((err) => {
  console.error('采集失败:', err)
  process.exit(2)
})
```

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit scripts/scrapers/majors/detail/index.ts`
Expected: 无错误

- [ ] **Step 3: 运行全部 detail 测试**

Run: `npx vitest run scripts/scrapers/majors/detail`
Expected: PASS — 全部测试通过

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapers/majors/detail/index.ts
git commit -m "feat(scrapers): add main entry for detailed major catalog collection"
```

---

### Task 9: 添加 npm 脚本并端到端验证

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加 scrape:majors:detail 脚本**

在 `package.json` 的 `scripts` 中，在 `"scrape:majors"` 行之后追加：

```json
"scrape:majors:detail": "tsx scripts/scrapers/majors/detail/index.ts",
```

- [ ] **Step 2: 运行全部 scraper 测试确认无回归**

Run: `npm run test:scrapers`
Expected: PASS — 全部已有测试 + 新增测试通过

- [ ] **Step 3: 端到端运行采集（小规模验证）**

先用 dry-run 验证流程：

Run: `npx tsx scripts/scrapers/majors/detail/index.ts --dry-run`
Expected: 看到采集进度日志，最终输出 "[dry-run] 跳过写入输出文件"

- [ ] **Step 4: 正式运行采集**

Run: `npm run scrape:majors:detail`
Expected: 
- 本科 883 条记录
- 专科 748 条记录
- 总计 1631 条
- 写入 `public/data/common/majors/detailed-catalog.json`

- [ ] **Step 5: 验证输出文件**

Run: `npx tsx -e "const d = require('./public/data/common/majors/detailed-catalog.json'); console.log('总数:', d.length); console.log('本科:', d.filter(r => r.educationLevel.includes('本科')).length); console.log('专科:', d.filter(r => r.educationLevel.includes('专科')).length); console.log('样本:', JSON.stringify(d[0], null, 2).slice(0, 500))"`

Expected: 总数 1631，本科 883，专科 748

- [ ] **Step 6: Commit**

```bash
git add package.json public/data/common/majors/detailed-catalog.json public/data/common/majors/detailed-catalog.meta.json
git commit -m "feat(scrapers): collect 1631 detailed major catalog records via gaokao API"
```

---

## Self-Review

### Spec coverage
- ✅ 4 步树形遍历 → Task 4 (api.ts) + Task 7 (crawler.ts)
- ✅ 本科 883 + 专科 748 → Task 8 (index.ts, 两个 root key)
- ✅ 专业介绍+培养目标 → Task 5 (parse.ts, introduction 字段)
- ✅ 主干课程 → Task 5 (parse.ts, extractMainCourses)
- ✅ 就业方向 → Task 5 (parse.ts, careerDirections)
- ✅ 学制学位+统计信息 → Task 5 (parse.ts, durationAndDegree)
- ✅ QPS 限速 → Task 7 (crawler.ts, sleep(1000/GAOKAO_QPS))
- ✅ 断点续采 → Task 8 (index.ts, partial 文件)
- ✅ 错误处理 → Task 7 (crawler.ts, try-catch + failed 数组)
- ✅ 记录校验 → Task 6 (validate.ts)
- ✅ 输出格式 → Task 8 (index.ts, detailed-catalog.json + meta.json)
- ✅ 测试 → Task 4-7 各有测试文件

### Placeholder scan
- 无 TBD/TODO
- 所有步骤包含完整代码
- 所有命令包含预期输出

### Type consistency
- `DetailedMajorRecord` 在 Task 1 定义，Task 5/6/7/8 使用 — 一致
- `MajorDetailResponse` 在 Task 3 定义，Task 4/5/7 使用 — 一致
- `crawlCatalog` 返回 `{ records, failed }` 在 Task 7 定义，Task 8 使用 — 一致
- `validateDetailedRecord` 返回 `{ valid, reason? }` 在 Task 6 定义，Task 7 使用 — 一致
- `extractMainCourses` 在 Task 5 定义，parse.ts 内部调用 — 一致
