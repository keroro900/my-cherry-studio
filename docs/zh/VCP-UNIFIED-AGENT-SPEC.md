# VCP 统一 Agent 架构规范

本文档定义了 Cherry Studio 中 **UnifiedAssistant（统一助手）** 的规范与运行方式，明确 Assistant 为唯一模型与持久化来源，Legacy VCPAgent 仅用于兼容导入/导出。

---

## 1. 设计目标

### 1.1 核心理念

> **助手 = Agent = 带系统提示词 + 统一执行层 + 记忆管理的智能体**

将 Cherry Studio 的助手功能改造为 VCPChat 风格的 Agent，实现：
- 统一的身份管理（系统提示词、人格、背景）
- 统一的执行层（大脑/Brain）
- 统一的记忆管理（日记本、知识库、长期记忆）
- 统一的群聊协作能力

### 1.2 目标

| 目标 | 描述 |
|------|------|
| 统一管理 | 一套模型/代码管理所有类型的 Agent |
| 兼容导入 | Legacy VCPAgent 仅作为导入/导出与迁移来源 |
| 渐进迁移 | 迁移完成后移除旧字段与兼容层 |
| 功能融合 | 助手获得 VCP 全部能力（日记、记忆、工具、群聊） |

---

## 2. 现状分析

### 2.1 统一模型与兼容来源

| 维度 | UnifiedAssistant（主存储） | Legacy VCPAgent（兼容导入/导出） |
|------|---------------------|------------------|
| 定义位置 | `src/renderer/src/types/assistant.ts` | `src/main/knowledge/agent/VCPAgentService.ts` |
| 存储方式 | Redux Store + IndexedDB | 文件系统 (JSON，仅用于导入/导出) |
| 系统提示词 | `systemPrompt` | 映射到 `systemPrompt` |
| 统一配置 | `profile/memory/tools/groupChat/collaboration/vcpConfig` | 导入时映射到统一字段 |
| 知识库 | `knowledgeBases` + `vcpConfig.knowledgeBaseId` | 导入时映射 |

### 2.2 现有桥接层

```
┌─────────────────────────────────────────────────────────┐
│                UnifiedAgentAdapter                       │
├─────────────────────────────────────────────────────────┤
│  fromAssistant(Assistant) → UnifiedAgent                │
│  fromVCPAgent(LegacyVCPAgent) → UnifiedAgent            │
│  toGroupAgent(UnifiedAgent) → GroupAgent                │
└─────────────────────────────────────────────────────────┘
```

### 2.3 UnifiedAssistant 统一字段

```typescript
type UnifiedAssistant = {
  id: string
  name: string
  displayName: string
  systemPrompt: string
  modelId?: string
  isActive: boolean

  profile?: AssistantProfile
  memory?: AssistantMemory
  tools?: AssistantTools
  groupChat?: AssistantGroupChat
  collaboration?: AssistantCollaboration
  vcpConfig?: AssistantVCPConfig

  knowledgeBases?: Array<{ id: string; name?: string }>
  createdAt?: string
  updatedAt?: string
}
```

---

## 3. 统一 Agent 架构

### 3.1 核心类型定义

