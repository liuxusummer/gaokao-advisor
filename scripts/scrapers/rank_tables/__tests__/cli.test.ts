import { describe, expect, it } from 'vitest'
import { parseRankTableCliArgs, resolveRankTableYears } from '../cli'

describe('rank table cli', () => {
  it('parses a single target year', () => {
    expect(parseRankTableCliArgs(['--year=2026'])).toEqual({
      force: false,
      year: 2026,
      province: undefined,
    })
  })

  it('keeps default years when year is omitted', () => {
    expect(resolveRankTableYears({ force: false }, [2023, 2024, 2025])).toEqual([
      2023,
      2024,
      2025,
    ])
  })

  it('uses only the requested year when year is provided', () => {
    expect(resolveRankTableYears({ force: false, year: 2026 }, [2023, 2024, 2025])).toEqual([
      2026,
    ])
  })
})
