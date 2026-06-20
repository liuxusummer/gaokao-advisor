# 志愿表导出功能设计

- **日期**: 2026-06-20
- **状态**: 已批准
- **关联**: VolunteerList.tsx 志愿表页面

## 1. 背景与目标

[VolunteerList.tsx](src/pages/VolunteerList.tsx) 顶部已有"导出"按钮，但当前只调用 `message.info('导出功能演示')`，未实现真实功能。用户需要将志愿表导出为可保存、可分享、可打印的格式，便于线下分析、与家人讨论或正式填报时参考。

**目标**：实现三种导出方式 —— Excel (.xlsx)、PDF（通过浏览器打印）、复制到剪贴板（TSV 格式）。

## 2. 范围

### 包含
- Excel 导出：使用已安装的 `xlsx` 依赖生成 .xlsx 文件并下载
- PDF 导出：通过 `window.print()` + `@media print` CSS 实现打印为 PDF
- 剪贴板复制：TSV 格式（Tab 分隔），可直接粘贴到 Excel/WPS
- 下拉菜单交互：用户从"导出"按钮的下拉菜单中选择格式
- 文件名含日期时间：`志愿表_YYYY-MM-DD_HHmm.xlsx`

### 不包含
- 后端导出服务（项目为纯前端）
- Word/Markdown 等其他格式
- 导出历史记录
- 导出内容的自定义字段选择（固定核心字段）
- 风险报告导出（仅导出志愿表本身）

## 3. 架构

### 模块划分

```
src/services/
  exporter.ts          # 新增：导出服务（纯函数）
  exporter.test.ts     # 新增：单元测试
src/pages/
  VolunteerList.tsx    # 修改：导出按钮改为 Dropdown.Button
src/styles/
  index.css            # 修改：新增 @media print 样式
```

### 设计原则
- **纯函数**：导出函数不依赖 React，接收 `volunteerList` 和 `profile` 作为参数，便于测试和复用
- **单一职责**：`exporter.ts` 只负责数据转换和文件生成，UI 交互由页面组件处理
- **复用现有依赖**：使用已安装的 `xlsx`，不引入新依赖
- **遵循现有模式**：与 `src/services/recommender.ts`、`src/services/dataLoader.ts` 一致

## 4. 数据模型

### 导出字段（核心字段）

| 列名 | 数据来源 | 类型 | 示例 |
|------|---------|------|------|
| 志愿序号 | index + 1 | number | 1 |
| 院校名称 | college.name | string | 浙江大学 |
| 专业名称 | major.name | string | 计算机科学与技术 |
| 梯度 | tier 映射 | string | 稳 |
| 录取概率 | probability + "%" | string | 75% |
| 选科要求 | major.subjects.join("+") | string | 物理+化学 |
| 学费(元/年) | major.tuition | number \| "-" | 6000 |
| 服从调剂 | obeyAdjust 映射 | string | 是 |

### 梯度映射
```typescript
const tierText = { rush: '冲', stable: '稳', safe: '保' }
```

### 表头信息行
导出内容顶部包含用户画像信息：
- 省份：`profile.provinceName`
- 成绩：`profile.score`
- 位次：`profile.rank`
- 导出时间：`new Date().toLocaleString('zh-CN')`

## 5. 接口设计

### exporter.ts 公共 API

```typescript
import type { VolunteerItem, UserProfile } from '../store'

/**
 * 导出志愿表为 Excel (.xlsx) 文件
 * 使用 xlsx 依赖生成，自动下载
 * 文件名格式：志愿表_YYYY-MM-DD_HHmm.xlsx
 */
export function exportToExcel(volunteerList: VolunteerItem[], profile: UserProfile): void

/**
 * 导出志愿表为 PDF（通过浏览器打印对话框）
 * 动态创建打印容器 → 调用 window.print() → 监听 afterprint 移除容器
 * 用户在打印对话框中选择"另存为 PDF"
 */
export function exportToPdf(volunteerList: VolunteerItem[], profile: UserProfile): void

/**
 * 复制志愿表到剪贴板（TSV 格式）
 * 使用 navigator.clipboard.writeText
 * @returns 是否复制成功
 */
export async function copyToClipboard(volunteerList: VolunteerItem[], profile: UserProfile): Promise<boolean>
```

### 内部 helper 函数（可单独测试）

```typescript
// 构建行数据数组（用于 Excel）
function buildRows(volunteerList: VolunteerItem[]): Record<string, string | number>[]

// 构建 TSV 字符串（用于剪贴板）
function buildTsv(volunteerList: VolunteerItem[], profile: UserProfile): string

// 构建打印用 HTML（用于 PDF）
function buildPrintHtml(volunteerList: VolunteerItem[], profile: UserProfile): string

// 生成文件名
function buildFileName(extension: string): string
```

