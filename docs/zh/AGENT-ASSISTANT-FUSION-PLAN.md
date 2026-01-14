# Agent 与 Assistant 融合方案

> **核心理念**: Assistant = Agent，助手即智能体，智能体即助手

---

## 1. 现状分析

### 1.1 当前两套系统

| 维度 | UnifiedAssistant（主存储） | Legacy VCPAgent（兼容导入/导出） |
|------|---------------------------|-------------|
| **定义位置** | `renderer/src/types/assistant.ts` | `main/knowledge/agent/VCPAgentService.ts` |
| **存储方式** | Redux Store (IndexedDB) | 文件系统 (JSON，仅用于导入/导出) |
| **核心字段** | `systemPrompt` | 映射到 `systemPrompt` |
| **人格系统** | `profile` | 导入时映射到统一字段 |
| **记忆系统** | `memory` | 导入时映射到统一字段 |
| **工具系统** | `tools` | 导入时映射到统一字段 |
| **群聊配置** | `groupChat` | 导入时映射到统一字段 |

### 1.2 问题

1. **概念混淆**: 用户需要理解"助手"和"Agent"两个概念
2. **数据冗余**: 同一个智能体可能存在于两套系统中
3. **同步复杂**: 需要 UnifiedAgentService 做双向同步
4. **维护成本**: 两套代码路径，容易出 bug

---

## 2. 融合目标

```
┌─────────────────────────────────────────────────────────────┐
│                      统一 Assistant                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  核心配置    │  │  人格配置    │  │  能力配置            │  │
│  │  - id       │  │  - personality│ │  - mcpServers      │  │
│  │  - name     │  │  - background │  │  - vcpPlugins      │  │
│  │  - systemPrompt │  │  - greeting   │  │  - memory.enabled │  │
│  │  - model    │  │  - traits     │  │  - knowledgeBases  │  │
│  │  - emoji    │  │  - tone       │  │  - enableWebSearch │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  协作配置                                                │ │
│  │  - groupChat (群聊角色、专长、触发词)                      │ │
│  │  - collaboration (委托、并发、响应风格)                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 融合策略

### 3.1 类型统一

**保留 Assistant 作为唯一类型**，吸收 VCPAgent 的优点：

```typescript
// renderer/types/index.ts - 最终形态
export type Assistant = {
  // ==================== 身份标识 ====================
  id: string
  name: string
  displayName: string
  avatar?: string
  description?: string
  tags?: string[]
  category?: string

  // ==================== 核心提示词 ====================
  systemPrompt: string
  modelId?: string
  isActive: boolean

  // ==================== 人格配置 ====================
  profile?: {
    personality?: string
    background?: string
    greetingMessage?: string
    exampleDialogues?: Array<{ user: string; assistant: string }>
    tone?: 'formal' | 'casual' | 'playful' | 'professional'
    traits?: string[]
  }

  // ==================== 记忆配置 ====================
  memory?: {
    enabled: boolean
    enableUnifiedSearch?: boolean
    tagBoost?: number
    useRRF?: boolean
    diaryBookName?: string
    backends?: MemoryBackend[]
    topK?: number
    windowSize?: number
  }

  // ==================== 工具配置 ====================
  tools?: {
    mcpServers?: MCPServer[]
    vcpPlugins?: string[]
    autoApproveAll?: boolean
    disabledTools?: string[]
    enableWebSearch?: boolean
    webSearchProviderId?: string
    enableUrlContext?: boolean
    enableGenerateImage?: boolean
  }

  // ==================== 群聊配置 ====================
  groupChat?: {
    enabled: boolean
    role: AgentRole
    expertise: string[]
    triggerKeywords: string[]
    priority: number
    speakingPreferences?: SpeakingPreferences
  }

  // ==================== 协作配置 ====================
  collaboration?: {
    canInitiate?: boolean
    canDelegate?: boolean
    maxConcurrentTasks?: number
    responseStyle?: 'concise' | 'detailed' | 'adaptive'
    allowedAgents?: string[]
    blockedAgents?: string[]
    messagePrefix?: string
  }

  // ==================== VCP 扩展配置 ====================
  vcpConfig?: {
    knowledgeBaseId?: string
    knowledgeBaseName?: string
    contextInjections?: string[]
  }

  // ==================== 知识库 ====================
  knowledgeBases?: Array<{ id: string; name?: string }>

  // ==================== 元信息 ====================
  version?: string
  createdAt?: string
  updatedAt?: string
}
```

### 3.2 存储统一

**方案**: 以 Redux Store 为主存储，文件系统作为导出/备份

```
┌─────────────────────────────────────────────────────────────┐
│                     Redux Store (主存储)                     │
│                                                              │
│  assistants: {                                              │
│    entities: { [id]: Assistant }                            │
│    ids: string[]                                            │
│  }                                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   文件系统 (导出/备份)                        │
│                                                              │
│  userData/assistants/                                        │
│  ├── index.json          # 索引文件                          │
│  ├── {id}.json           # 单个助手配置                       │
│  └── exports/            # 用户导出                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 服务统一

