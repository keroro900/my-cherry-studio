/**
 * UnifiedAgentService - 统一 Agent 服务
 *
 * 提供统一的 Agent 管理和协作功能:
 * - Agent CRUD 操作（创建、更新、删除）
 * - Assistant ↔ VCPAgent 双向同步
 * - Agent 间消息传递
 * - 任务委托机制
 * - 群体投票功能
 * - 持久化存储
 *
 * @version 2.0.0
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { app } from 'electron'

import { loggerService } from '@logger'

import { getUnifiedAgentAdapter, type UnifiedAgent } from '../knowledge/agent/UnifiedAgentAdapter'
import { getVCPAgentService, type VCPAgent } from '../knowledge/agent/VCPAgentService'
import { reduxService } from './ReduxService'

const logger = loggerService.withContext('UnifiedAgentService')

// ==================== 核心类型定义 (VCP-UNIFIED-AGENT-SPEC) ====================

/**
 * 记忆后端类型
 */
export type MemoryBackend = 'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'knowledge' | 'memory'

/**
 * Agent 角色类型
 */
export type AgentRole = 'host' | 'participant' | 'observer' | 'expert' | 'moderator'

/**
 * Agent 类型
 */
export type AgentType = 'assistant' | 'vcp' | 'claude-code' | 'custom'

/**
 * 发言偏好配置
 */
export interface SpeakingPreferences {
  style?: 'concise' | 'detailed' | 'balanced'
  maxLength?: number
  includeEmoji?: boolean
  formalityLevel?: 'formal' | 'casual' | 'balanced'
}

/**
 * 模型配置
 */
export interface AgentModelConfig {
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  topK?: number
}

/**
 * 记忆配置
 */
export interface AgentMemoryConfig {
  enabled: boolean
  diaryBookName?: string
  knowledgeBaseIds?: string[]
  memoryWindowSize?: number
  backends?: MemoryBackend[]
}

/**
 * 工具配置
 */
export interface AgentToolConfig {
  mcpServers?: string[]
  vcpPlugins?: string[]
  autoApproveAll?: boolean
  disabledAutoApproveTools?: string[]
}

/**
 * 群聊配置
 */
export interface AgentGroupChatConfig {
  enabled: boolean
  role: AgentRole
  expertise: string[]
  triggerKeywords: string[]
  priority: number
  speakingPreferences?: SpeakingPreferences
}

/**
 * 统一 Agent 核心接口
 * 所有类型的 Agent（Assistant、VCPAgent、ClaudeCode Agent）都实现此接口
 */
export interface UnifiedAgentCore {
  // === 身份标识 ===
  id: string
  type: AgentType
  name: string
  displayName: string
  avatar?: string
  emoji?: string
  description?: string
  tags?: string[]

  // === 系统提示词（核心） ===
  systemPrompt: string

  // === 人格定义（VCP 风格） ===
  personality?: string
  background?: string
  greetingMessage?: string
  exampleDialogues?: string[]

  // === 模型配置 ===
  modelId?: string
  modelConfig?: AgentModelConfig

  // === 记忆与知识 ===
  memory: AgentMemoryConfig

  // === 工具能力 ===
  tools: AgentToolConfig

  // === 群聊配置 ===
  groupChat: AgentGroupChatConfig

