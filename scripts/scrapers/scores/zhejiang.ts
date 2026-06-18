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
