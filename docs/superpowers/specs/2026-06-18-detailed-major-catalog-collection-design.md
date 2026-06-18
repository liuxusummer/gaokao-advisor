# 详细专业目录采集设计

> 日期：2026-06-18
> 阶段：Phase D
> 目标：采集教育部认证的全量专业目录（本科 883 + 高职专科 748 = 1631 个），含专业介绍、培养目标、就业方向、学制学位、统计信息等详细字段

## 1. 背景与目标

### 1.1 现状

Phase C 已完成基础专业目录采集（`public/data/common/majors/catalog.json`，875 条记录），但字段稀疏：`degreeType` 和 `duration` 均为空字符串，仅有专业代码、名称、门类、专业类 4 个基础字段，缺少用户所需的详细信息。

### 1.2 用户需求

- **数据范围**：本科（883）+ 高职专科（748）= 全量 1631 个专业
- **详细字段**（4 组）：
  1. 专业介绍 + 培养目标
  2. 主干课程
  3. 就业方向
  4. 学制学位 + 统计信息

### 1.3 数据源

阳光高考专业库 API（`gaokao.chsi.com.cn`），教育部高校招生阳光工程指定平台。通过 4 步树形遍历获取全量目录及详情，返回结构化 JSON。

## 2. 架构与数据流

### 2.1 模块结构

新增 `scripts/scrapers/majors/detail/` 模块，与现有 `majors/`（MOE PDF 目录解析）并列：

```
scripts/scrapers/majors/
├── index.ts              # 现有：MOE PDF 目录解析
├── parse.ts              # 现有：PDF 解析
├── validate.ts           # 现有：目录校验
└── detail/               # 新增：阳光高考详情采集
    ├── types.ts          # API 响应类型 + 详细目录记录类型
    ├── api.ts            # 4 个 API 端点封装
    ├── crawler.ts        # 树形遍历编排器
    ├── parse.ts          # API 响应 → DetailedMajorRecord 转换
    ├── validate.ts       # 记录校验
    └── index.ts          # 主入口
```

### 2.2 数据流（4 步树形遍历）

```
1. fetchCategories(rootKey)        → CategoryItem[]     门类列表
2. fetchSubcategories(catKey)      → CategoryItem[]     专业类列表
3. fetchMajors(subcatKey)          → MajorListItem[]    专业列表（含 specId）
4. fetchMajorDetail(specId)        → MajorDetailResponse 专业详情
```

**两个目录顺序采集：**
- 本科：rootKey=`1050` → 13 门类 → 92 专业类 → 883 专业 → 883 详情
- 专科：rootKey=`1060` → 19 大类 → ~90 专业类 → 748 专业 → 748 详情

**QPS 控制**：复用现有 `GAOKAO_QPS=2`（500ms 间隔），所有 API 请求经过 HttpClient 限速。

### 2.3 输出文件

```
public/data/common/majors/
├── catalog.json              # 现有：875 条基础目录（保留不动）
└── detailed-catalog.json     # 新增：1631 条详细目录
```

新建 `detailed-catalog.json` 而非覆盖 `catalog.json`，保持数据分层：基础目录（Phase C）+ 详细目录（Phase D）。

## 3. 数据模型

### 3.1 API 响应类型

```typescript
// 门类/专业类列表项（mlCategory 和 xkCategory 共用）
interface CategoryItem {
  key: string    // 如 "105001"（哲学）
  name: string   // 如 "哲学"
}

// 专业列表项（specialityesByCategory 返回）
interface MajorListItem {
  zydm: string       // 专业代码，如 "010101"
  zymc: string       // 专业名称，如 "哲学"
  specId: string     // 详情 API 用的 ID，如 "73381059"
  zymyd: string      // 专业满意度评分，如 "4.2"
  hasZyjs: boolean   // 是否有专业介绍
}

// 专业详情（specialityDetail 返回，仅列需要的字段）
interface MajorDetailResponse {
  zydm: string           // 专业代码
  zymc: string           // 专业名称
  ml: string             // 门类名称
  mlCode: string         // 门类代码
  xk: string             // 学科类名称
  xkCode: string         // 学科类代码
  xlcc: string           // 学历层次，如 "本科（普通教育）"
  specId: string
  xsgm: string           // 学生规模，如 "3000-3500"
  boyPercent: number     // 男生占比
  girlPercent: number    // 女生占比
  zyjs: {
    desc: string         // 专业介绍（含培养目标内容）
    zymx: string | null  // 专业明星（可选）
  }
  jyfxInfo: {
    jyfxList: Array<{
      jyfx: string       // 就业方向，如 "公务员(省级机关)"
      url4Xzpt: string   // 相关职业链接（可选）
    }>
  }
  zymyd: Array<{
    type: string         // 类型：0/1/2/3
    typeDesc: string     // 类型描述：办学条件/教学质量/就业/综合
    rank: number         // 评分
    count: number        // 评价人数
  }>
  kyfx: Array<{          // 考研方向
    zydm: string
    zymc: string
  }>
  zytjzsList: Array<{    // 推荐招生院校（取前 10）
    schId: string
    yxmc: string         // 院校名称
    count: number        // 开设数量
    rank: number         // 评分
  }>
  simileZyList: Array<{  // 相似专业
    zydm: string
    zymc: string
    specId: string
  }>
  year: string           // 数据年份
}
```

