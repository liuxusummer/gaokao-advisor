# 院校官网补齐实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 colleges.json 中 2919 条院校记录的 officialWebsite 和 admissionUrl 字段。

**Architecture:** 通过阳光高考列表页（148 页）建立 schId→院校名 映射，按院校名 3 级匹配 colleges.json，再调用详情 API `/wap/sch/schinfo/{schId}` 获取官网和招生网，更新写回 colleges.json。

**Tech Stack:** Node.js + TypeScript + tsx + cheerio（列表页解析）+ axios（已有 HttpClient）+ Vitest

**Spec:** [2026-06-18-college-website-enrichment-design.md](../specs/2026-06-18-college-website-enrichment-design.md)

---

## 文件结构

**新建：**
- `scripts/scrapers/colleges/website_enricher.ts` — 官网补齐器主模块
- `scripts/scrapers/colleges/__tests__/website_enricher.test.ts` — 测试
- `scripts/scrapers/colleges/__fixtures__/sch_list_sample.html` — 列表页 HTML 样本
- `scripts/scrapers/colleges/__fixtures__/sch_detail_sample.json` — 详情 API 响应样本

**修改：**
- `package.json` — 新增 `scrape:colleges:websites` npm script

**不修改：**
- `scripts/scrapers/colleges/index.ts`、`gaokao_detail.ts`、`merge.ts`（保持现有采集流程不变）
- `scripts/scrapers/types.ts`（CollegeRecord 已有 officialWebsite、admissionUrl 字段）

---

## Task 1: 创建测试 fixture 文件

**Files:**
- Create: `scripts/scrapers/colleges/__fixtures__/sch_list_sample.html`
- Create: `scripts/scrapers/colleges/__fixtures__/sch_detail_sample.json`

- [ ] **Step 1: 创建列表页 HTML fixture**

创建 `scripts/scrapers/colleges/__fixtures__/sch_list_sample.html`：

```html
<!DOCTYPE html>
<html>
<head><title>院校列表</title></head>
<body>
<div class="sch-list-container">
  <div class="sch-item">
    <div class="sch-title">
      <a class="name js-yxk-yxmc text-decoration-none" target="_blank"
         href="/sch/schoolInfo--schId-1.dhtml">  北京大学  </a>
    </div>
    <a class="sch-department" href="/sch/schoolInfo--schId-1.dhtml">
      <i></i>北京<span>|</span><span>主管部门：</span>教育部
    </a>
  </div>
  <div class="sch-item">
    <div class="sch-title">
      <a class="name js-yxk-yxmc text-decoration-none" target="_blank"
         href="/sch/schoolInfo--schId-2.dhtml">  中国人民大学  </a>
    </div>
    <a class="sch-department" href="/sch/schoolInfo--schId-2.dhtml">
      <i></i>北京<span>|</span><span>主管部门：</span>教育部
    </a>
  </div>
  <div class="sch-item">
    <div class="sch-title">
      <a class="name js-yxk-yxmc text-decoration-none" target="_blank"
         href="/sch/schoolInfo--schId-3.dhtml">  清华大学  </a>
    </div>
    <a class="sch-department" href="/sch/schoolInfo--schId-3.dhtml">
      <i></i>北京<span>|</span><span>主管部门：</span>教育部
    </a>
  </div>
  <div class="sch-item">
    <div class="sch-title">
      <a class="name js-yxk-yxmc text-decoration-none" target="_blank"
         href="/sch/schoolInfo--schId-4.dhtml">  北京交通大学  </a>
    </div>
    <a class="sch-department" href="/sch/schoolInfo--schId-4.dhtml">
      <i></i>北京<span>|</span><span>主管部门：</span>教育部
    </a>
  </div>
  <div class="sch-item">
    <div class="sch-title">
      <a class="name js-yxk-yxmc text-decoration-none" target="_blank"
         href="/sch/schoolInfo--schId-5.dhtml">  中国矿业大学（北京）  </a>
    </div>
    <a class="sch-department" href="/sch/schoolInfo--schId-5.dhtml">
      <i></i>北京<span>|</span><span>主管部门：</span>教育部
    </a>
  </div>
</div>
<div class="pager">
  <a href="/sch/search--searchType-1,start-0.dhtml">1</a>
  <a href="/sch/search--searchType-1,start-20.dhtml">2</a>
  <span class="ellipsis">…</span>
  <a href="/sch/search--searchType-1,start-2940.dhtml">148</a>
</div>
</body>
</html>
```

