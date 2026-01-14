/**
 * GroupChatCoordinator - 群聊协调器 (Renderer)
 *
 * 在渲染进程中协调多 Agent 对话：
 * 1. 管理 Agent 发言顺序和决策
 * 2. 调用 GroupAgentRunner 执行 AI 请求
 * 3. 处理任务确认流程
 * 4. 同步状态到主进程
 * 5. 持久化消息到 IndexedDB
 * 6. 支持 AI 主动调用其他 Agent（Agent 协同）
 */

import { loggerService } from '@logger'
import {
  groupChatPersistence,
  type GroupMessage as PersistentMessage
} from '@renderer/services/GroupChatPersistenceService'
import store from '@renderer/store'
import type { Assistant, FileMetadata, Model, Provider } from '@renderer/types'
import { v4 as uuidv4 } from 'uuid'

import {
  type AgentInvocationContext,
  createAgentInvocationToolDefinition,
  executeAgentInvocation,
  formatAgentInvocationResult
} from './AgentInvocationTool'
import { contextSanitizerService } from './ContextSanitizerService'
import type { GroupAgentRunner } from './GroupAgentRunner'
import { type AgentRunConfig, getGroupAgentRunner, type TaskConfirmation } from './GroupAgentRunner'
import { type GroupAgent, type GroupChatEvent, groupChatService, type GroupMessage } from './GroupChatService'
import { getTopicSummaryService } from './TopicSummaryService'

const logger = loggerService.withContext('GroupChatCoordinator')

/**
 * Agent 配置（扩展 GroupAgent）
 */
export interface AgentConfig extends GroupAgent {
  /** 关联的 Assistant */
  assistant: Assistant
  /** Provider */
  provider: Provider
  /** 是否启用 Agent 协同（可以调用其他 Agent） */
  enableAgentInvocation?: boolean
}

/**
 * 任务确认选项
 */
export interface TaskConfirmationOptions {
  /** 是否自动确认 */
  autoConfirm?: boolean
  /** 确认超时（毫秒） */
  timeout?: number
  /** 确认回调 */
  onConfirmRequest?: (confirmation: TaskConfirmation) => Promise<boolean>
}

/**
 * 协调器配置
 */
export interface CoordinatorConfig {
  /** 会话 ID */
  sessionId: string
  /** 任务确认选项 */
  taskConfirmation?: TaskConfirmationOptions
  /** 消息回调 */
  onMessage?: (message: GroupMessage) => void
  /** Agent 状态变化回调 */
  onAgentStatusChange?: (agentId: string, status: GroupAgent['status']) => void
  /** 错误回调 */
  onError?: (error: Error, agentId?: string) => void
  /** 是否启用 Agent 协同（AI 主动调用其他 Agent） */
  enableAgentInvocation?: boolean

  // === VCP 风格配置 ===
  /** 群组设定 - 为整个群聊定义共同的背景、规则或系统级指令 */
  groupPrompt?: string
  /** 发言邀请模板 - 支持 {{VCPChatAgentName}} 占位符 */
  invitePromptTemplate?: string

  // === VCPChat 功能融合 - Phase 7.2 ===
  /** 是否使用统一模型（所有成员使用同一模型） */
  useUnifiedModel?: boolean
  /** 统一模型 ID（当 useUnifiedModel 为 true 时生效） */
  unifiedModel?: string
  /** 成员标签映射（agentId -> tags[]，用于自然随机模式权重） */
  memberTags?: Record<string, string[]>

  // === 心流锁模式配置 ===
  /** 是否启用心流锁模式（AI 主动发言） */
  enableFlowLock?: boolean
  /** AI 主动发言的冷却时间（毫秒） */
  flowLockCooldown?: number
  /** AI 主动发言的触发提示词 */
  flowLockTriggerPrompt?: string
  /** AI 主动发言回调 */
  onFlowLockTrigger?: (agentId: string, message: string) => void

  // === 话题自动总结配置 ===
  /** 当前话题名称（用于判断是否需要自动总结） */
  topicName?: string
  /** 话题更新回调 */
  onTopicUpdated?: (newTopicName: string) => void

  // === 上下文净化配置（VCPChat contextSanitizer） ===
  /** 是否启用上下文净化（将 HTML 转换为 Markdown 以减少 token 用量） */
  enableContextSanitizer?: boolean
  /** 上下文净化起始深度（默认 2，从第2条消息开始净化） */
  contextSanitizerDepth?: number
}

/**
 * 群聊协调器
 */
export class GroupChatCoordinator {
  private sessionId: string
  private agents: Map<string, AgentConfig> = new Map()
  private messageHistory: GroupMessage[] = []
  private agentRunner: GroupAgentRunner
  private config: CoordinatorConfig
  private isActive: boolean = false
  private pendingConfirmations: Map<string, { resolve: (v: boolean) => void; reject: (e: Error) => void }> = new Map()
  /** 最大嵌套调用深度，防止无限循环 */
  private static readonly MAX_DELEGATION_DEPTH = 3
  /** 当前调用深度 */
  private currentDelegationDepth: number = 0
  /** 初始化状态 */
  private initialized: boolean = false
  /** 初始化Promise，用于等待初始化完成 */
  private initPromise: Promise<void>
  /** 取消订阅函数 */
  private unsubscribe?: () => void