**退化**: `VCPAgentService`（仅兼容导入/导出）
**保留**: `UnifiedAgentService`/`AssistantService`（统一管理入口）
**保留**: `UnifiedAgentAdapter`（仅用于群聊场景的接口转换）

```typescript
// 新架构
class AssistantService {
  // CRUD - 通过 Redux actions
  createAssistant(config: CreateAssistantConfig): Assistant
  updateAssistant(id: string, updates: Partial<Assistant>): Assistant
  deleteAssistant(id: string): void
  getAssistant(id: string): Assistant | null
  listAssistants(filter?: AssistantFilter): Assistant[]

  // 导入导出
  exportAssistant(id: string): AssistantExportData
  importAssistant(data: AssistantExportData): Assistant

  // 群聊适配
  toGroupAgent(assistant: Assistant): GroupAgent

  // VCPToolBox 兼容 (过渡期)
  exportToVCPFormat(assistant: Assistant): string  // 导出为 .txt 格式
  importFromVCPFormat(content: string): Partial<Assistant>
}
```

---

## 4. 迁移计划

### Phase 1: 字段统一 (低风险)

1. **清理旧字段**
   - Assistant 存储/运行时仅保留 `systemPrompt/profile/memory/tools/groupChat/collaboration/vcpConfig`
2. **统一知识库与上下文入口**
   - `knowledgeBases`/`vcpConfig` 作为唯一注入来源
3. **统一群聊与协作配置**
   - `groupChat`/`collaboration` 仅使用统一字段

### Phase 2: 服务收敛 (中风险)

1. **VCPAgentService 退化为兼容层**
   - 仅处理导入/导出与旧数据映射
2. **UnifiedAgentService/AssistantService 作为唯一管理入口**
   - 消息协作与群聊编排统一走主流程

### Phase 3: UI 统一 (高影响)

1. **助手设置页面**
   - 覆盖 `profile/memory/tools/groupChat/collaboration/vcpConfig`
2. **VCP Dashboard**
   - 移除独立 Agent 管理入口
   - 集成到助手管理

---

## 5. 兼容性处理

### 5.1 兼容导入/导出

- Legacy VCPAgent 仅在导入/导出流程中映射
- 导入后必须规范化为统一字段并落库
- 正常读写路径不再出现旧字段

### 5.2 VCPToolBox 兼容

保留从 VCPToolBox `.txt` 文件导入的能力：

```typescript
// 解析 VCPToolBox Agent 格式
function parseVCPToolBoxAgent(content: string, filename: string): Partial<Assistant> {
  return {
    name: filename.replace(/\.(txt|md)$/, ''),
    displayName: filename.replace(/\.(txt|md)$/, ''),
    systemPrompt: content,
    profile: extractProfileFromContent(content)  // 从内容中提取人格信息
  }
}
```

---

## 6. 术语统一

| 旧术语 | 新术语 | 说明 |
|--------|--------|------|
| Agent | 助手 | 统一使用"助手" |
| VCPAgent | Legacy VCPAgent | 仅兼容导入/导出 |
| Assistant | UnifiedAssistant | 唯一模型与存储来源 |
| GroupAgent | 群聊成员 | 群聊场景的助手 |

---

## 7. 验收标准

- [ ] 所有助手使用统一的 `Assistant` 类型
- [ ] 助手设置 UI 包含人格、记忆、工具、协作配置
- [ ] 群聊可直接使用任意助手
- [ ] 可从 VCPToolBox 导入 Agent 定义
- [ ] VCPAgentService 退化为导入/导出适配层
- [ ] 所有单元测试通过

---

## 8. 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 数据迁移失败 | 中 | 提供回滚脚本，迁移前备份 |
| UI 改动大 | 高 | 分阶段迁移，保留旧 UI 过渡期 |
| 第三方集成 | 低 | 保留 VCPToolBox 导入能力 |

---

## 9. 参考文件

- `src/renderer/src/types/assistant.ts` - UnifiedAssistant 类型
- `src/main/knowledge/agent/VCPAgentService.ts` - Legacy VCPAgent 兼容导入/导出
- `src/main/services/UnifiedAgentService.ts` - 统一服务
- `src/main/knowledge/agent/UnifiedAgentAdapter.ts` - 适配器