- [ ] **Step 2: 创建详情 API JSON fixture**

创建 `scripts/scrapers/colleges/__fixtures__/sch_detail_sample.json`：

```json
{
  "flag": true,
  "msg": {
    "schid": "1",
    "yxmc": "北京大学",
    "yxdm": "10001",
    "xxwz": "https://www.pku.edu.cn",
    "zswz": "https://bkzs.pku.edu.cn",
    "dh": "010-62751407",
    "txdz": "北京市海淀区颐和园路5号",
    "yxszd": "北京",
    "zgbmmc": "教育部"
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/colleges/__fixtures__/sch_list_sample.html scripts/scrapers/colleges/__fixtures__/sch_detail_sample.json
git commit -m "test(colleges): 新增官网补齐测试 fixture"
```

---

## Task 2: 编写测试（TDD - 先写失败测试）

**Files:**
- Create: `scripts/scrapers/colleges/__tests__/website_enricher.test.ts`

- [ ] **Step 1: 编写测试文件**

创建 `scripts/scrapers/colleges/__tests__/website_enricher.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  parseSchList,
  matchCollege,
  parseSchDetail,
  normalizeName,
} from '../website_enricher'
import type { CollegeRecord } from '../../types'

const listFixturePath = path.join(__dirname, '..', '__fixtures__', 'sch_list_sample.html')
const listFixtureHtml = fs.readFileSync(listFixturePath, 'utf-8')

const detailFixturePath = path.join(__dirname, '..', '__fixtures__', 'sch_detail_sample.json')
const detailFixtureJson = fs.readFileSync(detailFixturePath, 'utf-8')

// 模拟 colleges.json 中的记录
function makeCollege(overrides: Partial<CollegeRecord> = {}): CollegeRecord {
  return {
    id: '4111010001',
    moeCode: '4111010001',
    name: '北京大学',
    province: '北京市',
    city: '北京市',
    level: ['本科'],
    type: '综合',
    nature: 'public',
    affiliation: '教育部',
    officialWebsite: '',
    gaokaoUrl: '',
    _meta: {
      source: 'merged',
      sourceUrl: '',
      fetchedAt: '2026-06-17T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('parseSchList', () => {
  it('正常解析 5 条映射', () => {
    const mappings = parseSchList(listFixtureHtml)
    expect(mappings).toHaveLength(5)
  })

  it('schId 是数字字符串', () => {
    const mappings = parseSchList(listFixtureHtml)
    expect(mappings[0].schId).toBe('1')
    expect(mappings[4].schId).toBe('5')
    expect(/^\d+$/.test(mappings[0].schId)).toBe(true)
  })

  it('校名被 trim 清理空白', () => {
    const mappings = parseSchList(listFixtureHtml)
    expect(mappings[0].collegeName).toBe('北京大学')
    expect(mappings[0].collegeName).not.toMatch(/^\s|\s$/)
  })

  it('空 HTML 返回空数组', () => {
    const mappings = parseSchList('')
    expect(mappings).toEqual([])
  })

  it('无匹配项的 HTML 返回空数组', () => {
    const mappings = parseSchList('<html><body>无院校数据</body></html>')
    expect(mappings).toEqual([])
  })
})

describe('normalizeName', () => {
  it('全角括号转半角', () => {
    expect(normalizeName('中国矿业大学（北京）')).toBe('中国矿业大学(北京)')
  })

  it('去除括号后缀', () => {
    expect(normalizeName('浙江大学(中外合作办学)')).toBe('浙江大学')
  })

  it('无括号的原样返回', () => {
    expect(normalizeName('北京大学')).toBe('北京大学')
  })
})

describe('matchCollege', () => {
  const collegesByName = new Map<string, CollegeRecord>([
    ['北京大学', makeCollege({ id: '4111010001', name: '北京大学' })],
    ['中国矿业大学(北京)', makeCollege({ id: '4111010054', name: '中国矿业大学(北京)' })],
    ['浙江大学', makeCollege({ id: '4133010001', name: '浙江大学' })],
  ])

  it('精确匹配', () => {
    const result = matchCollege('北京大学', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.collegeId).toBe('4111010001')
    expect(result!.matchType).toBe('exact')
  })

  it('全角括号匹配', () => {
    // 列表页是全角括号，colleges.json 是半角括号
    const result = matchCollege('中国矿业大学（北京）', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.collegeId).toBe('4111010054')
  })

  it('去括号后缀匹配', () => {
    // 列表页带括号后缀，colleges.json 无括号
    const result = matchCollege('浙江大学(中外合作办学)', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.collegeId).toBe('4133010001')
  })

  it('包含匹配', () => {
    const result = matchCollege('浙大', collegesByName)
    expect(result).not.toBeNull()
    expect(result!.matchType).toBe('contains')
  })

  it('未匹配返回 null', () => {
    const result = matchCollege('不存在的大学', collegesByName)
    expect(result).toBeNull()
  })
})

describe('parseSchDetail', () => {
  it('正常响应返回官网和招生网', () => {
    const result = parseSchDetail(detailFixtureJson)
    expect(result).not.toBeNull()
    expect(result!.xxwz).toBe('https://www.pku.edu.cn')
    expect(result!.zswz).toBe('https://bkzs.pku.edu.cn')
  })

  it('flag=false 返回 null', () => {
    const json = JSON.stringify({ flag: false, msg: null })
    const result = parseSchDetail(json)
    expect(result).toBeNull()
  })

  it('xxwz 为空字符串时返回空', () => {
    const data = JSON.parse(detailFixtureJson)
    data.msg.xxwz = ''
    const result = parseSchDetail(JSON.stringify(data))
    expect(result).not.toBeNull()
    expect(result!.xxwz).toBe('')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/website_enricher.test.ts 2>&1 | tail -20`
