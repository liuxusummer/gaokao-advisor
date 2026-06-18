# 投档线采集实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 采集浙江/江苏 2023-2025 年高校招生投档线数据，替代失效的阳光高考数据源。

**Architecture:** 浙江为专业级投档线（Excel 解析），江苏为院校专业组级投档线（Excel/PDF 解析）。复用现有 HttpClient/Cache/colleges_loader，重写 scores 模块为投档线采集器。

**Tech Stack:** Node.js + TypeScript + tsx + xlsx（已安装 ^0.18.5）+ pdf-parse（已安装 ^2.4.5）+ Vitest

**Spec:** [2026-06-18-scores-toudang-collection-design.md](../specs/2026-06-18-scores-toudang-collection-design.md)

---

## 文件结构

**新建：**
- `scripts/scrapers/scores/zhejiang.ts` — 浙江投档线 Excel 解析器
- `scripts/scrapers/scores/jiangsu.ts` — 江苏投档线 Excel/PDF 解析器
- `scripts/scrapers/scores/__fixtures__/zhejiang_sample.xls` — 浙江 Excel 测试样本
- `scripts/scrapers/scores/__fixtures__/jiangsu_physics_sample.xls` — 江苏物理类 Excel 测试样本
- `scripts/scrapers/scores/__fixtures__/jiangsu_2025_pdf_sample.txt` — 江苏 2025 PDF 文本样本
- `scripts/scrapers/scores/__tests__/zhejiang.test.ts` — 浙江解析器测试
- `scripts/scrapers/scores/__tests__/jiangsu.test.ts` — 江苏解析器测试

**修改：**
- `scripts/scrapers/types.ts` — 扩展 ScoreRecord（新增 tieBreakers）、ScoreRecordMeta（source 新增 zjzs/jseea）、新增 TieBreakers 接口
- `scripts/scrapers/config.ts` — 新增 ZJ_TOUDANG_URLS、JS_TOUDANG_URLS 配置
- `scripts/scrapers/scores/validate.ts` — 适配投档线校验规则（minRank 允许 0、tieBreakers 校验、移除 verified 校验）
- `scripts/scrapers/scores/index.ts` — 重写编排入口（投档线采集流程）
- `scripts/scrapers/scores/__tests__/validate.test.ts` — 适配新校验规则
- `scripts/scrapers/scores/__tests__/e2e.test.ts` — 重写端到端测试

**删除：**
- `scripts/scrapers/scores/gaokao_score.ts` — 阳光高考解析器（已确认不可用）
- `scripts/scrapers/scores/__tests__/gaokao_score.test.ts` — 对应测试
- `scripts/scrapers/scores/__fixtures__/gaokao_score_sample.html` — 对应 fixture

---

## Task 1: 扩展类型定义

**Files:**
- Modify: `scripts/scrapers/types.ts:116-144`

- [ ] **Step 1: 修改 ScoreRecord 和 ScoreRecordMeta，新增 TieBreakers**

打开 `scripts/scrapers/types.ts`，将第 116-144 行（ScoreRecord 和 ScoreRecordMeta 定义）替换为：

```typescript
// === 分数线采集类型 ===

export interface TieBreakers {
  chineseMathSum?: number       // (一) 语数成绩之和
  chineseMathMax?: number       // (二) 语数最高成绩
  foreignLanguage?: number      // (三) 外语成绩
  preferredSubject?: number     // (四) 首选科目成绩（物理/历史）
  reselectSubjectMax?: number   // (五) 再选科目最高成绩
  volunteerOrder?: number       // (六) 志愿号
}

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
  tieBreakers?: TieBreakers
  _meta: ScoreRecordMeta
}

export interface ScoreRecordMeta {
  source: 'gaokao' | 'zjzs' | 'jseea'
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean
}
```

- [ ] **Step 2: 运行类型检查验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/types.ts
git commit -m "feat(scores): 扩展 ScoreRecord 类型支持投档线字段"
```

---

## Task 2: 新增投档线 URL 配置

**Files:**
- Modify: `scripts/scrapers/config.ts:109-110`

- [ ] **Step 1: 在 config.ts 末尾追加投档线 URL 配置**

在 `scripts/scrapers/config.ts` 的最后一行（`export const SCORES_REPORTS_DIR = ...`）之后追加：

```typescript

// === 投档线采集 URL 配置 ===

// 浙江省考试院投档线（专业级，Excel 格式）
export const ZJ_TOUDANG_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2023: {
    pageUrl: 'https://www.zjzs.net/art/2023/7/19/art_155_2089.html',
    xlsUrl: 'https://www.zjzs.net/picture/0/plug-in/ueditor/jsp/upload/2023719/1689731170158052765.xls',
  },
  2024: {
    pageUrl: 'https://www.zjzs.net/art/2024/7/21/art_155_9900.html',
    xlsUrl: 'https://www.zjzs.net/attach/0/80bebb3cf9b743aa800299669b4c6db5.xls',
  },
  2025: {
    pageUrl: 'https://www.zjzs.net/art/2025/7/21/art_155_11451.html',
    xlsUrl: 'https://www.zjzs.net/attach/0/c4110ef9c01a4b6ba1e231c2b5d2462f.xls',
  },
}

// 江苏省考试院投档线（院校专业组级，2023/2024 Excel，2025 PDF）
export const JS_TOUDANG_URLS: Record<number, {
  files: Record<'物理类' | '历史类', { pageUrl: string; url: string; format: 'xls' | 'pdf' }>
}> = {
  2023: {
    files: {
      '物理类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2023-07-18/7086888854866628608.html',
        url: 'https://www.jseea.cn/webfile/upload/2023/07-18/10-05-510166-183377989.xls',
        format: 'xls',
      },
      '历史类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2023-07-18/7086888854866628608.html',
        url: 'https://www.jseea.cn/webfile/upload/2023/07-18/10-05-510148-1404562985.xls',
        format: 'xls',
      },
    },
  },
  2024: {
    files: {
      '物理类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2024-07-18/7219509116052443136.html',
        url: 'https://www.jseea.cn/webfile/upload/2024/07-18/11-00-490856-746889704.xls',
        format: 'xls',
      },
      '历史类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2024-07-18/7219509116052443136.html',
        url: 'https://www.jseea.cn/webfile/upload/2024/07-18/09-11-430408314109108.xls',
        format: 'xls',
      },
    },
  },
  2025: {
    files: {
      '物理类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2025-07-18/7351781448019349504.html',
        url: 'https://www.jseea.cn/webfile/upload/2025/07-18/09-33-5302461102655621.pdf',
        format: 'pdf',
      },
      '历史类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2025-07-18/7351781284785426432.html',
        url: 'https://www.jseea.cn/webfile/upload/2025/07-18/09-33-380724-1917118608.pdf',
        format: 'pdf',
      },
    },
  },
}
```

- [ ] **Step 2: 运行类型检查验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/config.ts
git commit -m "feat(scores): 新增浙江/江苏投档线 URL 配置"
```

