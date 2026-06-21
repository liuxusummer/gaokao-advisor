import { registerProvince } from './province_registry'
import { zhejiangScoreScraper } from '../scores/adapters/zhejiang'
import { jiangsuScoreScraper } from '../scores/adapters/jiangsu'
import { shandongScoreScraper } from '../scores/adapters/shandong'
import { hebeiScoreScraper } from '../scores/adapters/hebei'
import { hunanScoreScraper } from '../scores/adapters/hunan'
import { hubeiScoreScraper } from '../scores/adapters/hubei'
import { guangdongScoreScraper } from '../scores/adapters/guangdong'
import { beijingScoreScraper } from '../scores/adapters/beijing'
import { zhejiangSubjectScraper } from '../subjects/adapters/zhejiang'
import { jiangsuSubjectScraper } from '../subjects/adapters/jiangsu'
import { shandongSubjectScraper } from '../subjects/adapters/shandong'
import { hebeiSubjectScraper } from '../subjects/adapters/hebei'
import { hunanSubjectScraper } from '../subjects/adapters/hunan'
import { hubeiSubjectScraper } from '../subjects/adapters/hubei'
import { guangdongSubjectScraper } from '../subjects/adapters/guangdong'
import { beijingSubjectScraper } from '../subjects/adapters/beijing'
import { zhejiangRankTableScraper } from '../rank_tables/adapters/zhejiang'
import { jiangsuRankTableScraper } from '../rank_tables/adapters/jiangsu'
import { shandongRankTableScraper } from '../rank_tables/adapters/shandong'
import { hebeiRankTableScraper } from '../rank_tables/adapters/hebei'
import { hunanRankTableScraper } from '../rank_tables/adapters/hunan'
import { hubeiRankTableScraper } from '../rank_tables/adapters/hubei'
import { guangdongRankTableScraper } from '../rank_tables/adapters/guangdong'
import { beijingRankTableScraper } from '../rank_tables/adapters/beijing'

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

  // 湖北（3+1+2，院校专业组，物理类+历史类）
  registerProvince({
    meta: {
      name: '湖北',
      pinyinId: 'hubei',
      examMode: '3+1+2',
      volunteerMode: 'college-group',
      categories: ['物理类', '历史类'],
      batchSize: '本科批',
    },
    scoreScraper: hubeiScoreScraper,
    subjectScraper: hubeiSubjectScraper,
    rankTableScraper: hubeiRankTableScraper,
  })

  // 广东（3+1+2，院校专业组，物理类+历史类）
  registerProvince({
    meta: {
      name: '广东',
      pinyinId: 'guangdong',
      examMode: '3+1+2',
      volunteerMode: 'college-group',
      categories: ['物理类', '历史类'],
      batchSize: '本科批',
    },
    scoreScraper: guangdongScoreScraper,
    subjectScraper: guangdongSubjectScraper,
    rankTableScraper: guangdongRankTableScraper,
  })

  // 北京（3+3，院校专业组，综合）
  registerProvince({
    meta: {
      name: '北京',
      pinyinId: 'beijing',
      examMode: '3+3',
      volunteerMode: 'college-group',
      categories: ['综合'],
      batchSize: '本科批',
    },
    scoreScraper: beijingScoreScraper,
    subjectScraper: beijingSubjectScraper,
    rankTableScraper: beijingRankTableScraper,
  })

  initialized = true
}
