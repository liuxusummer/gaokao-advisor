# 专业录取分数线与一分一段表采集系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 采集浙江、江苏两省 2023/2024/2025 年的专业级录取分数线（阳光高考）和一分一段表（省考试院），产出带溯源字段的 JSON 数据。

**Architecture:** 复用已有采集架构（`shared/` 基础设施），新增 `scores/` 和 `rank_tables/` 两个采集器。分数线通过阳光高考详情页抓取，一分一段表通过浙江/江苏考试院抓取，均按省/年组织产出。

**Tech Stack:** Node.js + TypeScript + tsx + cheerio（HTML 解析）+ axios（HTTP）+ vitest（测试）+ pdf-parse（PDF 解析，按需）

**Spec:** [docs/superpowers/specs/2026-06-17-scores-ranktables-collection-design.md](../specs/2026-06-17-scores-ranktables-collection-design.md)

---

## File Structure

```
scripts/scrapers/
├── scores/
│   ├── index.ts                  # 分数线采集编排入口
│   ├── gaokao_score.ts           # 阳光高考分数线抓取+解析
│   ├── validate.ts               # 分数线校验
│   ├── __fixtures__/
│   │   └── gaokao_score_sample.html
│   └── __tests__/
│       ├── gaokao_score.test.ts
│       ├── validate.test.ts
│       └── e2e.test.ts
├── rank_tables/
│   ├── index.ts                  # 一分一段表采集编排入口
│   ├── zhejiang.ts               # 浙江省考试院抓取+解析
│   ├── jiangsu.ts                # 江苏省考试院抓取+解析
│   ├── validate.ts               # 一分一段表校验
│   ├── __fixtures__/
│   │   ├── zhejiang_sample.html
│   │   └── jiangsu_sample.html
│   └── __tests__/
│       ├── zhejiang.test.ts
│       ├── jiangsu.test.ts
│       ├── validate.test.ts
│       └── e2e.test.ts
├── shared/
│   ├── colleges_loader.ts        # 新增：加载院校白名单
│   └── pdf.ts                    # 新增：PDF 解析工具
├── types.ts                      # 扩展：新增 Score/RankTable 类型
└── config.ts                     # 扩展：新增数据源配置

public/data/scores/
├── zhejiang/
│   ├── scores_2023.json
│   ├── scores_2024.json
│   ├── scores_2025.json
│   ├── rank_table_2023.json
│   ├── rank_table_2024.json
│   └── rank_table_2025.json
├── jiangsu/
│   └── (同上结构)
└── scores.meta.json
```

---

## Task 1: 类型定义与配置扩展

**Files:**
- Modify: `scripts/scrapers/types.ts`（追加新类型）
- Modify: `scripts/scrapers/config.ts`（追加新配置）

- [ ] **Step 1: 在 `scripts/scrapers/types.ts` 末尾追加分数线和一分一段表类型**

```typescript
// === 分数线采集类型 ===

export interface ScoreRecord {
  collegeId: string
  collegeName: string
  year: number
  majorName: string
  majorCode?: string
  majorGroup?: string
  majorGroupName?: string
  province: string
  category: string
  batch: string
  minScore: number
  minRank: number
  avgScore?: number
  maxScore?: number
  planCount?: number
  actualCount?: number
  _meta: ScoreRecordMeta
}

export interface ScoreRecordMeta {
  source: 'gaokao'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

// === 一分一段表采集类型 ===

export interface RankTableRecord {
  province: string
  year: number
  category: string
  score: number
  rank: number
  count: number
  cumulativeCount: number
  _meta: RankTableRecordMeta
}

export interface RankTableRecordMeta {
  source: 'zjzs' | 'jseea'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}

export interface RankTableFile {
  province: string
  year: number
  categories: Record<string, RankTableRecord[]>
  _meta: {
    generatedAt: string
    scraperVersion: string
    source: string
    sourceUrl: string
    recordCount: number
  }
}

// === 分数线采集元信息 ===

export interface ScoresMeta {
  provinces: Array<{
    name: string
    years: number[]
    scoreRecordCount: Record<number, number>
    rankTableRecordCount: Record<number, number>
  }>
  generatedAt: string
  scraperVersion: string
  schemaVersion: string
  sources: Array<{
    name: string
    url: string
    coverage: string
  }>
}

// === 校验结果 ===

export interface ScoreValidationResult {
  valid: boolean
  reason?: string
}

export interface RankTableValidationResult {
  valid: boolean
  reason?: string
}

// 扩展 WarningRecord 以支持分数线场景
export interface ScoreWarningRecord {
  collegeId: string
  collegeName: string
  type: 'missing_data' | 'parse_error' | 'year_missing'
  detail: string
}
```

- [ ] **Step 2: 在 `scripts/scrapers/config.ts` 末尾追加分数线配置**

```typescript
// === 分数线与一分一段表采集配置 ===

export const TARGET_YEARS = [2023, 2024, 2025]
export const TARGET_PROVINCES = ['浙江', '江苏']

// 阳光高考详情页 URL 模板
export const GAOKAO_SCHOOL_DETAIL_URL = 'https://gaokao.chsi.com.cn/sch/schoolInfo-{collegeId}.dhtml'

// 浙江省考试院一分一段表 URL（年度更新时维护，实现时确认实际发布页路径）
export const ZJ_RANK_TABLE_URLS: Record<number, string> = {
  2023: '',
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
export const SCORES_REPORTS_DIR = path.join(SCORES_OUTPUT_DIR, 'reports')
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run:
```bash
npx tsc --noEmit --esModuleInterop --moduleResolution node --target es2023 --module esnext --types node --skipLibCheck scripts/scrapers/types.ts scripts/scrapers/config.ts
```
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapers/types.ts scripts/scrapers/config.ts
git commit -m "feat(scraper): add score and rank table types and config"
```

---

## Task 2: shared/colleges_loader.ts — 院校白名单加载

**Files:**
- Create: `scripts/scrapers/shared/colleges_loader.ts`
- Test: `scripts/scrapers/shared/__tests__/colleges_loader.test.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/shared/__tests__/colleges_loader.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadColleges, verifyCollegeId } from '../colleges_loader'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('colleges_loader', () => {
  let tmpDir: string
  let originalOutputDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'colleges-loader-test-'))
    // 创建一个临时的 colleges.json
    const mockColleges = [
      {
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
      },
      {
        id: '4133010003',
        moeCode: '4133010003',
        name: '浙江大学',
        province: '浙江省',
        city: '杭州市',
        level: ['普通本科'],
        type: '综合',
        nature: 'public',
        affiliation: '教育部',
        officialWebsite: 'https://www.zju.edu.cn',
        gaokaoUrl: 'https://gaokao.chsi.com.cn/test2',
        _meta: {
          source: 'merged',
          sourceUrl: 'https://moe.gov.cn/test',
          fetchedAt: '2026-06-17T10:00:00.000Z',
          scraperVersion: '1.0.0',
          verified: true,
        },
      },
    ]
    fs.writeFileSync(
      path.join(tmpDir, 'colleges.json'),
      JSON.stringify(mockColleges),
      'utf-8'
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('loadColleges 返回 Map，key 为 id', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    expect(colleges.size).toBe(2)
    expect(colleges.has('4111010001')).toBe(true)
    expect(colleges.has('4133010003')).toBe(true)
  })

  it('loadColleges 返回的 value 包含完整 CollegeRecord', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    const pku = colleges.get('4111010001')!
    expect(pku.name).toBe('北京大学')
    expect(pku.province).toBe('北京市')
    expect(pku.nature).toBe('public')
  })

  it('verifyCollegeId 对存在的 id 返回 true', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    expect(verifyCollegeId('4111010001', colleges)).toBe(true)
  })

  it('verifyCollegeId 对不存在的 id 返回 false', () => {
    const colleges = loadColleges(path.join(tmpDir, 'colleges.json'))
    expect(verifyCollegeId('9999999999', colleges)).toBe(false)
  })

  it('文件不存在时抛出错误', () => {
    expect(() => loadColleges('/nonexistent/path/colleges.json')).toThrow()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/shared/__tests__/colleges_loader.test.ts`
