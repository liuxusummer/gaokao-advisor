import type { HttpClient } from './http'
import type {
  ScoreRecord,
  SubjectRequirementRecord,
  RankTableRecord,
  FailedRecord,
} from '../types'

/** 省份元信息 */
export interface ProvinceMeta {
  name: string
  pinyinId: string
  examMode: '3+3' | '3+1+2'
  volunteerMode: 'major+college' | 'college-group'
  categories: string[]
  batchSize: string
}

/** 投档线适配器接口 */
export interface ScoreScraper {
  readonly province: string
  scrape(
    client: HttpClient,
    year: number,
    options?: { force?: boolean }
  ): Promise<{ records: ScoreRecord[]; failed: FailedRecord[] }>
}

/** 选科要求适配器接口 */
export interface SubjectScraper {
  readonly province: string
  scrape(
    client: HttpClient,
    year: number,
    options?: { force?: boolean }
  ): Promise<{ records: SubjectRequirementRecord[]; failed: FailedRecord[] }>
}

/** 一分一段表适配器接口 */
export interface RankTableScraper {
  readonly province: string
  scrape(
    client: HttpClient,
    year: number,
    options?: { force?: boolean }
  ): Promise<{ records: RankTableRecord[]; failed: FailedRecord[] }>
}

/** 省份注册表 */
export interface ProvinceRegistry {
  meta: ProvinceMeta
  scoreScraper?: ScoreScraper
  subjectScraper?: SubjectScraper
  rankTableScraper?: RankTableScraper
}

const REGISTRY = new Map<string, ProvinceRegistry>()

/** 注册省份 */
export function registerProvince(registry: ProvinceRegistry): void {
  REGISTRY.set(registry.meta.name, registry)
}

/** 获取单个省份注册信息 */
export function getProvince(name: string): ProvinceRegistry | undefined {
  return REGISTRY.get(name)
}

/** 获取所有已注册省份 */
export function getAllProvinces(): ProvinceRegistry[] {
  return Array.from(REGISTRY.values())
}

/** 获取启用的省份（按 TARGET_PROVINCES 环境变量或默认 10 省过滤） */
export function getEnabledProvinces(): ProvinceRegistry[] {
  const targetProvinces = (process.env.TARGET_PROVINCES?.split(',') as string[]) ??
    ['浙江', '江苏', '山东', '河北', '辽宁', '湖北', '湖南', '广东', '北京', '上海']

  return getAllProvinces().filter((r) => targetProvinces.includes(r.meta.name))
}

/** 清空注册表（仅用于测试） */
export function clearRegistry(): void {
  REGISTRY.clear()
}
