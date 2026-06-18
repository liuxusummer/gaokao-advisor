# 高校专业招生分数线采集设计（投档线方案）

**日期**：2026-06-18
**状态**：已批准
**前置**：[2026-06-17 分数线与一分一段表采集设计](./2026-06-17-scores-ranktables-collection-design.md)（分数线部分已失效，本文档替代）

## 1. 背景与目标

### 1.1 问题背景

前置设计基于阳光高考（gaokao.chsi.com.cn）采集专业招生分数线，但实际研究确认：

- 阳光高考院校详情页的"往年录取信息"是**学校自上报的公告外链**（如北大只挂了一个指向 gotopku.cn 的链接），不是结构化分数表
- 该 tab 在导航中已被 HTML 注释隐藏
- 探测了 15+ 个可能的 API 路径，全部 404
- 阳光志愿系统（/zyck/）有结构化数据，但是 Vue SPA + 需学信网登录，无公开 API

**结论**：阳光高考不可用，需要改用各省考试院公布的投档线数据。

### 1.2 目标

采集浙江省、江苏省 2023/2024/2025 三年的高校招生投档线数据，存储到本地 JSON 文件，支持溯源。

### 1.3 数据源（已确认）

| 省份 | 数据源 | 格式 | 粒度 | 覆盖 |
|------|--------|------|------|------|
| 浙江 | zjzs.net 投档线 | Excel(.xls) | **专业级**（院校+专业） | 2023/2024/2025 |
| 江苏 | jseea.cn 投档线 | 2023/2024 Excel(.xls)，2025 PDF | 院校专业组级 | 2023/2024/2025 |

## 2. 架构

### 2.1 模块结构

复用现有 `scripts/scrapers/scores/` 目录，重写为投档线采集器：

```
scripts/scrapers/scores/
├── index.ts                    # 编排入口（重写）
├── validate.ts                 # 校验器（适配投档线字段）
├── zhejiang.ts                 # 浙江投档线解析器（新建，Excel 解析）
├── jiangsu.ts                  # 江苏投档线解析器（新建，Excel+PDF 解析）
├── __tests__/
│   ├── zhejiang.test.ts
│   ├── jiangsu.test.ts
│   ├── validate.test.ts
│   └── e2e.test.ts
└── __fixtures__/
    ├── zhejiang_sample.xls
    ├── jiangsu_physics_sample.xls
    └── jiangsu_2025_pdf_sample.txt
```

**删除**：`gaokao_score.ts`（阳光高考解析器，已确认不可用）及其测试和 fixture。

### 2.2 新增依赖

- **xlsx**（SheetJS Community Edition）：解析 .xls 文件，纯 JS 无原生依赖，跨平台
- **pdf-parse**（已有）：解析江苏 2025 PDF

### 2.3 与现有代码的关系

- `types.ts` 中的 `ScoreRecord` 保留并扩展（见 §3）
- `config.ts` 新增 `ZJ_TOUDANG_URLS` 和 `JS_TOUDANG_URLS` 配置
- `shared/http.ts` 的 `fetchBinary` 复用（已用于 rank_tables）
- `shared/cache.ts` 复用（已修复中文键碰撞）
- `shared/colleges_loader.ts` 复用（用于 collegeId 关联校验）
- `shared/pdf.ts` 复用（江苏 2025 PDF 解析）

## 3. 数据 Schema

### 3.1 ScoreRecord 扩展

