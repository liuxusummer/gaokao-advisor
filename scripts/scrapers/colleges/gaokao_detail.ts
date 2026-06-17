import * as cheerio from 'cheerio'
import { GAOKAO_BASE_URL } from '../config'
import type { GaokaoRecord } from '../types'

export function buildGaokaoUrl(province: string, page: number): string {
  const params = new URLSearchParams({
    province,
    page: String(page),
  })
  return `${GAOKAO_BASE_URL}/sch/search.do?${params.toString()}`
}

export function parseGaokaoList(html: string, sourceUrl: string): GaokaoRecord[] {
  const $ = cheerio.load(html)
  const records: GaokaoRecord[] = []

  $('.search-result-list .item').each((_, item) => {
    const nameLink = $(item).find('.school-name a')
    const name = nameLink.text().trim()
    const href = nameLink.attr('href') || ''
    const gaokaoId = nameLink.attr('data-school-id') || href.match(/schoolInfo-(\d+)/)?.[1] || ''

    const province = $(item).find('.province').text().trim()
    const websiteLink = $(item).find('.school-website')
    const officialWebsite = websiteLink.attr('href') || ''

    const gaokaoUrl = href.startsWith('http')
      ? href
      : `${GAOKAO_BASE_URL}${href}`

    if (!name || !gaokaoId) return

    records.push({
      gaokaoId,
      name,
      officialWebsite,
      gaokaoUrl,
      province,
      sourceUrl,
    })
  })

  return records
}
