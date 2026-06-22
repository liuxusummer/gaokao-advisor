import { SCRAPER_VERSION } from '../config'
import type { ScoreRecord, TieBreakers } from '../types'

/**
 * 解析上海投档线 PDF 文本（院校专业组级，3+3 综合科类，本科批）。
 *
 * 真实数据格式（来自 shmeea.edu.cn PDF）：
 * 每行格式（tab 分隔）：
 *   院校专业组代码  院校专业组名称  投档线  [语数合计 语数较高 外语 选考最高 选考次高 选考最低 公示加分]
 *
 * 特殊情况：
 *   - 580分及以上的院校专业组，投档线显示为"580分及以上"，无同分排序项
 *   - 每页有页眉（院校专业组代码等）和页脚（第X页/共Y页），需跳过
 */
export function parseShToudangPdf(
  text: string,
  year: number,
  sourceUrl: string
): ScoreRecord[] {
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const records: ScoreRecord[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过页眉、页脚、标题
    if (/^(院校专业|组代码|组名称|名称|投档线|末位投档|语文数学|合计成绩|语文或数|学较高分|外语成绩|选考科目|最高分|次高分|最低分|公示加分|第\s*\d+\s*页|湖北省|上海市|微信公众号|HBSZSB|---|^\d+\s*of)/.test(trimmed)) continue
    if (/^(上海市|20\d{2}年上海市)/.test(trimmed)) continue
    if (/^\d+\s+of\s+\d+/.test(trimmed)) continue

    // 按 tab 或多个空格分割
    const parts = trimmed.split(/\t+|\s{2,}/).filter((p) => p.length > 0)
    if (parts.length < 3) continue

    // 第 1 部分是院校专业组代码（5位数字）
    if (!/^\d{5}$/.test(parts[0])) continue

    const collegeId = parts[0]
    const fullName = parts[1]
    const scoreStr = parts[2]

    if (!fullName) continue

    // 处理"580分及以上"的情况
    let minScore: number
    if (/^580分及以上$/.test(scoreStr)) {
      minScore = 580
    } else {
      minScore = Number(scoreStr)
      if (!minScore || isNaN(minScore)) continue
    }

    // 拆分"复旦大学(01)" → 院校名 + 专业组代码
    const match = fullName.match(/^(.+?)\((\d+)\)$/)
    const collegeName = match ? match[1] : fullName
    const majorGroup = match ? match[2] : undefined
    const majorGroupName = fullName

    // 同分排序项（580分及以上时无排序项）
    let tieBreakers: TieBreakers | undefined
    if (parts.length >= 9 && !/^580分及以上$/.test(scoreStr)) {
      const chineseMathSum = Number(parts[3])
      const chineseMathMax = Number(parts[4])
      const foreignLanguage = Number(parts[5])
      const preferredSubject = Number(parts[6])
      const reselectSubjectMax = Number(parts[7])
      const volunteerOrder = Number(parts[8])

      if (
        Number.isFinite(chineseMathSum) &&
        Number.isFinite(chineseMathMax) &&
        Number.isFinite(foreignLanguage) &&
        Number.isFinite(preferredSubject) &&
        Number.isFinite(reselectSubjectMax) &&
        Number.isFinite(volunteerOrder)
      ) {
        tieBreakers = {
          chineseMathSum,
          chineseMathMax,
          foreignLanguage,
          preferredSubject,
          reselectSubjectMax,
          volunteerOrder,
        }
      }
    }

    records.push({
      collegeId,
      collegeName,
      year,
      majorName: majorGroupName,
      majorGroup,
      majorGroupName,
      province: '上海',
      category: '综合',
      batch: '本科批',
      minScore,
      minRank: 0,
      tieBreakers,
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