```typescript
export interface ScoreRecord {
  collegeId: string          // 教育部代码，通过院校名匹配 colleges.json
  collegeName: string        // 院校名称
  year: number
  majorName: string          // 浙江: 实际专业名；江苏: 专业组名
  majorCode?: string         // 浙江: 专业代号；江苏: undefined
  majorGroup?: string        // 江苏: 专业组代码（如 "03"）；浙江: undefined
  majorGroupName?: string    // 江苏: "南京大学03专业组(不限)" 完整名；浙江: undefined
  province: string           // "浙江" / "江苏"
  category: string           // 浙江: "综合"；江苏: "物理类"/"历史类"
  batch: string              // 浙江: "普通类第一段"；江苏: "本科批"
  minScore: number           // 最低投档分
  minRank: number            // 浙江: 实际位次；江苏: 0（投档线无位次）
  avgScore?: number          // 投档线无此字段 → undefined
  maxScore?: number          // 投档线无此字段 → undefined
  planCount?: number         // 浙江: 计划数；江苏: undefined
  actualCount?: number       // 投档线无此字段 → undefined
  tieBreakers?: TieBreakers  // 江苏同分排序项；浙江: undefined
  _meta: ScoreRecordMeta
}

// 新增：江苏同分排序项
export interface TieBreakers {
  chineseMathSum?: number       // (一) 语数成绩之和
  chineseMathMax?: number       // (二) 语数最高成绩
  foreignLanguage?: number      // (三) 外语成绩
  preferredSubject?: number     // (四) 首选科目成绩（物理/历史）
  reselectSubjectMax?: number   // (五) 再选科目最高成绩
  volunteerOrder?: number       // (六) 志愿号
}
```

### 3.2 ScoreRecordMeta 扩展

```typescript
export interface ScoreRecordMeta {
  source: 'gaokao' | 'zjzs' | 'jseea'  // 新增 zjzs, jseea
  sourceUrl: string
  fetchedAt: string
  scraperVersion: string
  verified: boolean  // collegeId 关联 colleges.json 成功为 true
}
```

### 3.3 数据粒度差异处理

| 字段 | 浙江（专业级） | 江苏（专业组级） |
|------|---------------|-----------------|
| `majorName` | 实际专业名（如"工科试验班(信息)"） | 专业组名（如"南京大学03专业组(不限)"） |
| `majorCode` | 专业代号（如"015"） | undefined |
| `majorGroup` | undefined | 专业组代码（如"03"） |
| `majorGroupName` | undefined | "南京大学03专业组(不限)" 完整名 |
| `minRank` | 实际位次 | 0（投档线无位次） |
| `planCount` | 计划数 | undefined |
| `tieBreakers` | undefined | 6 项同分排序数据 |
| `category` | "综合" | "物理类"/"历史类" |
| `batch` | "普通类第一段" | "本科批" |

### 3.4 输出文件格式

按 province/year 分组，与现有结构兼容：

```
public/data/scores/
├── 浙江/
│   ├── scores_2023.json   # ScoreRecord[]
│   ├── scores_2024.json
│   └── scores_2025.json
├── 江苏/
│   ├── scores_2023.json
│   ├── scores_2024.json
│   └── scores_2025.json
└── scores.meta.json
```

每个 `scores_<year>.json` 是 `ScoreRecord[]` 数组（非嵌套）。

## 4. 采集流程

### 4.1 总体流程（5 步）

```
Step 1: 加载 colleges.json 白名单
  → Map<collegeName, CollegeRecord>（按院校名匹配）

Step 2: 下载投档线文件（Excel/PDF）
  → 浙江 3 个 .xls + 江苏 6 个文件（5 xls + 1 pdf）
  → 使用 fetchBinary + Cache（raw/scores/）

Step 3: 解析为 ScoreRecord[]
  → 浙江: xlsx 库解析 .xls → parseZjToudang()
  → 江苏 2023/2024: xlsx 库解析 .xls → parseJsToudang()
  → 江苏 2025: pdf-parse 提取文本 → parseJsToudangPdf()

Step 4: 关联白名单校验
  → 按院校名匹配 colleges.json
  → 匹配成功: collegeId 填充, verified=true
  → 匹配失败: collegeId="", verified=false, 记入 warnings

Step 5: 校验 + 产出
  → validateScoreRecord() 过滤无效记录
  → 按 province/year 分组写入 scores_<year>.json
  → 生成 scores.meta.json + 报告
```

### 4.2 院校名匹配策略

投档线文件中的院校名需要匹配到 colleges.json 中的 `name` 字段。三级策略：

1. **精确匹配**：`college.name === toudangName` → 直接命中
2. **去除后缀匹配**：处理"浙江大学(中外合作办学)"等括号后缀 → 取括号前部分再精确匹配
3. **包含匹配**：`college.name.includes(toudangName) || toudangName.includes(college.name)` → 命中（日志记录，可能有歧义）
4. **未匹配**：`verified=false`，记入 `warnings.json`，但仍保留记录（collegeId 为空）

