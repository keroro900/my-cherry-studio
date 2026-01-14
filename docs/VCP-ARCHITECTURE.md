# VCP 完整架构文档

## 概述

VCP (Virtual Character Protocol) 是 Cherry Studio 的核心扩展系统，源自 VCPToolBox 和 VCPChat 项目。本文档描述了 VCP 在 Cherry Studio 中的完整实现架构。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Renderer Process (React)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   Assistant UI   │  │  Agent Manager  │  │       GroupChat UI          │ │
│  │   (对话界面)      │  │   (VCP Agent)   │  │    (多Agent群聊界面)        │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘ │
│           │                    │                          │                  │
│  ┌────────▼────────────────────▼──────────────────────────▼───────────────┐ │
│  │                         window.api.*                                    │ │
│  │  - advancedMemory (LightMemo/DeepMemo/MeshMemo)                        │ │
│  │  - groupChat (多Agent群聊)                                              │ │
│  │  - vcpInfo (实时状态)                                                   │ │
│  │  - vcpLog (调用日志)                                                    │ │
│  │  - vcp.agent.* / vcp.injector.* / vcp.diary.*                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────▼───────────────────────────────────────────────┐
│                            Main Process (Node.js)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        IPC Handlers Layer                                ││
│  │  VCPIpcHandler | AdvancedMemoryIpcHandler | VCPInfoLogIpcHandler        ││
│  └────────────────────────────────┬────────────────────────────────────────┘│
│                                   │                                          │
│  ┌────────────────────────────────▼────────────────────────────────────────┐│
│  │                      knowledge/ 核心模块                                  ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────────────────────┐   ││
│  │  │                    agent/ - Agent 系统                            │   ││
│  │  │  ┌────────────────┐  ┌─────────────────────┐  ┌───────────────┐  │   ││
│  │  │  │ VCPAgentService│  │AgentCollaborationSvc│  │ContextInjector│  │   ││
│  │  │  │  - Agent CRUD  │  │  - Agent 注册发现   │  │ - 导演模式    │  │   ││
│  │  │  │  - 变量/模板   │  │  - 消息传递        │  │ - 触发条件    │  │   ││
│  │  │  └────────────────┘  │  - 任务分发        │  └───────────────┘  │   ││
│  │  │                      │  - 知识共享        │                      │   ││
│  │  │  ┌────────────────┐  │  - 群体决策        │  ┌───────────────┐  │   ││
│  │  │  │GroupChatOrches.│  └─────────────────────┘  │UnifiedAgent   │  │   ││
│  │  │  │ - 发言模式     │                           │  Adapter      │  │   ││
│  │  │  │ - 任务协调     │                           │ - 类型桥接    │  │   ││
│  │  │  │ - 冲突解决     │                           └───────────────┘  │   ││
│  │  │  └────────────────┘                                              │   ││
│  │  └──────────────────────────────────────────────────────────────────┘   ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────────────────────┐   ││
│  │  │                  memory/ - 记忆检索系统                           │   ││
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │   ││
│  │  │  │ LightMemo  │  │  DeepMemo  │  │  MeshMemo  │  │  TagMemo  │  │   ││
│  │  │  │ BM25+向量  │  │ Tantivy+   │  │ 过滤+召回  │  │ 标签网络  │  │   ││
│  │  │  │ 轻量快速   │  │ Rerank     │  │ 多维检索   │  │ 共现增强  │  │   ││
│  │  │  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │   ││
│  │  └──────────────────────────────────────────────────────────────────┘   ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────────────────────┐   ││
│  │  │                  context/ - 上下文智能                            │   ││
│  │  │  ┌─────────────────────────┐  ┌─────────────────────────────┐   │   ││
│  │  │  │    ContextPurifier      │  │  HallucinationSuppressor    │   │   ││
│  │  │  │  - 格式对齐             │  │  - 语义距离检测              │   │   ││
│  │  │  │  - Token 控制           │  │  - 事实一致性检查            │   │   ││
│  │  │  │  - 重复清理             │  │  - 自动修复                  │   │   ││
│  │  │  └─────────────────────────┘  └─────────────────────────────┘   │   ││
│  │  └──────────────────────────────────────────────────────────────────┘   ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────────────────────┐   ││
│  │  │                  modes/ - 检索模式                                │   ││
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────────────────────┐ │   ││
│  │  │  │DiaryMode   │  │Retrieval   │  │      VCPSearchService      │ │   ││
│  │  │  │Parser      │  │Strategy    │  │  - 统一搜索入口             │ │   ││
│  │  │  │ - 4种模式  │  │ - 全文/RAG │  │  - 增强集成                 │ │   ││
│  │  │  └────────────┘  └────────────┘  └────────────────────────────┘ │   ││
│  │  └──────────────────────────────────────────────────────────────────┘   ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                      services/ - 实时通信                                ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐      ││
│  │  │  VCPInfoService │  │  VCPLogService  │  │   ShowVCPService    │      ││
│  │  │  - 会话追踪     │  │  - 调用记录     │  │   - 调试面板        │      ││
│  │  │  - 步骤广播     │  │  - 链路追踪     │  │   - 状态可视化      │      ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘      ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 模块详解

