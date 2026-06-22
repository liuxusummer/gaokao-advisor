# 志愿表导出功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 VolunteerList 页面的志愿表导出功能，支持 Excel、PDF（浏览器打印）、剪贴板三种格式

**Architecture:** 新建 `src/services/exporter.ts` 纯函数模块，导出三个函数 `exportToExcel`、`exportToPdf`、`copyToClipboard`，内部 helper（`buildRows`、`buildTsv`、`buildPrintHtml`、`buildFileName`）单独可测。VolunteerList.tsx 将"导出"按钮改为 Ant Design `Dropdown.Button`，菜单点击调用对应函数。新增 `@media print` CSS 控制打印输出。

**Tech Stack:** React 18 + TypeScript + Ant Design 5 + xlsx (SheetJS) + Vitest + @testing-library/react

**Spec:** [docs/superpowers/specs/2026-06-20-volunteer-export-design.md](docs/superpowers/specs/2026-06-20-volunteer-export-design.md)

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/services/exporter.ts` | 新建 | 三个导出函数 + 内部 helper |
| `src/services/exporter.test.ts` | 新建 | 单元测试（helper 函数 + 导出函数） |
| `src/pages/VolunteerList.tsx` | 修改 | 导出按钮改为 Dropdown.Button，调用 exporter |
| `src/styles/index.css` | 修改 | 新增 `@media print` 打印样式 |

---

### Task 1: 创建 exporter.ts 骨架与 buildFileName helper

**Files:**
- Create: `src/services/exporter.ts`
- Create: `src/services/exporter.test.ts`

- [ ] **Step 1: 写失败测试 — buildFileName**

```typescript
// src/services/exporter.test.ts
import { describe, it, expect } from 'vitest'
import { buildFileName } from './exporter'