```typescript
/**
 * 统一 Agent 核心接口（唯一模型）
 * Legacy VCPAgent 仅在导入/导出流程中映射
 */
interface UnifiedAgentCore {
  // === 身份标识 ===
  id: string
  name: string
  displayName: string
  avatar?: string
  description?: string
  tags?: string[]
  category?: string

  // === 系统提示词（核心） ===
  systemPrompt: string

  // === 模型配置 ===
  modelId?: string

  // === 人格定义 ===
  profile?: {
    personality?: string
    background?: string
    greetingMessage?: string
    exampleDialogues?: string[]
    tone?: 'formal' | 'casual' | 'playful' | 'professional'
    traits?: string[]
  }

  // === 记忆与知识 ===
  memory?: {
    enabled: boolean
    diaryBookName?: string
    knowledgeBaseIds?: string[]
    backends?: MemoryBackend[]
    topK?: number
    windowSize?: number
  }

  // === 工具能力 ===
  tools?: {
    mcpServers?: string[]
    vcpPlugins?: string[]
    autoApproveAll?: boolean
    disabledTools?: string[]
    enableWebSearch?: boolean
    enableUrlContext?: boolean
    enableGenerateImage?: boolean
  }

  // === 群聊配置 ===
  groupChat?: {
    enabled: boolean
    role: AgentRole
    expertise: string[]
    triggerKeywords: string[]
    priority: number
    speakingPreferences?: SpeakingPreferences
  }

  // === 协作配置 ===
  collaboration?: {
    canInitiate?: boolean
    canDelegate?: boolean
    maxConcurrentTasks?: number
    responseStyle?: ResponseStyle
    allowedAgents?: string[]
    blockedAgents?: string[]
    messagePrefix?: string
  }

  // === VCP 扩展配置 ===
  vcpConfig?: {
    knowledgeBaseId?: string
    knowledgeBaseName?: string
    contextInjections?: string[]
  }

  knowledgeBases?: Array<{ id: string; name?: string }>

  // === 状态 ===
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

type MemoryBackend = 'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'knowledge' | 'memory'
type AgentRole = 'host' | 'participant' | 'observer' | 'expert' | 'moderator'
type ResponseStyle = 'concise' | 'detailed' | 'adaptive'
type SpeakingPreferences = {
  maxResponseLength?: number
  preferredTopics?: string[]
  avoidTopics?: string[]
}
type LegacyVCPAgent = Record<string, unknown>
```

### 3.2 统一 Agent 服务

```typescript
/**
 * UnifiedAgentService - 统一 Agent 管理服务
 *
 * 职责：
 * 1. Agent CRUD 操作
 * 2. Legacy VCPAgent 兼容导入/导出
 * 3. 提供统一的 Agent 查询接口
 */
class UnifiedAgentService {
  // === Agent 管理 ===
  createAgent(config: CreateAgentConfig): Promise<UnifiedAgentCore>
  updateAgent(id: string, updates: Partial<UnifiedAgentCore>): Promise<UnifiedAgentCore>
  deleteAgent(id: string): Promise<void>
  getAgent(id: string): Promise<UnifiedAgentCore | null>
  listAgents(filter?: AgentFilter): Promise<UnifiedAgentCore[]>

  // === 同步方法 ===
  syncFromAssistant(assistant: UnifiedAgentCore): Promise<UnifiedAgentCore>
  syncToAssistant(agent: UnifiedAgentCore): Promise<UnifiedAgentCore>

  // === 兼容导入/导出（legacy） ===
  syncFromVCPAgent(vcpAgent: LegacyVCPAgent): Promise<UnifiedAgentCore>
  syncToVCPAgent(agent: UnifiedAgentCore): Promise<LegacyVCPAgent>

  // === 迁移方法 ===
  migrateAssistantToUnified(assistantId: string): Promise<UnifiedAgentCore>
  migrateAllAssistants(): Promise<MigrationResult>

  // === 群聊支持 ===
  getGroupAgents(agentIds: string[]): Promise<GroupAgent[]>
  findByExpertise(expertise: string): Promise<UnifiedAgentCore[]>
  findByKeyword(keyword: string): Promise<UnifiedAgentCore[]>
}
```

### 3.3 执行层（Brain）

