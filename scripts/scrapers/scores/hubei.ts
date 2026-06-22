import { SCRAPER_VERSION } from '../config'
import type { ScoreRecord, TieBreakers } from '../types'

/**
 * 解析湖北省投档线 PDF 文本（3+1+2 双科类，院校专业组模式）。
 *
 * 真实数据格式（来自 jyt.hubei.gov.cn PDF）：
 * 每行格式（tab 分隔）：
 *   院校专业组代号  院校专业组名称  再选科目要求  投档线  [语数之和 语数最高 外语 物理 再选最高 再选次高 志愿号]  [备注]
 *
 * 院校专业组代号示例: A00104
 * 院校专业组名称示例: 北京大学第04组
 * 再选科目要求: 不限/化/物/等
 *
 * 每页有页眉、页脚（第X页/共Y页），需跳过。
 */
export function parseHubToudangPdf(
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

    // 跳过页眉、页脚、标题
    if (/^(院校专业|组代号|组名称|名称|再选科|目要求|投档线|末位投档|语数|之和|最高|外语|物理|再选|志愿|号|备注|第\s*\d+\s*页|湖北省|微信公众号|HBSZSB|---|^\d+\s*of)/.test(trimmed)) continue
    if (/^(湖北省|20\d{2}年湖北省)/.test(trimmed)) continue
    if (/^\d+\s+of\s+\d+/.test(trimmed)) continue

    // 按 tab 或多个空格分割
    const parts = trimmed.split(/\t+|\s{2,}/).filter((p) => p.length > 0)
    if (parts.length < 4) continue

    // 第 1 部分是院校专业组代号（字母+数字，如 A00104）
    if (!/^[A-Z]\d{4,5}$/.test(parts[0])) continue

    const collegeId = parts[0]
    const fullName = parts[1]
    const minScore = Number(parts[3])

    if (!fullName || !minScore || isNaN(minScore)) continue

    // 拆分"北京大学第04组" → 院校名 + 专业组代码
    const match = fullName.match(/^(.+?)第(\d+)组$/)
    const collegeName = match ? match[1] : fullName
    const majorGroup = match ? match[2] : undefined
    const majorGroupName = fullName

    // 同分排序项（6个数字 + 志愿号）
    let tieBreakers: TieBreakers | undefined
    if (parts.length >= 10) {
      const chineseMathSum = Number(parts[4])
      const chineseMathMax = Number(parts[5])
      const foreignLanguage = Number(parts[6])
      const preferredSubject = Number(parts[7])
      const reselectSubjectMax = Number(parts[8])
      const volunteerOrder = Number(parts[9])

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
      province: '湖北',
      category,
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