---

## Task 3: 删除阳光高考相关文件

**Files:**
- Delete: `scripts/scrapers/scores/gaokao_score.ts`
- Delete: `scripts/scrapers/scores/__tests__/gaokao_score.test.ts`
- Delete: `scripts/scrapers/scores/__fixtures__/gaokao_score_sample.html`

- [ ] **Step 1: 删除三个文件**

```bash
rm scripts/scrapers/scores/gaokao_score.ts
rm scripts/scrapers/scores/__tests__/gaokao_score.test.ts
rm scripts/scrapers/scores/__fixtures__/gaokao_score_sample.html
```

- [ ] **Step 2: 验证现有测试（预期 validate 和 e2e 测试会失败，因为依赖被删除）**

Run: `npx vitest run scripts/scrapers/scores 2>&1 | tail -20`
Expected: validate.test.ts 和 e2e.test.ts 编译失败（import 路径不存在）

- [ ] **Step 3: 提交**

```bash
git add -A scripts/scrapers/scores/
git commit -m "refactor(scores): 删除失效的阳光高考解析器"
```

---

## Task 4: 创建浙江投档线测试 fixture

**Files:**
- Create: `scripts/scrapers/scores/__fixtures__/zhejiang_sample.xls`

- [ ] **Step 1: 编写生成 fixture 的脚本**

创建临时脚本 `scripts/scrapers/scores/__fixtures__/_gen_zhejiang_sample.mjs`：

```javascript
import * as XLSX from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'

// 模拟浙江投档线 Excel 结构
// 实际文件前几行是标题，数据行从"学校代号"表头之后开始
const data = [
  ['浙江省2025年普通高校招生普通类第一段平行投档分数线表'],
  [],
  ['学校代号', '学校名称', '专业代号', '专业名称', '计划数', '分数线', '位次'],
  ['0001', '浙江大学', '001', '人文科学试验班', 80, 672, 4122],
  ['0001', '浙江大学', '002', '新闻传播学类', 55, 670, 4596],
  ['0001', '浙江大学', '003', '外国语言文学类', 28, 671, 4422],
  ['0001', '浙江大学', '015', '工科试验班(信息)', 247, 686, 1184],
  ['0001', '浙江大学', '016', '工科试验班(竺可桢学院图灵班)', 3, 699, 220],
  ['0002', '杭州电子科技大学', '001', '计算机科学与技术', 120, 645, 12500],
  ['0002', '杭州电子科技大学', '002', '软件工程', 60, 640, 14500],
  ['0003', '浙江工业大学', '001', '化学工程与工艺', 90, 620, 25000],
  ['0003', '浙江工业大学', '002', '机械工程', 80, 615, 28000],
]

const ws = XLSX.utils.aoa_to_sheet(data)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '第一段投档线')

const outPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'zhejiang_sample.xls')
XLSX.writeFile(wb, outPath, { bookType: 'biff8' })
console.log('Fixture 已生成:', outPath)
```

- [ ] **Step 2: 运行脚本生成 fixture**

Run: `node scripts/scrapers/scores/__fixtures__/_gen_zhejiang_sample.mjs`
Expected: 输出 "Fixture 已生成: .../zhejiang_sample.xls"

- [ ] **Step 3: 删除临时脚本**

```bash
rm scripts/scrapers/scores/__fixtures__/_gen_zhejiang_sample.mjs
```

- [ ] **Step 4: 验证 fixture 文件存在**

Run: `ls -la scripts/scrapers/scores/__fixtures__/zhejiang_sample.xls`
Expected: 文件存在，大小 > 1KB

- [ ] **Step 5: 提交**

```bash
git add scripts/scrapers/scores/__fixtures__/zhejiang_sample.xls
git commit -m "test(scores): 新增浙江投档线 Excel 测试 fixture"
```

---

## Task 5: 编写浙江投档线解析器测试（TDD - 先写失败测试）

**Files:**
- Create: `scripts/scrapers/scores/__tests__/zhejiang.test.ts`

- [ ] **Step 1: 编写测试文件**

创建 `scripts/scrapers/scores/__tests__/zhejiang.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjToudang } from '../zhejiang'

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.xls')
const fixtureBuffer = fs.readFileSync(fixturePath)

describe('parseZjToudang', () => {
  it('正确解析 10 条记录', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    expect(records).toHaveLength(10)
  })

  it('第一条记录为浙江大学人文科学试验班', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    const first = records[0]
    expect(first.collegeName).toBe('浙江大学')
    expect(first.majorName).toBe('人文科学试验班')
    expect(first.majorCode).toBe('001')
    expect(first.minScore).toBe(672)
    expect(first.minRank).toBe(4122)
    expect(first.planCount).toBe(80)
  })

  it('province 为浙江，category 为综合，batch 为普通类第一段', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    expect(records.every((r) => r.province === '浙江')).toBe(true)
    expect(records.every((r) => r.category === '综合')).toBe(true)
    expect(records.every((r) => r.batch === '普通类第一段')).toBe(true)
  })

  it('year 传入正确', () => {
    const records = parseZjToudang(fixtureBuffer, 2024, 'https://zjzs.net/test')
    expect(records.every((r) => r.year === 2024)).toBe(true)
  })

  it('每条记录包含 _meta 溯源字段', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    for (const r of records) {
      expect(r._meta.source).toBe('zjzs')
      expect(r._meta.sourceUrl).toBe('https://zjzs.net/test')
      expect(r._meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(r._meta.scraperVersion).toBeDefined()
      expect(r._meta.verified).toBe(false) // 解析阶段未关联白名单
    }
  })

  it('minScore 和 minRank 为数字类型', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    for (const r of records) {
      expect(typeof r.minScore).toBe('number')
      expect(typeof r.minRank).toBe('number')
      expect(Number.isFinite(r.minScore)).toBe(true)
      expect(Number.isFinite(r.minRank)).toBe(true)
    }
  })

  it('空 Buffer 返回空数组', () => {
    const records = parseZjToudang(Buffer.from(''), 2025, 'https://zjzs.net/test')
    expect(records).toEqual([])
  })

  it('跳过标题行和空行', () => {
    const records = parseZjToudang(fixtureBuffer, 2025, 'https://zjzs.net/test')
    // 标题行和表头行不应产生记录
    // fixture 有 2 行标题 + 1 行表头 + 10 行数据 = 13 行
    expect(records).toHaveLength(10)
    // 第一条数据不应是标题文本
    expect(records[0].collegeName).not.toContain('浙江省')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/scores/__tests__/zhejiang.test.ts 2>&1 | tail -20`
