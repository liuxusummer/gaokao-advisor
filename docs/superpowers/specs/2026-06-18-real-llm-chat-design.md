# 真实 LLM 接入 AI 助手设计

## 背景

当前 AI 助手（`src/pages/Chat.tsx`）是纯 mock 实现：`setTimeout(800ms)` + `mockChatReply()` 关键词匹配返回固定文案。Settings 页面的 `baseUrl / apiKey / model` 三个字段仅存在于组件局部 `useState`，"保存配置"按钮只弹 toast，既未写入 store 也未持久化，刷新即丢失。Chat.tsx 也完全不读取这些配置。

本设计将 AI 助手接入真实的 LLM 服务，同时保留 mock 作为降级方案。

## 决策摘要

| 决策项 | 选择 | 理由 |
|---|---|---|
| LLM 协议 | OpenAI 兼容 `/chat/completions` | 智谱 GLM、DeepSeek、OpenAI 等主流服务均兼容 |
| 密钥存储 | localStorage 明文（通过 zustand persist） | 原型阶段最简单，与现有持久化机制一致 |
| 回复方式 | 流式打字机（SSE） | 体验好，用户不用干等 |
| 降级策略 | 未配置 API Key 时回退 mock | 保证原型可演示，不报错 |
| 架构 | 前端直连 LLM API | 零后端依赖，改动最小，部署简单 |

## 架构

```
Chat.tsx (交互层)
  ├─ 未配置 → mockChatReply (兜底)
  └─ 已配置 → streamChat (src/services/chat.ts)
                ├─ 构造 system prompt（含 profile + volunteerList 上下文）
                ├─ fetch POST {baseUrl}/chat/completions (stream: true)
                ├─ ReadableStream + TextDecoder 逐行解析 SSE
                └─ onChunk 回调 → updateLastAssistantMessage (store)

Store (zustand + persist)
  ├─ aiConfig: { baseUrl, apiKey, model }  [新增]
  ├─ setAiConfig: (config) => void  [新增]
  └─ updateLastAssistantMessage: (content) => void  [新增]

Settings.tsx
  └─ 三个 Input 读写 aiConfig（实时同步，移除 mock toast）
```

## 详细设计

### 1. 数据层（store + 配置持久化）

**新增 store 字段：**

```typescript
interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface AppState {
  // 现有字段...
  aiConfig: AiConfig
  setAiConfig: (config: Partial<AiConfig>) => void
  updateLastAssistantMessage: (content: string) => void
}
```

- `aiConfig` 纳入 zustand `persist`，自动存 localStorage
- 默认值：`{ baseUrl: '', apiKey: '', model: '' }`
- `updateLastAssistantMessage`：更新 `chatMessages` 数组中最后一条 `role === 'assistant'` 消息的 content，用于流式更新
- `ChatMessage` 接口不变：`role: 'user' | 'assistant' | 'system'` 已兼容 OpenAI 协议

### 2. LLM Service 层（`src/services/chat.ts`）

**核心函数：**

```typescript
interface ChatParams {
  messages: ChatMessage[]
  aiConfig: AiConfig
  profile?: UserProfile
  volunteerList?: VolunteerItem[]
  onChunk: (text: string) => void
  signal?: AbortSignal
}

export async function streamChat(params: ChatParams): Promise<string>
```

**实现要点：**

1. **System Prompt 构造**：根据 `profile`（省份/分数/位次/选科/偏好）和 `volunteerList` 生成系统提示，让 AI 扮演"智填志愿助手"
2. **请求构造**：
   ```typescript
   fetch(`${baseUrl}/chat/completions`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${apiKey}`,
     },
     body: JSON.stringify({
       model,
       messages: [{ role: 'system', content: systemPrompt }, ...history],
       stream: true,
     }),
     signal,
   })
   ```
3. **流式解析**：`response.body.getReader()` + `TextDecoder` 逐行读取，按 `data: ` 前缀解析 SSE，提取 `choices[0].delta.content`，每段调用 `onChunk`
4. **返回值**：完整拼接的文本

**System Prompt 模板：**

```text
你是"智填志愿"AI 助手，专门帮助中国高考考生填报志愿。你的职责：
1. 根据考生的分数、位次、选科、省份，提供志愿填报建议
2. 解答专业选择、院校选择、填报规则等问题
3. 分析冲稳保策略和滑档/退档风险

当前考生信息：
- 省份：{profile.provinceName}
- 高考分数：{profile.score}
- 全省位次：{profile.rank}
- 选考科目：{profile.subjects.join('+')}
- 偏好层次：{profile.preferredLevels.join('/')}
- 偏好专业方向：{profile.preferredMajors.join('、') || '未指定'}

当前志愿表（如有）：
{volunteerList.map(v => `${v.college.name} · ${v.major.name}（${v.tier}）`).join('\n')}

