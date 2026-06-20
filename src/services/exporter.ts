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