### 1. Agent 系统

#### 1.1 VCPAgentService
Agent 定义和管理服务。

```typescript
interface VCPAgent {
  id: string
  name: string
  displayName: string
  systemPrompt: string
  personality: string
  vcpConfig?: {
    enableDiary?: boolean
    enableMemory?: boolean
    enableTools?: string[]
  }
}
```

**功能:**
- Agent CRUD 操作
- 变量管理 (`PromptVariable`)
- 模板管理 (`PromptTemplate`)
- 系统变量 (日期、时间、季节等)

#### 1.2 AgentCollaborationService
多 Agent 协作服务，实现 AgentAssistant 协议。

```typescript
// Agent 间消息类型
type AgentMessageType =
  | 'request'         // 请求协助
  | 'response'        // 响应请求
  | 'broadcast'       // 广播消息
  | 'knowledge_share' // 知识分享
  | 'task_assign'     // 任务分配
  | 'vote_request'    // 投票请求
  | 'vote_response'   // 投票响应
```

**功能:**
- Agent 注册与发现
- 消息传递
- 任务分发与自动分配
- 知识共享
- 群体决策 (投票)

#### 1.3 GroupChatOrchestrator
群聊编排器，控制多 Agent 对话流程。

```typescript
// 发言模式
type SpeakingMode =
  | 'sequential'  // 顺序发言
  | 'random'      // 随机发言
  | 'invitation'  // 邀请发言
  | 'mention'     // @提及
  | 'keyword'     // 关键词触发
  | 'consensus'   // 共识模式
```

**功能:**
- 发言模式控制
- 任务分发与协调
- 上下文共享与隔离
- 冲突解决机制

#### 1.4 UnifiedAgentAdapter
统一 Agent 适配器，桥接不同 Agent 系统。

```typescript
// 统一接口
interface UnifiedAgent {
  id: string
  type: 'assistant' | 'vcp' | 'claude-code' | 'custom'
  name: string
  systemPrompt: string
  expertise: string[]
  keywords: string[]
  groupRole: AgentRole
}
```

**支持的类型:**
- `Assistant` - Cherry Studio 原生助手
- `VCPAgent` - VCP 扩展 Agent
- `AgentEntity` - Claude Code 类型 Agent
- `custom` - 自定义 Agent

#### 1.5 ContextInjectorService
上下文注入服务，实现"导演模式"。

```typescript
// 注入位置
type InjectionPosition =
  | 'system_prefix'    // 系统提示词开头
  | 'system_suffix'    // 系统提示词结尾
  | 'user_prefix'      // 用户消息前
  | 'hidden'           // 隐藏注入

// 触发条件
type TriggerType =
  | 'always' | 'keyword' | 'regex' | 'turn_count' | 'time_based' | 'random'
```

---

### 2. 记忆检索系统

#### 2.1 LightMemo
轻量级检索服务，适合中小规模文档集。