describe('buildFileName', () => {
  it('生成含日期时间的 xlsx 文件名', () => {
    const name = buildFileName('xlsx')
    expect(name).toMatch(/^志愿表_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/)
  })

  it('支持其他扩展名', () => {
    const name = buildFileName('pdf')
    expect(name).toMatch(/^志愿表_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 exporter.ts 骨架并实现 buildFileName**

```typescript
// src/services/exporter.ts
import type { VolunteerItem, UserProfile } from '../store'

const tierText: Record<VolunteerItem['tier'], string> = {
  rush: '冲',
  stable: '稳',
  safe: '保',
}

/** 生成文件名：志愿表_YYYY-MM-DD_HHmm.<ext> */
export function buildFileName(extension: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `志愿表_${date}_${time}.${extension}`
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 提交**

```bash
git add src/services/exporter.ts src/services/exporter.test.ts
git commit -m "feat(exporter): 新建模块骨架与 buildFileName helper"
```

---

### Task 2: 实现 buildRows helper

**Files:**
- Modify: `src/services/exporter.ts`
- Modify: `src/services/exporter.test.ts`

- [ ] **Step 1: 写失败测试 — buildRows**

在 `src/services/exporter.test.ts` 顶部新增 import 和 mock 数据：

```typescript
import { describe, it, expect } from 'vitest'
import { buildFileName, buildRows } from './exporter'
import type { VolunteerItem } from '../store'
import type { College, Major } from '../data/mock'

const mockCollege: College = {
  id: 'c1', name: '浙江大学', province: '浙江省', city: '杭州市',
  level: ['本科'], type: '综合', tags: ['985', '211', '双一流'],
  website: 'https://www.zju.edu.cn',
}

const mockMajor: Major = {
  id: 'm1', name: '计算机科学与技术', category: '工学',
  discipline: '计算机类', subjects: ['物理', '化学'], tuition: 6000,
}

const mockItem: VolunteerItem = {
  id: 'c1-m1-1', college: mockCollege, major: mockMajor,
  tier: 'stable', probability: 75, minRank: 5000, obeyAdjust: true,
}

describe('buildRows', () => {
  it('将 VolunteerItem 转换为行数据', () => {
    const rows = buildRows([mockItem])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      '志愿序号': 1,
      '院校名称': '浙江大学',
      '专业名称': '计算机科学与技术',
      '梯度': '稳',
      '录取概率': '75%',
      '选科要求': '物理+化学',
      '学费(元/年)': 6000,
      '服从调剂': '是',
    })
  })

  it('空列表返回空数组', () => {
    expect(buildRows([])).toEqual([])
  })

  it('subjects 为空时显示 "-"', () => {
    const item: VolunteerItem = {
      ...mockItem, major: { ...mockMajor, subjects: [] },
    }
    const rows = buildRows([item])
    expect(rows[0]['选科要求']).toBe('-')
  })

  it('tuition 为 undefined 时显示 "-"', () => {
    const item: VolunteerItem = {
      ...mockItem, major: { ...mockMajor, tuition: undefined },
    }
    const rows = buildRows([item])
    expect(rows[0]['学费(元/年)']).toBe('-')
  })

  it('obeyAdjust 为 false 时显示 "否"', () => {
    const item: VolunteerItem = { ...mockItem, obeyAdjust: false }
    const rows = buildRows([item])
    expect(rows[0]['服从调剂']).toBe('否')
  })

  it('多个志愿序号递增', () => {
    const items: VolunteerItem[] = [
      mockItem,
      { ...mockItem, id: 'c2-m2-2' },
      { ...mockItem, id: 'c3-m3-3' },
    ]
    const rows = buildRows(items)
    expect(rows.map((r) => r['志愿序号'])).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: FAIL — `buildRows` 未导出

- [ ] **Step 3: 实现 buildRows**

在 `src/services/exporter.ts` 末尾追加：

```typescript
/** 构建行数据数组（用于 Excel），顺序与表头一致 */
export function buildRows(volunteerList: VolunteerItem[]): Record<string, string | number>[] {
  return volunteerList.map((item, index) => ({
    '志愿序号': index + 1,
    '院校名称': item.college.name,
    '专业名称': item.major.name,
    '梯度': tierText[item.tier],
    '录取概率': `${item.probability}%`,
    '选科要求': item.major.subjects && item.major.subjects.length > 0
      ? item.major.subjects.join('+')
      : '-',
    '学费(元/年)': item.major.tuition ?? '-',
    '服从调剂': item.obeyAdjust === false ? '否' : '是',
  }))
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 提交**

```bash
git add src/services/exporter.ts src/services/exporter.test.ts
git commit -m "feat(exporter): 实现 buildRows helper"
```

---

### Task 3: 实现 buildTsv helper

**Files:**
- Modify: `src/services/exporter.ts`
- Modify: `src/services/exporter.test.ts`

- [ ] **Step 1: 写失败测试 — buildTsv**

在 `src/services/exporter.test.ts` 顶部 import 新增 `buildTsv`，并新增 `UserProfile` import：

```typescript
import { buildFileName, buildRows, buildTsv } from './exporter'
import type { VolunteerItem, UserProfile } from '../store'

const mockProfile: UserProfile = {
  provinceId: 'zhejiang', provinceName: '浙江', subjectType: 'physics',
  subjects: ['物理', '化学', '生物'], score: 650, rank: 10000,
  regions: [], levels: [], categories: [], maxTuition: null,
  physicalExam: 'normal', riskPreference: 'balanced', mbtiType: null,
}
```

在文件末尾追加测试：

```typescript
describe('buildTsv', () => {
  it('生成含信息行、表头、数据行的 TSV 字符串', () => {
    const tsv = buildTsv([mockItem], mockProfile)
    const lines = tsv.split('\n')

    // 信息行
    expect(lines[0]).toContain('浙江')
    expect(lines[0]).toContain('650')
    expect(lines[0]).toContain('10000')
    expect(lines[1]).toContain('导出时间')

    // 表头
    expect(lines[2]).toBe('志愿序号\t院校名称\t专业名称\t梯度\t录取概率\t选科要求\t学费(元/年)\t服从调剂')

    // 数据行
    expect(lines[3]).toBe('1\t浙江大学\t计算机科学与技术\t稳\t75%\t物理+化学\t6000\t是')
  })

  it('空列表仍生成信息行和表头', () => {
    const tsv = buildTsv([], mockProfile)
    const lines = tsv.split('\n')
    expect(lines).toHaveLength(3) // 信息行 + 表头 + (无数据)
    expect(lines[2]).toContain('志愿序号')
  })

  it('profile 字段为 null 时显示 "未填写"', () => {
    const profile: UserProfile = { ...mockProfile, score: null, rank: null, provinceName: '' }
    const tsv = buildTsv([mockItem], profile)
    expect(tsv).toContain('未填写')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: FAIL — `buildTsv` 未导出

- [ ] **Step 3: 实现 buildTsv**

在 `src/services/exporter.ts` 末尾追加：

```typescript
/** 构建 TSV 字符串（用于剪贴板），Tab 分隔，Excel 可直接粘贴 */
export function buildTsv(volunteerList: VolunteerItem[], profile: UserProfile): string {
  const headers = ['志愿序号', '院校名称', '专业名称', '梯度', '录取概率', '选科要求', '学费(元/年)', '服从调剂']
  const lines = [
    `# 志愿表 - ${profile.provinceName || '未填写'} ${profile.score ?? '未填写'}分 位次${profile.rank ?? '未填写'}`,
    `# 导出时间：${new Date().toLocaleString('zh-CN')}`,
    headers.join('\t'),
  ]
  for (const [i, item] of volunteerList.entries()) {
    lines.push([
      i + 1,
      item.college.name,
      item.major.name,
      tierText[item.tier],
      `${item.probability}%`,
      item.major.subjects && item.major.subjects.length > 0
        ? item.major.subjects.join('+')
        : '-',
      item.major.tuition ?? '-',
      item.obeyAdjust === false ? '否' : '是',
    ].join('\t'))
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 提交**

```bash
git add src/services/exporter.ts src/services/exporter.test.ts
git commit -m "feat(exporter): 实现 buildTsv helper"
```

---

### Task 4: 实现 buildPrintHtml helper

**Files:**
- Modify: `src/services/exporter.ts`
- Modify: `src/services/exporter.test.ts`

- [ ] **Step 1: 写失败测试 — buildPrintHtml**

在 `src/services/exporter.test.ts` 顶部 import 新增 `buildPrintHtml`：

```typescript
import { buildFileName, buildRows, buildTsv, buildPrintHtml } from './exporter'
```

在文件末尾追加测试：

```typescript
describe('buildPrintHtml', () => {
  it('生成含标题、信息、table 的 HTML 字符串', () => {
    const html = buildPrintHtml([mockItem], mockProfile)
    expect(html).toContain('<h1>志愿表</h1>')
    expect(html).toContain('浙江')
    expect(html).toContain('650')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>志愿序号</th>')
    expect(html).toContain('<th>院校名称</th>')
    expect(html).toContain('<td>浙江大学</td>')
    expect(html).toContain('<td>计算机科学与技术</td>')
    expect(html).toContain('<td>稳</td>')
    expect(html).toContain('</table>')
  })

  it('多个志愿生成多行 tr', () => {
    const items: VolunteerItem[] = [
      mockItem,
      { ...mockItem, id: 'c2-m2-2', college: { ...mockCollege, name: '清华大学' } },
    ]
    const html = buildPrintHtml(items, mockProfile)
    const trCount = (html.match(/<tr>/g) || []).length
    // 1 表头 + 2 数据行 = 3
    expect(trCount).toBe(3)
    expect(html).toContain('清华大学')
  })

  it('profile 字段为 null 时显示 "未填写"', () => {
    const profile: UserProfile = { ...mockProfile, score: null, rank: null }
    const html = buildPrintHtml([mockItem], profile)
    expect(html).toContain('未填写')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: FAIL — `buildPrintHtml` 未导出

- [ ] **Step 3: 实现 buildPrintHtml**

在 `src/services/exporter.ts` 末尾追加：

```typescript
/** 构建打印用 HTML 字符串（用于 PDF 导出） */
export function buildPrintHtml(volunteerList: VolunteerItem[], profile: UserProfile): string {
  const info = `省份：${profile.provinceName || '未填写'}　成绩：${profile.score ?? '未填写'}　位次：${profile.rank ?? '未填写'}　导出时间：${new Date().toLocaleString('zh-CN')}`
  const headers = ['志愿序号', '院校名称', '专业名称', '梯度', '录取概率', '选科要求', '学费(元/年)', '服从调剂']
  const ths = headers.map((h) => `<th>${h}</th>`).join('')
  const trs = volunteerList.map((item, i) => {
    const tds = [
      i + 1,
      item.college.name,
      item.major.name,
      tierText[item.tier],
      `${item.probability}%`,
      item.major.subjects && item.major.subjects.length > 0
        ? item.major.subjects.join('+')
        : '-',
      item.major.tuition ?? '-',
      item.obeyAdjust === false ? '否' : '是',
    ].map((v) => `<td>${v}</td>`).join('')
    return `<tr>${tds}</tr>`
  }).join('')
  return `
    <h1>志愿表</h1>
    <div class="info">${info}</div>
    <table>
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
  `
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: 提交**

```bash
git add src/services/exporter.ts src/services/exporter.test.ts
git commit -m "feat(exporter): 实现 buildPrintHtml helper"
```

---

### Task 5: 实现 exportToExcel 函数

**Files:**
- Modify: `src/services/exporter.ts`
- Modify: `src/services/exporter.test.ts`

- [ ] **Step 1: 写失败测试 — exportToExcel**

在 `src/services/exporter.test.ts` 顶部 import 新增 `exportToExcel`，并 mock xlsx 模块：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildFileName, buildRows, buildTsv, buildPrintHtml, exportToExcel } from './exporter'

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({ '!cols': [] })),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

import * as XLSX from 'xlsx'
```

在文件末尾追加测试：

```typescript
describe('exportToExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('空列表抛错', () => {
    expect(() => exportToExcel([], mockProfile)).toThrow('志愿表为空')
  })

  it('调用 xlsx 生成文件', () => {
    exportToExcel([mockItem], mockProfile)
    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled()
    expect(XLSX.utils.book_new).toHaveBeenCalled()
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled()
    expect(XLSX.writeFile).toHaveBeenCalled()
    const fileName = (XLSX.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(fileName).toMatch(/^志愿表_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/)
  })

  it('aoa_to_sheet 入参包含信息行和表头', () => {
    exportToExcel([mockItem], mockProfile)
    const arg = (XLSX.utils.aoa_to_sheet as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // 前 4 行：信息行 x3 + 空行
    expect(arg[0][0]).toContain('浙江')
    expect(arg[1][0]).toContain('650')
    expect(arg[2][0]).toContain('导出时间')
    expect(arg[3]).toEqual([])
    // 第 5 行：表头
    expect(arg[4]).toEqual(['志愿序号', '院校名称', '专业名称', '梯度', '录取概率', '选科要求', '学费(元/年)', '服从调剂'])
    // 第 6 行起：数据
    expect(arg[5][1]).toBe('浙江大学')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: FAIL — `exportToExcel` 未导出

- [ ] **Step 3: 实现 exportToExcel**

在 `src/services/exporter.ts` 顶部 import 新增 xlsx：

```typescript
import * as XLSX from 'xlsx'
```

在文件末尾追加：

```typescript
/** 导出志愿表为 Excel (.xlsx) 文件，自动下载 */
export function exportToExcel(volunteerList: VolunteerItem[], profile: UserProfile): void {
  if (volunteerList.length === 0) throw new Error('志愿表为空，无法导出')

  const ws = XLSX.utils.aoa_to_sheet([
    [`省份：${profile.provinceName || '未填写'}`],
    [`成绩：${profile.score ?? '未填写'}  位次：${profile.rank ?? '未填写'}`],
    [`导出时间：${new Date().toLocaleString('zh-CN')}`],
    [],
    ['志愿序号', '院校名称', '专业名称', '梯度', '录取概率', '选科要求', '学费(元/年)', '服从调剂'],
    ...buildRows(volunteerList).map((r) => Object.values(r)),
  ])

  ws['!cols'] = [
    { wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 6 },
    { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '志愿表')
  XLSX.writeFile(wb, buildFileName('xlsx'))
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: 提交**

```bash
git add src/services/exporter.ts src/services/exporter.test.ts
git commit -m "feat(exporter): 实现 exportToExcel 函数"
```

---

### Task 6: 实现 copyToClipboard 函数

**Files:**
- Modify: `src/services/exporter.ts`
- Modify: `src/services/exporter.test.ts`

- [ ] **Step 1: 写失败测试 — copyToClipboard**

在 `src/services/exporter.test.ts` 顶部 import 新增 `copyToClipboard`：

```typescript
import { buildFileName, buildRows, buildTsv, buildPrintHtml, exportToExcel, copyToClipboard } from './exporter'
```

在文件末尾追加测试：

```typescript
describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('空列表返回 false', async () => {
    const ok = await copyToClipboard([], mockProfile)
    expect(ok).toBe(false)
  })

  it('成功复制返回 true 并调用 clipboard.writeText', async () => {
    const ok = await copyToClipboard([mockItem], mockProfile)
    expect(ok).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(text).toContain('浙江大学')
    expect(text).toContain('志愿序号')
  })

  it('clipboard 不可用时返回 false', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const ok = await copyToClipboard([mockItem], mockProfile)
    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: FAIL — `copyToClipboard` 未导出

- [ ] **Step 3: 实现 copyToClipboard**

在 `src/services/exporter.ts` 末尾追加：

```typescript
/** 复制志愿表到剪贴板（TSV 格式），返回是否成功 */
export async function copyToClipboard(volunteerList: VolunteerItem[], profile: UserProfile): Promise<boolean> {
  if (volunteerList.length === 0) return false
  try {
    const tsv = buildTsv(volunteerList, profile)
    await navigator.clipboard.writeText(tsv)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: PASS (20 tests)

- [ ] **Step 5: 提交**

```bash
git add src/services/exporter.ts src/services/exporter.test.ts
git commit -m "feat(exporter): 实现 copyToClipboard 函数"
```

---

### Task 7: 实现 exportToPdf 函数

**Files:**
- Modify: `src/services/exporter.ts`
- Modify: `src/services/exporter.test.ts`

- [ ] **Step 1: 写失败测试 — exportToPdf**

在 `src/services/exporter.test.ts` 顶部 import 新增 `exportToPdf`：

```typescript
import { buildFileName, buildRows, buildTsv, buildPrintHtml, exportToExcel, copyToClipboard, exportToPdf } from './exporter'
```

在文件末尾追加测试：

```typescript
describe('exportToPdf', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      print: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ id: '', innerHTML: '' })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        classList: { add: vi.fn(), remove: vi.fn() },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('空列表抛错', () => {
    expect(() => exportToPdf([], mockProfile)).toThrow('志愿表为空')
  })

  it('创建打印容器并调用 window.print', () => {
    exportToPdf([mockItem], mockProfile)
    expect(document.createElement).toHaveBeenCalledWith('div')
    expect(document.body.appendChild).toHaveBeenCalled()
    expect(document.body.classList.add).toHaveBeenCalledWith('printing-export')
    expect(window.print).toHaveBeenCalled()
    expect(window.addEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function))
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: FAIL — `exportToPdf` 未导出

- [ ] **Step 3: 实现 exportToPdf**

在 `src/services/exporter.ts` 末尾追加：

```typescript
/** 导出志愿表为 PDF（通过浏览器打印对话框，用户选"另存为 PDF"） */
export function exportToPdf(volunteerList: VolunteerItem[], profile: UserProfile): void {
  if (volunteerList.length === 0) throw new Error('志愿表为空，无法导出')

  const html = buildPrintHtml(volunteerList, profile)
  const container = document.createElement('div')
  container.id = 'print-container'
  container.innerHTML = html
  document.body.appendChild(container)
  document.body.classList.add('printing-export')

  const cleanup = () => {
    document.body.removeChild(container)
    document.body.classList.remove('printing-export')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  window.print()
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/services/exporter.test.ts`
Expected: PASS (23 tests)

- [ ] **Step 5: 提交**

```bash
git add src/services/exporter.ts src/services/exporter.test.ts
git commit -m "feat(exporter): 实现 exportToPdf 函数"
```

---

### Task 8: 添加打印 CSS 样式

**Files:**
- Modify: `src/styles/index.css`

- [ ] **Step 1: 在 index.css 末尾追加打印样式**

在 `src/styles/index.css` 文件末尾追加：

```css

/* 志愿表导出打印样式 */
@media print {
  body.printing-export > *:not(#print-container) {
    display: none !important;
  }
  #print-container {
    display: block !important;
    padding: 20px;
  }
  #print-container table {
    width: 100%;
    border-collapse: collapse;
  }
  #print-container th,
  #print-container td {
    border: 1px solid #333;
    padding: 6px 10px;
    text-align: left;
    font-size: 12px;
  }
  #print-container th {
    background: #f0f0f0;
  }
  #print-container h1 {
    font-size: 18px;
    margin-bottom: 8px;
  }
  #print-container .info {
    margin-bottom: 12px;
    font-size: 12px;
    color: #666;
  }
}
```

- [ ] **Step 2: 验证 CSS 无语法错误**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: 构建成功无错误

- [ ] **Step 3: 提交**

```bash
git add src/styles/index.css
git commit -m "style: 新增志愿表导出打印样式"
```

---

### Task 9: 修改 VolunteerList 接入导出功能

**Files:**
- Modify: `src/pages/VolunteerList.tsx`

- [ ] **Step 1: 修改 VolunteerList.tsx 顶部 import**

将 [src/pages/VolunteerList.tsx](src/pages/VolunteerList.tsx) 第 1-16 行的 import 部分修改为：

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Switch, Tag, message, Modal, Dropdown } from 'antd'
import {
  DeleteOutlined,
  UpOutlined,
  DownOutlined,
  WarningFilled,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'
import { detectRisks } from '../services/riskDetector'
import { exportToExcel, exportToPdf, copyToClipboard } from '../services/exporter'
import CollegeNameLink from '../components/CollegeNameLink'
```

- [ ] **Step 2: 在组件内添加导出菜单处理函数**

在 [src/pages/VolunteerList.tsx](src/pages/VolunteerList.tsx) 第 48 行（`handleSubmit` 函数之后）插入：

```typescript
  const handleExport = async ({ key }: { key: string }) => {
    if (volunteerList.length === 0) {
      message.warning('志愿表为空')
      return
    }
    try {
      if (key === 'excel') {
        exportToExcel(volunteerList, profile)
        message.success('Excel 已下载')
      } else if (key === 'pdf') {
        exportToPdf(volunteerList, profile)
      } else if (key === 'copy') {
        const ok = await copyToClipboard(volunteerList, profile)
        if (ok) message.success('已复制到剪贴板')
        else message.error('复制失败，请检查浏览器权限')
      }
    } catch (err) {
      message.error('导出失败：' + (err instanceof Error ? err.message : '未知错误'))
    }
  }

  const exportMenu = {
    items: [
      { key: 'excel', label: '导出 Excel', icon: <FileExcelOutlined /> },
      { key: 'pdf', label: '导出 PDF', icon: <FilePdfOutlined /> },
      { key: 'copy', label: '复制到剪贴板', icon: <CopyOutlined /> },
    ],
    onClick: handleExport,
  }
```

- [ ] **Step 3: 替换导出按钮为 Dropdown.Button**

将 [src/pages/VolunteerList.tsx](src/pages/VolunteerList.tsx) 第 58 行的导出按钮：

```tsx
          <Button icon={<ExportOutlined />} onClick={() => message.info('导出功能演示')}>导出</Button>
```

替换为：

```tsx
          <Dropdown.Button menu={exportMenu} icon={<ExportOutlined />}>
            导出
          </Dropdown.Button>
```

- [ ] **Step 4: 运行类型检查和 lint**

Run: `npx tsc --noEmit && npx eslint src/pages/VolunteerList.tsx`
Expected: 无错误

- [ ] **Step 5: 运行全部测试确保无回归**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add src/pages/VolunteerList.tsx
git commit -m "feat(volunteer-list): 接入导出功能下拉菜单"
```

---

### Task 10: 最终验证与构建

**Files:**
- 无修改，仅验证

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest run`
Expected: 全部通过（含新增 exporter.test.ts 的 23 个测试）

- [ ] **Step 2: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行 ESLint**

Run: `npx eslint src/services/exporter.ts src/services/exporter.test.ts src/pages/VolunteerList.tsx`
Expected: 无错误

- [ ] **Step 4: 运行构建**

Run: `npx vite build`
Expected: 构建成功

- [ ] **Step 5: 重启 dev server 手动验证**

Run: `npm run dev`

手动验证步骤：
1. 访问 http://localhost:5175/profile，填写省份、成绩、生成推荐
2. 在推荐页加入几个志愿到志愿表
3. 访问 http://localhost:5175/volunteer-list
4. 点击"导出"按钮，分别测试：
   - 导出 Excel：浏览器应下载 `志愿表_YYYY-MM-DD_HHmm.xlsx` 文件
   - 导出 PDF：浏览器打印对话框弹出，预览中应只显示志愿表内容
   - 复制到剪贴板：提示"已复制到剪贴板"，粘贴到 Excel 验证内容

- [ ] **Step 6: 最终提交（如有遗漏修改）**

```bash
git status
# 如有未提交修改
git add -A
git commit -m "chore: 导出功能最终验证"
```

---

## Self-Review

### Spec 覆盖检查
- ✅ Excel 导出 → Task 5
- ✅ PDF 导出（浏览器打印）→ Task 7 + Task 8 (CSS)
- ✅ 剪贴板复制 → Task 6
- ✅ 下拉菜单交互 → Task 9
- ✅ 文件名含日期时间 → Task 1 (buildFileName)
- ✅ 核心字段（8 列）→ Task 2 (buildRows)
- ✅ 表头信息行（省份/成绩/位次/时间）→ Task 5, Task 3, Task 4
- ✅ 错误处理（空列表、权限拒绝）→ Task 5, Task 6, Task 9
- ✅ 边界情况（subjects 空、tuition 空、obeyAdjust false、profile null）→ Task 2, Task 3, Task 4 测试覆盖
- ✅ 打印 CSS → Task 8
- ✅ 测试策略 → Task 1-7 均含 TDD 测试

### 占位符扫描
- 无 TBD/TODO
- 所有代码步骤均含完整代码
- 所有测试步骤均含完整测试代码

### 类型一致性
- `VolunteerItem['tier']` 在 Task 2/3/4 中均通过 `tierText` 映射
- `buildRows` 返回 `Record<string, string | number>[]`，Task 5 中通过 `Object.values(r)` 转数组
- `exportToExcel`/`exportToPdf`/`copyToClipboard` 签名在 Task 5/6/7 与 spec 一致
- `handleExport` 在 Task 9 中调用签名与导出函数匹配
