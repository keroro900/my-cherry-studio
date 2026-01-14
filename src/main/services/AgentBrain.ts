/**
 * AgentBrain - 主控大脑
 *
 * 高层次协调器，负责:
 * 1. 决定下一个发言者
 * 2. 处理 Agent 调用请求
 * 3. 协调多 Agent 任务
 * 4. 发起群体投票
 *
 * 与 GroupChatOrchestrator 的关系:
 * - GroupChatOrchestrator: 处理群聊场景的发言编排
 * - AgentBrain: 更高层的决策者，可以在任何场景使用
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'

import { GroupChatOrchestrator, type GroupChatConfig } from '../knowledge/agent/GroupChatOrchestrator'
import type { UnifiedAgent } from '../knowledge/agent/UnifiedAgentAdapter'
import { getUnifiedAgentService, type VoteOption, type VoteRequest } from './UnifiedAgentService'

const logger = loggerService.withContext('AgentBrain')

// ==================== 类型定义 ====================

/**
 * 上下文信息
 */
export interface ChatContext {
  conversationId: string
  lastMessage?: string
  lastSpeakerId?: string
  messageHistory: Array<{
    role: 'user' | 'assistant'
    content: string
    agentId?: string
  }>
  mentions?: string[]
  keywords?: string[]
  userIntent?: 'question' | 'command' | 'chat' | 'feedback'
}

/**
 * Agent 响应
 */
export interface AgentResponse {
  agentId: string
  agentName: string
  content: string
  confidence: number
  suggestedFollowUp?: string[]
  metadata?: Record<string, unknown>
}

/**
 * 多 Agent 任务
 */
export interface MultiAgentTask {
  id: string
  description: string
  requiredAgentIds?: string[]
  strategy: 'parallel' | 'sequential' | 'vote'
  subtasks?: Array<{
    agentId: string
    description: string
  }>
  deadline?: number
}

/**
 * 任务结果
 */
export interface TaskResult {
  taskId: string
  success: boolean
  results: Array<{
    agentId: string
    result: string
    success: boolean
  }>
  aggregatedResult?: string
  completedAt: number
}

/**
 * Brain 配置
 */
export interface AgentBrainConfig {
  /** 默认发言模式 */
  defaultSpeakingMode?: 'sequential' | 'random' | 'naturerandom'
  /** 最大等待时间 (ms) */
  maxWaitTime?: number
  /** 是否启用自动调用 */
  enableAutoInvoke?: boolean
  /** 调用阈值 (0-1) */
  invokeThreshold?: number
}

// ==================== AgentBrain ====================

export class AgentBrain {
  private static instance: AgentBrain | null = null

  private config: Required<AgentBrainConfig>
  private activeGroupChats: Map<string, GroupChatOrchestrator> = new Map()

  private constructor(config: AgentBrainConfig = {}) {
    this.config = {
      defaultSpeakingMode: config.defaultSpeakingMode || 'naturerandom',
      maxWaitTime: config.maxWaitTime || 30000,
      enableAutoInvoke: config.enableAutoInvoke ?? true,
      invokeThreshold: config.invokeThreshold ?? 0.7
    }
    logger.info('AgentBrain created', { config: this.config })
  }

  static getInstance(config?: AgentBrainConfig): AgentBrain {
    if (!AgentBrain.instance) {
      AgentBrain.instance = new AgentBrain(config)
    }
    return AgentBrain.instance
  }

  // ==================== 发言决策 ====================