```typescript
// 特点
- 纯 JavaScript 实现 (无外部依赖)
- BM25 关键词检索
- 向量语义检索
- 分数融合
- 快速重排

// 使用
const results = await window.api.advancedMemory.lightMemoSearch({
  query: '搜索词',
  queryEmbedding: [...],
  config: { bm25Weight: 0.3, semanticWeight: 0.7, topK: 10 }
})
```

#### 2.2 DeepMemo
深度检索服务，支持大规模文档集。

```typescript
// 特点
- Tantivy 适配器接口 (可选 Rust 加速)
- BM25 fallback
- 双层检索 (关键词 + 语义)
- Reranker 精排
- 可插拔架构

// 使用
const results = await window.api.advancedMemory.deepMemoSearch({
  query: '搜索词',
  queryEmbedding: [...],
  config: { rerank: true, initialTopK: 100, finalTopK: 10 }
})
```

#### 2.3 MeshMemo
多维过滤召回服务，适合元数据丰富的场景。

```typescript
// 特点
- 先过滤后召回策略
- 灵活的 FilterCondition
- MMR 多样性采样
- 时间衰减
- Rerank 精排

// 使用
const results = await window.api.advancedMemory.meshMemoSearch({
  queryEmbedding: [...],
  config: {
    query: '度假风连衣裙',
    filters: [
      { field: 'category', operator: 'equals', value: 'dress' },
      { field: 'season', operator: 'in', value: ['spring', 'summer'] }
    ],
    diversitySampling: true
  }
})
```

#### 2.4 TagMemo
标签网络增强服务。

```typescript
// 特点
- 标签共现矩阵
- 浪潮式传播
- 查询标签扩展
- 结果增强
```

---

### 3. 上下文智能

#### 3.1 ContextPurifier
上下文净化器。

```typescript
// 功能
- 格式对齐 (空格、换行、引号)
- Token 溢出控制
- 重复内容清理
- 敏感信息过滤
- 代码块保护

// 截断策略
type TruncateStrategy = 'head' | 'tail' | 'middle' | 'smart'
```

#### 3.2 HallucinationSuppressor
幻觉抑制器。

```typescript
// 幻觉类型
type HallucinationType =
  | 'factual'       // 事实性幻觉
  | 'contextual'    // 上下文幻觉
  | 'temporal'      // 时间幻觉
  | 'attribution'   // 归因幻觉
  | 'logical'       // 逻辑幻觉
  | 'confabulation' // 困惑型幻觉

// 功能
- 模式检测 (虚假确定性、虚假引用、过度泛化)
- 上下文一致性检查
- 事实一致性检查
- 自动修复
- 置信度评估
```

---

### 4. 检索模式

#### 4.1 DiaryModeParser
日记模式解析器，支持 4 种声明语法：

| 语法 | 模式 | 说明 |
|------|------|------|
| `{{知识库}}` | fulltext | 全文注入 |
| `[[知识库]]` | rag | RAG 片段 |
| `<<知识库>>` | threshold_fulltext | 阈值全文 |
| `《《知识库》》` | threshold_rag | 阈值 RAG |

#### 4.2 RetrievalStrategyService
检索策略服务，支持增强功能：
- 时间感知 (`::Time`)
- 语义组 (`::Group`)
- TagMemo

#### 4.3 VCPSearchService
统一搜索服务，整合所有增强功能。

---

### 5. 实时通信

#### 5.1 VCPInfoService
执行状态追踪服务。

```typescript
// 事件类型
type VCPInfoEvent =
  | { type: 'session:start'; session: ExecutionSession }
  | { type: 'session:end'; status: ExecutionStatus }
  | { type: 'step:start'; step: ExecutionStep }
  | { type: 'step:progress'; progress: number }
  | { type: 'step:end'; status: ExecutionStatus }

// 前端订阅
const unsubscribe = window.api.vcpInfo.onEvent((event) => {
  console.log(event.type, event)
})
```

#### 5.2 VCPLogService
工具调用日志服务。

```typescript
// 功能
- 调用链追踪 (traceId)
- 输入/输出记录
- 性能统计
- 错误追踪

// 前端订阅
window.api.vcpLog.onCallUpdate(({ type, call }) => {
  console.log(type, call.toolName, call.duration)
})
```

---

## IPC 通道清单

