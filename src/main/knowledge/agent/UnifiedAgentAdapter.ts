/**
 * UnifiedAgentAdapter - 统一 Agent 适配器
 *
 * 桥接 Cherry Studio Assistant 和群聊/协作系统
 *
 * @version 3.0.0 - 完全统一，无旧字段
 */

import { loggerService } from '@logger'

import type { AgentRole, GroupAgent } from './GroupChatOrchestrator'

const logger = loggerService.withContext('UnifiedAgentAdapter')

// ==================== 类型定义 ====================

type ToneStyle = 'formal' | 'casual' | 'playful' | 'professional'
type ResponseStyle = 'concise' | 'detailed' | 'adaptive'
type MemoryBackend = 'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'knowledge' | 'memory'

interface AssistantProfile {
  personality?: string
  background?: string
  greetingMessage?: string
  exampleDialogues?: Array<{ user: string; assistant: string }>
  tone?: ToneStyle
  traits?: string[]
}

interface AssistantMemory {
  enabled: boolean
  enableUnifiedSearch?: boolean
  tagBoost?: number
  useRRF?: boolean
  diaryBookName?: string
  backends?: MemoryBackend[]
  topK?: number
  windowSize?: number
}

interface AssistantTools {
  mcpServers?: unknown[]
  vcpPlugins?: string[]
  autoApproveAll?: boolean
  disabledTools?: string[]
  enableWebSearch?: boolean
  webSearchProviderId?: string
  enableUrlContext?: boolean
  enableGenerateImage?: boolean
}

interface SpeakingPreferences {
  maxResponseLength?: number
  preferredTopics?: string[]
  avoidTopics?: string[]
}

interface AssistantGroupChat {
  enabled: boolean
  role: AgentRole
  expertise: string[]
  triggerKeywords: string[]
  priority: number
  speakingPreferences?: SpeakingPreferences
}

interface AssistantCollaboration {
  canInitiate?: boolean
  canDelegate?: boolean
  maxConcurrentTasks?: number
  responseStyle?: ResponseStyle
  allowedAgents?: string[]
  blockedAgents?: string[]
  messagePrefix?: string
}

interface AssistantVCPConfig {
  knowledgeBaseId?: string
  knowledgeBaseName?: string
  contextInjections?: string[]
}

/**
 * 统一 Agent 接口
 */
export interface UnifiedAgent {
  id: string
  type: 'assistant' | 'vcp' | 'claude-code' | 'custom'
  name: string
  displayName: string
  avatar?: string
  description?: string

  /** 系统提示词 */
  systemPrompt: string
  /** 专长领域 */
  expertise: string[]
  /** 触发关键词 */
  keywords: string[]

  /** 群聊角色 */
  groupRole: AgentRole
  /** 优先级 */
  priority: number

  /** 关联的模型ID */
  modelId?: string
  /** 是否启用 */
  enabled: boolean

  /** 原始对象引用 */
  originalRef?: unknown

  /** 人格配置 */
  profile?: AssistantProfile
  /** 记忆配置 */
  memory?: AssistantMemory
  /** 工具配置 */
  tools?: AssistantTools
  /** 群聊配置 */
  groupChat?: AssistantGroupChat
  /** 协作配置 */
  collaboration?: AssistantCollaboration
  /** VCP 特有配置 */
  vcpConfig?: AssistantVCPConfig
}

/**
 * Cherry Studio Assistant 类型 (简化版)
 */
interface AssistantLike {
  id: string
  name: string
  displayName?: string
  prompt: string
  emoji?: string
  description?: string
  model?: { id: string }
  tags?: string[]
  category?: string

  profile?: AssistantProfile
  memory?: AssistantMemory
  tools?: AssistantTools
  groupChat?: AssistantGroupChat
  collaboration?: AssistantCollaboration
  vcpConfig?: AssistantVCPConfig

  knowledge_bases?: Array<{ id: string; name?: string }>
}

/**
 * VCPAgent 类型 (简化版)
 */
interface VCPAgentLike {
  id: string
  name: string
  displayName: string
  avatar?: string
  description: string
  personality: string
  systemPrompt: string
  tags: string[]
  isActive: boolean
}

/**
 * 适配器配置
 */
export interface AdapterConfig {
  defaultGroupRole?: AgentRole
  defaultPriority?: number
  autoExtractKeywords?: boolean
}

/**
 * 统一 Agent 适配器
 */
export class UnifiedAgentAdapter {
  private agents: Map<string, UnifiedAgent> = new Map()
  private config: Required<AdapterConfig>