  // === 状态 ===
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 创建 Agent 配置
 */
export interface CreateAgentConfig {
  name: string
  displayName?: string
  type?: AgentType
  systemPrompt?: string
  personality?: string
  background?: string
  greetingMessage?: string
  modelId?: string
  modelConfig?: AgentModelConfig
  memory?: Partial<AgentMemoryConfig>
  tools?: Partial<AgentToolConfig>
  groupChat?: Partial<AgentGroupChatConfig>
  emoji?: string
  avatar?: string
  description?: string
  tags?: string[]
}

/**
 * Agent 过滤条件
 */
export interface AgentFilter {
  type?: AgentType | AgentType[]
  hasMemory?: boolean
  hasTools?: boolean
  groupChatEnabled?: boolean
  tags?: string[]
  searchText?: string
  isActive?: boolean
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  totalAssistants: number
  migratedCount: number
  failedCount: number
  skippedCount: number
  errors: Array<{ assistantId: string; error: string }>
}

// ==================== 协作类型定义 ====================

/**
 * Agent 消息
 */
export interface AgentMessage {
  id: string
  fromAgentId: string
  toAgentId: string | 'broadcast'
  type: 'request' | 'response' | 'notification' | 'delegate' | 'vote'
  content: string
  metadata?: Record<string, unknown>
  timestamp: number
  conversationId?: string
  parentMessageId?: string
}

/**
 * Agent 任务
 */
export interface AgentTask {
  id: string
  fromAgentId: string
  targetAgentId?: string // 指定目标 Agent，不指定则自动选择
  type: 'query' | 'action' | 'analyze' | 'summarize' | 'delegate'
  description: string
  context?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed'
  result?: string
  assignedAgentId?: string
  createdAt: number
  completedAt?: number
}

/**
 * 投票选项
 */
export interface VoteOption {
  id: string
  label: string
  description?: string
}

/**
 * 投票请求
 */
export interface VoteRequest {
  id: string
  topic: string
  options: VoteOption[]
  initiatorId: string
  participantIds: string[]
  deadline?: number
  minVotes?: number
  status: 'active' | 'completed' | 'cancelled'
  createdAt: number
}

/**
 * 投票结果
 */
export interface VoteResult {
  requestId: string
  votes: Map<string, string> // agentId -> optionId
  winner?: VoteOption
  totalVotes: number
  completedAt: number
}

// ==================== UnifiedAgentService ====================

export class UnifiedAgentService {
  private static instance: UnifiedAgentService | null = null

  private messageQueue: AgentMessage[] = []
  private taskQueue: AgentTask[] = []
  private activeVotes: Map<string, VoteRequest> = new Map()
  private voteResults: Map<string, Map<string, string>> = new Map() // requestId -> (agentId -> optionId)

  private messageListeners: Set<(message: AgentMessage) => void> = new Set()
  private taskListeners: Set<(task: AgentTask) => void> = new Set()

  // === 存储 ===
  private storagePath: string
  private agentCache: Map<string, UnifiedAgentCore> = new Map()
  private initialized: boolean = false

  private constructor() {
    this.storagePath = path.join(app.getPath('userData'), 'unified-agents')
    logger.info('UnifiedAgentService created', { storagePath: this.storagePath })
  }

  static getInstance(): UnifiedAgentService {
    if (!UnifiedAgentService.instance) {
      UnifiedAgentService.instance = new UnifiedAgentService()
    }
    return UnifiedAgentService.instance
  }

  // ==================== 初始化与存储 ====================

  /**
   * 初始化服务，加载所有 Agent
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 确保存储目录存在
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true })
      }

      // 加载所有 Agent
      await this.loadAllAgents()
      this.initialized = true
      logger.info('UnifiedAgentService initialized', { agentCount: this.agentCache.size })
    } catch (error) {
      logger.error('Failed to initialize UnifiedAgentService:', error as Error)
      throw error
    }
  }

  /**
   * 加载所有 Agent
   */
  private async loadAllAgents(): Promise<void> {
    try {
      const files = fs.readdirSync(this.storagePath).filter((f) => f.endsWith('.json'))

      for (const file of files) {
        try {
          const filePath = path.join(this.storagePath, file)
          const content = fs.readFileSync(filePath, 'utf-8')
          const agent = JSON.parse(content) as UnifiedAgentCore
          this.agentCache.set(agent.id, agent)
        } catch (error) {
          logger.warn(`Failed to load agent from ${file}:`, error as Error)
        }
      }
    } catch (error) {
      logger.error('Failed to load agents:', error as Error)
    }
  }

  /**
   * 保存 Agent 到文件
   */
  private saveAgent(agent: UnifiedAgentCore): void {
    try {
      const filePath = path.join(this.storagePath, `${agent.id}.json`)
      fs.writeFileSync(filePath, JSON.stringify(agent, null, 2), 'utf-8')
      this.agentCache.set(agent.id, agent)
    } catch (error) {
      logger.error(`Failed to save agent ${agent.id}:`, error as Error)
      throw error
    }
  }

  /**
   * 删除 Agent 文件
   */
  private removeAgentFile(agentId: string): void {
    try {
      const filePath = path.join(this.storagePath, `${agentId}.json`)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      this.agentCache.delete(agentId)
    } catch (error) {
      logger.error(`Failed to remove agent file ${agentId}:`, error as Error)
      throw error
    }
  }

  // ==================== CRUD 操作 ====================

