import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

/**
 * 解析河北省一分一段表 OCR 文本。
 *
 * OCR 文本格式（tesseract.js 识别后）通常为逐行文本：
 *   分数 人数 累计人数
 *   698 266 266
 *   697 46 312
 *   ...
 *
 * 每行匹配 "分数 人数 累计" 三列数字，跳过表头与噪声行。
 */
export function parseHbTable(
  text: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): RankTableRecord[] {
  const records: RankTableRecord[] = []
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过表头行和噪声行
    if (/分数|人数|累计|score|count|cumulative|第.*页|共.*页|河北|普通|高考|统计|注:|本次|公布/i.test(trimmed)) continue

    // 全角数字转半角，全角空格转半角
    const normalized = trimmed
      .replace(/[\u3000\uff00-\uffef]/g, (ch) => {
        const code = ch.charCodeAt(0)
        if (code >= 0xff10 && code <= 0xff19) return String.fromCharCode(code - 0xff10 + 0x30)
        if (code === 0x3000) return ' '
        return ch
      })
      .replace(/\s+/g, ' ')
      .trim()

    // 提取所有数字
    const numbers = normalized.split(' ').filter((s) => /^\d+$/.test(s))

    // 每 3 个数字为一组 (score, count, cumulativeCount)
    for (let i = 0; i + 2 < numbers.length; i += 3) {
      const score = parseInt(numbers[i], 10)
      const count = parseInt(numbers[i + 1], 10)
      const cumulativeCount = parseInt(numbers[i + 2], 10)

      if (isNaN(score) || isNaN(count) || isNaN(cumulativeCount)) continue
      if (score < 0 || score > 750) continue
      if (count < 0 || cumulativeCount < 0) continue

      // rank = 上一分数的累计人数 + 1（即该分数段的最高位次）
      const rank = records.length > 0
        ? records[records.length - 1].cumulativeCount + 1
        : 1

      records.push({
        province: '河北',
        year,
        category,
        score,
        rank,
        count,
        cumulativeCount,
        _meta: {
          source: 'gaokao',
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          scraperVersion: SCRAPER_VERSION,
          verified: false,
        },
      })
    }
  }

  return records
}
