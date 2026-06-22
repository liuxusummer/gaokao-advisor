// 重新处理 scores JSON 文件 v3 - 补充更多简称映射
import fs from 'node:fs'
import path from 'node:path'

const SCORES_DIR = 'volunteer-assistant/public/data/scores'
const COLLEGES_FILE = 'volunteer-assistant/public/data/common/colleges.json'

interface CollegeRecord {
  id: string
  name: string
  [key: string]: unknown
}

interface ScoreRecord {
  collegeId: string
  collegeName: string
  year: number
  province: string
  _meta: {
    verified: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

// 完整简称映射表：简称 -> 全称
const SHORT_NAME_MAP: Record<string, string> = {
  // 上海简称
  '上海交大': '上海交通大学',
  '上海体大': '上海体育大学',
  '上海外大': '上海外国语大学',
  '上海师大': '上海师范大学',
  '上海海大': '上海海洋大学',
  '上海财大': '上海财经大学',
  '上经贸大': '上海对外经贸大学',
  '上应大': '上海应用技术大学',
  '上工程': '上海工程技术大学',
  '上外贤达': '上海外国语大学贤达经济人文学院',
  '上师天华': '上海师范大学天华学院',
  '上财浙院': '上海财经大学浙江学院',
  '二工大': '上海第二工业大学',
  '中侨大学': '上海中侨职业技术大学',
  '交大医学': '上海交通大学医学院',
  '复旦医学': '复旦大学上海医学院',
  '浙大医学': '浙江大学医学院',
  '北师浸会': '北京师范大学-香港浸会大学联合国际学院',
  '北师香港浸会大学': '北京师范大学-香港浸会大学联合国际学院',
  '立信金融': '上海立信会计金融学院',

  // 北京简称
  '北京二外': '北京第二外国语学院',
  '北京交大': '北京交通大学',
  '北京林大': '北京林业大学',
  '北京科大': '北京科技大学',
  '北京联大': '北京联合大学',
  '北京航大': '北京航空航天大学',
  '北外大': '北京外国语大学',
  '北师大': '北京师范大学',
  '北邮宏福': '北京邮电大学世纪学院',
  '人大苏州': '中国人民大学苏州校区',
  '中国人大': '中国人民大学',
  '中国公安': '中国人民公安大学',
  '中国农大': '中国农业大学',
  '中国劳关': '中国劳动关系学院',
  '中国医大': '中国医科大学',
  '中国矿大': '中国矿业大学',
  '中国科大': '中国科学技术大学',
  '中国美院': '中国美术学院',
  '中国药大': '中国药科大学',
  '中国警察': '中国人民警察大学',
  '中央美院': '中央美术学院',
  '中央财大': '中央财经大学',
  '首都体院': '首都体育学院',
  '首都经贸': '首都经济贸易大学',
  '首师科德': '首都师范大学科德学院',
  '中计现代': '中国传媒大学',

  // 华东/华中简称
  '华东交大': '华东交通大学',
  '华东师大': '华东师范大学',
  '华中农大': '华中农业大学',
  '华中师大': '华中师范大学',
  '华中科大': '华中科技大学',
  '华南农大': '华南农业大学',
  '华南师大': '华南师范大学',
  '华北水电': '华北水利水电大学',
  '华电保定': '华北电力大学保定校区',
  '华电北京': '华北电力大学',

  // 东北简称
  '东北农大': '东北农业大学',
  '东北师大': '东北师范大学',
  '东北林大': '东北林业大学',
  '东北财大': '东北财经大学',
  '东大秦岛': '东北大学秦皇岛分校',
  '哈医大': '哈尔滨医科大学',
  '哈商大': '哈尔滨商业大学',
  '哈工大': '哈尔滨工业大学',
  '哈工威海': '哈尔滨工业大学威海校区',
  '哈工深圳': '哈尔滨工业大学深圳校区',
  '哈工程': '哈尔滨工程大学',
  '哈师大': '哈尔滨师范大学',
  '哈理工': '哈尔滨理工大学',
  '哈金融': '哈尔滨金融学院',

  // 南京简称
  '南京农大': '南京农业大学',
  '南京医大': '南京医科大学',
  '南京工大': '南京工业大学',
  '南京师大': '南京师范大学',
  '南京林大': '南京林业大学',
  '南京航大': '南京航空航天大学',
  '南京财大': '南京财经大学',
  '南京特师': '南京特殊教育师范学院',
  '南医康达': '南京医科大学康达学院',
  '南审金审': '南京审计大学金审学院',
  '南工浦江': '南京工业大学浦江学院',
  '南师泰州': '南京师范大学泰州学院',
  '南理紫金': '南京理工大学紫金学院',
  '南航科技': '南京航空航天大学金城学院',
  '南航金城': '南京航空航天大学金城学院',
  '南邮通达': '南京邮电大学通达学院',
  '南通杏林': '南通大学杏林学院',

  // 石油/地质/矿业简称
  '石油北京': '中国石油大学(北京)',
  '石油华东': '中国石油大学(华东)',
  '地大北京': '中国地质大学(北京)',
  '地大武汉': '中国地质大学(武汉)',
  '矿大北京': '中国矿业大学(北京)',
  '中油北克': '中国石油大学(北京)克拉玛依校区',

  // 分校/校区简称
  '山大威海': '山东大学威海分校',
  '北交威海': '北京交通大学威海校区',
  '理工盘锦': '大连理工大学盘锦校区',
  '理大城市': '河南理工大学万方科技学院',
  '哈工威海': '哈尔滨工业大学威海校区',
  '哈工深圳': '哈尔滨工业大学深圳校区',
  '东大秦岛': '东北大学秦皇岛分校',
  '中油北克': '中国石油大学(北京)克拉玛依校区',
  '人大苏州': '中国人民大学苏州校区',
  '华电保定': '华北电力大学保定校区',

  // 医学院
  '交大医学': '上海交通大学医学院',
  '复旦医学': '复旦大学上海医学院',
  '浙大医学': '浙江大学医学院',

  // 其他
  '湘理南湖': '湖南理工学院南湖学院',
  '滨州学院': '滨州学院',
  '潍坊医学院': '潍坊医学院',
  '福州外贸': '福建对外经济贸易职业技术学院',
  '山西医科': '山西医科大学',
  '山西医大': '山西医科大学',
  '北京社会管理职业学院': '北京社会管理职业学院',
  '天津公安警官职业学院': '天津公安警官职业学院',
  '安徽医学高等专科学校': '安徽医学高等专科学校',

  // 其他省份简称
  '合肥城院': '合肥城市学院',
  '合肥工大': '合肥工业大学',
  '合肥学院': '合肥大学',
  '吉林师大': '吉林师范大学',
  '吉林财大': '吉林财经大学',
  '四川农大': '四川农业大学',
  '四川师大': '四川师范大学',
  '四川美院': '四川美术学院',
  '大连交大': '大连交通大学',
  '天津商大': '天津商业大学',
  '天津外大': '天津外国语大学',
  '天津工大': '天津工业大学',
  '天津科大': '天津科技大学',
  '天津美院': '天津美术学院',
  '天津职师': '天津职业技术师范大学',
  '天津财大': '天津财经大学',
  '太原科大': '太原科技大学',
  '宁夏医大': '宁夏医科大学',
  '安徽农大': '安徽农业大学',
  '安徽医大': '安徽医科大学',
  '安徽工大': '安徽工业大学',
  '安徽师大': '安徽师范大学',
  '安徽财大': '安徽财经大学',
  '山东二医': '山东第二医科大学',
  '山东师大': '山东师范大学',
  '山东石化': '山东石油化工学院',
  '山东科大': '山东科技大学',
  '山西农大': '山西农业大学',
  '山西医科': '山西医科大学',
  '山西财大': '山西财经大学',
  '岭南师院': '岭南师范学院',
  '常熟理工': '常熟理工学院',
  '常熟理工学院': '常熟理工学院',
  '广州医大': '广州医科大学',
  '广西师大': '广西师范大学',
  '徐州医大': '徐州医科大学',
  '新疆农大': '新疆农业大学',
  '新疆财大': '新疆财经大学',
  '昆医海源': '昆明医科大学海源学院',
  '昆明医大': '昆明医科大学',
  '景德陶瓷': '景德镇陶瓷大学',
  '曲阜师大': '曲阜师范大学',
  '杭州师大': '杭州师范大学',
  '武汉科大': '武汉科技大学',
  '武汉城院': '武汉城市学院',
  '民航飞院': '中国民用航空飞行学院',
  '江苏海大': '江苏海洋大学',
  '江苏科大': '江苏科技大学',
  '江西农大': '江西农业大学',
  '江西师大': '江西师范大学',
  '江西科师': '江西科技师范大学',
  '江西财大': '江西财经大学',
  '沈阳农大': '沈阳农业大学',
  '沈阳药大': '沈阳药科大学',
  '河北工大': '河北工业大学',
  '河北建工': '河北建筑工程学院',
  '河南农大': '河南农业大学',
  '河南师大': '河南师范大学',
  '河南科大': '河南科技大学',
  '浙江工大': '浙江工业大学',
  '浙江师大': '浙江师范大学',
  '浙江财大': '浙江财经大学',
  '海南医大': '海南医科大学',
  '海南师大': '海南师范大学',
  '海南医学院': '海南医科大学',
  '淮北师大': '淮北师范大学',
  '淮南师院': '淮南师范学院',
  '温州医大': '温州医科大学',
  '湖北汽院': '湖北汽车工业学院',
  '湖南农大': '湖南农业大学',
  '湖南师大': '湖南师范大学',
  '湖南科大': '湖南科技大学',
  '滨州学院': '滨州学院',
  '潍坊医学院': '潍坊医学院',
  '电子科大': '电子科技大学',
  '电科成院': '电子科技大学成都学院',
  '福州外贸': '福建对外经济贸易职业技术学院',
  '福建医大': '福建医科大学',
  '西交城市': '西安交通大学城市学院',
  '西北工大': '西北工业大学',
  '西北师大': '西北师范大学',
  '西华师大': '西华师范大学',
  '西南交大': '西南交通大学',
  '西南医大': '西南医科大学',
  '西南科大': '西南科技大学',
  '西南财大': '西南财经大学',
  '西安交大': '西安交通大学',
  '西安外大': '西安外国语大学',
  '西安工大': '西安工业大学',
  '西安建科': '西安建筑科技大学',
  '西安科大': '西安科技大学',
  '西安财大': '西安财经大学',
  '西电科大': '西安电子科技大学',
  '西财天府': '西南财经大学天府学院',
  '西浦大学': '西交利物浦大学',
  '贵州财大': '贵州财经大学',
  '赣南医大': '赣南医科大学',
  '赣南医学院': '赣南医科大学',
  '赣南师大': '赣南师范大学',
  '赣南科院': '赣南科技学院',
  '赣师科技': '赣南师范大学科技学院',
  '赣应科院': '江西应用科技学院',
  '赣农商院': '江西农业大学南昌商学院',
  '辽宁外贸': '辽宁对外经贸学院',
  '辽宁师大': '辽宁师范大学',
  '辽宁科大': '辽宁科技大学',
  '重庆交大': '重庆交通大学',
  '重庆医大': '重庆医科大学',
  '重庆城科': '重庆城市科技学院',
  '重庆外事': '重庆外语外事学院',
  '重庆外贸': '重庆对外经贸学院',
  '重庆电子工程职业学院': '重庆电子科技职业大学',
  '重庆师大': '重庆师范大学',
  '重庆科大': '重庆科技大学',
  '锦州医大': '锦州医科大学',
  '长春工大': '长春工业大学',
  '闽农金山': '福建农林大学金山学院',
  '陕西师大': '陕西师范大学',
  '陕西科大': '陕西科技大学',
  '集美诚毅': '集美大学诚毅学院',
  '青岛农大': '青岛农业大学',
  '青岛科大': '青岛科技大学',
  '黑科大': '黑龙江科技大学',
  '齐医学院': '齐齐哈尔医学院',
  '齐鲁工大': '齐鲁工业大学',
  '蚌埠医学院': '蚌埠医科大学',
  '嘉兴学院': '嘉兴大学',
  '南昌师院': '南昌师范学院',
  '南昌航大': '南昌航空大学',
  '南宁师大': '南宁师范大学',
  '上饶师院': '上饶师范学院',
  '内江师院': '内江师范学院',
  '伊犁师大': '伊犁师范大学',
  '兰州交大': '兰州交通大学',
  '兰州环职': '兰州资源环境职业技术大学',
  '兰州财大': '兰州财经大学',
  '忻州师院': '忻州师范学院',
  '运城职大': '运城职业技术大学',
  '和田师范专科学校': '新疆和田学院',
  '扬州市职业大学': '扬州职业技术大学',
  '苏州职业大学': '苏州职业技术大学',
  '苏州城院': '苏州城市学院',
  '苏州科大': '苏州科技大学',
  '石铁大': '石家庄铁道大学',
  '石铁四方': '石家庄铁道大学四方学院',
  '冀油职大': '河北石油职业技术大学',
  '内蒙大学': '内蒙古大学',
  '天津公安警官职业学院': '天津公安警官职业学院',
  '北京社会管理职业学院': '北京社会管理职业学院',
  '安徽医学高等专科学校': '安徽医学高等专科学校',
  '中南财政': '中南财经政法大学',
  '云南农大': '云南农业大学',
  '云南师大': '云南师范大学',
  '云南民大': '云南民族大学',
  '云南财大': '云南财经大学',

  // 独立学院
  '三峡科技': '三峡大学科技学院',
  '京中东方': '北京中医药大学东方学院',
  '京工耿丹': '北京工业大学耿丹学院',
  '京科天津': '北京科技大学天津学院',
  '二外中瑞': '北京第二外国语学院中瑞酒店管理学院',
  '江大京江': '江苏大学京江学院',
  '江师科技': '江苏师范大学科文学院',
  '江科苏理': '江苏科技大学苏州理工学院',
  '苏大应用': '苏州大学应用技术学院',
  '厦大嘉庚': '厦门大学嘉庚学院',
  '武纺外贸': '武汉纺织大学外经贸学院',
  '江财经管': '江西财经大学现代经济管理学院',
  '湘理南湖': '湖南理工学院南湖学院',
  '温医仁济': '温州医科大学仁济学院',
  '安医临床': '安徽医科大学临床医学院',
  '鄂医药护': '湖北医药学院药护学院',
  '津医临床': '天津医科大学临床医学院',
  '津商宝德': '天津商业大学宝德学院',
  '津理中环': '天津理工大学中环信息学院',
  '津财珠江': '天津财经大学珠江学院',
  '聊城东昌': '聊城大学东昌学院',

  // 军校（不在 colleges.json 中，使用专用 ID）
  '国防科技大学': '国防科技大学',
  '海军军医大学': '海军军医大学',
  '空军军医大学': '空军军医大学',
  '陆军军医大学': '陆军军医大学',
  '陆军工程大学': '陆军工程大学',
  '海医大': '海军军医大学',

  // 其他
  '珠海科院': '珠海科技学院',
  '广以理工': '广东以色列理工学院',
  '海南比科': '海南比勒费尔德应用科学大学',
  '香港珠海学院': '香港珠海学院',

  // 新更名院校
  '新乡医学': '新乡医学院',
  '新乡医学院': '新乡医学院',
  '新乡医学院三全学院': '新乡医学院三全学院',
  '桂林医学': '桂林医学院',
  '桂林医学院': '桂林医学院',
}

// 军校和特殊院校的专用 ID 映射
const SPECIAL_COLLEGE_IDS: Record<string, string> = {
  '国防科技大学': '4133010001',
  '海军军医大学': '4131010002',
  '空军军医大学': '4161010003',
  '陆军军医大学': '4150010004',
  '陆军工程大学': '4132010005',
  '香港珠海学院': '8144000001',
  '新乡医学院': '4141010472',
  '新乡医学院三全学院': '4141013505',
  '桂林医学院': '4145010601',
  '常熟理工学院': '4132010333',
  // 分校/校区
  '山东大学威海分校': '4137010423',
  '哈尔滨工业大学威海校区': '4123010214',
  '哈尔滨工业大学深圳校区': '4123010215',
  '东北大学秦皇岛分校': '4121010142',
  '北京交通大学威海校区': '4111010005',
  '大连理工大学盘锦校区': '4121010143',
  '华北电力大学保定校区': '4111010055',
  '中国人民大学苏州校区': '4111010006',
  '中国石油大学(北京)克拉玛依校区': '4111011416',
  // 医学院
  '上海交通大学医学院': '4131010249',
  '复旦大学上海医学院': '4131010250',
  '浙江大学医学院': '4133010336',
  // 其他
  '湖南理工学院南湖学院': '4143010544',
  '滨州学院': '4137010441',
  '潍坊医学院': '4137010442',
  '福建对外经济贸易职业技术学院': '4135010867',
  '山西医科大学': '4114010114',
  '北京社会管理职业学院': '4111014280',
  '天津公安警官职业学院': '4112013880',
  '安徽医学高等专科学校': '4134010368',
  '河南理工大学万方科技学院': '4141013506',
}

function matchCollege(
  name: string,
  collegesByName: Map<string, CollegeRecord>
): { collegeId: string; matchType: string } {
  // 0. 简称映射表匹配
  const mapped = SHORT_NAME_MAP[name]
  if (mapped) {
    // 先检查专用 ID 映射
    if (SPECIAL_COLLEGE_IDS[mapped]) {
      return { collegeId: SPECIAL_COLLEGE_IDS[mapped], matchType: 'special_id' }
    }
    const mappedMatch = collegesByName.get(mapped)
    if (mappedMatch) return { collegeId: mappedMatch.id, matchType: 'short_map' }
    // 尝试半角括号
    const mappedNorm = mapped.replace(/（/g, '(').replace(/）/g, ')')
    if (mappedNorm !== mapped) {
      const normMatch = collegesByName.get(mappedNorm)
      if (normMatch) return { collegeId: normMatch.id, matchType: 'short_map_norm' }
    }
    // 尝试全角括号
    const mappedFull = mapped.replace(/\(/g, '（').replace(/\)/g, '）')
    if (mappedFull !== mapped) {
      const fullMatch = collegesByName.get(mappedFull)
      if (fullMatch) return { collegeId: fullMatch.id, matchType: 'short_map_full' }
    }
  }

  // 检查专用 ID 映射
  if (SPECIAL_COLLEGE_IDS[name]) {
    return { collegeId: SPECIAL_COLLEGE_IDS[name], matchType: 'direct_special_id' }
  }

  // 1. 精确匹配
  const exact = collegesByName.get(name)
  if (exact) return { collegeId: exact.id, matchType: 'exact' }

  // 2. 统一括号后精确匹配
  const normalized = name.replace(/（/g, '(').replace(/）/g, ')')
  if (normalized !== name) {
    const normMatch = collegesByName.get(normalized)
    if (normMatch) return { collegeId: normMatch.id, matchType: 'normalized' }
  }
  const fullNormalized = name.replace(/\(/g, '（').replace(/\)/g, '）')
  if (fullNormalized !== name) {
    const fullNormMatch = collegesByName.get(fullNormalized)
    if (fullNormMatch) return { collegeId: fullNormMatch.id, matchType: 'full_normalized' }
  }

  // 3. 去除后缀匹配（处理 "[公办]"、"[民办]"、"第 01组" 等后缀）
  const suffixStripped = name.replace(/\s*\[.*?\]\s*/g, '').replace(/\s*第\s*\d+\s*组\s*/g, '').trim()
  if (suffixStripped !== name) {
    const suffixMatch = collegesByName.get(suffixStripped)
    if (suffixMatch) return { collegeId: suffixMatch.id, matchType: 'suffix_stripped' }
    const suffixNorm = suffixStripped.replace(/（/g, '(').replace(/）/g, ')')
    const suffixNormMatch = collegesByName.get(suffixNorm)
    if (suffixNormMatch) return { collegeId: suffixNormMatch.id, matchType: 'suffix_normalized' }
    const suffixMapped = SHORT_NAME_MAP[suffixStripped]
    if (suffixMapped) {
      if (SPECIAL_COLLEGE_IDS[suffixMapped]) {
        return { collegeId: SPECIAL_COLLEGE_IDS[suffixMapped], matchType: 'suffix_special_id' }
      }
      const suffixMappedMatch = collegesByName.get(suffixMapped)
      if (suffixMappedMatch) return { collegeId: suffixMappedMatch.id, matchType: 'suffix_short_map' }
      // 尝试全角括号
      const suffixMappedFull = suffixMapped.replace(/\(/g, '（').replace(/\)/g, '）')
      if (suffixMappedFull !== suffixMapped) {
        const suffixFullMatch = collegesByName.get(suffixMappedFull)
        if (suffixFullMatch) return { collegeId: suffixFullMatch.id, matchType: 'suffix_short_map_full' }
      }
    }
    // 也检查专用 ID
    if (SPECIAL_COLLEGE_IDS[suffixStripped]) {
      return { collegeId: SPECIAL_COLLEGE_IDS[suffixStripped], matchType: 'suffix_direct_special_id' }
    }
  }

  // 4. 去括号匹配
  const halfBracketIndex = name.indexOf('(')
  const fullBracketIndex = name.indexOf('（')
  let bracketIndex = -1
  if (halfBracketIndex > 0 && fullBracketIndex > 0) {
    bracketIndex = Math.min(halfBracketIndex, fullBracketIndex)
  } else if (halfBracketIndex > 0) {
    bracketIndex = halfBracketIndex
  } else if (fullBracketIndex > 0) {
    bracketIndex = fullBracketIndex
  }
  if (bracketIndex > 0) {
    const stripped = name.substring(0, bracketIndex).trim()
    const strippedMatch = collegesByName.get(stripped)
    if (strippedMatch) return { collegeId: strippedMatch.id, matchType: 'stripped' }
    const strippedMapped = SHORT_NAME_MAP[stripped]
    if (strippedMapped) {
      if (SPECIAL_COLLEGE_IDS[strippedMapped]) {
        return { collegeId: SPECIAL_COLLEGE_IDS[strippedMapped], matchType: 'stripped_special_id' }
      }
      const strippedMappedMatch = collegesByName.get(strippedMapped)
      if (strippedMappedMatch) return { collegeId: strippedMappedMatch.id, matchType: 'stripped_short_map' }
    }
  }

  // 5. 简称匹配
  const baseName = (suffixStripped || name).replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim()
  if (baseName && baseName !== name) {
    const baseMatch = collegesByName.get(baseName)
    if (baseMatch) return { collegeId: baseMatch.id, matchType: 'base_name' }
    const baseMapped = SHORT_NAME_MAP[baseName]
    if (baseMapped) {
      if (SPECIAL_COLLEGE_IDS[baseMapped]) {
        return { collegeId: SPECIAL_COLLEGE_IDS[baseMapped], matchType: 'base_special_id' }
      }
      const baseMappedMatch = collegesByName.get(baseMapped)
      if (baseMappedMatch) return { collegeId: baseMappedMatch.id, matchType: 'base_short_map' }
    }
  }

  // 6. 包含匹配
  for (const [collegeName, college] of collegesByName) {
    const collegeNorm = collegeName.replace(/（/g, '(').replace(/）/g, ')')
    if (collegeNorm.includes(normalized) || normalized.includes(collegeNorm)) {
      return { collegeId: college.id, matchType: 'contains' }
    }
  }

  // 7. 简称包含匹配
  if (baseName && baseName.length >= 3) {
    for (const [collegeName, college] of collegesByName) {
      const collegeShort = collegeName.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').replace(/(大学|学院|职业学校|职业技术学院)$/g, '').trim()
      if (collegeShort.length >= 3 && (collegeShort.includes(baseName) || baseName.includes(collegeShort))) {
        return { collegeId: college.id, matchType: 'short_contains' }
      }
    }
  }

  return { collegeId: '', matchType: 'none' }
}

async function main() {
  console.log('=== 重新处理 scores JSON 文件 v3 ===\n')

  const colleges: CollegeRecord[] = JSON.parse(fs.readFileSync(COLLEGES_FILE, 'utf-8'))
  const collegesByName = new Map<string, CollegeRecord>()
  for (const college of colleges) {
    collegesByName.set(college.name, college)
  }
  console.log(`加载 ${colleges.length} 所院校\n`)

  const provinces = fs.readdirSync(SCORES_DIR).filter((d) => {
    const stat = fs.statSync(path.join(SCORES_DIR, d))
    return stat.isDirectory() && d !== 'reports'
  })

  let totalRecords = 0
  let totalMatched = 0
  let totalStillEmpty = 0
  const matchTypeCount: Record<string, number> = {}
  const stillUnmatched = new Set<string>()

  for (const province of provinces.sort()) {
    const provinceDir = path.join(SCORES_DIR, province)
    const files = fs.readdirSync(provinceDir).filter((f) => f.startsWith('scores_') && f.endsWith('.json'))

    for (const file of files.sort()) {
      const yearMatch = file.match(/scores_(\d+)\.json/)
      if (!yearMatch) continue
      const year = parseInt(yearMatch[1], 10)

      const filePath = path.join(provinceDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const records: ScoreRecord[] = JSON.parse(content)

      if (records.length === 0) continue

      let matched = 0
      let stillEmpty = 0

      for (const record of records) {
        const result = matchCollege(record.collegeName, collegesByName)

        if (result.collegeId) {
          record.collegeId = result.collegeId
          record._meta.verified = true
          matched++
          matchTypeCount[result.matchType] = (matchTypeCount[result.matchType] || 0) + 1
        } else {
          record._meta.verified = false
          if (!record.collegeId) {
            stillEmpty++
            stillUnmatched.add(record.collegeName)
          }
        }
      }

      totalRecords += records.length
      totalMatched += matched
      totalStillEmpty += stillEmpty

      if (stillEmpty > 0) {
        console.log(`${province} ${year}: 匹配 ${matched}/${records.length}，仍空 ${stillEmpty}`)
      }

      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8')
    }
  }

  console.log(`\n=== 统计 ===`)
  console.log(`总记录: ${totalRecords}`)
  console.log(`匹配成功: ${totalMatched} (${((totalMatched / totalRecords) * 100).toFixed(2)}%)`)
  console.log(`仍为空: ${totalStillEmpty}`)
  console.log(`\n匹配类型分布:`, matchTypeCount)

  if (stillUnmatched.size > 0) {
    console.log(`\n仍无法匹配的院校 (${stillUnmatched.size} 所):`)
    for (const name of Array.from(stillUnmatched).sort()) {
      console.log(`  - ${name}`)
    }
  }
}

main().catch(console.error)
