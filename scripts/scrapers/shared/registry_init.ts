import { registerProvince } from './province_registry'
import { zhejiangScoreScraper } from '../scores/adapters/zhejiang'
import { jiangsuScoreScraper } from '../scores/adapters/jiangsu'
import { zhejiangSubjectScraper } from '../subjects/adapters/zhejiang'
import { jiangsuSubjectScraper } from '../subjects/adapters/jiangsu'
import { zhejiangRankTableScraper } from '../rank_tables/adapters/zhejiang'
import { jiangsuRankTableScraper } from '../rank_tables/adapters/jiangsu'

let initialized = false

/** 注册所有已实现的省份适配器（幂等） */
export function ensureRegistryInitialized(): void {
  if (initialized) return

  // 浙江（3+3，专业+院校，综合）
  registerProvince({
    meta: {
      name: '浙江',
      pinyinId: 'zhejiang',
      examMode: '3+3',
      volunteerMode: 'major+college',
      categories: ['综合'],
      batchSize: '普通类第一段',
    },
    scoreScraper: zhejiangScoreScraper,
    subjectScraper: zhejiangSubjectScraper,
    rankTableScraper: zhejiangRankTableScraper,
  })

  // 江苏（3+1+2，院校专业组，物理类+历史类）
  registerProvince({
    meta: {
      name: '江苏',
      pinyinId: 'jiangsu',
      examMode: '3+1+2',
      volunteerMode: 'college-group',
      categories: ['物理类', '历史类'],
      batchSize: '本科批',
    },
    scoreScraper: jiangsuScoreScraper,
    subjectScraper: jiangsuSubjectScraper,
    rankTableScraper: jiangsuRankTableScraper,
  })

  initialized = true
}
