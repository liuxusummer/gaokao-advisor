import { registerProvince } from './province_registry'
import { zhejiangScoreScraper } from '../scores/adapters/zhejiang'
import { jiangsuScoreScraper } from '../scores/adapters/jiangsu'
import { shandongScoreScraper } from '../scores/adapters/shandong'
import { hebeiScoreScraper } from '../scores/adapters/hebei'
import { hunanScoreScraper } from '../scores/adapters/hunan'
import { zhejiangSubjectScraper } from '../subjects/adapters/zhejiang'
import { jiangsuSubjectScraper } from '../subjects/adapters/jiangsu'
import { shandongSubjectScraper } from '../subjects/adapters/shandong'
import { hebeiSubjectScraper } from '../subjects/adapters/hebei'
import { hunanSubjectScraper } from '../subjects/adapters/hunan'
import { zhejiangRankTableScraper } from '../rank_tables/adapters/zhejiang'
import { jiangsuRankTableScraper } from '../rank_tables/adapters/jiangsu'
import { shandongRankTableScraper } from '../rank_tables/adapters/shandong'
import { hebeiRankTableScraper } from '../rank_tables/adapters/hebei'
import { hunanRankTableScraper } from '../rank_tables/adapters/hunan'

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

  // 山东（3+3，专业+院校，综合）
  registerProvince({
    meta: {
      name: '山东',
      pinyinId: 'shandong',
      examMode: '3+3',
      volunteerMode: 'major+college',
      categories: ['综合'],
      batchSize: '普通类常规批第1次',
    },
    scoreScraper: shandongScoreScraper,
    subjectScraper: shandongSubjectScraper,
    rankTableScraper: shandongRankTableScraper,
  })

  // 河北（3+1+2，专业+院校，物理类+历史类）
  registerProvince({
    meta: {
      name: '河北',
      pinyinId: 'hebei',
      examMode: '3+1+2',
      volunteerMode: 'major+college',
      categories: ['物理类', '历史类'],
      batchSize: '本科批',
    },
    scoreScraper: hebeiScoreScraper,
    subjectScraper: hebeiSubjectScraper,
    rankTableScraper: hebeiRankTableScraper,
  })

  // 湖南（3+1+2，院校专业组，物理类+历史类）
  registerProvince({
    meta: {
      name: '湖南',
      pinyinId: 'hunan',
      examMode: '3+1+2',
      volunteerMode: 'college-group',
      categories: ['物理类', '历史类'],
      batchSize: '本科批',
    },
    scoreScraper: hunanScoreScraper,
    subjectScraper: hunanSubjectScraper,
    rankTableScraper: hunanRankTableScraper,
  })

  initialized = true
}
