/**
 * GroupChatOrchestrator - 群聊编排器
 *
 * 实现多Agent协同对话：
 * 1. 发言模式控制 (顺序/随机/邀请/@提及)
 * 2. 任务分发与协调
 * 3. 上下文共享与隔离
 * 4. 冲突解决机制
 *
 * 基于 VCPChat 群聊模式设计
 *
 * @version 1.1.0 - 添加加权随机发言选择器
 */

import { loggerService } from '@logger'
import { mcpBridge } from '@main/mcpServers/shared/MCPBridge'
import {
  createSemanticGroupMatcher,
  isNativeModuleAvailable,
  type SemanticGroupMatch
} from '@main/services/native/NativeVCPBridge'
import type { ExtendedPlaceholderContext, GroupSessionInfo } from '@main/services/vcp/PlaceholderEngine'
import { getVCPInfoService } from '@main/services/vcp/VCPInfoService'
import { VCPRuntime } from '@main/services/vcp/VCPRuntime'

import { type AgentInfo as SelectorAgentInfo, getWeightedSpeakerSelector } from './WeightedSpeakerSelector'

const logger = loggerService.withContext('GroupChatOrchestrator')

/**
 * 发言模式
 */
export type SpeakingMode =
  | 'sequential' // 顺序发言 - 按固定顺序轮流
  | 'random' // 随机发言 - 随机选择下一个发言者
  | 'naturerandom' // 自然随机 - VCP风格智能选择（@提及>关键词>概率）
  | 'invitation' // 邀请发言 - 由主持人指定
  | 'mention' // @提及 - 被@的Agent发言
  | 'keyword' // 关键词触发 - 匹配关键词的Agent发言
  | 'consensus' // 共识模式 - 所有Agent都参与

/**
 * Agent 角色
 */
export type AgentRole =
  | 'host' // 主持人 - 控制对话流程
  | 'participant' // 参与者 - 普通参与
  | 'observer' // 观察者 - 只看不说
  | 'expert' // 专家 - 专业领域发言
  | 'moderator' // 协调者 - 解决冲突

/**
 * 群聊中的 Agent
 */
export interface GroupAgent {
  id: string
  name: string
  displayName: string
  avatar?: string
  role: AgentRole
  /** 专长领域 */
  expertise: string[]
  /** 触发关键词 */
  triggerKeywords: string[]
  /** 系统提示词 */
  systemPrompt: string
  /** 当前状态 */
  status: 'active' | 'idle' | 'thinking' | 'speaking' | 'offline'
  /** 发言优先级 (0-100) */
  priority: number
  /** 最后发言时间 */
  lastSpoken?: Date
  /** 发言计数 */
  speakCount: number
  /** 上下文窗口 (该Agent可见的消息ID) */
  visibleMessageIds: string[]
}

/**
 * 群聊消息
 */
export interface GroupMessage {
  id: string
  agentId: string
  agentName: string
  content: string
  timestamp: Date
  /** 消息类型 */
  type: 'chat' | 'system' | 'action' | 'thought' | 'summary'
  /** @提及的Agent */
  mentions: string[]
  /** 回复的消息ID */
  replyTo?: string
  /** 是否对所有Agent可见 */
  isPublic: boolean
  /** 可见的Agent列表 (非公开消息) */
  visibleTo?: string[]
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 群聊配置
 */
export interface GroupChatConfig {
  /** 群聊ID */
  id: string
  /** 群聊名称 */
  name: string
  /** 发言模式 */
  speakingMode: SpeakingMode
  /** 主持人ID */
  hostAgentId?: string
  /** 最大发言轮次 (防止无限对话) */
  maxRounds: number
  /** 每轮最大发言数 */
  maxSpeakersPerRound: number
  /** 发言冷却时间 (ms) */
  speakingCooldown: number
  /** 是否允许自由讨论 */
  allowFreeDiscussion: boolean
  /** 是否需要达成共识 */
  requireConsensus: boolean
  /** 共识阈值 (0-1) */
  consensusThreshold: number
  /** 超时时间 (ms) */
  timeout: number
  /** 是否启用思考过程展示 */
  showThinking: boolean
  /** 上下文共享策略 */
  contextSharing: 'full' | 'partial' | 'isolated'
  /** 成员标签映射 (agentId -> tags[])，用于 naturerandom 权重计算 */
  memberTags?: Record<string, string[]>
  /** 邀请提示词模板，支持 {{VCPChatAgentName}} 占位符 */
  invitePromptTemplate?: string
  /** 话题自动总结配置 */
  autoSummary?: {
    /** 是否启用自动总结 */
    enabled: boolean
    /** 触发总结的消息数阈值 */
    messageThreshold: number
    /** 触发总结的轮次阈值 */
    roundThreshold?: number
    /** 总结生成后的回调 */
    onSummaryGenerated?: (summary: string, topic: string) => void
  }
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
 * 简化的 MCP 工具定义 (用于 GroupChat 内部)
 */
interface SimpleMCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<
      string,
      {
        type: string
        description?: string
        default?: unknown
        enum?: string[]
        items?: { type: string }
      }
    >
    required?: string[]
  }
  serverId: string
}

/**
 * 群聊状态
 */
export interface GroupChatState {
  config: GroupChatConfig
  agents: Map<string, GroupAgent>
  messages: GroupMessage[]
  currentRound: number
  currentSpeaker?: string
  speakingQueue: string[]
  isActive: boolean
  startTime?: Date
  endTime?: Date
  topic?: string
  summary?: string
}

/**
 * 群聊事件
 */
export type GroupChatEvent =
  | { type: 'chat:start'; config: GroupChatConfig }
  | { type: 'chat:end'; summary: string }
  | { type: 'agent:join'; agent: GroupAgent }
  | { type: 'agent:leave'; agentId: string }
  | { type: 'agent:speak'; message: GroupMessage }
  | { type: 'agent:thinking'; agentId: string }
  | { type: 'round:start'; round: number }
  | { type: 'round:end'; round: number }
  | { type: 'consensus:reached'; decision: string }
  | { type: 'conflict:detected'; agents: string[]; topic: string }
  | { type: 'timeout'; reason: string }

/**
 * 群聊编排器
 */
export class GroupChatOrchestrator {
  private state: GroupChatState
  private eventListeners: Set<(event: GroupChatEvent) => void> = new Set()
  private speakingLock: boolean = false

