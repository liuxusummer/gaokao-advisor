import * as cheerio from 'cheerio'
import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord, RankTableRecordMeta } from '../types'

/**
 * 解析北京市一分一段表 HTML（cheerio 解析 table）。
 *
 * HTML 结构：标准 <table> 表格，每行包含 分数 / 人数 / 累计人数 三列。
 * 跳过表头行（含 '分数'/'人数'/'累计' 字样）。
 * 北京为 3+3 模式，仅有综合科类，故 category 硬编码为 '综合'。
 *
 * 特殊行处理：
 * - "700以上" → 视为 700 分
 * - "390→399" 区间行 → 展开为 390-399 共 10 个分数，人数均分
 */
export function parseBjTable(
  html: string,
  year: number,
  sourceUrl: string
): RankTableRecord[] {
  const $ = cheerio.load(html)
  const records: RankTableRecord[] = []
  const meta: RankTableRecordMeta = {
    source: 'gaokao',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified: false,
  }

  const pushRecord = (score: number, count: number, cumulativeCount: number) => {
    if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) return
    if (score < 0 || score > 750) return
    if (count < 0 || cumulativeCount < 0) return

    const rank = records.length > 0
      ? records[records.length - 1].cumulativeCount + 1
      : 1

    records.push({
      province: '北京',
      year,
      category: '综合',
      score,
      rank,
      count,
      cumulativeCount,
      _meta: { ...meta },
    })
  }

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get()
    if (cells.length < 3) return

    // 跳过表头行
    if (cells.some((c) => c.includes('分数') || c.includes('人数') || c.includes('累计'))) return
    // 跳过注释行
    if (cells.some((c) => c.includes('注：') || c.includes('统计中'))) return

    const scoreStr = cells[0]
    const count = Number(cells[1])
    const cumulativeCount = Number(cells[2])

    if (isNaN(count) || isNaN(cumulativeCount)) return

    // 处理 "700以上" 行
    const aboveMatch = scoreStr.match(/^(\d+)以上$/)
    if (aboveMatch) {
      const score = parseInt(aboveMatch[1], 10)
      pushRecord(score, count, cumulativeCount)
      return
    }

    // 处理 "390→399" 区间行（展开为单个分数，按均分方式分配人数）
    const rangeMatch = scoreStr.match(/^(\d+)[→\-~](\d+)$/)
    if (rangeMatch) {
      const low = parseInt(rangeMatch[1], 10)
      const high = parseInt(rangeMatch[2], 10)
      if (high <= low) return
      const span = high - low + 1
      const perScore = Math.floor(count / span)
      const remainder = count - perScore * span
      // 从高分到低分展开，余数分配给区间内最高的几个分数
      for (let s = high; s >= low; s--) {
        const thisCount = perScore + (high - s < remainder ? 1 : 0)
        const prevCumulative = records.length > 0 ? records[records.length - 1].cumulativeCount : 0
        const thisCumulative = prevCumulative + thisCount
        pushRecord(s, thisCount, thisCumulative)
      }
      return
    }

    // 普通数值行
    const score = Number(scoreStr)
    if (!isNaN(score)) {
      pushRecord(score, count, cumulativeCount)
    }
  })

  return records
}