  constructor(config: AdapterConfig = {}) {
    this.config = {
      defaultGroupRole: config.defaultGroupRole ?? 'participant',
      defaultPriority: config.defaultPriority ?? 50,
      autoExtractKeywords: config.autoExtractKeywords ?? true
    }
  }

  /**
   * 从 Assistant 适配
   */
  fromAssistant(assistant: AssistantLike): UnifiedAgent {
    const knowledgeBaseId = assistant.knowledge_bases?.[0]?.id

    const agent: UnifiedAgent = {
      id: assistant.id,
      type: 'assistant',
      name: assistant.name,
      displayName: assistant.displayName || assistant.name,
      avatar: assistant.emoji,
      description: assistant.description,
      systemPrompt: assistant.prompt,

      expertise: assistant.groupChat?.expertise?.length
        ? assistant.groupChat.expertise
        : this.extractExpertise(assistant.prompt, assistant.tags),

      keywords: assistant.groupChat?.triggerKeywords?.length
        ? assistant.groupChat.triggerKeywords
        : this.extractKeywords(assistant.prompt, assistant.name),

      groupRole: assistant.groupChat?.role || this.config.defaultGroupRole,
      priority: assistant.groupChat?.priority ?? this.config.defaultPriority,

      modelId: assistant.model?.id,
      enabled: assistant.groupChat?.enabled !== false,
      originalRef: assistant,

      profile: assistant.profile,
      memory: assistant.memory,
      tools: assistant.tools,
      groupChat: assistant.groupChat,
      collaboration: assistant.collaboration,
      vcpConfig: assistant.vcpConfig || (knowledgeBaseId ? { knowledgeBaseId } : undefined)
    }

    this.agents.set(agent.id, agent)
    logger.debug('Adapted Assistant', {
      id: agent.id,
      name: agent.name,
      role: agent.groupRole,
      priority: agent.priority
    })

    return agent
  }

  /**
   * 从 VCPAgent 适配
   */
  fromVCPAgent(vcpAgent: VCPAgentLike): UnifiedAgent {
    const agent: UnifiedAgent = {
      id: vcpAgent.id,
      type: 'vcp',
      name: vcpAgent.name,
      displayName: vcpAgent.displayName,
      avatar: vcpAgent.avatar,
      description: vcpAgent.description,
      systemPrompt: vcpAgent.systemPrompt,
      expertise: this.extractExpertise(vcpAgent.systemPrompt, vcpAgent.tags),
      keywords: this.extractKeywords(vcpAgent.systemPrompt, vcpAgent.name),
      groupRole: this.inferGroupRole(vcpAgent),
      priority: this.inferPriority(vcpAgent),
      enabled: vcpAgent.isActive,
      originalRef: vcpAgent,
      profile: {
        personality: vcpAgent.personality
      },
      collaboration: {
        canInitiate: true,
        canDelegate: true,
        maxConcurrentTasks: 5,
        responseStyle: 'detailed'
      }
    }

    this.agents.set(agent.id, agent)
    logger.debug('Adapted VCPAgent', { id: agent.id, name: agent.name })

    return agent
  }

  /**
   * 从自定义配置创建
   */
  createCustomAgent(config: {
    id?: string
    name: string
    displayName?: string
    systemPrompt: string
    expertise?: string[]
    keywords?: string[]
    groupRole?: AgentRole
    modelId?: string
  }): UnifiedAgent {
    const agent: UnifiedAgent = {
      id: config.id || `custom_${Date.now()}`,
      type: 'custom',
      name: config.name,
      displayName: config.displayName || config.name,
      systemPrompt: config.systemPrompt,
      expertise: config.expertise || this.extractExpertise(config.systemPrompt, []),
      keywords: config.keywords || this.extractKeywords(config.systemPrompt, config.name),
      groupRole: config.groupRole || this.config.defaultGroupRole,
      priority: this.config.defaultPriority,
      modelId: config.modelId,
      enabled: true,
      collaboration: {
        canInitiate: true,
        canDelegate: false,
        maxConcurrentTasks: 3,
        responseStyle: 'adaptive'
      }
    }

    this.agents.set(agent.id, agent)
    logger.debug('Created custom agent', { id: agent.id, name: agent.name })

    return agent
  }

  /**
   * 转换为 GroupAgent (用于群聊)
   */
  toGroupAgent(agent: UnifiedAgent): GroupAgent {
    return {
      id: agent.id,
      name: agent.name,
      displayName: agent.displayName,
      avatar: agent.avatar,
      role: agent.groupRole,
      expertise: agent.expertise,
      triggerKeywords: agent.keywords,
      systemPrompt: agent.systemPrompt,
      status: agent.enabled ? 'idle' : 'offline',
      priority: agent.priority,
      speakCount: 0,
      visibleMessageIds: []
    }
  }

