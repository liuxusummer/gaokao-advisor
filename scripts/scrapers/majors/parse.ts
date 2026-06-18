import { SCRAPER_VERSION, MAJOR_CATEGORIES } from '../config'
import type { MajorCatalogRecord } from '../types'

/**
 * 解析教育部专业目录 PDF 提取的文本。
 *
 * 文本格式（每行一个专业，制表符分隔）：
 *   学科门类：哲学        ← 门类行（跳过）
 *   哲学类               ← 专业类行（无制表符，记录当前 subCategory）
 *   010101\t哲学\t哲学学士\t四年    ← 专业行
 *   080910TK\t信息安全\t管理学学士\t四年\t国家控制布点专业  ← 含备注
 */
export function parseCatalog(text: string, sourceUrl: string): MajorCatalogRecord[] {
  if (!text) return []

  const records: MajorCatalogRecord[] = []
  const lines = text.split(/\r?\n/)
  let currentCategory = ''
  let currentSubCategory = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过标题行
    if (trimmed.includes('普通高等学校') || trimmed.includes('专业目录')) continue

    // 门类行：以"学科门类"开头
    if (trimmed.startsWith('学科门类')) {
      const match = trimmed.match(/学科门类[：:]\s*(.+)$/)
      if (match) currentCategory = match[1].trim()
      continue
    }

    // 专业行：以专业代码开头（6 位数字 + 可选 T/K 后缀，TK 表示特设+控制布点）
    const codeMatch = trimmed.match(/^(\d{6}T?K?)\s+/)
    if (codeMatch) {
      const parts = trimmed.split(/\t|\s{2,}/).filter(Boolean)
      if (parts.length < 4) continue

      const majorCode = parts[0]
      const majorName = parts[1]
      const degreeType = parts[2] || ''
      const duration = parts[3] || ''
      const notes = parts[4] || undefined

      records.push({
        majorCode,
        majorName,
        category: currentCategory,
        subCategory: currentSubCategory,
        degreeType,
        duration,
        notes,
        _meta: {
          source: 'moe',
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          scraperVersion: SCRAPER_VERSION,
          verified: /^\d{6}T?K?$/.test(majorCode),
        },
      })
      continue
    }

    // 专业类行：无制表符且非门类行，记录为 subCategory
    if (!trimmed.includes('\t') && !trimmed.match(/^\d/)) {
      currentSubCategory = trimmed
    }
  }

  return records
}
