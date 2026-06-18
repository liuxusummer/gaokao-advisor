import * as XLSX from 'xlsx'
import { SCRAPER_VERSION } from '../config'
import type { ScoreRecord, TieBreakers } from '../types'

/**
 * 解析江苏省投档线 Excel 文件（2023/2024 年格式）。
 *
 * Excel 结构（.xls 格式）：
 *   行 1: 标题
 *   行 2: 科类说明
 *   行 3-5: 表头（合并单元格）
 *   行 6+: 数据行（9 列）
 *   末尾: 注释行
 *
 * 9 列：院校代号 | 院校专业组(再选科目) | 投档最低分 | (一)语数之和 | (二)语数最高 | (三)外语 | (四)首选 | (五)再选最高 | (六)志愿号
 */
export function parseJsToudangExcel(
  buffer: Buffer,
  year: number,
  category: '物理类' | '历史类',
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

  return parseRows(rows, year, category, sourceUrl)
}

/**
 * 解析江苏省投档线 PDF 文本（2025 年格式）。
 *
 * PDF 文本特点：
 *   - 含竖排水印字符（江/苏/省/教/育/考/试/院），散落在各行之间
 *   - 每行格式：院校代号 院校专业组(再选科目) 投档分 (一) (二) (三) (四) (五) (六)
 */
export function parseJsToudangPdf(
  text: string,
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): ScoreRecord[] {
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const rows: unknown[][] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过水印字符（单独一行的单个中文字符）
    if (/^[江苏省教育考试院]$/.test(trimmed)) continue

    // 跳过标题和注释行
    if (/^(江苏省|注[：:])/.test(trimmed)) continue
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

    rows.push([
      parts[0],
      fullName,
      ...numericTail,
    ])
  }

  return parseRows(rows, year, category, sourceUrl)
}

/**
 * 从二维数组解析为 ScoreRecord[]。
 * 共用逻辑：Excel 和 PDF 文本都转换为相同格式的 rows 后调用此函数。
 */
function parseRows(
  rows: unknown[][],
  year: number,
  category: '物理类' | '历史类',
  sourceUrl: string
): ScoreRecord[] {
  const records: ScoreRecord[] = []

  for (const row of rows) {
    if (!row || row.length < 3) continue

    const collegeCode = String(row[0] ?? '').trim()
    const fullName = String(row[1] ?? '').trim()
    const minScore = Number(row[2])

    // 跳过空行和注释
    if (!collegeCode || !fullName) continue
    if (fullName.startsWith('注')) continue
    if (!/^\d+$/.test(collegeCode)) continue
    if (!Number.isFinite(minScore)) continue

    // 拆分"南京大学03专业组(不限)" → 院校名 + 专业组代码 + 再选科目
    const match = fullName.match(/^(.+?)(\d{2,3}专业组)\((.+?)\)$/)
    if (!match) continue

    const collegeName = match[1]
    const majorGroup = match[2].replace('专业组', '')
    const majorGroupName = fullName

    // 同分排序项（9 列格式才有）
    let tieBreakers: TieBreakers | undefined
    if (row.length >= 9) {
      const chineseMathSum = Number(row[3])
      const chineseMathMax = Number(row[4])
      const foreignLanguage = Number(row[5])
      const preferredSubject = Number(row[6])
      const reselectSubjectMax = Number(row[7])
      const volunteerOrder = Number(row[8])

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
      collegeId: '', // 由编排入口通过院校名匹配填充
      collegeName,
      year,
      majorName: majorGroupName, // 江苏专业组级无专业名，用专业组全名填充
      majorGroup,
      majorGroupName,
      province: '江苏',
      category,
      batch: '本科批',
      minScore,
      minRank: 0, // 江苏投档线无位次
      tieBreakers,
      _meta: {
        source: 'jseea',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: false, // 解析阶段未关联白名单
      },
    })
  }

  return records
}