Expected: FAIL — `Cannot find module '../website_enricher'`

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/colleges/__tests__/website_enricher.test.ts
git commit -m "test(colleges): 新增官网补齐器测试（失败）"
```

---

## Task 3: 实现官网补齐器核心函数

**Files:**
- Create: `scripts/scrapers/colleges/website_enricher.ts`

- [ ] **Step 1: 实现核心解析和匹配函数**

创建 `scripts/scrapers/colleges/website_enricher.ts`：

```typescript
import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { CollegeRecord } from '../types'

// === 类型定义 ===

export interface SchIdMapping {
  schId: string
  collegeName: string
}

export interface SchDetail {
  xxwz: string  // 学校网址（官网）
  zswz: string  // 招生网址
}

interface SchDetailResponse {
  flag: boolean
  msg: {
    schid: string
    yxmc: string
    yxdm: string
    xxwz: string
    zswz: string
    dh: string
    txdz: string
    yxszd: string
    zgbmmc: string
  } | null
}

export interface MatchResult {
  collegeId: string
  matchType: 'exact' | 'stripped' | 'contains'
}

// === 列表页解析 ===

/**
 * 解析阳光高考院校列表页 HTML，提取 (schId, 校名) 映射。
 *
 * HTML 结构：
 *   <a class="name js-yxk-yxmc..." href="/sch/schoolInfo--schId-{N}.dhtml">{校名}</a>
 */
