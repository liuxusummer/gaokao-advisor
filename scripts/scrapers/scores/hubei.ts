import { SCRAPER_VERSION } from '../config'
import type { ScoreRecord, TieBreakers } from '../types'

/**
 * 解析湖北省投档线 PDF 文本（3+1+2 双科类，院校专业组模式）。
 *
 * PDF 文本特点：
 *   - 含竖排水印字符（湖/北/省/教/育/考/试/院），散落在各行之间
 *   - 每行格式：院校代号 院校专业组(再选科目) 投档分 (一) (二) (三) (四) (五) (六)
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

    // 跳过水印字符（单独一行的单个中文字符）
    if (/^[湖北省教育考试院]$/.test(trimmed)) continue

    // 跳过标题和注释行
    if (/^(湖北省|注[：:])/.test(trimmed)) continue
    if (/院校代号|投档最低分|同分考生/.test(trimmed)) continue

    // 尝试按空格分割
    const parts = trimmed.split(/\s+/)
    if (parts.length < 9) continue

    // 第 1 部分是院校代号（数字）
    if (!/^\d+$/.test(parts[0])) continue

    // 从末尾取 7 个数字字段，剩余部分拼成院校专业组名
    const numericTail = parts.slice(-7)
    if (!numericTail.every((p) => /^\d+$/.test(p))) continue

    const nameParts = parts.slice(1, parts.length - 7)
    const fullName = nameParts.join(' ')
    if (!fullName) continue

    const minScore = Number(numericTail[0])

    if (!Number.isFinite(minScore)) continue

    // 拆分"武汉大学01专业组(不限)" → 院校名 + 专业组代码 + 再选科目
    const match = fullName.match(/^(.+?)(\d{2,3}专业组)\((.+?)\)$/)
    if (!match) continue

    const collegeName = match[1]
    const majorGroup = match[2].replace('专业组', '')
    const majorGroupName = fullName

    // 同分排序项（9 列格式才有）
    let tieBreakers: TieBreakers | undefined
    const chineseMathSum = Number(numericTail[1])
    const chineseMathMax = Number(numericTail[2])
    const foreignLanguage = Number(numericTail[3])
    const preferredSubject = Number(numericTail[4])
    const reselectSubjectMax = Number(numericTail[5])
    const volunteerOrder = Number(numericTail[6])

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

    records.push({
      collegeId: '', // 由编排入口通过院校名匹配填充
      collegeName,
      year,
      majorName: majorGroupName, // 院校专业组级无专业名，用专业组全名填充
      majorGroup,
      majorGroupName,
      province: '湖北',
      category,
      batch: '本科批',
      minScore,
      minRank: 0, // 湖北投档线无位次
      tieBreakers,
      _meta: {
        source: 'gaokao',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false, // 解析阶段未关联白名单
      },
    })
  }

  return records
}
