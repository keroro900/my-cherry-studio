# VCP 扩展使用指南

> 本文档说明 VCPToolBox × Cherry Studio 融合实现的各个模块的使用方式

---

## 目录

1. [Phase 10: aiCore 上下文注入](#phase-10-aicore-上下文注入)
2. [Phase 11: ShowVCP 调试机制](#phase-11-showvcp-调试机制)
3. [Phase 12: Agent 群体协作](#phase-12-agent-群体协作)
4. [Phase 13: 精细化行为调控](#phase-13-精细化行为调控)
5. [rust-vexus-lite 集成评估](#rust-vexus-lite-集成评估)

---

## Phase 10: aiCore 上下文注入

### 概述

通过 aiCore Plugin 机制实现 VCP 上下文自动注入，让每次 AI 对话都能自动应用经验增强。

### 文件位置

- **插件**: `src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`
- **IPC 处理**: `src/main/services/VCPIpcHandler.ts`

### 使用方式

#### 1. 在 Assistant 中启用 VCP Agent

```typescript
// 在 Assistant 配置中添加 vcpAgentId
const assistant: Assistant = {
  id: 'xxx',
  name: 'My Assistant',
  vcpAgentId: 'vcp-agent-uuid',  // 关联的 VCP Agent ID
  // ... 其他配置
}
```

#### 2. 插件自动注入流程

```
用户发送消息
    ↓
vcpContextPlugin.onRequestStart()
    ├── 1. 通过 IPC 获取 VCP Agent
    ├── 2. 解析系统提示词中的日记声明
    │       ├── {{日记本}} - 全文注入
    │       ├── [[日记本]] - RAG 检索
    │       ├── <<日记本>> - 阈值全文
    │       └── 《《日记本》》 - 阈值 RAG
    ├── 3. 执行上下文注入规则
    └── 4. 合并注入内容
    ↓
vcpContextPlugin.transformParams()
    └── 将 VCP 上下文注入到 system prompt
    ↓
AI 生成响应
    ↓
vcpContextPlugin.onRequestEnd()
    └── 检测 AI 是否请求写日记
        ├── diary_write 工具调用
        ├── <<<[DIARY_WRITE]>>> 标记
        ├── 【日记写入】 中文标记
        └── [DIARY] 简单标记
```

#### 3. IPC 通道

| 通道 | 功能 |
|------|------|
| `vcp:agent:get` | 获取 VCP Agent |
| `vcp:diary:search` | 日记检索 |
| `vcp:context:execute` | 执行上下文注入规则 |
| `vcp:diary:write` | 写入日记 |

### 代码示例

```typescript
// 在 PluginBuilder.ts 中启用
import { vcpContextPlugin } from './vcpContextPlugin'

export function buildPlugins(config) {
  const plugins = []

  // 如果 Assistant 配置了 VCP Agent，启用插件
  if (config.assistant.vcpAgentId) {
    plugins.push(vcpContextPlugin(config.assistant, config.topicId || ''))
  }

  return plugins
}
```

---

## Phase 11: ShowVCP 调试机制

### 概述

实时透视 AI 与工具的交互细节，支持流式和完整回顾两种模式。

### 文件位置

- **服务**: `src/main/services/ShowVCPService.ts`
- **IPC 处理**: `src/main/services/VCPIpcHandler.ts`

### 功能特性

| 功能 | 说明 |
|------|------|
| 会话管理 | 自动跟踪每次对话的 VCP 调用 |
| 调用记录 | 记录工具调用的参数、结果、耗时 |
| 格式化输出 | 支持 compact/detailed/markdown 三种格式 |
| 历史回顾 | 保留最近 10 次会话历史 |

### IPC 通道

```typescript
// 开关控制
'showvcp:enable'      // 设置全局开关
'showvcp:isEnabled'   // 查询开关状态
'showvcp:getConfig'   // 获取配置
'showvcp:updateConfig' // 更新配置

// 会话管理
'showvcp:startSession' // 开始新会话
'showvcp:endSession'   // 结束当前会话
'showvcp:getHistory'   // 获取历史会话
'showvcp:format'       // 格式化输出
```

### 使用示例

```typescript
// 前端启用 ShowVCP
await window.electron.ipcRenderer.invoke('showvcp:enable', true)

// 开始会话
const sessionId = await window.electron.ipcRenderer.invoke(
  'showvcp:startSession',
  { agentId: 'xxx', agentName: 'My Agent' }
)

// 获取格式化输出
const output = await window.electron.ipcRenderer.invoke('showvcp:format')
console.log(output)
// 输出:
// ╔══════════════════════════════════════════════════════════════╗
// ║                     ShowVCP 调试信息                          ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ Agent: My Agent
// ║ 会话 ID: vcp-session-xxx
// ║ 调用记录 (3 次):
// ╟──────────────────────────────────────────────────────────────╢
// ║ 1. [✓] diary_read::user_preferences (45ms)
// ║ 2. [✓] context::rule_inject (12ms)
// ║ 3. [✓] injection::diary_injection
// ╚══════════════════════════════════════════════════════════════╝
```

### 配置选项

```typescript
interface ShowVCPConfig {
  enabled: boolean           // 全局开关
  showTimestamp: boolean     // 显示时间戳
  showDuration: boolean      // 显示耗时
  showArgs: boolean          // 显示参数
  showResult: boolean        // 显示结果
  maxHistorySessions: number // 历史会话数量
  formatStyle: 'compact' | 'detailed' | 'markdown'
}
```

---

## Phase 12: Agent 群体协作

### 概述

实现多 Agent 间的消息传递、任务分发、知识共享和群体决策。

### 文件位置

- **服务**: `src/main/knowledge/agent/AgentCollaborationService.ts`
- **IPC 处理**: `src/main/services/VCPIpcHandler.ts`

### 核心功能

#### 1. Agent 能力注册

```typescript
// 注册 Agent 能力
await window.electron.ipcRenderer.invoke('agent:collab:registerCapability', {
  agentId: 'fashion-expert',
  agentName: '时尚专家',
  specialties: ['服装设计', '趋势分析'],
  skills: ['色彩搭配', '版型设计', '面料选择'],
  availability: 'available',
  loadFactor: 0.3,
  successRate: 0.95
})

// 查找最适合任务的 Agent
const bestAgent = await window.electron.ipcRenderer.invoke(
  'agent:collab:findBestAgent',
  { requiredSkills: ['色彩搭配', '趋势分析'] }
)
```

#### 2. 消息传递

```typescript
// Agent 间请求协助
await window.electron.ipcRenderer.invoke('agent:collab:sendMessage', {
  type: 'request',
  fromAgentId: 'designer-agent',
  toAgentId: 'fashion-expert',
  content: '请帮我分析这个设计的流行趋势匹配度',
  priority: 'high',
  metadata: { designId: 'xxx' }
})

// 广播消息
await window.electron.ipcRenderer.invoke('agent:collab:broadcast', {
  fromAgentId: 'trend-monitor',
  content: '检测到新的流行趋势：多巴胺配色',
  metadata: { trendId: 'dopamine-colors' }
})
```

#### 3. 任务分发

```typescript
// 创建任务
const task = await window.electron.ipcRenderer.invoke('agent:collab:createTask', {
  title: '设计 2025 春季连衣裙系列',
  description: '基于最新趋势设计 5 款连衣裙',
  creatorAgentId: 'project-manager',
  priority: 'high',
  subtasks: [
    { title: '趋势调研', description: '收集 2025 春季流行元素' },
    { title: '色彩方案', description: '制定配色方案' },
    { title: '款式设计', description: '完成款式草图' }
  ]
})

// 自动分配任务
await window.electron.ipcRenderer.invoke('agent:collab:autoAssignTask', {
  taskId: task.id,
  requiredSkills: ['趋势分析', '服装设计']
})

// 更新任务状态
await window.electron.ipcRenderer.invoke('agent:collab:updateTaskStatus', {
  taskId: task.id,
  status: 'completed',
  result: { designs: [...] }
})
```

#### 4. 知识共享

```typescript
// 分享知识到公共库
await window.electron.ipcRenderer.invoke('agent:collab:shareKnowledge', {
  sourceAgentId: 'fashion-expert',
  title: '2025 春季流行色趋势',
  content: '根据 Pantone 发布...',
  category: '趋势分析',
  tags: ['2025', '春季', '色彩', 'Pantone']
})

// 搜索共享知识
const results = await window.electron.ipcRenderer.invoke(
  'agent:collab:searchKnowledge',
  { query: '流行色', category: '趋势分析', tags: ['2025'] }
)
```

#### 5. 群体投票

```typescript
// 发起投票
const session = await window.electron.ipcRenderer.invoke('agent:collab:createVoting', {
  topic: '选择主打款式',
  description: '从 3 个候选款式中选择本季主打',
  options: [
    { id: 'a', label: '款式 A', description: '简约风格' },
    { id: 'b', label: '款式 B', description: '复古风格' },
    { id: 'c', label: '款式 C', description: '运动风格' }
  ],
  initiatorAgentId: 'project-manager',
  participantAgentIds: ['designer-1', 'designer-2', 'fashion-expert'],
  deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后
})

// 提交投票
await window.electron.ipcRenderer.invoke('agent:collab:submitVote', {
  sessionId: session.id,
  agentId: 'designer-1',
  optionId: 'b'
})

// 关闭投票并获取结果
const result = await window.electron.ipcRenderer.invoke(
  'agent:collab:closeVoting',
  { sessionId: session.id }
)
// result = { winnerId: 'b', winnerLabel: '款式 B', totalVotes: 3, breakdown: {...} }
```

### IPC 通道汇总

| 通道 | 功能 |
|------|------|
| `agent:collab:registerCapability` | 注册 Agent 能力 |
| `agent:collab:getAvailableAgents` | 获取可用 Agent 列表 |
| `agent:collab:findBestAgent` | 查找最适合任务的 Agent |
| `agent:collab:sendMessage` | 发送消息 |
| `agent:collab:broadcast` | 广播消息 |
| `agent:collab:getMessages` | 获取 Agent 消息 |
| `agent:collab:createTask` | 创建任务 |
| `agent:collab:assignTask` | 分配任务 |
| `agent:collab:autoAssignTask` | 自动分配任务 |
| `agent:collab:updateTaskStatus` | 更新任务状态 |
| `agent:collab:shareKnowledge` | 分享知识 |
| `agent:collab:searchKnowledge` | 搜索知识 |
| `agent:collab:createVoting` | 创建投票 |
| `agent:collab:submitVote` | 提交投票 |
| `agent:collab:closeVoting` | 关闭投票 |

---

## Phase 13: 精细化行为调控

### 概述

提供模型适配、输出检测、口头禅抑制等行为调控功能。

### 文件位置

- **服务**: `src/main/knowledge/agent/BehaviorControlService.ts`
- **IPC 处理**: `src/main/services/VCPIpcHandler.ts`

### 功能模块

#### 1. 模型适配 (Model Adaptation)

为不同模型自动注入优化指令。

```typescript
// 内置预设规则
const PRESET_MODEL_ADAPTATIONS = [
  {
    name: 'Claude 系列',
    modelPattern: 'claude',
    instruction: '请以专业、友好的方式回答，避免过度使用 "certainly" 和 "I\'d be happy to"。',
    position: 'suffix',
    priority: 10
  },
  {
    name: 'GPT-4 系列',
    modelPattern: 'gpt-4',
    instruction: '请给出详细且结构化的回答。',
    position: 'suffix',
    priority: 10
  },
  {
    name: 'Gemini 系列',
    modelPattern: 'gemini',
    instruction: '请注意回答的准确性，避免幻觉。',
    position: 'suffix',
    priority: 10
  },
  {
    name: 'DeepSeek 系列',
    modelPattern: 'deepseek',
    instruction: '请提供专业且实用的回答，必要时展示思考过程。',
    position: 'suffix',
    priority: 10
  }
]

// 应用模型适配
const adaptedPrompt = await window.electron.ipcRenderer.invoke(
  'behavior:applyModelAdaptation',
  { systemPrompt: originalPrompt, modelId: 'claude-3-opus' }
)
```

#### 2. DetectorX (系统提示词检测)

检测并替换系统提示词中的特定模式。

```typescript
// 添加 DetectorX 规则
await window.electron.ipcRenderer.invoke('behavior:addDetectorXRule', {
  name: '移除敏感信息',
  pattern: '\\[SECRET\\].*?\\[/SECRET\\]',
  replacement: '[REDACTED]',
  flags: 'gs',
  priority: 100
})

// 应用 DetectorX
const { result, matchedRules } = await window.electron.ipcRenderer.invoke(
  'behavior:applyDetectorX',
  { text: systemPrompt }
)
```

#### 3. SuperDetectorX (AI 输出检测)

检测并修正 AI 输出中的问题。

```typescript
// 添加 SuperDetectorX 规则
await window.electron.ipcRenderer.invoke('behavior:addSuperDetectorXRule', {
  name: '阻止敏感内容',
  pattern: '(密码|API.?Key|Secret)',
  action: 'block',  // 'remove' | 'replace' | 'warn' | 'block'
  warningMessage: '检测到敏感内容，已阻止输出',
  priority: 100
})

// 应用 SuperDetectorX
const { result, matchedRules, warnings, blocked } = await window.electron.ipcRenderer.invoke(
  'behavior:applySuperDetectorX',
  { output: aiResponse }
)

if (blocked) {
  console.log('输出被阻止')
}
```

#### 4. 口头禅抑制 (Phrase Suppression)

自动移除 AI 的重复语言模式。

```typescript
// 内置预设规则
const PRESET_PHRASE_SUPPRESSIONS = [
  { phrase: '我是一个AI助手', action: 'remove', maxOccurrences: 0 },
  { phrase: '作为一个人工智能', action: 'remove', maxOccurrences: 0 },
  { phrase: 'certainly', alternatives: ['好的', '没问题'], action: 'limit', maxOccurrences: 1 },
  { phrase: "I'd be happy to", alternatives: ['我来', '让我'], action: 'limit', maxOccurrences: 1 },
  { phrase: '首先让我', action: 'limit', maxOccurrences: 1 }
]

// 应用口头禅抑制
const { result, suppressedPhrases } = await window.electron.ipcRenderer.invoke(
  'behavior:applyPhraseSuppression',
  { text: aiResponse }
)
```

### IPC 通道汇总

| 通道 | 功能 |
|------|------|
| `behavior:getConfig` | 获取行为调控配置 |
| `behavior:updateConfig` | 更新配置 |
| `behavior:addModelAdaptation` | 添加模型适配规则 |
| `behavior:getModelAdaptations` | 获取所有模型适配规则 |
| `behavior:applyModelAdaptation` | 应用模型适配 |
| `behavior:addDetectorXRule` | 添加 DetectorX 规则 |
| `behavior:getDetectorXRules` | 获取 DetectorX 规则 |
| `behavior:applyDetectorX` | 应用 DetectorX |
| `behavior:addSuperDetectorXRule` | 添加 SuperDetectorX 规则 |
| `behavior:applySuperDetectorX` | 应用 SuperDetectorX |
| `behavior:applyPhraseSuppression` | 应用口头禅抑制 |
| `behavior:processOutput` | 综合处理 AI 输出 |

### 综合处理流程

```typescript
// 处理系统提示词
const processedPrompt = await window.electron.ipcRenderer.invoke(
  'behavior:processSystemPrompt',
  { systemPrompt, modelId }
)

// 处理 AI 输出
const { result, superDetections, phraseSuppressed, warnings, blocked } =
  await window.electron.ipcRenderer.invoke('behavior:processOutput', { output: aiResponse })
```

---

## rust-vexus-lite 集成评估

### VCPToolBox 实现分析

rust-vexus-lite 是 VCPToolBox 的核心向量索引组件，使用 Rust + NAPI-RS 实现。

> **许可证**: CC BY-NC-SA 4.0 - 非商业使用完全允许 ✅

#### API 接口

```typescript
interface VexusIndex {
  constructor(dim: number, capacity: number)
  static load(indexPath: string, unusedMapPath: string | null, dim: number, capacity: number): VexusIndex
  save(indexPath: string): void
  add(id: number, vector: Buffer): void
  addBatch(ids: number[], vectors: Buffer): void
  search(query: Buffer, k: number): SearchResult[]
  remove(id: number): void
  stats(): VexusStats
  recoverFromSqlite(dbPath: string, tableType: string, filterDiaryName?: string): Promise<unknown>
}

interface SearchResult {
  id: number
  score: number  // 1.0 - L2sq_distance
}

interface VexusStats {
  totalVectors: number
  dimensions: number
  capacity: number
  memoryUsage: number
}
```

#### 技术特点

| 特性 | 说明 |
|------|------|
| 底层引擎 | USearch (高性能向量索引库) |
| 距离度量 | L2sq (欧氏距离平方) |
| 线程安全 | `Arc<RwLock<Index>>` |
| 自动扩容 | 容量 × 1.5 |
| 索引参数 | connectivity=16, expansion_add=128, expansion_search=64 |
| 性能 | 10 万条向量 <1ms 搜索 |

### 集成方案 (非商业使用)

#### 步骤 1: 下载预编译二进制

```bash
# 从 VCPToolBox 仓库下载对应平台的 .node 文件
# Windows: vexus-lite.win32-x64-msvc.node
# macOS:   vexus-lite.darwin-arm64.node
# Linux:   vexus-lite.linux-x64-gnu.node

# 放置到项目目录
cp vexus-lite.*.node src/main/knowledge/vector/
```

#### 步骤 2: 使用适配器

```typescript
import { createVexusAdapter } from './VexusAdapter'

// 启用原生模式
const adapter = createVexusAdapter(1536, 100000, true)

// 插入向量
await adapter.insert(
  [[0.1, 0.2, 0.3, ...]], // 1536 维向量
  ['doc-001']
)

// 搜索
const results = await adapter.search([0.1, 0.2, 0.3, ...], 10)
// results = [{ id: 'doc-001', score: 0.95 }, ...]

// 保存索引
await adapter.save('./data/my-index.vexus')
```

#### 步骤 3: Electron 集成

```javascript
// package.json
{
  "scripts": {
    "postinstall": "electron-rebuild"
  }
}
```

### 与现有系统对比

| 方面 | rust-vexus-lite | LibSqlDb (现有) |
|------|----------------|-----------------|
| 性能 | ⚡ 极快 (<1ms/10万) | 较快 |
| 内存 | 内存索引 | 磁盘+缓存 |
| 持久化 | 手动 save/load | 自动 |
| 依赖 | 原生模块 | 纯 JS |
| 复杂度 | 需要 rebuild | 开箱即用 |

### 推荐使用场景

| 场景 | 推荐方案 |
|------|----------|
| 高频搜索、大量向量 | ✅ rust-vexus-lite |
| 简单应用、快速开发 | LibSqlDb |
| 需要 SQL 查询 | LibSqlDb |
| 追求极致性能 | ✅ rust-vexus-lite |

---

## 总结

### 已完成功能

| Phase | 功能 | 状态 |
|-------|------|------|
| 10 | aiCore 上下文注入 | ✅ 完成 |
| 11 | ShowVCP 调试机制 | ✅ 完成 |
| 12 | Agent 群体协作 | ✅ 完成 |
| 13 | 精细化行为调控 | ✅ 完成 |
| - | rust-vexus-lite 适配器 | ✅ 完成 |

### 待完善功能

| 功能 | 说明 |
|------|------|
| UI 组件 | 需要为 ShowVCP、协作、行为调控创建前端 UI |
| 持久化 | Agent 协作的任务/消息/知识需要持久化存储 |
| 性能优化 | 大量 Agent 协作时的性能优化 |
| Vexus 集成测试 | 下载 .node 文件并测试 Electron 集成 |

### 下一步建议

1. **下载 rust-vexus-lite**: 从 VCPToolBox 仓库获取预编译文件
2. **创建 UI 组件**: ShowVCP 调试面板、协作管理界面
3. **集成到工作流**: Phase 9 的工作流节点集成
4. **性能测试**: 大规模 Agent 协作场景测试