匹配函数 `matchCollege(name, collegesMap)` 返回 `{ collegeId, verified, matchType }`。

### 4.3 浙江解析流程（parseZjToudang）

**输入**：.xls 文件 Buffer + year + sourceUrl
**解析步骤**：
1. `xlsx.read(buffer, { type: 'buffer' })` 读取工作簿
2. 取第一个工作表 `workbook.Sheets[workbook.SheetNames[0]]`
3. `xlsx.utils.sheet_to_json(sheet, { header: 1 })` 转为二维数组
4. 跳过标题行（通过"学校代号"关键词定位表头）
5. 逐行解析，字段映射：
   - 学校代号 → 不存（colleges.json 用教育部代码）
   - 学校名称 → `collegeName`
   - 专业代号 → `majorCode`
   - 专业名称 → `majorName`
   - 计划数 → `planCount`
   - 分数线 → `minScore`
   - 位次 → `minRank`
6. 固定字段：`province="浙江"`, `category="综合"`, `batch="普通类第一段"`
7. 每条记录填充 `_meta`（source="zjzs", sourceUrl=pageUrl）

**预期产出**：每年约 2.3 万条记录

### 4.4 江苏解析流程（parseJsToudang for Excel）

**输入**：.xls 文件 Buffer + year + category + sourceUrl
**解析步骤**：
1. xlsx 读取工作簿
2. 跳过前 5 行标题/表头，数据从第 6 行开始
3. 逐行解析 9 列：
   - 列 1（院校代号）→ 不存
   - 列 2（"南京大学03专业组(不限)"）→ 正则拆分：
     - `^(.+?)(\d{2}专业组)\((.+?)\)$` → 院校名 + 专业组代码 + 再选科目
     - `majorGroup` = "03"，`majorGroupName` = "南京大学03专业组(不限)"
     - `majorName` = "南京大学03专业组(不限)"（专业组级无专业名）
   - 列 3（投档最低分）→ `minScore`
   - 列 4-9（同分排序项）→ `tieBreakers`
4. 固定字段：`province="江苏"`, `batch="本科批"`, `minRank=0`
5. 跳过末尾注释行（"注：..."）
6. 每条记录填充 `_meta`（source="jseea", sourceUrl=pageUrl）

**预期产出**：每年物理类约 1500 条 + 历史类约 1200 条

### 4.5 江苏解析流程（parseJsToudangPdf for 2025）

**输入**：PDF 文件 Buffer + year + category + sourceUrl
**解析步骤**：
1. `parsePdf(buffer)` 提取文本（复用 shared/pdf.ts）
2. 按行分割，过滤水印字符（"江/苏/省/教/育/考/试/院"散落字符）
3. 每行预期格式：`院校代号 院校专业组(再选科目) 投档分 (一) (二) (三) (四) (五) (六)`
4. 正则匹配：`^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$`
5. 后续与 Excel 解析一致

**风险**：PDF 表格提取可能不完美，需 `verified=false` 标记，记入 warnings 供人工抽查

### 4.6 限速与缓存

- 下载投档线文件无 QPS 限制（总共 9 个文件，一次性下载）
- 使用 `fetchBinary` + `Cache`（cacheKey 如 `zj_toudang_2025.xls`、`js_toudang_2025_物理类.xls`）
- `--force` 参数强制刷新缓存

### 4.7 CLI 接口

```bash
# 采集所有投档线
npm run scrape:scores

# 强制刷新缓存
npm run scrape:scores -- --force

# 仅采集某省份
npm run scrape:scores -- --province=浙江
```

## 5. 校验、错误处理与测试

### 5.1 校验规则（validateScoreRecord）