Expected: FAIL — `Cannot find module '../zhejiang'` 或 `parseZjToudang is not a function`

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/__tests__/zhejiang.test.ts
git commit -m "test(scores): 新增浙江投档线解析器测试（失败）"
```

---

## Task 6: 实现浙江投档线解析器

**Files:**
- Create: `scripts/scrapers/scores/zhejiang.ts`

- [ ] **Step 1: 实现解析器**

创建 `scripts/scrapers/scores/zhejiang.ts`：

```typescript
import * as XLSX from 'xlsx'
import { SCRAPER_VERSION } from '../config'
import type { ScoreRecord } from '../types'

/**
 * 解析浙江省投档线 Excel 文件。
 *
 * Excel 结构（.xls 格式）：
 *   行 1: 标题（如"浙江省2025年普通高校招生普通类第一段平行投档分数线表"）
 *   行 2: 空行
 *   行 3: 表头（学校代号 | 学校名称 | 专业代号 | 专业名称 | 计划数 | 分数线 | 位次）
 *   行 4+: 数据行
 *
 * 数据粒度：专业级（每行一个院校的一个专业）
 * 科类：综合（浙江新高考不分文理）
 */
export function parseZjToudang(
  buffer: Buffer,
  year: number,
  sourceUrl: string
): ScoreRecord[] {
  if (!buffer || buffer.length === 0) {
    return []
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  })

  // 定位表头行（包含"学校代号"的行）
  let headerRowIndex = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row && row.some((cell) => String(cell).trim() === '学校代号')) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return []

  const records: ScoreRecord[] = []
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const collegeName = String(row[1] ?? '').trim()
    const majorCode = String(row[2] ?? '').trim()
    const majorName = String(row[3] ?? '').trim()
    const planCount = Number(row[4])
    const minScore = Number(row[5])
    const minRank = Number(row[6])

    // 跳过空行和无效数据
    if (!collegeName || !majorName) continue
    if (!Number.isFinite(minScore) || !Number.isFinite(minRank)) continue

    records.push({
      collegeId: '', // 由编排入口通过院校名匹配填充
      collegeName,
      year,
      majorName,
      majorCode: majorCode || undefined,
      province: '浙江',
      category: '综合',
      batch: '普通类第一段',
      minScore,
      minRank,
      planCount: Number.isFinite(planCount) ? planCount : undefined,
      _meta: {
        source: 'zjzs',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false, // 解析阶段未关联白名单
      },
    })
  }

  return records
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/scores/__tests__/zhejiang.test.ts 2>&1 | tail -20`
Expected: PASS — 8 个用例全部通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/zhejiang.ts
git commit -m "feat(scores): 实现浙江投档线 Excel 解析器"
```

---

## Task 7: 创建江苏投档线测试 fixture（Excel）

**Files:**
- Create: `scripts/scrapers/scores/__fixtures__/jiangsu_physics_sample.xls`

- [ ] **Step 1: 编写生成 fixture 的脚本**

创建临时脚本 `scripts/scrapers/scores/__fixtures__/_gen_jiangsu_sample.mjs`：

```javascript
import * as XLSX from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'

// 模拟江苏投档线 Excel 结构
// 前 5 行为标题/表头合并单元格，数据从第 6 行开始
// 9 列：院校代号 | 院校专业组(再选科目) | 投档最低分 | (一)语数之和 | (二)语数最高 | (三)外语 | (四)首选 | (五)再选最高 | (六)志愿号
const data = [
  ['江苏省2024年普通高校招生本科批次平行志愿投档线'],
  ['（物理等科目类）'],
  [],
  ['院校代号', '院校、专业组（再选科目要求）', '投档最低分', '同分考生排序项', '', '', '', '', ''],
  ['', '', '', '(一)语数成绩', '(二)语数最高', '(三)外语', '(四)首选科目', '(五)再选最高', '(六)志愿号'],
  ['1101', '南京大学01专业组(不限)', 638, 230, 128, 141, 79, 95, 1],
  ['1101', '南京大学02专业组(化学)', 635, 225, 125, 138, 78, 92, 1],
  ['1101', '南京大学03专业组(思想政治)', 630, 220, 120, 135, 76, 90, 2],
  ['1105', '河海大学01专业组(不限)', 601, 210, 115, 130, 70, 85, 1],
  ['1105', '河海大学02专业组(不限)', 596, 205, 112, 128, 68, 82, 1],
  ['1105', '河海大学03专业组(思想政治)', 600, 208, 114, 129, 69, 84, 1],
  ['1106', '南京理工大学01专业组(化学)', 610, 215, 118, 132, 72, 88, 1],
  ['1106', '南京理工大学02专业组(中外合作办学)', 580, 195, 108, 122, 64, 78, 1],
  ['注：在投档过程中，普通类考生投档分相同时，依次按语文数学两科成绩之和、语文或数学单科最高成绩、外语单科成绩、首选科目单科成绩、再选科目单科最高成绩由高到低排序投档；如仍相同，比较考生志愿顺序，顺序在前者优先投档，志愿顺序相同则全部投档。'],
]

const ws = XLSX.utils.aoa_to_sheet(data)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '投档线')

const outPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'jiangsu_physics_sample.xls')
XLSX.writeFile(wb, outPath, { bookType: 'biff8' })
console.log('Fixture 已生成:', outPath)
```

- [ ] **Step 2: 运行脚本生成 fixture**

Run: `node scripts/scrapers/scores/__fixtures__/_gen_jiangsu_sample.mjs`
Expected: 输出 "Fixture 已生成: .../jiangsu_physics_sample.xls"

- [ ] **Step 3: 删除临时脚本**

```bash
rm scripts/scrapers/scores/__fixtures__/_gen_jiangsu_sample.mjs
```

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/scores/__fixtures__/jiangsu_physics_sample.xls
git commit -m "test(scores): 新增江苏投档线 Excel 测试 fixture"
```

---

## Task 8: 创建江苏 2025 PDF 文本 fixture

**Files:**
- Create: `scripts/scrapers/scores/__fixtures__/jiangsu_2025_pdf_sample.txt`

- [ ] **Step 1: 创建 PDF 文本样本文件**

创建 `scripts/scrapers/scores/__fixtures__/jiangsu_2025_pdf_sample.txt`：

```
江苏省2025年普通高校招生本科批次平行志愿投档线
（物理等科目类）
江
院校代号 院校、专业组（再选科目要求） 投档最低分 (一)语数成绩 (二)语数最高 (三)外语 (四)首选科目 (五)再选最高 (六)志愿号
苏
1101 南京大学01专业组(不限) 638 230 128 141 79 95 1
1101 南京大学02专业组(化学) 635 225 125 138 78 92 1
省
1101 南京大学03专业组(思想政治) 630 220 120 135 76 90 2
1105 河海大学01专业组(不限) 601 210 115 130 70 85 1
教
1105 河海大学02专业组(不限) 596 205 112 128 68 82 1
1105 河海大学03专业组(思想政治) 600 208 114 129 69 84 1
育
1106 南京理工大学01专业组(化学) 610 215 118 132 72 88 1
1106 南京理工大学02专业组(中外合作办学) 580 195 108 122 64 78 1
考
注：在投档过程中，普通类考生投档分相同时，依次按语文数学两科成绩之和、语文或数学单科最高成绩、外语单科成绩、首选科目单科成绩、再选科目单科最高成绩由高到低排序投档。
试
```

- [ ] **Step 2: 提交**

```bash
git add scripts/scrapers/scores/__fixtures__/jiangsu_2025_pdf_sample.txt
git commit -m "test(scores): 新增江苏 2025 PDF 文本测试样本"
```

---

## Task 9: 编写江苏投档线解析器测试（TDD - 先写失败测试）

**Files:**
- Create: `scripts/scrapers/scores/__tests__/jiangsu.test.ts`

- [ ] **Step 1: 编写测试文件**

创建 `scripts/scrapers/scores/__tests__/jiangsu.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseJsToudangExcel, parseJsToudangPdf } from '../jiangsu'

const xlsFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_physics_sample.xls')
const xlsFixtureBuffer = fs.readFileSync(xlsFixturePath)

const pdfFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_2025_pdf_sample.txt')
const pdfFixtureText = fs.readFileSync(pdfFixturePath, 'utf-8')

describe('parseJsToudangExcel', () => {
  it('正确解析 8 条记录', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(8)
  })

  it('第一条记录为南京大学01专业组', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const first = records[0]
    expect(first.collegeName).toBe('南京大学')
    expect(first.majorGroup).toBe('01')
    expect(first.majorGroupName).toBe('南京大学01专业组(不限)')
    expect(first.majorName).toBe('南京大学01专业组(不限)')
    expect(first.minScore).toBe(638)
    expect(first.minRank).toBe(0) // 江苏投档线无位次
  })

  it('专业组名正确拆分', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const r = records.find((x) => x.majorGroup === '02' && x.collegeName === '南京大学')
    expect(r).toBeDefined()
    expect(r!.majorGroupName).toBe('南京大学02专业组(化学)')
  })

  it('同分排序项 tieBreakers 正确填充', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const first = records[0]
    expect(first.tieBreakers).toBeDefined()
    expect(first.tieBreakers!.chineseMathSum).toBe(230)
    expect(first.tieBreakers!.chineseMathMax).toBe(128)
    expect(first.tieBreakers!.foreignLanguage).toBe(141)
    expect(first.tieBreakers!.preferredSubject).toBe(79)
    expect(first.tieBreakers!.reselectSubjectMax).toBe(95)
    expect(first.tieBreakers!.volunteerOrder).toBe(1)
  })

  it('category 为物理类', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.category === '物理类')).toBe(true)
  })

  it('province 为江苏，batch 为本科批', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.province === '江苏')).toBe(true)
    expect(records.every((r) => r.batch === '本科批')).toBe(true)
  })

  it('跳过末尾注释行', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    // 注释行不应产生记录
    expect(records.every((r) => !r.collegeName.startsWith('注'))).toBe(true)
  })

  it('复杂专业组名（中外合作办学）正确处理', () => {
    const records = parseJsToudangExcel(xlsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    const r = records.find((x) => x.majorGroupName?.includes('中外合作办学'))
    expect(r).toBeDefined()
    expect(r!.collegeName).toBe('南京理工大学')
    expect(r!.majorGroup).toBe('02')
  })

  it('空 Buffer 返回空数组', () => {
    const records = parseJsToudangExcel(Buffer.from(''), 2024, '物理类', 'https://jseea.cn/test')
    expect(records).toEqual([])
  })
})

