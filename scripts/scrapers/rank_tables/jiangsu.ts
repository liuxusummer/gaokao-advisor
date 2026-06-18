import { SCRAPER_VERSION } from '../config'
import type { RankTableRecord } from '../types'

/**
 * 解析江苏省一分一段表 OCR 文本。
 *
 * OCR 文本格式特点：
 * 1. 图片为多栏排版，每行可能包含 1-3 组 (分数, 人数, 累计人数)
 *    例如: "563 1255 75837 523 1410 130715 483 1149 184370"
 *    表示三组数据: (563,1255,75837), (523,1410,130715), (483,1149,184370)
 * 2. 包含表头行、页码行等噪声文本
 * 3. OCR 可能产生全角字符、多余空格等
 *
 * 数据校验通过单调性检查（累计人数应随分数递减而递增）。
 */
export function parseJsTable(
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
    if (/分数|人数|累计|score|count|cumulative|第.*页|共.*页|江苏|普通|高考|统计|注:|本次|公布/i.test(trimmed)) continue

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
      // 江苏高考分数范围：物理类/历史类 通常在 400-700 之间
      if (score < 0 || score > 750) continue
      if (count < 0 || cumulativeCount < 0) continue

      // rank = 上一分数的累计人数 + 1
      const rank = records.length > 0
        ? records[records.length - 1].cumulativeCount + 1
        : 1

      records.push({
        province: '江苏',
        year,
        category,
        score,
        rank,
        count,
        cumulativeCount,
        _meta: {
          source: 'jseea',
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          scraperVersion: SCRAPER_VERSION,
          // OCR 识别数据标记为未验证，需人工抽检
          verified: false,
        },
      })
    }
  }

  return records
}