回答要求：
- 基于中国高考实际政策，区分新高考/老高考省份
- 给出具体建议时参考考生位次，不要空泛
- 如果信息不足，主动追问
- 简洁明了，避免冗长
- 最后附上"以上信息仅供参考，请以官方发布为准"
```

**上下文裁剪：**
- 取 store 中最近 20 条 `chatMessages`（避免超出 token 限制）
- 过滤掉 welcome 消息和空内容
- 只传 `role` + `content`，不传 `id` / `timestamp`

### 3. Chat.tsx 交互层

**`handleSend` 改造逻辑：**

```typescript
const handleSend = async (text: string) => {
  if (!text.trim()) return
  addChatMessage({ role: 'user', content: text })
  setInput('')
  setLoading(true)

  // 未配置 → mock 兜底
  if (!aiConfig.apiKey || !aiConfig.baseUrl) {
    await new Promise((r) => setTimeout(r, 800))
    addChatMessage({ role: 'assistant', content: mockChatReply(text) + '\n\n以上信息仅供参考，请以官方发布为准。' })
    setLoading(false)
    return
  }

  // 真实 LLM 流式
  try {
    let accumulated = ''
    const onChunk = (chunk: string) => {
      accumulated += chunk
      updateLastAssistantMessage(accumulated)
    }
    // 先创建空的 assistant 消息占位
    addChatMessage({ role: 'assistant', content: '' })
    await streamChat({
      messages: useAppStore.getState().chatMessages,
      aiConfig,
      profile,
      volunteerList,
      onChunk,
      signal: abortRef.current?.signal,
    })
    // 追加免责声明
    updateLastAssistantMessage(accumulated + '\n\n以上信息仅供参考，请以官方发布为准。')
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // 取消不当作错误，保留已收到内容
    } else {
      addChatMessage({ role: 'assistant', content: `请求失败：${err instanceof Error ? err.message : '未知错误'}。请检查设置中的 AI 配置。` })
    }
  } finally {
    setLoading(false)
  }
}
```

**UI 改动：**
- loading 状态下显示"AI 正在输入..."的三点动画（已有）
- 新增"停止生成"按钮：loading 时显示，点击调用 `AbortController.abort()`
- 未配置时在输入框上方显示提示条："未配置 AI 服务，当前为模拟回复。前往设置 →"
- 流式过程中消息内容实时变化，自动滚动到底部
- loading 期间禁用输入框和发送按钮，防止重复请求

### 4. Settings.tsx 改动

- 三个 `useState` 改为读写 `aiConfig`（实时同步到 store）
- 移除"保存配置"按钮的 mock toast，改为"已保存"提示或直接移除按钮（因为实时同步）
- 可选：加一个"测试连接"按钮，发一条简单消息验证配置是否有效

### 5. 错误处理与边界情况

| 错误场景 | 检测方式 | 用户提示 |
|---|---|---|
| 未配置 API Key | `!aiConfig.apiKey` | 回退 mock，顶部提示条引导去设置 |
| Base URL 格式错误 | `fetch` 抛 `TypeError` | "Base URL 无效，请检查设置" |
| API Key 无效 | HTTP 401/403 | "API Key 无效或已过期，请检查设置" |
| 模型名错误 | HTTP 404 或 `error.type: model_not_found` | "模型不存在，请检查模型名称" |
| 速率限制 | HTTP 429 | "请求过于频繁，请稍后再试" |
| 网络超时 | `AbortSignal.timeout(30000)` | "请求超时，请检查网络或稍后重试" |
| 流中断 | reader 抛错或返回 done 过早 | 保留已收到的部分，追加"[回复中断]" |
| CORS 拦截 | `fetch` 抛 `TypeError: Failed to fetch` | "无法连接服务，可能是 CORS 限制，请检查 Base URL 或联系服务提供商" |

**流式错误处理细节：**
- HTTP 状态码非 2xx 时，尝试读取 body 中的 `error.message`
- 流式读取中遇到 `[DONE]` 标记正常结束
- 遇到 JSON 解析失败的单行跳过（SSE 可能有心跳行）

**取消机制：**
- Chat.tsx 维护 `abortRef = useRef<AbortController>()`
- 发送时创建新 controller，传入 `streamChat`
- "停止生成"按钮调用 `abortRef.current?.abort()`
- abort 后 catch 中判断 `err.name === 'AbortError'`，不当作错误处理，保留已收到内容

**边界情况：**
- 空回复：流式结束后 `accumulated` 为空 → 追加"未收到有效回复，请重试"
- 超长回复：不主动截断，依赖 LLM 自身的 `max_tokens`
- 并发发送：loading 期间禁用输入框和发送按钮

## 测试策略

项目使用 vitest，测试分两层：

### Service 层单元测试（`src/services/chat.test.ts`）

- `streamChat` 正常流式：mock `fetch` 返回 ReadableStream，验证 `onChunk` 被多次调用且最终拼接正确
- HTTP 401 错误：mock `fetch` 返回 401，验证抛出"API Key 无效"错误
- 网络错误：mock `fetch` 抛 TypeError，验证错误消息
- abort 取消：传入已 abort 的 signal，验证抛出 AbortError
- 空回复：mock 返回空流，验证返回空字符串

### Chat 组件交互测试（`src/pages/Chat.test.tsx`）

- 未配置时发送消息 → 显示 mock 回复
- 已配置时发送消息 → 调用 streamChat，流式更新消息
- 点击"停止生成" → 调用 abort，保留已收到内容
- 错误时显示错误消息
- loading 期间禁用发送按钮

### 手动验证（不自动化）

- 真实 LLM API 连通性（需用户自填有效 Key）
- CORS 行为（依赖具体服务提供商）

## 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/store/index.ts` | 修改 | 新增 `aiConfig`、`setAiConfig`、`updateLastAssistantMessage` |
| `src/services/chat.ts` | 新建 | LLM 调用 + 流式解析 |
| `src/pages/Chat.tsx` | 修改 | 替换 mock 为真实调用 + 停止按钮 + 未配置提示 |
| `src/pages/Settings.tsx` | 修改 | 配置项接入 store |
| `src/services/chat.test.ts` | 新建 | Service 单元测试 |
| `src/pages/Chat.test.tsx` | 新建 | 组件交互测试 |

## 不在范围内

- 不新增后端服务
- 不安装 `openai` SDK（直接用 `fetch`）
- 不修改 `vite.config.ts`（暂不加 proxy，遇 CORS 再按需处理）
- 不修改 `ChatMessage` 接口结构
- 不修改 `mockChatReply`（保留作为降级）