describe('parseJsToudangPdf', () => {
  it('正确解析 8 条记录', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toHaveLength(8)
  })

  it('过滤水印字符（江/苏/省/教/育/考/试/院）', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    // 水印字符单独成行，不应产生记录
    expect(records.every((r) => r.collegeName.length > 1)).toBe(true)
    expect(records.every((r) => !'江苏省教育考试院'.includes(r.collegeName))).toBe(true)
  })

  it('第一条记录为南京大学01专业组', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    const first = records[0]
    expect(first.collegeName).toBe('南京大学')
    expect(first.majorGroup).toBe('01')
    expect(first.minScore).toBe(638)
  })

  it('minRank 为 0', () => {
    const records = parseJsToudangPdf(pdfFixtureText, 2025, '物理类', 'https://jseea.cn/test')
    expect(records.every((r) => r.minRank === 0)).toBe(true)
  })

  it('空文本返回空数组', () => {
    const records = parseJsToudangPdf('', 2025, '物理类', 'https://jseea.cn/test')
    expect(records).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run scripts/scrapers/scores/__tests__/jiangsu.test.ts 2>&1 | tail -20`
Expected: FAIL — `Cannot find module '../jiangsu'`

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/__tests__/jiangsu.test.ts
git commit -m "test(scores): 新增江苏投档线解析器测试（失败）"
```

---

## Task 10: 实现江苏投档线解析器

**Files:**
- Create: `scripts/scrapers/scores/jiangsu.ts`

- [ ] **Step 1: 实现解析器**

创建 `scripts/scrapers/scores/jiangsu.ts`：

```typescript
import * as XLSX from 'xlsx'
import { SCRAPER_VERSION } from '../config'
import type { ScoreRecord, TieBreakers } from '../types'

/**
 * 解析江苏省投档线 Excel 文件（2023/2024 年格式）。
 *
 * Excel 结构（.xls 格式）：
 *   行 1: 标题
 *   行 2: 科类说明
 *   行 3-5: 表头（合并单元格）
 *   行 6+: 数据行（9 列）
 *   末尾: 注释行
 *
 * 9 列：院校代号 | 院校专业组(再选科目) | 投档最低分 | (一)语数之和 | (二)语数最高 | (三)外语 | (四)首选 | (五)再选最高 | (六)志愿号
 */
export function parseJsToudangExcel(
  buffer: Buffer,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): ScoreRecord[] {
  if (!buffer || buffer.length === 0) {
    return []
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  })

  return parseRows(rows, year, category, sourceUrl)
}

/**
 * 解析江苏省投档线 PDF 文本（2025 年格式）。
 *
 * PDF 文本特点：
 *   - 含竖排水印字符（江/苏/省/教/育/考/试/院），散落在各行之间
 *   - 每行格式：院校代号 院校专业组(再选科目) 投档分 (一) (二) (三) (四) (五) (六)
 */
export function parseJsToudangPdf(
  text: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): ScoreRecord[] {
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const rows: unknown[][] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过水印字符（单独一行的单个中文字符）
    if (/^[江苏省教育考试院]$/.test(trimmed)) continue

    // 跳过标题和注释行
    if (/^(江苏省|注[：:])/.test(trimmed)) continue
    if (/院校代号|投档最低分|同分考生/.test(trimmed)) continue

    // 尝试按空格分割
    const parts = trimmed.split(/\s+/)
    if (parts.length < 9) continue

    // 第 1 部分是院校代号（数字）
    if (!/^\d+$/.test(parts[0])) continue

    // 第 2 部分是"院校名+专业组(再选科目)"，可能含空格
    // 从末尾取 7 个数字字段，剩余部分拼成院校专业组名
    if (parts.length < 9) continue

    const numericTail = parts.slice(-7)
    if (!numericTail.every((p) => /^\d+$/.test(p))) continue

    const nameParts = parts.slice(1, parts.length - 7)
    const fullName = nameParts.join(' ')
    if (!fullName) continue

    rows.push([
      parts[0],
      fullName,
      ...numericTail,
    ])
  }

  return parseRows(rows, year, category, sourceUrl)
}

/**
 * 从二维数组解析为 ScoreRecord[]。
 * 共用逻辑：Excel 和 PDF 文本都转换为相同格式的 rows 后调用此函数。
 */
function parseRows(
  rows: unknown[][],
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): ScoreRecord[] {
  const records: ScoreRecord[] = []

  for (const row of rows) {
    if (!row || row.length < 3) continue

    const collegeCode = String(row[0] ?? '').trim()
    const fullName = String(row[1] ?? '').trim()
    const minScore = Number(row[2])

    // 跳过空行和注释
    if (!collegeCode || !fullName) continue
    if (fullName.startsWith('注')) continue
    if (!/^\d+$/.test(collegeCode)) continue
    if (!Number.isFinite(minScore)) continue

    // 拆分"南京大学03专业组(不限)" → 院校名 + 专业组代码 + 再选科目
    const match = fullName.match(/^(.+?)(\d{2,3}专业组)\((.+?)\)$/)
    if (!match) continue

    const collegeName = match[1]
    const majorGroup = match[2].replace('专业组', '')
    const majorGroupName = fullName

    // 同分排序项（9 列格式才有）
    let tieBreakers: TieBreakers | undefined
    if (row.length >= 9) {
      const chineseMathSum = Number(row[3])
      const chineseMathMax = Number(row[4])
      const foreignLanguage = Number(row[5])
      const preferredSubject = Number(row[6])
      const reselectSubjectMax = Number(row[7])
      const volunteerOrder = Number(row[8])

      if (
        Number.isFinite(chineseMathSum) &&
        Number.isFinite(chineseMathMax) &&
        Number.isFinite(foreignLanguage) &&
        Number.isFinite(preferredSubject) &&
        Number.isFinite(reselectSubjectMax) &&
        Number.isFinite(volunteerOrder)
      ) {
        tieBreakers = {
          chineseMathSum,
          chineseMathMax,
          foreignLanguage,
          preferredSubject,
          reselectSubjectMax,
          volunteerOrder,
        }
      }
    }

    records.push({
      collegeId: '', // 由编排入口通过院校名匹配填充
      collegeName,
      year,
      majorName: majorGroupName, // 江苏专业组级无专业名，用专业组全名填充
      majorGroup,
      majorGroupName,
      province: '江苏',
      category,
      batch: '本科批',
      minScore,
      minRank: 0, // 江苏投档线无位次
      tieBreakers,
      _meta: {
        source: 'jseea',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false, // 解析阶段未关联白名单
      },
    })
  }

  return records
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/scores/__tests__/jiangsu.test.ts 2>&1 | tail -20`
Expected: PASS — 13 个用例全部通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/jiangsu.ts
git commit -m "feat(scores): 实现江苏投档线 Excel/PDF 解析器"
```

---

## Task 11: 适配校验器

**Files:**
- Modify: `scripts/scrapers/scores/validate.ts`

- [ ] **Step 1: 重写校验器**

将 `scripts/scrapers/scores/validate.ts` 全部内容替换为：

```typescript
import type { ScoreRecord, ScoreValidationResult } from '../types'

export function validateScoreRecord(record: ScoreRecord): ScoreValidationResult {
  const requiredFields: Array<keyof ScoreRecord> = [
    'collegeId', 'collegeName', 'year', 'majorName',
    'province', 'category', 'batch', 'minScore', 'minRank',
  ]

  for (const field of requiredFields) {
    const value = record[field]
    if (value === undefined || value === null) {
      return { valid: false, reason: `必填字段 ${String(field)} 为空` }
    }
    if (typeof value === 'string' && value === '') {
      // collegeId 允许为空（未匹配白名单时），其他字符串字段不允许
      if (field !== 'collegeId') {
        return { valid: false, reason: `必填字段 ${String(field)} 为空字符串` }
      }
    }
  }

  // minScore 范围校验：0-750
  if (record.minScore < 0 || record.minScore > 750) {
    return { valid: false, reason: `minScore 超出范围 (0-750): ${record.minScore}` }
  }

  // minRank 允许 0（江苏投档线无位次），但不能为负
  if (!Number.isInteger(record.minRank) || record.minRank < 0) {
    return { valid: false, reason: `minRank 必须为非负整数: ${record.minRank}` }
  }

  // year 合理性
  if (record.year < 2020 || record.year > 2025) {
    return { valid: false, reason: `year 不合理: ${record.year}` }
  }

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

  // tieBreakers 可选校验
  if (record.tieBreakers) {
    const tb = record.tieBreakers
    const tbFields: Array<keyof TieBreakers> = [
      'chineseMathSum', 'chineseMathMax', 'foreignLanguage',
      'preferredSubject', 'reselectSubjectMax', 'volunteerOrder',
    ]
    for (const f of tbFields) {
      const v = tb[f]
      if (v !== undefined && (typeof v !== 'number' || v < 0)) {
        return { valid: false, reason: `tieBreakers.${String(f)} 必须为非负数: ${v}` }
      }
    }
  }

  // _meta.verified 是溯源标记，不影响数据有效性
  return { valid: true }
}

// 本地类型引用（避免循环依赖）
type TieBreakers = import('../types').TieBreakers
```

- [ ] **Step 2: 运行现有测试（预期部分失败，需更新测试）**

Run: `npx vitest run scripts/scrapers/scores/__tests__/validate.test.ts 2>&1 | tail -30`
Expected: FAIL — 旧测试用例期望与新校验规则不符

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/validate.ts
git commit -m "feat(scores): 适配投档线校验规则（minRank 允许 0、tieBreakers 校验）"
```

---

## Task 12: 更新校验器测试

**Files:**
- Modify: `scripts/scrapers/scores/__tests__/validate.test.ts`

- [ ] **Step 1: 重写校验器测试**

将 `scripts/scrapers/scores/__tests__/validate.test.ts` 全部内容替换为：

```typescript
import { describe, it, expect } from 'vitest'
import { validateScoreRecord } from '../validate'
import type { ScoreRecord } from '../../types'

function makeValidRecord(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    collegeId: '4111010001',
    collegeName: '北京大学',
    year: 2025,
    majorName: '计算机科学与技术',
    province: '浙江',
    category: '综合',
    batch: '普通类第一段',
    minScore: 700,
    minRank: 100,
    _meta: {
      source: 'zjzs',
      sourceUrl: 'https://zjzs.net/test',
      fetchedAt: '2026-06-18T00:00:00.000Z',
      scraperVersion: '1.0.0',
      verified: true,
    },
    ...overrides,
  }
}

describe('validateScoreRecord', () => {
  it('合法记录通过校验', () => {
    const result = validateScoreRecord(makeValidRecord())
    expect(result.valid).toBe(true)
  })

  it('必填字段缺失 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ collegeName: '' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('collegeName')
  })

  it('minScore 超范围 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ minScore: 800 }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minScore')
  })

  it('minScore 为 0 → 成功', () => {
    const result = validateScoreRecord(makeValidRecord({ minScore: 0 }))
    expect(result.valid).toBe(true)
  })

  it('minRank 为 0 → 成功（江苏投档线无位次）', () => {
    const result = validateScoreRecord(makeValidRecord({ minRank: 0 }))
    expect(result.valid).toBe(true)
  })

  it('minRank 为负数 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ minRank: -1 }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('minRank')
  })

  it('year 不合理 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ year: 2019 }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('year')
  })

  it('province 非白名单 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ province: '上海' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('province')
  })

  it('浙江 category 非 综合 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ province: '浙江', category: '物理类' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('category')
  })

  it('江苏 category 非 物理类/历史类 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({ province: '江苏', category: '综合' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('category')
  })

  it('tieBreakers 含负数 → 失败', () => {
    const result = validateScoreRecord(makeValidRecord({
      tieBreakers: {
        chineseMathSum: -1,
        chineseMathMax: 128,
        foreignLanguage: 141,
        preferredSubject: 79,
        reselectSubjectMax: 95,
        volunteerOrder: 1,
      },
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('tieBreakers')
  })

  it('tieBreakers 合法 → 成功', () => {
    const result = validateScoreRecord(makeValidRecord({
      tieBreakers: {
        chineseMathSum: 230,
        chineseMathMax: 128,
        foreignLanguage: 141,
        preferredSubject: 79,
        reselectSubjectMax: 95,
        volunteerOrder: 1,
      },
    }))
    expect(result.valid).toBe(true)
  })

  it('verified=false → 成功（溯源标记不影响校验）', () => {
    const record = makeValidRecord({
      _meta: { ...makeValidRecord()._meta, verified: false },
    })
    const result = validateScoreRecord(record)
    expect(result.valid).toBe(true)
  })

  it('collegeId 为空 → 成功（未匹配白名单但仍保留）', () => {
    const result = validateScoreRecord(makeValidRecord({ collegeId: '' }))
    expect(result.valid).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run scripts/scrapers/scores/__tests__/validate.test.ts 2>&1 | tail -20`
Expected: PASS — 14 个用例全部通过

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/__tests__/validate.test.ts
git commit -m "test(scores): 更新校验器测试适配投档线规则"
```

---

## Task 13: 重写编排入口

**Files:**
- Modify: `scripts/scrapers/scores/index.ts`

- [ ] **Step 1: 重写编排入口**

将 `scripts/scrapers/scores/index.ts` 全部内容替换为：

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { HttpClient } from '../shared/http'
import { createLogger } from '../shared/logger'
import { loadColleges } from '../shared/colleges_loader'
import { parsePdf } from '../shared/pdf'
import { parseZjToudang } from './zhejiang'
import { parseJsToudangExcel, parseJsToudangPdf } from './jiangsu'
import { validateScoreRecord } from './validate'
import {
  SCRAPER_VERSION,
  SCHEMA_VERSION,
  OUTPUT_DIR,
  SCORES_OUTPUT_DIR,
  SCORES_REPORTS_DIR,
  LOGS_DIR,
  TARGET_YEARS,
  ZJ_TOUDANG_URLS,
  JS_TOUDANG_URLS,
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

  logger.info('开始投档线采集', {
    version: SCRAPER_VERSION,
    years: TARGET_YEARS,
    force: args.force,
    province: args.province ?? '全部',
  })

  fs.mkdirSync(SCORES_OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(SCORES_REPORTS_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })

  // Step 1: 加载院校白名单（按院校名建立索引）
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

  // Step 2-3: 下载并解析投档线文件
  const http = new HttpClient(path.join(process.cwd(), 'raw', 'scores'))
  const allScores: ScoreRecord[] = []
  const failed: FailedRecord[] = []
  const warnings: ScoreWarningRecord[] = []
  const stats: Array<{ province: string; year: number; category?: string; count: number; matched: number }> = []

  const shouldProcessZhejiang = !args.province || args.province === '浙江'
  const shouldProcessJiangsu = !args.province || args.province === '江苏'

  // 浙江投档线（专业级，Excel）
  if (shouldProcessZhejiang) {
    for (const year of TARGET_YEARS) {
      const urlConfig = ZJ_TOUDANG_URLS[year]
      if (!urlConfig) {
        logger.warn('浙江投档线 URL 未配置', { year })
        continue
      }

      try {
        logger.info('下载浙江投档线 Excel', { year, url: urlConfig.xlsUrl })
        const result = await http.fetchBinary(urlConfig.xlsUrl, {
          cacheKey: `zj_toudang_${year}.xls`,
          forceRefresh: args.force,
        })

        logger.info('解析浙江投档线', { year, bufferSize: result.buffer.length })
        const records = parseZjToudang(result.buffer, year, urlConfig.pageUrl)
        logger.info('浙江投档线解析完成', { year, count: records.length })

        // Step 4: 关联白名单
        const matched = matchColleges(records, collegesByName, warnings)
        allScores.push(...records)
        stats.push({ province: '浙江', year, count: records.length, matched })
      } catch (error) {
        logger.error('浙江投档线采集失败', { year, error: (error as Error).message })
        failed.push({
          url: urlConfig.xlsUrl,
          error: (error as Error).message,
          retryCount: 3,
          context: `浙江 ${year}`,
        })
      }
    }
  }

  // 江苏投档线（院校专业组级，Excel/PDF）
  if (shouldProcessJiangsu) {
    for (const year of TARGET_YEARS) {
      const urlConfig = JS_TOUDANG_URLS[year]
      if (!urlConfig) {
        logger.warn('江苏投档线 URL 未配置', { year })
        continue
      }

      for (const category of ['物理类', '历史类'] as const) {
        const fileConfig = urlConfig.files[category]
        if (!fileConfig) {
          logger.warn('江苏投档线 URL 未配置', { year, category })
          continue
        }

        try {
          logger.info('下载江苏投档线', { year, category, format: fileConfig.format, url: fileConfig.url })
          const result = await http.fetchBinary(fileConfig.url, {
            cacheKey: `js_toudang_${year}_${category}.${fileConfig.format}`,
            forceRefresh: args.force,
          })

          let records: ScoreRecord[]
          if (fileConfig.format === 'xls') {
            logger.info('解析江苏投档线 Excel', { year, category })
            records = parseJsToudangExcel(result.buffer, year, category, fileConfig.pageUrl)
          } else {
            logger.info('解析江苏投档线 PDF', { year, category })
            const text = await parsePdf(result.buffer)
            records = parseJsToudangPdf(text, year, category, fileConfig.pageUrl)
          }

          logger.info('江苏投档线解析完成', { year, category, count: records.length })

          // Step 4: 关联白名单
          const matched = matchColleges(records, collegesByName, warnings)
          allScores.push(...records)
          stats.push({ province: '江苏', year, category, count: records.length, matched })
        } catch (error) {
          logger.error('江苏投档线采集失败', {
            year, category, error: (error as Error).message,
          })
          failed.push({
            url: fileConfig.url,
            error: (error as Error).message,
            retryCount: 3,
            context: `江苏 ${year} ${category}`,
          })
        }
      }
    }
  }

  // Step 5: 校验与产出
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
  for (const province of ['浙江', '江苏']) {
    if (args.province && args.province !== province) continue

    const provinceDir = path.join(SCORES_OUTPUT_DIR, province)
    fs.mkdirSync(provinceDir, { recursive: true })

    for (const year of TARGET_YEARS) {
      const records = validated.filter(
        (s) => s.province === province && s.year === year
      )
      const outputPath = path.join(provinceDir, `scores_${year}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8')
      logger.info('投档线文件已写入', {
        province, year, count: records.length, path: outputPath,
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

  const logPath = path.join(LOGS_DIR, `scrape-scores-${Date.now()}.log`)
  fs.writeFileSync(logPath, report, 'utf-8')

  if (failed.length > 0) {
    process.exit(1)
  }
}

/**
 * 三级院校名匹配策略，填充 collegeId 和 verified 字段。
 * 返回匹配成功的记录数。
 */
function matchColleges(
  records: ScoreRecord[],
  collegesByName: Map<string, CollegeRecord>,
  warnings: ScoreWarningRecord[]
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
      // 避免重复 warning（同一院校名只记一次）
      if (!warnings.some((w) => w.collegeName === record.collegeName && w.year === record.year)) {
        warnings.push({
          collegeId: '',
          collegeName: record.collegeName,
          type: 'missing_data',
          detail: `未在 colleges.json 中找到匹配院校 (${record.province} ${record.year})`,
        })
      }
    }
  }

  return matched
}

/**
 * 三级匹配：精确 → 去后缀 → 包含
 */
function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): { collegeId: string; matchType: string } {
  // 1. 精确匹配
  const exact = collegesByName.get(name)
  if (exact) {
    return { collegeId: exact.id, matchType: 'exact' }
  }

  // 2. 去除括号后缀匹配（如"浙江大学(中外合作办学)" → "浙江大学"）
  const bracketIndex = name.indexOf('(')
  if (bracketIndex > 0) {
    const stripped = name.substring(0, bracketIndex).trim()
    const strippedMatch = collegesByName.get(stripped)
    if (strippedMatch) {
      return { collegeId: strippedMatch.id, matchType: 'stripped' }
    }
  }

  // 3. 包含匹配（投档线名包含 colleges.json 名，或反之）
  for (const [collegeName, college] of collegesByName) {
    if (collegeName.includes(name) || name.includes(collegeName)) {
      return { collegeId: college.id, matchType: 'contains' }
    }
  }

  return { collegeId: '', matchType: 'none' }
}

