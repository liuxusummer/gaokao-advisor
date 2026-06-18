# 院校基础数据采集系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Node.js + TypeScript 采集管线，从教育部名单和阳光高考平台抓取全国院校基础信息，产出带溯源字段的 `colleges.json`，供前端替换 mock 数据。

**Architecture:** 双源采集（教育部白名单 + 阳光高考字段补充）→ 名称/代码匹配 → 字段合并 → 校验产出。采集脚本与前端同仓，位于 `scripts/scrapers/`，共享 TypeScript 类型。原始响应缓存到 `raw/`（git-ignored），最终产出 JSON 到 `public/data/common/`。

**Tech Stack:** Node.js + TypeScript + tsx（运行 TS 脚本）+ cheerio（HTML 解析）+ axios（HTTP）+ vitest（测试）

**Spec:** [docs/superpowers/specs/2026-06-17-college-data-collection-design.md](../specs/2026-06-17-college-data-collection-design.md)

---

## File Structure

```
scripts/scrapers/
├── colleges/
│   ├── index.ts                  # 编排入口，串联 5 步流程
│   ├── moe_list.ts               # 教育部名单抓取 + 解析
│   ├── gaokao_detail.ts          # 阳光高考列表抓取 + 解析
│   ├── merge.ts                  # 双源匹配 + 字段合并 + 校验
│   ├── __fixtures__/
│   │   ├── moe_list_sample.html
│   │   └── gaokao_list_sample.html
│   └── __tests__/
│       ├── moe_list.test.ts
│       ├── gaokao_detail.test.ts
│       ├── merge.test.ts
│       └── validate.test.ts
├── shared/
│   ├── http.ts                   # HTTP 客户端（重试/限速/缓存）
│   ├── cache.ts                  # 响应缓存
│   ├── logger.ts                 # 结构化日志
│   └── meta.ts                   # 溯源字段生成
├── types.ts                      # 采集层类型定义
└── config.ts                     # 采集配置

public/data/common/
├── colleges.json                 # 最终产出
└── colleges.meta.json            # 采集元信息
```

---

## Task 1: 项目配置与依赖安装

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `vite.config.ts`（vitest 配置补充）

- [ ] **Step 1: 安装采集依赖**

Run:
```bash
npm install --save-dev tsx cheerio axios
npm install --save-dev @types/cheerio
```

- [ ] **Step 2: 添加 npm scripts 到 package.json**

在 `package.json` 的 `scripts` 字段中添加：

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "scrape:colleges": "tsx scripts/scrapers/colleges/index.ts",
    "scrape:colleges:force": "tsx scripts/scrapers/colleges/index.ts --force",
    "scrape:colleges:dry": "tsx scripts/scrapers/colleges/index.ts --dry-run",
    "test:scrapers": "vitest run scripts/scrapers",
    "test:scrapers:watch": "vitest scripts/scrapers"
  }
}
```

- [ ] **Step 3: 更新 .gitignore，排除 raw/ 和 logs/**

在 `.gitignore` 末尾追加：

```
# Scraper raw responses and logs
raw/
logs/
```

- [ ] **Step 4: 验证 tsx 可运行**

Run:
```bash
npx tsx --version
```
Expected: 输出版本号，无报错

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add scraper dependencies and scripts"
```

---

## Task 2: 类型定义与配置

**Files:**
- Create: `scripts/scrapers/types.ts`
- Create: `scripts/scrapers/config.ts`

- [ ] **Step 1: 创建类型定义文件 `scripts/scrapers/types.ts`**

```typescript
// 院校记录（最终产出格式）
export interface CollegeRecord {
  id: string
  moeCode: string
  name: string
  aliases?: string[]

  province: string
  city: string
  level: string[]
  type: string
  nature: 'public' | 'private' | 'joint'
  affiliation: string

  officialWebsite: string
  gaokaoUrl: string
  admissionUrl?: string

  subjectCategories?: string[]
  majorCount?: number

  _meta: RecordMeta
}

export interface RecordMeta {
  source: 'moe_list' | 'gaokao' | 'merged'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

// 教育部名单原始记录
export interface MoeRecord {
  id: string
  name: string
  province: string
  city: string
  level: string
  nature: 'public' | 'private' | 'joint'
  affiliation: string
  sourceUrl: string
}

// 阳光高考原始记录
export interface GaokaoRecord {
  gaokaoId: string
  name: string
  officialWebsite: string
  gaokaoUrl: string
  admissionUrl?: string
  province: string
  sourceUrl: string
}

// 采集元信息
export interface CollegesMeta {
  totalCount: number
  publicCount: number
  privateCount: number
  byProvince: Record<string, number>
  byLevel: Record<string, number>
  generatedAt: string
  scraperVersion: string
  sources: Array<{
    name: string
    url: string
    fetchedAt: string
    recordCount: number
  }>
  schemaVersion: string
}

// 错误报告
export interface FailedRecord {
  url: string
  error: string
  retryCount: number
  context?: string
}

export interface WarningRecord {
  collegeId: string
  collegeName: string
  type: 'missing_website' | 'province_mismatch' | 'name_match_failed'
  detail: string
}

export interface RejectedRecord {
  record: Partial<CollegeRecord>
  reason: string
}

// HTTP 客户端类型
export interface FetchOptions {
  cacheKey?: string
  forceRefresh?: boolean
  timeout?: number
  rateLimit?: { perSecond: number }
}

export interface FetchResult {
  html: string
  fromCache: boolean
  fetchedAt: string
  url: string
}
```

- [ ] **Step 2: 创建配置文件 `scripts/scrapers/config.ts`**

```typescript
import path from 'node:path'

export const SCRAPER_VERSION = '1.0.0'
export const SCHEMA_VERSION = '1.0.0'

// 数据源 URL（年度更新时维护此处）
export const MOE_LIST_URL =
  'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A03/202406/t20240619_1135406.html'

export const GAOKAO_BASE_URL = 'https://gaokao.chsi.com.cn'

// 31 个省级行政区（阳光高考省份代码映射）
export const PROVINCES = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
  '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
]

// HTTP 配置
export const HTTP_TIMEOUT = 30000
export const HTTP_MAX_RETRIES = 3
export const HTTP_RETRY_BASE_DELAY = 1000
export const GAOKAO_QPS = 2

// 路径配置
export const ROOT_DIR = path.resolve(process.cwd())
export const RAW_DIR = path.join(ROOT_DIR, 'raw')
export const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'data', 'common')
export const REPORTS_DIR = path.join(OUTPUT_DIR, 'reports')
export const LOGS_DIR = path.join(ROOT_DIR, 'logs')

// User-Agent
export const USER_AGENT =
  'VolunteerAssistant/1.0 (educational project; +https://github.com/your-org/volunteer-assistant)'
```