## 6. 实现细节

### Excel 导出

```typescript
import * as XLSX from 'xlsx'

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

  // 列宽自适应
  ws['!cols'] = [
    { wch: 8 },   // 序号
    { wch: 24 },  // 院校
    { wch: 28 },  // 专业
    { wch: 6 },   // 梯度
    { wch: 10 },  // 概率
    { wch: 16 },  // 选科
    { wch: 12 },  // 学费
    { wch: 10 },  // 调剂
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '志愿表')
  XLSX.writeFile(wb, buildFileName('xlsx'))
}
```

**说明**：使用 `aoa_to_sheet` 一次性构建完整工作表（信息行 → 空行 → 表头 → 数据），避免 `json_to_sheet` + `sheet_add_aoa` 组合导致的表头覆盖问题。`buildRows` 返回的行数据通过 `Object.values(r)` 转为数组，顺序与表头一致。

### PDF 导出（浏览器打印）

```typescript
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

### 剪贴板复制

```typescript
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

### buildTsv 实现

```typescript
function buildTsv(volunteerList: VolunteerItem[], profile: UserProfile): string {
  const headers = ['志愿序号', '院校名称', '专业名称', '梯度', '录取概率', '选科要求', '学费(元/年)', '服从调剂']
  const lines = [
    `# 志愿表 - ${profile.provinceName} ${profile.score}分 位次${profile.rank}`,
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
      item.major.subjects?.join('+') || '-',
      item.major.tuition ?? '-',
      item.obeyAdjust ? '是' : '否',
    ].join('\t'))
  }
  return lines.join('\n')
}
```

### buildPrintHtml 实现

生成包含表头信息和 HTML table 的字符串，应用内联样式确保打印效果。

## 7. UI 交互

### VolunteerList.tsx 修改

将"导出"按钮改为 Ant Design `Dropdown.Button`：

```tsx
import { Dropdown } from 'antd'
import { ExportOutlined, FileExcelOutlined, FilePdfOutlined, CopyOutlined } from '@ant-design/icons'

const exportMenu = {
  items: [
    { key: 'excel', label: '导出 Excel', icon: <FileExcelOutlined /> },
    { key: 'pdf', label: '导出 PDF', icon: <FilePdfOutlined /> },
    { key: 'copy', label: '复制到剪贴板', icon: <CopyOutlined /> },
  ],
  onClick: async ({ key }) => {
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
  },
}

<Dropdown.Button menu={exportMenu} icon={<ExportOutlined />}>导出</Dropdown.Button>
```

## 8. 样式

### 打印专用 CSS（src/styles/index.css）

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

## 9. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 志愿表为空 | UI 层拦截（按钮可点击但提示），函数内抛 Error |
| xlsx 写入失败 | try-catch，message.error 提示 |
| 剪贴板权限被拒 | catch 返回 false，UI 提示"请检查浏览器权限" |
| navigator.clipboard 不支持（HTTP 环境） | catch 返回 false，UI 提示 |
| window.print 被浏览器拦截 | 无需特殊处理，用户可重试 |

## 10. 测试策略

### exporter.test.ts

测试内部 helper 函数（纯数据转换）：

1. **buildRows**：传入 mock volunteerList，验证返回行数据结构正确
2. **buildTsv**：验证 TSV 字符串包含表头、信息行、数据行，Tab 分隔正确
3. **buildPrintHtml**：验证 HTML 字符串包含 table、th、td 元素
4. **buildFileName**：验证文件名格式 `志愿表_YYYY-MM-DD_HHmm.xlsx`
5. **空列表**：三个导出函数传入空数组时抛错或返回 false
6. **字段映射**：tier → 冲/稳/保，obeyAdjust → 是/否，tuition 为空时显示 "-"

### VolunteerList 集成测试（可选）

mock exporter 模块，验证下拉菜单点击调用对应函数。

## 11. 边界情况

- **volunteerList 为空**：函数抛错，UI 层提前拦截并提示
- **major.subjects 为空数组或 undefined**：显示 "-"
- **major.tuition 为 undefined/null/0**：显示 "-"
- **profile.score 或 profile.rank 为 null**：信息行显示"未填写"
- **obeyAdjust 为 undefined**：默认显示"是"（store 中 addVolunteer 默认 true）
- **深色模式打印**：打印 CSS 强制使用浅色背景和深色文字，不受深色模式影响

## 12. 依赖

- **已有**：`xlsx`（SheetJS）— 用于 Excel 生成
- **已有**：`antd` — Dropdown.Button 组件
- **已有**：`@ant-design/icons` — FileExcelOutlined、FilePdfOutlined、CopyOutlined 图标
- **浏览器原生**：`navigator.clipboard`、`window.print`、`document.createElement`
- **无需新增依赖**