  /**
   * 决定下一个发言者
   *
   * 基于以下因素:
   * 1. @提及优先
   * 2. 关键词匹配
   * 3. 专长领域匹配
   * 4. 角色权重
   * 5. 发言冷却
   */
  async decideNextSpeaker(context: ChatContext): Promise<UnifiedAgent | null> {
    const agentService = getUnifiedAgentService()
    const agents = await agentService.getAllAgents()

    if (agents.length === 0) {
      logger.warn('No agents available for speaking')
      return null
    }

    // 过滤启用的 Agent
    const enabledAgents = agents.filter((a) => a.enabled)
    if (enabledAgents.length === 0) {
      return null
    }

    // 1. @提及优先
    if (context.mentions && context.mentions.length > 0) {
      const mentionedAgent = enabledAgents.find(
        (a) => context.mentions!.includes(a.name) || context.mentions!.includes(a.id)
      )
      if (mentionedAgent) {
        logger.debug('Selected agent by mention', { agentId: mentionedAgent.id })
        return mentionedAgent
      }
    }

    // 2. 关键词匹配
    if (context.keywords && context.keywords.length > 0) {
      for (const agent of enabledAgents) {
        for (const keyword of context.keywords) {
          if (agent.keywords.some((k) => k.toLowerCase().includes(keyword.toLowerCase()))) {
            logger.debug('Selected agent by keyword', { agentId: agent.id, keyword })
            return agent
          }
        }
      }
    }

    // 3. 基于上下文内容匹配专长
    if (context.lastMessage) {
      const messageWords = context.lastMessage.toLowerCase().split(/\s+/)

      let bestMatch: UnifiedAgent | null = null
      let bestScore = 0

      for (const agent of enabledAgents) {
        // 跳过刚发言的 Agent
        if (agent.id === context.lastSpeakerId) continue

        let score = 0

        // 专长匹配
        for (const expertise of agent.expertise) {
          const lowerExpertise = expertise.toLowerCase()
          for (const word of messageWords) {
            if (lowerExpertise.includes(word) || word.includes(lowerExpertise)) {
              score += 10
            }
          }
        }

        // 关键词匹配
        for (const keyword of agent.keywords) {
          const lowerKeyword = keyword.toLowerCase()
          for (const word of messageWords) {
            if (lowerKeyword.includes(word) || word.includes(lowerKeyword)) {
              score += 5
            }
          }
        }

        // 角色加成
        switch (agent.groupRole) {
          case 'host':
            score += 15
            break
          case 'expert':
            score += 10
            break
          case 'moderator':
            score += 8
            break
          case 'participant':
            score += 5
            break
          case 'observer':
            score -= 20
            break
        }

        // 优先级加成
        score += agent.priority / 10

        if (score > bestScore) {
          bestScore = score
          bestMatch = agent
        }
      }

      if (bestMatch && bestScore > 0) {
        logger.debug('Selected agent by expertise match', {
          agentId: bestMatch.id,
          score: bestScore
        })
        return bestMatch
      }
    }

    // 4. 默认选择优先级最高的非观察者
    const sortedAgents = enabledAgents
      .filter((a) => a.groupRole !== 'observer' && a.id !== context.lastSpeakerId)
      .sort((a, b) => b.priority - a.priority)

    if (sortedAgents.length > 0) {
      logger.debug('Selected agent by priority', { agentId: sortedAgents[0].id })
      return sortedAgents[0]
    }

    return null
  }

  // ==================== Agent 调用 ====================

  /**
   * 处理 Agent 调用请求
   *
   * 当用户或 Agent 请求调用另一个 Agent 时调用
   */
  async handleAgentInvocation(callerId: string, targetName: string, request: string): Promise<AgentResponse> {
    const agentService = getUnifiedAgentService()

    // 查找目标 Agent
    let targetAgent = await agentService.getAgentByName(targetName)
    if (!targetAgent) {
      targetAgent = await agentService.getAgentById(targetName)
    }

    if (!targetAgent) {
      return {
        agentId: '',
        agentName: targetName,
        content: `Agent "${targetName}" not found`,
        confidence: 0
      }
    }

    // 检查目标 Agent 是否允许被调用
    if (!targetAgent.enabled) {
      return {
        agentId: targetAgent.id,
        agentName: targetAgent.name,
        content: `Agent "${targetName}" is not available`,
        confidence: 0
      }
    }

    // 发送消息给目标 Agent
    await agentService.sendMessage(callerId, targetAgent.id, request, {
      type: 'invocation',
      callerName: callerId
    })

    logger.debug('Agent invocation sent', {
      caller: callerId,
      target: targetAgent.id,
      request: request.substring(0, 100)
    })

    // 返回调用确认
    return {
      agentId: targetAgent.id,
      agentName: targetAgent.displayName,
      content: `Request sent to ${targetAgent.displayName}`,
      confidence: 1.0,
      metadata: {
        pending: true,
        systemPrompt: targetAgent.systemPrompt
      }
    }
  }

  // ==================== 多 Agent 协调 ====================

  /**
   * 协调多 Agent 任务
   */
  async coordinateTask(task: MultiAgentTask): Promise<TaskResult> {
    const agentService = getUnifiedAgentService()
    const startTime = Date.now()

    const results: TaskResult['results'] = []

    if (task.strategy === 'parallel') {
      // 并行执行
      const promises = (task.subtasks || []).map(async (subtask) => {
        const agentTask = await agentService.createTask(subtask.agentId, subtask.description, {
          type: 'action',
          priority: 'normal'
        })

        return {
          agentId: subtask.agentId,
          result: agentTask.result || 'Task created',
          success: agentTask.status !== 'failed'
        }
      })

      const parallelResults = await Promise.all(promises)
      results.push(...parallelResults)
    } else if (task.strategy === 'sequential') {
      // 顺序执行
      for (const subtask of task.subtasks || []) {
        const agentTask = await agentService.createTask(subtask.agentId, subtask.description, {
          type: 'action',
          priority: 'normal'
        })

        results.push({
          agentId: subtask.agentId,
          result: agentTask.result || 'Task created',
          success: agentTask.status !== 'failed'
        })

        // 检查是否超时
        if (task.deadline && Date.now() > task.deadline) {
          break
        }
      }
    } else if (task.strategy === 'vote') {
      // 投票模式
      const voteOptions: VoteOption[] = (task.subtasks || []).map((s, i) => ({
        id: `option_${i}`,
        label: s.description
      }))

      const vote = await agentService.initiateVote(
        task.requiredAgentIds?.[0] || 'system',
        task.description,
        voteOptions,
        task.requiredAgentIds
      )

      // 投票结果作为任务结果
      results.push({
        agentId: 'vote',
        result: `Vote initiated: ${vote.id}`,
        success: true
      })
    }

    // 聚合结果
    const aggregatedResult = results
      .filter((r) => r.success)
      .map((r) => `[${r.agentId}]: ${r.result}`)
      .join('\n')

    logger.debug('Task coordination completed', {
      taskId: task.id,
      strategy: task.strategy,
      resultCount: results.length,
      duration: Date.now() - startTime
    })

    return {
      taskId: task.id,
      success: results.some((r) => r.success),
      results,
      aggregatedResult,
      completedAt: Date.now()
    }
  }