  /**
   * 创建新 Agent
   */
  async createAgent(config: CreateAgentConfig): Promise<UnifiedAgentCore> {
    await this.initialize()

    const now = new Date().toISOString()
    const agent: UnifiedAgentCore = {
      id: this.generateId(),
      type: config.type || 'custom',
      name: config.name,
      displayName: config.displayName || config.name,
      avatar: config.avatar,
      emoji: config.emoji,
      description: config.description,
      tags: config.tags || [],

      systemPrompt: config.systemPrompt || '',
      personality: config.personality,
      background: config.background,
      greetingMessage: config.greetingMessage,

      modelId: config.modelId,
      modelConfig: config.modelConfig,

      memory: {
        enabled: config.memory?.enabled || false,
        diaryBookName: config.memory?.diaryBookName,
        knowledgeBaseIds: config.memory?.knowledgeBaseIds || [],
        memoryWindowSize: config.memory?.memoryWindowSize || 10,
        backends: config.memory?.backends || ['memory']
      },

      tools: {
        mcpServers: config.tools?.mcpServers || [],
        vcpPlugins: config.tools?.vcpPlugins || [],
        autoApproveAll: config.tools?.autoApproveAll || false,
        disabledAutoApproveTools: config.tools?.disabledAutoApproveTools || []
      },

      groupChat: {
        enabled: config.groupChat?.enabled || false,
        role: config.groupChat?.role || 'participant',
        expertise: config.groupChat?.expertise || [],
        triggerKeywords: config.groupChat?.triggerKeywords || [],
        priority: config.groupChat?.priority || 50,
        speakingPreferences: config.groupChat?.speakingPreferences
      },

      isActive: true,
      createdAt: now,
      updatedAt: now
    }

    this.saveAgent(agent)
    logger.info('Agent created', { id: agent.id, name: agent.name, type: agent.type })
    return agent
  }

  /**
   * 更新 Agent
   */
  async updateAgent(id: string, updates: Partial<UnifiedAgentCore>): Promise<UnifiedAgentCore> {
    await this.initialize()

    const existing = this.agentCache.get(id)
    if (!existing) {
      throw new Error(`Agent not found: ${id}`)
    }

    const updated: UnifiedAgentCore = {
      ...existing,
      ...updates,
      id: existing.id, // 防止覆盖 ID
      createdAt: existing.createdAt, // 防止覆盖创建时间
      updatedAt: new Date().toISOString()
    }

    // 合并嵌套对象
    if (updates.memory) {
      updated.memory = { ...existing.memory, ...updates.memory }
    }
    if (updates.tools) {
      updated.tools = { ...existing.tools, ...updates.tools }
    }
    if (updates.groupChat) {
      updated.groupChat = { ...existing.groupChat, ...updates.groupChat }
    }
    if (updates.modelConfig) {
      updated.modelConfig = { ...existing.modelConfig, ...updates.modelConfig }
    }

    this.saveAgent(updated)
    logger.info('Agent updated', { id, name: updated.name })
    return updated
  }

  /**
   * 删除 Agent
   */
  async deleteAgent(id: string): Promise<void> {
    await this.initialize()

    if (!this.agentCache.has(id)) {
      throw new Error(`Agent not found: ${id}`)
    }

    this.removeAgentFile(id)
    logger.info('Agent deleted', { id })
  }

  /**
   * 获取单个 Agent
   */
  async getAgent(id: string): Promise<UnifiedAgentCore | null> {
    await this.initialize()
    return this.agentCache.get(id) || null
  }

  /**
   * 列出所有 Agent（支持过滤）
   */
  async listAgents(filter?: AgentFilter): Promise<UnifiedAgentCore[]> {
    await this.initialize()

    let agents = Array.from(this.agentCache.values())

    if (filter) {
      // 按类型过滤
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type]
        agents = agents.filter((a) => types.includes(a.type))
      }

      // 按记忆功能过滤
      if (filter.hasMemory !== undefined) {
        agents = agents.filter((a) => a.memory.enabled === filter.hasMemory)
      }

      // 按工具功能过滤
      if (filter.hasTools !== undefined) {
        const hasTools = (a: UnifiedAgentCore) =>
          (a.tools.mcpServers?.length ?? 0) > 0 || (a.tools.vcpPlugins?.length ?? 0) > 0
        agents = agents.filter((a) => hasTools(a) === filter.hasTools)
      }

      // 按群聊启用过滤
      if (filter.groupChatEnabled !== undefined) {
        agents = agents.filter((a) => a.groupChat.enabled === filter.groupChatEnabled)
      }