### Agent 相关
```
VCP_Agent_List / Get / Create / Update / Delete / Activate / Import
VCP_Variable_List / Create / Update / Delete
VCP_Template_List / Create / Update / Delete / Render
VCP_Injector_Rule_* / Preset_*
AgentCollab_*
```

### 记忆检索
```
AdvancedMemory_LightMemoSearch
AdvancedMemory_DeepMemoSearch
AdvancedMemory_MeshMemoSearch
AdvancedMemory_AddDocument / AddDocuments
AdvancedMemory_Clear / GetDocumentCount
```

### 实时通信
```
VCPInfo_GetActiveSessions / GetRecentSessions / GetSession / ClearSessions
VCPLog_GetRecentCalls / GetRecentLogs / GetTraceCalls / GetCall / Clear
ShowVCP_Enable / Disable / GetConfig / UpdateConfig / GetHistory / ClearHistory
```

---

## 使用示例

### 1. 多 Agent 群聊

```typescript
import {
  createGroupChatOrchestrator,
  createUnifiedAgentAdapter
} from '@main/knowledge/agent'

// 创建适配器
const adapter = createUnifiedAgentAdapter()

// 添加 Agent
adapter.fromAssistant({ id: 'a1', name: '写作助手', prompt: '你是专业的写作助手...' })
adapter.fromAssistant({ id: 'a2', name: '校对专家', prompt: '你是专业的文字校对...' })
adapter.fromAssistant({ id: 'a3', name: '创意顾问', prompt: '你是创意策划专家...' })

// 创建群聊
const orchestrator = createGroupChatOrchestrator({
  name: '内容创作团队',
  speakingMode: 'keyword',
  maxRounds: 5
})

// 添加参与者
for (const agent of adapter.toGroupAgents()) {
  orchestrator.addAgent(agent)
}

// 开始
await orchestrator.start('撰写一篇关于AI的文章')

// 处理用户输入
const decisions = await orchestrator.handleUserInput('请先确定文章大纲')

// 让决定发言的 Agent 说话
for (const decision of decisions) {
  if (decision.shouldSpeak) {
    await orchestrator.requestSpeak(decision.agentId, 'user_request')
  }
}
```

### 2. 上下文净化

```typescript
import { createContextPurifier } from '@main/knowledge/context'

const purifier = createContextPurifier({
  maxTokens: 4000,
  removeDuplicates: true,
  truncateStrategy: 'smart'
})

const result = purifier.purify(longContext)
console.log(`原始: ${result.originalLength} → 净化后: ${result.purifiedLength}`)
console.log(`估算Token: ${result.estimatedTokens}`)
console.log(`修改: ${result.modifications.map(m => m.type).join(', ')}`)
```

### 3. 幻觉检测

```typescript
import { createHallucinationSuppressor } from '@main/knowledge/context'

const suppressor = createHallucinationSuppressor({
  autoFix: true,
  markUncertain: true
})

const result = await suppressor.suppress(aiOutput, {
  conversationHistory: [...],
  knowledgeBase: [...]
})

console.log(`置信度: ${result.overallConfidence}`)
console.log(`检测到的幻觉:`, result.detections)
console.log(`修复后:`, result.processedText)
```

---

## 文件结构