function buildScoresMeta(records: ScoreRecord[]): ScoresMeta {
  const provinces = (['浙江', '江苏'] as const).map((name) => {
    const years = TARGET_YEARS
    const scoreRecordCount: Record<number, number> = {}
    const rankTableRecordCount: Record<number, number> = {}

    for (const year of years) {
      scoreRecordCount[year] = records.filter(
        (r) => r.province === name && r.year === year
      ).length
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
      {
        name: '浙江省教育考试院',
        url: 'https://www.zjzs.net/',
        coverage: '专业级投档线 2023-2025',
      },
      {
        name: '江苏省教育考试院',
        url: 'https://www.jseea.cn/',
        coverage: '院校专业组级投档线 2023-2025',
      },
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

- [ ] **Step 2: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add scripts/scrapers/scores/index.ts
git commit -m "feat(scores): 重写编排入口为投档线采集流程"
```

---

## Task 14: 重写端到端测试

**Files:**
- Modify: `scripts/scrapers/scores/__tests__/e2e.test.ts`

- [ ] **Step 1: 重写端到端测试**

将 `scripts/scrapers/scores/__tests__/e2e.test.ts` 全部内容替换为：

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseZjToudang } from '../zhejiang'
import { parseJsToudangExcel } from '../jiangsu'
import { validateScoreRecord } from '../validate'
import type { ScoreRecord, CollegeRecord } from '../../types'

const zjFixturePath = path.join(__dirname, '..', '__fixtures__', 'zhejiang_sample.xls')
const zjFixtureBuffer = fs.readFileSync(zjFixturePath)

const jsFixturePath = path.join(__dirname, '..', '__fixtures__', 'jiangsu_physics_sample.xls')
const jsFixtureBuffer = fs.readFileSync(jsFixturePath)

// 模拟 colleges.json 白名单
const mockColleges = new Map<string, CollegeRecord>([
  ['4111010001', {
    id: '4111010001', moeCode: '4111010001', name: '浙江大学',
    province: '浙江省', city: '杭州市', level: ['本科'], type: '综合',
    nature: 'public', affiliation: '教育部', officialWebsite: '', gaokaoUrl: '',
    _meta: { source: 'merged', sourceUrl: '', fetchedAt: '', scraperVersion: '1.0.0', verified: true },
  }],
  ['4111010002', {
    id: '4111010002', moeCode: '4111010002', name: '杭州电子科技大学',
    province: '浙江省', city: '杭州市', level: ['本科'], type: '理工',
    nature: 'public', affiliation: '浙江省', officialWebsite: '', gaokaoUrl: '',
    _meta: { source: 'merged', sourceUrl: '', fetchedAt: '', scraperVersion: '1.0.0', verified: true },
  }],
  ['4111010003', {
    id: '4111010003', moeCode: '4111010003', name: '南京大学',
    province: '江苏省', city: '南京市', level: ['本科'], type: '综合',
    nature: 'public', affiliation: '教育部', officialWebsite: '', gaokaoUrl: '',
    _meta: { source: 'merged', sourceUrl: '', fetchedAt: '', scraperVersion: '1.0.0', verified: true },
  }],
])

const mockCollegesByName = new Map<string, CollegeRecord>()
for (const c of mockColleges.values()) {
  mockCollegesByName.set(c.name, c)
}

describe('投档线采集端到端流程', () => {
  it('浙江: parse → match → validate 完整流程', () => {
    // Step 1: 解析
    const records = parseZjToudang(zjFixtureBuffer, 2025, 'https://zjzs.net/test')
    expect(records.length).toBeGreaterThan(0)

    // Step 2: 关联白名单（模拟）
    let matched = 0
    for (const r of records) {
      const college = mockCollegesByName.get(r.collegeName)
      if (college) {
        r.collegeId = college.id
        r._meta.verified = true
        matched++
      }
    }
    expect(matched).toBeGreaterThan(0)

    // Step 3: 校验
    const validated = records.filter((r) => validateScoreRecord(r).valid)
    expect(validated.length).toBe(records.length) // 全部应通过校验

    // Step 4: 验证字段
    const first = validated[0]
    expect(first.province).toBe('浙江')
    expect(first.category).toBe('综合')
    expect(first.batch).toBe('普通类第一段')
    expect(first._meta.source).toBe('zjzs')
  })

  it('江苏: parse → match → validate 完整流程', () => {
    // Step 1: 解析
    const records = parseJsToudangExcel(jsFixtureBuffer, 2024, '物理类', 'https://jseea.cn/test')
    expect(records.length).toBeGreaterThan(0)

    // Step 2: 关联白名单（模拟）
    let matched = 0
    for (const r of records) {
      const college = mockCollegesByName.get(r.collegeName)
      if (college) {
        r.collegeId = college.id
        r._meta.verified = true
        matched++
      }
    }
    expect(matched).toBeGreaterThan(0) // 南京大学应匹配

    // Step 3: 校验
    const validated = records.filter((r) => validateScoreRecord(r).valid)
    expect(validated.length).toBe(records.length)

    // Step 4: 验证字段
    const nj = validated.find((r) => r.collegeName === '南京大学')
    expect(nj).toBeDefined()
    expect(nj!.majorGroup).toBe('01')
    expect(nj!.minScore).toBe(638)
    expect(nj!.minRank).toBe(0) // 江苏无位次
    expect(nj!.tieBreakers).toBeDefined()
    expect(nj!._meta.source).toBe('jseea')
  })
})
```

- [ ] **Step 2: 运行所有 scores 测试**

Run: `npx vitest run scripts/scrapers/scores 2>&1 | tail -30`
Expected: PASS — 所有测试通过（zhejiang 8 + jiangsu 13 + validate 14 + e2e 2 = 37 个用例）

- [ ] **Step 3: 运行全部 scrapers 测试**

Run: `npx vitest run scripts/scrapers 2>&1 | tail -15`
Expected: PASS — 所有测试通过，无回归

- [ ] **Step 4: 提交**

```bash
git add scripts/scrapers/scores/__tests__/e2e.test.ts
git commit -m "test(scores): 重写端到端测试适配投档线流程"
```

---

## Task 15: 首次采集与验证

**Files:**
- 无代码修改，仅运行采集

- [ ] **Step 1: 运行投档线采集**

Run: `npm run scrape:scores 2>&1 | tail -40`
Expected: 控制台输出采集报告，浙江每年约 2.3 万条，江苏每年约 2700 条

- [ ] **Step 2: 验证产出文件**

Run: `ls -la public/data/scores/浙江/ public/data/scores/江苏/`
Expected: 6 个 scores_*.json 文件存在且非空

- [ ] **Step 3: 验证记录数**

Run: `node -e "const fs=require('fs');for(const p of ['浙江','江苏']){for(const y of [2023,2024,2025]){const d=JSON.parse(fs.readFileSync('public/data/scores/'+p+'/scores_'+y+'.json','utf-8'));console.log(p+' '+y+': '+d.length+' 条')}}" `
Expected: 每个文件有合理数量的记录

- [ ] **Step 4: 验证 meta 文件**

Run: `cat public/data/scores/scores.meta.json | head -30`
Expected: JSON 格式正确，sources 包含浙江省教育考试院和江苏省教育考试院

- [ ] **Step 5: 验证溯源字段**

Run: `node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('public/data/scores/浙江/scores_2025.json','utf-8'));console.log(JSON.stringify(d[0],null,2))" `
Expected: 第一条记录包含完整 _meta（source=zjzs, sourceUrl, fetchedAt, scraperVersion, verified）

- [ ] **Step 6: 检查 warnings（未匹配院校）**

Run: `node -e "const fs=require('fs');const w=JSON.parse(fs.readFileSync('public/data/scores/reports/warnings.json','utf-8'));console.log('未匹配院校数:',w.length);console.log('前 5 条:',JSON.stringify(w.slice(0,5),null,2))" `
Expected: 未匹配数应 < 总记录数的 10%

- [ ] **Step 7: 提交采集结果**

```bash
git add public/data/scores/
git commit -m "data: 采集浙江/江苏 2023-2025 投档线数据"
```

---

## Task 16: 更新 npm scripts（如需要）

**Files:**
- Check: `package.json`

- [ ] **Step 1: 检查现有 npm scripts**

Run: `grep -E "scrape:scores" package.json`
Expected: 已有 `scrape:scores` 和 `scrape:scores:force` 脚本（无需修改）

- [ ] **Step 2: 验证 CLI 参数支持**

Run: `npm run scrape:scores -- --province=浙江 --force 2>&1 | head -10`
Expected: 仅采集浙江，强制刷新缓存

- [ ] **Step 3: 如无问题则跳过此任务**

若 package.json 已有正确脚本，此任务无需提交。

---

## 自审检查

**1. Spec 覆盖检查：**
- ✅ §1 数据源：Task 2 配置 URL
- ✅ §2 架构：Task 3 删除旧模块，Task 6/10 新建解析器
- ✅ §3 Schema：Task 1 扩展类型
- ✅ §4 采集流程：Task 13 重写编排入口
- ✅ §5 校验/测试：Task 11/12 校验器，Task 5/9/14 测试
- ✅ §6 URL 配置：Task 2
- ✅ §7 实施顺序：Task 1-15 按依赖顺序
- ✅ §8 成功标准：Task 15 验证

**2. 占位符扫描：** 无 TBD/TODO，所有代码示例完整。

**3. 类型一致性：**
- `parseZjToudang(buffer, year, sourceUrl)` 在 Task 6 定义，Task 13/14 调用 ✓
- `parseJsToudangExcel(buffer, year, category, sourceUrl)` 在 Task 10 定义，Task 13/14 调用 ✓
- `parseJsToudangPdf(text, year, category, sourceUrl)` 在 Task 10 定义，Task 13 调用 ✓
- `TieBreakers` 接口在 Task 1 定义，Task 10/11/12 使用 ✓
- `matchCollege` 函数在 Task 13 定义并使用 ✓
