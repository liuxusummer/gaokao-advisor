import type { VolunteerItem, UserProfile } from '../store'
import * as XLSX from 'xlsx'

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