Expected: FAIL，提示 `loadColleges` 未定义

- [ ] **Step 3: 实现 `scripts/scrapers/shared/colleges_loader.ts`**

```typescript
import fs from 'node:fs'
import { createLogger } from './logger'
import type { CollegeRecord } from '../types'

const logger = createLogger('colleges_loader')

export function loadColleges(filePath: string): Map<string, CollegeRecord> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`院校白名单文件不存在: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const records: CollegeRecord[] = JSON.parse(content)

  const map = new Map<string, CollegeRecord>()
  for (const record of records) {
    map.set(record.id, record)
  }

  logger.info('院校白名单加载完成', { count: map.size, path: filePath })
  return map
}

export function verifyCollegeId(
  id: string,
  colleges: Map<string, CollegeRecord>
): boolean {
  return colleges.has(id)
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/shared/__tests__/colleges_loader.test.ts`
Expected: PASS（5 个测试通过）

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/shared/colleges_loader.ts scripts/scrapers/shared/__tests__/colleges_loader.test.ts
git commit -m "feat(scraper): add colleges loader for score verification"
```

---

## Task 3: shared/pdf.ts — PDF 解析工具

**Files:**
- Create: `scripts/scrapers/shared/pdf.ts`
- Test: `scripts/scrapers/shared/__tests__/pdf.test.ts`

- [ ] **Step 1: 安装 pdf-parse 依赖**

Run:
```bash
npm install --save-dev pdf-parse
```

- [ ] **Step 2: 写失败测试 `scripts/scrapers/shared/__tests__/pdf.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parsePdf } from '../pdf'

describe('parsePdf', () => {
  it('对空 Buffer 返回空字符串或抛出错误', async () => {
    // pdf-parse 对空内容会抛错，我们期望它抛出
    await expect(parsePdf(Buffer.from(''))).rejects.toThrow()
  })

  it('函数存在且可导入', async () => {
    expect(typeof parsePdf).toBe('function')
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/shared/__tests__/pdf.test.ts`
Expected: FAIL，提示 `parsePdf` 未定义

- [ ] **Step 4: 实现 `scripts/scrapers/shared/pdf.ts`**

```typescript
import pdfParse from 'pdf-parse'
import { createLogger } from './logger'

const logger = createLogger('pdf')

export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    logger.info('PDF 解析完成', { textLength: data.text.length })
    return data.text
  } catch (error) {
    logger.error('PDF 解析失败', { error: (error as Error).message })
    throw new Error(`PDF 解析失败: ${(error as Error).message}`)
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/shared/__tests__/pdf.test.ts`
Expected: PASS（2 个测试通过）

- [ ] **Step 6: Commit**

```bash
git add scripts/scrapers/shared/pdf.ts scripts/scrapers/shared/__tests__/pdf.test.ts package.json package-lock.json
git commit -m "feat(scraper): add pdf parser utility"
```

---

## Task 4: scores/gaokao_score.ts — 阳光高考分数线解析器

**Files:**
- Create: `scripts/scrapers/scores/__fixtures__/gaokao_score_sample.html`
- Create: `scripts/scrapers/scores/__tests__/gaokao_score.test.ts`
- Create: `scripts/scrapers/scores/gaokao_score.ts`

- [ ] **Step 1: 创建 fixture `scripts/scrapers/scores/__fixtures__/gaokao_score_sample.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>北京大学 - 阳光高考</title></head>
<body>
<div class="school-info">
  <h1 class="school-name">北京大学</h1>
  <div class="score-section">
    <h2>历年录取分数</h2>
    <table class="score-table">
      <thead>
        <tr>
          <th>年份</th>
          <th>省份</th>
          <th>科类</th>
          <th>批次</th>
          <th>专业名称</th>
          <th>专业组</th>
          <th>最低分</th>
          <th>最低位次</th>
          <th>平均分</th>
          <th>计划数</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>2025</td><td>浙江</td><td>综合</td><td>本科批</td>
          <td>计算机科学与技术</td><td>01</td>
          <td>695</td><td>120</td><td>700</td><td>5</td>
        </tr>
        <tr>
          <td>2025</td><td>浙江</td><td>综合</td><td>本科批</td>
          <td>数学与应用数学</td><td>01</td>
          <td>693</td><td>135</td><td>698</td><td>4</td>
        </tr>
        <tr>
          <td>2024</td><td>浙江</td><td>综合</td><td>本科批</td>
          <td>计算机科学与技术</td><td>01</td>
          <td>692</td><td>125</td><td>697</td><td>5</td>
        </tr>
        <tr>
          <td>2025</td><td>江苏</td><td>物理类</td><td>本科批</td>
          <td>计算机科学与技术</td><td>02</td>
          <td>688</td><td>200</td><td>693</td><td>6</td>
        </tr>
        <tr>
          <td>2025</td><td>江苏</td><td>历史类</td><td>本科批</td>
          <td>法学</td><td>01</td>
          <td>665</td><td>80</td><td>670</td><td>3</td>
        </tr>
        <tr>
          <td>2023</td><td>北京</td><td>综合</td><td>本科批</td>
          <td>计算机科学与技术</td><td>01</td>
          <td>690</td><td>500</td><td>695</td><td>10</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>
```

- [ ] **Step 2: 写失败测试 `scripts/scrapers/scores/__tests__/gaokao_score.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseScores, buildScoreUrl } from '../gaokao_score'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'gaokao_score_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('buildScoreUrl', () => {
  it('构造阳光高考详情页 URL', () => {
    const url = buildScoreUrl('10001')
    expect(url).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml')
  })
})

describe('parseScores', () => {
  it('按年份和省份筛选：浙江 2025 返回 2 条', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(2)
    expect(records.every((r) => r.year === 2025)).toBe(true)
    expect(records.every((r) => r.province === '浙江')).toBe(true)
  })

  it('解析专业级字段正确', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    const cs = records.find((r) => r.majorName === '计算机科学与技术')!
    expect(cs.collegeId).toBe('4111010001')
    expect(cs.collegeName).toBe('北京大学')
    expect(cs.year).toBe(2025)
    expect(cs.majorName).toBe('计算机科学与技术')
    expect(cs.majorGroup).toBe('01')
    expect(cs.category).toBe('综合')
    expect(cs.batch).toBe('本科批')
    expect(cs.minScore).toBe(695)
    expect(cs.minRank).toBe(120)
    expect(cs.avgScore).toBe(700)
    expect(cs.planCount).toBe(5)
  })

  it('江苏 2025 返回 2 条（物理类+历史类）', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(2)
    const categories = records.map((r) => r.category)
    expect(categories).toContain('物理类')
    expect(categories).toContain('历史类')
  })

  it('多年份筛选：浙江 2024+2025 返回 3 条', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2024, 2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(3)
  })

  it('排除不在目标省份的记录（北京）', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2023],
      provinces: ['浙江', '江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records).toHaveLength(0)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    for (const r of records) {
      expect(r._meta.source).toBe('gaokao')
      expect(r._meta.sourceUrl).toBe('https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(true)
    }
  })

  it('空 HTML 返回空数组', () => {
    const records = parseScores({
      html: '<html></html>',
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江'],
      sourceUrl: 'https://gaokao.chsi.com.cn/test',
    })
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/scores/__tests__/gaokao_score.test.ts`
Expected: FAIL，提示 `parseScores`、`buildScoreUrl` 未定义

- [ ] **Step 4: 实现 `scripts/scrapers/scores/gaokao_score.ts`**

```typescript
import * as cheerio from 'cheerio'
import { GAOKAO_BASE_URL, SCRAPER_VERSION } from '../config'
import { buildMeta } from '../shared/meta'
import type { ScoreRecord } from '../types'

export function buildScoreUrl(collegeId: string): string {
  return `${GAOKAO_BASE_URL}/sch/schoolInfo-${collegeId}.dhtml`
}

interface ParseScoresOptions {
  html: string
  collegeId: string
  collegeName: string
  years: number[]
  provinces: string[]
  sourceUrl: string
}

export function parseScores(options: ParseScoresOptions): ScoreRecord[] {
  const { html, collegeId, collegeName, years, provinces, sourceUrl } = options
  const $ = cheerio.load(html)
  const records: ScoreRecord[] = []

  const yearSet = new Set(years)
  const provinceSet = new Set(provinces)

  $('.score-table tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 8) return

    const year = parseInt($(cells[0]).text().trim(), 10)
    const province = $(cells[1]).text().trim()
    const category = $(cells[2]).text().trim()
    const batch = $(cells[3]).text().trim()
    const majorName = $(cells[4]).text().trim()
    const majorGroup = $(cells[5]).text().trim() || undefined
    const minScore = parseInt($(cells[6]).text().trim(), 10)
    const minRank = parseInt($(cells[7]).text().trim(), 10)
    const avgScore = cells.length > 8 ? parseInt($(cells[8]).text().trim(), 10) : undefined
    const planCount = cells.length > 9 ? parseInt($(cells[9]).text().trim(), 10) : undefined

    // 筛选：年份和省份
    if (!yearSet.has(year)) return
    if (!provinceSet.has(province)) return

    // 跳过无效数据
    if (!majorName || isNaN(minScore) || isNaN(minRank)) return

    const meta = buildMeta('gaokao', sourceUrl, true)
    // buildMeta 返回的是通用 RecordMeta，需要转换为 ScoreRecordMeta
    // 由于结构一致，直接复用
    records.push({
      collegeId,
      collegeName,
      year,
      majorName,
      majorGroup,
      category,
      batch,
      minScore,
      minRank,
      avgScore: !isNaN(avgScore as number) ? avgScore : undefined,
      planCount: !isNaN(planCount as number) ? planCount : undefined,
      _meta: {
        source: 'gaokao',
        sourceUrl: meta.sourceUrl,
        fetchedAt: meta.fetchedAt,
        scraperVersion: SCRAPER_VERSION,
        verified: true,
      },
    })
  })

  return records
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/scores/__tests__/gaokao_score.test.ts`
Expected: PASS（7 个测试通过）

- [ ] **Step 6: Commit**

```bash
git add scripts/scrapers/scores/gaokao_score.ts scripts/scrapers/scores/__tests__/gaokao_score.test.ts scripts/scrapers/scores/__fixtures__/gaokao_score_sample.html
git commit -m "feat(scraper): add gaokao score parser"
```

---

## Task 5: scores/validate.ts — 分数线校验

**Files:**
- Create: `scripts/scrapers/scores/__tests__/validate.test.ts`
- Create: `scripts/scrapers/scores/validate.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/scores/__tests__/validate.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { validateScoreRecord } from '../validate'
import type { ScoreRecord } from '../../types'

const validRecord: ScoreRecord = {
  collegeId: '4111010001',
  collegeName: '北京大学',
  year: 2025,
  majorName: '计算机科学与技术',
  majorGroup: '01',
  province: '浙江',
  category: '综合',
  batch: '本科批',
  minScore: 695,
  minRank: 120,
  _meta: {
    source: 'gaokao',
    sourceUrl: 'https://gaokao.chsi.com.cn/test',
    fetchedAt: '2026-06-17T10:00:00.000Z',
    scraperVersion: '1.0.0',
    verified: true,
  },
}

describe('validateScoreRecord', () => {
  it('合法记录返回 { valid: true }', () => {
    const result = validateScoreRecord(validRecord)
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('collegeId 为空时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, collegeId: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('collegeId')
  })

  it('majorName 为空时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, majorName: '' })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('majorName')
  })

  it('minScore 超出 0-750 范围时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, minScore: 800 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minScore')
  })

  it('minScore 为负数时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, minScore: -10 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minScore')
  })

  it('minRank 为非正整数时校验失败', () => {
    const result = validateScoreRecord({ ...validRecord, minRank: 0 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minRank')
  })

  it('verified=false 时校验失败', () => {
    const result = validateScoreRecord({
      ...validRecord,
      _meta: { ...validRecord._meta, verified: false },
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('verified')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/scores/__tests__/validate.test.ts`
Expected: FAIL，提示 `validateScoreRecord` 未定义

- [ ] **Step 3: 实现 `scripts/scrapers/scores/validate.ts`**

```typescript
import type { ScoreRecord, ScoreValidationResult } from '../types'

export function validateScoreRecord(record: ScoreRecord): ScoreValidationResult {
  const requiredFields: Array<keyof ScoreRecord> = [
    'collegeId', 'collegeName', 'year', 'majorName',
    'province', 'category', 'batch', 'minScore', 'minRank',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === '' || value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
  }

  // minScore 范围校验：0-750
  if (record.minScore < 0 || record.minScore > 750) {
    return { valid: false, reason: `minScore 超出范围 (0-750): ${record.minScore}` }
  }

  // minRank 为正整数
  if (!Number.isInteger(record.minRank) || record.minRank <= 0) {
    return { valid: false, reason: `minRank 必须为正整数: ${record.minRank}` }
  }

  // year 合理性
  if (record.year < 2000 || record.year > 2030) {
    return { valid: false, reason: `year 不合理: ${record.year}` }
  }

  // 白名单校验
  if (!record._meta.verified) {
    return { valid: false, reason: '记录未通过白名单校验 (verified=false)' }
  }

  return { valid: true }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/scores/__tests__/validate.test.ts`
Expected: PASS（7 个测试通过）

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/scores/validate.ts scripts/scrapers/scores/__tests__/validate.test.ts
git commit -m "feat(scraper): add score record validator"
```

---

## Task 6: scores/index.ts — 分数线采集编排

**Files:**
- Create: `scripts/scrapers/scores/index.ts`

- [ ] **Step 1: 实现 `scripts/scrapers/scores/index.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges, verifyCollegeId } from '../shared/colleges_loader'
import { parseScores, buildScoreUrl } from './gaokao_score'
import { validateScoreRecord } from './validate'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  GAOKAO_QPS,
  OUTPUT_DIR,
  SCORES_OUTPUT_DIR,
  SCORES_REPORTS_DIR,
  LOGS_DIR,
  TARGET_YEARS,
  TARGET_PROVINCES,
} from '../config'
import type {
  ScoreRecord,
  ScoresMeta,
  FailedRecord,
  ScoreWarningRecord,
} from '../types'

