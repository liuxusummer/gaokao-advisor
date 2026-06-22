# FR-02 等效位次换算独立页面设计

**日期**：2026-06-21
**关联 PRD**：`docs/requirements.md` FR-02（P0）
**状态**：已批准，待实现

## 1. 背景与目标

PRD FR-02 要求将考生当年位次换算为往年等效位次，用于跨年对标历史录取数据。当前 `recommender.ts` 的 `estimateRankFromScore` 仅是粗糙线性公式 `(750 - score) * 100 + 500`，未使用已采集的一分一段表数据。`/rank` 路由在 PRD 13.2 页面清单中规划但未实现。

**目标**：
1. 新建 `rankConverter.ts` 纯函数服务，基于一分一段表做精确换算
2. 新建 `/rank` 页面，展示等效分表格 + 折线图
3. 服务可被 FR-03 的 `recommender.ts` 复用

## 2. 范围

**包含**：
- `src/services/rankConverter.ts` 换算服务（纯函数）
- `src/pages/RankConverter.tsx` 页面组件
- `/rank` 路由注册
- Profile 页"位次"字段旁加"查看等效位次"链接

**不包含**：
- FR-03 recommender 改造（后续独立 spec）
- 一分一段表数据采集（已完成）
- 手动修正位次的弹窗 UI（直接用 InputNumber 内联编辑）

## 3. 数据现状

一分一段表 `rank_table_*.json` 覆盖情况：
- 浙江、江苏：2023、2024、2025（3 年）
- 上海、北京、山东、广东、河北、湖北、湖南、辽宁：仅 2024（1 年）

**决策**：只展示有数据的年份，不做插值估算，不假造数据。

数据结构（`dataLoader.ts` 已定义）：

```typescript
interface RankTableEntry {
  province: string
  year: number
  category: string        // "综合" | "物理类" | "历史类"
  score: number
  rank: number            // 该分数段位次
  count: number           // 该分数段人数
  cumulativeCount: number // 累计位次（用于换算的关键字段）
}
```

## 4. 架构

```
新增文件：
  src/services/rankConverter.ts          # 换算纯函数服务
  src/services/rankConverter.test.ts     # 服务单元测试
  src/pages/RankConverter.tsx            # /rank 页面组件
  src/pages/RankConverter.test.tsx       # 页面测试

修改文件：
  src/router/index.tsx                   # 加 /rank 路由
  src/pages/Profile.tsx                  # 位次字段旁加链接
```

**职责划分**：
- `rankConverter.ts`：纯函数，无副作用，不依赖 React。可被 recommender.ts 和 RankConverter.tsx 复用。
- `RankConverter.tsx`：UI 组件，负责加载数据、调用换算服务、渲染表格 + echarts 折线图、处理位次输入修正。

## 5. rankConverter.ts 服务设计

### 5.1 类型定义

```typescript
import type { RankTableEntry } from './dataLoader'

export interface EquivalentScore {
  year: number
  equivalentScore: number   // 等效分（用户位次在该年对应的分数）
  equivalentRank: number    // 等效位次（该年同位次，通常 = 用户输入位次）
  exactMatch: boolean       // 是否精确命中（false 表示取了相邻分数段）
}
```

### 5.2 公共 API

```typescript
/**
 * 对一组按年份分组的一分一段表做等效位次换算
 * @param userRank 用户当年位次
 * @param entriesByYear 按年份分组的一分一段表数据
 * @returns 各年等效分列表，按年份降序排列
 */
export function convertRankToEquivalentScores(
  userRank: number,
  entriesByYear: Map<number, RankTableEntry[]>
): EquivalentScore[]

/**
 * 在单年一分一段表中二分查找位次对应的分数
 * @param userRank 用户位次
 * @param entries 单年一分一段表（将按 cumulativeCount 升序排序）
 * @returns 等效分和是否精确命中
 */
export function findScoreByRank(
  userRank: number,
  entries: RankTableEntry[]
): { score: number; exactMatch: boolean }
```

### 5.3 换算算法

1. 输入校验：`userRank <= 0` 抛 `RangeError`
2. 对 `entriesByYear` 中每个年份：
   - 取该年 `RankTableEntry[]`，按 `cumulativeCount` 升序排序
   - 二分查找 `cumulativeCount >= userRank` 的最小条目
   - 若 `cumulativeCount === userRank`，`exactMatch = true`，取该条 `score`
   - 若 `cumulativeCount > userRank`，`exactMatch = false`，取该条 `score`（该分数段最低分）
   - 若 `userRank` 超过该年最大 `cumulativeCount`，取最后一条的 `score`，`exactMatch = false`
   - 若 `entries` 为空，跳过该年份
3. 结果按年份降序排列返回

### 5.4 边界情况

| 场景 | 处理 |
|------|------|
| `userRank <= 0` | 抛 `RangeError('userRank must be positive')` |
| `entriesByYear` 为空 Map | 返回空数组 `[]` |
| 某年 `entries` 为空数组 | 跳过该年份 |
| `userRank` 超过该年最大累计位次 | 取最低分，`exactMatch = false` |
| `userRank` 小于该年最小累计位次 | 取最高分，`exactMatch = false` |

## 6. RankConverter.tsx 页面设计

### 6.1 页面布局

