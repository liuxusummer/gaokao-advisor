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
  'VolunteerAssistant/1.0 (educational project; +https://github.com/your-username/gaokao-advisor)'

// === 分数线与一分一段表采集配置 ===

export const TARGET_YEARS = [2023, 2024, 2025]
export const TARGET_PROVINCES = (process.env.TARGET_PROVINCES?.split(',') as string[])
  ?? ['浙江', '江苏', '山东', '河北', '辽宁', '湖北', '湖南', '广东', '北京', '上海']

// 阳光高考详情页 URL 模板
export const GAOKAO_SCHOOL_DETAIL_URL = 'https://gaokao.chsi.com.cn/sch/schoolInfo-{collegeId}.dhtml'

// 浙江省考试院一分一段表 URL（官方发布为 PDF 格式）
// pageUrl: 发布页 URL（溯源用）；pdfUrl: PDF 直链（下载解析用）
export const ZJ_RANK_TABLE_URLS: Record<number, { pageUrl: string; pdfUrl: string }> = {
  2023: {
    pageUrl: 'https://www.zjzs.net/art/2023/6/26/art_45_6936.html',
    pdfUrl: 'https://www.zjzs.net/picture/0/plug-in/ueditor/jsp/upload/2023626/1687749056838007557.pdf',
  },
  2024: {
    pageUrl: 'https://www.zjzs.net/art/2024/6/26/art_155_9758.html',
    pdfUrl: 'https://www.zjzs.net/attach/0/3a2fa631275c4ade92963934126d8062.pdf',
  },
  2025: {
    pageUrl: 'https://www.zjzs.net/art/2025/6/25/art_155_11382.html',
    pdfUrl: 'https://www.zjzs.net/attach/0/a5aea92c4e474db78c43d1a86934dd2e.pdf',
  },
  2026: {
    pageUrl: 'https://www.zjzs.net/art/2026/6/26/art_155_12471.html',
    pdfUrl: 'https://www.zjzs.net/module/download/downfile.jsp?classid=0&showname=%E6%B5%99%E6%B1%9F%E7%9C%812026%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E6%88%90%E7%BB%A9%E5%88%86%E6%95%B0%E6%AE%B5%E8%A1%A8(%E6%80%BB%E5%88%86).pdf&filename=2af4db3ba885492fa7a607469eb75800.pdf',
  },
}

// 江苏省考试院一分一段表 URL（官方发布为 JPG 图片格式）
// pageUrl: 发布页 URL（溯源用）；images: 各科类 JPG 直链数组（部分年份分多张图片）
export const JS_RANK_TABLE_URLS: Record<number, {
  pageUrl: string
  images: Record<string, string[]>
}> = {
  2023: {
    pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2023-06-24/7078350479809318912.html',
    images: {
      '物理类': [
        'http://www.jseea.cn/webfile/upload/2023/06-24/20-36-230700-869910301.jpg',
        'http://www.jseea.cn/webfile/upload/2023/06-24/20-36-23083757285791.jpg',
      ],
      '历史类': [
        'http://www.jseea.cn/webfile/upload/2023/06-24/20-36-2306551622374165.jpg',
        'http://www.jseea.cn/webfile/upload/2023/06-24/20-36-230663-756047999.jpg',
      ],
    },
  },
  2024: {
    pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2024-06-24/7210960924591525888.html',
    images: {
      '物理类': [
        'http://www.jseea.cn/webfile/upload/2024/06-24/19-00-410503-277183924.jpg',
        'http://www.jseea.cn/webfile/upload/2024/06-24/19-00-410522-1780154283.jpg',
      ],
      '历史类': [
        'http://www.jseea.cn/webfile/upload/2024/06-24/19-00-410423916333379.jpg',
        'http://www.jseea.cn/webfile/upload/2024/06-24/19-00-410432261286875.jpg',
      ],
    },
  },
  2025: {
    pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2025-06-24/7343234265133355008.html',
    images: {
      '物理类': [
        'http://www.jseea.cn/webfile/upload/2025/06-24/19-09-070773-818991274.jpg',
      ],
      '历史类': [
        'http://www.jseea.cn/webfile/upload/2025/06-24/19-09-080264-1984111850.jpg',
      ],
    },
  },
}

// 产出路径
export const SCORES_OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'data', 'scores')
export const SCORES_REPORTS_DIR = path.join(SCORES_OUTPUT_DIR, 'reports')

// === 投档线采集 URL 配置 ===