const logger = createLogger('scores')

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

  logger.info('开始分数线采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    provinces: TARGET_PROVINCES,
    force: args.force,
    dryRun: args.dryRun,
  })

  // 确保输出目录存在
  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SCORES_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // Step 1: 加载院校白名单
  const collegesPath = path.join(OUTPUT_DIR, 'colleges.json')
  if (!fs.existsSync(collegesPath)) {
    logger.error('colleges.json 不存在，请先运行 scrape:colleges', { path: collegesPath })
    process.exit(2)
  }

  const colleges = loadColleges(collegesPath)
  logger.info('院校白名单加载完成', { count: colleges.size })

  // Step 2-3: 抓取+解析阳光高考详情页
  const http = new HttpClient(path.join(process.cwd(), 'raw', 'scores'))
  const allScores: ScoreRecord[] = []
  const failed: FailedRecord[] = []
  const warnings: ScoreWarningRecord[] = []
  const requestInterval = 1000 / GAOKAO_QPS

  let processed = 0
  for (const [collegeId, college] of colleges) {
    processed++
    try {
      const url = buildScoreUrl(collegeId)
      const result = await http.fetch(url, {
        cacheKey: `score_${collegeId}`,
        forceRefresh: args.force,
      })
      const scores = parseScores({
        html: result.html,
        collegeId,
        collegeName: college.name,
        years: TARGET_YEARS,
        provinces: TARGET_PROVINCES,
        sourceUrl: url,
      })

      if (scores.length === 0) {
        warnings.push({
          collegeId,
          collegeName: college.name,
          type: 'missing_data',
          detail: `该院校在 ${TARGET_PROVINCES.join('/')} ${TARGET_YEARS.join('/')} 无录取数据`,
        })
      }

      allScores.push(...scores)

      if (processed % 100 === 0) {
        logger.info('采集进度', {
          processed,
          total: colleges.size,
          scoresCollected: allScores.length,
        })
      }
    } catch (error) {
      failed.push({
        url: buildScoreUrl(collegeId),
        error: (error as Error).message,
        retryCount: 3,
        context: `collegeId=${collegeId}, name=${college.name}`,
      })
    }
    await sleep(requestInterval)
  }

  logger.info('阳光高考抓取完成', {
    totalScores: allScores.length,
    failed: failed.length,
    warnings: warnings.length,
  })

  // Step 4: 关联白名单校验
  const verified = allScores.map((s) => ({
    ...s,
    _meta: {
      ...s._meta,
      verified: verifyCollegeId(s.collegeId, colleges),
    },
  }))

  // Step 5: 校验与产出
  const validated: ScoreRecord[] = []
  const rejected: Array<{ record: Partial<ScoreRecord>; reason: string }> = []

  for (const record of verified) {
    const result = validateScoreRecord(record)
    if (result.valid) {
      validated.push(record)
    } else {
      rejected.push({ record, reason: result.reason! })
    }
  }

  // 按 province/year 分组写入
  for (const province of TARGET_PROVINCES) {
    const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
    fs.mkdirSync(provinceDir, { recursive: true })

    for (const year of TARGET_YEARS) {
      const records = validated.filter(
        (s) => s.province === province && s.year === year
      )
      const outputPath = path.join(provinceDir, `scores_${year}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8')
      logger.info('分数线文件已写入', {
        province,
        year,
        count: records.length,
        path: outputPath,
      })
    }
  }

  // 写入元信息
  const meta = buildScoresMeta(validated)
  const metaPath = path.join(SCORES_OUTPUT_DIR, 'scores.meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  // 写入报告
  if (failed.length > 0) {
    fs.writeFileSync(
      path.join(SCORES_REPORTS_DIR, 'failed.json'),
      JSON.stringify(failed, null, 2),
      'utf-8'
    )
  }
  if (warnings.length > 0) {
    fs.writeFileSync(
      path.join(SCORES_REPORTS_DIR, 'warnings.json'),
      JSON.stringify(warnings, null, 2),
      'utf-8'
    )
  }
  if (rejected.length > 0) {
    fs.writeFileSync(
      path.join(SCORES_REPORTS_DIR, 'rejected.json'),
      JSON.stringify(rejected, null, 2),
      'utf-8'
    )
  }

  // 汇总报告
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const report = [
    '[分数线采集报告] ============================================',
    `版本: ${SCRAPER_VERSION} | 耗时: ${formatDuration(elapsed)} | 时间: ${new Date().toISOString()}`,
    '------------------------------------------------------',
    `院校白名单: ${colleges.size} 所`,
    `抓取成功:   ${colleges.size - failed.length} 所（失败 ${failed.length} 所）`,
    '------------------------------------------------------',
    ...TARGET_PROVINCES.map((p) =>
      TARGET_YEARS.map((y) => {
        const count = validated.filter((s) => s.province === p && s.year === y).length
        return `${p} ${y}: ${count} 条专业级分数`
      }).join('\n')
    ).join('\n'),
    '------------------------------------------------------',
    `总计产出:   ${validated.length} 条`,
    `校验拒绝:   ${rejected.length} 条`,
    `警告:       ${warnings.length} 条`,
    '======================================================',
  ].join('\n')

  console.log('\n' + report)

  const logPath = path.join(LOGS_DIR, `scrape-scores-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')

  if (rejected.length > 0) {
    process.exit(1)
  }
}

function buildScoresMeta(records: ScoreRecord[]): ScoresMeta {
  const provinces = TARGET_PROVINCES.map((name) => {
    const years = TARGET_YEARS
    const scoreRecordCount: Record<number, number> = {}
    const rankTableRecordCount: Record<number, number> = {}

    for (const year of years) {
      scoreRecordCount[year] = records.filter(
        (r) => r.province === name && r.year === year
      ).length
      rankTableRecordCount[year] = 0 // 由 rank_tables 采集器填充
    }

    return { name, years, scoreRecordCount, rankTableRecordCount }
  })

  return {
    provinces,
    generatedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    sources: [
      {
        name: '阳光高考',
        url: 'https://gaokao.chsi.com.cn',
        coverage: '分数线',
      },
    ],
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
  logger.error('分数线采集流程异常终止', {
    error: (error as Error).message,
    stack: (error as Error).stack,
  })
  process.exit(2)
})
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
npx tsc --noEmit --esModuleInterop --moduleResolution node --target es2023 --module esnext --types node --skipLibCheck scripts/scrapers/scores/index.ts
```
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add scripts/scrapers/scores/index.ts
git commit -m "feat(scraper): add scores orchestration entry point"
```

---

## Task 7: scores 端到端冒烟测试

**Files:**
- Create: `scripts/scrapers/scores/__tests__/e2e.test.ts`

- [ ] **Step 1: 写端到端测试 `scripts/scrapers/scores/__tests__/e2e.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseScores } from '../gaokao_score'
import { validateScoreRecord } from '../validate'
import type { ScoreRecord } from '../../types'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'gaokao_score_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('scores 端到端冒烟测试', () => {
  it('完整流程：parse → validate → output', () => {
    // Step 1: 解析阳光高考详情页
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2023, 2024, 2025],
      provinces: ['浙江', '江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/sch/schoolInfo-10001.dhtml',
    })
    expect(records.length).toBeGreaterThan(0)

    // Step 2: 校验所有记录
    const validated: ScoreRecord[] = []
    for (const record of records) {
      const result = validateScoreRecord(record)
      expect(result.valid).toBe(true)
      validated.push(record)
    }

    // Step 3: 断言 _meta 字段完整
    for (const record of validated) {
      expect(record._meta.source).toBe('gaokao')
      expect(record._meta.verified).toBe(true)
      expect(record._meta.scraperVersion).toBeDefined()
      expect(record._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(record._meta.sourceUrl).toMatch(/^https?:\/\//)
    }

    // Step 4: 断言数据按省份和年份正确筛选
    const provinces = new Set(validated.map((r) => r.province))
    const years = new Set(validated.map((r) => r.year))
    expect(provinces.has('浙江')).toBe(true)
    expect(provinces.has('江苏')).toBe(true)
    expect([...years].every((y) => [2023, 2024, 2025].includes(y))).toBe(true)

    // Step 5: 断言不包含目标省份之外的数据
    expect([...provinces].every((p) => ['浙江', '江苏'].includes(p))).toBe(true)
  })

  it('按省/年分组结构正确', () => {
    const records = parseScores({
      html: fixtureHtml,
      collegeId: '4111010001',
      collegeName: '北京大学',
      years: [2025],
      provinces: ['浙江', '江苏'],
      sourceUrl: 'https://gaokao.chsi.com.cn/test',
    })

    const zj2025 = records.filter((r) => r.province === '浙江' && r.year === 2025)
    const js2025 = records.filter((r) => r.province === '江苏' && r.year === 2025)

    expect(zj2025.length).toBeGreaterThan(0)
    expect(js2025.length).toBeGreaterThan(0)
    expect(zj2025.every((r) => r.province === '浙江' && r.year === 2025)).toBe(true)
    expect(js2025.every((r) => r.province === '江苏' && r.year === 2025)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行端到端测试**

Run: `npx vitest run scripts/scrapers/scores/__tests__/e2e.test.ts`
Expected: PASS（2 个测试通过）

- [ ] **Step 3: 运行全部 scores 测试**

Run: `npx vitest run scripts/scrapers/scores`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapers/scores/__tests__/e2e.test.ts
git commit -m "test(scraper): add scores e2e smoke test"
```

---

## Task 8: rank_tables/zhejiang.ts — 浙江一分一段表解析器

**Files:**
- Create: `scripts/scrapers/rank_tables/__fixtures__/zhejiang_sample.html`
- Create: `scripts/scrapers/rank_tables/__tests__/zhejiang.test.ts`
- Create: `scripts/scrapers/rank_tables/zhejiang.ts`

- [ ] **Step 1: 创建 fixture `scripts/scrapers/rank_tables/__fixtures__/zhejiang_sample.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>浙江省一分一段表 2025</title></head>
<body>
<table class="rank-table">
  <thead>
    <tr>
      <th>分数</th>
      <th>人数</th>
      <th>累计人数</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>700</td><td>50</td><td>50</td></tr>
    <tr><td>699</td><td>45</td><td>95</td></tr>
    <tr><td>698</td><td>52</td><td>147</td></tr>
    <tr><td>697</td><td>48</td><td>195</td></tr>
    <tr><td>696</td><td>55</td><td>250</td></tr>
    <tr><td>695</td><td>60</td><td>310</td></tr>
    <tr><td>694</td><td>58</td><td>368</td></tr>
    <tr><td>693</td><td>62</td><td>430</td></tr>
    <tr><td>692</td><td>65</td><td>495</td></tr>
    <tr><td>691</td><td>70</td><td>565</td></tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: 写失败测试 `scripts/scrapers/rank_tables/__tests__/zhejiang.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjTable } from '../zhejiang'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseZjTable', () => {
  it('正确解析 10 条记录', () => {
    const records = parseZjTable(fixtureHtml, 2025, 'https://zjzs.net/test')
    expect(records).toHaveLength(10)
  })

  it('解析 700 分记录字段正确', () => {
    const records = parseZjTable(fixtureHtml, 2025, 'https://zjzs.net/test')
    const top = records[0]
    expect(top.score).toBe(700)
    expect(top.count).toBe(50)
    expect(top.cumulativeCount).toBe(50)
    expect(top.rank).toBe(1) // 700 分对应位次 1
  })

  it('解析 695 分记录字段正确', () => {
    const records = parseZjTable(fixtureHtml, 2025, 'https://zjzs.net/test')
    const r695 = records.find((r) => r.score === 695)!
    expect(r695.count).toBe(60)
    expect(r695.cumulativeCount).toBe(310)
    expect(r695.rank).toBe(251) // 累计 250 + 1
  })

  it('province 为浙江，category 为综合', () => {
    const records = parseZjTable(fixtureHtml, 2025, 'https://zjzs.net/test')
    expect(records.every((r) => r.province === '浙江')).toBe(true)
    expect(records.every((r) => r.category === '综合')).toBe(true)
  })

  it('year 传入正确', () => {
    const records = parseZjTable(fixtureHtml, 2025, 'https://zjzs.net/test')
    expect(records.every((r) => r.year === 2025)).toBe(true)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseZjTable(fixtureHtml, 2025, 'https://zjzs.net/test')
    for (const r of records) {
      expect(r._meta.source).toBe('zjzs')
      expect(r._meta.sourceUrl).toBe('https://zjzs.net/test')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(true)
    }
  })

  it('score 降序排列', () => {
    const records = parseZjTable(fixtureHtml, 2025, 'https://zjzs.net/test')
    for (let i = 1; i < records.length; i++) {
      expect(records[i].score).toBeLessThan(records[i - 1].score)
    }
  })

  it('空 HTML 返回空数组', () => {
    const records = parseZjTable('<html></html>', 2025, 'https://zjzs.net/test')
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/rank_tables/__tests__/zhejiang.test.ts`
Expected: FAIL，提示 `parseZjTable` 未定义

- [ ] **Step 4: 实现 `scripts/scrapers/rank_tables/zhejiang.ts`**

```typescript
import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

export function parseZjTable(
  html: string,
  year: number,
  sourceUrl: string
): RankTableRecord[] {
  const $ = cheerio.load(html)
  const records: RankTableRecord[] = []

  $('.rank-table tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return

    const score = parseInt($(cells[0]).text().trim(), 10)
    const count = parseInt($(cells[1]).text().trim(), 10)
    const cumulativeCount = parseInt($(cells[2]).text().trim(), 10)

    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) return

    // rank = 上一分数的累计人数 + 1（即该分数段的最高位次）
    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '浙江',
      year,
      category: '综合',
      score,
      rank,
      count,
      cumulativeCount,
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

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/rank_tables/__tests__/zhejiang.test.ts`
Expected: PASS（8 个测试通过）

- [ ] **Step 6: Commit**

```bash
git add scripts/scrapers/rank_tables/zhejiang.ts scripts/scrapers/rank_tables/__tests__/zhejiang.test.ts scripts/scrapers/rank_tables/__fixtures__/zhejiang_sample.html
git commit -m "feat(scraper): add zhejiang rank table parser"
```

---

## Task 9: rank_tables/jiangsu.ts — 江苏一分一段表解析器

**Files:**
- Create: `scripts/scrapers/rank_tables/__fixtures__/jiangsu_sample.html`
- Create: `scripts/scrapers/rank_tables/__tests__/jiangsu.test.ts`
- Create: `scripts/scrapers/rank_tables/jiangsu.ts`

- [ ] **Step 1: 创建 fixture `scripts/scrapers/rank_tables/__fixtures__/jiangsu_sample.html`**

江苏有物理类和历史类两个表格：

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>江苏省一分一段表 2025</title></head>
<body>
<h2>物理类</h2>
<table class="rank-table" id="physics">
  <thead>
    <tr><th>分数</th><th>人数</th><th>累计人数</th></tr>
  </thead>
  <tbody>
    <tr><td>690</td><td>30</td><td>30</td></tr>
    <tr><td>689</td><td>35</td><td>65</td></tr>
    <tr><td>688</td><td>40</td><td>105</td></tr>
    <tr><td>687</td><td>38</td><td>143</td></tr>
    <tr><td>686</td><td>42</td><td>185</td></tr>
  </tbody>
</table>

<h2>历史类</h2>
<table class="rank-table" id="history">
  <thead>
    <tr><th>分数</th><th>人数</th><th>累计人数</th></tr>
  </thead>
  <tbody>
    <tr><td>665</td><td>20</td><td>20</td></tr>
    <tr><td>664</td><td>25</td><td>45</td></tr>
    <tr><td>663</td><td>28</td><td>73</td></tr>
    <tr><td>662</td><td>30</td><td>103</td></tr>
    <tr><td>661</td><td>32</td><td>135</td></tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: 写失败测试 `scripts/scrapers/rank_tables/__tests__/jiangsu.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseJsTable } from '../jiangsu'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_sample.html')
const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8')

describe('parseJsTable', () => {
  it('解析物理类 5 条记录', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(5)
    expect(records.every((r) => r.category === '物理类')).toBe(true)
  })

  it('解析历史类 5 条记录', () => {
    const records = parseJsTable(fixtureHtml, 2025, '历史类', 'https://jseea.cn/test')
    expect(records).toHaveLength(5)
    expect(records.every((r) => r.category === '历史类')).toBe(true)
  })

  it('解析物理类 690 分记录字段正确', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    const top = records[0]
    expect(top.score).toBe(690)
    expect(top.count).toBe(30)
    expect(top.cumulativeCount).toBe(30)
    expect(top.rank).toBe(1)
  })

  it('解析历史类 665 分记录字段正确', () => {
    const records = parseJsTable(fixtureHtml, 2025, '历史类', 'https://jseea.cn/test')
    const top = records[0]
    expect(top.score).toBe(665)
    expect(top.count).toBe(20)
    expect(top.cumulativeCount).toBe(20)
    expect(top.rank).toBe(1)
  })

  it('province 为江苏', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.province === '江苏')).toBe(true)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    for (const r of records) {
      expect(r._meta.source).toBe('jseea')
      expect(r._meta.sourceUrl).toBe('https://jseea.cn/test')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(true)
    }
  })

  it('score 降序排列', () => {
    const records = parseJsTable(fixtureHtml, 2025, '物理类', 'https://jseea.cn/test')
    for (let i = 1; i < records.length; i++) {
      expect(records[i].score).toBeLessThan(records[i - 1].score)
    }
  })

  it('空 HTML 返回空数组', () => {
    const records = parseJsTable('<html></html>', 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/rank_tables/__tests__/jiangsu.test.ts`
Expected: FAIL，提示 `parseJsTable` 未定义

- [ ] **Step 4: 实现 `scripts/scrapers/rank_tables/jiangsu.ts`**

```typescript
import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

export function parseJsTable(
  html: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): RankTableRecord[] {
  const $ = cheerio.load(html)
  const records: RankTableRecord[] = []

  // 根据科类选择对应的表格
  const tableId = category === '物理类' ? '#physics' : '#history'
  const tableSelector = `${tableId}.rank-table tbody tr`

  $(tableSelector).each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return

    const score = parseInt($(cells[0]).text().trim(), 10)
    const count = parseInt($(cells[1]).text().trim(), 10)
    const cumulativeCount = parseInt($(cells[2]).text().trim(), 10)

    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) return

    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '江苏',
      year,
      category,
      score,
      rank,
      count,
      cumulativeCount,
      _meta: {
        source: 'jseea',
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

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/rank_tables/__tests__/jiangsu.test.ts`
Expected: PASS（8 个测试通过）

- [ ] **Step 6: Commit**

```bash
git add scripts/scrapers/rank_tables/jiangsu.ts scripts/scrapers/rank_tables/__tests__/jiangsu.test.ts scripts/scrapers/rank_tables/__fixtures__/jiangsu_sample.html
git commit -m "feat(scraper): add jiangsu rank table parser"
```

---

## Task 10: rank_tables/validate.ts — 一分一段表校验

**Files:**
- Create: `scripts/scrapers/rank_tables/__tests__/validate.test.ts`
- Create: `scripts/scrapers/rank_tables/validate.ts`

- [ ] **Step 1: 写失败测试 `scripts/scrapers/rank_tables/__tests__/validate.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { validateRankRecord, validateRankTableMonotonicity } from '../validate'
import type { RankTableRecord } from '../../types'

const validRecord: RankTableRecord = {
  province: '浙江',
  year: 2025,
  category: '综合',
  score: 695,
  rank: 251,
  count: 60,
  cumulativeCount: 310,
  _meta: {
    source: 'zjzs',
    sourceUrl: 'https://zjzs.net/test',
    fetchedAt: '2026-06-17T10:00:00.000Z',
    scraperVersion: '1.0.0',
    verified: true,
  },
}

describe('validateRankRecord', () => {
  it('合法记录返回 { valid: true }', () => {
    const result = validateRankRecord(validRecord)
    expect(result.valid).toBe(true)
  })

  it('score 超出 0-750 范围时校验失败', () => {
    const result = validateRankRecord({ ...validRecord, score: 800 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('score')
  })

  it('rank 为非正整数时校验失败', () => {
    const result = validateRankRecord({ ...validRecord, rank: 0 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('rank')
  })

  it('cumulativeCount 为非正整数时校验失败', () => {
    const result = validateRankRecord({ ...validRecord, cumulativeCount: -5 })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('cumulativeCount')
  })

  it('verified=false 时校验失败', () => {
    const result = validateRankRecord({
      ...validRecord,
      _meta: { ...validRecord._meta, verified: false },
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('verified')
  })
})

describe('validateRankTableMonotonicity', () => {
  it('合法单调序列返回 { valid: true }', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 700, cumulativeCount: 50 },
      { ...validRecord, score: 699, cumulativeCount: 95 },
      { ...validRecord, score: 698, cumulativeCount: 147 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(true)
  })

  it('score 非降序时校验失败', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 698, cumulativeCount: 147 },
      { ...validRecord, score: 700, cumulativeCount: 50 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('score')
  })

  it('cumulativeCount 非递增时校验失败', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 700, cumulativeCount: 100 },
      { ...validRecord, score: 699, cumulativeCount: 50 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('cumulativeCount')
  })

  it('score 重复时校验失败', () => {
    const records: RankTableRecord[] = [
      { ...validRecord, score: 700, cumulativeCount: 50 },
      { ...validRecord, score: 700, cumulativeCount: 100 },
    ]
    const result = validateRankTableMonotonicity(records)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('重复')
  })

  it('空数组返回 { valid: true }', () => {
    const result = validateRankTableMonotonicity([])
    expect(result.valid).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/rank_tables/__tests__/validate.test.ts`
Expected: FAIL，提示 `validateRankRecord` 未定义

- [ ] **Step 3: 实现 `scripts/scrapers/rank_tables/validate.ts`**

```typescript
import type {
  RankTableRecord,
  RankTableValidationResult,
} from '../types'

export function validateRankRecord(record: RankTableRecord): RankTableValidationResult {
  const requiredFields: Array<keyof RankTableRecord> = [
    'province', 'year', 'category', 'score', 'rank', 'count', 'cumulativeCount',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === '' || value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
  }

  // score 范围校验：0-750
  if (record.score < 0 || record.score > 750) {
    return { valid: false, reason: `score 超出范围 (0-750): ${record.score}` }
  }

  // rank 为正整数
  if (!Number.isInteger(record.rank) || record.rank <= 0) {
    return { valid: false, reason: `rank 必须为正整数: ${record.rank}` }
  }

  // count 为非负整数
  if (!Number.isInteger(record.count) || record.count < 0) {
    return { valid: false, reason: `count 必须为非负整数: ${record.count}` }
  }

  // cumulativeCount 为正整数
  if (!Number.isInteger(record.cumulativeCount) || record.cumulativeCount <= 0) {
    return { valid: false, reason: `cumulativeCount 必须为正整数: ${record.cumulativeCount}` }
  }

  // 白名单校验
  if (!record._meta.verified) {
    return { valid: false, reason: '记录未通过校验 (verified=false)' }
  }

  return { valid: true }
}

export function validateRankTableMonotonicity(
  records: RankTableRecord[]
): RankTableValidationResult {
  if (records.length === 0) return { valid: true }

  const seenScores = new Set<number>()

  for (let i = 0; i < records.length; i++) {
    const current = records[i]

    // score 唯一性
    if (seenScores.has(current.score)) {
      return { valid: false, reason: `score 重复: ${current.score}` }
    }
    seenScores.add(current.score)

    // score 降序
    if (i > 0) {
      const prev = records[i - 1]
      if (current.score >= prev.score) {
        return {
          valid: false,
          reason: `score 非降序: ${prev.score} → ${current.score}`,
        }
      }

      // cumulativeCount 递增
      if (current.cumulativeCount <= prev.cumulativeCount) {
        return {
          valid: false,
          reason: `cumulativeCount 非递增: ${prev.cumulativeCount} → ${current.cumulativeCount}`,
        }
      }
    }
  }

  return { valid: true }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/rank_tables/__tests__/validate.test.ts`
Expected: PASS（9 个测试通过）

- [ ] **Step 5: Commit**

```bash
git add scripts/scrapers/rank_tables/validate.ts scripts/scrapers/rank_tables/__tests__/validate.test.ts
git commit -m "feat(scraper): add rank table validator"
```

---

## Task 11: rank_tables/index.ts — 一分一段表采集编排

**Files:**
- Create: `scripts/scrapers/rank_tables/index.ts`

- [ ] **Step 1: 实现 `scripts/scrapers/rank_tables/index.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { parseZjTable } from './zhejiang'
import { parseJsTable } from './jiangsu'
import { validateRankRecord, validateRankTableMonotonicity } from './validate'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  ZJ_RANK_TABLE_URLS,
  JS_RANK_TABLE_URLS,
  SCORES_OUTPUT_DIR,
  LOGS_DIR,
  TARGET_YEARS,
} from '../config'
import type {
  RankTableRecord,
  RankTableFile,
} from '../types'

const logger = createLogger('rank_tables')

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

  logger.info('开始一分一段表采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    dryRun: args.dryRun,
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  const http = new HttpClient(path.join(process.cwd(), 'raw', 'rank_tables'))
  const results: Array<{ province: string; year: number; count: number }> = []
  const errors: Array<{ province: string; year: number; category?: string; error: string }> = []

  // 浙江（综合类单表）
  for (const year of TARGET_YEARS) {
    const url = ZJ_RANK_TABLE_URLS[year]
    if (!url) {
      logger.warn('浙江一分一段表 URL 未配置', { year })
      errors.push({ province: '浙江', year, error: 'URL 未配置' })
      continue
    }

    try {
      logger.info('抓取浙江一分一段表', { year, url })
      const result = await http.fetch(url, {
        cacheKey: `zj_rank_${year}`,
        forceRefresh: args.force,
      })
      const records = parseZjTable(result.html, year, url)

      // 校验
      const validated = records.filter((r) => validateRankRecord(r).valid)
      const monotonicity = validateRankTableMonotonicity(validated)
      if (!monotonicity.valid) {
        logger.warn('浙江一分一段表单调性校验失败', { year, reason: monotonicity.reason })
      }

      // 写入文件
      await writeRankTableFile('浙江', year, { '综合': validated })
      results.push({ province: '浙江', year, count: validated.length })
      logger.info('浙江一分一段表完成', { year, count: validated.length })
    } catch (error) {
      logger.error('浙江一分一段表抓取失败', { year, error: (error as Error).message })
      errors.push({ province: '浙江', year, error: (error as Error).message })
    }
  }

  // 江苏（物理类 + 历史类双表）
  for (const year of TARGET_YEARS) {
    const urls = JS_RANK_TABLE_URLS[year]
    if (!urls || (!urls['物理类'] && !urls['历史类'])) {
      logger.warn('江苏一分一段表 URL 未配置', { year })
      errors.push({ province: '江苏', year, error: 'URL 未配置' })
      continue
    }

    const categories: Record<string, RankTableRecord[]> = {}

    for (const category of ['物理类', '历史类'] as const) {
      const url = urls[category]
      if (!url) {
        logger.warn('江苏一分一段表 URL 未配置', { year, category })
        errors.push({ province: '江苏', year, category, error: 'URL 未配置' })
        continue
      }

      try {
        logger.info('抓取江苏一分一段表', { year, category, url })
        const result = await http.fetch(url, {
          cacheKey: `js_rank_${year}_${category}`,
          forceRefresh: args.force,
        })
        const records = parseJsTable(result.html, year, category, url)

        // 校验
        const validated = records.filter((r) => validateRankRecord(r).valid)
        const monotonicity = validateRankTableMonotonicity(validated)
        if (!monotonicity.valid) {
          logger.warn('江苏一分一段表单调性校验失败', {
            year, category, reason: monotonicity.reason,
          })
        }

        categories[category] = validated
      } catch (error) {
        logger.error('江苏一分一段表抓取失败', {
          year, category, error: (error as Error).message,
        })
        errors.push({ province: '江苏', year, category, error: (error as Error).message })
      }
    }

    const totalCount = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0)
    if (totalCount > 0) {
      await writeRankTableFile('江苏', year, categories)
      results.push({ province: '江苏', year, count: totalCount })
      logger.info('江苏一分一段表完成', { year, count: totalCount })
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

  const logPath = path.join(LOGS_DIR, `scrape-rank-tables-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')
}

async function writeRankTableFile(
  province: string,
  year: number,
  categories: Record<string, RankTableRecord[]>
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
      source: province === '浙江' ? 'zjzs' : 'jseea',
      sourceUrl: province === '浙江'
        ? ZJ_RANK_TABLE_URLS[year] || ''
        : (JS_RANK_TABLE_URLS[year]?.['物理类'] || ''),
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

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
npx tsc --noEmit --esModuleInterop --moduleResolution node --target es2023 --module esnext --types node --skipLibCheck scripts/scrapers/rank_tables/index.ts
```
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add scripts/scrapers/rank_tables/index.ts
git commit -m "feat(scraper): add rank tables orchestration entry point"
```

---

## Task 12: rank_tables 端到端冒烟测试

**Files:**
- Create: `scripts/scrapers/rank_tables/__tests__/e2e.test.ts`

- [ ] **Step 1: 写端到端测试 `scripts/scrapers/rank_tables/__tests__/e2e.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjTable } from '../zhejiang'
import { parseJsTable } from '../jiangsu'
import { validateRankRecord, validateRankTableMonotonicity } from '../validate'
import type { RankTableRecord, RankTableFile } from '../../types'

const zjFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.html'),
  'utf-8'
)
const jsFixture = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'jiangsu_sample.html'),
  'utf-8'
)

describe('rank_tables 端到端冒烟测试', () => {
  it('浙江完整流程：parse → validate → output', () => {
    const records = parseZjTable(zjFixture, 2025, 'https://zjzs.net/test')
    expect(records.length).toBeGreaterThan(0)

    // 校验所有记录
    const validated: RankTableRecord[] = []
    for (const record of records) {
      const result = validateRankRecord(record)
      expect(result.valid).toBe(true)
      validated.push(record)
    }

    // 单调性校验
    const monotonicity = validateRankTableMonotonicity(validated)
    expect(monotonicity.valid).toBe(true)

    // 断言 _meta 字段完整
    for (const record of validated) {
      expect(record._meta.source).toBe('zjzs')
      expect(record._meta.verified).toBe(true)
      expect(record._meta.scraperVersion).toBeDefined()
      expect(record._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }

    // 断言浙江为综合类
    expect(validated.every((r) => r.province === '浙江')).toBe(true)
    expect(validated.every((r) => r.category === '综合')).toBe(true)
  })

  it('江苏完整流程：parse → validate → output（物理类+历史类）', () => {
    const physicsRecords = parseJsTable(jsFixture, 2025, '物理类', 'https://jseea.cn/test')
    const historyRecords = parseJsTable(jsFixture, 2025, '历史类', 'https://jseea.cn/test')

    expect(physicsRecords.length).toBeGreaterThan(0)
    expect(historyRecords.length).toBeGreaterThan(0)

    // 校验
    for (const record of [...physicsRecords, ...historyRecords]) {
      const result = validateRankRecord(record)
      expect(result.valid).toBe(true)
    }

    // 单调性校验
    expect(validateRankTableMonotonicity(physicsRecords).valid).toBe(true)
    expect(validateRankTableMonotonicity(historyRecords).valid).toBe(true)

    // 断言科类正确
    expect(physicsRecords.every((r) => r.category === '物理类')).toBe(true)
    expect(historyRecords.every((r) => r.category === '历史类')).toBe(true)
    expect(physicsRecords.every((r) => r.province === '江苏')).toBe(true)
  })

  it('RankTableFile 结构正确', () => {
    const records = parseZjTable(zjFixture, 2025, 'https://zjzs.net/test')
    const file: RankTableFile = {
      province: '浙江',
      year: 2025,
      categories: { '综合': records },
      _meta: {
        generatedAt: new Date().toISOString(),
        scraperVersion: '1.0.0',
        source: 'zjzs',
        sourceUrl: 'https://zjzs.net/test',
        recordCount: records.length,
      },
    }

    expect(file.province).toBe('浙江')
    expect(file.year).toBe(2025)
    expect(file.categories['综合'].length).toBeGreaterThan(0)
    expect(file._meta.recordCount).toBe(records.length)
    expect(file._meta.source).toBe('zjzs')
  })
})
```

- [ ] **Step 2: 运行端到端测试**

Run: `npx vitest run scripts/scrapers/rank_tables/__tests__/e2e.test.ts`
Expected: PASS（3 个测试通过）

- [ ] **Step 3: 运行全部 scraper 测试**

Run: `npm run test:scrapers`
Expected: 所有测试通过（含原有 colleges 测试 + 新增 scores/rank_tables 测试）

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapers/rank_tables/__tests__/e2e.test.ts
git commit -m "test(scraper): add rank tables e2e smoke test"
```

---

## Task 13: npm scripts 扩展与首次采集

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 package.json 中添加新的 scripts**

在 `scripts` 字段中追加（保留已有 scripts）：

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

- [ ] **Step 2: Commit scripts 配置**

```bash
git add package.json
git commit -m "chore: add scores and rank_tables npm scripts"
```

- [ ] **Step 3: 运行一分一段表采集（先跑这个，因为分数线采集耗时较长）**

Run:
```bash
npm run scrape:rank_tables
```
Expected: 脚本运行，输出采集报告。若 URL 未配置（config.ts 中为空字符串），会输出警告并跳过。这是预期行为——实际 URL 需在实现时确认填入。

- [ ] **Step 4: 运行分数线采集**

Run:
```bash
npm run scrape:scores
```
Expected: 脚本运行约 25 分钟（2900+ 院校 × 0.5s/请求），输出采集报告。

- [ ] **Step 5: 验证产出文件**

Run:
```bash
ls -la public/data/scores/zhejiang/ public/data/scores/jiangsu/ 2>/dev/null
ls -la public/data/scores/scores.meta.json 2>/dev/null
```
Expected: 分数线和一分一段表文件存在

- [ ] **Step 6: 验证分数线数据格式**

Run:
```bash
node -e "const d=require('./public/data/scores/zhejiang/scores_2025.json'); console.log('记录数:', d.length); console.log('首条:', JSON.stringify(d[0], null, 2))" 2>/dev/null || echo "文件不存在或为空"
```
Expected: 记录数 > 0，首条记录包含完整字段和 `_meta`

- [ ] **Step 7: 验证一分一段表数据格式**

Run:
```bash
node -e "const d=require('./public/data/scores/zhejiang/rank_table_2025.json'); console.log('记录数:', d._meta.recordCount); console.log('categories:', Object.keys(d.categories))" 2>/dev/null || echo "文件不存在或为空"
```
Expected: 记录数 > 0，categories 包含 '综合'

- [ ] **Step 8: Commit 产出数据**

```bash
git add public/data/scores/
git commit -m "data: add scores and rank table data (first scrape)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] §2 目录布局 → Task 1-13 覆盖所有目录和文件
- [x] §3.1 ScoreRecord Schema → Task 1 类型定义 + Task 4 解析器产出
- [x] §3.2 RankTableRecord + RankTableFile → Task 1 类型定义 + Task 8/9 解析器产出
- [x] §3.3 ScoresMeta → Task 6 buildScoresMeta 函数
- [x] §3.4 溯源字段使用规则 → Task 4/8/9 _meta 字段生成
- [x] §3.5 分数线校验规则 → Task 5 validateScoreRecord
- [x] §3.5 一分一段表校验规则 → Task 10 validateRankRecord + validateRankTableMonotonicity
- [x] §4.1 数据源选择 → Task 1 config.ts 配置 URL
- [x] §4.2 分数线采集流程 5 步 → Task 6 index.ts 编排
- [x] §4.3 一分一段表采集流程 4 步 → Task 11 index.ts 编排
- [x] §4.4 容错与重试 → 复用已有 HttpClient
- [x] §4.4 增量采集 → 复用已有 Cache + --force
- [x] §5.1 模块依赖关系 → Task 2-12 按依赖顺序实现
- [x] §5.2 各模块职责 → 每个 Task 对应一个模块
- [x] §5.3 配置扩展 → Task 1
- [x] §5.4 npm scripts → Task 13
- [x] §5.5 错误处理与退出码 → Task 6/11 index.ts
- [x] §6.1 测试策略 → Task 4/5/7/8/9/10/12 单元+端到端测试
- [x] §6.4 监控可观测性 → Task 6/11 采集报告
- [x] §7.1 实施顺序 → Task 1-13 按顺序
- [x] §7.2 验收标准 → Task 13 验证产出

**Placeholder scan:** 无 TBD/TODO，所有步骤含完整代码

**Type consistency:** `ScoreRecord`、`RankTableRecord`、`RankTableFile`、`ScoresMeta` 等类型在 Task 1 定义后，后续 Task 引用一致；`parseScores`、`parseZjTable`、`parseJsTable`、`validateScoreRecord`、`validateRankRecord`、`validateRankTableMonotonicity` 函数签名跨 Task 一致

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-scores-ranktables-collection.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
