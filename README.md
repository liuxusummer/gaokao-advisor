<p align="center">
  <img src="docs/images/banner.jpg" alt="智填志愿 Banner" width="100%" />
</p>

<h1 align="center">🎓 智填志愿 — AI 高考志愿填报助手</h1>

<p align="center">
  <strong>让每一分都不浪费，让每一个家庭都不焦虑</strong>
</p>

<p align="center">
  <a href="#特性">特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#功能演示">功能演示</a> •
  <a href="#技术架构">技术架构</a> •
  <a href="#数据覆盖">数据覆盖</a> •
  <a href="#贡献指南">贡献指南</a> •
  <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61dafb?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.4-646cff?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Ant%20Design-5.29-0170fe?logo=antdesign&logoColor=white" alt="Ant Design" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-3.4-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen" alt="PRs Welcome" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-TRAE-000000?logo=trae&logoColor=white" alt="TRAE" />
  <img src="https://img.shields.io/badge/AI%20Model-GLM--5.2-4b6bfb" alt="GLM-5.2" />
  <img src="https://img.shields.io/badge/AI%20Model-Kimi--K2.7--Code-ff6a00" alt="Kimi-K2.7-Code" />
  <img src="https://img.shields.io/badge/AI%20Coded-100%25-7c3aed" alt="100% AI Coded" />
</p>

<p align="center">
  <em>🤖 本项目从需求、设计到代码全程由 <strong>TRAE + GLM-5.2 + Kimi-K2.7-Code</strong> 协作开发实现</em>
</p>

---

## 🤖 AI 全程开发