```
┌─────────────────────────────────────────┐
│  等效位次换算                    [返回]  │
├─────────────────────────────────────────┤
│  考生信息卡片                             │
│  省份：浙江  科类：综合                    │
│  当年位次：[15000]  ←可编辑 InputNumber   │
│  当年分数：620                            │
├─────────────────────────────────────────┤
│  等效分表格                               │
│  ┌──────┬──────┬────────┬──────┐        │
│  │ 年份 │等效分│等效位次│ 命中 │        │
│  ├──────┼──────┼────────┼──────┤        │
│  │ 2025 │ 621  │ 15000  │ 精确 │        │
│  │ 2024 │ 619  │ 15000  │ 精确 │        │
│  │ 2023 │ 618  │ 15000  │ 近似 │        │
│  └──────┴──────┴────────┴──────┘        │
├─────────────────────────────────────────┤
│  等效分趋势折线图（echarts）               │
│  X 轴：年份  Y 轴：等效分                  │
│  折线 + 数据标签                          │
├─────────────────────────────────────────┤
│  数据来源：各省考试院一分一段表             │
│  近似命中表示位次落在分数段内               │
└─────────────────────────────────────────┘
```

### 6.2 交互细节

- **位次输入框**：`InputNumber`，初始值来自 `profile.rank`。用户修改后防抖 300ms 重新换算。修改同步回 `profile.rank`（通过 `updateProfile`）。
- **科类自动选择**：根据 `profile.subjectType` 映射 — `physics` → "物理类"，`history` → "历史类"，`comprehensive` → "综合"。
- **数据加载**：优先用 `store.dataCache.rankTable`（已随 `loadProvinceData` 加载）。若 `dataCache` 为空，调用 `loadRankTable(provinceName, year)` 按年加载（2023/2024/2025 依次尝试）。
- **无数据处理**：若该省无一分一段表数据，显示空状态提示"当前省份暂无一分一段表数据"。
- **echarts 折线图**：参考 `HollandResult.tsx` 的 `useRef + useEffect + echarts.init` 模式，组件卸载时 `chart.dispose()`。

### 6.3 科类映射逻辑

```typescript
function getCategory(subjectType: UserProfile['subjectType']): string {
  switch (subjectType) {
    case 'physics': return '物理类'
    case 'history': return '历史类'
    case 'comprehensive': return '综合'
  }
}
```

## 7. 数据流

```
用户进入 /rank 页面
    ↓
读取 profile.provinceId, profile.subjectType, profile.rank
    ↓
从 store.dataCache.rankTable 读取一分一段表数据
    ↓ (若 dataCache 为空)
调用 loadRankTable(provinceName, year) 加载各年数据
    ↓
按 category 过滤（physics→物理类, history→历史类, comprehensive→综合）
    ↓
按 year 分组 → Map<year, RankTableEntry[]>
    ↓
调用 convertRankToEquivalentScores(userRank, entriesByYear)
    ↓
渲染表格 + echarts 折线图
    ↓
用户修改位次输入框
    ↓
防抖 300ms → 重新换算 → 更新表格和图表
    ↓
同步 updateProfile({ rank: newValue })
```

## 8. 错误处理与边界

| 场景 | 处理 |
|------|------|
| 用户未填位次（`profile.rank` 为 null） | 输入框为空，提示"请输入当年位次" |
| 用户未填分数且无位次 | 显示提示"请先在画像页填写分数或位次" |
| 该省无一分一段表数据 | 空状态提示 + 链接回 Profile 页 |
| 某年份无数据 | 表格只显示有数据的年份，不报错 |
| 位次超出该年最大累计位次 | 返回最低分，`exactMatch=false`，表格标注"近似" |
| 位次 ≤ 0 | 输入框校验，不允许提交 |
| echarts 容器未挂载 | `useEffect` 内 `chartRef.current` 判空 |

## 9. 测试策略

### 9.1 rankConverter.test.ts（纯函数单元测试）

- **精确命中**：`cumulativeCount === userRank` → `exactMatch=true`
- **近似命中**：`cumulativeCount` 落在两个分数段之间 → 取较低分，`exactMatch=false`
- **超出最大位次**：返回最低分，`exactMatch=false`
- **小于最小位次**：返回最高分，`exactMatch=false`
- **空数据**：`entriesByYear` 为空 Map → 返回空数组
- **某年空数组**：跳过该年份
- **多年份**：正确分组换算，结果按年份降序
- **`userRank <= 0`**：抛 `RangeError`
- **未排序输入**：函数内部排序后正确换算

### 9.2 RankConverter.test.tsx（页面测试）

- **未填位次**：显示"请输入当年位次"提示
- **有数据时**：渲染表格，验证年份和分数显示
- **修改位次输入框**：表格更新
- **无数据省份**：显示空状态提示
- **echarts 渲染**：mock `echarts.init`，验证调用
- **科类映射**：验证不同 `subjectType` 的正确映射

## 10. 验收标准

- [ ] `/rank` 路由可访问，页面正常渲染
- [ ] Profile 页"位次"字段旁有"查看等效位次"链接，点击跳转 `/rank`
- [ ] 输入位次后，表格展示各年等效分，数据与一分一段表一致
- [ ] 折线图正确展示等效分趋势
- [ ] 修改位次输入框后，表格和图表实时更新
- [ ] 位次同步回 `profile.rank`
- [ ] 无数据省份显示空状态
- [ ] `rankConverter.ts` 单元测试全部通过
- [ ] 页面测试全部通过
- [ ] lint / tsc clean