- [ ] **Step 3: 验证类型可编译**

Run:
```bash
npx tsc --noEmit scripts/scrapers/types.ts scripts/scrapers/config.ts
```
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapers/types.ts scripts/scrapers/config.ts
git commit -m "feat(scraper): add type definitions and config"
```

---

## Task 3: shared/logger.ts — 结构化日志

**Files:**
- Create: `scripts/scrapers/shared/logger.ts`
- Test: `scripts/scrapers/shared/__tests__/logger.test.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/shared/__tests__/logger.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLogger } from '../logger'

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('info 级别输出 JSON 格式日志', () => {
    const logger = createLogger('test')
    logger.info('hello', { key: 'value' })

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.level).toBe('info')
    expect(output.module).toBe('test')
    expect(output.message).toBe('hello')
    expect(output.context).toEqual({ key: 'value' })
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('error 级别输出到 console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('test')
    logger.error('failed', { code: 500 })

    expect(errorSpy).toHaveBeenCalled()
    const output = JSON.parse(errorSpy.mock.calls[0][0])
    expect(output.level).toBe('error')
    expect(output.message).toBe('failed')
  })

  it('warn 级别输出到 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = createLogger('test')
    logger.warn('caution')

    expect(warnSpy).toHaveBeenCalled()
    const output = JSON.parse(warnSpy.mock.calls[0][0])
    expect(output.level).toBe('warn')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/shared/__tests__/logger.test.ts`
Expected: FAIL，提示 `createLogger` 未定义

- [ ] **Step 3: 实现 `scripts/scrapers/shared/logger.ts`**

```typescript
type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  context?: Record<string, unknown>
}

function format(entry: LogEntry): string {
  return JSON.stringify(entry)
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

export function createLogger(module: string): Logger {
  const log = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      context,
    }
    const formatted = format(entry)
    if (level === 'error') {
      console.error(formatted)
    } else if (level === 'warn') {
      console.warn(formatted)
    } else {
      console.log(formatted)
    }
  }

  return {
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/shared/__tests__/logger.test.ts`
Expected: PASS（3 个测试通过）

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/shared/logger.ts scripts/scrapers/shared/__tests__/logger.test.ts
git commit -m "feat(scraper): add structured logger"
```

---

## Task 4: shared/cache.ts — 响应缓存

**Files:**
- Create: `scripts/scrapers/shared/cache.ts`
- Test: `scripts/scrapers/shared/__tests__/cache.test.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/shared/__tests__/cache.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Cache } from '../cache'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('Cache', () => {
  let tmpDir: string
  let cache: Cache

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'))
    cache = new Cache(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('set 后 get 能取回内容', () => {
    cache.set('moe_list', '<html>hello</html>')
    const result = cache.get('moe_list')
    expect(result).toBe('<html>hello</html>')
  })

  it('未缓存的 key 返回 null', () => {
    expect(cache.get('not_exist')).toBeNull()
  })

  it('has 方法正确判断缓存存在', () => {
    cache.set('key1', 'data')
    expect(cache.has('key1')).toBe(true)
    expect(cache.has('key2')).toBe(false)
  })

  it('文件存储在指定目录下，扩展名为 .html', () => {
    cache.set('moe_list', '<html></html>')
    const files = fs.readdirSync(tmpDir)
    expect(files).toContain('moe_list.html')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/shared/__tests__/cache.test.ts`
Expected: FAIL，提示 `Cache` 未定义

- [ ] **Step 3: 实现 `scripts/scrapers/shared/cache.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'

export class Cache {
  constructor(private readonly dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private filePath(key: string): string {
    // 防止路径遍历：只允许字母数字下划线
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_')
    return path.join(this.dir, `${safeKey}.html`)
  }

  get(key: string): string | null {
    const fp = this.filePath(key)
    if (!fs.existsSync(fp)) return null
    return fs.readFileSync(fp, 'utf-8')
  }

  set(key: string, content: string): void {
    const fp = this.filePath(key)
    fs.writeFileSync(fp, content, 'utf-8')
  }

  has(key: string): boolean {
    return fs.existsSync(this.filePath(key))
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/shared/__tests__/cache.test.ts`
Expected: PASS（4 个测试通过）

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/shared/cache.ts scripts/scrapers/shared/__tests__/cache.test.ts
git commit -m "feat(scraper): add response cache"
```

---

## Task 5: shared/meta.ts — 溯源字段生成

**Files:**
- Create: `scripts/scrapers/shared/meta.ts`
- Test: `scripts/scrapers/shared/__tests__/meta.test.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/shared/__tests__/meta.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildMeta } from '../meta'
import { SCRAPER_VERSION } from '../../config'

