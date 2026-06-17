import * as cheerio from 'cheerio'
import * as XLSX from 'xlsx'
import type { MoeRecord } from '../types'

function parseNature(raw: string): 'public' | 'private' | 'joint' {
  if (raw.includes('民办')) return 'private'
  if (raw.includes('中外合办') || raw.includes('合作办学') || raw.includes('境外')) return 'joint'
  return 'public'
}

/**
 * 从教育部名单发布页 HTML 中提取"全国普通高等学校名单"Excel 附件 URL。
 * 返回绝对 URL；未找到时返回 null。
 */
export function extractMoeExcelUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html)
  let foundUrl: string | null = null

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim()
    // 匹配 .xls/.xlsx 附件且链接文本为"全国普通高等学校名单"
    if (
      /\.(xls|xlsx)$/i.test(href) &&
      text.includes('普通高等学校')
    ) {
      foundUrl = new URL(href, baseUrl).toString()
      return false // break
    }
  })

  return foundUrl
}

/**
 * 解析教育部名单 Excel（2025 年度起以附件形式发布）。
 *
 * Excel 结构：
 *   行0: 附件标题
 *   行1: 名单标题
 *   行2: 列头 [序号, 学校名称, 学校标识码, 主管部门, 所在地, 办学层次, 备注]
 *   行3+: 省份分组头（如"北京市（92所）"）或数据行
 *
 * 注：2025 年度 Excel 无"办学性质"列，nature 由"备注"列推导：
 *   - 包含"民办" → private
 *   - 包含"中外合作"/"境外" → joint
 *   - 其他（含空） → public
 */
export function parseMoeExcel(buffer: Buffer, sourceUrl: string): MoeRecord[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: '',
  }) as string[][]

  const records: MoeRecord[] = []
  let currentProvince = ''

  // 省份分组头正则：如 "北京市（92所）"、"广西壮族自治区（89所）"
  const provinceHeaderRe = /^(.+?)（\d+所）$/

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c).trim())
    // 跳过空行
    if (row.every((c) => !c)) continue

    // 检测省份分组头
    const headerMatch = row[0].match(provinceHeaderRe)
    if (headerMatch && !row[1]) {
      currentProvince = headerMatch[1]
      continue
    }

    // 跳过标题/列头行（序号列非数字或为"序号"）
    if (!/^\d+$/.test(row[0])) continue

    // 数据行：[序号, 学校名称, 学校标识码, 主管部门, 所在地, 办学层次, 备注]
    const name = row[1]
    const id = row[2]
    const affiliation = row[3]
    const city = row[4]
    const level = row[5]
    const remarks = row[6] || ''

    if (!name || !id) continue

    records.push({
      id,
      name,
      province: currentProvince,
      city,
      level,
      nature: parseNature(remarks),
      affiliation,
      sourceUrl,
    })
  }

  return records
}

/**
 * 解析教育部名单 HTML 表格（旧版，2024 及以前）。
 * 保留用于向后兼容与单元测试。
 */
export function parseMoeList(html: string, sourceUrl: string): MoeRecord[] {
  const $ = cheerio.load(html)
  const records: MoeRecord[] = []

  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 8) return

    const name = $(cells[1]).text().trim()
    const id = $(cells[2]).text().trim()
    const affiliation = $(cells[3]).text().trim()
    const province = $(cells[4]).text().trim()
    const city = $(cells[5]).text().trim()
    const level = $(cells[6]).text().trim()
    const natureRaw = $(cells[7]).text().trim()

    if (!name || !id) return

    records.push({
      id,
      name,
      province,
      city,
      level,
      nature: parseNature(natureRaw),
      affiliation,
      sourceUrl,
    })
  })

  return records
}
