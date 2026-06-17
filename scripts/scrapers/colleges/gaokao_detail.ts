import * as cheerio from 'cheerio'
import { GAOKAO_BASE_URL } from '../config'
import type { GaokaoRecord } from '../types'

const PAGE_SIZE = 20

/**
 * 构造阳光高考院校列表分页 URL。
 * 实际站点使用 search--province-{省},start-{偏移}.dhtml 格式，
 * 每页 20 条，start = (page - 1) * 20。
 *
 * 注：province 参数为空时构造全局列表 URL（站点 province 过滤不生效，
 * 全局列表与按省列表返回相同结果）。
 */
export function buildGaokaoUrl(province: string, page: number): string {
  const start = (page - 1) * PAGE_SIZE
  if (province) {
    const encoded = encodeURIComponent(province)
    return `${GAOKAO_BASE_URL}/sch/search--province-${encoded},start-${start}.dhtml`
  }
  return `${GAOKAO_BASE_URL}/sch/search--start-${start}.dhtml`
}

/**
 * 解析阳光高考院校列表 HTML。
 *
 * 实际 HTML 结构（2025 年度）：
 *   .sch-list-container .sch-item
 *     a.name.js-yxk-yxmc  → 院校名称（href 含 schId）
 *     .sch-department      → "北京|主管部门：教育部"（含省份）
 *     .sch-level .sch-level-tag → 办学层次标签
 *
 * 注：列表页不直接提供官网链接，officialWebsite 留空，由详情页补充。
 */
export function parseGaokaoList(html: string, sourceUrl: string): GaokaoRecord[] {
  const $ = cheerio.load(html)
  const records: GaokaoRecord[] = []

  $('.sch-list-container .sch-item').each((_, item) => {
    const $item = $(item)
    const nameLink = $item.find('.sch-title .name').first()
    const name = nameLink.text().trim()
    const href = nameLink.attr('href') || ''

    // 从 href 提取 schId，格式：/sch/schoolInfo--schId-1.dhtml
    const gaokaoId =
      href.match(/schoolInfo--schId-([0-9a-zA-Z]+)\.dhtml/)?.[1] || ''

    // 省份从 .sch-department 文本提取："<i>icon</i>北京<span>|</span>主管部门：教育部"
    const deptText = $item.find('.sch-department').text().trim()
    const province = extractProvinceFromDept(deptText)

    const gaokaoUrl = href.startsWith('http')
      ? href
      : `${GAOKAO_BASE_URL}${href}`

    if (!name || !gaokaoId) return

    records.push({
      gaokaoId,
      name,
      officialWebsite: '',
      gaokaoUrl,
      province,
      sourceUrl,
    })
  })

  return records
}

/**
 * 从 .sch-department 文本中提取省份。
 * 输入示例："北京|主管部门：教育部" 或 "浙江|主管部门：浙江省"
 * 提取第一个分隔符 | 之前的内容（去除图标字符）。
 */
function extractProvinceFromDept(text: string): string {
  // 去除图标占位符（iconfont 字符）
  const cleaned = text.replace(/[^\u4e00-\u9fa5|]/g, '')
  const parts = cleaned.split('|')
  return parts[0]?.trim() || ''
}