  /** Native SemanticGroupMatcher for keyword matching */
  private semanticMatcher: ReturnType<typeof createSemanticGroupMatcher> | null = null
  private isNativeMatcherAvailable = false

  constructor(config: Partial<GroupChatConfig> = {}) {
    this.state = {
      config: {
        id: config.id || `group_${Date.now()}`,
        name: config.name || '群聊',
        speakingMode: config.speakingMode || 'sequential',
        hostAgentId: config.hostAgentId,
        maxRounds: config.maxRounds ?? 10,
        maxSpeakersPerRound: config.maxSpeakersPerRound ?? 5,
        speakingCooldown: config.speakingCooldown ?? 1000,
        allowFreeDiscussion: config.allowFreeDiscussion ?? true,
        requireConsensus: config.requireConsensus ?? false,
        consensusThreshold: config.consensusThreshold ?? 0.8,
        timeout: config.timeout ?? 300000, // 5 minutes
        showThinking: config.showThinking ?? true,
        contextSharing: config.contextSharing || 'full'
      },
      agents: new Map(),
      messages: [],
      currentRound: 0,
      speakingQueue: [],
      isActive: false
    }

    // Initialize Native SemanticGroupMatcher if available
    this.initializeSemanticMatcher()

    logger.info('GroupChatOrchestrator initialized', {
      config: this.state.config,
      isNativeMatcherAvailable: this.isNativeMatcherAvailable
    })
  }

  /**
   * Initialize Native SemanticGroupMatcher for keyword matching
   */
  private initializeSemanticMatcher(): void {
    try {
      if (isNativeModuleAvailable()) {
        this.semanticMatcher = createSemanticGroupMatcher()
        this.isNativeMatcherAvailable = true
        logger.info('Native SemanticGroupMatcher initialized for GroupChat')
      }
    } catch (error) {
      logger.warn('Failed to initialize Native SemanticGroupMatcher', {
        error: error instanceof Error ? error.message : String(error)
      })
      this.isNativeMatcherAvailable = false
    }
  }