| 规则 | 检查内容 | 失败行为 |
|------|---------|---------|
| 必填字段 | `collegeName`, `year`, `majorName`, `province`, `category`, `batch`, `minScore` 非空 | reject |
| minScore 范围 | `0 <= minScore <= 750` | reject |
| minRank 范围 | `minRank >= 0`（0 表示无位次，允许） | reject |
| year 合理性 | `year >= 2020 && year <= 2025` | reject |
| province 白名单 | `province ∈ ['浙江', '江苏']` | reject |
| category 合法 | 浙江: `'综合'`；江苏: `∈ ['物理类', '历史类']` | reject |
| tieBreakers 可选 | 若存在，各字段 `>= 0` | reject |
| verified 不校验 | `_meta.verified` 是溯源标记，不影响数据有效性 | — |

**与现有 validate.ts 的差异**：
- 移除 `minRank` 必须为正整数的限制（江苏投档线无位次，允许 0）
- 新增 `tieBreakers` 字段校验
- `verified` 不再作为校验失败条件（与 rank_tables 一致）

### 5.2 错误处理与报告

**三类报告文件**（写入 `public/data/scores/reports/`）：

1. **`failed.json`**：下载/解析失败
   ```typescript
   [{ province: '浙江', year: 2025, url: '...', error: 'Excel 解析失败: ...', timestamp: '...' }]
   ```

2. **`warnings.json`**：院校名未匹配白名单
   ```typescript
   [{ collegeName: '某独立学院', year: 2025, province: '浙江', matchType: 'none', detail: '未在 colleges.json 中找到匹配院校' }]
   ```

3. **`rejected.json`**：校验失败的记录（仅当非空时生成）

**控制台报告**：
```
[投档线采集报告] ============================================
版本: 1.0.0 | 耗时: 0m 45s | 时间: 2026-06-18T...
------------------------------------------------------
浙江 2023: 23156 条 (匹配 1850/1902, verified=true 1850)
浙江 2024: 22890 条 (匹配 1862/1880, verified=true 1862)
浙江 2025: 23012 条 (匹配 1855/1895, verified=true 1855)
江苏 2023 物理类: 1523 条 (匹配 1180/1523, verified=true 1180)
江苏 2023 历史类: 1201 条 (匹配 980/1201, verified=true 980)
...
------------------------------------------------------
总计产出:   95000 条
未匹配:     850 条 (warnings.json)
失败:       0 条
======================================================
```

### 5.3 已知风险与处理

| 风险 | 影响 | 处理 |
|------|------|------|
| 院校名不完全匹配 | 部分记录 `verified=false` | 三级匹配策略 + warnings 记录，人工抽查 |
| 江苏 2025 PDF 表格提取不完美 | 部分行解析失败 | `verified=false` + 记入 warnings，保留已解析记录 |
| 江苏 PDF 水印字符污染 | 数字字段混入"江/苏/院"等字符 | 正则过滤非数字字符后再 parseInt |
| 浙江 .xls 文件前几行是标题 | 直接解析会出错 | 通过"学校代号"关键词定位数据起始行 |
| 院校代号 vs 教育部代码不一致 | 无法用代号匹配 | 改用院校名匹配 colleges.json |
| 2025 数据可能未完整发布 | 部分年份文件不存在 | 下载失败记入 failed.json，不阻塞其他年份 |

### 5.4 测试策略（TDD）

**测试框架**：Vitest（现有项目已用）

**测试文件与用例**：

1. **`__tests__/zhejiang.test.ts`**（约 8 用例）
   - 正常解析：完整 .xls fixture → 正确字段映射
   - 标题行跳过：前几行非数据行被正确跳过
   - 空行处理：末尾空行不产生记录
   - 字段类型：minScore/minRank 为数字
   - _meta 填充：source/sourceUrl/verified 正确
   - 多年数据：不同 year 参数正确填充
   - 异常输入：空 Buffer → 返回空数组
   - 边界分数：minScore=0 和 750 都接受