  /**
   * 批量转换为 GroupAgent
   */
  toGroupAgents(agentIds?: string[]): GroupAgent[] {
    const agents = agentIds
      ? agentIds.map((id) => this.agents.get(id)).filter((a): a is UnifiedAgent => a !== undefined)
      : Array.from(this.agents.values())

    return agents.filter((a) => a.enabled).map((a) => this.toGroupAgent(a))
  }

  /**
   * 获取 Agent
   */
  getAgent(id: string): UnifiedAgent | undefined {
    return this.agents.get(id)
  }

  /**
   * 获取所有 Agent
   */
  getAllAgents(): UnifiedAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * 按专长查找
   */
  findByExpertise(expertise: string): UnifiedAgent[] {
    const lowerExpertise = expertise.toLowerCase()
    return Array.from(this.agents.values()).filter((a) =>
      a.expertise.some((e) => e.toLowerCase().includes(lowerExpertise))
    )
  }

  /**
   * 按关键词查找
   */
  findByKeyword(keyword: string): UnifiedAgent[] {
    const lowerKeyword = keyword.toLowerCase()
    return Array.from(this.agents.values()).filter((a) =>
      a.keywords.some((k) => k.toLowerCase().includes(lowerKeyword))
    )
  }

  /**
   * 按类型查找
   */
  findByType(type: UnifiedAgent['type']): UnifiedAgent[] {
    return Array.from(this.agents.values()).filter((a) => a.type === type)
  }

  /**
   * 移除 Agent
   */
  removeAgent(id: string): boolean {
    return this.agents.delete(id)
  }

  /**
   * 清空所有
   */
  clear(): void {
    this.agents.clear()
  }

  /**
   * 提取专长领域
   */
  private extractExpertise(prompt: string, tags: string[] = []): string[] {
    const expertise = new Set<string>(tags)

    const patterns = [
      /专(?:门|业|长于?|注于?)(.{2,10})/g,
      /擅长(.{2,10})/g,
      /expert in (.{2,20})/gi,
      /specialized in (.{2,20})/gi,
      /focus on (.{2,20})/gi
    ]

    for (const pattern of patterns) {
      const matches = prompt.matchAll(pattern)
      for (const match of matches) {
        expertise.add(match[1].trim())
      }
    }

    return Array.from(expertise).slice(0, 10)
  }

  /**
   * 提取关键词
   */
  private extractKeywords(prompt: string, name: string): string[] {
    const keywords = new Set<string>([name.toLowerCase()])

    const chineseWords = prompt.match(/[\u4e00-\u9fff]{2,4}/g) || []
    for (const word of chineseWords.slice(0, 20)) {
      keywords.add(word)
    }

    const englishWords = prompt.match(/\b[a-zA-Z]{4,}\b/g) || []
    for (const word of englishWords.slice(0, 10)) {
      keywords.add(word.toLowerCase())
    }

    return Array.from(keywords).slice(0, 15)
  }

  /**
   * 推断群聊角色
   */
  private inferGroupRole(agent: VCPAgentLike): AgentRole {
    const prompt = agent.systemPrompt.toLowerCase()
    const desc = agent.description.toLowerCase()

    if (prompt.includes('主持') || prompt.includes('host') || desc.includes('主持')) {
      return 'host'
    }
    if (prompt.includes('专家') || prompt.includes('expert') || desc.includes('专家')) {
      return 'expert'
    }
    if (prompt.includes('协调') || prompt.includes('moderator') || desc.includes('协调')) {
      return 'moderator'
    }
    if (prompt.includes('观察') || prompt.includes('observer') || desc.includes('观察')) {
      return 'observer'
    }

    return 'participant'
  }

  /**
   * 推断优先级
   */
  private inferPriority(agent: VCPAgentLike): number {
    let priority = 50

    if (agent.systemPrompt.includes('主持') || agent.systemPrompt.includes('host')) {
      priority = 90
    } else if (agent.systemPrompt.includes('专家') || agent.systemPrompt.includes('expert')) {
      priority = 70
    } else if (agent.systemPrompt.includes('协调') || agent.systemPrompt.includes('moderator')) {
      priority = 80
    }

    return priority
  }
}

// 单例
let _instance: UnifiedAgentAdapter | null = null

export function getUnifiedAgentAdapter(): UnifiedAgentAdapter {
  if (!_instance) {
    _instance = new UnifiedAgentAdapter()
  }
  return _instance
}

export function createUnifiedAgentAdapter(config?: AdapterConfig): UnifiedAgentAdapter {
  return new UnifiedAgentAdapter(config)
}
