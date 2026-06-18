# 院校官网补齐设计

**日期**：2026-06-18
**状态**：已批准
**前置**：[2026-06-17 院校基础信息采集设计](./2026-06-17-colleges-collection-design.md)（colleges.json 已有 2919 条记录，但 officialWebsite 全部为空）

## 1. 背景与目标

### 1.1 问题背景

现有 `public/data/common/colleges.json` 包含 2919 条院校记录，但 `officialWebsite` 字段**全部为空字符串**。根因：

- `scripts/scrapers/colleges/gaokao_detail.ts` 仅实现了阳光高考列表页解析，未实现详情页抓取
- 代码注释明确写道"列表页不直接提供官网链接，officialWebsite 留空，由详情页补充"
- 但 `index.ts` 主流程从未调用详情页接口

当前状态：
- 2919 条记录，`officialWebsite` 全部为空
- 884 条有 `gaokaoUrl`（含阳光高考 schId，格式 `schoolInfo--schId-{N}.dhtml`）
- 2035 条无 `gaokaoUrl`（需先建立 schId 映射）

### 1.2 目标

补齐 colleges.json 中 2919 条院校记录的 `officialWebsite` 字段（以及 `admissionUrl` 招生网址），数据来源为阳光高考（gaokao.chsi.com.cn）。

### 1.3 数据源（已确认）

| 数据源 | URL | 用途 | 格式 |
|--------|-----|------|------|
| 阳光高考院校列表 | `https://gaokao.chsi.com.cn/sch/search--searchType-1,start-{OFFSET}.dhtml` | 建立 `schId → 院校名` 映射 | HTML（服务端渲染） |
| 阳光高考院校详情 API | `https://gaokao.chsi.com.cn/wap/sch/schinfo/{schId}` | 获取官网、招生网 | JSON |

**列表页关键事实**（探测确认）：
- 共 148 页，每页 20 条，总记录数约 2953 条
- 偏移量序列：`start-0, start-20, ..., start-2940`
- `search.do?page=N` 参数被服务器忽略，必须用 `start` 偏移量
- `search.do?schoolName=X` 搜索参数同样被忽略，不支持按名搜索
- schId 是稀疏的非连续数字（不能枚举 1..N）

**详情 API 关键事实**（探测确认）：
- 返回干净 JSON，无需 HTML 解析
- 字段：`xxwz`（官网）、`zswz`（招生网）、`dh`（电话）、`txdz`（地址）等
- 无需鉴权，直接 GET 可用
- 建议带 `Referer` 和 `User-Agent` 头

## 2. 架构

### 2.1 采集流程（5 步）

```
Step 1: 加载 colleges.json
  → 读取 2919 条记录到内存
  → 按院校名建立索引 Map<name, CollegeRecord>

Step 2: 抓取列表页建立 schId 映射
  → 遍历 148 页（start-0 到 start-2940）
  → 每页正则提取 (schId, 校名) 对
  → 缓存到 raw/colleges/schid_map.json
  → --force 时强制刷新，否则优先用缓存

Step 3: 匹配院校名
  → 对每个映射条目，按 3 级策略匹配 colleges.json
  → 匹配成功: 记录 (collegeId, schId) 关联
  → 匹配失败: 记入 unmatched_mappings.json
  → 输出: Map<schId, CollegeRecord>

Step 4: 调用详情 API 补齐官网
  → 对每个匹配成功的 schId，GET /wap/sch/schinfo/{schId}
  → 提取 xxwz、zswz
  → 更新内存中的 CollegeRecord
  → 限速 QPS=2（每 500ms 一个请求）
  → 失败重试 3 次，间隔 2 秒

Step 5: 写回 colleges.json + 报告
  → 将更新后的记录写回 public/data/common/colleges.json
  → 生成报告：匹配数、补齐数、失败数
```

### 2.2 模块结构

新建独立采集器，不修改现有 colleges 采集器：

```
scripts/scrapers/colleges/
├── website_enricher.ts          # 新建：官网补齐器
├── __tests__/
│   ├── website_enricher.test.ts # 新建
│   └── ...（现有测试不变）
└── __fixtures__/
    ├── sch_list_sample.html     # 新建：列表页样本
    ├── sch_detail_sample.json   # 新建：详情 API 样本
    └── ...（现有 fixture 不变）
```

