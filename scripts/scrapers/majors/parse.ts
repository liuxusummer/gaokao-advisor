import { SCRAPER_VERSION } from '../config'
import type { MajorCatalogRecord } from '../types'

/**
 * 解析教育部专业目录 PDF 提取的文本。
 *
 * 实际 PDF 文本格式：
 *   01 	学科门类：哲学        ← 门类行（数字+制表符+"学科门类："+名称）
 *   0101 	哲学类              ← 专业类行（4位数字+制表符+以"类"结尾的名称）
 *   010101 	哲学              ← 专业行（6位数字+可选TK后缀+制表符+名称，仅2列）
 *   020109T                   ← 跨行专业代码行（无名称）
 *   020110TK
 *   数字经济                  ← 跨行专业名称行（与上方代码按顺序一一对应）
 *   低空经济与管理（注：...）  ← 含括号备注，备注提取到 notes 字段
 */
export function parseCatalog(text: string, sourceUrl: string): MajorCatalogRecord[] {
  if (!text) return []

  const records: MajorCatalogRecord[] = []
  const lines = text.split(/\r?\n/)
  let currentCategory = ''
  let currentSubCategory = ''

  // 跳过说明部分（在第一个"学科门类"行之前的内容）
  let started = false

  // 缓冲区：处理跨行专业（代码行与名称行分离）
  let pendingCodes: string[] = []

  function flushPendingCodes(rawLines: string[]) {
    // 合并跨行名称：PDF 中（注：...）备注可能因换行被拆分，
    // 依据全角括号平衡（（ 与 ）数量相等）判断一个名称是否完整。
    const names: string[] = []
    let buffer = ''
    for (const raw of rawLines) {
      buffer = buffer ? buffer + raw : raw
      const open = (buffer.match(/（/g) || []).length
      const close = (buffer.match(/）/g) || []).length
      if (open === close) {
        names.push(buffer)
        buffer = ''
      }
    }
    if (buffer) names.push(buffer)

    // 将待处理的代码与名称按顺序配对
    for (let i = 0; i < pendingCodes.length && i < names.length; i++) {
      const code = pendingCodes[i]
      const rawName = names[i]
      // 提取括号备注（如"（注：...）"），并从专业名称中去除
      const noteMatch = rawName.match(/（注：.+?）$/)
      const notes = noteMatch ? noteMatch[0] : undefined
      const majorName = notes ? rawName.replace(noteMatch[0], '').trim() : rawName.trim()

      records.push({
        majorCode: code,
        majorName,
        category: currentCategory,
        subCategory: currentSubCategory,
        degreeType: '',
        duration: '',
        notes,
        _meta: {
          source: 'moe',
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          scraperVersion: SCRAPER_VERSION,
          verified: /^\d{6}T?K?$/.test(code),
        },
      })
    }
    pendingCodes = []
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    // 跳过页眉页脚
    if (/^--\s*\d+\s*of\s*\d+\s*--/.test(trimmed)) continue
    if (/^—\s*\d+\s*—$/.test(trimmed)) continue
    if (trimmed === '附件' || trimmed.includes('普通高等学校本科专业目录')) continue
    if (trimmed.startsWith('（20') && trimmed.endsWith('年）')) continue
    if (trimmed.includes('教') && trimmed.includes('育') && trimmed.includes('部')) continue
    if (trimmed.startsWith('20') && trimmed.includes('年')) continue
    if (trimmed === '说 	明' || trimmed === '说明') continue
    if (
      trimmed.startsWith('一、') ||
      trimmed.startsWith('二、') ||
      trimmed.startsWith('三、') ||
      trimmed.startsWith('四、') ||
      trimmed.startsWith('五、')
    ) {
      continue
    }

    // 门类行：数字+制表符+"学科门类："+名称
    const categoryMatch = trimmed.match(/^\d+\s+学科门类[：:]\s*(.+)$/)
    if (categoryMatch) {
      started = true
      currentCategory = categoryMatch[1].trim()
      continue
    }

    // 未进入正式内容前，跳过
    if (!started) continue

    // 专业类行：4位数字+制表符+以"类"结尾的名称
    const subCategoryMatch = trimmed.match(/^\d{4}\s+(.+类)$/)
    if (subCategoryMatch) {
      currentSubCategory = subCategoryMatch[1].trim()
      continue
    }

    // 专业行（含名称）：6位数字+可选T/K/TK后缀+制表符+名称
    const codeWithNameMatch = trimmed.match(/^(\d{6}T?K?)\s+(.+)$/)
    if (codeWithNameMatch) {
      // 先处理待处理的代码（防御性：不应发生）
      if (pendingCodes.length > 0) {
        pendingCodes = []
      }
      const code = codeWithNameMatch[1]
      const rawName = codeWithNameMatch[2]
      const noteMatch = rawName.match(/（注：.+?）$/)
      const notes = noteMatch ? noteMatch[0] : undefined
      const majorName = notes ? rawName.replace(noteMatch[0], '').trim() : rawName.trim()

      records.push({
        majorCode: code,
        majorName,
        category: currentCategory,
        subCategory: currentSubCategory,
        degreeType: '',
        duration: '',
        notes,
        _meta: {
          source: 'moe',
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          scraperVersion: SCRAPER_VERSION,
          verified: /^\d{6}T?K?$/.test(code),
        },
      })
      continue
    }

    // 专业代码行（无名称，跨行专业）：6位数字+可选T/K/TK后缀
    const codeOnlyMatch = trimmed.match(/^(\d{6}T?K?)$/)
    if (codeOnlyMatch) {
      pendingCodes.push(codeOnlyMatch[1])
      continue
    }

    // 如果有待处理的代码，且当前行不是代码行，则视为名称行
    if (pendingCodes.length > 0) {
      const rawLines: string[] = [trimmed]
      // 继续读取后续名称行
      while (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim()
        if (!nextTrimmed) break
        // 下一行是代码行或门类行或专业类行，则停止
        if (/^\d{6}T?K?(\s+|$)/.test(nextTrimmed)) break
        if (/^\d+\s+学科门类/.test(nextTrimmed)) break
        if (/^\d{4}\s+.+类$/.test(nextTrimmed)) break
        if (/^--\s*\d+\s*of\s*\d+\s*--/.test(nextTrimmed)) break
        if (/^—\s*\d+\s*—$/.test(nextTrimmed)) break
        // 是名称行
        rawLines.push(nextTrimmed)
        i++
      }
      flushPendingCodes(rawLines)
      continue
    }

    // 其他行跳过
  }

  return records
}
