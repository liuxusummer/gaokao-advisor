import * as cheerio from 'cheerio'
import { GAOKAO_BASE_URL, SCRAPER_VERSION } from '../config'
import type { ScoreRecord } from '../types'

export function buildScoreUrl(collegeId: string): string {
  return `${GAOKAO_BASE_URL}/sch/schoolInfo-${collegeId}.dhtml`
}

interface ParseScoresOptions {
  html: string
  collegeId: string
  collegeName: string
  years: number[]
  provinces: string[]
  sourceUrl: string
}

export function parseScores(options: ParseScoresOptions): ScoreRecord[] {
  const { html, collegeId, collegeName, years, provinces, sourceUrl } = options
  const $ = cheerio.load(html)
  const records: ScoreRecord[] = []

  const yearSet = new Set(years)
  const provinceSet = new Set(provinces)

  $('.score-table tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 8) return

    const year = parseInt($(cells[0]).text().trim(), 10)
    const province = $(cells[1]).text().trim()
    const category = $(cells[2]).text().trim()
    const batch = $(cells[3]).text().trim()
    const majorName = $(cells[4]).text().trim()
    const majorGroup = $(cells[5]).text().trim() || undefined
    const minScore = parseInt($(cells[6]).text().trim(), 10)
    const minRank = parseInt($(cells[7]).text().trim(), 10)
    const avgScore = cells.length > 8 ? parseInt($(cells[8]).text().trim(), 10) : undefined
    const planCount = cells.length > 9 ? parseInt($(cells[9]).text().trim(), 10) : undefined

    // 筛选：年份和省份
    if (!yearSet.has(year)) return
    if (!provinceSet.has(province)) return

    // 跳过无效数据
    if (!majorName || isNaN(minScore) || isNaN(minRank)) return

    records.push({
      collegeId,
      collegeName,
      year,
      majorName,
      majorGroup,
      province,
      category,
      batch,
      minScore,
      minRank,
      avgScore: !isNaN(avgScore as number) ? avgScore : undefined,
      planCount: !isNaN(planCount as number) ? planCount : undefined,
      _meta: {
        source: 'gaokao',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        scraperVersion: SCRAPER_VERSION,
        verified: true,
      },
    })
  })

  return records
}