// 浙江省考试院投档线（专业级，Excel 格式）
export const ZJ_TOUDANG_URLS: Record<number, { pageUrl: string; xlsUrl: string }> = {
  2023: {
    pageUrl: 'https://www.zjzs.net/art/2023/7/19/art_155_2089.html',
    xlsUrl: 'https://www.zjzs.net/picture/0/plug-in/ueditor/jsp/upload/2023719/1689731170158052765.xls',
  },
  2024: {
    pageUrl: 'https://www.zjzs.net/art/2024/7/21/art_155_9900.html',
    xlsUrl: 'https://www.zjzs.net/attach/0/80bebb3cf9b743aa800299669b4c6db5.xls',
  },
  2025: {
    pageUrl: 'https://www.zjzs.net/art/2025/7/21/art_155_11451.html',
    xlsUrl: 'https://www.zjzs.net/attach/0/c4110ef9c01a4b6ba1e231c2b5d2462f.xls',
  },
}

// 江苏省考试院投档线（院校专业组级，2023/2024 Excel，2025 PDF）
export const JS_TOUDANG_URLS: Record<number, {
  files: Record<'物理类' | '历史类', { pageUrl: string; url: string; format: 'xls' | 'pdf' }>
}> = {
  2023: {
    files: {
      '物理类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2023-07-18/7086888854866628608.html',
        url: 'https://www.jseea.cn/webfile/upload/2023/07-18/10-05-510166-183377989.xls',
        format: 'xls',
      },
      '历史类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2023-07-18/7086888854866628608.html',
        url: 'https://www.jseea.cn/webfile/upload/2023/07-18/10-05-510148-1404562985.xls',
        format: 'xls',
      },
    },
  },
  2024: {
    files: {
      '物理类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2024-07-18/7219509116052443136.html',
        url: 'https://www.jseea.cn/webfile/upload/2024/07-18/11-00-490856-746889704.xls',
        format: 'xls',
      },
      '历史类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2024-07-18/7219509116052443136.html',
        url: 'https://www.jseea.cn/webfile/upload/2024/07-18/09-11-430408314109108.xls',
        format: 'xls',
      },
    },
  },
  2025: {
    files: {
      '物理类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2025-07-18/7351781448019349504.html',
        url: 'https://www.jseea.cn/webfile/upload/2025/07-18/09-33-5302461102655621.pdf',
        format: 'pdf',
      },
      '历史类': {
        pageUrl: 'https://www.jseea.cn/webfile/index/index_zkxx/2025-07-18/7351781284785426432.html',
        url: 'https://www.jseea.cn/webfile/upload/2025/07-18/09-33-380724-1917118608.pdf',
        format: 'pdf',
      },
    },
  },
}

// === 专业目录与选科要求采集配置 ===

// 教育部本科专业目录 PDF（2026 年版）
export const MOE_CATALOG_PDF_URL = 'https://t4.chei.com.cn/news/getfile/2293468785-2293468784-5b411ed81523254b4ad6ad9cbcb3a6a0.pdf'
export const MOE_CATALOG_PAGE_URL = 'https://gaokao.chsi.com.cn/gkxx/zcdh/202604/20260428/2293468784.html'

// 浙江省选科要求 URL 模板（{国标码} 替换为 5 位院校国标码）
export const ZJ_SUBJECTS_URL_TEMPLATE = 'https://www.zjzs.net/col/xk2024/{guobiaoCode}.html'

// 江苏省选科要求 Excel（2024 版，适用于 2024-2025 届）
export const JS_SUBJECTS_XLSX_URL = 'https://www.jseea.cn/webfile/upload/2022/01-18/13-55-050949-615118096.xlsx'
export const JS_SUBJECTS_PAGE_URL = 'https://www.jseea.cn/webfile/index/index_zkxx/2022-01-18/27031.html'

// 13 个学科门类
export const MAJOR_CATEGORIES = [
  '哲学', '经济学', '法学', '教育学', '文学', '历史学',
  '理学', '工学', '农学', '医学', '管理学', '艺术学', '交叉学科'
]

// ===== Phase D: 详细专业目录 API =====

export const MAJOR_DETAIL_API_BASE = 'https://gaokao.chsi.com.cn/zyk/zybk'

export const UNDERGRADUATE_ROOT_KEY = '1050'
export const VOCATIONAL_ROOT_KEY = '1060'

export const MAJOR_DETAIL_OUTPUT_DIR = path.join(OUTPUT_DIR, 'majors')
export const MAJOR_DETAIL_OUTPUT_FILE = path.join(MAJOR_DETAIL_OUTPUT_DIR, 'detailed-catalog.json')
export const MAJOR_DETAIL_META_FILE = path.join(MAJOR_DETAIL_OUTPUT_DIR, 'detailed-catalog.meta.json')
export const MAJOR_DETAIL_PARTIAL_FILE = path.join(MAJOR_DETAIL_OUTPUT_DIR, 'detailed-catalog.partial.json')
export const MAJOR_DETAIL_FAILED_FILE = path.join(REPORTS_DIR, 'majors_details_failed.json')