```
src/main/knowledge/
├── agent/
│   ├── index.ts
│   ├── VCPAgentService.ts          # Agent 管理
│   ├── ContextInjectorService.ts   # 上下文注入
│   ├── AgentCollaborationService.ts # 协作服务
│   ├── GroupChatOrchestrator.ts    # 群聊编排
│   └── UnifiedAgentAdapter.ts      # 统一适配器
├── context/
│   ├── index.ts
│   ├── ContextPurifier.ts          # 上下文净化
│   └── HallucinationSuppressor.ts  # 幻觉抑制
├── lightMemo/
│   ├── index.ts
│   └── LightMemoService.ts         # 轻量检索
├── deepMemo/
│   ├── index.ts
│   └── DeepMemoService.ts          # 深度检索
├── meshMemo/
│   ├── index.ts
│   └── GenericMeshMemoService.ts   # 过滤召回
├── tagmemo/
│   └── TagMemoService.ts           # 标签网络
├── modes/
│   ├── types.ts
│   ├── DiaryModeParser.ts          # 日记模式解析
│   └── RetrievalStrategy.ts        # 检索策略
├── search/
│   ├── TimeAwareSearch.ts          # 时间感知
│   └── SemanticGroupSearch.ts      # 语义组
└── vcp/
    └── VCPSearchService.ts         # 统一搜索

src/main/services/
├── VCPIpcHandler.ts                # VCP IPC 处理
├── AdvancedMemoryIpcHandler.ts     # 记忆服务 IPC
├── GroupChatIpcHandler.ts          # 群聊 IPC 处理
├── VCPInfoService.ts               # 状态追踪
├── VCPLogService.ts                # 调用日志
├── VCPInfoLogIpcHandler.ts         # 状态/日志 IPC
└── ShowVCPService.ts               # 调试面板

src/renderer/src/services/
├── GroupChatService.ts             # 群聊服务 (前端)
└── ...

src/renderer/src/pages/home/components/GroupChat/
├── index.ts                        # 模块导出
├── GroupChatPanel.tsx              # 群聊面板组件
├── GroupChatPanel.module.css       # 面板样式
├── GroupAgentSelector.tsx          # Agent 选择器
└── GroupAgentSelector.module.css   # 选择器样式
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.1.0 | 2024-12 | 添加群聊 UI 组件 (GroupChatPanel, GroupAgentSelector) |
| 1.0.0 | 2024-12 | 初始版本，完成 Phase 1-5 |

---

## 待实现功能

1. **Flow Lock 模式** - AI 主动模式
2. **流式 Diff 渲染** - 增量 UI 更新
3. **Tantivy Rust 绑定** - DeepMemo 加速
4. **分布式节点** - 跨服务器 GPU 调度 (预留)

---

## GroupChat UI 使用示例

### 1. 基础用法 (React 组件)

```tsx
import { GroupChatPanel, GroupAgentSelector } from '@renderer/pages/home/components/GroupChat'

// 使用群聊面板
function MyPage() {
  const [showGroupChat, setShowGroupChat] = useState(false)
  const assistants = useAssistants() // 从 store 获取

  return (
    <>
      <Button onClick={() => setShowGroupChat(true)}>
        开始群聊
      </Button>

      {showGroupChat && (
        <GroupChatPanel
          availableAssistants={assistants}
          initialConfig={{
            speakingMode: 'mention',
            maxRounds: 10
          }}
          onClose={() => setShowGroupChat(false)}
        />
      )}
    </>
  )
}
```

### 2. 使用 GroupChatService (编程式)

```typescript
import { groupChatService } from '@renderer/services/GroupChatService'

// 创建群聊会话
const { sessionId } = await groupChatService.createSession({
  name: '产品讨论',
  speakingMode: 'mention'
})

// 添加助手
await groupChatService.adaptAssistant({
  id: 'assistant-1',
  name: '产品经理',
  prompt: '你是一个产品经理...'
})

// 开始群聊
await groupChatService.start(sessionId, '讨论新功能设计')

// 发送消息
const { decisions } = await groupChatService.handleUserInput(
  sessionId,
  '@产品经理 请分析用户需求'
)

// 订阅事件
const unsubscribe = groupChatService.subscribe((event) => {
  if (event.type === 'agent:speak') {
    console.log(`${event.message.agentName}: ${event.message.content}`)
  }
})
```

### 3. IPC 调用 (直接使用)

```typescript
// 创建会话
const result = await window.api.groupChat.create({
  speakingMode: 'consensus'
})

// 添加 Agent
await window.api.groupChat.addAgent({
  sessionId: result.sessionId,
  agent: {
    id: 'expert-1',
    name: 'AI专家',
    displayName: 'AI技术专家',
    role: 'expert',
    expertise: ['AI', '机器学习'],
    triggerKeywords: ['AI', 'LLM', '模型'],
    systemPrompt: '你是AI领域的专家...',
    priority: 80
  }
})

// 监听事件
window.api.groupChat.onEvent((event) => {
  console.log('群聊事件:', event)
})
```
