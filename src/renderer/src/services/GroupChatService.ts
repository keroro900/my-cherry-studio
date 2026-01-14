/**
 * GroupChatService - 群聊服务 (Renderer)
 *
 * 提供群聊功能的前端服务封装
 * 连接到主进程的 GroupChatOrchestrator
 */

import { loggerService } from '@logger'
import { groupChatPersistence } from './GroupChatPersistenceService'

const logger = loggerService.withContext('GroupChatService')

/**
 * 检查 GroupChat API 是否可用
 */
function getGroupChatApi() {
  if (typeof window === 'undefined') {
    throw new Error('GroupChatService can only be used in browser environment')
  }

  if (!window.api) {
    throw new Error('window.api is not available. Preload script may not have loaded correctly.')
  }

  if (!window.api.groupChat) {
    throw new Error('window.api.groupChat is not available. Please restart the application to reload preload scripts.')
  }

  return window.api.groupChat
}

/**
 * 发言模式
 */
export type SpeakingMode =
  | 'sequential'
  | 'random'
  | 'naturerandom' // VCP风格智能选择
  | 'invitation'
  | 'mention'
  | 'keyword'
  | 'consensus'

/**
 * Agent 角色
 */
export type AgentRole = 'host' | 'participant' | 'observer' | 'expert' | 'moderator'

/**
 * 群聊配置
 */
export interface GroupChatConfig {
  id?: string
  name?: string
  speakingMode?: SpeakingMode
  hostAgentId?: string
  maxRounds?: number
  maxSpeakersPerRound?: number
  speakingCooldown?: number
  allowFreeDiscussion?: boolean
  requireConsensus?: boolean
  consensusThreshold?: number
  timeout?: number
  showThinking?: boolean
  contextSharing?: 'full' | 'partial' | 'isolated'
  // VCPChat 功能融合 - Phase 7.2
  /** 群组共同背景/提示词 */
  groupPrompt?: string
  /** 是否使用统一模型（所有成员使用同一模型） */
  useUnifiedModel?: boolean
  /** 统一模型 ID（当 useUnifiedModel 为 true 时生效） */
  unifiedModel?: string
  /** 成员标签映射（agentId -> tags[]，用于自然随机模式权重） */
  memberTags?: Record<string, string[]>
  /** 邀请提示词模板（支持 {{VCPChatAgentName}} 占位符） */
  invitePromptTemplate?: string
  /** 是否启用上下文净化（将 HTML 转换为 Markdown 以减少 token 用量） */
  enableContextSanitizer?: boolean
  /** 上下文净化起始深度（默认 2，从第2条消息开始净化） */
  contextSanitizerDepth?: number
}

/**
 * 群聊 Agent
 */
export interface GroupAgent {
  id: string
  name: string
  displayName: string
  avatar?: string
  role: AgentRole
  expertise: string[]
  triggerKeywords: string[]
  systemPrompt: string
  status: 'active' | 'idle' | 'thinking' | 'speaking' | 'offline'
  priority: number
  lastSpoken?: Date
  speakCount: number
  visibleMessageIds: string[]
  /** 成员标签（用于自然随机模式权重计算） */
  tags?: string[]
}

/**
 * 群聊消息
 */
export interface GroupMessage {
  id: string
  agentId: string
  agentName: string
  content: string
  timestamp: Date | string
  type: 'chat' | 'system' | 'action' | 'thought' | 'summary'
  mentions: string[]
  replyTo?: string
  isPublic: boolean
  visibleTo?: string[]
  metadata?: Record<string, unknown>
}

/**
 * 发言决策
 */
export interface SpeakingDecision {
  shouldSpeak: boolean
  agentId: string
  reason: string
  priority: number
  suggestedAction?: 'respond' | 'ask' | 'summarize' | 'delegate' | 'conclude'
}

/**
 * 群聊事件
 */
export interface GroupChatEvent {
  sessionId: string
  type:
    | 'chat:start'
    | 'chat:end'
    | 'agent:join'
    | 'agent:leave'
    | 'agent:speak'
    | 'agent:thinking'
    | 'agent:stream'
    | 'round:start'
    | 'round:end'
    | 'consensus:reached'
    | 'conflict:detected'
    | 'timeout'
    | 'topic:updated' // 话题标题更新事件
  // 事件特定数据
  config?: GroupChatConfig
  summary?: string
  agent?: GroupAgent
  agentId?: string
  message?: GroupMessage
  round?: number
  decision?: string
  agents?: string[]
  topic?: string
  reason?: string
  // 流式输出相关
  messageId?: string
  chunk?: string
  accumulatedContent?: string
}

/**
 * 会话信息
 */
export interface SessionInfo {
  id: string
  name: string
  isActive: boolean
  agentCount: number
  messageCount: number
}

/**
 * 统一 Agent
 */