export function parseSchList(html: string): SchIdMapping[] {
  if (!html) return []

  const $ = cheerio.load(html)
  const mappings: SchIdMapping[] = []

  $('.sch-list-container .sch-item .sch-title .name').each((_, el) => {
    const $el = $(el)
    const name = $el.text().trim()
    const href = $el.attr('href') || ''

    const match = href.match(/schoolInfo--schId-(\d+)\.dhtml/)
    if (!match || !name) return

    mappings.push({
      schId: match[1],
      collegeName: name,
    })
  })

  return mappings
}

// === 院校名标准化与匹配 ===

/**
 * 标准化院校名：全角括号转半角，去除括号后缀。
 * 用于匹配时消除格式差异。
 */
export function normalizeName(name: string): string {
  // 全角括号转半角
  let normalized = name.replace(/（/g, '(').replace(/）/g, ')')
  // 去除括号后缀（如"(中外合作办学)"）
  const bracketIndex = normalized.indexOf('(')
  if (bracketIndex > 0) {
    normalized = normalized.substring(0, bracketIndex).trim()
  }
  return normalized
}

/**
 * 三级院校名匹配：精确 → 去括号 → 包含。
 * 返回匹配的 collegeId 和匹配类型，未匹配返回 null。
 */
export function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): MatchResult | null {
  // 1. 精确匹配
  const exact = collegesByName.get(name)
  if (exact) {
    return { collegeId: exact.id, matchType: 'exact' }
  }

  // 2. 标准化后匹配（全角转半角 + 去括号后缀）
  const normalized = normalizeName(name)
  if (normalized !== name) {
    // 先尝试标准化后的精确匹配
    for (const [collegeName, college] of collegesByName) {
      if (normalizeName(collegeName) === normalized) {
        return { collegeId: college.id, matchType: 'stripped' }
      }
    }
  }

  // 3. 包含匹配
  for (const [collegeName, college] of collegesByName) {
    const cn = normalizeName(collegeName)
    if (cn.includes(normalized) || normalized.includes(cn)) {
      return { collegeId: college.id, matchType: 'contains' }
    }
  }

  return null
}

// === 详情 API 解析 ===

/**
 * 解析阳光高考院校详情 API 响应 JSON。
 * 返回官网和招生网，flag=false 或 msg=null 时返回 null。
 */
