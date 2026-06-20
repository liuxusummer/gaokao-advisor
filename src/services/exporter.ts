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