```typescript
/**
 * AgentBrain - 统一执行层
 *
 * 负责：
 * 1. 系统提示词注入
 * 2. 记忆检索与注入
 * 3. 工具调用编排
 * 4. 上下文管理
 */
class AgentBrain {
  constructor(private agent: UnifiedAgentCore) {}

  // === 上下文构建 ===
  async buildContext(userMessage: string, session: SessionContext): Promise<AgentContext> {
    const context: AgentContext = {
      systemPrompt: await this.buildSystemPrompt(),
      memories: await this.retrieveMemories(userMessage),
      tools: await this.getAvailableTools(),
      history: await this.getConversationHistory(session)
    }
    return context
  }

  // === 系统提示词构建 ===
  private async buildSystemPrompt(): Promise<string> {
    let prompt = this.agent.systemPrompt

    // 注入人格定义
    if (this.agent.profile?.personality) {
      prompt = `${prompt}\n\n## 人格特质\n${this.agent.profile.personality}`
    }
    if (this.agent.profile?.background) {
      prompt = `${prompt}\n\n## 背景故事\n${this.agent.profile.background}`
    }

    // 注入日记本内容
    if (this.agent.memory?.diaryBookName) {
      const diaryContent = await this.getDiaryContent()
      prompt = prompt.replace(`{{${this.agent.memory.diaryBookName}日记本}}`, diaryContent)
    }

    // 处理其他占位符
    prompt = await PlaceholderEngine.resolve(prompt, this.getPlaceholderContext())

    return prompt
  }

  // === 记忆检索 ===
  private async retrieveMemories(query: string): Promise<MemoryResult[]> {
    if (!this.agent.memory?.enabled) return []

    const backends = this.agent.memory.backends || ['diary', 'memory']
    const results: MemoryResult[] = []

    for (const backend of backends) {
      const memories = await MemoryService.search(backend, query, {
        diaryName: this.agent.memory.diaryBookName,
        topK: this.agent.memory.topK || 10
      })
      results.push(...memories)
    }

    return results
  }

  // === 工具获取 ===
  private async getAvailableTools(): Promise<Tool[]> {
    const tools: Tool[] = []

    // MCP 工具
    if (this.agent.tools.mcpServers?.length) {
      const mcpTools = await MCPService.getTools(this.agent.tools.mcpServers)
      tools.push(...mcpTools)
    }

    // VCP 插件工具
    if (this.agent.tools.vcpPlugins?.length) {
      const vcpTools = await VCPRuntime.getPluginTools(this.agent.tools.vcpPlugins)
      tools.push(...vcpTools)
    }

    return tools
  }
}
```

---

## 4. 迁移策略

### 4.1 渐进式迁移

```
Phase 1: 兼容层（当前）
  ├─ UnifiedAgentAdapter 桥接 Assistant/LegacyVCPAgent
  ├─ Assistant 成为唯一来源，Legacy VCPAgent 仅导入/导出
  └─ 新功能优先在 UnifiedAgent 实现

Phase 2: 统一管理
  ├─ 创建 UnifiedAgentService
  ├─ Assistant 作为唯一存取入口（读写统一字段）
  └─ VCPAgentService 退化为导入/导出适配层

Phase 3: UI 统一
  ├─ 助手设置页面覆盖 profile/memory/tools/groupChat/collaboration/vcpConfig
  ├─ 知识库 Agent 页面使用 UnifiedAgentService
  └─ 群聊直接使用 UnifiedAgent

Phase 4: 完全迁移
  ├─ 评估移除 VCPAgentService（保留导入/导出脚手架）
  ├─ Assistant 类型扩展为 UnifiedAgentCore
  └─ 移除兼容层代码