export interface UnifiedAgent {
  id: string
  type: 'assistant' | 'vcp' | 'claude-code' | 'custom'
  name: string
  displayName: string
  avatar?: string
  description?: string
  systemPrompt: string
  expertise: string[]
  keywords: string[]
  groupRole: AgentRole
  priority: number
  modelId?: string
  enabled: boolean
  originalRef?: unknown
  vcpConfig?: {
    enableDiary?: boolean
    diaryBookName?: string
    enableMemory?: boolean
    enableTools?: string[]
  }
  collaborationConfig?: {
    canInitiate: boolean
    canDelegate: boolean
    maxConcurrentTasks: number
    responseStyle: 'concise' | 'detailed' | 'adaptive'
  }
}

/**
 * 群聊服务
 */
class GroupChatService {
  private static instance: GroupChatService | null = null
  private eventListeners: Set<(event: GroupChatEvent) => void> = new Set()
  private unsubscribe?: () => void

  private constructor() {
    this.setupEventListener()
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): GroupChatService {
    if (!GroupChatService.instance) {
      GroupChatService.instance = new GroupChatService()
    }
    return GroupChatService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListener(): void {
    try {
      const api = getGroupChatApi()
      if (api.onEvent) {
        this.unsubscribe = api.onEvent((event: GroupChatEvent) => {
          this.notifyListeners(event)
        })
        logger.info('GroupChat event listener set up')
      }
    } catch (error) {
      // API not available yet, will be set up later when app is ready
      logger.debug('GroupChat API not available during initialization, event listener not set up')
    }
  }

  /**
   * 创建群聊会话
   */
  async createSession(config?: GroupChatConfig): Promise<{ sessionId: string; config: GroupChatConfig }> {
    logger.info('Creating group chat session', config)
    const api = getGroupChatApi()
    const result = await api.create(config)
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as { sessionId: string; config: GroupChatConfig }
  }

  /**
   * 添加 Agent 到群聊
   */
  async addAgent(
    sessionId: string,
    agent: Omit<GroupAgent, 'status' | 'speakCount' | 'visibleMessageIds'>
  ): Promise<void> {
    const api = getGroupChatApi()
    // IPC API 期望 lastSpoken 为 string（用于序列化），需要转换 Date 类型
    const serializedAgent = {
      ...agent,
      lastSpoken: agent.lastSpoken instanceof Date ? agent.lastSpoken.toISOString() : agent.lastSpoken
    }
    const result = await api.addAgent({ sessionId, agent: serializedAgent })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
  }

  /**
   * 从统一 Agent 添加
   */
  async addUnifiedAgent(sessionId: string, agentId: string): Promise<{ success: boolean; agent: GroupAgent }> {
    const api = getGroupChatApi()
    const result = await api.addUnifiedAgent({ sessionId, agentId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as { success: boolean; agent: GroupAgent }
  }

  /**
   * 批量添加 Agents
   */
  async addAgents(sessionId: string, agentIds: string[]): Promise<{ success: boolean; added: GroupAgent[] }> {
    const api = getGroupChatApi()
    const result = await api.addAgents({ sessionId, agentIds })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as { success: boolean; added: GroupAgent[] }
  }

  /**
   * 移除 Agent
   */
  async removeAgent(sessionId: string, agentId: string): Promise<void> {
    const api = getGroupChatApi()
    const result = await api.removeAgent({ sessionId, agentId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
  }

  /**
   * 开始群聊
   */
  async start(sessionId: string, topic?: string): Promise<void> {
    logger.info('Starting group chat', { sessionId, topic })
    const api = getGroupChatApi()
    const result = await api.start({ sessionId, topic })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
  }

  /**
   * 结束群聊
   */
  async end(sessionId: string): Promise<{ summary: string; messageCount: number }> {
    logger.info('Ending group chat', { sessionId })
    const api = getGroupChatApi()
    const result = await api.end({ sessionId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as { summary: string; messageCount: number }
  }

  /**
   * 处理用户输入
   */
  async handleUserInput(
    sessionId: string,
    content: string,
    userId?: string
  ): Promise<{ decisions: SpeakingDecision[] }> {
    const api = getGroupChatApi()
    const result = await api.handleUserInput({ sessionId, content, userId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as { decisions: SpeakingDecision[] }
  }

  /**
   * 请求 Agent 发言
   */
  async requestSpeak(sessionId: string, agentId: string, context: string): Promise<{ message: GroupMessage | null }> {
    const api = getGroupChatApi()
    const result = await api.requestSpeak({ sessionId, agentId, context })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as { message: GroupMessage | null }
  }

  /**
   * 获取会话状态
   */
  async getState(sessionId: string): Promise<{
    config: GroupChatConfig
    agents: GroupAgent[]
    messages: GroupMessage[]
    currentRound: number
    isActive: boolean
    topic?: string
  }> {
    const api = getGroupChatApi()
    const result = await api.getState({ sessionId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    // IPC 返回的类型与本地类型兼容，进行类型断言
    return result as {
      config: GroupChatConfig
      agents: GroupAgent[]
      messages: GroupMessage[]
      currentRound: number
      isActive: boolean
      topic?: string
    }
  }

  /**
   * 获取消息历史
   */
  async getMessages(sessionId: string): Promise<GroupMessage[]> {
    const api = getGroupChatApi()
    const result = await api.getMessages({ sessionId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as GroupMessage[]
  }

  /**
   * 获取 Agents 列表
   */
  async getAgents(sessionId: string): Promise<GroupAgent[]> {
    const api = getGroupChatApi()
    const result = await api.getAgents({ sessionId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as GroupAgent[]
  }

  /**
   * 销毁会话
   */
  async destroy(sessionId: string): Promise<void> {
    const api = getGroupChatApi()
    const result = await api.destroy({ sessionId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
  }

  /**
   * 获取活跃会话列表
   */
  async listSessions(): Promise<SessionInfo[]> {
    const api = getGroupChatApi()
    const result = await api.listSessions()
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as SessionInfo[]
  }

  /**
   * 适配 Assistant 为 UnifiedAgent
   */
  async adaptAssistant(assistant: {
    id: string
    name: string
    prompt: string
    emoji?: string
    description?: string
    model?: { id: string }
    tags?: string[]
    enableMemory?: boolean
  }): Promise<UnifiedAgent> {
    const api = getGroupChatApi()
    const result = await api.adaptAssistant({ assistant })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as UnifiedAgent
  }

  /**
   * 获取所有 UnifiedAgents
   */
  async getUnifiedAgents(): Promise<UnifiedAgent[]> {
    const api = getGroupChatApi()
    const result = await api.getUnifiedAgents()
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as UnifiedAgent[]
  }

  /**
   * 订阅事件
   */
  subscribe(listener: (event: GroupChatEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  /**
   * 通知监听器
   */
  private notifyListeners(event: GroupChatEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        logger.error('Event listener error', error as Error)
      }
    }
  }

  /**
   * 发送事件（供外部使用，如 Coordinator）
   */
  emitEvent(event: GroupChatEvent): void {
    logger.info('Emitting event', {
      type: event.type,
      sessionId: event.sessionId,
      listenerCount: this.eventListeners.size
    })
    this.notifyListeners(event)
  }

  /**
   * 中断正在进行的请求
   * @param sessionId 会话 ID
   * @param agentId 可选，指定要中断的 Agent ID
   */
  async interrupt(sessionId: string, agentId?: string): Promise<void> {
    logger.info('Interrupting group chat', { sessionId, agentId })
    const api = getGroupChatApi()
    const result = await api.interrupt({ sessionId, agentId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
  }

  /**
   * 更新会话信息
   * @param sessionId 会话 ID
   * @param updates 要更新的字段
   */
  async updateSession(sessionId: string, updates: { name?: string; topic?: string }): Promise<void> {
    logger.info('Updating session', { sessionId, updates })
    try {
      const session = await groupChatPersistence.loadSession(sessionId)
      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }
      const updatedSession = {
        ...session,
        ...updates,
        updatedAt: new Date()
      }
      await groupChatPersistence.saveSession(updatedSession)
      logger.info('Session updated', { sessionId })
    } catch (error) {
      logger.error('Failed to update session', error as Error, { sessionId })
      throw error
    }
  }

  /**
   * 清空会话消息
   * @param sessionId 会话 ID
   */
  async clearMessages(sessionId: string): Promise<void> {
    logger.info('Clearing messages', { sessionId })
    try {
      await groupChatPersistence.deleteMessages(sessionId)
      logger.info('Messages cleared', { sessionId })
    } catch (error) {
      logger.error('Failed to clear messages', error as Error, { sessionId })
      throw error
    }
  }

  /**
   * 重新回复消息
   * @param sessionId 会话 ID
   * @param messageId 要重新回复的消息 ID
   * @param agentId 要重新回复的 Agent ID
   */
  async redoMessage(sessionId: string, messageId: string, agentId: string): Promise<{ message: GroupMessage | null }> {
    logger.info('Redo message', { sessionId, messageId, agentId })
    const api = getGroupChatApi()
    const result = await api.redoMessage({ sessionId, messageId, agentId })
    if (result && 'error' in result) {
      throw new Error(result.error)
    }
    return result as { message: GroupMessage | null }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    this.eventListeners.clear()
    GroupChatService.instance = null
  }
}

// 导出服务实例
export const groupChatService = GroupChatService.getInstance()

// 导出工厂函数
export function getGroupChatService(): GroupChatService {
  return GroupChatService.getInstance()
}