2. **`__tests__/jiangsu.test.ts`**（约 10 用例）
   - Excel 解析：完整 .xls fixture → 正确字段映射
   - 专业组名拆分：`"南京大学03专业组(不限)"` → majorGroup="03", majorGroupName 完整
   - 同分排序项：6 个 tieBreakers 字段正确填充
   - 物理类/历史类：category 参数正确传递
   - 末尾注释行跳过："注：..." 不产生记录
   - PDF 文本解析：多行文本 → 正确提取记录
   - PDF 水印过滤：含"江/苏/院"的行被清理
   - minRank=0：江苏记录 minRank 为 0
   - 异常输入：空文本 → 返回空数组
   - 复杂专业组名："(中外合作办学)"等附加说明正确处理

3. **`__tests__/validate.test.ts`**（约 8 用例，修改现有）
   - 必填字段缺失 → 失败
   - minScore 超范围 → 失败
   - minRank=0 → 成功（新增，原为失败）
   - minRank 负数 → 失败
   - year 不合理 → 失败
   - province 非白名单 → 失败
   - tieBreakers 负数 → 失败（新增）
   - verified=false → 成功（溯源标记不影响校验）

4. **`__tests__/e2e.test.ts`**（约 2 用例，重写）
   - 完整流程：parse → match → validate → output
   - 报告生成：warnings/failed 正确写入

**Fixture 文件**：
- `__fixtures__/zhejiang_sample.xls`：从真实 .xls 截取前 20 行（或构造最小 .xls）
- `__fixtures__/jiangsu_physics_sample.xls`：江苏物理类前 20 行
- `__fixtures__/jiangsu_2025_pdf_sample.txt`：PDF 提取的文本样本（含水印）

### 5.5 数据溯源

每条 `ScoreRecord` 的 `_meta` 包含：
- `source`: 'zjzs' 或 'jseea'
- `sourceUrl`: 发布页 URL（非文件直链，便于人工查看）
- `fetchedAt`: ISO 时间戳
- `scraperVersion`: '1.0.0'
- `verified`: collegeId 关联 colleges.json 成功为 true

`scores.meta.json` 记录总体信息：
```json
{
  "provinces": [
    {
      "name": "浙江",
      "years": [2023, 2024, 2025],
      "scoreRecordCount": { "2023": 23156, "2024": 22890, "2025": 23012 },
      "rankTableRecordCount": { "2023": 423, "2024": 430, "2025": 425 }
    }
  ],
  "sources": [
    { "name": "浙江省教育考试院", "url": "https://www.zjzs.net/", "coverage": "专业级投档线 2023-2025" },
    { "name": "江苏省教育考试院", "url": "https://www.jseea.cn/", "coverage": "院校专业组级投档线 2023-2025" }
  ]
}
```

## 6. 数据源 URL 配置

### 6.1 浙江投档线 URL

```typescript
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
```

### 6.2 江苏投档线 URL

```typescript
export const JS_TOUDANG_URLS: Record<number, {
  files: Record<'物理类' | '历史类', { pageUrl: string; url: string; format: 'xls' | 'pdf' }>
}> = {
  2023: {
    // 2023 物理类/历史类共用一个公告页
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
    // 2024 物理类/历史类共用一个公告页
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
    // 2025 物理类/历史类分别有独立公告页
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
```

**说明**：2023/2024 年物理类/历史类投档线在同一个公告页发布（两个附件），共用 pageUrl；2025 年改为分别独立公告页发布，各有独立 pageUrl。每条记录的 `_meta.sourceUrl` 使用其对应科类的 pageUrl，确保溯源准确。

## 7. 实施顺序

1. 类型定义与配置扩展（types.ts + config.ts）
2. 删除 gaokao_score.ts 及其测试/fixture
3. 新增 xlsx 依赖
4. 浙江解析器 + 测试（TDD）
5. 江苏解析器 + 测试（TDD）
6. 校验器适配 + 测试
7. 编排入口重写
8. 端到端测试
9. 首次采集 + 验证产出
10. 更新 scores.meta.json

## 8. 成功标准

- 所有测试通过（约 28 个用例）
- 浙江 2023/2024/2025 各产出约 2.3 万条专业级投档线记录
- 江苏 2023/2024/2025 各产出约 2700 条院校专业组级投档线记录（物理类+历史类）
- 院校名匹配率 > 90%（warnings 记录未匹配项）
- 每条记录可溯源到发布页 URL
- `scores.meta.json` 正确生成