### 2.3 与现有代码的关系

- **不修改** `colleges/index.ts`、`gaokao_detail.ts`、`merge.ts`（保持现有采集流程不变）
- **复用** `shared/http.ts`（HttpClient）、`shared/cache.ts`、`shared/logger.ts`
- **新增** `website_enricher.ts` 作为独立脚本，读取 colleges.json → 补齐 → 写回 colleges.json
- **CLI 入口**：`npm run scrape:colleges:websites`（新增 npm script）

### 2.4 限速策略

- 列表页：148 页，每页间隔 1 秒（约 2.5 分钟）
- 详情 API：约 2900 个请求，每秒 2 个（QPS=2，与现有 `GAOKAO_QPS` 一致），约 24 分钟
- 总耗时约 27 分钟

## 3. 数据 Schema

### 3.1 CollegeRecord 字段更新

只更新 3 个字段，其余字段保持不变：

```typescript
export interface CollegeRecord {
  // ... 现有字段不变
  officialWebsite: string    // 从 API 的 xxwz 填充，如 "https://www.pku.edu.cn"
  gaokaoUrl: string          // 已有 schId 的保留，无 schId 的从映射表填充
  admissionUrl?: string      // 从 API 的 zswz 填充，如 "https://bkzs.pku.edu.cn"
  // ...
  _meta: RecordMeta          // 更新 fetchedAt，source 保持 'merged'
}
```

### 3.2 列表页映射数据结构

```typescript
// 内部结构，不持久化为正式数据
interface SchIdMapping {
  schId: string       // 阳光高考内部序号，如 "1"
  collegeName: string // 列表页中的院校名，如 "北京大学"
}
```

映射表缓存到 `raw/colleges/schid_map.json`，避免重复抓取列表页：

```json
[
  { "schId": "1", "collegeName": "北京大学" },
  { "schId": "2", "collegeName": "中国人民大学" }
]
```

### 3.3 详情 API 响应结构

```typescript
interface SchDetailResponse {
  flag: boolean       // true 表示成功
  msg: {
    schid: string
    yxmc: string      // 院校名称
    yxdm: string      // 院校代码（5 位国标码）
    xxwz: string      // 学校网址（官网）⭐
    zswz: string      // 招生网址 ⭐
    dh: string        // 电话
    txdz: string      // 通讯地址
    yxszd: string     // 院校所在地
    zgbmmc: string    // 主管部门
  } | null
}
```

只提取 `xxwz` 和 `zswz`，其余字段不采集（避免范围蔓延）。

### 3.4 数据校验

补齐后的记录需通过以下校验：
- `officialWebsite` 非空时必须以 `http://` 或 `https://` 开头
- `admissionUrl` 非空时必须以 `http://` 或 `https://` 开头
- API 返回 `xxwz` 为空字符串或 `-` 时，`officialWebsite` 保持空字符串（不强制填充）
- API 返回 `flag: false` 或 `msg: null` 时，跳过该记录（记 warning）

### 3.5 溯源信息更新

每条被更新的记录，`_meta` 字段更新：
- `fetchedAt`: 更新为当前时间
- `source`: 保持 `'merged'`（不改为 'gaokao'，因为基础数据仍来自教育部名单）
- `verified`: 保持 `true`
- 不新增 `enrichedAt` 字段——`fetchedAt` 足够

## 4. 院校名匹配策略

列表页校名与 colleges.json 校名可能不完全一致，采用 3 级匹配：

1. **精确匹配**：`college.name === mapping.collegeName` → 直接命中
2. **去除括号后缀匹配**：处理"中国矿业大学（北京）"vs"中国矿业大学(北京)"（全角/半角括号差异）→ 统一去除括号部分后精确匹配
3. **包含匹配**：`college.name.includes(mapping.collegeName) || mapping.collegeName.includes(college.name)` → 命中（记日志，可能有歧义）

**特殊处理**：
- 全角括号 `（）` 统一转为半角 `()` 再匹配
- 校名中的"学院"vs"大学"不自动转换（避免误匹配，如"北京大学"vs"北京学院"）
- 同一校名匹配到多个 schId 时，取第一个（记 warning）

