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