```

### 4.2 数据迁移

```typescript
// 兼容导入：Legacy VCPAgent -> UnifiedAgentCore
function mapLegacyVCPAgent(legacy: LegacyVCPAgent): UnifiedAgentCore {
  return {
    id: legacy.id,
    name: legacy.name,
    displayName: legacy.displayName ?? legacy.name,
    systemPrompt: legacy.systemPrompt,
    profile: mapLegacyProfile(legacy),
    memory: mapLegacyMemory(legacy),
    tools: mapLegacyTools(legacy),
    groupChat: mapLegacyGroupChat(legacy),
    collaboration: mapLegacyCollaboration(legacy),
    vcpConfig: mapLegacyVCPConfig(legacy),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}
```

---

## 5. UI 融合方案

### 5.1 助手设置页面增强

```
助手设置
├─ 基础信息
│   ├─ 名称、头像、描述
│   └─ 标签
├─ 系统提示词（核心）
│   ├─ 提示词编辑器
│   └─ 占位符插入工具
├─ 人格定义（新增）
│   ├─ 人格特质
│   ├─ 背景故事
│   └─ 开场白
├─ 模型设置
│   ├─ 默认模型
│   └─ 参数配置
├─ 记忆与知识（增强）
│   ├─ 启用记忆
│   ├─ 关联日记本
│   ├─ 关联知识库
│   └─ 记忆后端选择
├─ 工具能力
│   ├─ MCP 服务器
│   ├─ VCP 插件
│   └─ 自动批准设置
└─ 群聊设置
    ├─ 启用群聊
    ├─ 群聊角色
    ├─ 专业领域
    └─ 发言偏好
```

### 5.2 统一 Agent 选择器

```tsx
// 在群聊、协作等场景使用统一的 Agent 选择器
<UnifiedAgentSelector
  mode="single" | "multiple"
  filter={{ hasMemory: true }}
  onSelect={(agents) => handleSelect(agents)}
/>
```

---

## 6. 实现优先级

### Phase 2.1 - 核心服务（高优先级）

1. **创建 UnifiedAgentService**
   - 文件：`src/main/services/UnifiedAgentService.ts`
   - 实现 Agent CRUD 和同步方法

2. **扩展 Assistant 类型**
   - 添加人格定义字段
   - 完善 VCP 配置字段

3. **实现 AgentBrain**
   - 统一的上下文构建
   - 记忆检索与注入

### Phase 2.2 - UI 增强（中优先级）

4. **助手设置页面增强**
   - 添加人格定义 Tab
   - 增强记忆配置

5. **统一 Agent 选择器**
   - 替换群聊中的 Assistant 选择器

### Phase 2.3 - 迁移工具（低优先级）

6. **迁移脚本**
   - 批量迁移现有 Assistant
   - 数据验证和回滚

---

## 7. 验收标准

- [ ] 创建助手时自动生成 UnifiedAgent
- [ ] 助手设置页面可配置人格、记忆、工具
- [x] 群聊可直接使用任意类型的 Agent *(Phase 7.2 已完成)*
- [ ] 日记本内容正确注入系统提示词
- [ ] VCP 工具在助手对话中可用
- [ ] 迁移现有助手无数据丢失

---

## 8. 实现进度

### 8.1 已完成功能 (2025-12-31)

#### 群聊（多助手协同）
- ✅ **UnifiedAgentAdapter** — 桥接 Assistant 到 GroupAgent
- ✅ **GroupChatCoordinator** — 多助手协调与轮换发言
- ✅ **流式消息显示** — 使用 `useRef` + 100ms 节流避免 React 竞态
- ✅ **统一模型配置** — `useUnifiedModel` + `unifiedModel` 群聊共享模型
- ✅ **成员标签系统** — `memberTags` 支持自然随机模式权重
- ✅ **邀请提示词模板** — `invitePromptTemplate` 可配置

#### 群聊事件系统
- ✅ `agent:thinking` — 助手开始思考
- ✅ `agent:stream` — 流式输出（`messageId`, `chunk`, `accumulatedContent`）
- ✅ `agent:speak` — 消息完成（复用 `messageId` 关联流式）
- ✅ `chat:start` / `chat:end` — 会话生命周期
- ✅ `agent:join` / `agent:leave` — 助手加入/离开

### 8.2 待完成功能

| 功能 | 优先级 | 状态 |
|------|--------|------|
| UnifiedAgentService 核心服务 | P0 | 待开发 |
| Assistant 双向同步 | P0 | 待开发 |
| AgentBrain 执行层 | P1 | 待开发 |
| 助手设置页面增强 | P1 | 待开发 |
| 迁移工具 | P2 | 待开发 |

---

## 9. 参考文件

| 文件 | 用途 |
|------|------|
| `src/renderer/src/types/index.ts` | Assistant 类型定义 |
| `src/main/knowledge/agent/VCPAgentService.ts` | Legacy VCPAgent 管理（仅兼容导入/导出） |
| `src/main/knowledge/agent/UnifiedAgentAdapter.ts` | 现有适配器 |
| `src/renderer/src/pages/settings/AssistantSettings/` | 助手设置 UI |
| `src/renderer/src/services/GroupChatCoordinator.ts` | 群聊协调器 |
| `src/renderer/src/pages/home/components/GroupChat/GroupChatPanel.tsx` | 群聊 UI |