### 3.2 输出记录类型

```typescript
interface DetailedMajorRecord {
  // 基础目录字段
  majorCode: string       // 专业代码 "010101"
  majorName: string       // 专业名称 "哲学"
  category: string        // 门类 "哲学"
  subCategory: string     // 专业类 "哲学类"
  educationLevel: string  // 学历层次 "本科（普通教育）" / "高职（专科）"

  // 详细字段（用户需求的 4 组）
  introduction: string        // 专业介绍+培养目标（zyjs.desc）
  careerDirections: string[]  // 就业方向（jyfxList.jyfx）
  mainCourses: string         // 主干课程（从 desc 中提取，或为空）
  durationAndDegree: {        // 学制学位+统计信息
    studentScale: string      // 学生规模 "3000-3500"
    boyPercent: number
    girlPercent: number
    year: string              // 数据年份
  }

  // 扩展字段（API 返回的额外有价值数据）
  satisfaction: Array<{       // 专业满意度
    type: string
    typeDesc: string
    rank: number
    count: number
  }>
  graduateMajors: Array<{     // 考研方向
    majorCode: string
    majorName: string
  }>
  recommendedColleges: Array<{  // 推荐招生院校（前 10）
    collegeName: string
    count: number
    rank: number
  }>
  similarMajors: Array<{      // 相似专业
    majorCode: string
    majorName: string
  }>

  // 可追溯性
  specId: string          // 阳光高考 specId
  _meta: {
    source: 'gaokao_chsi'
    sourceUrl: string     // 详情页 URL
    fetchedAt: string
    scraperVersion: string
    verified: boolean
  }
}
```

### 3.3 主干课程处理策略

阳光高考 API 的 `zyjs.desc` 字段包含专业介绍和培养目标，但**没有独立的主干课程字段**。部分专业的 desc 文本中会提及"主要课程"或"主干课程"，但格式不统一。

处理策略：`mainCourses` 字段保留，尝试从 desc 中用正则提取（如 `/(?:主干|主要|核心)课程[：:](.+?)(?:。|$)/`），提取不到则为空字符串。这是 best-effort，不阻塞采集流程。

## 4. 爬取组件与错误处理

### 4.1 API 封装（api.ts）

4 个函数，统一使用 HttpClient（含 QPS 限速 + 重试）：

```typescript
const API_BASE = 'https://gaokao.chsi.com.cn/zyk/zybk'

// 1. 获取门类列表
async function fetchCategories(rootKey: string): Promise<CategoryItem[]>
// GET /mlCategory/{rootKey}

// 2. 获取专业类列表
async function fetchSubcategories(categoryKey: string): Promise<CategoryItem[]>
// GET /xkCategory/{categoryKey}

// 3. 获取专业列表（含 specId）
async function fetchMajors(subcategoryKey: string): Promise<MajorListItem[]>
// GET /specialityesByCategory/{subcategoryKey}

// 4. 获取专业详情
async function fetchMajorDetail(specId: string): Promise<MajorDetailResponse>
// GET /specialityDetail/{specId}
```

所有请求带 `Accept: application/json` 头。响应解析后检查 `flag === true`，否则抛错。

### 4.2 树形遍历编排器（crawler.ts）

```typescript
async function crawlCatalog(rootKey: string, educationLevel: string): Promise<DetailedMajorRecord[]> {
  const records: DetailedMajorRecord[] = []

  // Step 1: 门类
  const categories = await fetchCategories(rootKey)

  for (const cat of categories) {
    // Step 2: 专业类
    const subcats = await fetchSubcategories(cat.key)

    for (const subcat of subcats) {
      // Step 3: 专业列表
      const majors = await fetchMajors(subcat.key)

      // Step 4: 专业详情（逐个，受 QPS 限速）
      for (const major of majors) {
        const detail = await fetchMajorDetail(major.specId)
        const record = parseDetail(detail, cat.name, subcat.name, educationLevel)
        if (validateRecord(record)) {
          records.push(record)
        }
      }
    }
  }

  return records
}
```

主入口顺序采集两个目录：
```typescript
const undergraduate = await crawlCatalog('1050', '本科（普通教育）')  // 883
const vocational = await crawlCatalog('1060', '高职（专科）')        // 748
const all = [...undergraduate, ...vocational]  // 1631
```

### 4.3 错误处理策略

| 场景 | 处理 |
|------|------|
| API 返回 `flag: false` | 抛错，记录到错误日志，跳过当前项继续 |
| 网络超时/5xx | HttpClient 自动重试 3 次（已有基础设施） |
| 详情 API 404 | 记录 specId 到 `failed-majors.json`，继续采集 |
| 字段缺失（如 zyjs 为 null） | 对应字段设为空值（`""` / `[]`），不阻塞 |
| QPS 超限 | HttpClient 内置 500ms 间隔限速 |