      // 按标签过滤
      if (filter.tags && filter.tags.length > 0) {
        agents = agents.filter((a) => filter.tags!.some((t) => a.tags?.includes(t)))
      }

      // 按文本搜索
      if (filter.searchText) {
        const search = filter.searchText.toLowerCase()
        agents = agents.filter(
          (a) =>
            a.name.toLowerCase().includes(search) ||
            a.displayName.toLowerCase().includes(search) ||
            a.description?.toLowerCase().includes(search) ||
            a.systemPrompt.toLowerCase().includes(search)
        )
      }

      // 按激活状态过滤
      if (filter.isActive !== undefined) {
        agents = agents.filter((a) => a.isActive === filter.isActive)
      }
    }

    return agents
  }

  // ==================== 同步方法 ====================

  /**
   * 从 Assistant 同步创建/更新 UnifiedAgentCore
   */
  async syncFromAssistant(assistant: any): Promise<UnifiedAgentCore> {
    await this.initialize()

    const existingId = assistant.vcpAgentId || `assistant_${assistant.id}`
    const existing = this.agentCache.get(existingId)

    const agentCore: UnifiedAgentCore = {
      id: existingId,
      type: 'assistant',
      name: assistant.name,
      displayName: assistant.name,
      avatar: assistant.emoji,
      emoji: assistant.emoji,
      description: assistant.description,
      tags: assistant.tags || [],

      systemPrompt: assistant.prompt || '',
      personality: undefined,
      background: undefined,
      greetingMessage: undefined,

      modelId: assistant.model?.id,
      modelConfig: {
        temperature: assistant.settings?.temperature,
        maxOutputTokens: assistant.settings?.maxTokens
      },

      memory: {
        enabled: assistant.enableMemory || false,
        diaryBookName: assistant.vcpMemoryConfig?.diaryNameFilter,
        knowledgeBaseIds: assistant.knowledge_bases?.map((kb: any) => kb.id) || [],
        backends: assistant.vcpMemoryConfig?.backends || ['memory']
      },

      tools: {
        mcpServers: assistant.mcpServers?.map((s: any) => s.id) || [],
        autoApproveAll: assistant.vcpToolConfig?.autoApproveAll || false,
        disabledAutoApproveTools: assistant.vcpToolConfig?.disabledAutoApproveTools || []
      },

      groupChat: {
        enabled: assistant.groupChatConfig?.enabled || false,
        role: assistant.groupChatConfig?.role || 'participant',
        expertise: assistant.groupChatConfig?.expertise || [],
        triggerKeywords: assistant.groupChatConfig?.triggerKeywords || [],
        priority: assistant.groupChatConfig?.priority || 50,
        speakingPreferences: assistant.groupChatConfig?.speakingPreferences
      },

      isActive: true,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.saveAgent(agentCore)
    logger.debug('Synced from Assistant', { assistantId: assistant.id, agentId: agentCore.id })
    return agentCore
  }

  /**
   * 同步 UnifiedAgentCore 到 Assistant 格式
   */
  syncToAssistant(agent: UnifiedAgentCore): any {
    return {
      id: agent.id.replace('assistant_', ''),
      name: agent.name,
      emoji: agent.emoji,
      description: agent.description,
      tags: agent.tags,
      prompt: agent.systemPrompt,

      model: agent.modelId ? { id: agent.modelId } : undefined,
      settings: {
        temperature: agent.modelConfig?.temperature,
        maxTokens: agent.modelConfig?.maxOutputTokens
      },

      enableMemory: agent.memory.enabled,
      vcpMemoryConfig: {
        diaryNameFilter: agent.memory.diaryBookName,
        backends: agent.memory.backends
      },
      knowledge_bases: agent.memory.knowledgeBaseIds?.map((id) => ({ id })),

      mcpServers: agent.tools.mcpServers?.map((id) => ({ id })),
      vcpToolConfig: {
        autoApproveAll: agent.tools.autoApproveAll,
        disabledAutoApproveTools: agent.tools.disabledAutoApproveTools
      },

      groupChatConfig: {
        enabled: agent.groupChat.enabled,
        role: agent.groupChat.role,
        expertise: agent.groupChat.expertise,
        triggerKeywords: agent.groupChat.triggerKeywords,
        priority: agent.groupChat.priority,
        speakingPreferences: agent.groupChat.speakingPreferences
      },

      vcpAgentId: agent.id,
      vcpEnabled: true
    }
  }

  /**
   * 从 VCPAgent 同步创建/更新 UnifiedAgentCore
   */
  async syncFromVCPAgent(vcpAgent: VCPAgent): Promise<UnifiedAgentCore> {
    await this.initialize()

    const existingId = `vcp_${vcpAgent.id}`
    const existing = this.agentCache.get(existingId)

    const agentCore: UnifiedAgentCore = {
      id: existingId,
      type: 'vcp',
      name: vcpAgent.name,
      displayName: vcpAgent.displayName || vcpAgent.name,
      avatar: vcpAgent.avatar,
      emoji: undefined,
      description: vcpAgent.description,
      tags: vcpAgent.tags || [],

      systemPrompt: vcpAgent.systemPrompt || '',
      personality: vcpAgent.personality,
      background: vcpAgent.background,
      greetingMessage: vcpAgent.greetingMessage,
      exampleDialogues: vcpAgent.exampleDialogues,

      modelId: undefined,
      modelConfig: undefined,

      memory: {
        enabled: vcpAgent.vcpConfig?.enableMemory || false,
        diaryBookName: vcpAgent.vcpConfig?.diaryBookName,
        knowledgeBaseIds: vcpAgent.vcpConfig?.knowledgeBaseId ? [vcpAgent.vcpConfig.knowledgeBaseId] : [],
        backends: ['diary', 'memory']
      },

      tools: {
        mcpServers: [],
        vcpPlugins: vcpAgent.vcpConfig?.enableTools ? ['default'] : [],
        autoApproveAll: false,
        disabledAutoApproveTools: []
      },

      groupChat: {
        enabled: false,
        role: 'participant',
        expertise: [],
        triggerKeywords: [],
        priority: 50,
        speakingPreferences: undefined
      },

      isActive: vcpAgent.isActive,
      createdAt: existing?.createdAt || vcpAgent.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.saveAgent(agentCore)
    logger.debug('Synced from VCPAgent', { vcpAgentId: vcpAgent.id, agentId: agentCore.id })
    return agentCore
  }

  /**
   * 同步 UnifiedAgentCore 到 VCPAgent 格式
   */
  syncToVCPAgent(agent: UnifiedAgentCore): VCPAgent {
    return {
      id: agent.id.replace('vcp_', ''),
      name: agent.name,
      displayName: agent.displayName,
      avatar: agent.avatar,
      description: agent.description || '',
      tags: agent.tags || [],
      category: 'custom',
      version: '1.0.0',

      systemPrompt: agent.systemPrompt,
      personality: agent.personality || '',
      background: agent.background || '',
      greetingMessage: agent.greetingMessage,
      exampleDialogues: agent.exampleDialogues,

      vcpConfig: {
        enableMemory: agent.memory.enabled,
        diaryBookName: agent.memory.diaryBookName,
        enableTools: (agent.tools.vcpPlugins?.length ?? 0) > 0 ? agent.tools.vcpPlugins : undefined,
        knowledgeBaseId: agent.memory.knowledgeBaseIds?.[0]
      },

      isActive: agent.isActive,
      createdAt: new Date(agent.createdAt),
      updatedAt: new Date(agent.updatedAt)
    }
  }

  // ==================== 迁移方法 ====================

  /**
   * 迁移单个 Assistant 到 UnifiedAgent
   */
  async migrateAssistantToUnified(assistantId: string): Promise<UnifiedAgentCore> {
    try {
      const assistants = await reduxService.select<any[]>('state.assistants.entities')
      const assistant = assistants?.find((a: any) => a.id === assistantId)

      if (!assistant) {
        throw new Error(`Assistant not found: ${assistantId}`)
      }

      return await this.syncFromAssistant(assistant)
    } catch (error) {
      logger.error(`Failed to migrate assistant ${assistantId}:`, error as Error)
      throw error
    }
  }

  /**
   * 批量迁移所有 Assistant
   */
  async migrateAllAssistants(): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalAssistants: 0,
      migratedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: []
    }

    try {
      const assistants = await reduxService.select<any[]>('state.assistants.entities')

      if (!assistants || !Array.isArray(assistants)) {
        logger.warn('No assistants found for migration')
        return result
      }

      result.totalAssistants = assistants.length

      for (const assistant of assistants) {
        try {
          // 检查是否已经迁移
          const existingId = `assistant_${assistant.id}`
          if (this.agentCache.has(existingId)) {
            result.skippedCount++
            continue
          }

          await this.syncFromAssistant(assistant)
          result.migratedCount++
        } catch (error) {
          result.failedCount++
          result.errors.push({
            assistantId: assistant.id,
            error: (error as Error).message
          })
        }
      }

      logger.info('Migration completed', result)
    } catch (error) {
      logger.error('Migration failed:', error as Error)
    }

    return result
  }

  // ==================== 群聊支持 ====================

  /**
   * 获取群聊可用的 Agent 列表
   */
  async getGroupAgents(agentIds: string[]): Promise<UnifiedAgentCore[]> {
    await this.initialize()

    const agents: UnifiedAgentCore[] = []
    for (const id of agentIds) {
      const agent = this.agentCache.get(id)
      if (agent && agent.isActive && agent.groupChat.enabled) {
        agents.push(agent)
      }
    }
    return agents
  }

  // ==================== Agent 查询 ====================

  /**
   * 获取所有统一 Agent
   *
   * 合并来源:
   * 1. Redux store 中的 Assistant
   * 2. VCPAgentService 中的 VCPAgent
   */
  async getAllAgents(): Promise<UnifiedAgent[]> {
    const adapter = getUnifiedAgentAdapter()

    // 清空适配器缓存
    adapter.clear()

    // 1. 从 Redux 获取 Assistant
    try {
      const assistants = await reduxService.select<any[]>('state.assistants.entities')
      if (assistants && Array.isArray(assistants)) {
        for (const assistant of assistants) {
          if (assistant.groupChatConfig?.enabled !== false) {
            adapter.fromAssistant(assistant)
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to load assistants from Redux:', error as Error)
    }

    // 2. 从 VCPAgentService 获取 VCPAgent
    try {
      const vcpAgentService = getVCPAgentService()
      const vcpAgents = vcpAgentService.getAllAgents()
      for (const agent of vcpAgents) {
        if (agent.isActive) {
          adapter.fromVCPAgent(agent)
        }
      }
    } catch (error) {
      logger.warn('Failed to load VCP agents:', error as Error)
    }

    return adapter.getAllAgents()
  }

  /**
   * 根据 ID 获取 Agent
   */
  async getAgentById(id: string): Promise<UnifiedAgent | undefined> {
    const agents = await this.getAllAgents()
    return agents.find((a) => a.id === id)
  }

  /**
   * 根据名称获取 Agent
   */
  async getAgentByName(name: string): Promise<UnifiedAgent | undefined> {
    const agents = await this.getAllAgents()
    return agents.find((a) => a.name.toLowerCase() === name.toLowerCase())
  }

  /**
   * 根据专长查找 Agent
   */
  async findAgentsByExpertise(expertise: string): Promise<UnifiedAgent[]> {
    const agents = await this.getAllAgents()
    const lowerExpertise = expertise.toLowerCase()
    return agents.filter((a) => a.expertise.some((e) => e.toLowerCase().includes(lowerExpertise)))
  }

  /**
   * 根据关键词查找 Agent
   */
  async findAgentsByKeyword(keyword: string): Promise<UnifiedAgent[]> {
    const agents = await this.getAllAgents()
    const lowerKeyword = keyword.toLowerCase()
    return agents.filter((a) => a.keywords.some((k) => k.toLowerCase().includes(lowerKeyword)))
  }

  // ==================== Agent 消息传递 ====================

  /**
   * 发送消息到指定 Agent
   */
  async sendMessage(
    from: string,
    to: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: this.generateId(),
      fromAgentId: from,
      toAgentId: to,
      type: 'request',
      content,
      metadata,
      timestamp: Date.now()
    }

    this.messageQueue.push(message)
    this.notifyMessageListeners(message)

    logger.debug('Agent message sent', {
      from,
      to,
      messageId: message.id
    })

    return message
  }

  /**
   * 广播消息到所有 Agent
   */
  async broadcast(from: string, content: string, metadata?: Record<string, unknown>): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: this.generateId(),
      fromAgentId: from,
      toAgentId: 'broadcast',
      type: 'notification',
      content,
      metadata,
      timestamp: Date.now()
    }

    this.messageQueue.push(message)
    this.notifyMessageListeners(message)

    logger.debug('Agent broadcast sent', {
      from,
      messageId: message.id
    })

    return message
  }

  /**
   * 获取 Agent 的待处理消息
   */
  getPendingMessages(agentId: string): AgentMessage[] {
    return this.messageQueue.filter(
      (m) => (m.toAgentId === agentId || m.toAgentId === 'broadcast') && m.fromAgentId !== agentId
    )
  }

  /**
   * 确认消息已处理
   */
  acknowledgeMessage(messageId: string): boolean {
    const index = this.messageQueue.findIndex((m) => m.id === messageId)
    if (index !== -1) {
      this.messageQueue.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * 添加消息监听器
   */
  onMessage(listener: (message: AgentMessage) => void): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  // ==================== 任务委托 ====================

  /**
   * 创建任务
   */
  async createTask(
    fromAgentId: string,
    description: string,
    options: {
      targetAgentId?: string
      type?: AgentTask['type']
      context?: string
      priority?: AgentTask['priority']
    } = {}
  ): Promise<AgentTask> {
    const task: AgentTask = {
      id: this.generateId(),
      fromAgentId,
      targetAgentId: options.targetAgentId,
      type: options.type || 'query',
      description,
      context: options.context,
      priority: options.priority || 'normal',
      status: 'pending',
      createdAt: Date.now()
    }

    // 如果没有指定目标，自动选择最合适的 Agent
    if (!task.targetAgentId) {
      const bestAgent = await this.findBestAgentForTask(task)
      if (bestAgent) {
        task.assignedAgentId = bestAgent.id
        task.status = 'assigned'
      }
    } else {
      task.assignedAgentId = task.targetAgentId
      task.status = 'assigned'
    }

    this.taskQueue.push(task)
    this.notifyTaskListeners(task)

    logger.debug('Task created', {
      taskId: task.id,
      from: fromAgentId,
      assigned: task.assignedAgentId
    })

    return task
  }

  /**
   * 委托任务给其他 Agent
   */
  async delegateTask(fromAgentId: string, task: AgentTask): Promise<AgentTask> {
    // 检查发起者是否可以委托
    const fromAgent = await this.getAgentById(fromAgentId)
    if (!fromAgent?.collaboration?.canDelegate) {
      throw new Error(`Agent ${fromAgentId} is not allowed to delegate tasks`)
    }

    // 找到最合适的 Agent
    const targetAgent = await this.findBestAgentForTask(task)
    if (!targetAgent) {
      throw new Error('No suitable agent found for task delegation')
    }

    // 更新任务状态
    task.assignedAgentId = targetAgent.id
    task.status = 'assigned'

    // 发送委托消息
    await this.sendMessage(fromAgentId, targetAgent.id, `Task delegation: ${task.description}`, {
      taskId: task.id,
      type: 'delegate'
    })

    logger.debug('Task delegated', {
      taskId: task.id,
      from: fromAgentId,
      to: targetAgent.id
    })

    return task
  }

  /**
   * 完成任务
   */
  completeTask(taskId: string, result: string): boolean {
    const task = this.taskQueue.find((t) => t.id === taskId)
    if (!task) return false

    task.status = 'completed'
    task.result = result
    task.completedAt = Date.now()

    this.notifyTaskListeners(task)
    return true
  }

  /**
   * 获取 Agent 的待处理任务
   */
  getPendingTasks(agentId: string): AgentTask[] {
    return this.taskQueue.filter((t) => t.assignedAgentId === agentId && t.status === 'assigned')
  }

  /**
   * 添加任务监听器
   */
  onTask(listener: (task: AgentTask) => void): () => void {
    this.taskListeners.add(listener)
    return () => this.taskListeners.delete(listener)
  }

  /**
   * 为任务找到最合适的 Agent
   */
  private async findBestAgentForTask(task: AgentTask): Promise<UnifiedAgent | null> {
    const agents = await this.getAllAgents()

    // 过滤掉任务发起者和不能接收任务的 Agent
    const candidates = agents.filter(
      (a) => a.id !== task.fromAgentId && a.enabled && a.collaboration?.maxConcurrentTasks !== 0
    )

    if (candidates.length === 0) return null

    // 基于任务描述匹配专长
    const taskKeywords = task.description.toLowerCase().split(/\s+/)

    let bestAgent: UnifiedAgent | null = null
    let bestScore = 0

    for (const agent of candidates) {
      let score = 0

      // 专长匹配
      for (const expertise of agent.expertise) {
        const lowerExpertise = expertise.toLowerCase()
        for (const keyword of taskKeywords) {
          if (lowerExpertise.includes(keyword) || keyword.includes(lowerExpertise)) {
            score += 10
          }
        }
      }

      // 关键词匹配
      for (const kw of agent.keywords) {
        const lowerKw = kw.toLowerCase()
        for (const keyword of taskKeywords) {
          if (lowerKw.includes(keyword) || keyword.includes(lowerKw)) {
            score += 5
          }
        }
      }

      // 优先级加成
      score += agent.priority / 10

      // 角色加成
      if (agent.groupRole === 'expert') score += 20
      if (agent.groupRole === 'host') score += 10

      if (score > bestScore) {
        bestScore = score
        bestAgent = agent
      }
    }

    return bestAgent
  }

  // ==================== 群体投票 ====================

  /**
   * 发起投票
   */
  async initiateVote(
    initiatorId: string,
    topic: string,
    options: VoteOption[],
    participantIds?: string[]
  ): Promise<VoteRequest> {
    // 如果没有指定参与者，使用所有启用的 Agent
    let participants = participantIds
    if (!participants) {
      const agents = await this.getAllAgents()
      participants = agents.filter((a) => a.enabled && a.id !== initiatorId).map((a) => a.id)
    }

    const request: VoteRequest = {
      id: this.generateId(),
      topic,
      options,
      initiatorId,
      participantIds: participants,
      status: 'active',
      createdAt: Date.now()
    }

    this.activeVotes.set(request.id, request)
    this.voteResults.set(request.id, new Map())

    // 通知所有参与者
    for (const participantId of participants) {
      await this.sendMessage(initiatorId, participantId, `Vote request: ${topic}`, {
        type: 'vote',
        voteId: request.id,
        options: options.map((o) => ({ id: o.id, label: o.label }))
      })
    }

    logger.debug('Vote initiated', {
      voteId: request.id,
      topic,
      participants: participants.length
    })

    return request
  }

  /**
   * 提交投票
   */
  submitVote(voteId: string, agentId: string, optionId: string): boolean {
    const request = this.activeVotes.get(voteId)
    if (!request || request.status !== 'active') return false

    if (!request.participantIds.includes(agentId)) return false

    const votes = this.voteResults.get(voteId)
    if (!votes) return false

    votes.set(agentId, optionId)

    // 检查是否所有人都已投票
    if (votes.size >= request.participantIds.length) {
      this.completeVote(voteId)
    }

    return true
  }

  /**
   * 完成投票并计算结果
   */
  private completeVote(voteId: string): VoteResult | null {
    const request = this.activeVotes.get(voteId)
    const votes = this.voteResults.get(voteId)

    if (!request || !votes) return null

    // 计算票数
    const optionCounts = new Map<string, number>()
    for (const optionId of votes.values()) {
      optionCounts.set(optionId, (optionCounts.get(optionId) || 0) + 1)
    }

    // 找出获胜选项
    let maxCount = 0
    let winnerId: string | undefined

    for (const [optionId, count] of optionCounts) {
      if (count > maxCount) {
        maxCount = count
        winnerId = optionId
      }
    }

    const winner = winnerId ? request.options.find((o) => o.id === winnerId) : undefined

    request.status = 'completed'

    const result: VoteResult = {
      requestId: voteId,
      votes,
      winner,
      totalVotes: votes.size,
      completedAt: Date.now()
    }

    logger.debug('Vote completed', {
      voteId,
      winner: winner?.label,
      totalVotes: result.totalVotes
    })

    return result
  }

  /**
   * 获取投票状态
   */
  getVoteStatus(voteId: string): { request: VoteRequest; votedCount: number } | null {
    const request = this.activeVotes.get(voteId)
    const votes = this.voteResults.get(voteId)

    if (!request || !votes) return null

    return {
      request,
      votedCount: votes.size
    }
  }

  // ==================== 工具方法 ====================

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  private notifyMessageListeners(message: AgentMessage): void {
    for (const listener of this.messageListeners) {
      try {
        listener(message)
      } catch (error) {
        logger.warn('Message listener error:', error as Error)
      }
    }
  }

  private notifyTaskListeners(task: AgentTask): void {
    for (const listener of this.taskListeners) {
      try {
        listener(task)
      } catch (error) {
        logger.warn('Task listener error:', error as Error)
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.messageQueue = []
    this.taskQueue = []
    this.activeVotes.clear()
    this.voteResults.clear()
    this.messageListeners.clear()
    this.taskListeners.clear()
  }
}

// ==================== 导出 ====================

let serviceInstance: UnifiedAgentService | null = null

export function getUnifiedAgentService(): UnifiedAgentService {
  if (!serviceInstance) {
    serviceInstance = UnifiedAgentService.getInstance()
  }
  return serviceInstance
}

export { type UnifiedAgent }