export function parseSchDetail(jsonText: string): SchDetail | null {
  if (!jsonText) return null

  try {
    const data: SchDetailResponse = JSON.parse(jsonText)
    if (!data.flag || !data.msg) return null

    return {
      xxwz: data.msg.xxwz || '',
      zswz: data.msg.zswz || '',
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/website_enricher.test.ts 2>&1 | tail -20`
Expected: PASS — 13 个用例全部通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/colleges/website_enricher.ts
git commit -m "feat(colleges): 实现官网补齐器核心函数（解析+匹配）"
```

---

## Task 4: 实现主流程编排

**Files:**
- Modify: `scripts/scrapers/colleges/website_enricher.ts`（追加主流程函数）

- [ ] **Step 1: 在 website_enricher.ts 末尾追加主流程代码**

在 `scripts/scrapers/colleges/website_enricher.ts` 文件末尾追加以下代码：

```typescript

// === 主流程编排 ===

import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import {
  GAOKAO_BASE_URL,
  GAOKAO_QPS,
  RAW_DIR,
  OUTPUT_DIR,
  REPORTS_DIR,
  LOGS_DIR,
} from '../config'

const logger = createLogger('website-enricher')

interface CliArgs {
  force: boolean
  listOnly: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force'),
    listOnly: args.includes('--list-only'),
  }
}

interface EnrichmentReport {
  totalMappings: number
  matched: number
  unmatched: number
  enriched: number
  emptyWebsite: number
  apiFailed: number
}

/**
 * 抓取阳光高考列表页，建立 schId → 院校名 映射。
 * 遍历 148 页（start-0 到 start-2940），每页 20 条。
 */
async function fetchSchIdMappings(
  http: HttpClient,
  force: boolean
): Promise<SchIdMapping[]> {
  const allMappings: SchIdMapping[] = []
  const seenSchIds = new Set<string>()
  const MAX_PAGES = 200 // 安全上限
  const requestInterval = 1000 // 列表页每页间隔 1 秒

  for (let page = 1; page <= MAX_PAGES; page++) {
    const start = (page - 1) * 20
    const url = `${GAOKAO_BASE_URL}/sch/search--searchType-1,start-${start}.dhtml`

    try {
      const result = await http.fetch(url, {
        cacheKey: `sch_list_start_${start}.html`,
        forceRefresh: force,
      })

      const mappings = parseSchList(result.html)
      if (mappings.length === 0) {
        logger.info('列表页分页结束：0 条记录', { page })
        break
      }

      // 去重
      const newMappings = mappings.filter((m) => !seenSchIds.has(m.schId))
      if (newMappings.length === 0) {
        logger.info('列表页分页结束：全部为重复记录', { page })
        break
      }

      for (const m of newMappings) {
        seenSchIds.add(m.schId)
        allMappings.push(m)
      }

      if (page % 20 === 0) {
        logger.info('列表页抓取进度', { page, total: allMappings.length })
      }

      // 不足 20 条说明是最后一页
      if (mappings.length < 20) {
        logger.info('列表页分页结束：不足 20 条', { page, count: mappings.length })
        break
      }

      // 限速：每页间隔 1 秒（非缓存时）
      if (!result.fromCache) {
        await sleep(requestInterval)
      }
    } catch (error) {
      logger.error('列表页抓取失败', { page, url, error: (error as Error).message })
      break
    }
  }

  // 缓存映射表到文件
  const mapPath = path.join(RAW_DIR, 'colleges', 'schid_map.json')
  fs.writeFileSync(mapPath, JSON.stringify(allMappings, null, 2), 'utf-8')
  logger.info('schId 映射表已缓存', { path: mapPath, count: allMappings.length })

  return allMappings
}

/**
 * 调用详情 API 获取官网和招生网。
 * 限速 QPS=2（每 500ms 一个请求）。
 */
async function fetchSchDetailWithLimit(
  http: HttpClient,
  schId: string,
  force: boolean
): Promise<SchDetail | null> {
  const url = `${GAOKAO_BASE_URL}/wap/sch/schinfo/${schId}`
  const requestInterval = 1000 / GAOKAO_QPS // 500ms

  try {
    const result = await http.fetch(url, {
      cacheKey: `sch_detail_${schId}.json`,
      forceRefresh: force,
    })

    const detail = parseSchDetail(result.html)

    // 限速：非缓存时间隔 500ms
    if (!result.fromCache) {
      await sleep(requestInterval)
    }

    return detail
  } catch (error) {
    logger.warn('详情 API 调用失败', { schId, error: (error as Error).message })
    return null
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始院校官网补齐', {
    force: args.force,
    listOnly: args.listOnly,
  })

  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // Step 1: 加载 colleges.json
  const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
  if (!fs.existsSync(collegesPath)) {
    logger.error('colleges.json 不存在', { path: collegesPath })
    process.exit(2)
  }

  const colleges: CollegeRecord[] = JSON.parse(fs.readFileSync(collegesPath, 'utf-8'))
  logger.info('colleges.json 加载完成', { count: colleges.length })

  // 按院校名建立索引
  const collegesByName = new Map<string, CollegeRecord>()
  for (const college of colleges) {
    collegesByName.set(college.name, college)
  }

  // Step 2: 抓取列表页建立 schId 映射
  const http = new HttpClient(path.join(RAW_DIR, 'colleges'))
  logger.info('Step 2: 抓取列表页建立 schId 映射')
  const mappings = await fetchSchIdMappings(http, args.force)
  logger.info('列表页映射完成', { total: mappings.length })

  if (args.listOnly) {
    logger.info('--list-only 模式，跳过详情 API 调用')
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    console.log(`\n[列表页映射完成] 共 ${mappings.length} 条映射，耗时 ${formatDuration(elapsed)}`)
    return
  }

  // Step 3: 匹配院校名
  logger.info('Step 3: 匹配院校名')
  const matchedPairs: Array<{ schId: string; college: CollegeRecord; matchType: string }> = []
  const unmatched: Array<{ schId: string; listName: string; reason: string }> = []

  for (const mapping of mappings) {
    const result = matchCollege(mapping.collegeName, collegesByName)
    if (result) {
      const college = collegesByName.get(result.collegeId)!
      matchedPairs.push({
        schId: mapping.schId,
        college,
        matchType: result.matchType,
      })
    } else {
      unmatched.push({
        schId: mapping.schId,
        listName: mapping.collegeName,
        reason: '未在 colleges.json 中找到匹配院校',
      })
    }
  }

  logger.info('院校名匹配完成', {
    matched: matchedPairs.length,
    unmatched: unmatched.length,
  })

  // Step 4: 调用详情 API 补齐官网
  logger.info('Step 4: 调用详情 API 补齐官网', { count: matchedPairs.length })

  const failed: Array<{ schId: string; collegeName: string; error: string }> = []
  const emptyWebsite: Array<{ schId: string; collegeName: string; detail: string }> = []
  let enriched = 0

  for (let i = 0; i < matchedPairs.length; i++) {
    const { schId, college } = matchedPairs[i]

    if ((i + 1) % 100 === 0) {
      logger.info('详情 API 进度', {
        current: i + 1,
        total: matchedPairs.length,
        enriched,
      })
    }

    const detail = await fetchSchDetailWithLimit(http, schId, args.force)

    if (detail === null) {
      failed.push({
        schId,
        collegeName: college.name,
        error: 'API 调用失败或响应解析失败',
      })
      continue
    }

    if (!detail.xxwz) {
      emptyWebsite.push({
        schId,
        collegeName: college.name,
        detail: 'API 返回 xxwz 为空',
      })
      // 仍尝试填充招生网
      if (detail.zswz) {
        college.admissionUrl = detail.zswz
      }
    } else {
      college.officialWebsite = detail.xxwz
      if (detail.zswz) {
        college.admissionUrl = detail.zswz
      }
      enriched++
    }

    // 更新溯源信息
    college._meta.fetchedAt = new Date().toISOString()
  }

  // Step 5: 写回 colleges.json
  logger.info('Step 5: 写回 colleges.json')
  fs.writeFileSync(collegesPath, JSON.stringify(colleges, null, 2), 'utf-8')
  logger.info('colleges.json 已更新', { path: collegesPath })

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'website_enrichment_failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (unmatched.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'website_enrichment_unmatched.json'),
      JSON.stringify(unmatched, null, 2),
      'utf-8'
    )
  }
  if (emptyWebsite.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'website_enrichment_empty.json'),
      JSON.stringify(emptyWebsite, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report: EnrichmentReport = {
    totalMappings: mappings.length,
    matched: matchedPairs.length,
    unmatched: unmatched.length,
    enriched,
    emptyWebsite: emptyWebsite.length,
    apiFailed: failed.length,
  }

  const reportText = [
    '[院校官网补齐报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `列表页映射:   ${report.totalMappings} 条`,
    `匹配成功:     ${report.matched} 条 (${pct(report.matched, report.totalMappings)})`,
    `匹配失败:     ${report.unmatched} 条 (unmatched.json)`,
    '------------------------------------------------------',
    `官网补齐:     ${report.enriched} 条 (${pct(report.enriched, report.matched)})`,
    `官网为空:     ${report.emptyWebsite} 条 (empty.json)`,
    `API 失败:     ${report.apiFailed} 条`,
    '------------------------------------------------------',
    `colleges.json 更新: ${report.matched} 条记录`,
    '======================================================',
  ].join('\n')

  console.log('\n' + reportText)

  const logPath = path.join(LOGS_DIR, `scrape-colleges-websites-${Date.now()}.log`)
  fs.writeFileSync(logPath, reportText, 'utf-8')

  if (failed.length > 0) {
    process.exit(1)
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

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

main().catch((error) => {
  logger.error('官网补齐流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
```

- [ ] **Step 2: 运行测试验证无回归**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/website_enricher.test.ts 2>&1 | tail -20`
Expected: PASS — 13 个用例全部通过（主流程函数不参与单元测试）

- [ ] **Step 3: 运行全部 colleges 测试验证无回归**

Run: `npx vitest run scripts/scrapers/colleges 2>&1 | tail -15`
Expected: PASS — 所有测试通过

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/colleges/website_enricher.ts
git commit -m "feat(colleges): 实现官网补齐主流程编排"
```

---

## Task 5: 新增 npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 package.json 的 scripts 中新增命令**

用 Read 工具读取 `package.json`，找到 `"scrape:colleges"` 这一行，在其后新增一行：

```json
    "scrape:colleges:websites": "tsx scripts/scrapers/colleges/website_enricher.ts",
```

例如，如果现有 scripts 是：
```json
  "scripts": {
    "scrape:colleges": "tsx scripts/scrapers/colleges/index.ts",
    "scrape:scores": "tsx scripts/scrapers/scores/index.ts",
    ...
  },
```

修改后应为：
```json
  "scripts": {
    "scrape:colleges": "tsx scripts/scrapers/colleges/index.ts",
    "scrape:colleges:websites": "tsx scripts/scrapers/colleges/website_enricher.ts",
    "scrape:scores": "tsx scripts/scrapers/scores/index.ts",
    ...
  },
```

- [ ] **Step 2: 验证脚本可执行（dry run，应立即报错退出因为参数解析）**

Run: `npm run scrape:colleges:websites -- --list-only 2>&1 | head -20`
Expected: 脚本启动，开始加载 colleges.json 和抓取列表页（可 Ctrl+C 中断）

- [ ] **Step 3: 提交**

```bash
git add package.json
git commit -m "feat(colleges): 新增 scrape:colleges:websites npm script"
```

---

## Task 6: 首次采集与验证

**Files:**
- 无代码修改，仅运行采集

- [ ] **Step 1: 运行官网补齐采集**

Run: `npm run scrape:colleges:websites 2>&1 | tail -40`

这是一个长时间运行的任务（约 27 分钟：148 页列表 + 约 2900 个 API 请求）。请耐心等待完成。

预期：控制台输出采集报告，显示匹配数、补齐数、失败数。

- [ ] **Step 2: 验证 colleges.json 中官网非空率**

Run: `node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('public/data/common/colleges.json','utf-8'));const nonEmpty=d.filter(c=>c.officialWebsite&&c.officialWebsite.length>0).length;console.log('总记录:',d.length);console.log('官网非空:',nonEmpty);console.log('非空率:',(nonEmpty/d.length*100).toFixed(1)+'%')" `
Expected: 非空率 > 90%

- [ ] **Step 3: 验证官网字段格式**

Run: `node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('public/data/common/colleges.json','utf-8'));const sample=d.filter(c=>c.officialWebsite).slice(0,5);for(const c of sample){console.log(c.name+': '+c.officialWebsite+' | 招生网: '+(c.admissionUrl||'无'))}" `
Expected: 5 条记录显示完整的官网 URL（以 https:// 开头）

- [ ] **Step 4: 验证溯源字段更新**

Run: `node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('public/data/common/colleges.json','utf-8'));const sample=d.find(c=>c.officialWebsite);console.log(JSON.stringify(sample,null,2))" `
Expected: 第一条有官网的记录，`_meta.fetchedAt` 已更新为今天的时间

- [ ] **Step 5: 检查报告文件**

Run: `ls -la public/data/common/reports/website_enrichment_*.json 2>/dev/null && echo '---' && for f in public/data/common/reports/website_enrichment_*.json; do echo "$f: $(node -e "console.log(JSON.parse(require('fs').readFileSync('$f','utf-8')).length)") 条"; done`
Expected: 显示各报告文件及记录数

- [ ] **Step 6: 提交采集结果**

```bash
git add public/data/common/colleges.json public/data/common/reports/
git commit -m "data: 补齐院校官网数据（officialWebsite + admissionUrl）"
```

---

## Task 7: 更新 colleges.meta.json

**Files:**
- Modify: `public/data/common/colleges.meta.json`

- [ ] **Step 1: 读取当前 meta 文件**

Run: `cat public/data/common/colleges.meta.json`
记录当前内容。

- [ ] **Step 2: 更新 meta 文件**

用 Read 工具读取 `public/data/common/colleges.meta.json`，然后更新以下字段：
- `generatedAt`: 更新为当前时间
- `sources` 数组：新增阳光高考官网数据源

更新后的 `sources` 数组应包含：
```json
"sources": [
  {
    "name": "教育部全国高等学校名单",
    "url": "https://hudong.moe.gov.cn/...",
    "fetchedAt": "（保持原值）",
    "recordCount": 2919
  },
  {
    "name": "阳光高考院校官网",
    "url": "https://gaokao.chsi.com.cn/",
    "fetchedAt": "（当前时间）",
    "recordCount": （官网非空的记录数）
  }
]
```

- [ ] **Step 3: 提交**

```bash
git add public/data/common/colleges.meta.json
git commit -m "data: 更新 colleges.meta.json 添加官网数据源"
```

---

## 自审检查

**1. Spec 覆盖检查：**
- ✅ §1 数据源：Task 1 fixture + Task 3 实现 parseSchList/parseSchDetail
- ✅ §2 采集流程 5 步：Task 4 主流程实现（加载→列表页→匹配→API→写回）
- ✅ §3 数据 Schema：复用现有 CollegeRecord，Task 3/4 更新 officialWebsite/admissionUrl
- ✅ §4 院校名匹配 3 级策略：Task 3 实现 normalizeName + matchCollege
- ✅ §5 错误处理与报告：Task 4 实现三类报告文件
- ✅ §5 缓存策略：Task 4 使用 HttpClient 的 cacheKey
- ✅ §5 CLI 接口：Task 4 实现 --force/--list-only，Task 5 新增 npm script
- ✅ §6 测试策略：Task 2 编写 13 个测试用例
- ✅ §7 实施顺序：Task 1-7 按依赖顺序
- ✅ §8 成功标准：Task 6 验证非空率 > 90%

**2. 占位符扫描：** 无 TBD/TODO，所有代码示例完整。

**3. 类型一致性：**
- `SchIdMapping` 在 Task 3 定义，Task 4 使用 ✓
- `SchDetail` 在 Task 3 定义，Task 4 使用 ✓
- `MatchResult` 在 Task 3 定义，Task 4 使用 ✓
- `parseSchList(html)` 在 Task 3 定义，Task 2 测试 + Task 4 调用 ✓
- `matchCollege(name, collegesByName)` 在 Task 3 定义，Task 2 测试 + Task 4 调用 ✓
- `parseSchDetail(jsonText)` 在 Task 3 定义，Task 2 测试 + Task 4 调用 ✓
- `normalizeName(name)` 在 Task 3 定义，Task 2 测试 + Task 3 内部使用 ✓