### 4.4 断点续采

采集过程中每 100 条写入临时文件 `detailed-catalog.partial.json`。若中途中断，重启时检测 partial 文件，跳过已采集的 specId。

### 4.5 进度日志

```
[本科] 哲学/哲学类: 4/4 专业 ✓
[本科] 经济学/经济学类: 12/12 专业 ✓
...
[本科] 进度: 883/883 (100%)
[专科] 农林牧渔/农业类: 24/24 专业 ✓
...
[专科] 进度: 748/748 (100%)
总计: 1631 条记录，写入 detailed-catalog.json
```

## 5. 校验、测试与输出

### 5.1 记录校验（validate.ts）

```typescript
function validateRecord(record: DetailedMajorRecord): boolean {
  // 必填字段
  if (!record.majorCode || !/^\d{6}$/.test(record.majorCode)) return false
  if (!record.majorName) return false
  if (!record.category) return false
  if (!record.subCategory) return false
  if (!record.educationLevel) return false

  // specId 必须存在（用于追溯）
  if (!record.specId) return false

  // 百分比合法性
  if (record.durationAndDegree.boyPercent < 0 || record.durationAndDegree.boyPercent > 100) return false
  if (record.durationAndDegree.girlPercent < 0 || record.durationAndDegree.girlPercent > 100) return false

  return true
}
```

### 5.2 测试策略（Vitest TDD）

| 测试文件 | 覆盖内容 |
|---------|---------|
| `api.test.ts` | 4 个 API 函数的 mock 测试（含 flag:false、网络错误、JSON 解析） |
| `parse.test.ts` | API 响应 → DetailedMajorRecord 转换（含字段缺失、空数组、null zyjs） |
| `crawler.test.ts` | 树形遍历编排（mock API，验证调用顺序、层级关系、记录数） |
| `validate.test.ts` | 校验函数（合法/非法 majorCode、空字段、百分比越界） |
| `mainCourses.test.ts` | 主干课程正则提取（含/不含课程描述的各种格式） |

测试使用固定的 mock JSON 数据（基于实际 API 响应快照），不依赖网络。

### 5.3 输出格式

`public/data/common/majors/detailed-catalog.json`：

```json
[
  {
    "majorCode": "010101",
    "majorName": "哲学",
    "category": "哲学",
    "subCategory": "哲学类",
    "educationLevel": "本科（普通教育）",
    "introduction": "本专业学生主要学习马克思主义哲学基本原理...",
    "careerDirections": ["公务员(省级机关)", "公务员(地市级机关)", "考研", "高中教师"],
    "mainCourses": "",
    "durationAndDegree": {
      "studentScale": "3000-3500",
      "boyPercent": 38,
      "girlPercent": 62,
      "year": "2025"
    },
    "satisfaction": [
      {"type": "3", "typeDesc": "综合满意度", "rank": 4.2, "count": 3479},
      {"type": "0", "typeDesc": "办学条件满意度", "rank": 4.1, "count": 3716}
    ],
    "graduateMajors": [
      {"majorCode": "010100", "majorName": "哲学"},
      {"majorCode": "010101", "majorName": "马克思主义哲学"}
    ],
    "recommendedColleges": [
      {"collegeName": "黑龙江大学", "count": 828, "rank": 4.6}
    ],
    "similarMajors": [
      {"majorCode": "010102", "majorName": "逻辑学"}
    ],
    "specId": "73381059",
    "_meta": {
      "source": "gaokao_chsi",
      "sourceUrl": "https://gaokao.chsi.com.cn/zyk/zybk/detail/73381059",
      "fetchedAt": "2026-06-18T10:00:00.000Z",
      "scraperVersion": "1.0.0",
      "verified": true
    }
  }
]
```

### 5.4 预期数据量

- 本科：883 条
- 专科：748 条
- 总计：1631 条
- 文件大小估算：~8-12 MB（每条记录约 5-8 KB）

## 6. API 端点参考

已验证可用的 API 端点（2026-06-18 测试通过）：

| 端点 | 用途 | 示例 |
|------|------|------|
| `GET /zyk/zybk/mlCategory/1050` | 本科门类列表 | 返回 13 个门类（含交叉学科） |
| `GET /zyk/zybk/mlCategory/1060` | 专科专业大类列表 | 返回 19 个大类 |
| `GET /zyk/zybk/xkCategory/{catKey}` | 专业类列表 | 如 `105001` → 哲学类 |
| `GET /zyk/zybk/specialityesByCategory/{subcatKey}` | 专业列表 | 如 `10500101` → 哲学/逻辑学等 |
| `GET /zyk/zybk/specialityDetail/{specId}` | 专业详情 | 如 `73381059` → 哲学详情 |

所有端点返回 JSON，结构为 `{ "msg": ..., "flag": true }`。无需 Cookie/认证，仅需 `Accept: application/json` 头。
