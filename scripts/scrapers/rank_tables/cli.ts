export interface RankTableCliArgs {
  force: boolean
  province?: string
  year?: number
}

export function parseRankTableCliArgs(args: string[]): RankTableCliArgs {
  const provinceArg = args.find((arg) => arg.startsWith('--province='))
  const yearArg = args.find((arg) => arg.startsWith('--year='))
  const year = yearArg ? Number(yearArg.split('=')[1]) : undefined

  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    throw new Error(`无效年份: ${yearArg?.split('=')[1]}`)
  }

  return {
    force: args.includes('--force'),
    province: provinceArg ? provinceArg.split('=')[1] : undefined,
    year,
  }
}

export function resolveRankTableYears(args: RankTableCliArgs, defaultYears: number[]): number[] {
  return args.year ? [args.year] : defaultYears
}
