import path from 'node:path'

export const SCRAPER_VERSION = '1.0.0'
export const SCHEMA_VERSION = '1.0.0'

// 数据源 URL（年度更新时维护此处）
// 2025 年度全国高等学校名单发布页（含 Excel 附件）
export const MOE_LIST_URL =
  'https://hudong.moe.gov.cn/jyb_xxgk/s5743/s5744/A03/202506/t20250627_1195683.html'

export const GAOKAO_BASE_URL = 'https://gaokao.chsi.com.cn'

// 31 个省级行政区（阳光高考省份代码映射）
export const PROVINCES = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
  '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
]

// HTTP 配置
export const HTTP_TIMEOUT = 30000
export const HTTP_MAX_RETRIES = 3
export const HTTP_RETRY_BASE_DELAY = 1000
export const GAOKAO_QPS = 2

// 路径配置
export const ROOT_DIR = path.resolve(process.cwd())
export const RAW_DIR = path.join(ROOT_DIR, 'raw')
export const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'data', 'common')
export const REPORTS_DIR = path.join(OUTPUT_DIR, 'reports')
export const LOGS_DIR = path.join(ROOT_DIR, 'logs')

// User-Agent
export const USER_AGENT =
  'VolunteerAssistant/1.0 (educational project; +https://github.com/your-org/volunteer-assistant)'

// === 分数线与一分一段表采集配置 ===

export const TARGET_YEARS = [2023, 2024, 2025]
export const TARGET_PROVINCES = ['浙江', '江苏']

// 阳光高考详情页 URL 模板
export const GAOKAO_SCHOOL_DETAIL_URL = 'https://gaokao.chsi.com.cn/sch/schoolInfo-{collegeId}.dhtml'

// 浙江省考试院一分一段表 URL（年度更新时维护，实现时确认实际发布页路径）
export const ZJ_RANK_TABLE_URLS: Record<number, string> = {
  2023: '',
  2024: '',
  2025: '',
}

// 江苏省考试院一分一段表 URL（年度更新时维护，实现时确认实际发布页路径）
export const JS_RANK_TABLE_URLS: Record<number, Record<string, string>> = {
  2023: { '物理类': '', '历史类': '' },
  2024: { '物理类': '', '历史类': '' },
  2025: { '物理类': '', '历史类': '' },
}

// 产出路径
export const SCORES_OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'data', 'scores')
export const SCORES_REPORTS_DIR = path.join(SCORES_OUTPUT_DIR, 'reports')
