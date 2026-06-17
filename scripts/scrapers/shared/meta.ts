import { SCRAPER_VERSION } from '../config'
import type { RecordMeta } from '../types'

export type SourceType = RecordMeta['source']

export function buildMeta(
  source: SourceType,
  url: string,
  verified: boolean
): RecordMeta {
  return {
    source,
    sourceUrl: url,
    fetchedAt: new Date().toISOString(),
    scraperVersion: SCRAPER_VERSION,
    verified,
  }
}
