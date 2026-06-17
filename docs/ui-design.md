# 智填志愿 — AI 高考志愿填报助手 UI 设计文档

> **版本**：v1.0
> **日期**：2026-06-17
> **状态**：待评审
> **文档类型**：UI 设计文档（UID）
> **关联文档**：[requirements.md](./requirements.md) · [technical-design.md](./technical-design.md) · [ux-design.md](./ux-design.md)

---

## 目录

1. [设计目标与原则](#1-设计目标与原则)
2. [组件库策略](#2-组件库策略)
3. [设计系统](#3-设计系统)
4. [图标与插画](#4-图标与插画)
5. [组件 UI 规范](#5-组件-ui-规范)
6. [页面 UI 设计](#6-页面-ui-设计)
7. [深色模式](#7-深色模式)
8. [响应式适配](#8-响应式适配)
9. [动效与交互](#9-动效与交互)
10. [设计资产](#10-设计资产)
11. [附录](#11-附录)

---

## 1. 设计目标与原则

### 1.1 设计目标

基于 [ux-design.md](./ux-design.md) 的"温暖亲和绿"视觉方向，本 UI 设计文档进一步规范实现层面的样式参数、组件形态和页面布局，确保设计与代码 1:1 落地。

| 目标 | 说明 |
|------|------|
| **品牌一致性** | 全站色彩、字体、圆角、阴影统一，一眼可识别 |
| **开发可落地** | 每个组件都有对应代码实现方案（AntD / Tailwind） |
| **视觉 P0** | 不满足于"够用"，关键页面必须有设计感 |
| **移动优先** | 桌面端由移动端布局自然扩展，不做两套设计 |
| **深浅兼容** | 一套 Token 同时支持浅色/深色模式 |

### 1.2 UI 设计原则

| 原则 | 落地要求 |
|------|---------|
| **克制用色** | 绿色为主，红黄蓝仅用于语义，避免彩虹界面 |
| **大圆角亲和** | 卡片圆角 10-12px，按钮 8px，降低严肃感 |
| **柔和阴影** | 统一使用 `0 4px 12px rgba(0,0,0,0.06)` 层级阴影 |
| **留白呼吸** | 页面边距 ≥ 16px，卡片间距 12-16px |
| **字体清晰** | 不使用细体（font-weight < 400），保证可读性 |
| **状态可见** | 选中/悬浮/禁用/错误都有明确视觉反馈 |

---

## 2. 组件库策略

### 2.1 策略：混合使用（已确认）

**决策**：Ant Design 5 负责复杂组件，自定义 Tailwind 组件负责高频视觉元素。

| 组件类型 | 技术选型 | 理由 |
|---------|---------|------|
| **表单控件** | AntD（Input / Select / Radio / Checkbox / Slider） | 复杂交互、无障碍、校验成熟 |
| **步骤条** | AntD Steps | 向导核心组件 |
| **表格** | AntD Table | 数据中心分数线、院校列表 |
| **模态框/抽屉** | AntD Modal / Drawer | AI 对话面板、详情抽屉 |
| **日期/时间** | AntD DatePicker（如需要） | 成熟稳定 |
| **按钮** | 自定义 + AntD Button 覆盖 | 渐变主按钮、大圆角 |
| **卡片** | 自定义 Tailwind | 柔和阴影 + 大圆角 |
| **导航** | 自定义 Tailwind | 自适应顶部/底部导航 |
| **Hero 区** | 自定义 Tailwind | 品牌差异化 |
| **图标** | Ant Design Icons（自定义描色）+ 自定义 SVG | 双色线性风格 |

### 2.2 AntD 主题定制

通过 `ConfigProvider` 统一配置：

```typescript
const theme = {
  token: {
    colorPrimary: '#059669',
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    colorInfo: '#3b82f6',
    borderRadius: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Card: {
      borderRadius: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    },
    Input: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Steps: {
      controlItemWidth: 32,
      colorPrimary: '#059669',
    },
  },
};
```

---

## 3. 设计系统

### 3.1 色彩系统

#### 主色板

| Token | 浅色色值 | 深色色值 | 用途 |
|-------|---------|---------|------|
| `--color-primary` | `#059669` | `#34d399` | 主按钮、链接、强调 |
| `--color-primary-light` | `#34d399` | `#6ee7b7` | 渐变、悬浮态 |
| `--color-primary-dark` | `#065f46` | `#059669` | 标题、重要文字 |
| `--color-primary-bg` | `#f0fdf4` | `#064e3b` | 卡片背景、高亮区 |

#### 语义色

| Token | 浅色色值 | 深色色值 | 用途 |
|-------|---------|---------|------|
| `--color-success` | `#16a34a` | `#4ade80` | 成功、稳档 |
| `--color-warning` | `#f59e0b` | `#fbbf24` | 警告、冲档 |
| `--color-error` | `#dc2626` | `#f87171` | 错误、高风险 |
| `--color-info` | `#3b82f6` | `#60a5fa` | 信息、保档 |

#### 梯度色（冲稳保）

| 梯度 | Token | 浅色色值 | 深色色值 |
|------|-------|---------|---------|
| 冲 | `--tier-rush` | `#ef4444` | `#f87171` |
| 稳 | `--tier-stable` | `#16a34a` | `#4ade80` |
| 保 | `--tier-safe` | `#3b82f6` | `#60a5fa` |

#### 中性色

| Token | 浅色色值 | 深色色值 | 用途 |
|-------|---------|---------|------|
| `--text-primary` | `#0f172a` | `#f0f9ff` | 一级标题 |
| `--text-body` | `#334155` | `#cbd5e1` | 正文 |
| `--text-secondary` | `#64748b` | `#94a3b8` | 次要说明 |
| `--text-placeholder` | `#94a3b8` | `#475569` | 占位文字 |
| `--border-color` | `#e2e8f0` | `#334155` | 边框 |
| `--bg-page` | `#f8fafc` | `#0f172a` | 页面背景 |
| `--bg-card` | `#ffffff` | `#1e293b` | 卡片背景 |
| `--bg-hover` | `#f0fdf4` | `#064e3b` | 悬浮背景 |

### 3.2 字体系统

| 层级 | Token | 字号 | 字重 | 行高 | 用途 |
|------|-------|------|------|------|------|
| Display | `--text-display` | 32px | 700 | 1.2 | 首页主标题 |
| H1 | `--text-h1` | 24px | 700 | 1.3 | 页面标题 |
| H2 | `--text-h2` | 20px | 600 | 1.4 | 区块标题 |
| H3 | `--text-h3` | 16px | 600 | 1.5 | 卡片标题 |
| Body | `--text-body` | 14px | 400 | 1.6 | 正文 |
| Caption | `--text-caption` | 12px | 400 | 1.5 | 说明文字 |
| Label | `--text-label` | 12px | 600 | 1.4 | 标签、徽标 |

**字体族**：

```css
--font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

### 3.3 间距系统

基于 4px 网格：

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-xs` | 4px | 图标与文字间距 |
| `--space-sm` | 8px | 紧凑元素间距 |
| `--space-md` | 12px | 卡片内间距 |
| `--space-lg` | 16px | 卡片间距、页面边距 |
| `--space-xl` | 24px | 区块间距 |
| `--space-2xl` | 32px | 大区块间距 |
| `--space-3xl` | 48px | 页面级间距 |

### 3.4 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 小按钮、标签 |
| `--radius-md` | 6px | 输入框、小卡片 |
| `--radius-lg` | 8px | 按钮、模态框 |
| `--radius-xl` | 10px | 卡片 |
| `--radius-2xl` | 12px | 大卡片、面板 |
| `--radius-full` | 9999px | 圆形按钮、徽标 |

### 3.5 阴影系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 卡片默认 |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` | 卡片、按钮悬浮 |
| `--shadow-lg` | `0 10px 24px rgba(0,0,0,0.1)` | 模态框、抽屉 |
| `--shadow-primary` | `0 4px 12px rgba(5,150,105,0.3)` | 主色按钮 |

---

## 4. 图标与插画

### 4.1 图标风格：双色线性（已确认）

- **基础库**：Ant Design Icons
- **描色方案**：主路径 `#059669`（深色 `#34d399`），次路径 `#34d399`（深色 `#6ee7b7`）
- **非选中态**：主路径 `#64748b`（深色 `#94a3b8`），次路径 `#94a3b8`（深色 `#475569`）
- **线宽**：2px（导航图标 2.2px）
- **尺寸**：
  - 导航图标：22px
  - 卡片图标：18-20px
  - 按钮图标：14-16px
  - 行内图标：14px

### 4.2 图标映射

| 功能 | 图标 | 说明 |
|------|------|------|
| 首页 | HomeOutlined | 选中态绿色 |
| 推荐 | AimOutlined / CompassOutlined | 选中态绿色 |
| 志愿表 | FileTextOutlined | 选中态绿色 |
| 测评 | StarOutlined | 选中态绿色 |
| 数据中心 | DatabaseOutlined | 选中态绿色 |
| AI 对话 | MessageOutlined | 选中态绿色 |
| 设置 | SettingOutlined | 灰色 |
| 风险-高 | CloseCircleOutlined / WarningFilled | 红色 |
| 风险-中 | ExclamationCircleOutlined | 黄色 |
| 风险-低 | CheckCircleOutlined | 绿色 |
| 数据溯源 | BookOutlined | 绿色 |
| 加入志愿表 | PlusOutlined | 绿色 |
| 导出 | DownloadOutlined | 绿色 |

### 4.3 插画风格

- **风格**：线性描边 + 主色点缀，简洁友好
- **用途**：空状态、错误状态、Hero 装饰、加载状态
- **尺寸**：
  - 空状态：120×120px
  - Hero 装饰：160×160px
  - 加载动画：48×48px
- **动画**：SVG path 微动画（可选）

---

## 5. 组件 UI 规范

### 5.1 按钮

#### 主按钮（Primary）

```
背景：linear-gradient(135deg, var(--color-primary), var(--color-primary-light))
文字：白色 #ffffff
圆角：var(--radius-lg) = 8px
高度：44px
内边距：0 24px
阴影：var(--shadow-primary)
悬浮：亮度提升 + 阴影加深
禁用：opacity 0.5，cursor not-allowed
```

#### 次按钮（Secondary）

```
背景：var(--bg-card)
边框：1px solid var(--color-primary)
文字：var(--color-primary)
圆角：var(--radius-lg) = 8px
高度：44px
内边距：0 24px
悬浮：背景 var(--color-primary-bg)
```

#### 文字按钮（Text）

```
背景：transparent
文字：var(--color-primary)
高度：36px
内边距：0 12px
悬浮：背景 var(--color-primary-bg)
```

#### 危险按钮

```
背景：var(--color-error)
文字：白色
仅用于删除/清除等不可逆操作
```

#### 图标按钮

```
尺寸：40×40px（移动端 44×44px）
圆角：var(--radius-lg)
背景：var(--bg-card)
边框：1px solid var(--border-color)
悬浮：var(--bg-hover)
```

### 5.2 卡片

#### 标准卡片

```
背景：var(--bg-card)
圆角：var(--radius-xl) = 10px
内边距：var(--space-md) = 12px（移动端）/ var(--space-lg) = 16px（桌面端）
阴影：var(--shadow-md)
悬浮：transform: translateY(-2px); box-shadow: var(--shadow-lg)
```

#### 推荐志愿卡片

```
布局：垂直堆叠
头部：院校名 + 专业名 + 概率徽标
信息行：标签 + 省市 + 选科
可解释区：默认展开首条，带主色左边框
来源区：浅绿背景 + 左边框
操作区：主操作按钮左对齐，次操作右对齐
```

#### 风险卡片

```
左侧色条：3px，颜色对应风险等级
高风险：红色
中风险：黄色
正常：绿色
背景：浅色模式 rgba(254, 242, 242) / 黄色 rgba(255, 251, 235)
圆角：var(--radius-md)
内边距：var(--space-sm) = 8px
```

### 5.3 输入框

```
高度：44px
圆角：var(--radius-lg) = 8px
边框：1px solid var(--border-color)
背景：var(--bg-card)
聚焦：border-color var(--color-primary); box-shadow 0 0 0 3px rgba(5,150,105,0.1)
错误：border-color var(--color-error); 下方红色提示文字
占位符：var(--text-placeholder)
```

### 5.4 标签（Tag）

#### 院校层次标签

```
985/211：背景 #f0fdf4，文字 #065f46，圆角 4px
双一流：背景 #eff6ff，文字 #1e40af，圆角 4px
省重点：背景 #fffbeb，文字 #92400e，圆角 4px
```

#### 梯度徽标

```
冲：背景 rgba(239,68,68,0.1)，文字 #dc2626
稳：背景 rgba(22,163,74,0.1)，文字 #16a34a
保：背景 rgba(59,130,246,0.1)，文字 #3b82f6
圆角：9999px
内边距：2px 8px
```

### 5.5 进度条

```
已完成段：var(--color-primary)
未完成段：var(--border-color)
高度：6px（小）/ 8px（标准）
圆角：9999px
动画：进度变化时平滑过渡
```

### 5.6 风险标记

```
高风险：红色圆点/图标 + "❌ 风险描述" 文字
中风险：黄色圆点/图标 + "⚠ 风险描述" 文字
正常：绿色对勾 + "✓ 无风险" 文字
尺寸：行内 14px 图标 + 12px 文字
悬浮：显示风险详情 tooltip
```

### 5.7 引用标注

```
上标编号：[1] [2] [3]
颜色：var(--color-primary)
字号：10px
行高：1
悬浮：显示来源 tooltip
点击：滚动到来源列表
```

### 5.8 悬浮助手 FAB

```
尺寸：56×56px
位置：右下角 16px
背景：linear-gradient(135deg, var(--color-primary), var(--color-primary-light))
图标：MessageOutlined，白色，24px
阴影：var(--shadow-primary)
悬浮：缩放 1.05 + 阴影加深
未接入 LLM 时：隐藏
```

---

## 6. 页面 UI 设计

### 6.1 首页

#### 布局

```
顶部导航（桌面）/ 顶部标题 + 底部 Tab（移动）
Hero 区
快捷功能入口 2×2 网格
信任建立区（3 个卖点）
继续上次操作（可选）
```

#### Hero 区样式

```
背景：linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)
内边距：48px 24px（桌面）/ 36px 16px（移动）
标题：32px，700，#065f46
副标题：14px，400，#64748b
CTA 按钮：主按钮 + 次按钮横向排列
装饰：右上角漂浮的 SVG 学士帽/书本插画
```

#### 快捷入口卡片

```
2×2 网格，间距 12px
卡片：白底 + 阴影 + 10px 圆角
图标：24px 双色线性图标，背景浅绿圆形容器 48px
标题：14px，600，#065f46
描述：12px，#64748b
```

### 6.2 向导页

#### 步骤条

```
使用 AntD Steps
当前步骤：主色填充圆点 + 主色标题
未进行步骤：灰色圆点 + 灰色标题
已完成步骤：主色对勾圆点
步骤数：4 步
```

#### 表单卡片

```
白底卡片，最大宽度 560px，居中
内边距：24px
标题：H2，20px，700
字段间距：16px
按钮区："上一步"（左）+ "下一步/生成推荐"（右）
```

#### Step 1 省份选择

```
省份选择器：AntD Select，searchable，高度 44px
科类选择：Radio.Group（旧高考显示）
选科：Checkbox.Group（新高考显示）
```

#### Step 2 成绩输入

```
分数输入：数字输入框，0-750
位次输入：数字输入框
自动估算提示：若根据一分一段表估算位次，显示 "已根据你的分数估算位次约 X 名"
```

#### Step 3 偏好

```
兴趣方向：标签多选或从测评导入
地域偏好：AntD Cascader 省份多选
专业偏好：门类多选
院校偏好：层次多选
风险偏好：Slider 或 Segmented（保守/均衡/激进）
底部："跳过，使用默认偏好" 文字按钮
```

#### Step 4 加载态

```
全屏/半屏居中
动画：绿色脉冲圆环 + 三个点
文案："正在为你匹配最佳志愿..."
进度提示："已完成 60%"
```

### 6.3 推荐结果页

#### 顶部区

```
页面标题："为你推荐的志愿"
副标题："基于你的分数和偏好，生成 X 个推荐"
操作：筛选按钮 + 排序下拉
```

#### 梯度标签

```
横向排列，居左
当前标签：主色填充背景 + 白色文字
非当前标签：白底 + 边框
标签文案："冲 (8)" / "稳 (15)" / "保 (12)"
```

#### 志愿卡片

```
详见 5.2 推荐志愿卡片
头部：院校名 16px 700 + 专业名 14px 600
概率徽标：右侧
信息行：12px 灰色
可解释区：浅绿背景，可展开
来源区：12px 绿色
操作："加入志愿表" 主按钮 + "详情" 文字按钮
```

#### 空状态

```
图标：空箱子插画
文案："没有找到符合条件的志愿"
操作："调整筛选" 或 "重新填写偏好"
```

### 6.4 志愿表页

#### 风险汇总条

```
顶部固定卡片
左侧：🔴 高风险 N / 🟡 中风险 N / 🟢 正常 N
右侧："查看详情" 文字按钮
背景：根据最高风险等级变色（无风险时绿色）
提交按钮：根据风险状态变色/置灰
```

#### 志愿列表项

```
左侧：序号 + 拖拽手柄
右侧：风险色条 + 志愿信息 + 操作按钮
可展开：风险详情 + 一键修复按钮
排序：长按/拖拽排序（移动端）/ 拖拽手柄（桌面端）
```

#### 底部操作区

```
固定在页面底部（移动端）/ 页面内（桌面端）
按钮：导出（次） + 提交（主）
```

### 6.5 AI 问答页

#### 桌面端布局

```
左侧 280px：历史会话列表
右侧：对话区
输入框固定在对话区底部
```

#### 移动端布局

```
全屏对话
左上角返回按钮
右上角新对话按钮
```

#### 消息气泡

```
用户：右对齐，主色渐变背景，白色文字，圆角 12px 12px 4px 12px
AI：左对齐，白底卡片，深色文字，圆角 12px 12px 12px 4px
来源：消息下方小字，绿色，可点击
```

#### 快捷提问

```
横向滚动气泡
气泡：白底 + 边框 + 主色文字
点击即发送
```

### 6.6 数据中心

#### 院校/专业查询

```
顶部搜索栏：白底卡片 + 搜索图标
筛选区：可折叠的面板
列表：卡片式或 AntD Table
详情：右侧抽屉（桌面）/ 新页面（移动）
```

#### 分数线查询

```
顶部条件选择：省份 + 年份 + 批次
表格：AntD Table，列包括院校、专业、最低分、平均分、位次
趋势图：ECharts 折线图，三年对比
```

### 6.7 兴趣测评页

#### 测评入口

```
两个大卡片：霍兰德测评 / 学科兴趣测评
每个卡片：图标 + 标题 + 描述 + "开始" 按钮
```

#### 答题界面

```
居中卡片，最大宽度 600px
题目：18px，600
选项：5 个横向排列的圆形选择
进度条：顶部
按钮：上一题 / 下一题
```

#### 结果页

```
霍兰德代码大字展示
雷达图：ECharts
推荐专业列表：卡片式
"导入推荐偏好" 主按钮
```

### 6.8 设置页

```
分组卡片：
- 个人信息
- LLM 配置（Base URL / API Key / Model / 测试连接）
- 数据管理
- 关于
每个设置项：左侧标签 + 右侧控件
卡片间距：16px
```

---

## 7. 深色模式

### 7.1 策略：跟随系统 + 手动切换（已确认）

#### 切换方式

- 默认跟随 `prefers-color-scheme`
- 设置页提供手动切换开关
- 选择持久化到 localStorage，优先级高于系统偏好

#### 技术实现

```typescript
// Tailwind 配置
darkMode: 'class'

// 根元素切换
document.documentElement.classList.toggle('dark', isDark);
```

### 7.2 深色模式关键映射

| 元素 | 浅色 | 深色 |
|------|------|------|
| 页面背景 | `#f8fafc` | `#0f172a` |
| 卡片背景 | `#ffffff` | `#1e293b` |
| 主标题 | `#0f172a` | `#f0f9ff` |
| 正文 | `#334155` | `#cbd5e1` |
| 主色 | `#059669` | `#34d399` |
| 主色浅 | `#34d399` | `#6ee7b7` |
| 边框 | `#e2e8f0` | `#334155` |
| 阴影 | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.3)` |

### 7.3 深色模式特殊处理

- **主按钮**：深色模式下保持渐变 `#059669 → #34d399`，但阴影使用 `rgba(0,0,0,0.4)`
- **风险标记**：颜色使用更亮的语义色（红 `#f87171`，黄 `#fbbf24`，绿 `#4ade80`）
- **引用标注**：使用 `#34d399`
- **图表**：ECharts 主题切换深色配色

---

## 8. 响应式适配

### 8.1 断点

```css
/* Tailwind 断点 */
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

### 8.2 页面适配矩阵

| 页面 | < 768px | ≥ 768px |
|------|---------|---------|
| 首页 | 单列，底部 Tab | Hero 居中，快捷入口 4 列，顶部导航 |
| 向导 | 全屏步骤 | 居中卡片 560px |
| 推荐结果 | 单列卡片 | 最大宽度 768px 居中 |
| 志愿表 | 单列，底部固定操作 | 最大宽度 768px 居中 |
| 数据中心 | 列表全宽，详情新页面 | 左侧列表 + 右侧详情抽屉 |
| AI 问答 | 全屏对话 | 左侧历史 + 右侧对话 |
| 设置 | 单列卡片 | 单列卡片最大宽度 720px 居中 |

### 8.3 导航响应式

```
< 768px：底部 Tab 栏（5 个：首页/推荐/志愿表/数据/AI）
≥ 768px：顶部导航栏（首页/推荐/志愿表/测评/数据/AI + 设置图标）
```

### 8.4 字体响应式

```css
/* 首页标题 */
.text-display {
  font-size: 28px; /* mobile */
}
@media (min-width: 768px) {
  .text-display {
    font-size: 32px;
  }
}
```

### 8.5 间距响应式

```css
.page-padding {
  padding: 16px; /* mobile */
}
@media (min-width: 768px) {
  .page-padding {
    padding: 24px;
  }
}
```

---

## 9. 动效与交互

### 9.1 动效原则

- 快速反馈（< 100ms）
- 自然缓动（ease-out）
- 有意义，不装饰
- 尊重 `prefers-reduced-motion`

### 9.2 动效规范表

| 场景 | 效果 | 时长 | 缓动 |
|------|------|------|------|
| 页面切换 | 淡入淡出 | 200ms | ease-out |
| 卡片悬浮 | translateY(-2px) + 阴影加深 | 150ms | ease-out |
| 按钮点击 | scale(0.97) | 100ms | ease-out |
| 标签切换 | 下划线滑动 | 200ms | ease-out |
| 列表加载 | 骨架屏 → 淡入 | 300ms | ease-out |
| 风险标记 | 左侧色条滑入 | 200ms | ease-out |
| FAB 弹出 | scale(0) → scale(1) + 阴影 | 300ms | spring |
| 推荐加载 | 绿色脉冲动画 | 持续 | — |
| 成功提示 | 对勾缩放弹出 | 300ms | spring |
| 抽屉展开 | translateX | 250ms | ease-out |

### 9.3 推荐加载动画

```
三个圆点依次缩放
颜色：主色渐变
文案："正在为你匹配最佳志愿..."
进度条：8px 主色进度条
```

### 9.4 页面过渡

```typescript
// Framer Motion 示例
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
```

### 9.5 滚动行为

- 页面切换后滚动到顶部
- 锚点跳转平滑滚动
- 无限滚动列表使用虚拟列表

---

## 10. 设计资产

### 10.1 图标资产

| 资产 | 来源 | 格式 |
|------|------|------|
| 导航图标 | Ant Design Icons | React 组件 |
| 功能图标 | Ant Design Icons + 自定义 SVG | SVG / React 组件 |
| 空状态插画 | 自定义 SVG | SVG |
| Hero 装饰 | 自定义 SVG | SVG |

### 10.2 图片资产

- 本应用原则上不使用真实院校图片，避免版权和加载问题
- 如需装饰性图片，使用 CSS 渐变和 SVG 插画

### 10.3 代码资产

| 资产 | 文件/路径 |
|------|----------|
| Tailwind 配置 | `tailwind.config.js` |
| AntD 主题 | `src/shared/theme/antd-theme.ts` |
| CSS 变量 | `src/styles/variables.css` |
| 图标组件 | `src/shared/components/icons/` |
| 通用组件 | `src/shared/components/ui/` |

### 10.4 设计交付清单

- [ ] UI 组件库 Storybook（或等效展示）
- [ ] 首页高保真原型
- [ ] 向导 4 步高保真原型
- [ ] 推荐结果页高保真原型
- [ ] 志愿表页高保真原型
- [ ] AI 问答页高保真原型
- [ ] 数据中心高保真原型
- [ ] 兴趣测评高保真原型
- [ ] 深色模式各页面截图
- [ ] 移动端各页面截图
- [ ] 动效说明文档

---

## 11. 附录

### 11.1 UI 设计决策汇总

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 组件库策略 | 混合策略 | AntD 复杂组件 + Tailwind 自定义视觉 |
| 卡片风格 | 柔和阴影 | 层级清晰、现代亲和 |
| 图标风格 | 双色线性 | 简洁且与主题契合 |
| 深色模式 | 跟随系统 + 手动 | 现代标配、夜间友好 |
| 主按钮 | 渐变绿色 + 圆角 | 品牌识别 + 行动召唤 |
| 风险标记 | 左侧色条 + 图标文字 | 色觉无障碍 + 上下文清晰 |
| 引用标注 | 上标编号 | 学术权威、溯源精确 |

### 11.2 Tailwind 常用类组合

```html
<!-- 标准卡片 -->
<div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150">

<!-- 主按钮 -->
<button class="h-11 px-6 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-semibold shadow-primary hover:shadow-lg hover:brightness-105 active:scale-[0.97] transition-all duration-100">

<!-- 次按钮 -->
<button class="h-11 px-6 rounded-lg bg-white dark:bg-slate-800 border border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">

<!-- 风险卡片 -->
<div class="bg-white dark:bg-slate-800 rounded-lg p-3 border-l-4 border-red-500 shadow-sm">

<!-- 引用标注 -->
<sup class="text-emerald-600 dark:text-emerald-400 text-xs cursor-pointer hover:underline">[1]</sup>
```

### 11.3 AntD 组件样式覆盖

```typescript
// src/shared/theme/antd-overrides.css
.ant-btn-primary {
  background: linear-gradient(135deg, #059669, #34d399);
  border: none;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
}

.ant-card {
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.ant-steps .ant-steps-item-process .ant-steps-item-icon {
  background: #059669;
  border-color: #059669;
}
```

### 11.4 参考来源

- UX 设计文档：[ux-design.md](./ux-design.md)
- 技术方案文档：[technical-design.md](./technical-design.md)
- 需求文档：[requirements.md](./requirements.md)
- Ant Design 5：https://ant.design/
- Tailwind CSS：https://tailwindcss.com/
- Ant Design Icons：https://ant.design/components/icon/
- Framer Motion：https://www.framer.com/motion/

---

> **文档评审要点**：
> 1. 组件库混合策略是否可行？
> 2. 设计 Token（色彩/字体/间距/圆角/阴影）是否完整且一致？
> 3. 各页面 UI 规范是否足够开发落地？
> 4. 深色模式映射是否正确？
> 5. 响应式适配是否覆盖所有关键页面？
