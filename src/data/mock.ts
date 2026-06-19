export interface Province {
  id: string
  name: string
  mode: 'major+college' | 'college-group'
  total: number
  subjects: '3+3' | '3+1+2'
}

export const provinces: Province[] = [
  { id: 'zhejiang', name: '浙江', mode: 'major+college', total: 80, subjects: '3+3' },
  { id: 'shandong', name: '山东', mode: 'major+college', total: 96, subjects: '3+3' },
  { id: 'hebei', name: '河北', mode: 'major+college', total: 96, subjects: '3+1+2' },
  { id: 'liaoning', name: '辽宁', mode: 'major+college', total: 112, subjects: '3+1+2' },
  { id: 'jiangsu', name: '江苏', mode: 'college-group', total: 40, subjects: '3+1+2' },
  { id: 'hubei', name: '湖北', mode: 'college-group', total: 45, subjects: '3+1+2' },
  { id: 'hunan', name: '湖南', mode: 'college-group', total: 45, subjects: '3+1+2' },
  { id: 'guangdong', name: '广东', mode: 'college-group', total: 45, subjects: '3+1+2' },
  { id: 'beijing', name: '北京', mode: 'college-group', total: 30, subjects: '3+3' },
  { id: 'shanghai', name: '上海', mode: 'college-group', total: 24, subjects: '3+3' },
]

export const subjectOptions = ['物理', '历史', '化学', '生物', '政治', '地理']

export const majorCategories = [
  '哲学', '经济学', '法学', '教育学', '文学', '历史学', '理学', '工学', '农学', '医学', '管理学', '艺术学',
]

export const regionOptions = ['北京', '上海', '江苏', '浙江', '广东', '湖北', '四川', '陕西']

export interface College {
  id: string
  name: string
  province: string
  city: string
  level: string[]
  type: string
  nature?: string
  affiliation?: string
  website?: string
  gaokaoUrl?: string
  admissionUrl?: string
  tags?: string[]
}

