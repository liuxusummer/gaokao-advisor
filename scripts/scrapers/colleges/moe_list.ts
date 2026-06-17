import * as cheerio from 'cheerio'
import type { MoeRecord } from '../types'

function parseNature(raw: string): 'public' | 'private' | 'joint' {
  if (raw.includes('公办')) return 'public'
  if (raw.includes('民办')) return 'private'
  if (raw.includes('中外合办') || raw.includes('合作办学')) return 'joint'
  return 'public'
}

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