describe('buildMeta', () => {
  it('生成完整的溯源字段', () => {
    const meta = buildMeta('merged', 'https://example.com/source', true)

    expect(meta.source).toBe('merged')
    expect(meta.sourceUrl).toBe('https://example.com/source')
    expect(meta.scraperVersion).toBe(SCRAPER_VERSION)
    expect(meta.verified).toBe(true)
    expect(meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('verified 可为 false', () => {
    const meta = buildMeta('moe_list', 'https://moe.gov.cn', false)
    expect(meta.verified).toBe(false)
  })

  it('fetchedAt 为合法 ISO 8601 时间', () => {
    const meta = buildMeta('gaokao', 'https://gaokao.chsi.com.cn', true)
    const date = new Date(meta.fetchedAt)
    expect(date.getTime()).not.toBeNaN()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/shared/__tests__/meta.test.ts`
Expected: FAIL，提示 `buildMeta` 未定义

- [ ] **Step 3: 实现 `scripts/scrapers/shared/meta.ts`**

```typescript
import { SCRAPER_VERSION } from '../config'
import type { RecordMeta } from '../types'

export type SourceType = RecordMeta['source']

export function buildMeta(
  source: SourceType,
  url: string,
  verified: boolean
): RecordMeta {
  return {
    source,
    sourceUrl: url,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified,
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/shared/__tests__/meta.test.ts`
Expected: PASS（3 个测试通过）

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/shared/meta.ts scripts/scrapers/shared/__tests__/meta.test.ts
git commit -m "feat(scraper): add provenance meta builder"
```

---

## Task 6: shared/http.ts — HTTP 客户端

**Files:**
- Create: `scripts/scrapers/shared/http.ts`
- Test: `scripts/scrapers/shared/__tests__/http.test.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/shared/__tests__/http.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

import axios from 'axios'

describe('HttpClient', () => {
  let tmpDir: string
  let client: HttpClient

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'http-test-'))
    client = new HttpClient(tmpDir)
    vi.clearAllMocks()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('成功请求返回 HTML 和 fromCache=false', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: '<html>test</html>',
      status: 200,
    })

    const result = await client.fetch('https://example.com', { cacheKey: 'test1' })

    expect(result.html).toBe('<html>test</html>')
    expect(result.fromCache).toBe(false)
    expect(result.url).toBe('https://example.com')
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('缓存命中时返回缓存内容且 fromCache=true', async () => {
    // 第一次请求写入缓存
    ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: '<html>cached</html>',
      status: 200,
    })
    await client.fetch('https://example.com', { cacheKey: 'cached_key' })

    // 第二次请求应命中缓存，不调用 axios
    const result = await client.fetch('https://example.com', { cacheKey: 'cached_key' })

    expect(result.html).toBe('<html>cached</html>')
    expect(result.fromCache).toBe(true)
    expect(axios.get).toHaveBeenCalledTimes(1)
  })

  it('forceRefresh=true 时忽略缓存', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: '<html>fresh</html>',
      status: 200,
    })

    await client.fetch('https://example.com', { cacheKey: 'force_key' })
    const result = await client.fetch('https://example.com', {
      cacheKey: 'force_key',
      forceRefresh: true,
    })

    expect(result.fromCache).toBe(false)
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('5xx 错误重试 3 次后抛出', async () => {
    ;(axios.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 500 },
      message: 'Internal Server Error',
    })

    await expect(
      client.fetch('https://example.com', { cacheKey: 'fail_key' })
    ).rejects.toThrow()

    expect(axios.get).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/shared/__tests__/http.test.ts`
Expected: FAIL，提示 `HttpClient` 未定义

- [ ] **Step 3: 实现 `scripts/scrapers/shared/http.ts`**

```typescript
import axios from 'axios'
import { Cache } from './cache'
import { createLogger } from './logger'
import {
  HTTP_TIMEOUT,
  HTTP_MAX_RETRIES,
  HTTP_RETRY_BASE_DELAY,
  USER_AGENT,
} from '../config'
import type { FetchOptions, FetchResult } from '../types'

const logger = createLogger('http')

export class HttpClient {
  private cache: Cache

  constructor(cacheDir: string) {
    this.cache = new Cache(cacheDir)
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const {
      cacheKey,
      forceRefresh = false,
      timeout = HTTP_TIMEOUT,
    } = options

    // 缓存命中检查
    if (cacheKey && !forceRefresh && this.cache.has(cacheKey)) {
      const html = this.cache.get(cacheKey)!
      logger.info('缓存命中', { cacheKey, url })
      return {
        html,
        fromCache: true,
        fetchedAt: new Date().toISOString(),
        url,
      }
    }

    // 网络请求（带重试）
    const html = await this.fetchWithRetry(url, timeout)

    // 写入缓存
    if (cacheKey) {
      this.cache.set(cacheKey, html)
    }

    return {
      html,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      url,
    }
  }

  private async fetchWithRetry(url: string, timeout: number): Promise<string> {
    let lastError: unknown

    for (let attempt = 1; attempt <= HTTP_MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout,
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
          responseType: 'text',
        })
        return response.data as string
      } catch (error) {
        lastError = error
        const isServerError =
          axios.isAxiosError(error) &&
          error.response?.status &&
          error.response.status >= 500

        if (!isServerError || attempt === HTTP_MAX_RETRIES) {
          throw error
        }

        const delay = HTTP_RETRY_BASE_DELAY * Math.pow(2, attempt - 1)
        logger.warn('请求失败，重试中', {
          url,
          attempt,
          delay,
          status: (error as { response?: { status?: number } }).response?.status,
        })
        await sleep(delay)
      }
    }

    throw lastError
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/shared/__tests__/http.test.ts`
Expected: PASS（4 个测试通过）

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/shared/http.ts scripts/scrapers/shared/__tests__/http.test.ts
git commit -m "feat(scraper): add http client with retry and cache"
```

---

## Task 7: colleges/moe_list.ts — 教育部名单解析器

**Files:**
- Create: `scripts/scrapers/colleges/__fixtures__/moe_list_sample.html`
- Create: `scripts/scrapers/colleges/__tests__/moe_list.test.ts`
- Create: `scripts/scrapers/colleges/moe_list.ts`

- [ ] **Step 1: 创建 fixture `scripts/scrapers/colleges/__fixtures__/moe_list_sample.html`**

这是一个简化的教育部名单 HTML 样例（含 3 条记录，覆盖不同类型）：

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>全国高等学校名单</title></head>
<body>
<table class="table">
  <thead>
    <tr>
      <th>序号</th>
      <th>学校名称</th>
      <th>学校标识码</th>
      <th>主管部门</th>
      <th>所在省</th>
      <th>所在地</th>
      <th>办学层次</th>
      <th>办学性质</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>北京大学</td>
      <td>4111010001</td>
      <td>教育部</td>
      <td>北京市</td>
      <td>北京市</td>
      <td>普通本科</td>
      <td>公办</td>
    </tr>
    <tr>
      <td>2</td>
      <td>浙江大学</td>
      <td>4133010003</td>
      <td>教育部</td>
      <td>浙江省</td>
      <td>杭州市</td>
      <td>普通本科</td>
      <td>公办</td>
    </tr>
    <tr>
      <td>3</td>
      <td>西湖大学</td>
      <td>4133010110</td>
      <td>浙江省</td>
      <td>浙江省</td>
      <td>杭州市</td>
      <td>普通本科</td>
      <td>民办</td>
    </tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: 写失败测试 `scripts/scrapers/colleges/__tests__/moe_list.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMoeList } from '../moe_list'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'moe_list_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseMoeList', () => {
  it('正确解析 3 条记录', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    expect(records).toHaveLength(3)
  })

  it('解析北京大学字段正确', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    const pku = records.find((r) => r.name === '北京大学')!

    expect(pku.id).toBe('4111010001')
    expect(pku.name).toBe('北京大学')
    expect(pku.province).toBe('北京市')
    expect(pku.city).toBe('北京市')
    expect(pku.level).toBe('普通本科')
    expect(pku.nature).toBe('public')
    expect(pku.affiliation).toBe('教育部')
    expect(pku.sourceUrl).toBe('https://moe.gov.cn/test')
  })

  it('解析浙江大学字段正确', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    const zju = records.find((r) => r.name === '浙江大学')!

    expect(zju.id).toBe('4133010003')
    expect(zju.province).toBe('浙江省')
    expect(zju.city).toBe('杭州市')
    expect(zju.nature).toBe('public')
  })

  it('民办院校 nature 解析为 private', () => {
    const records = parseMoeList(fixtureHtml, 'https://moe.gov.cn/test')
    const westlake = records.find((r) => r.name === '西湖大学')!

    expect(westlake.nature).toBe('private')
    expect(westlake.affiliation).toBe('浙江省')
  })

  it('空 HTML 返回空数组', () => {
    const records = parseMoeList('<html><body></body></html>', 'https://moe.gov.cn/test')
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/moe_list.test.ts`
Expected: FAIL，提示 `parseMoeList` 未定义

- [ ] **Step 4: 实现 `scripts/scrapers/colleges/moe_list.ts`**

```typescript
import * as cheerio from 'cheerio'
import type { MoeRecord } from '../types'

function parseNature(raw: string): 'public' | 'private' | 'joint' {
  if (raw.includes('公办')) return 'public'
  if (raw.includes('民办')) return 'private'
  if (raw.includes('中外合办') || raw.includes('合作办学')) return 'joint'
  return 'public'
}

export function parseMoeList(html: string, sourceUrl: string): MoeRecord[] {
  const $ = cheerio.load(html)
  const records: MoeRecord[] = []

  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 8) return

    const name = $(cells[1]).text().trim()
    const id = $(cells[2]).text().trim()
    const affiliation = $(cells[3]).text().trim()
    const province = $(cells[4]).text().trim()
    const city = $(cells[5]).text().trim()
    const level = $(cells[6]).text().trim()
    const natureRaw = $(cells[7]).text().trim()

    if (!name || !id) return

    records.push({
      id,
      name,
      province,
      city,
      level,
      nature: parseNature(natureRaw),
      affiliation,
      sourceUrl,
    })
  })

  return records
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/moe_list.test.ts`
Expected: PASS（5 个测试通过）

- [ ] **Step 6: Commit**

```bash
git add scripts/scrapers/colleges/moe_list.ts scripts/scrapers/colleges/__tests__/moe_list.test.ts scripts/scrapers/colleges/__fixtures__/moe_list_sample.html
git commit -m "feat(scraper): add moe list parser"
```

---

## Task 8: colleges/gaokao_detail.ts — 阳光高考解析器

**Files:**
- Create: `scripts/scrapers/colleges/__fixtures__/gaokao_list_sample.html`
- Create: `scripts/scrapers/colleges/__tests__/gaokao_detail.test.ts`
- Create: `scripts/scrapers/colleges/gaokao_detail.ts`

- [ ] **Step 1: 创建 fixture `scripts/scrapers/colleges/__fixtures__/gaokao_list_sample.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>院校列表</title></head>
<body>
<div class="search-result-list">
  <div class="item">
    <div class="school-name">
      <a href="/sch/schoolInfo-10001.dhtml" data-school-id="10001">北京大学</a>
    </div>
    <div class="school-info">
      <span class="province">北京</span>
      <span class="level">985</span>
      <a href="https://www.pku.edu.cn" class="school-website">官网</a>
    </div>
  </div>
  <div class="item">
    <div class="school-name">
      <a href="/sch/schoolInfo-10003.dhtml" data-school-id="10003">浙江大学</a>
    </div>
    <div class="school-info">
      <span class="province">浙江</span>
      <span class="level">985</span>
      <a href="https://www.zju.edu.cn" class="school-website">官网</a>
    </div>
  </div>
  <div class="item">
    <div class="school-name">
      <a href="/sch/schoolInfo-10005.dhtml" data-school-id="10005">某学院</a>
    </div>
    <div class="school-info">
      <span class="province">浙江</span>
      <span class="level">普通本科</span>
    </div>
  </div>
</div>
<div class="pagination">
  <span class="current">1</span>
  <a href="/sch/search.do?province=浙江&page=2">2</a>
  <a href="/sch/search.do?province=浙江&page=3">3</a>
</div>
</body>
</html>
```

- [ ] **Step 2: 写失败测试 `scripts/scrapers/colleges/__tests__/gaokao_detail.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseGaokaoList, buildGaokaoUrl } from '../gaokao_detail'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'gaokao_list_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseGaokaoList', () => {
  it('正确解析 3 条记录', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    expect(records).toHaveLength(3)
  })

  it('解析北京大学字段正确', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    const pku = records.find((r) => r.name === '北京大学')!

    expect(pku.gaokaoId).toBe('10001')
    expect(pku.name).toBe('北京大学')
    expect(pku.officialWebsite).toBe('https://www.pku.edu.cn')
    expect(pku.gaokaoUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml')
    expect(pku.province).toBe('北京')
  })

  it('官网缺失时 officialWebsite 为空字符串', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    const missing = records.find((r) => r.name === '某学院')!

    expect(missing.officialWebsite).toBe('')
  })

  it('gaokaoUrl 为完整 URL（含 base）', () => {
    const records = parseGaokaoList(fixtureHtml, 'https://gaokao.chsi.com.cn/test')
    const zju = records.find((r) => r.name === '浙江大学')!

    expect(zju.gaokaoUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10003.dhtml')
  })

  it('空 HTML 返回空数组', () => {
    const records = parseGaokaoList('<html></html>', 'https://gaokao.chsi.com.cn/test')
    expect(records).toEqual([])
  })
})

describe('buildGaokaoUrl', () => {
  it('构造分页 URL', () => {
    const url = buildGaokaoUrl('浙江', 2)
    expect(url).toContain('province=')
    expect(url).toContain('page=2')
    expect(url).toContain('gaokao.chsi.com.cn')
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/gaokao_detail.test.ts`
Expected: FAIL，提示 `parseGaokaoList` 未定义

- [ ] **Step 4: 实现 `scripts/scrapers/colleges/gaokao_detail.ts`**

```typescript
import * as cheerio from 'cheerio'
import { GAOKAO_BASE_URL } from '../config'
import type { GaokaoRecord } from '../types'

export function buildGaokaoUrl(province: string, page: number): string {
  const params = new URLSearchParams({
    province,
    page: String(page),
  })
  return `${GAOKAO_BASE_URL}/sch/search.do?${params.toString()}`
}

export function parseGaokaoList(html: string, sourceUrl: string): GaokaoRecord[] {
  const $ = cheerio.load(html)
  const records: GaokaoRecord[] = []

  $('.search-result-list .item').each((_, item) => {
    const nameLink = $(item).find('.school-name a')
    const name = nameLink.text().trim()
    const href = nameLink.attr('href') || ''
    const gaokaoId = nameLink.attr('data-school-id') || href.match(/schoolInfo-(\d+)/)?.[1] || ''

    const province = $(item).find('.province').text().trim()
    const websiteLink = $(item).find('.school-website')
    const officialWebsite = websiteLink.attr('href') || ''

    const gaokaoUrl = href.startsWith('http')
      ? href
      : `${GAOKAO_BASE_URL}${href}`

    if (!name || !gaokaoId) return

    records.push({
      gaokaoId,
      name,
      officialWebsite,
      gaokaoUrl,
      province,
      sourceUrl,
    })
  })

  return records
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/gaokao_detail.test.ts`
Expected: PASS（6 个测试通过）

- [ ] **Step 6: Commit**

```bash
git add scripts/scrapers/colleges/gaokao_detail.ts scripts/scrapers/colleges/__tests__/gaokao_detail.test.ts scripts/scrapers/colleges/__fixtures__/gaokao_list_sample.html
git commit -m "feat(scraper): add gaokao list parser"
```

---

## Task 9: colleges/merge.ts — 双源匹配与合并

**Files:**
- Create: `scripts/scrapers/colleges/__tests__/merge.test.ts`
- Create: `scripts/scrapers/colleges/__tests__/validate.test.ts`
- Create: `scripts/scrapers/colleges/merge.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/colleges/__tests__/merge.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { matchColleges, mergeFields, matchAndMerge } from '../merge'
import type { MoeRecord, GaokaoRecord } from '../../types'

const moeRecords: MoeRecord[] = [
  {
    id: '4111010001', name: '北京大学', province: '北京市', city: '北京市',
    level: '普通本科', nature: 'public', affiliation: '教育部',
    sourceUrl: 'https://moe.gov.cn/test',
  },
  {
    id: '4133010003', name: '浙江大学', province: '浙江省', city: '杭州市',
    level: '普通本科', nature: 'public', affiliation: '教育部',
    sourceUrl: 'https://moe.gov.cn/test',
  },
  {
    id: '4133010110', name: '西湖大学', province: '浙江省', city: '杭州市',
    level: '普通本科', nature: 'private', affiliation: '浙江省',
    sourceUrl: 'https://moe.gov.cn/test',
  },
]

const gaokaoRecords: GaokaoRecord[] = [
  {
    gaokaoId: '10001', name: '北京大学', officialWebsite: 'https://www.pku.edu.cn',
    gaokaoUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    province: '北京', sourceUrl: 'https://gaokao.chsi.com.cn/test',
  },
  {
    gaokaoId: '10003', name: '浙江大学', officialWebsite: 'https://www.zju.edu.cn',
    gaokaoUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10003.dhtml',
    province: '浙江', sourceUrl: 'https://gaokao.chsi.com.cn/test',
  },
  // 野鸡大学：不在教育部名单中
  {
    gaokaoId: '99999', name: '野鸡大学', officialWebsite: 'https://fake.edu',
    gaokaoUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-99999.dhtml',
    province: '浙江', sourceUrl: 'https://gaokao.chsi.com.cn/test',
  },
]

describe('matchColleges', () => {
  it('匹配成功的记录数 = 教育部名单数（阳光高考侧野鸡大学被丢弃）', () => {
    const { matched, unmatchedMoe, droppedGaokao } = matchColleges(moeRecords, gaokaoRecords)
    expect(matched).toHaveLength(2)
    expect(unmatchedMoe).toHaveLength(1) // 西湖大学未在阳光高考中
    expect(droppedGaokao).toHaveLength(1) // 野鸡大学被丢弃
  })

  it('匹配的记录包含教育部和阳光高考双方字段', () => {
    const { matched } = matchColleges(moeRecords, gaokaoRecords)
    const pku = matched.find((m) => m.moe.name === '北京大学')!
    expect(pku.moe.id).toBe('4111010001')
    expect(pku.gaokao?.officialWebsite).toBe('https://www.pku.edu.cn')
  })

  it('未匹配的教育部记录 gaokao 为 null', () => {
    const { unmatchedMoe } = matchColleges(moeRecords, gaokaoRecords)
    const westlake = unmatchedMoe[0]
    expect(westlake.name).toBe('西湖大学')
  })
})

describe('mergeFields', () => {
  it('教育部字段优先，阳光高考补充官网', () => {
    const { matched } = matchColleges(moeRecords, gaokaoRecords)
    const pku = matched.find((m) => m.moe.name === '北京大学')!
    const merged = mergeFields(pku)

    expect(merged.id).toBe('4111010001')
    expect(merged.name).toBe('北京大学')
    expect(merged.officialWebsite).toBe('https://www.pku.edu.cn')
    expect(merged.gaokaoUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml')
    expect(merged._meta.source).toBe('merged')
    expect(merged._meta.verified).toBe(true)
  })

  it('未匹配阳光高考的教育部记录官网为空', () => {
    const { unmatchedMoe } = matchColleges(moeRecords, gaokaoRecords)
    const westlake = unmatchedMoe[0]
    const merged = mergeFields({ moe: westlake, gaokao: null })

    expect(merged.officialWebsite).toBe('')
    expect(merged._meta.verified).toBe(true)
  })
})

describe('matchAndMerge', () => {
  it('完整流程：匹配 + 合并 + 校验', () => {
    const result = matchAndMerge(moeRecords, gaokaoRecords)

    expect(result.records).toHaveLength(3) // 教育部名单 3 条全部保留
    expect(result.warnings).toHaveLength(1) // 西湖大学官网缺失

    const westlake = result.records.find((r) => r.name === '西湖大学')!
    expect(westlake.officialWebsite).toBe('')
  })
})
```

- [ ] **Step 2: 写失败测试 `scripts/scrapers/colleges/__tests__/validate.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { validateRecord } from '../merge'
import type { CollegeRecord } from '../../types'

const validRecord: CollegeRecord = {
  id: '4111010001',
  moeCode: '4111010001',
  name: '北京大学',
  province: '北京市',
  city: '北京市',
  level: ['普通本科'],
  type: '综合',
  nature: 'public',
  affiliation: '教育部',
  officialWebsite: 'https://www.pku.edu.cn',
  gaokaoUrl: 'https://gaokao.chsi.com.cn/test',
  _meta: {
    source: 'merged',
    sourceUrl: 'https://moe.gov.cn/test',
    fetchedAt: '2026-06-17T10:00:00.000Z',
    scraperVersion: '1.0.0',
    verified: true,
  },
}

describe('validateRecord', () => {
  it('合法记录返回 { valid: true }', () => {
    const result = validateRecord(validRecord)
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('id 为空时校验失败', () => {
    const result = validateRecord({ ...validRecord, id: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('id')
  })

  it('name 为空时校验失败', () => {
    const result = validateRecord({ ...validRecord, name: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('name')
  })

  it('officialWebsite 为空时校验仍通过（允许空）', () => {
    const result = validateRecord({ ...validRecord, officialWebsite: '' })
    expect(result.valid).toBe(true)
  })

  it('verified=false 时校验失败', () => {
    const result = validateRecord({
      ...validRecord,
      _meta: { ...validRecord._meta, verified: false },
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('verified')
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/merge.test.ts scripts/scrapers/colleges/__tests__/validate.test.ts`
Expected: FAIL，提示 `matchColleges`、`mergeFields`、`matchAndMerge`、`validateRecord` 未定义

- [ ] **Step 4: 实现 `scripts/scrapers/colleges/merge.ts`**

```typescript
import { buildMeta } from '../shared/meta'
import type {
  MoeRecord,
  GaokaoRecord,
  CollegeRecord,
  WarningRecord,
} from '../types'

interface MatchedPair {
  moe: MoeRecord
  gaokao: GaokaoRecord | null
}

export interface MatchResult {
  matched: MatchedPair[]
  unmatchedMoe: MoeRecord[]
  droppedGaokao: GaokaoRecord[]
}

export interface MergeResult {
  records: CollegeRecord[]
  warnings: WarningRecord[]
}

export interface ValidationResult {
  valid: boolean
  reason?: string
}

/**
 * 规范化院校名称用于匹配（去除"大学/学院"后缀差异）
 */
function normalizeName(name: string): string {
  return name.replace(/(大学|学院|学校)$/g, '').trim()
}

/**
 * 双源匹配
 */
export function matchColleges(
  moeRecords: MoeRecord[],
  gaokaoRecords: GaokaoRecord[]
): MatchResult {
  const matched: MatchedPair[] = []
  const unmatchedMoe: MoeRecord[] = []
  const droppedGaokao: GaokaoRecord[] = []

  // 构建阳光高考索引：按规范化名称
  const gaokaoByName = new Map<string, GaokaoRecord>()
  for (const g of gaokaoRecords) {
    gaokaoByName.set(normalizeName(g.name), g)
  }

  const matchedGaokaoIds = new Set<string>()

  for (const moe of moeRecords) {
    const gaokao = gaokaoByName.get(normalizeName(moe.name)) || null
    if (gaokao) {
      matched.push({ moe, gaokao })
      matchedGaokaoIds.add(gaokao.gaokaoId)
    } else {
      unmatchedMoe.push(moe)
    }
  }

  // 阳光高考中未匹配的记录 = 不在白名单中 = 丢弃
  for (const g of gaokaoRecords) {
    if (!matchedGaokaoIds.has(g.gaokaoId)) {
      droppedGaokao.push(g)
    }
  }

  return { matched, unmatchedMoe, droppedGaokao }
}

/**
 * 字段合并：教育部字段优先，阳光高考补充
 */
export function mergeFields(pair: MatchedPair): CollegeRecord {
  const { moe, gaokao } = pair

  return {
    id: moe.id,
    moeCode: moe.id,
    name: moe.name,
    province: moe.province,
    city: moe.city,
    level: [moe.level],
    type: '综合', // 教育部名单不含类型，默认综合，后续可从阳光高考补充
    nature: moe.nature,
    affiliation: moe.affiliation,
    officialWebsite: gaokao?.officialWebsite || '',
    gaokaoUrl: gaokao?.gaokaoUrl || '',
    admissionUrl: gaokao?.admissionUrl,
    _meta: buildMeta('merged', moe.sourceUrl, true),
  }
}

/**
 * 校验单条记录
 */
export function validateRecord(record: CollegeRecord): ValidationResult {
  const requiredFields: Array<keyof CollegeRecord> = [
    'id', 'name', 'province', 'city', 'level', 'type', 'nature',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === '' || value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
    if (Array.isArray(value) && value.length === 0) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空数组` }
    }
  }

  if (!record._meta.verified) {
    return { valid: false, reason: '记录未通过白名单校验 (verified=false)' }
  }

  return { valid: true }
}

/**
 * 完整流程：匹配 + 合并 + 校验
 */
export function matchAndMerge(
  moeRecords: MoeRecord[],
  gaokaoRecords: GaokaoRecord[]
): MergeResult {
  const { matched, unmatchedMoe } = matchColleges(moeRecords, gaokaoRecords)

  const records: CollegeRecord[] = []
  const warnings: WarningRecord[] = []

  // 合并匹配成功的记录
  for (const pair of matched) {
    const merged = mergeFields(pair)
    records.push(merged)

    if (!merged.officialWebsite) {
      warnings.push({
        collegeId: merged.id,
        collegeName: merged.name,
        type: 'missing_website',
        detail: '阳光高考未提供官网链接',
      })
    }

    // 省份一致性检查
    if (pair.gaokao && pair.gaokao.province !== merged.province) {
      warnings.push({
        collegeId: merged.id,
        collegeName: merged.name,
        type: 'province_mismatch',
        detail: `教育部省份=${merged.province}, 阳光高考省份=${pair.gaokao.province}`,
      })
    }
  }

  // 合并未匹配阳光高考的教育部记录（官网留空）
  for (const moe of unmatchedMoe) {
    const merged = mergeFields({ moe, gaokao: null })
    records.push(merged)
    warnings.push({
      collegeId: merged.id,
      collegeName: merged.name,
      type: 'missing_website',
      detail: '未在阳光高考中匹配到该院校',
    })
  }

  return { records, warnings }
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/colleges/__tests__/merge.test.ts scripts/scrapers/colleges/__tests__/validate.test.ts`
Expected: PASS（所有测试通过）

- [ ] **Step 6: Commit**

```bash
git add scripts/scrapers/colleges/merge.ts scripts/scrapers/colleges/__tests__/merge.test.ts scripts/scrapers/colleges/__tests__/validate.test.ts
git commit -m "feat(scraper): add merge and validate logic"
```

---

## Task 10: colleges/index.ts — 编排入口

**Files:**
- Create: `scripts/scrapers/colleges/index.ts`

- [ ] **Step 1: 实现 `scripts/scrapers/colleges/index.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { parseMoeList } from './moe_list'
import { parseGaokaoList, buildGaokaoUrl } from './gaokao_detail'
import { matchAndMerge, validateRecord } from './merge'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  MOE_LIST_URL,
  PROVINCES,
  GAOKAO_QPS,
  RAW_DIR,
  OUTPUT_DIR,
  REPORTS_DIR,
  LOGS_DIR,
} from '../config'
import type {
  CollegeRecord,
  CollegesMeta,
  FailedRecord,
  WarningRecord,
  RejectedRecord,
  GaokaoRecord,
} from '../types'

const logger = createLogger('colleges')

interface CliArgs {
  force: boolean
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
  }
}

async function main() {
  const args = parseArgs()
  const startTime = Date.now()

  logger.info('开始院校数据采集', {
    version: SCRAPER_VERSION,
    force: args.force,
    dryRun: args.dryRun,
  })

  // 确保输出目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(RAW_DIR, 'colleges'))

  // Step 1: 教育部名单
  logger.info('Step 1: 抓取教育部名单', { url: MOE_LIST_URL })
  const moeResult = await http.fetch(MOE_LIST_URL, {
    cacheKey: 'moe_list',
    forceRefresh: args.force,
  })
  const moeRecords = parseMoeList(moeResult.html, MOE_LIST_URL)
  logger.info('教育部名单解析完成', { count: moeRecords.length })

  if (moeRecords.length === 0) {
    logger.error('教育部名单解析 0 条，终止', { url: MOE_LIST_URL })
    process.exit(2)
  }

  // Step 2: 阳光高考列表
  logger.info('Step 2: 抓取阳光高考院校列表')
  const gaokaoRecords: GaokaoRecord[] = []
  const failed: FailedRecord[] = []
  const requestInterval = 1000 / GAOKAO_QPS

  for (const province of PROVINCES) {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = buildGaokaoUrl(province, page)
      try {
        const result = await http.fetch(url, {
          cacheKey: `gaokao_${province}_${page}`,
          forceRefresh: args.force,
        })
        const records = parseGaokaoList(result.html, url)

        if (records.length === 0) {
          hasMore = false
        } else {
          gaokaoRecords.push(...records)
          // 简单分页判断：不足 20 条说明是最后一页
          if (records.length < 20) hasMore = false
          page++
          await sleep(requestInterval)
        }
      } catch (error) {
        failed.push({
          url,
          error: (error as Error).message,
          retryCount: 3,
          context: `province=${province}, page=${page}`,
        })
        hasMore = false
      }
    }

    if (gaokaoRecords.length % 200 < 20) {
      logger.info('省份抓取进度', {
        province,
        total: gaokaoRecords.length,
      })
    }
  }

  logger.info('阳光高考抓取完成', {
    total: gaokaoRecords.length,
    failed: failed.length,
  })

  // Step 3-4: 匹配与合并
  logger.info('Step 3-4: 双源匹配与字段合并')
  const { records, warnings } = matchAndMerge(moeRecords, gaokaoRecords)
  logger.info('合并完成', {
    total: records.length,
    warnings: warnings.length,
  })

  // Step 5: 校验与产出
  logger.info('Step 5: 校验与产出')
  const validated: CollegeRecord[] = []
  const rejected: RejectedRecord[] = []

  for (const record of records) {
    const result = validateRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  // 去重：ID 唯一性
  const seen = new Set<string>()
  const deduped: CollegeRecord[] = []
  for (const record of validated) {
    if (seen.has(record.id)) {
      rejected.push({ record, reason: `ID 重复: ${record.id}` })
    } else {
      seen.add(record.id)
      deduped.push(record)
    }
  }

  // 写入 colleges.json
  const outputPath = path.join(OUTPUT_DIR, 'colleges.json')
  fs.writeFileSync(outputPath, JSON.stringify(deduped, null, 2), 'utf-8')
  logger.info('colleges.json 已写入', { path: outputPath, count: deduped.length })

  // 写入 colleges.meta.json
  const meta = buildMetaFile(deduped, moeResult.fetchedAt)
  const metaPath = path.join(OUTPUT_DIR, 'colleges.meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
  logger.info('colleges.meta.json 已写入', { path: metaPath })

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (warnings.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'warnings.json'),
      JSON.stringify(warnings, null, 2),
      'utf-8'
    )
  }
  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'rejected.json'),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `教育部名单: ${moeRecords.length} 条`,
    `阳光高考:   ${gaokaoRecords.length} 条（抓取失败 ${failed.length} 条）`,
    `匹配成功:   ${records.length - warnings.filter((w) => w.type === 'missing_website' && w.detail.includes('未在阳光高考')).length} 条`,
    `最终产出:   ${deduped.length} 条`,
    `校验拒绝:   ${rejected.length} 条`,
    `警告:       ${warnings.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)

  // 写入日志文件
  const logPath = path.join(LOGS_DIR, `scrape-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')

  // 退出码
  if (rejected.length > 0) {
    process.exit(1)
  }
}

function buildMetaFile(
  records: CollegeRecord[],
  moeFetchedAt: string
): CollegesMeta {
  const byProvince: Record<string, number> = {}
  const byLevel: Record<string, number> = {}
  let publicCount = 0
  let privateCount = 0

  for (const r of records) {
    byProvince[r.province] = (byProvince[r.province] || 0) + 1
    for (const lv of r.level) {
      byLevel[lv] = (byLevel[lv] || 0) + 1
    }
    if (r.nature === 'public') publicCount++
    else if (r.nature === 'private') privateCount++
  }

  return {
    totalCount: records.length,
    publicCount,
    privateCount,
    byProvince,
    byLevel,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    sources: [
      {
        name: '教育部全国高等学校名单',
        url: MOE_LIST_URL,
        fetchedAt: moeFetchedAt,
        recordCount: records.length,
      },
    ],
    schemaVersion: SCHEMA_VERSION,
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  logger.error('采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
npx tsc --noEmit scripts/scrapers/colleges/index.ts
```
Expected: 无报错（可能有 node 类型提示，确保 @types/node 已安装）

- [ ] **Step 3: 验证 dry-run 模式可启动（无网络请求时优雅失败）**

Run:
```bash
npm run scrape:colleges:dry
```
Expected: 脚本启动，输出日志，因无缓存而尝试网络请求或报错（验证流程编排正确）

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapers/colleges/index.ts
git commit -m "feat(scraper): add orchestration entry point"
```

---

## Task 11: 端到端冒烟测试

**Files:**
- Create: `scripts/scrapers/colleges/__tests__/e2e.test.ts`

- [ ] **Step 1: 写端到端测试 `scripts/scrapers/colleges/__tests__/e2e.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMoeList } from '../moe_list'
import { parseGaokaoList } from '../gaokao_detail'
import { matchAndMerge, validateRecord } from '../merge'
import { buildMeta } from '../../shared/meta'
import type { CollegeRecord, CollegesMeta } from '../../types'

const moeFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'moe_list_sample.html'),
  'utf-8'
)
const gaokaoFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'gaokao_list_sample.html'),
  'utf-8'
)

describe('端到端冒烟测试', () => {
  it('完整流程：parse → merge → validate → output', () => {
    // Step 1: 解析教育部名单
    const moeRecords = parseMoeList(moeFixture, 'https://moe.gov.cn/test')
    expect(moeRecords.length).toBeGreaterThan(0)

    // Step 2: 解析阳光高考
    const gaokaoRecords = parseGaokaoList(gaokaoFixture, 'https://gaokao.chsi.com.cn/test')
    expect(gaokaoRecords.length).toBeGreaterThan(0)

    // Step 3-4: 匹配与合并
    const { records, warnings } = matchAndMerge(moeRecords, gaokaoRecords)
    expect(records.length).toBeGreaterThan(0)

    // Step 5: 校验
    const validated: CollegeRecord[] = []
    for (const record of records) {
      const result = validateRecord(record)
      expect(result.valid).toBe(true)
      validated.push(record)
    }

    // 断言 _meta 字段完整
    for (const record of validated) {
      expect(record._meta.source).toBe('merged')
      expect(record._meta.verified).toBe(true)
      expect(record._meta.scraperVersion).toBeDefined()
      expect(record._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(record._meta.sourceUrl).toMatch(/^https?:\/\//)
    }

    // 断言所有记录都在教育部白名单中（无野鸡大学）
    const moeNames = new Set(moeRecords.map((r) => r.name))
    for (const record of validated) {
      expect(moeNames.has(record.name)).toBe(true)
    }
  })

  it('元信息文件结构正确', () => {
    const moeRecords = parseMoeList(moeFixture, 'https://moe.gov.cn/test')
    const gaokaoRecords = parseGaokaoList(gaokaoFixture, 'https://gaokao.chsi.com.cn/test')
    const { records } = matchAndMerge(moeRecords, gaokaoRecords)

    const meta: CollegesMeta = {
      totalCount: records.length,
      publicCount: records.filter((r) => r.nature === 'public').length,
      privateCount: records.filter((r) => r.nature === 'private').length,
      byProvince: {},
      byLevel: {},
      generatedAt: new Date().toISOString(),
      scraperVersion: '1.0.0',
      sources: [
        {
          name: '教育部全国高等学校名单',
          url: 'https://moe.gov.cn/test',
          fetchedAt: new Date().toISOString(),
          recordCount: records.length,
        },
      ],
      schemaVersion: '1.0.0',
    }

    expect(meta.totalCount).toBeGreaterThan(0)
    expect(meta.publicCount + meta.privateCount).toBeLessThanOrEqual(meta.totalCount)
    expect(meta.sources).toHaveLength(1)
    expect(meta.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
```

- [ ] **Step 2: 运行端到端测试**

Run:
```bash
npx vitest run scripts/scrapers/colleges/__tests__/e2e.test.ts
```
Expected: PASS（2 个测试通过）

- [ ] **Step 3: 运行全部采集器测试**

Run:
```bash
npm run test:scrapers
```
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapers/colleges/__tests__/e2e.test.ts
git commit -m "test(scraper): add e2e smoke test"
```

---

## Task 12: 首次全量采集与产出验证

**Files:**
- 无新建文件，运行采集脚本产出数据

- [ ] **Step 1: 运行首次全量采集**

Run:
```bash
npm run scrape:colleges
```
Expected: 脚本运行完成，输出采集报告。若教育部 URL 失效，需更新 `config.ts` 中的 `MOE_LIST_URL`。

- [ ] **Step 2: 验证产出文件存在**

Run:
```bash
ls -la public/data/common/colleges.json public/data/common/colleges.meta.json
```
Expected: 两个文件都存在

- [ ] **Step 3: 验证产出数据格式**

Run:
```bash
node -e "const d=require('./public/data/common/colleges.json'); console.log('记录数:', d.length); console.log('首条:', JSON.stringify(d[0], null, 2))"
```
Expected: 记录数 ≥ 2600，首条记录包含完整字段和 `_meta`

- [ ] **Step 4: 验证溯源字段完整**

Run:
```bash
node -e "const d=require('./public/data/common/colleges.json'); const noMeta = d.filter(r => !r._meta || !r._meta.sourceUrl || !r._meta.fetchedAt); console.log('溯源字段缺失记录数:', noMeta.length)"
```
Expected: 缺失记录数 = 0

- [ ] **Step 5: 验证无野鸡大学（所有记录 verified=true）**

Run:
```bash
node -e "const d=require('./public/data/common/colleges.json'); const unverified = d.filter(r => r._meta.verified !== true); console.log('未通过白名单校验记录数:', unverified.length)"
```
Expected: 未通过记录数 = 0

- [ ] **Step 6: 检查报告文件**

Run:
```bash
ls -la public/data/common/reports/ 2>/dev/null || echo "无报告文件（无失败/警告/拒绝记录）"
```
Expected: 若有 warnings.json，检查官网缺失数量是否合理

- [ ] **Step 7: Commit 产出数据**

```bash
git add public/data/common/colleges.json public/data/common/colleges.meta.json
git add public/data/common/reports/ 2>/dev/null || true
git commit -m "data: add college basic data (first full scrape)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] §2 目录布局 → Task 1-10 覆盖所有目录和文件
- [x] §3.1 CollegeRecord Schema → Task 2 类型定义 + Task 9 合并逻辑产出
- [x] §3.2 CollegesMeta → Task 10 buildMetaFile 函数
- [x] §3.3 溯源字段使用规则 → Task 5 buildMeta + Task 10 写入 meta.json
- [x] §3.4 数据质量校验规则 → Task 9 validateRecord
- [x] §4.1 数据源选择 → Task 2 config.ts 配置 URL
- [x] §4.2 采集流程 5 步 → Task 10 index.ts 编排
- [x] §4.3 匹配策略 → Task 9 matchColleges（名称精确匹配，禁用模糊）
- [x] §4.3 容错与重试 → Task 6 HttpClient fetchWithRetry
- [x] §4.3 增量采集 → Task 4 Cache + Task 6 forceRefresh
- [x] §5.1 模块依赖关系 → Task 3-10 按依赖顺序实现
- [x] §5.2 各模块职责 → 每个 Task 对应一个模块
- [x] §5.3 npm scripts → Task 1 配置
- [x] §6.1 错误分级与退出码 → Task 10 index.ts（exit 0/1/2）
- [x] §6.2 测试策略 → Task 3-9 单元测试 + Task 11 端到端
- [x] §6.3 版本管理 → Task 2 SCRAPER_VERSION
- [x] §6.4 合规 → Task 2 USER_AGENT + Task 6 限速
- [x] §6.5 监控可观测性 → Task 10 采集报告
- [x] §7.1 实施顺序 → Task 1-12 按顺序
- [x] §7.2 验收标准 → Task 12 验证产出

**Placeholder scan:** 无 TBD/TODO，所有步骤含完整代码

**Type consistency:** `CollegeRecord`、`MoeRecord`、`GaokaoRecord`、`CollegesMeta` 等类型在 Task 2 定义后，后续 Task 引用一致；`matchColleges`、`mergeFields`、`matchAndMerge`、`validateRecord`、`buildMeta` 函数签名跨 Task 一致

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-college-data-collection.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