## 5. 采集流程详解

### 5.1 列表页解析（parseSchList）

**输入**：HTML 字符串
**输出**：`SchIdMapping[]`

```typescript
export function parseSchList(html: string): SchIdMapping[] {
  const mappings: SchIdMapping[] = []
  const regex = /<a class="name js-yxk-yxmc[^"]*"[^>]*href="\/sch\/schoolInfo--schId-(\d+)\.dhtml"[^>]*>\s*([^<]+?)\s*<\/a>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    mappings.push({
      schId: match[1],
      collegeName: match[2].trim(),
    })
  }
  return mappings
}
```

**分页遍历**：
- 总页数 148，从 HTML 分页控件动态解析（不硬编码）
- 每页间隔 1 秒（可配置）
- 单页失败重试 3 次

### 5.2 详情 API 调用（fetchSchDetail）

**输入**：schId
**输出**：`{ xxwz: string, zswz: string } | null`

```typescript
async function fetchSchDetail(http: HttpClient, schId: string): Promise<SchDetail | null> {
  const url = `https://gaokao.chsi.com.cn/wap/sch/schinfo/${schId}`
  const result = await http.fetch(url, {
    cacheKey: `sch_detail_${schId}.json`,
    headers: {
      'Referer': 'https://gaokao.chsi.com.cn/sch/',
      'User-Agent': 'Mozilla/5.0 ...',
    },
  })
  const data: SchDetailResponse = JSON.parse(result.html)
  if (!data.flag || !data.msg) return null
  return {
    xxwz: data.msg.xxwz || '',
    zswz: data.msg.zswz || '',
  }
}
```

**限速**：使用简单的令牌桶——每 500ms 发起一个请求（QPS=2）。

### 5.3 错误处理与报告

**三类报告文件**（写入 `public/data/common/reports/`）：

1. **`website_enrichment_failed.json`**：API 调用失败
   ```json
   [{ "schId": "123", "collegeName": "某某大学", "error": "HTTP 500", "retryCount": 3 }]
   ```

2. **`website_enrichment_unmatched.json`**：列表页校名未匹配到 colleges.json
   ```json
   [{ "schId": "456", "listName": "某某学院", "reason": "未在 colleges.json 中找到匹配院校" }]
   ```

3. **`website_enrichment_empty.json`**：API 返回但官网字段为空
   ```json
   [{ "schId": "789", "collegeName": "某某大学", "detail": "API 返回 xxwz 为空" }]
   ```

**控制台报告**：
```
[院校官网补齐报告] ============================================
版本: 1.0.0 | 耗时: 27m 15s | 时间: 2026-06-18T...
------------------------------------------------------
列表页映射:   2953 条
匹配成功:     2850 条 (96.5%)
匹配失败:     103 条 (unmatched.json)
------------------------------------------------------
官网补齐:     2780 条 (97.5%)
官网为空:     70 条 (empty.json)
API 失败:     0 条
------------------------------------------------------
colleges.json 更新: 2850 条记录
======================================================
```

### 5.4 缓存策略

| 缓存项 | 路径 | cacheKey | 说明 |
|--------|------|----------|------|
| 列表页 HTML | `raw/colleges/` | `sch_list_start_{offset}.html` | 148 个文件 |
| schId 映射表 | `raw/colleges/` | `schid_map.json` | 合并后的映射 |
| 详情 API 响应 | `raw/colleges/` | `sch_detail_{schId}.json` | 约 2900 个文件 |

- `--force` 参数强制刷新所有缓存
- 默认优先用缓存（支持断点续传——如果中途中断，重跑时已缓存的 API 响应不会重复请求）

### 5.5 CLI 接口

```bash
# 补齐官网
npm run scrape:colleges:websites

# 强制刷新缓存
npm run scrape:colleges:websites -- --force