  // === 心流锁模式状态 ===
  /** 心流锁是否激活 */
  private flowLockActive: boolean = false
  /** 上次 AI 主动发言时间 */
  private lastFlowLockSpeakTime: number = 0
  /** 心流锁定时器 */
  private flowLockTimer?: ReturnType<typeof setTimeout>

  constructor(config: CoordinatorConfig) {
    this.sessionId = config.sessionId
    this.config = config
    this.agentRunner = getGroupAgentRunner()

    // 设置任务确认回调
    if (!config.taskConfirmation?.autoConfirm) {
      this.agentRunner.setTaskConfirmationCallback(this.handleTaskConfirmation.bind(this))
    }

    // 订阅群聊服务事件
    this.unsubscribe = groupChatService.subscribe(this.handleGroupChatEvent.bind(this))

    // 初始化并保存 Promise 供外部等待
    this.initPromise = this.initialize()
  }

  /**
   * 初始化协调器
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadMessageHistory()
      this.initialized = true
      logger.info('Coordinator initialized', { sessionId: this.sessionId, isActive: this.isActive })
    } catch (error) {
      logger.error('Failed to initialize coordinator', error as Error)
      // 即使初始化失败也标记为已初始化，避免无限等待
      this.initialized = true
    }
  }

  /**
   * 等待初始化完成
   */
  async waitForInit(): Promise<void> {
    if (this.initialized) return
    await this.initPromise
  }

  /**
   * 从数据库加载历史消息和会话状态
   */
  async loadMessageHistory(): Promise<void> {
    try {
      // 加载历史消息
      const messages = await groupChatPersistence.loadMessages(this.sessionId)
      if (messages.length > 0) {
        this.messageHistory = messages as unknown as GroupMessage[]
        logger.info('Loaded message history from persistence', {
          sessionId: this.sessionId,
          count: messages.length
        })
      }

      // 同步会话状态（包括 isActive）
      try {
        const state = await groupChatService.getState(this.sessionId)
        this.isActive = state.isActive
        logger.info('Synced session state', {
          sessionId: this.sessionId,
          isActive: state.isActive
        })
      } catch (stateError) {
        logger.debug('Could not get session state, using default', { error: stateError })
      }
    } catch (error) {
      logger.error('Failed to load message history', error as Error)
    }
  }

  /**
   * 处理任务确认
   */
  private async handleTaskConfirmation(confirmation: TaskConfirmation): Promise<boolean> {
    if (this.config.taskConfirmation?.autoConfirm) {
      return true
    }

    if (this.config.taskConfirmation?.onConfirmRequest) {
      return this.config.taskConfirmation.onConfirmRequest(confirmation)
    }

    // 默认自动确认
    return true
  }

  /**
   * 获取统一模型配置
   * 当 useUnifiedModel 启用时，覆盖 agent 的 assistant 和 provider
   */
  private getUnifiedModelConfig(agent: AgentConfig): { assistant: Assistant; provider: Provider } {
    // 如果没有启用统一模型，直接返回原配置
    if (!this.config.useUnifiedModel || !this.config.unifiedModel) {
      return { assistant: agent.assistant, provider: agent.provider }
    }

    // 从 store 中查找统一模型
    const providers = store.getState().llm.providers
    let unifiedModel: Model | undefined
    let unifiedProvider: Provider | undefined

    for (const provider of providers) {
      const model = provider.models.find((m) => m.id === this.config.unifiedModel)
      if (model) {
        unifiedModel = model
        unifiedProvider = provider
        break
      }
    }

    // 如果找不到统一模型，使用原配置
    if (!unifiedModel || !unifiedProvider) {
      logger.warn('Unified model not found, using agent default', {
        unifiedModelId: this.config.unifiedModel,
        agentId: agent.id
      })
      return { assistant: agent.assistant, provider: agent.provider }
    }

    // 创建覆盖后的 assistant（使用统一模型）
    const modifiedAssistant: Assistant = {
      ...agent.assistant,
      model: unifiedModel
    }

    logger.debug('Using unified model for agent', {
      agentId: agent.id,
      originalModel: agent.assistant.model?.id,
      unifiedModel: unifiedModel.id
    })

    return { assistant: modifiedAssistant, provider: unifiedProvider }
  }

  /**
   * 处理群聊服务事件
   */
  private handleGroupChatEvent(event: GroupChatEvent): void {
    if (event.sessionId !== this.sessionId) return

    switch (event.type) {
      case 'chat:start':
        this.isActive = true
        logger.info('Group chat started via event', { sessionId: this.sessionId })
        break
      case 'chat:end':
        this.isActive = false
        logger.info('Group chat ended via event', { sessionId: this.sessionId })
        break
      case 'agent:join':
        // 主进程添加了 Agent，通过事件同步
        // 注意：完整的 AgentConfig 需要外部通过 addAgent() 方法添加
        if (event.agent) {
          logger.info('Agent join event received', {
            agentId: event.agent.id,
            agentName: event.agent.displayName
          })
        }
        break
      case 'agent:leave':
        if (event.agentId) {
          this.agents.delete(event.agentId)
          logger.info('Agent removed via event', { agentId: event.agentId })
        }
        break
    }
  }