  // ==================== 群体投票 ====================

  /**
   * 发起群体投票
   */
  async initiateVote(topic: string, options: string[], participantIds?: string[]): Promise<VoteRequest> {
    const agentService = getUnifiedAgentService()

    const voteOptions: VoteOption[] = options.map((opt, i) => ({
      id: `option_${i}`,
      label: opt
    }))

    return agentService.initiateVote('brain', topic, voteOptions, participantIds)
  }

  // ==================== 群聊管理 ====================

  /**
   * 创建群聊
   */
  createGroupChat(config: Partial<GroupChatConfig>): GroupChatOrchestrator {
    const orchestrator = new GroupChatOrchestrator({
      ...config,
      speakingMode: config.speakingMode || this.config.defaultSpeakingMode
    })

    const chatId = config.id || `group_${Date.now()}`
    this.activeGroupChats.set(chatId, orchestrator)

    logger.debug('Group chat created', { chatId })

    return orchestrator
  }

  /**
   * 获取群聊
   */
  getGroupChat(chatId: string): GroupChatOrchestrator | undefined {
    return this.activeGroupChats.get(chatId)
  }

  /**
   * 结束群聊
   */
  async endGroupChat(chatId: string): Promise<boolean> {
    const orchestrator = this.activeGroupChats.get(chatId)
    if (orchestrator) {
      await orchestrator.end()
      this.activeGroupChats.delete(chatId)
      return true
    }
    return false
  }

  // ==================== 自动调用判断 ====================

  /**
   * 判断是否应该自动调用其他 Agent
   */
  async shouldAutoInvoke(context: ChatContext): Promise<{
    should: boolean
    targetAgent?: UnifiedAgent
    reason?: string
  }> {
    if (!this.config.enableAutoInvoke) {
      return { should: false }
    }

    // 检查是否有明确的 @提及
    if (context.mentions && context.mentions.length > 0) {
      const agentService = getUnifiedAgentService()
      for (const mention of context.mentions) {
        const agent = await agentService.getAgentByName(mention)
        if (agent && agent.enabled) {
          return {
            should: true,
            targetAgent: agent,
            reason: `User mentioned @${mention}`
          }
        }
      }
    }

    // 检查是否需要专家意见
    if (context.lastMessage && context.userIntent === 'question') {
      const agentService = getUnifiedAgentService()
      const experts = (await agentService.getAllAgents()).filter((a) => a.groupRole === 'expert' && a.enabled)

      for (const expert of experts) {
        // 检查专长匹配
        const messageWords = context.lastMessage.toLowerCase().split(/\s+/)
        const matchScore = expert.expertise.reduce((score, exp) => {
          const lowerExp = exp.toLowerCase()
          return score + messageWords.filter((w) => lowerExp.includes(w) || w.includes(lowerExp)).length
        }, 0)

        if (matchScore >= 2) {
          return {
            should: true,
            targetAgent: expert,
            reason: `Expert "${expert.name}" matches topic`
          }
        }
      }
    }

    return { should: false }
  }

  // ==================== 工具方法 ====================

  /**
   * 获取配置
   */
  getConfig(): Required<AgentBrainConfig> {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgentBrainConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('AgentBrain config updated', { config: this.config })
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    for (const orchestrator of this.activeGroupChats.values()) {
      await orchestrator.end()
    }
    this.activeGroupChats.clear()
    logger.info('AgentBrain cleaned up')
  }
}

// ==================== 导出 ====================

let brainInstance: AgentBrain | null = null

export function getAgentBrain(config?: AgentBrainConfig): AgentBrain {
  if (!brainInstance) {
    brainInstance = AgentBrain.getInstance(config)
  }
  return brainInstance
}

export async function resetAgentBrain(): Promise<void> {
  if (brainInstance) {
    await brainInstance.cleanup()
    brainInstance = null
  }
}
