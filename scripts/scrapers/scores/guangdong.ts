import { SCRAPER_VERSION } from '../config'
import type { ScoreRecord } from '../types'

/**
 * 解析广东省投档线 PDF 文本（3+1+2 双科类，院校专业组模式）。
 *
 * 真实数据格式（来自 eea.gd.gov.cn ZIP 内的 PDF）：
 * 每行格式（tab 分隔）：
 *   院校代码  院校名称  专业组代码  计划数  投档人数  投档最低分  投档最低排位
 *
 * 广东采用"院校专业组"模式，每条记录对应一个院校专业组。
 */
export function parseGdToudangPdf(
  text: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): ScoreRecord[] {
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const records: ScoreRecord[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过标题行
    if (/^(广东省|20\d{2}年广东省|院校代码|投档最低分|注[：:])/.test(trimmed)) continue

    // 按 tab 或多个空格分割
    const parts = trimmed.split(/\t+|\s{2,}/).filter((p) => p.length > 0)
    if (parts.length < 6) continue

    // 第 1 部分是院校代码（数字）
    if (!/^\d{4,5}$/.test(parts[0])) continue

    const collegeId = parts[0]
    const collegeName = parts[1]
    const majorGroup = parts[2]
    const minScore = Number(parts[5])
    const minRank = Number(parts[6]) || 0

    if (!collegeName || !minScore || isNaN(minScore)) continue

    records.push({
      collegeId,
      collegeName,
      year,
      majorName: `${collegeName}(${majorGroup})`,
      majorGroup,
      majorGroupName: `${collegeName}(${majorGroup})`,
      province: '广东',
      category,
      batch: '本科批',
      minScore,
      minRank,
      _meta: {
        source: 'gaokao',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false,
      },
    })
  }

  return records
}