> **本项目是一次 AI 原生（AI-Native）开发实践** —— 从需求分析、技术选型、架构设计，到编码实现、测试与文档，**全程在 [TRAE](https://www.trae.ai/) 中由大模型协作完成**，人类负责把控方向与验收。

| AI 开发工具 | 角色 | 说明 |
|------------|------|------|
| 🛠️ **TRAE** | AI 原生 IDE | 全程开发环境，承载需求拆解、代码生成、调试与重构 |
| 🧠 **GLM-5.2** | 架构 & 推理主力 | 负责需求理解、技术方案设计、复杂逻辑推理与数据建模 |
| ⚡ **Kimi-K2.7-Code** | 编码 & 工程主力 | 负责代码生成、组件实现、单元测试编写与工程化落地 |

**这意味着：** 代码库中的每一个模块、每一处算法（如等效位次法、加权概率模型）、每一份文档，均由上述 AI 工具协作产出，是验证「AI 能否独立完成一个完整、可上线的真实产品」的开放样本。欢迎对照 [技术架构](#技术架构) 与源码体会 AI 的工程能力。


---

## 为什么做这个项目？

2026 年全国高考报名人数达 **1290 万**，其中县域考生占比 **57.27%**（超 700 万人）。志愿填报面临三重困境：

| 困境 | 现状 |
|------|------|
| 🔒 **信息差** | 近三成考生对填报规则一无所知，35.4% 害怕选错专业 |
| 💰 **资源差** | 付费咨询 3,000-18,999 元，仅 5% 家庭获得专业指导 |
| ⚠️ **指导差** | 市面 AI 工具政策匹配错误率高达 31.2%，服务注水严重 |

**智填志愿** 的目标：将专业级志愿规划能力以 **零成本** 方式提供给全国考生，特别是县域和农村地区的学生。

---

## 特性

<table>
<tr>
<td width="50%">

### 🎯 冲稳保智能推荐
- 基于等效位次法 + 加权概率模型
- 支持 7 种省份志愿数量配置（24-112 个）
- 多维度排序：概率 / 院校层次 / 专业兴趣 / 地域 / 学费
- 每条推荐附录取概率和数据溯源

</td>
<td width="50%">

### 🛡️ 风险预警系统
- 滑档风险：梯度检测、保底安全检查、大小年波动
- 退档风险：选科匹配、体检受限、单科要求、服从调剂
- 红/黄/绿三级预警 + 具体修复建议
- 支持导出风险报告

</td>
</tr>
<tr>
<td width="50%">

### 🧠 霍兰德 / MBTI / 学科兴趣测评
- 60 题霍兰德 RIASEC 测评 → 六维雷达图
- MBTI 人格类型匹配专业方向
- 15 题学科兴趣测评 → 推荐学科大类
- 多测评结果交叉验证与整合

</td>
<td width="50%">

### 💬 AI 对话咨询（可选）
- 支持任意 OpenAI 兼容 API（GLM / 通义 / DeepSeek 等）
- 政策规则问答 + 推荐解释 + 院校咨询
- 流式输出 + Markdown 渲染
- API Key 本地加密存储，不上传

</td>
</tr>
<tr>
<td width="50%">

### 📊 数据中心
- 院校/专业/分数线/一分一段表查询
- 支持多条件筛选与排序
- 等效位次换算工具
- 数据来源：教育部、阳光高考、各省考试院

</td>
<td width="50%">

### ⚡ 纯前端 & 离线可用
- 核心功能无需后端，零成本部署
- 数据内置 IndexedDB，断网可用
- 首屏加载 < 2 秒，推荐生成 < 3 秒
- 支持 PWA 离线缓存（计划中）

</td>
</tr>
</table>

---

## 功能演示

### 🎯 智能推荐 — 冲稳保三档梯度方案

<p align="center">
  <img src="docs/images/recommend-preview.jpg" alt="推荐界面" width="80%" />
</p>

> 输入成绩和位次，AI 自动生成冲/稳/保三档志愿方案，每条推荐附录取概率与数据来源。

### 🧠 兴趣测评 — 霍兰德六维雷达图

<p align="center">
  <img src="docs/images/assessment-preview.jpg" alt="测评界面" width="70%" />
</p>

> 60 题霍兰德测评生成 RIASEC 六维雷达图，精准匹配适合的专业方向。

### 🛡️ 风险预警 — 滑档/退档实时检测

<p align="center">
  <img src="docs/images/risk-preview.jpg" alt="风险报告" width="70%" />
</p>

> 自动检测志愿表中的滑档、退档风险，红/黄/绿三级预警 + 具体修复建议。

---

## 快速开始

### 前置要求

- **Node.js** >= 18.0
- **npm** >= 9.0（或 pnpm / yarn）

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/gaokao-advisor.git
cd gaokao-advisor

# 安装依赖
npm install
```

### 开发

```bash
# 启动开发服务器（含 LLM 代理）
npm run dev

# 打开浏览器访问
# http://localhost:5173
```

### 构建

```bash
# 类型检查 + 生产构建
npm run build

# 预览生产产物
npm run preview
```

### 测试

```bash
# 运行所有单元测试
npm run test:scrapers

# 观察模式
npm run test:scrapers:watch
```

---

## 技术架构

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 + TypeScript 5 | 类型安全，生态成熟 |
| 构建 | Vite 5 | 快速 HMR，按需构建 |
| UI | Ant Design 5 + Tailwind CSS 3 | 美观优先，原子化定制 |
| 动画 | Framer Motion 11 | 页面过渡，交互反馈 |
| 状态 | Zustand 5 + persist 中间件 | 轻量级，自动持久化 |
| 存储 | Dexie.js (IndexedDB) + localStorage | 分层存储，离线可用 |
| 图表 | ECharts 5 | 六维雷达图，趋势折线图 |
| 测试 | Vitest + React Testing Library | 单元 + 集成测试 |
| 代码质量 | ESLint + TypeScript strict | 严格类型检查 |
| 🤖 AI 开发 | TRAE + GLM-5.2 + Kimi-K2.7-Code | 全程 AI 协作开发：需求、设计、编码、测试 |

### 目录结构

```
gaokao-advisor/
├── public/data/               # 静态数据 JSON
│   ├── common/                # 院校、专业、映射表
│   ├── scores/                # 10 省录取分数线
│   ├── subjects/              # 选科要求数据
│   └── assessment/            # 测评题目
├── src/
│   ├── components/            # 全局组件
│   ├── features/              # 功能模块（Feature-based）
│   │   └── assessment/        # 霍兰德/MBTI/学科测评
│   ├── pages/                 # 页面组件
│   │   ├── Home.tsx           # 首页
│   │   ├── Profile.tsx        # 用户画像录入
│   │   ├── Recommend.tsx      # 智能推荐
│   │   ├── RiskReport.tsx     # 风险报告
│   │   ├── Chat.tsx           # AI 对话
│   │   ├── DataCenter.tsx     # 数据中心
│   │   ├── Assessment.tsx     # 兴趣测评
│   │   └── ...
│   ├── services/              # 核心服务
│   │   ├── recommender.ts     # 推荐引擎
│   │   ├── rankConverter.ts   # 位次换算
│   │   ├── rankScorer.ts      # 多维评分
│   │   ├── riskDetector.ts    # 风险检测
│   │   ├── chat.ts            # LLM 客户端
│   │   ├── dataLoader.ts      # 数据加载器
│   │   └── exporter.ts        # 志愿表导出
│   ├── store/                 # Zustand 全局状态
│   └── styles/                # 全局样式 + 主题
├── scripts/scrapers/          # 数据采集管道
│   ├── colleges/              # 院校信息爬虫
│   ├── scores/                # 投档线爬虫（10 省适配器）
│   ├── rank_tables/           # 一分一段表爬虫
│   ├── majors/                # 专业目录爬虫
│   └── subjects/              # 选科要求爬虫
├── docs/                      # 项目文档
└── package.json
```

### 核心算法流程

```
用户画像 (成绩/位次/选科/偏好)
        │
        ▼
[1] 等效位次换算 — 跨年对标历史数据
        │
        ▼
[2] 候选池筛选 — 选科/体检/学费/地域过滤
        │
        ▼
[3] 录取概率计算 — 加权平均 + 大小年修正
        │
        ▼
[4] 冲稳保划分 — 概率映射 + 省份配额
        │
        ▼
[5] 多维排序 — 6 维度加权评分（含测评结果）
        │
        ▼
[6] 推荐理由 + 数据溯源
```

---

## 数据覆盖

### 已支持省份（10 省）

<table>
<tr>
<td>🟢 浙江</td><td>🟢 山东</td><td>🟢 河北</td><td>🟢 辽宁</td><td>🟢 江苏</td>
</tr>
<tr>
<td>🟢 湖北</td><td>🟢 湖南</td><td>🟢 广东</td><td>🟢 北京</td><td>🟢 上海</td>
</tr>
</table>

### 数据来源

| 数据类型 | 来源 | 更新频率 |
|---------|------|---------|
| 院校基础信息 | 教育部、阳光高考网 | 年度 |
| 历年投档线 | 各省教育考试院 | 年度（高考季后） |
| 一分一段表 | 各省教育考试院 | 年度 |
| 专业目录 | 教育部学科分类 | 按版本更新 |
| 选科要求 | 各省招办发布 | 年度 |

### 数据采集管道

项目内置完整的数据采集管道，支持增量更新：

```bash
# 采集院校信息
npm run scrape:colleges

# 采集投档线（10 省适配器）
npm run scrape:scores

# 采集一分一段表
npm run scrape:rank_tables

# 一键采集全部
npm run scrape:all
```

---

## 路线图

- [x] 核心推荐引擎（冲稳保）
- [x] 霍兰德 / MBTI / 学科兴趣测评
- [x] 风险预警系统
- [x] AI 对话（OpenAI 兼容接口）
- [x] 数据中心 + 等效位次换算
- [x] 志愿表管理（多方案对比/导出）
- [x] 10 省数据采集管道
- [ ] PWA 离线支持
- [ ] 更多省份数据适配（目标 29 省）
- [ ] 深色模式优化
- [ ] GitHub Pages 自动部署
- [ ] E2E 测试（Playwright）

---

## 贡献指南

欢迎贡献！无论是修复 Bug、新增省份数据适配器、还是改进 UI，我们都非常期待你的参与。

### 贡献方式

1. **Fork** 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 **Pull Request**

### 开发规范

- 使用 TypeScript strict 模式，禁止 `any`
- 组件使用函数式组件 + Hooks
- 状态管理使用 Zustand
- 样式优先使用 Tailwind CSS
- Commit 遵循 [Conventional Commits](https://www.conventionalcommits.org/)
- 新增数据适配器需覆盖单元测试

### 新增省份数据适配器

如果你想为新省份贡献数据适配，请参考 `scripts/scrapers/scores/adapters/` 下已有的适配器实现。每个适配器负责解析该省考试院的数据格式。

---

## 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

## 致谢

- [Ant Design](https://ant.design/) — 优秀的 React UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS 框架
- [ECharts](https://echarts.apache.org/) — 强大的数据可视化库
- [Zustand](https://github.com/pmndrs/zustand) — 轻量级状态管理
- [Vite](https://vitejs.dev/) — 极速构建工具
- 阳光高考网、各省教育考试院 — 数据来源

---

<p align="center">
  <sub>Made with ❤️ for 1290 万高考考生</sub>
</p>
