// 阳光高考专业库 API 响应类型（内部使用）

/** 通用 API 响应包装 */
export interface ApiResponse<T> {
  msg: T
  flag: boolean
}

/** 门类/专业类列表项（mlCategory 和 xkCategory 共用） */
export interface CategoryItem {
  key: string
  name: string
}

/** 专业列表项（specialityesByCategory 返回） */
export interface MajorListItem {
  zydm: string
  zymc: string
  specId: string
  zymyd: string
  hasZyjs: boolean
}

/** 专业详情中的专业介绍 */
export interface MajorIntro {
  desc: string
  zymx: string | null
}

/** 专业详情中的就业方向项 */
export interface CareerDirectionItem {
  jyfx: string
  url4Xzpt: string
}

/** 专业详情中的就业方向信息 */
export interface CareerDirectionInfo {
  jyfxList: CareerDirectionItem[]
}

/** 专业详情中的满意度项 */
export interface SatisfactionItem {
  type: string
  typeDesc: string
  rank: number
  count: number
}

/** 专业详情中的考研方向项 */
export interface GraduateMajorItem {
  zydm: string
  zymc: string
}

/** 专业详情中的推荐院校项 */
export interface RecommendedCollegeItem {
  schId: string
  yxmc: string
  count: number
  rank: number
}

/** 专业详情中的相似专业项 */
export interface SimilarMajorItem {
  zydm: string
  zymc: string
  specId: string
}

/** 专业详情（specialityDetail 返回） */
export interface MajorDetailResponse {
  zydm: string
  zymc: string
  ml: string
  mlCode: string
  xk: string
  xkCode: string
  xlcc: string
  specId: string
  xsgm: string
  boyPercent: number
  girlPercent: number
  zyjs: MajorIntro | null
  jyfxInfo: CareerDirectionInfo | null
  zymyd: SatisfactionItem[]
  kyfx: GraduateMajorItem[]
  zytjzsList: RecommendedCollegeItem[]
  simileZyList: SimilarMajorItem[]
  year: string
}