  /**
   * 添加 Agent
   * 如果 Agent 已存在，则跳过
   */
  addAgent(agent: AgentConfig): void {
    if (this.agents.has(agent.id)) {
      logger.debug('Agent already exists in coordinator, skipping', { agentId: agent.id })
      return
    }
    this.agents.set(agent.id, agent)
    logger.info('Agent added to coordinator', { agentId: agent.id })
  }

  /**
   * 移除 Agent
   */
  removeAgent(agentId: string): boolean {
    const removed = this.agents.delete(agentId)
    if (removed) {
      logger.info('Agent removed from coordinator', { agentId })
    }
    return removed
  }

  /**
   * 获取 Agent
   */
  getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId)
  }

  /**
   * 处理用户输入并执行 Agent 响应
   * @param content 用户输入内容
   * @param userId 用户ID
   * @param files 附件文件列表（可选）
   */
  async handleUserInput(content: string, userId: string = 'user', files?: FileMetadata[]): Promise<GroupMessage[]> {
    // 等待初始化完成
    await this.waitForInit()

    if (!this.isActive) {
      throw new Error('群聊未开始')
    }

    const responses: GroupMessage[] = []

    try {
      // 0. 创建用户消息（仅用于内部历史记录，不再广播事件）
      // 注意：用户消息已由 GroupChatPanel 直接添加到 UI 状态
      // 这里只需添加到协调器内部历史记录中，用于上下文构建
      const userMessage: GroupMessage = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        agentId: 'user',
        agentName: '用户',
        content,
        timestamp: new Date(),
        type: 'chat',
        mentions: this.extractMentions(content),
        isPublic: true
      }

      // 添加到内部历史记录（用于构建上下文）
      this.messageHistory.push(userMessage)

      // 广播用户消息事件，让 GroupChatMessages 能够显示用户消息
      groupChatService.emitEvent({
        sessionId: this.sessionId,
        type: 'agent:speak',
        message: userMessage,
        agentId: 'user'
      })

      // 持久化用户消息
      try {
        await groupChatPersistence.saveMessage(userMessage as unknown as PersistentMessage, this.sessionId)
        logger.debug('User message persisted', { messageId: userMessage.id })
      } catch (error) {
        logger.error('Failed to persist user message', error as Error)
      }

      // 1. 获取发言决策
      const { decisions } = await groupChatService.handleUserInput(this.sessionId, content, userId)

      logger.info('Speaking decisions', { count: decisions.length })

      // 2. 按优先级排序执行
      const sortedDecisions = [...decisions].sort((a, b) => b.priority - a.priority)

      // 3. 为每个决定发言的 Agent 并发执行 AI 调用
      const agentPromises = sortedDecisions
        .filter((decision) => decision.shouldSpeak)
        .map(async (decision) => {
          const agent = this.agents.get(decision.agentId)
          if (!agent) {
            logger.warn('Agent not found in coordinator', { agentId: decision.agentId })
            return null
          }

          // 更新状态为思考中
          this.config.onAgentStatusChange?.(agent.id, 'thinking')
          groupChatService.emitEvent({
            sessionId: this.sessionId,
            type: 'agent:thinking',
            agentId: agent.id
          })

          try {
          // 构建包含上下文的用户输入
          const contextString = this.buildContextString()
          const fullUserInput = contextString ? `对话历史:\n${contextString}\n\n当前用户输入: ${content}` : content

          // 构建其他参与者信息
          const otherAgents = Array.from(this.agents.values())
            .filter((a) => a.id !== agent.id)
            .map((a) => ({
              name: a.displayName,
              role: a.role,
              expertise: a.expertise || []
            }))

          // 判断是否启用 Agent 协同
          const enableAgentInvocation =
            (this.config.enableAgentInvocation ?? false) && (agent.enableAgentInvocation ?? true)

          // 构建 Agent 调用工具（如果启用）
          let mcpTools: AgentRunConfig['mcpTools'] = undefined
          let onToolCall: AgentRunConfig['onToolCall'] = undefined

          if (enableAgentInvocation && this.agents.size > 1) {
            // 创建 Agent 调用上下文
            const invocationContext: AgentInvocationContext = {
              sessionId: this.sessionId,
              availableAgents: Array.from(this.agents.values()),
              sourceAgentId: agent.id,
              conversationContext: contextString,
              currentDepth: this.currentDelegationDepth,
              maxDepth: GroupChatCoordinator.MAX_DELEGATION_DEPTH,
              groupPrompt: this.config.groupPrompt
            }

            // 创建 invoke_agent 工具定义
            const agentInvocationTool = createAgentInvocationToolDefinition(invocationContext)
            mcpTools = [agentInvocationTool]

            // 工具调用处理回调
            onToolCall = async (toolName: string, toolArgs: Record<string, unknown>) => {
              if (toolName === 'invoke_agent') {
                logger.info('Agent invocation tool called', {
                  sourceAgent: agent.displayName,
                  targetAgent: toolArgs.agent_name,
                  request: (toolArgs.request as string)?.slice(0, 100)
                })

                // 增加调用深度
                this.currentDelegationDepth++
                try {
                  const result = await executeAgentInvocation(
                    toolArgs as { agent_name: string; request: string; context?: string },
                    invocationContext
                  )

                  // 如果调用成功且有响应，广播被调用 Agent 的消息
                  if (result.success && result.response) {
                    const invokedMessage: GroupMessage = {
                      id: uuidv4(),
                      agentId: result.agentId,
                      agentName: result.agentName,
                      content: result.response,
                      timestamp: new Date(),
                      type: 'chat',
                      mentions: [],
                      isPublic: true,
                      metadata: {
                        invokedBy: agent.id,
                        images: result.images
                      }
                    }

                    this.messageHistory.push(invokedMessage)
                    responses.push(invokedMessage)

                    groupChatService.emitEvent({
                      sessionId: this.sessionId,
                      type: 'agent:speak',
                      message: invokedMessage,
                      agentId: result.agentId
                    })
                  }

                  // 返回格式化的结果给调用者
                  return formatAgentInvocationResult(result)
                } finally {
                  this.currentDelegationDepth--
                }
              }
              return `Unknown tool: ${toolName}`
            }

            logger.info('Agent invocation enabled for agent', {
              agentId: agent.id,
              agentName: agent.displayName,
              availableTargets: Array.from(this.agents.values())
                .filter((a) => a.id !== agent.id)
                .map((a) => a.displayName)
            })
          }

          // 使用增强的系统提示词（包含群组设定）
          const enhancedSystemPrompt = this.getSystemPromptWithGroupContext(agent.systemPrompt || '')

          // 预先生成消息 ID，用于流式更新和最终消息
          const messageId = uuidv4()

          // 用于累积流式内容
          let streamAccumulatedContent = ''

          // 获取统一模型配置（如果启用）
          const { assistant: effectiveAssistant, provider: effectiveProvider } = this.getUnifiedModelConfig(agent)

          // 执行 AI 调用 (包含角色感知配置 + Tool Use)
          const runConfig: AgentRunConfig = {
            agentId: agent.id,
            agentName: agent.displayName,
            assistant: effectiveAssistant,
            provider: effectiveProvider,
            userInput: fullUserInput,
            systemPromptOverride: enhancedSystemPrompt,
            stream: true,
            onStream: (chunk) => {
              // 累积内容
              streamAccumulatedContent += chunk
              // 发送流式更新事件（类似 VCPChat 的 'data' 事件）
              groupChatService.emitEvent({
                sessionId: this.sessionId,
                type: 'agent:stream',
                agentId: agent.id,
                messageId,
                chunk,
                accumulatedContent: streamAccumulatedContent
              })
            },
            // 角色感知配置
            role: agent.role,
            expertise: agent.expertise || [],
            triggerKeywords: agent.triggerKeywords || [],
            otherAgents,
            // Tool Use 配置（Agent 协同）
            enableToolUse: enableAgentInvocation,
            mcpTools,
            onToolCall,
            // 附件文件（如果有）
            files
          }

          const response = await this.agentRunner.runAgent(runConfig)

          if (response.success && response.content) {
            // 清理 AI 意外添加的发言标记
            const cleanedContent = this.stripSpeakerTag(response.content, agent.displayName)

            // 创建群聊消息（使用预先生成的 messageId）
            const message: GroupMessage = {
              id: messageId,
              agentId: agent.id,
              agentName: agent.displayName,
              content: cleanedContent,
              timestamp: response.timestamp,
              type: 'chat',
              mentions: this.extractMentions(cleanedContent),
              isPublic: true
            }

            // 如果有图片，添加到元数据
            if (response.images && response.images.length > 0) {
              message.metadata = {
                ...message.metadata,
                images: response.images
              }
            }

            // 添加到历史
            this.messageHistory.push(message)
            responses.push(message)

            // 通过 groupChatService 发送事件，让 GroupChatMessages 能接收到
            // 注意：移除了 onMessage 回调，统一使用事件机制避免重复
            groupChatService.emitEvent({
              sessionId: this.sessionId,
              type: 'agent:speak',
              message,
              agentId: agent.id
            })

            // 更新状态为空闲
            this.config.onAgentStatusChange?.(agent.id, 'idle')

            // 处理被@提及的 Agent，触发它们自动响应
            if (message.mentions && message.mentions.length > 0) {
              const delegatedResponses = await this.handleMentionedAgents(message.mentions, agent.id, content)
              responses.push(...delegatedResponses)
            }

            return message
          } else {
            // 处理失败 - 广播错误消息，使用改进的错误信息
            const errorDetail = response.error || '未知错误'
            const errorMessage: GroupMessage = {
              id: uuidv4(),
              agentId: agent.id,
              agentName: agent.displayName,
              content: `[系统消息] ${agent.displayName} 响应失败: ${errorDetail}`,
              timestamp: new Date(),
              type: 'system',
              mentions: [],
              isPublic: true,
              metadata: {
                errorType: response.errorType,
                originalError: errorDetail
              }
            }
            this.messageHistory.push(errorMessage)
            groupChatService.emitEvent({
              sessionId: this.sessionId,
              type: 'agent:speak',
              message: errorMessage,
              agentId: agent.id
            })
            this.config.onError?.(new Error(errorDetail), agent.id)
            this.config.onAgentStatusChange?.(agent.id, 'idle')
            return null
          }
        } catch (error) {
          // 异常处理 - 广播错误消息
          const rawError = error as Error
          const errorContent = rawError.message || '未知错误'
          logger.error('Agent response failed', rawError)
          const errorMessage: GroupMessage = {
            id: uuidv4(),
            agentId: agent.id,
            agentName: agent.displayName,
            content: `[系统消息] ${agent.displayName} 发生错误: ${errorContent}`,
            timestamp: new Date(),
            type: 'system',
            mentions: [],
            isPublic: true,
            metadata: {
              errorType: 'unknown',
              originalError: errorContent
            }
          }
          this.messageHistory.push(errorMessage)
          groupChatService.emitEvent({
            sessionId: this.sessionId,
            type: 'agent:speak',
            message: errorMessage,
            agentId: agent.id
          })
          this.config.onError?.(rawError, agent.id)
          this.config.onAgentStatusChange?.(agent.id, 'idle')
          return null
        }
      })

      // 等待所有 Agent 并发完成
      const results = await Promise.allSettled(agentPromises)

      // 收集成功的响应
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          // 响应已在 map 函数中添加到 responses
        }
      }
    } catch (error) {
      logger.error('Handle user input failed', error as Error)
      this.config.onError?.(error as Error)
    }

    // 检查是否需要自动生成话题标题
    if (responses.length > 0) {
      await this.tryAutoGenerateTopicTitle()
    }

    return responses
  }

  /**
   * 尝试自动生成话题标题
   * 当消息数量达到阈值且话题名称为默认值时触发
   */
  private async tryAutoGenerateTopicTitle(): Promise<void> {
    const topicName = this.config.topicName || '群聊'
    const topicSummaryService = getTopicSummaryService()

    // 检查是否需要总结
    if (!topicSummaryService.shouldSummarize(this.sessionId, this.messageHistory, topicName)) {
      return
    }

    // 获取一个可用的 Agent 配置来调用 AI
    const agentConfig = Array.from(this.agents.values())[0]
    if (!agentConfig) {
      logger.warn('No agent available for topic summary')
      return
    }

    logger.info('Triggering topic auto-summary', {
      sessionId: this.sessionId,
      messageCount: this.messageHistory.length,
      currentTopic: topicName
    })

    try {
      const result = await topicSummaryService.summarize(
        this.sessionId,
        this.messageHistory,
        topicName,
        agentConfig.provider,
        agentConfig.assistant
      )

      if (result.success && result.title) {
        logger.info('Topic summary generated', { newTitle: result.title })

        // 发送话题更新事件
        groupChatService.emitEvent({
          sessionId: this.sessionId,
          type: 'topic:updated',
          topic: result.title
        })

        // 调用回调
        this.config.onTopicUpdated?.(result.title)

        // 更新本地配置
        this.config.topicName = result.title
      }
    } catch (error) {
      logger.error('Topic auto-summary failed', error as Error)
    }
  }

  /**
   * 构建上下文字符串
   * 使用 VCP 格式: [名字的发言]: 内容
   * 支持上下文净化以减少 token 用量
   */
  private buildContextString(): string {
    const recentMessages = this.messageHistory.slice(-20)

    // 如果启用了上下文净化，先净化消息内容
    let messagesToUse = recentMessages
    if (this.config.enableContextSanitizer) {
      const startDepth = this.config.contextSanitizerDepth ?? 2
      messagesToUse = contextSanitizerService.sanitizeMessages(recentMessages, startDepth)
      logger.debug('Context sanitized', {
        messageCount: recentMessages.length,
        startDepth
      })
    }

    return messagesToUse.map((msg) => `[${msg.agentName}的发言]: ${msg.content}`).join('\n')
  }

  /**
   * 清理 AI 输出中意外包含的发言标记
   *
   * AI 有时会在输出中重复添加 [角色名的发言]: 格式，
   * 此函数会检测并移除这些意外的标记，保持输出一致性。
   *
   * @param content AI 原始输出
   * @param agentName 当前发言者名称
   * @returns 清理后的内容
   */
  private stripSpeakerTag(content: string, agentName: string): string {
    if (!content) return content

    // 模式1: 完全匹配 [agentName的发言]: 开头
    const exactPattern = new RegExp(`^\\[${this.escapeRegExp(agentName)}的发言\\][:：]\\s*`, 'i')
    let cleaned = content.replace(exactPattern, '')

    // 模式2: 匹配任意 [xxx的发言]: 开头（某些模型可能用不同的名字）
    const genericPattern = /^\[[\u4e00-\u9fa5\w]+的发言\][:：]\s*/i
    cleaned = cleaned.replace(genericPattern, '')

    // 模式3: 匹配 xxx: 或 xxx：开头（常见的角色发言格式）
    const simplePattern = new RegExp(`^${this.escapeRegExp(agentName)}[:：]\\s*`, 'i')
    cleaned = cleaned.replace(simplePattern, '')

    return cleaned.trim()
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 提取 @提及
   */
  private extractMentions(content: string): string[] {
    const mentions: Set<string> = new Set()

    // 模式1: @word (英文或数字)
    const pattern1 = /@([\w]+)/g
    let match
    while ((match = pattern1.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式2: @中文名 (支持中文字符)
    const pattern2 = /@([\u4e00-\u9fa5]+)/g
    while ((match = pattern2.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式3: @"名字" 或 @'名字' (引号包裹)
    const pattern3 = /@["']([^"']+)["']/g
    while ((match = pattern3.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式4: 中文邀请式 - 请xxx回答/说/解答/分析
    const pattern4 = /请\s*([\u4e00-\u9fa5\w]+)\s*(?:回答|说|解答|分析|看看|帮忙)/g
    while ((match = pattern4.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式5: 让xxx来回答
    const pattern5 = /让\s*([\u4e00-\u9fa5\w]+)\s*(?:来|帮忙)?(?:回答|说|解答|分析)/g
    while ((match = pattern5.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式6: 问一下xxx
    const pattern6 = /问一下\s*([\u4e00-\u9fa5\w]+)/g
    while ((match = pattern6.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式7: xxx来说说/看看/分析一下
    const pattern7 = /([\u4e00-\u9fa5\w]+)\s*来\s*(?:说说|看看|分析一下|聊聊)/g
    while ((match = pattern7.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式8: 想听听xxx的意见/看法
    const pattern8 = /想听听\s*([\u4e00-\u9fa5\w]+)\s*的/g
    while ((match = pattern8.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式9: xxx你怎么看/你觉得
    const pattern9 = /([\u4e00-\u9fa5\w]+)\s*(?:你怎么看|你觉得|你认为)/g
    while ((match = pattern9.exec(content)) !== null) {
      mentions.add(match[1])
    }

    return Array.from(mentions)
  }

  /**
   * 处理被@提及的 Agent，让它们自动响应
   */
  private async handleMentionedAgents(
    mentions: string[],
    sourceAgentId: string,
    context: string
  ): Promise<GroupMessage[]> {
    if (this.currentDelegationDepth >= GroupChatCoordinator.MAX_DELEGATION_DEPTH) {
      logger.warn('Max delegation depth reached', { depth: this.currentDelegationDepth })
      return []
    }

    const responses: GroupMessage[] = []

    for (const mentionName of mentions) {
      // 优化匹配逻辑：先精确匹配，再模糊匹配
      const targetAgent = this.findAgentByMention(mentionName, sourceAgentId)

      if (!targetAgent) {
        logger.debug('Mentioned agent not found', { mentionName })
        continue
      }

      logger.info('Triggering mentioned agent', { mentionName, targetAgentId: targetAgent.id })

      this.currentDelegationDepth++
      try {
        const message = await this.requestAgentSpeak(targetAgent.id, context)
        if (message) {
          responses.push(message)
          if (message.mentions && message.mentions.length > 0) {
            const nestedResponses = await this.handleMentionedAgents(message.mentions, targetAgent.id, message.content)
            responses.push(...nestedResponses)
          }
        }
      } finally {
        this.currentDelegationDepth--
      }
    }

    return responses
  }

  /**
   * 根据提及名称查找 Agent
   * 使用优先级匹配：精确匹配 > 前缀匹配 > 包含匹配
   */
  private findAgentByMention(mentionName: string, excludeAgentId?: string): AgentConfig | undefined {
    const lowerMention = mentionName.toLowerCase()
    const agents = Array.from(this.agents.values()).filter((a) => a.id !== excludeAgentId)

    // 优先级1: 精确匹配 displayName 或 name
    const exactMatch = agents.find(
      (a) => a.displayName.toLowerCase() === lowerMention || a.name.toLowerCase() === lowerMention
    )
    if (exactMatch) {
      logger.debug('Found agent by exact match', { mentionName, agentId: exactMatch.id })
      return exactMatch
    }

    // 优先级2: displayName 或 name 以提及名开头
    const prefixMatch = agents.find(
      (a) => a.displayName.toLowerCase().startsWith(lowerMention) || a.name.toLowerCase().startsWith(lowerMention)
    )
    if (prefixMatch) {
      logger.debug('Found agent by prefix match', { mentionName, agentId: prefixMatch.id })
      return prefixMatch
    }

    // 优先级3: 提及名以 displayName 或 name 开头（反向匹配）
    const reversePrefixMatch = agents.find(
      (a) => lowerMention.startsWith(a.displayName.toLowerCase()) || lowerMention.startsWith(a.name.toLowerCase())
    )
    if (reversePrefixMatch) {
      logger.debug('Found agent by reverse prefix match', { mentionName, agentId: reversePrefixMatch.id })
      return reversePrefixMatch
    }

    // 优先级4: 包含匹配（最后的 fallback）
    const containsMatch = agents.find(
      (a) => a.displayName.toLowerCase().includes(lowerMention) || a.name.toLowerCase().includes(lowerMention)
    )
    if (containsMatch) {
      logger.debug('Found agent by contains match', { mentionName, agentId: containsMatch.id })
      return containsMatch
    }

    return undefined
  }

  /**
   * 直接请求 Agent 发言
   */
  async requestAgentSpeak(agentId: string, context: string): Promise<GroupMessage | null> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      logger.warn('Agent not found', { agentId })
      return null
    }

    this.config.onAgentStatusChange?.(agentId, 'thinking')

    try {
      // 构建包含上下文的用户输入
      const contextString = this.buildContextString()
      const fullUserInput = contextString ? `对话历史:\n${contextString}\n\n当前用户输入: ${context}` : context

      // 使用增强的系统提示词（包含群组设定）
      const enhancedSystemPrompt = this.getSystemPromptWithGroupContext(agent.systemPrompt || '')

      // 获取统一模型配置（如果启用）
      const { assistant: effectiveAssistant, provider: effectiveProvider } = this.getUnifiedModelConfig(agent)

      const response = await this.agentRunner.runAgent({
        agentId: agent.id,
        agentName: agent.displayName,
        assistant: effectiveAssistant,
        provider: effectiveProvider,
        userInput: fullUserInput,
        systemPromptOverride: enhancedSystemPrompt
      })

      if (response.success && response.content) {
        // 清理 AI 意外添加的发言标记
        const cleanedContent = this.stripSpeakerTag(response.content, agent.displayName)

        const message: GroupMessage = {
          id: uuidv4(),
          agentId: agent.id,
          agentName: agent.displayName,
          content: cleanedContent,
          timestamp: response.timestamp,
          type: 'chat',
          mentions: this.extractMentions(cleanedContent),
          isPublic: true
        }

        if (response.images && response.images.length > 0) {
          message.metadata = { images: response.images }
        }

        this.messageHistory.push(message)

        // 通过 groupChatService 发送事件
        // 注意：统一使用事件机制，不再调用 onMessage 回调
        groupChatService.emitEvent({
          sessionId: this.sessionId,
          type: 'agent:speak',
          message,
          agentId
        })

        this.config.onAgentStatusChange?.(agentId, 'idle')

        return message
      }

      this.config.onAgentStatusChange?.(agentId, 'idle')
      return null
    } catch (error) {
      logger.error('Request agent speak failed', error as Error)
      this.config.onError?.(error as Error, agentId)
      this.config.onAgentStatusChange?.(agentId, 'idle')
      return null
    }
  }

  /**
   * 获取消息历史
   */
  getMessages(): GroupMessage[] {
    return [...this.messageHistory]
  }

  /**
   * 获取所有 Agents
   */
  getAgents(): AgentConfig[] {
    return Array.from(this.agents.values())
  }

  /**
   * 开始群聊
   */
  async start(topic?: string): Promise<void> {
    await groupChatService.start(this.sessionId, topic)
    this.isActive = true
  }

  /**
   * 结束群聊
   */
  async end(): Promise<{ summary: string; messageCount: number }> {
    this.agentRunner.cancelAllTasks()
    const result = await groupChatService.end(this.sessionId)
    this.isActive = false
    return result
  }

  /**
   * 是否活跃
   */
  get active(): boolean {
    return this.isActive
  }

  // ==================== 心流锁模式 (Flow Lock) ====================

  /**
   * 启用心流锁模式
   * AI 可以主动发言，不再只是被动等待用户输入
   */
  enableFlowLock(): void {
    if (!this.config.enableFlowLock) {
      logger.warn('Flow lock is not enabled in config')
      return
    }

    this.flowLockActive = true
    logger.info('Flow lock enabled', { sessionId: this.sessionId })

    // 启动心流锁定时器
    this.scheduleFlowLockTrigger()
  }

  /**
   * 禁用心流锁模式
   */
  disableFlowLock(): void {
    this.flowLockActive = false
    if (this.flowLockTimer) {
      clearTimeout(this.flowLockTimer)
      this.flowLockTimer = undefined
    }
    logger.info('Flow lock disabled', { sessionId: this.sessionId })
  }

  /**
   * 调度心流锁触发
   * 根据冷却时间安排下一次 AI 主动发言
   */
  private scheduleFlowLockTrigger(): void {
    if (!this.flowLockActive || !this.isActive) return

    const cooldown = this.config.flowLockCooldown || 30000 // 默认 30 秒
    const timeSinceLastSpeak = Date.now() - this.lastFlowLockSpeakTime
    const delay = Math.max(0, cooldown - timeSinceLastSpeak)

    this.flowLockTimer = setTimeout(() => {
      this.triggerFlowLockSpeak()
    }, delay)
  }

  /**
   * 触发心流锁主动发言
   * 选择一个合适的 Agent 主动发言
   */
  private async triggerFlowLockSpeak(): Promise<void> {
    if (!this.flowLockActive || !this.isActive) return

    // 选择一个 Agent（优先选择 host 或 expert）
    const agents = Array.from(this.agents.values())
    const hostAgent = agents.find((a) => a.role === 'host')
    const selectedAgent = hostAgent || agents[Math.floor(Math.random() * agents.length)]

    if (!selectedAgent) {
      logger.warn('No agent available for flow lock speak')
      return
    }

    logger.info('Flow lock triggering agent speak', {
      agentId: selectedAgent.id,
      agentName: selectedAgent.displayName
    })

    // 构建触发提示词
    const triggerPrompt =
      this.config.flowLockTriggerPrompt || '根据之前的对话，你可以主动提出想法、继续讨论、汇报进度或提出问题。'

    try {
      const contextString = this.buildContextString()
      const fullPrompt = contextString ? `对话历史:\n${contextString}\n\n${triggerPrompt}` : triggerPrompt

      // 使用增强的系统提示词（包含群组设定）
      const enhancedSystemPrompt = this.getSystemPromptWithGroupContext(selectedAgent.systemPrompt || '')

      // 获取统一模型配置（如果启用）
      const { assistant: effectiveAssistant, provider: effectiveProvider } = this.getUnifiedModelConfig(selectedAgent)

      const response = await this.agentRunner.runAgent({
        agentId: selectedAgent.id,
        agentName: selectedAgent.displayName,
        assistant: effectiveAssistant,
        provider: effectiveProvider,
        userInput: fullPrompt,
        systemPromptOverride: enhancedSystemPrompt,
        role: selectedAgent.role,
        invitePrompt: `现在轮到你 ${selectedAgent.displayName} 主动发言了。你可以继续之前的话题，提出新的想法，或者汇报工作进度。`
      })

      if (response.success && response.content) {
        // 清理 AI 意外添加的发言标记
        const cleanedContent = this.stripSpeakerTag(response.content, selectedAgent.displayName)

        const message: GroupMessage = {
          id: uuidv4(),
          agentId: selectedAgent.id,
          agentName: selectedAgent.displayName,
          content: cleanedContent,
          timestamp: response.timestamp,
          type: 'chat',
          mentions: this.extractMentions(cleanedContent),
          isPublic: true,
          metadata: {
            flowLockTriggered: true // 标记为心流锁触发的消息
          }
        }

        if (response.images && response.images.length > 0) {
          message.metadata = { ...message.metadata, images: response.images }
        }

        this.messageHistory.push(message)

        groupChatService.emitEvent({
          sessionId: this.sessionId,
          type: 'agent:speak',
          message,
          agentId: selectedAgent.id
        })

        // 通知外部
        this.config.onFlowLockTrigger?.(selectedAgent.id, cleanedContent)
      }

      this.lastFlowLockSpeakTime = Date.now()
    } catch (error) {
      logger.error('Flow lock speak failed', error as Error)
    }

    // 调度下一次触发
    this.scheduleFlowLockTrigger()
  }

  /**
   * 获取心流锁状态
   */
  isFlowLockActive(): boolean {
    return this.flowLockActive
  }

  // ==================== 群组设定 (groupPrompt) ====================

  /**
   * 获取包含群组设定的系统提示词
   */
  private getSystemPromptWithGroupContext(agentPrompt: string): string {
    const parts: string[] = []

    // 1. 群组设定（共同背景）
    if (this.config.groupPrompt) {
      parts.push(`## 群组背景设定\n${this.config.groupPrompt}`)
    }

    // 2. Agent 原始提示词
    if (agentPrompt) {
      parts.push(`## 你的角色设定\n${agentPrompt}`)
    }

    // 3. 发言标记规则（增强，避免重复介绍）
    parts.push(`## 发言规则
- 系统会自动为每条消息添加 [发言者的发言]: 格式的标记
- 你不需要手动添加发言标记，直接输出回复内容即可
- 专注于对话内容，不要讨论发言标记系统
- **重要**：不要重复自我介绍。如果你已经在之前的对话中介绍过自己，直接回应当前话题即可
- **重要**：避免在每次回复开头说"你好"或类似的问候语，除非是首次加入对话`)

    return parts.join('\n\n')
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.agentRunner.cancelAllTasks()
    this.agents.clear()
    this.messageHistory = []
    this.pendingConfirmations.clear()
    // 停止心流锁
    this.disableFlowLock()
    // 取消事件订阅
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = undefined
    }
  }
}

// 会话管理器
const coordinators: Map<string, GroupChatCoordinator> = new Map()

/**
 * 创建或获取协调器
 */
export function getGroupChatCoordinator(
  sessionId: string,
  config?: Omit<CoordinatorConfig, 'sessionId'>
): GroupChatCoordinator {
  if (!coordinators.has(sessionId)) {
    coordinators.set(sessionId, new GroupChatCoordinator({ sessionId, ...config }))
  }
  return coordinators.get(sessionId)!
}

/**
 * 销毁协调器
 */
export function destroyGroupChatCoordinator(sessionId: string): void {
  const coordinator = coordinators.get(sessionId)
  if (coordinator) {
    coordinator.dispose()
    coordinators.delete(sessionId)
  }
}