  /**
   * Register agent keywords to semantic matcher
   */
  private registerAgentKeywordsToMatcher(agent: GroupAgent): void {
    if (!this.semanticMatcher || !this.isNativeMatcherAvailable) return

    try {
      // Register trigger keywords as a semantic group
      if (agent.triggerKeywords.length > 0) {
        this.semanticMatcher.registerGroup('agent_trigger', agent.id, agent.triggerKeywords)
      }

      // Register expertise as a semantic group
      if (agent.expertise.length > 0) {
        this.semanticMatcher.registerGroup('agent_expertise', agent.id, agent.expertise)
      }
    } catch (error) {
      logger.warn('Failed to register agent keywords to matcher', {
        agentId: agent.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Match keywords using Native SemanticGroupMatcher
   */
  private matchKeywordsNative(content: string, agent: GroupAgent): { matched: boolean; matchInfo?: SemanticGroupMatch } {
    if (!this.semanticMatcher || !this.isNativeMatcherAvailable) {
      return { matched: false }
    }

    try {
      const matches = this.semanticMatcher.extractMatches(content)
      // Find matches related to this agent
      const agentMatch = matches.find(
        (m) => m.subGroup === agent.id && (m.groupType === 'agent_trigger' || m.groupType === 'agent_expertise')
      )

      if (agentMatch) {
        return {
          matched: true,
          matchInfo: agentMatch
        }
      }
    } catch (error) {
      logger.warn('Native keyword matching failed', {
        agentId: agent.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return { matched: false }
  }

  /**
   * 添加 Agent 到群聊
   * 如果 Agent 已存在，则跳过添加
   */
  addAgent(agent: Omit<GroupAgent, 'status' | 'speakCount' | 'visibleMessageIds'>): void {
    // 检查是否已存在，防止重复添加
    if (this.state.agents.has(agent.id)) {
      logger.debug('Agent already exists, skipping', { agentId: agent.id })
      return
    }

    const fullAgent: GroupAgent = {
      ...agent,
      status: 'idle',
      speakCount: 0,
      visibleMessageIds: []
    }

    this.state.agents.set(agent.id, fullAgent)

    // Register agent keywords to Native matcher
    this.registerAgentKeywordsToMatcher(fullAgent)

    this.emit({ type: 'agent:join', agent: fullAgent })

    logger.debug('Agent added to group', { agentId: agent.id, role: agent.role })
  }

  /**
   * 移除 Agent
   */
  removeAgent(agentId: string): void {
    if (this.state.agents.has(agentId)) {
      this.state.agents.delete(agentId)
      this.emit({ type: 'agent:leave', agentId })
    }
  }

  /**
   * 开始群聊
   */
  async start(topic?: string): Promise<void> {
    if (this.state.isActive) {
      logger.warn('Group chat already active')
      return
    }

    this.state.isActive = true
    this.state.startTime = new Date()
    this.state.topic = topic
    this.state.currentRound = 0

    this.emit({ type: 'chat:start', config: this.state.config })

    // 初始化发言队列
    this.initializeSpeakingQueue()

    // 如果有主持人，让主持人先发言
    if (this.state.config.hostAgentId) {
      await this.requestSpeak(this.state.config.hostAgentId, 'start_discussion')
    }

    logger.info('Group chat started', { topic, agentCount: this.state.agents.size })
  }

  /**
   * 结束群聊
   */
  async end(): Promise<void> {
    if (!this.state.isActive) return

    this.state.isActive = false
    this.state.endTime = new Date()

    // 生成摘要
    const summary = await this.generateSummary()
    this.state.summary = summary

    this.emit({ type: 'chat:end', summary })

    logger.info('Group chat ended', {
      duration: this.state.endTime.getTime() - (this.state.startTime?.getTime() || 0),
      messageCount: this.state.messages.length,
      roundCount: this.state.currentRound
    })
  }

  /**
   * 处理用户输入
   */
  async handleUserInput(content: string, userId: string = 'user'): Promise<SpeakingDecision[]> {
    // 添加用户消息
    const userMessage: GroupMessage = {
      id: `msg_${Date.now()}`,
      agentId: userId,
      agentName: '用户',
      content,
      timestamp: new Date(),
      type: 'chat',
      mentions: this.extractMentions(content),
      isPublic: true
    }

    this.state.messages.push(userMessage)
    this.updateVisibility(userMessage)

    // 决定谁应该回应
    const decisions = await this.decideSpeakers(content, userMessage.mentions)

    return decisions
  }

  /**
   * 请求 Agent 发言
   */
  async requestSpeak(agentId: string, context: string): Promise<GroupMessage | null> {
    const agent = this.state.agents.get(agentId)
    if (!agent) {
      logger.warn('Agent not found', { agentId })
      return null
    }

    // 检查冷却时间
    if (agent.lastSpoken) {
      const cooldown = Date.now() - agent.lastSpoken.getTime()
      if (cooldown < this.state.config.speakingCooldown) {
        logger.debug('Agent in cooldown', { agentId, remaining: this.state.config.speakingCooldown - cooldown })
        return null
      }
    }

    // 获取发言锁
    if (this.speakingLock) {
      this.state.speakingQueue.push(agentId)
      return null
    }

    this.speakingLock = true
    agent.status = 'thinking'
    this.emit({ type: 'agent:thinking', agentId })

    try {
      // 构建 Agent 可见的上下文
      const visibleContext = this.buildAgentContext(agent)

      // 这里应该调用 AI 服务生成响应
      // 目前返回占位符，实际实现需要集成 AI 服务
      const response = await this.generateAgentResponse(agent, visibleContext, context)

      // 创建消息
      const message: GroupMessage = {
        id: `msg_${Date.now()}`,
        agentId: agent.id,
        agentName: agent.displayName,
        content: response,
        timestamp: new Date(),
        type: 'chat',
        mentions: this.extractMentions(response),
        isPublic: true
      }

      this.state.messages.push(message)
      this.updateVisibility(message)

      // 检查是否需要触发自动总结
      await this.checkAutoSummaryThreshold()

      // 更新 Agent 状态
      agent.status = 'idle'
      agent.lastSpoken = new Date()
      agent.speakCount++
      this.state.currentSpeaker = undefined

      this.emit({ type: 'agent:speak', message })

      return message
    } finally {
      this.speakingLock = false
      agent.status = 'idle'

      // 处理等待队列
      if (this.state.speakingQueue.length > 0) {
        const nextAgentId = this.state.speakingQueue.shift()!
        setImmediate(() => this.requestSpeak(nextAgentId, 'queued'))
      }
    }
  }

  /**
   * 决定发言者
   */
  private async decideSpeakers(content: string, mentions: string[]): Promise<SpeakingDecision[]> {
    const decisions: SpeakingDecision[] = []
    const activeAgents = Array.from(this.state.agents.values()).filter((a) => a.status !== 'offline')

    logger.info('Deciding speakers', {
      speakingMode: this.state.config.speakingMode,
      mentions,
      activeAgentCount: activeAgents.length,
      activeAgents: activeAgents.map((a) => ({ id: a.id, displayName: a.displayName }))
    })

    // 【重要】无论什么模式，@提及的 Agent 都优先响应
    // 这是参考 VCPChat 的 determineNatureRandomSpeakers 实现
    if (mentions.length > 0) {
      for (const mention of mentions) {
        const agent = this.findAgentByMention(mention)
        if (agent) {
          logger.info('Mention override: found agent', { mention, agentId: agent.id, agentName: agent.displayName })
          decisions.push({
            shouldSpeak: true,
            agentId: agent.id,
            reason: `被用户@提及 (优先级最高)`,
            priority: 100,
            suggestedAction: 'respond'
          })
        } else {
          logger.warn('Mention override: agent not found', { mention })
        }
      }

      // 如果通过 @提及 找到了 agent，直接返回，不再执行其他模式逻辑
      if (decisions.length > 0) {
        logger.info('Using mention-based decisions', { count: decisions.length })
        return decisions.slice(0, this.state.config.maxSpeakersPerRound)
      }
    }

    // 如果没有 @提及 或者 @提及的 agent 未找到，使用原有模式逻辑
    switch (this.state.config.speakingMode) {
      case 'mention':
        // @提及模式: 只有被提及的Agent发言（已在上面处理）
        // 如果没有提及，不发言
        break

      case 'keyword':
        // 关键词模式: 匹配关键词的Agent发言
        // 优先使用 Native SemanticGroupMatcher
        for (const agent of activeAgents) {
          // Try Native matching first
          if (this.isNativeMatcherAvailable) {
            const nativeMatch = this.matchKeywordsNative(content, agent)
            if (nativeMatch.matched && nativeMatch.matchInfo) {
              decisions.push({
                shouldSpeak: true,
                agentId: agent.id,
                reason: `Native语义匹配: ${nativeMatch.matchInfo.matchedKeywords.join(', ')}`,
                priority: 80 + nativeMatch.matchInfo.weight * 10,
                suggestedAction: 'respond'
              })
              continue
            }
          }

          // Fallback to simple includes matching
          const matchedKeyword = agent.triggerKeywords.find((kw) => content.toLowerCase().includes(kw.toLowerCase()))
          if (matchedKeyword) {
            decisions.push({
              shouldSpeak: true,
              agentId: agent.id,
              reason: `关键词匹配: ${matchedKeyword}`,
              priority: 80,
              suggestedAction: 'respond'
            })
          }
        }
        break

      case 'sequential':
        // 顺序模式: 按队列顺序
        if (this.state.speakingQueue.length > 0) {
          const nextId = this.state.speakingQueue[0]
          decisions.push({
            shouldSpeak: true,
            agentId: nextId,
            reason: '轮到发言',
            priority: 100,
            suggestedAction: 'respond'
          })
        }
        break

      case 'random':
        // 随机模式: 使用加权随机选择器
        const availableAgents = activeAgents.filter((a) => a.role !== 'observer')
        if (availableAgents.length > 0) {
          // 获取或创建加权选择器
          const selector = getWeightedSpeakerSelector(this.state.config.id)

          // 转换为选择器需要的格式
          const selectorAgents: SelectorAgentInfo[] = availableAgents.map((a) => ({
            id: a.id,
            name: a.name,
            displayName: a.displayName,
            priority: a.priority,
            expertise: a.expertise,
            triggerKeywords: a.triggerKeywords,
            role: a.role
          }))

          // 使用加权选择
          const { selected, weights } = selector.selectSpeakers(selectorAgents, content, mentions)

          // 转换为决策
          for (const agent of selected) {
            const weight = weights.find((w) => w.agentId === agent.id)
            decisions.push({
              shouldSpeak: true,
              agentId: agent.id,
              reason: `加权随机选中 (权重: ${weight?.finalWeight.toFixed(1) || '?'})`,
              priority: weight?.finalWeight || 50,
              suggestedAction: 'respond'
            })

            // 记录发言
            selector.recordSpeaking(agent.id)
          }

          // 进入下一轮
          selector.nextRound()
        }
        break

      case 'naturerandom':
        // 自然随机模式: VCP风格智能选择
        // 优先级: @提及 > 关键词匹配 > @所有人 > 概率发言 > 保底发言
        decisions.push(...this.determineNatureRandomSpeakers(activeAgents, content, mentions))
        break

      case 'invitation':
        // 邀请模式: 由主持人决定
        if (this.state.config.hostAgentId) {
          decisions.push({
            shouldSpeak: true,
            agentId: this.state.config.hostAgentId,
            reason: '主持人回应',
            priority: 100,
            suggestedAction: 'delegate'
          })
        }
        break

      case 'consensus':
        // 共识模式: 所有人都参与
        for (const agent of activeAgents.filter((a) => a.role !== 'observer')) {
          decisions.push({
            shouldSpeak: true,
            agentId: agent.id,
            reason: '共识讨论',
            priority: agent.priority,
            suggestedAction: 'respond'
          })
        }
        break
    }

    // 如果没有决策，检查专家匹配
    if (decisions.length === 0) {
      const expertMatch = this.findExpertForTopic(content)
      if (expertMatch) {
        decisions.push({
          shouldSpeak: true,
          agentId: expertMatch.id,
          reason: `专业领域匹配: ${expertMatch.expertise.join(', ')}`,
          priority: 70,
          suggestedAction: 'respond'
        })
      }
    }

    // 按优先级排序
    decisions.sort((a, b) => b.priority - a.priority)

    // 限制发言者数量
    const finalDecisions = decisions.slice(0, this.state.config.maxSpeakersPerRound)

    logger.info('Final speaking decisions', {
      totalDecisions: decisions.length,
      finalDecisions: finalDecisions.map((d) => ({
        agentId: d.agentId,
        reason: d.reason,
        priority: d.priority
      }))
    })

    return finalDecisions
  }

  /**
   * 初始化发言队列
   */
  private initializeSpeakingQueue(): void {
    const agents = Array.from(this.state.agents.values())
      .filter((a) => a.role !== 'observer')
      .sort((a, b) => b.priority - a.priority)

    this.state.speakingQueue = agents.map((a) => a.id)
  }

  /**
   * 提取 @提及
   * 支持多种格式:
   * - @name (英文名)
   * - @中文名 (中文名)
   * - @"带空格的名字" (引号包裹)
   * - 请xxx回答/说 (中文邀请式)
   */
  private extractMentions(content: string): string[] {
    const mentions: Set<string> = new Set()

    // 模式1: @word (英文或数字)
    const pattern1 = /@([\w]+)/g
    let match
    while ((match = pattern1.exec(content)) !== null) {
      mentions.add(match[1])
    }

    // 模式2: @中文名 (支持中文字符，直到遇到空格或标点)
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

    const result = Array.from(mentions)
    logger.debug('Extracted mentions', { content: content.substring(0, 50), mentions: result })
    return result
  }

  /**
   * 根据提及查找 Agent
   */
  private findAgentByMention(mention: string): GroupAgent | undefined {
    const lowerMention = mention.toLowerCase().trim()
    const agents = Array.from(this.state.agents.values())

    logger.debug('Finding agent by mention', {
      mention: lowerMention,
      availableAgents: agents.map((a) => ({ id: a.id, name: a.name, displayName: a.displayName }))
    })

    // 优先级1: 精确匹配 displayName 或 name
    const exactMatch = agents.find(
      (a) => a.displayName.toLowerCase().trim() === lowerMention || a.name.toLowerCase().trim() === lowerMention
    )
    if (exactMatch) {
      logger.debug('Found agent by exact match', { mention, agentId: exactMatch.id })
      return exactMatch
    }

    // 优先级2: displayName 或 name 以提及名开头
    const prefixMatch = agents.find(
      (a) => a.displayName.toLowerCase().startsWith(lowerMention) || a.name.toLowerCase().startsWith(lowerMention)
    )
    if (prefixMatch) {
      logger.debug('Found agent by prefix match', { mention, agentId: prefixMatch.id })
      return prefixMatch
    }

    // 优先级3: 提及名以 displayName 或 name 开头（反向匹配）
    const reversePrefixMatch = agents.find(
      (a) => lowerMention.startsWith(a.displayName.toLowerCase()) || lowerMention.startsWith(a.name.toLowerCase())
    )
    if (reversePrefixMatch) {
      logger.debug('Found agent by reverse prefix match', { mention, agentId: reversePrefixMatch.id })
      return reversePrefixMatch
    }

    // 优先级4: 包含匹配（最后的 fallback）
    const containsMatch = agents.find(
      (a) =>
        a.displayName.toLowerCase().includes(lowerMention) ||
        a.name.toLowerCase().includes(lowerMention) ||
        lowerMention.includes(a.displayName.toLowerCase()) ||
        lowerMention.includes(a.name.toLowerCase())
    )
    if (containsMatch) {
      logger.debug('Found agent by contains match', { mention, agentId: containsMatch.id })
      return containsMatch
    }

    logger.debug('No agent found for mention', { mention })
    return undefined
  }

  /**
   * 自然随机发言者选择算法 (VCP风格)
   * 优先级:
   * 1. @角色名直接提及 → 100% 发言
   * 2. 关键词/标签匹配（上下文窗口8条消息）
   * 3. @所有人 → 所有成员发言
   * 4. 概率发言（15% 基础，85% 话题相关）
   * 5. 保底发言（随机选择，优先话题相关）
   */
  private determineNatureRandomSpeakers(
    activeAgents: GroupAgent[],
    content: string,
    mentions: string[]
  ): SpeakingDecision[] {
    const decisions: SpeakingDecision[] = []
    const spokenThisTurn = new Set<string>()

    // 常量配置
    const CONTEXT_WINDOW = 8
    const BASE_PROBABILITY = 0.15
    const TOPIC_RELATED_PROBABILITY = 0.85

    // 获取上下文
    const recentContext = this.state.messages.slice(-CONTEXT_WINDOW)
    const contextText = recentContext
      .map((m) => m.content)
      .join(' ')
      .toLowerCase()
    const lowerContent = content.toLowerCase()

    // 优先级1: @角色名直接提及
    for (const mention of mentions) {
      const agent = this.findAgentByMention(mention)
      if (agent && !spokenThisTurn.has(agent.id) && activeAgents.some((a) => a.id === agent.id)) {
        decisions.push({
          shouldSpeak: true,
          agentId: agent.id,
          reason: `被用户@提及`,
          priority: 100,
          suggestedAction: 'respond'
        })
        spokenThisTurn.add(agent.id)
      }
    }

    // 如果有@提及，直接返回
    if (decisions.length > 0) {
      logger.info('NatureRandom: Found mentions', { count: decisions.length })
      return decisions
    }

    // 优先级2: 关键词/标签匹配（包括 memberTags）
    // 优先使用 Native SemanticGroupMatcher
    const memberTags = this.state.config.memberTags || {}
    for (const agent of activeAgents) {
      if (spokenThisTurn.has(agent.id)) continue

      // Try Native matching first
      if (this.isNativeMatcherAvailable) {
        const nativeMatch = this.matchKeywordsNative(lowerContent, agent)
        if (nativeMatch.matched && nativeMatch.matchInfo) {
          decisions.push({
            shouldSpeak: true,
            agentId: agent.id,
            reason: `Native语义匹配: ${nativeMatch.matchInfo.matchedKeywords.join(', ')}`,
            priority: 85 + nativeMatch.matchInfo.weight * 5,
            suggestedAction: 'respond'
          })
          spokenThisTurn.add(agent.id)
          continue
        }
      }

      // Fallback: 检查 agent.triggerKeywords
      const matchedKeyword = agent.triggerKeywords.find(
        (kw) => lowerContent.includes(kw.toLowerCase()) || contextText.includes(kw.toLowerCase())
      )

      // 检查 config.memberTags[agentId] 中的标签
      const agentTags = memberTags[agent.id] || []
      const matchedTag = agentTags.find(
        (tag) => lowerContent.includes(tag.toLowerCase()) || contextText.includes(tag.toLowerCase())
      )

      if (matchedKeyword || matchedTag) {
        const matchReason = matchedKeyword ? `关键词匹配: ${matchedKeyword}` : `标签匹配: ${matchedTag}`
        decisions.push({
          shouldSpeak: true,
          agentId: agent.id,
          reason: matchReason,
          priority: 85,
          suggestedAction: 'respond'
        })
        spokenThisTurn.add(agent.id)
      }
    }

    // 优先级3: @所有人
    if (content.includes('@所有人') || content.includes('@everyone') || content.includes('@all')) {
      for (const agent of activeAgents) {
        if (!spokenThisTurn.has(agent.id)) {
          decisions.push({
            shouldSpeak: true,
            agentId: agent.id,
            reason: '@所有人',
            priority: 70,
            suggestedAction: 'respond'
          })
          spokenThisTurn.add(agent.id)
        }
      }
    }

    // 优先级4: 概率发言
    for (const agent of activeAgents) {
      if (spokenThisTurn.has(agent.id)) continue

      // 检查是否话题相关
      const isTopicRelated = agent.expertise.some(
        (exp) => lowerContent.includes(exp.toLowerCase()) || contextText.includes(exp.toLowerCase())
      )

      const speakChance = isTopicRelated ? TOPIC_RELATED_PROBABILITY : BASE_PROBABILITY

      if (Math.random() < speakChance) {
        decisions.push({
          shouldSpeak: true,
          agentId: agent.id,
          reason: isTopicRelated ? '话题相关触发' : '随机触发',
          priority: isTopicRelated ? 60 : 30,
          suggestedAction: 'respond'
        })
        spokenThisTurn.add(agent.id)
      }
    }

    // 优先级5: 保底发言（至少要有一个人回复）
    if (decisions.length === 0 && activeAgents.length > 0) {
      // 优先选择话题相关的
      const topicRelatedAgent = activeAgents.find((a) =>
        a.expertise.some((exp) => lowerContent.includes(exp.toLowerCase()))
      )
      const fallbackAgent = topicRelatedAgent || activeAgents[Math.floor(Math.random() * activeAgents.length)]

      decisions.push({
        shouldSpeak: true,
        agentId: fallbackAgent.id,
        reason: '保底发言',
        priority: 20,
        suggestedAction: 'respond'
      })
    }

    logger.info('NatureRandom: Final decisions', {
      count: decisions.length,
      agents: decisions.map((d) => ({ id: d.agentId, reason: d.reason }))
    })

    return decisions.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 查找话题专家
   */
  private findExpertForTopic(content: string): GroupAgent | undefined {
    const lowerContent = content.toLowerCase()

    for (const agent of this.state.agents.values()) {
      if (agent.role === 'expert') {
        for (const expertise of agent.expertise) {
          if (lowerContent.includes(expertise.toLowerCase())) {
            return agent
          }
        }
      }
    }

    return undefined
  }

  /**
   * 构建 Agent 上下文
   * 使用 VCP 规范的发言标记头格式：[发言者的发言]: ...
   */
  private buildAgentContext(agent: GroupAgent): string {
    const visibleMessages = this.state.messages.filter((m) => {
      if (this.state.config.contextSharing === 'full') return true
      if (this.state.config.contextSharing === 'isolated') return m.agentId === agent.id
      return m.isPublic || m.visibleTo?.includes(agent.id)
    })

    return visibleMessages
      .slice(-20) // 最近20条
      .map((m) => `[${m.agentName}的发言]: ${m.content}`)
      .join('\n')
  }

  /**
   * 格式化消息为 VCP 发言标记头格式
   * @param agentName 发言者名称
   * @param content 发言内容
   * @returns 格式化后的消息
   */
  formatSpeakerMessage(agentName: string, content: string): string {
    return `[${agentName}的发言]: ${content}`
  }

  /**
   * 获取群聊会话信息（用于 VCPChatGroupSessionWatcher 占位符）
   */
  getSessionInfo(): {
    id: string
    name: string
    agents: Array<{
      id: string
      name: string
      displayName: string
      role: string
      status: string
    }>
    currentRound: number
    currentSpeaker?: string
    recentMessages: Array<{
      agentId: string
      agentName: string
      content: string
      timestamp: string
      type: string
    }>
    topic?: string
    isActive: boolean
  } {
    return {
      id: this.state.config.id,
      name: this.state.config.name,
      agents: Array.from(this.state.agents.values()).map((a) => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName,
        role: a.role,
        status: a.status
      })),
      currentRound: this.state.currentRound,
      currentSpeaker: this.state.currentSpeaker,
      recentMessages: this.state.messages.slice(-10).map((m) => ({
        agentId: m.agentId,
        agentName: m.agentName,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        type: m.type
      })),
      topic: this.state.topic,
      isActive: this.state.isActive
    }
  }

  /**
   * 更新消息可见性
   */
  private updateVisibility(message: GroupMessage): void {
    if (message.isPublic) {
      for (const agent of this.state.agents.values()) {
        agent.visibleMessageIds.push(message.id)
      }
    } else if (message.visibleTo) {
      for (const agentId of message.visibleTo) {
        const agent = this.state.agents.get(agentId)
        if (agent) {
          agent.visibleMessageIds.push(message.id)
        }
      }
    }
  }

  /**
   * 生成 Agent 响应 (使用 MCPBridge 调用 AI)
   */
  private async generateAgentResponse(agent: GroupAgent, context: string, trigger: string): Promise<string> {
    logger.debug('Generating response', { agentId: agent.id, trigger })

    try {
      // 1. 获取可用的 MCP 工具
      const tools = await this.getAvailableMCPTools()

      // 2. 构建工具描述
      const toolDescriptions = this.formatToolDescriptions(tools)

      // 3. 构建系统提示词
      const rawSystemPrompt = this.buildAgentSystemPrompt(agent, toolDescriptions)

      // 3.1 解析系统提示词中的占位符 ({{VCPChatGroupSessionWatcher}} 等)
      const systemPrompt = await this.resolvePlaceholdersInPrompt(rawSystemPrompt)

      // 4. 构建用户消息（包含上下文和触发内容）
      const userPrompt = this.buildUserPrompt(context, trigger)

      // 5. 调用 AI 生成响应
      const response = await mcpBridge.generateText({
        systemPrompt,
        userPrompt
      })

      // 6. 解析并执行工具调用
      const processedResponse = await this.processToolCalls(response, tools)

      // 7. 广播 Agent 私聊预览事件
      try {
        const vcpInfoService = getVCPInfoService()
        vcpInfoService.broadcastEvent({
          type: 'AGENT_PRIVATE_CHAT_PREVIEW',
          agentName: agent.displayName,
          agentId: agent.id,
          query: trigger,
          response: processedResponse.slice(0, 1000), // 限制长度
          timestamp: Date.now()
        })
      } catch (broadcastError) {
        logger.debug('Failed to broadcast AGENT_PRIVATE_CHAT_PREVIEW event', {
          error: String(broadcastError)
        })
      }

      return processedResponse
    } catch (error) {
      logger.error('Failed to generate agent response', error as Error)
      return `[${agent.displayName}]: 抱歉，我遇到了一些问题，无法回应。`
    }
  }

  /**
   * 获取可用的 MCP 工具
   */
  private async getAvailableMCPTools(): Promise<SimpleMCPTool[]> {
    try {
      // 从配置中获取活跃的 MCP 服务器
      // 这里简化处理，实际应该从 store 或配置中读取
      const tools: SimpleMCPTool[] = []

      // 内置工具: agent-collab, diary, memory, web-search
      const builtinTools: SimpleMCPTool[] = [
        // Agent 协作工具
        {
          name: 'collab_assign_task',
          description: '分配任务给其他 Agent',
          inputSchema: {
            type: 'object',
            properties: {
              targetAgentId: { type: 'string', description: '目标 Agent ID' },
              taskDescription: { type: 'string', description: '任务描述' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: '优先级' },
              deadline: { type: 'string', description: '截止时间 (ISO 格式)' }
            },
            required: ['targetAgentId', 'taskDescription']
          },
          serverId: '@cherry/agent-collab'
        },
        {
          name: 'collab_send_message',
          description: '发送消息给其他 Agent',
          inputSchema: {
            type: 'object',
            properties: {
              targetAgentId: { type: 'string', description: '目标 Agent ID' },
              messageType: {
                type: 'string',
                enum: ['direct', 'broadcast', 'task_assign', 'vote_request'],
                description: '消息类型'
              },
              content: { type: 'string', description: '消息内容' }
            },
            required: ['targetAgentId', 'messageType', 'content']
          },
          serverId: '@cherry/agent-collab'
        },
        {
          name: 'collab_vote',
          description: '发起或参与投票',
          inputSchema: {
            type: 'object',
            properties: {
              voteId: { type: 'string', description: '投票 ID (参与时需要)' },
              topic: { type: 'string', description: '投票主题 (发起时需要)' },
              options: { type: 'array', items: { type: 'string' }, description: '投票选项 (发起时需要)' },
              choice: { type: 'string', description: '选择的选项 (参与时需要)' }
            }
          },
          serverId: '@cherry/agent-collab'
        },
        {
          name: 'collab_share_knowledge',
          description: '共享知识给其他 Agent',
          inputSchema: {
            type: 'object',
            properties: {
              targetAgentId: { type: 'string', description: '目标 Agent ID (为空则广播)' },
              knowledgeType: { type: 'string', description: '知识类型' },
              content: { type: 'string', description: '知识内容' }
            },
            required: ['knowledgeType', 'content']
          },
          serverId: '@cherry/agent-collab'
        },
        // 日记工具
        {
          name: 'diary_search',
          description: '搜索日记/笔记内容',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词' },
              topK: { type: 'number', description: '返回结果数量', default: 5 }
            },
            required: ['query']
          },
          serverId: '@cherry/diary'
        },
        {
          name: 'diary_write',
          description: '写入日记条目',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: '日记内容' },
              tags: { type: 'array', items: { type: 'string' }, description: '标签' }
            },
            required: ['content']
          },
          serverId: '@cherry/diary'
        },
        // 记忆工具
        {
          name: 'memory_search',
          description: '搜索记忆/知识库内容',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词' },
              limit: { type: 'number', description: '返回结果数量', default: 10 }
            },
            required: ['query']
          },
          serverId: '@cherry/memory'
        },
        // 网络搜索工具
        {
          name: 'web_search',
          description: '搜索互联网信息',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词' },
              maxResults: { type: 'number', description: '返回结果数量', default: 5 }
            },
            required: ['query']
          },
          serverId: '@cherry/brave-search'
        }
      ]

      tools.push(...builtinTools)
      return tools
    } catch (error) {
      logger.warn('Failed to get MCP tools', error as Error)
      return []
    }
  }

  /**
   * 格式化工具描述
   */
  private formatToolDescriptions(tools: SimpleMCPTool[]): string {
    if (tools.length === 0) return ''

    const descriptions = tools
      .map((tool, index) => {
        const params = tool.inputSchema?.properties
          ? Object.entries(tool.inputSchema.properties)
              .map(([key, val]: [string, any]) => `  - ${key}: ${val.description || val.type}`)
              .join('\n')
          : '  (无参数)'

        return `${index + 1}. ${tool.name}\n   描述: ${tool.description}\n   参数:\n${params}`
      })
      .join('\n\n')

    return `\n\n可用工具:\n${descriptions}\n\n使用工具时，请使用以下格式:\n<<<[TOOL_REQUEST]>>>\ntool: 工具名称\nparams: JSON格式的参数\n<<<[/TOOL_REQUEST]>>>`
  }

  /**
   * 构建 Agent 系统提示词
   */
  private buildAgentSystemPrompt(agent: GroupAgent, toolDescriptions: string): string {
    const roleDescription = {
      host: '你是群聊的主持人，负责引导话题和协调发言。',
      participant: '你是群聊的普通参与者，积极参与讨论。',
      observer: '你是群聊的观察者，通常只在被问到时才发言。',
      expert: '你是群聊的专家，专注于你的专业领域提供见解。',
      moderator: '你是群聊的协调者，负责解决分歧和保持讨论的建设性。'
    }

    const basePrompt = `你是 ${agent.displayName}。${roleDescription[agent.role]}

${agent.systemPrompt || ''}

请以简洁、自然的方式回应，就像在真实的群聊中一样。回应应该简短有力（通常1-3句话），除非需要详细解释。`

    return basePrompt + toolDescriptions
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(context: string, trigger: string): string {
    const recentContext = context.split('\n').slice(-10).join('\n') // 保留最近10条

    return `以下是群聊的最近对话:\n\n${recentContext}\n\n请根据以上对话内容进行回应。\n\n触发条件: ${trigger}`
  }

  /**
   * 构建群聊会话信息 (用于占位符注入)
   */
  private buildGroupSessionInfo(): GroupSessionInfo {
    const agents = Array.from(this.state.agents.values())
    const recentMessages = this.state.messages.slice(-20) // 最近20条消息

    return {
      id: this.state.config.id,
      name: this.state.config.name,
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        displayName: agent.displayName,
        role: agent.role,
        status: agent.status
      })),
      currentRound: this.state.currentRound,
      currentSpeaker: this.state.currentSpeaker,
      recentMessages: recentMessages.map((msg) => ({
        agentId: msg.agentId,
        agentName: msg.agentName,
        content: msg.content.substring(0, 500), // 截断过长内容
        timestamp: msg.timestamp.toISOString(),
        type: msg.type
      })),
      topic: this.state.topic,
      isActive: this.state.isActive
    }
  }

  /**
   * 解析提示词中的占位符
   * 支持 {{VCPChatGroupSessionWatcher}}, {{VCPChatCanvas}} 等
   */
  private async resolvePlaceholdersInPrompt(prompt: string, canvasContent?: string): Promise<string> {
    try {
      const runtime = VCPRuntime.getInstance()

      // 构建扩展上下文
      const context: ExtendedPlaceholderContext = {
        role: 'system',
        groupSession: this.buildGroupSessionInfo(),
        canvasContent: canvasContent
          ? {
              type: 'text',
              content: canvasContent
            }
          : undefined
      }

      return await runtime.resolvePlaceholders(prompt, context)
    } catch (error) {
      logger.warn('Failed to resolve placeholders in prompt', {
        error: error instanceof Error ? error.message : String(error)
      })
      return prompt // 失败时返回原始提示词
    }
  }

  /**
   * 处理工具调用
   */
  private async processToolCalls(response: string, _tools: SimpleMCPTool[]): Promise<string> {
    // 检测 TOOL_REQUEST 标记
    const toolRequestPattern = /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[\/TOOL_REQUEST\]>>>/g

    let processedResponse = response
    let match: RegExpExecArray | null

    while ((match = toolRequestPattern.exec(response)) !== null) {
      const toolRequest = match[1].trim()
      const toolResult = await this.executeToolRequest(toolRequest)

      // 替换工具请求为结果
      const resultMarker = `<<<[TOOL_RESULT]>>>\n${toolResult}\n<<<[/TOOL_RESULT]>>>`
      processedResponse = processedResponse.replace(match[0], resultMarker)
    }

    return processedResponse
  }

  /**
   * 执行工具请求
   */
  private async executeToolRequest(request: string): Promise<string> {
    try {
      // 解析工具名称和参数
      const toolMatch = request.match(/tool:\s*(\w+)/i)
      const paramsMatch = request.match(/params:\s*({[\s\S]*})/i)

      if (!toolMatch) {
        return 'Error: 无法解析工具名称'
      }

      const toolName = toolMatch[1]
      const params = paramsMatch ? JSON.parse(paramsMatch[1]) : {}

      logger.debug('Executing tool request', { toolName, params })

      // 根据工具名称调用对应的 MCPBridge 方法
      let result: unknown

      switch (toolName) {
        case 'web_search':
          result = await mcpBridge.webSearch({
            query: params.query,
            maxResults: params.maxResults || 5
          })
          break
        case 'memory_search':
        case 'diary_search':
          result = await mcpBridge.searchKnowledge({
            knowledgeBaseId: toolName === 'diary_search' ? 'diary' : 'memory',
            query: params.query,
            topK: params.topK || params.limit || 10
          })
          break
        default:
          // 对于未知工具，尝试使用 generateText 来模拟
          result = await mcpBridge.generateText({
            userPrompt: `工具 ${toolName} 暂不可用。请求参数: ${JSON.stringify(params)}`
          })
      }

      return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    } catch (error) {
      logger.error('Tool execution failed', error as Error)
      return `Error: ${(error as Error).message}`
    }
  }

  /**
   * 生成摘要
   */
  private async generateSummary(): Promise<string> {
    const messageCount = this.state.messages.length
    const agentCount = this.state.agents.size
    const duration = this.state.endTime
      ? (this.state.endTime.getTime() - (this.state.startTime?.getTime() || 0)) / 1000
      : 0

    return `群聊结束。参与者: ${agentCount}，消息数: ${messageCount}，持续时间: ${duration}秒`
  }

  /**
   * 订阅事件
   */
  subscribe(listener: (event: GroupChatEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  /**
   * 发送事件
   */
  private emit(event: GroupChatEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        logger.error('Event listener error', error as Error)
      }
    }
  }

  /**
   * 获取状态
   */
  getState(): Readonly<GroupChatState> {
    return this.state
  }

  /**
   * 获取消息历史
   */
  getMessages(): GroupMessage[] {
    return [...this.state.messages]
  }

  /**
   * 获取 Agent 列表
   */
  getAgents(): GroupAgent[] {
    return Array.from(this.state.agents.values())
  }

  /**
   * 中断正在进行的请求
   * @param agentId 可选，指定要中断的 Agent ID，如果不指定则中断所有
   */
  async interrupt(agentId?: string): Promise<void> {
    logger.info('Interrupting group chat', { agentId })

    // 释放发言锁
    this.speakingLock = false

    // 清空发言队列
    if (!agentId) {
      this.state.speakingQueue = []
    } else {
      this.state.speakingQueue = this.state.speakingQueue.filter((id) => id !== agentId)
    }

    // 更新 Agent 状态
    if (agentId) {
      const agent = this.state.agents.get(agentId)
      if (agent && (agent.status === 'thinking' || agent.status === 'speaking')) {
        agent.status = 'idle'
      }
    } else {
      // 中断所有正在执行的 Agent
      for (const agent of this.state.agents.values()) {
        if (agent.status === 'thinking' || agent.status === 'speaking') {
          agent.status = 'idle'
        }
      }
    }

    // 清除当前发言者
    this.state.currentSpeaker = undefined

    logger.info('Group chat interrupted successfully', { agentId })
  }

  /**
   * 重新回复消息（删除原消息后让 Agent 重新生成）
   * @param messageId 要重新回复的消息 ID
   * @param agentId 要重新回复的 Agent ID
   * @returns 新生成的消息
   */
  async redoMessage(messageId: string, agentId: string): Promise<GroupMessage | null> {
    logger.info('Redo message requested', { messageId, agentId })

    const agent = this.state.agents.get(agentId)
    if (!agent) {
      logger.warn('Agent not found for redo', { agentId })
      return null
    }

    // 找到原消息
    const originalMessageIndex = this.state.messages.findIndex((m) => m.id === messageId)
    if (originalMessageIndex === -1) {
      logger.warn('Original message not found for redo', { messageId })
      return null
    }

    const originalMessage = this.state.messages[originalMessageIndex]

    // 找到触发这条消息的上下文（原消息之前的最后一条用户消息或其他 Agent 消息）
    const previousMessages = this.state.messages.slice(0, originalMessageIndex)
    const triggerMessage = previousMessages.reverse().find((m) => m.agentId !== agentId)

    // 删除原消息
    this.state.messages.splice(originalMessageIndex, 1)

    // 从所有 Agent 的可见消息中移除
    for (const a of this.state.agents.values()) {
      a.visibleMessageIds = a.visibleMessageIds.filter((id) => id !== messageId)
    }

    // 重新生成回复
    const context = triggerMessage
      ? `重新回复: ${triggerMessage.content}`
      : `重新生成之前的回复: ${originalMessage.content.substring(0, 100)}`

    const newMessage = await this.requestSpeak(agentId, context)

    logger.info('Message redo completed', {
      originalMessageId: messageId,
      newMessageId: newMessage?.id,
      agentId
    })

    return newMessage
  }

  // ==================== 话题自动总结 ====================

  /** 上次自动总结时的消息数 */
  private lastAutoSummaryMessageCount = 0

  /**
   * 检查是否需要触发自动总结
   */
  private async checkAutoSummaryThreshold(): Promise<void> {
    const autoSummary = this.state.config.autoSummary
    if (!autoSummary?.enabled) return

    const messageCount = this.state.messages.filter((m) => m.type === 'chat').length
    const roundCount = this.state.currentRound

    // 检查消息数阈值
    const messagesSinceLastSummary = messageCount - this.lastAutoSummaryMessageCount
    const shouldSummarizeByMessages = messagesSinceLastSummary >= autoSummary.messageThreshold

    // 检查轮次阈值
    const shouldSummarizeByRounds =
      autoSummary.roundThreshold && roundCount > 0 && roundCount % autoSummary.roundThreshold === 0

    if (shouldSummarizeByMessages || shouldSummarizeByRounds) {
      logger.info('Auto-summary threshold reached', {
        messageCount,
        roundCount,
        threshold: autoSummary.messageThreshold,
        roundThreshold: autoSummary.roundThreshold
      })

      await this.generateAutoSummary()
      this.lastAutoSummaryMessageCount = messageCount
    }
  }

  /**
   * 生成自动总结
   */
  private async generateAutoSummary(): Promise<void> {
    const recentMessages = this.state.messages.slice(-20) // 最近20条消息
    if (recentMessages.length === 0) return

    // 构建总结上下文
    const contextLines = recentMessages.map((m) => `${m.agentName}: ${m.content.substring(0, 200)}`).join('\n')

    // 使用主持人或第一个 Agent 来生成总结
    const summarizerAgent = this.state.config.hostAgentId
      ? this.state.agents.get(this.state.config.hostAgentId)
      : Array.from(this.state.agents.values())[0]

    if (!summarizerAgent) {
      logger.warn('No agent available for auto-summary')
      return
    }

    try {
      // 生成总结提示词
      const summaryPrompt = `请简洁总结以下群聊讨论的要点（不超过100字）：\n\n${contextLines}`

      // 调用 Agent 生成总结
      const response = await this.generateAgentResponse(summarizerAgent, contextLines, summaryPrompt)

      // 提取总结内容（取第一行或整个响应）
      const summary = response.split('\n')[0].substring(0, 200)

      // 更新话题
      this.state.topic = summary
      this.state.summary = response

      // 添加系统消息
      const summaryMessage: GroupMessage = {
        id: `summary_${Date.now()}`,
        agentId: 'system',
        agentName: '系统',
        content: `📋 话题总结：${summary}`,
        timestamp: new Date(),
        type: 'summary',
        mentions: [],
        isPublic: true
      }
      this.state.messages.push(summaryMessage)

      // 调用回调
      if (this.state.config.autoSummary?.onSummaryGenerated) {
        this.state.config.autoSummary.onSummaryGenerated(summary, this.state.topic || '')
      }

      logger.info('Auto-summary generated', { summary: summary.substring(0, 50) })
    } catch (error) {
      logger.error('Failed to generate auto-summary', error as Error)
    }
  }
}

// 工厂函数
export function createGroupChatOrchestrator(config?: Partial<GroupChatConfig>): GroupChatOrchestrator {
  return new GroupChatOrchestrator(config)
}