# 仅抓取列表页映射（不调 API，用于调试）
npm run scrape:colleges:websites -- --list-only
```

### 5.6 已知风险与处理

| 风险 | 影响 | 处理 |
|------|------|------|
| 列表页校名与 colleges.json 不一致 | 部分映射匹配失败 | 3 级匹配策略 + unmatched 报告 |
| API 返回 xxwz 为空或 `-` | 部分院校官网仍为空 | 保留空字符串，记入 empty 报告 |
| API 被风控（高频请求） | 部分请求失败 | QPS=2 限速 + 3 次重试 |
| 列表页结构变化 | 解析失败 | 正则容错 + 失败时报告 0 条映射 |
| 中途中断 | 部分院校未处理 | 缓存支持断点续传 |
| 全角/半角括号差异 | 匹配失败 | 统一转半角后匹配 |

## 6. 测试策略

### 6.1 测试文件结构

```
scripts/scrapers/colleges/__tests__/
└── website_enricher.test.ts   # 新建
scripts/scrapers/colleges/__fixtures__/
├── sch_list_sample.html       # 新建：列表页 HTML 样本
└── sch_detail_sample.json     # 新建：详情 API 响应样本
```

### 6.2 测试用例（约 15 个）

**parseSchList（列表页解析）— 5 个用例：**
1. 正常解析：完整 HTML fixture → 提取 20 条映射
2. schId 提取：验证 schId 是数字字符串
3. 校名清理：含空白字符的校名被 trim
4. 空 HTML 返回空数组
5. 无匹配项的 HTML 返回空数组（正则不匹配）

**matchCollege（院校名匹配）— 5 个用例：**
1. 精确匹配：`"北京大学"` → 命中
2. 全角括号匹配：`"中国矿业大学（北京）"` vs `"中国矿业大学(北京)"` → 命中
3. 去括号匹配：`"浙江大学(中外合作办学)"` vs `"浙江大学"` → 命中
4. 包含匹配：`"浙大"` vs `"浙江大学"` → 命中（记日志）
5. 未匹配：`"不存在的大学"` → 返回 null

**fetchSchDetail（详情 API 解析）— 3 个用例：**
1. 正常响应：flag=true, msg.xxwz 非空 → 返回 `{ xxwz, zswz }`
2. flag=false 响应 → 返回 null
3. xxwz 为空字符串 → 返回 `{ xxwz: '', zswz: '' }`

**端到端流程 — 2 个用例：**
1. 完整流程：加载 mock colleges → 匹配映射 → 调 mock API → 更新记录 → 验证字段
2. 部分失败：部分 API 失败 → 成功的更新，失败的记入报告

### 6.3 Fixture 文件

**`sch_list_sample.html`**（列表页样本，截取 5 条）：
```html
<div class="sch-item">
  <a class="name js-yxk-yxmc text-decoration-none" target="_blank"
     href="/sch/schoolInfo--schId-1.dhtml">  北京大学  </a>
</div>
<div class="sch-item">
  <a class="name js-yxk-yxmc text-decoration-none" target="_blank"
     href="/sch/schoolInfo--schId-2.dhtml">  中国人民大学  </a>
</div>
<!-- ... 3 more ... -->
```

**`sch_detail_sample.json`**（详情 API 响应样本）：
```json
{
  "flag": true,
  "msg": {
    "schid": "1",
    "yxmc": "北京大学",
    "yxdm": "10001",
    "xxwz": "https://www.pku.edu.cn",
    "zswz": "https://bkzs.pku.edu.cn",
    "dh": "010-62751407",
    "txdz": "北京市海淀区颐和园路5号",
    "yxszd": "北京",
    "zgbmmc": "教育部"
  }
}
```

### 6.4 测试原则

- **不测试真实网络请求**：所有 HTTP 调用通过 fixture 文件模拟
- **不修改现有 colleges 测试**：website_enricher 是独立模块
- **验证字段更新**：端到端测试确认 `officialWebsite` 和 `admissionUrl` 被正确填充
- **验证溯源**：`_meta.fetchedAt` 被更新

## 7. 实施顺序

1. 创建 fixture 文件（HTML + JSON）
2. 编写测试（TDD）
3. 实现 `website_enricher.ts`（parseSchList → matchCollege → fetchSchDetail → 主流程）
4. 新增 npm script
5. 首次采集 + 验证产出
6. 更新 colleges.meta.json

## 8. 成功标准

- 所有测试通过（约 15 个用例）
- 现有 colleges 测试无回归
- 全量 scrapers 测试无回归
- 实际采集后，`officialWebsite` 非空率 > 90%
- 每条被更新的记录可溯源（`_meta.fetchedAt` 更新）