export const colleges: College[] = [
  { id: '1001', name: '清华大学', province: '北京', city: '北京', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.tsinghua.edu.cn' },
  { id: '1002', name: '北京大学', province: '北京', city: '北京', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.pku.edu.cn' },
  { id: '1003', name: '浙江大学', province: '浙江', city: '杭州', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.zju.edu.cn' },
  { id: '1004', name: '复旦大学', province: '上海', city: '上海', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.fudan.edu.cn' },
  { id: '1005', name: '南京大学', province: '江苏', city: '南京', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.nju.edu.cn' },
  { id: '1006', name: '上海交通大学', province: '上海', city: '上海', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.sjtu.edu.cn' },
  { id: '1007', name: '中国科学技术大学', province: '安徽', city: '合肥', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.ustc.edu.cn' },
  { id: '1008', name: '华中科技大学', province: '湖北', city: '武汉', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.hust.edu.cn' },
  { id: '1009', name: '武汉大学', province: '湖北', city: '武汉', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.whu.edu.cn' },
  { id: '1010', name: '西安交通大学', province: '陕西', city: '西安', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.xjtu.edu.cn' },
  { id: '1011', name: '中山大学', province: '广东', city: '广州', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.sysu.edu.cn' },
  { id: '1012', name: '四川大学', province: '四川', city: '成都', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.scu.edu.cn' },
  { id: '1013', name: '哈尔滨工业大学', province: '黑龙江', city: '哈尔滨', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.hit.edu.cn' },
  { id: '1014', name: '北京航空航天大学', province: '北京', city: '北京', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.buaa.edu.cn' },
  { id: '1015', name: '同济大学', province: '上海', city: '上海', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.tongji.edu.cn' },
  { id: '1016', name: '东南大学', province: '江苏', city: '南京', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.seu.edu.cn' },
  { id: '1017', name: '中国人民大学', province: '北京', city: '北京', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.ruc.edu.cn' },
  { id: '1018', name: '北京师范大学', province: '北京', city: '北京', level: ['本科'], type: '师范', tags: ['985', '211', '双一流'], website: 'https://www.bnu.edu.cn' },
  { id: '1019', name: '南开大学', province: '天津', city: '天津', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.nankai.edu.cn' },
  { id: '1020', name: '天津大学', province: '天津', city: '天津', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.tju.edu.cn' },
  { id: '1021', name: '北京理工大学', province: '北京', city: '北京', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.bit.edu.cn' },
  { id: '1022', name: '厦门大学', province: '福建', city: '厦门', level: ['本科'], type: '综合', tags: ['985', '211', '双一流'], website: 'https://www.xmu.edu.cn' },
  { id: '1023', name: '华南理工大学', province: '广东', city: '广州', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.scut.edu.cn' },
  { id: '1024', name: '电子科技大学', province: '四川', city: '成都', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.uestc.edu.cn' },
  { id: '1025', name: '西北工业大学', province: '陕西', city: '西安', level: ['本科'], type: '理工', tags: ['985', '211', '双一流'], website: 'https://www.nwpu.edu.cn' },
]

export interface Major {
  id: string
  name: string
  category: string
  discipline?: string
  duration?: number
  degreeType?: string
  subjects?: string[]
  tuition?: number
  colorBlind?: boolean
}

export const majors: Major[] = [
  { id: 'm001', name: '计算机科学与技术', category: '工学', duration: 4, subjects: ['物理', '化学'], tuition: 6000 },
  { id: 'm002', name: '软件工程', category: '工学', duration: 4, subjects: ['物理', '化学'], tuition: 6500 },
  { id: 'm003', name: '人工智能', category: '工学', duration: 4, subjects: ['物理', '化学'], tuition: 6500 },
  { id: 'm004', name: '电子信息工程', category: '工学', duration: 4, subjects: ['物理', '化学'], tuition: 6000 },
  { id: 'm005', name: '临床医学', category: '医学', duration: 5, subjects: ['物理', '化学'], tuition: 7000, colorBlind: true },
  { id: 'm006', name: '口腔医学', category: '医学', duration: 5, subjects: ['物理', '化学'], tuition: 7000, colorBlind: true },
  { id: 'm007', name: '金融学', category: '经济学', duration: 4, subjects: [], tuition: 5500 },
  { id: 'm008', name: '法学', category: '法学', duration: 4, subjects: [], tuition: 5500 },
  { id: 'm009', name: '汉语言文学', category: '文学', duration: 4, subjects: [], tuition: 5000 },
  { id: 'm010', name: '数学与应用数学', category: '理学', duration: 4, subjects: ['物理'], tuition: 5000 },
  { id: 'm011', name: '物理学', category: '理学', duration: 4, subjects: ['物理'], tuition: 5000 },
  { id: 'm012', name: '化学', category: '理学', duration: 4, subjects: ['化学'], tuition: 5000, colorBlind: true },
  { id: 'm013', name: '生物科学', category: '理学', duration: 4, subjects: ['物理', '化学'], tuition: 5000, colorBlind: true },
  { id: 'm014', name: '建筑学', category: '工学', duration: 5, subjects: ['物理'], tuition: 6500 },
  { id: 'm015', name: '工商管理', category: '管理学', duration: 4, subjects: [], tuition: 5500 },
  { id: 'm016', name: '教育学', category: '教育学', duration: 4, subjects: [], tuition: 5000 },
  { id: 'm017', name: '新闻学', category: '文学', duration: 4, subjects: [], tuition: 5500 },
  { id: 'm018', name: '工业设计', category: '工学', duration: 4, subjects: ['物理'], tuition: 6000 },
]

export interface ScoreRecord {
  collegeId: string
  majorId: string
  collegeName?: string
  majorName?: string
  year: number
  province?: string
  batch?: string
  category?: string
  minScore: number
  avgScore?: number
  minRank: number
  planCount?: number
}

function generateScores(): ScoreRecord[] {
  const records: ScoreRecord[] = []
  const baseRanks: Record<string, number> = {
    '1001': 400, '1002': 450, '1003': 1500, '1004': 1000, '1005': 2000,
    '1006': 1750, '1007': 2250, '1008': 4500, '1009': 4000, '1010': 5000,
    '1011': 5500, '1012': 7500, '1013': 6000, '1014': 3500, '1015': 3750,
    '1016': 6500, '1017': 2500, '1018': 9000, '1019': 8000, '1020': 8500,
    '1021': 4750, '1022': 7000, '1023': 10000, '1024': 8000, '1025': 11000,
  }
  colleges.forEach((c) => {
    const base = baseRanks[c.id] || 3000
    majors.forEach((m) => {
      const majorRankOffset = parseInt(m.id.slice(-3), 10) * 30
      for (let year = 2022; year <= 2025; year++) {
        const fluctuation = Math.floor(Math.random() * 200) - 100
        const rank = base + majorRankOffset + fluctuation
        records.push({
          collegeId: c.id,
          majorId: m.id,
          collegeName: c.name,
          majorName: m.name,
          year,
          minScore: 750 - Math.floor(rank / 100),
          avgScore: 755 - Math.floor(rank / 100),
          minRank: rank,
        })
      }
    })
  })
  return records
}

export const scoreRecords = generateScores()

export interface RecommendationItem {
  id: string
  college: College
  major: Major
  tier: 'rush' | 'stable' | 'safe'
  probability: number
  minRanks: { year: number; rank: number }[]
  reason: string
  source: string
}

export interface RiskItem {
  id: string
  type: 'slide' | 'reject'
  level: 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  reason: string
  suggestion: string
  affectedIndexes: number[]
}

export const hollandQuestions = [
  { id: 1, text: '我喜欢修理机械或电子设备', dimension: 'R' },
  { id: 2, text: '我喜欢动手做实验或制作东西', dimension: 'R' },
  { id: 3, text: '我喜欢分析数据、解决问题', dimension: 'I' },
  { id: 4, text: '我对科学研究感兴趣', dimension: 'I' },
  { id: 5, text: '我喜欢绘画、设计或音乐创作', dimension: 'A' },
  { id: 6, text: '我富有想象力，喜欢创新表达', dimension: 'A' },
  { id: 7, text: '我喜欢帮助别人解决困难', dimension: 'S' },
  { id: 8, text: '我善于与人沟通和合作', dimension: 'S' },
  { id: 9, text: '我喜欢组织活动、领导团队', dimension: 'E' },
  { id: 10, text: '我有较强的说服力和影响力', dimension: 'E' },
  { id: 11, text: '我喜欢按规则整理资料和数据', dimension: 'C' },
  { id: 12, text: '我做事细心、注重细节', dimension: 'C' },
]

export const subjectQuestions = [
  { id: 1, text: '我喜欢用数学方法解决实际问题', dimension: 'math', type: 'subject' as const },
  { id: 2, text: '我对机械设备的运作原理感到好奇', dimension: 'physics', type: 'subject' as const },
  { id: 3, text: '我喜欢做化学实验，观察物质反应', dimension: 'chemistry', type: 'subject' as const },
  { id: 4, text: '我对生命的奥秘和生物体结构感兴趣', dimension: 'biology', type: 'subject' as const },
  { id: 5, text: '我喜欢阅读文学作品或进行写作', dimension: 'chinese', type: 'subject' as const },
  { id: 6, text: '我对历史事件和文明演变感兴趣', dimension: 'history', type: 'subject' as const },
  { id: 7, text: '我喜欢研究地理环境与气候现象', dimension: 'geography', type: 'subject' as const },
  { id: 8, text: '我关注社会问题和公共政策', dimension: 'politics', type: 'subject' as const },
  { id: 9, text: '我喜欢学习外语和跨文化交流', dimension: 'foreign_lang', type: 'subject' as const },
  { id: 10, text: '我对音乐、绘画或设计有浓厚兴趣', dimension: 'art', type: 'subject' as const },
  { id: 11, text: '我喜欢编程或探索计算机技术', dimension: 'computer', type: 'subject' as const },
  { id: 12, text: '我对商业运作和经济规律感兴趣', dimension: 'economics', type: 'subject' as const },
  { id: 13, text: '我更倾向于学习理论知识而非动手实践', dimension: 'theory_practice', type: 'behavior' as const },
  { id: 14, text: '我更喜欢独立完成工作而非团队协作', dimension: 'individual_team', type: 'behavior' as const },
  { id: 15, text: '我更喜欢自由创造而非按规范执行', dimension: 'creative_structured', type: 'behavior' as const },
]

export const chatSuggestions = [
  '我的分数能上什么学校？',
  '软件工程和计算机科学有什么区别？',
  '新高考选科要求怎么看？',
  '什么是专业级差？',
]

export const mockChatReply = (question: string) => {
  if (question.includes('分数')) {
    return '根据你的位次和等效分，建议你重点查看"稳"档志愿，这些院校近3年录取位次与你的位次最为接近。你可以在推荐结果页查看具体方案。'
  }
  if (question.includes('软件工程') || question.includes('计算机')) {
    return '计算机科学与技术偏重理论和算法，软件工程偏重工程实践和项目管理。两者就业方向相近，都是热门专业。'
  }
  if (question.includes('选科')) {
    return '新高考选科要求通常标注为"物理+化学"等，表示必须选考对应科目。你可以在院校专业详情中查看具体要求。'
  }
  return '这是一个很好的问题。建议你结合自己的兴趣、分数位次以及未来职业规划综合考虑。如需具体数据，请查看推荐结果或数据中心。'
}
