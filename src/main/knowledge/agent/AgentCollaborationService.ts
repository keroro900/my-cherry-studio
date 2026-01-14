/**
 * Agent 群体协作服务
 *
 * 实现 VCPToolBox 的 Agent 群体协作理念:
 * - AgentAssistant 协议: Agent 间消息传递机制
 * - 共享知识库: 自动分享有价值的经验到公共库
 * - 任务分发: 将复杂任务拆分给专长 Agent
 * - 群体决策: 多 Agent 投票/共识机制
 */

import { loggerService } from '@logger'
import { v4 as uuid } from 'uuid'

const logger = loggerService.withContext('AgentCollaborationService')

// ==================== 类型定义 ====================

/**
 * Agent 消息类型
 */
export type AgentMessageType =
  | 'request' // 请求协助
  | 'response' // 响应请求
  | 'broadcast' // 广播消息
  | 'knowledge_share' // 知识分享
  | 'task_assign' // 任务分配
  | 'vote_request' // 投票请求
  | 'vote_response' // 投票响应
  | 'status_update' // 状态更新

/**
 * Agent 间消息
 */
export interface AgentMessage {
  id: string
  type: AgentMessageType
  fromAgentId: string
  toAgentId?: string // undefined 表示广播
  content: string
  metadata?: Record<string, unknown>
  timestamp: Date
  replyTo?: string // 回复的消息 ID
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  expiresAt?: Date
}

/**
 * 任务定义
 */
export interface AgentTask {
  id: string
  title: string
  description: string
  creatorAgentId: string
  assignedAgentId?: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  dependencies?: string[] // 依赖的任务 ID
  subtasks?: AgentTask[]
  result?: unknown
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

/**
 * 投票会话
 */
export interface VotingSession {
  id: string
  topic: string
  description: string
  options: VotingOption[]
  initiatorAgentId: string
  participantAgentIds: string[]
  votes: Map<string, string> // agentId -> optionId
  status: 'open' | 'closed' | 'cancelled'
  deadline: Date
  createdAt: Date
  result?: VotingResult
}

export interface VotingOption {
  id: string
  label: string
  description?: string
}

export interface VotingResult {
  winnerId: string
  winnerLabel: string
  totalVotes: number
  breakdown: Map<string, number> // optionId -> voteCount
}

/**
 * 知识分享条目
 */
export interface KnowledgeShareEntry {
  id: string
  sourceAgentId: string
  title: string
  content: string
  category: string
  tags: string[]
  quality: number // 0-1, 由其他 Agent 评分
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Agent 能力描述
 */
export interface AgentCapability {
  agentId: string
  agentName: string
  specialties: string[] // 专长领域
  skills: string[] // 具体技能
  availability: 'available' | 'busy' | 'offline'
  loadFactor: number // 0-1, 当前负载
  successRate: number // 历史成功率
}

// ==================== 服务实现 ====================

// 配置常量
const MAX_MESSAGES = 1000 // 最大消息数量
const MAX_TASKS = 500 // 最大任务数量
const MAX_KNOWLEDGE_ENTRIES = 200 // 最大知识条目
const MESSAGE_RETENTION_HOURS = 24 // 消息保留时间（小时）
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 清理间隔（5分钟）

class AgentCollaborationService {
  private messages: AgentMessage[] = []
  private tasks: Map<string, AgentTask> = new Map()
  private votingSessions: Map<string, VotingSession> = new Map()
  private sharedKnowledge: Map<string, KnowledgeShareEntry> = new Map()
  private agentCapabilities: Map<string, AgentCapability> = new Map()
  private messageListeners: Map<string, Set<(msg: AgentMessage) => void>> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    // 启动定期清理
    this.startCleanupTimer()
  }

  /**
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, CLEANUP_INTERVAL_MS)
  }

  /**
   * 清理过期和超量数据
   */
  private cleanup(): void {
    const now = Date.now()
    const retentionMs = MESSAGE_RETENTION_HOURS * 60 * 60 * 1000

    // 清理过期消息
    const expiredMessagesBefore = this.messages.length
    this.messages = this.messages.filter((m) => {
      const messageAge = now - m.timestamp.getTime()
      return messageAge < retentionMs
    })

    // 如果消息超过上限，保留最新的
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES)
    }

    // 清理已完成/失败的旧任务
    const tasksToRemove: string[] = []
    this.tasks.forEach((task, id) => {
      if ((task.status === 'completed' || task.status === 'failed') && task.createdAt) {
        const taskAge = now - task.createdAt.getTime()
        if (taskAge > retentionMs) {
          tasksToRemove.push(id)
        }
      }
    })
    tasksToRemove.forEach((id) => this.tasks.delete(id))

    // 如果任务超过上限，删除最旧的已完成任务
    if (this.tasks.size > MAX_TASKS) {
      const sortedTasks = Array.from(this.tasks.entries())
        .filter(([_, t]) => t.status === 'completed' || t.status === 'failed')
        .sort((a, b) => (a[1].createdAt?.getTime() || 0) - (b[1].createdAt?.getTime() || 0))

      const toRemove = sortedTasks.slice(0, this.tasks.size - MAX_TASKS)
      toRemove.forEach(([id]) => this.tasks.delete(id))
    }

    // 清理过期投票会话
    this.votingSessions.forEach((session, id) => {
      if (session.status === 'closed') {
        const sessionAge = now - session.createdAt.getTime()
        if (sessionAge > retentionMs) {
          this.votingSessions.delete(id)
        }
      }
    })

    // 清理低质量知识
    if (this.sharedKnowledge.size > MAX_KNOWLEDGE_ENTRIES) {
      const sorted = Array.from(this.sharedKnowledge.entries()).sort(
        (a, b) => a[1].quality * a[1].usageCount - b[1].quality * b[1].usageCount
      )
      const toRemove = sorted.slice(0, this.sharedKnowledge.size - MAX_KNOWLEDGE_ENTRIES)
      toRemove.forEach(([id]) => this.sharedKnowledge.delete(id))
    }

    const messagesRemoved = expiredMessagesBefore - this.messages.length
    if (messagesRemoved > 0 || tasksToRemove.length > 0) {
      logger.debug('Collaboration cleanup completed', {
        messagesRemoved,
        tasksRemoved: tasksToRemove.length,
        currentMessages: this.messages.length,
        currentTasks: this.tasks.size
      })
    }
  }

  /**
   * 获取服务统计信息
   */
  getStats(): {
    messageCount: number
    taskCount: number
    votingSessionCount: number
    knowledgeEntryCount: number
    agentCount: number
  } {
    return {
      messageCount: this.messages.length,
      taskCount: this.tasks.size,
      votingSessionCount: this.votingSessions.size,
      knowledgeEntryCount: this.sharedKnowledge.size,
      agentCount: this.agentCapabilities.size
    }
  }

  /**
   * 销毁服务（清理定时器）
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    logger.info('AgentCollaborationService disposed')
  }

  // ==================== Agent 注册 ====================

  /**
   * 注册 Agent 能力
   */
  registerAgentCapability(capability: AgentCapability): void {
    this.agentCapabilities.set(capability.agentId, capability)
    logger.info('Agent capability registered', { agentId: capability.agentId })
  }

  /**
   * 更新 Agent 可用性
   */
  updateAgentAvailability(agentId: string, availability: AgentCapability['availability']): void {
    const cap = this.agentCapabilities.get(agentId)
    if (cap) {
      cap.availability = availability
      logger.debug('Agent availability updated:', { agentId, availability })
    }
  }

  /**
   * 获取可用 Agent 列表
   */
  getAvailableAgents(specialty?: string): AgentCapability[] {
    const agents = Array.from(this.agentCapabilities.values()).filter((a) => a.availability === 'available')

    if (specialty) {
      return agents.filter((a) => a.specialties.includes(specialty) || a.skills.includes(specialty))
    }

    return agents
  }

  /**
   * 查找最适合任务的 Agent
   */
  findBestAgentForTask(requiredSkills: string[]): AgentCapability | null {
    const available = this.getAvailableAgents()

    // 如果没有可用 Agent，返回 null
    if (available.length === 0) {
      return null
    }

    // 如果没有指定技能要求，按成功率和负载排序
    if (requiredSkills.length === 0) {
      const scored = available.map((agent) => {
        const finalScore = agent.successRate * 0.7 + (1 - agent.loadFactor) * 0.3
        return { agent, score: finalScore }
      })
      scored.sort((a, b) => b.score - a.score)
      return scored[0]?.agent || null
    }

    // 按技能匹配度和成功率排序
    const scored = available.map((agent) => {
      const matchedSkills = requiredSkills.filter(
        (skill) => agent.skills.includes(skill) || agent.specialties.includes(skill)
      )
      const skillScore = matchedSkills.length / requiredSkills.length
      const finalScore = skillScore * 0.6 + agent.successRate * 0.3 + (1 - agent.loadFactor) * 0.1
      return { agent, score: finalScore }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.agent || null
  }

  // ==================== 消息传递 ====================

  /**
   * 发送消息
   */
  sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuid(),
      timestamp: new Date()
    }

    this.messages.push(fullMessage)

    // 通知监听器
    if (message.toAgentId) {
      const listeners = this.messageListeners.get(message.toAgentId)
      if (listeners) {
        listeners.forEach((callback) => {
          try {
            callback(fullMessage)
          } catch (error) {
            logger.error('Message listener error:', error as Error)
          }
        })
      }
    } else {
      // 广播给所有监听器
      this.messageListeners.forEach((listeners) => {
        listeners.forEach((callback) => {
          try {
            callback(fullMessage)
          } catch (error) {
            logger.error('Message listener error:', error as Error)
          }
        })
      })
    }

    logger.debug('Agent message sent:', {
      id: fullMessage.id,
      type: fullMessage.type,
      from: fullMessage.fromAgentId,
      to: fullMessage.toAgentId || 'broadcast'
    })

    return fullMessage
  }

  /**
   * 请求协助
   */
  requestAssistance(
    fromAgentId: string,
    toAgentId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): AgentMessage {
    return this.sendMessage({
      type: 'request',
      fromAgentId,
      toAgentId,
      content,
      metadata,
      priority: 'normal'
    })
  }

  /**
   * 响应请求
   */
  respondToRequest(
    fromAgentId: string,
    originalMessageId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): AgentMessage {
    const originalMessage = this.messages.find((m) => m.id === originalMessageId)
    if (!originalMessage) {
      throw new Error(`Original message not found: ${originalMessageId}`)
    }

    return this.sendMessage({
      type: 'response',
      fromAgentId,
      toAgentId: originalMessage.fromAgentId,
      content,
      metadata,
      replyTo: originalMessageId
    })
  }

  /**
   * 广播消息
   */
  broadcast(fromAgentId: string, content: string, metadata?: Record<string, unknown>): AgentMessage {
    return this.sendMessage({
      type: 'broadcast',
      fromAgentId,
      content,
      metadata
    })
  }

  /**
   * 订阅消息 (支持多个监听器)
   * @returns 取消订阅函数
   */
  subscribeToMessages(agentId: string, callback: (msg: AgentMessage) => void): () => void {
    let listeners = this.messageListeners.get(agentId)
    if (!listeners) {
      listeners = new Set()
      this.messageListeners.set(agentId, listeners)
    }
    listeners.add(callback)

    // 返回取消订阅函数
    return () => {
      const currentListeners = this.messageListeners.get(agentId)
      if (currentListeners) {
        currentListeners.delete(callback)
        if (currentListeners.size === 0) {
          this.messageListeners.delete(agentId)
        }
      }
    }
  }

  /**
   * 取消订阅所有监听器
   */
  unsubscribeFromMessages(agentId: string): void {
    this.messageListeners.delete(agentId)
  }

  /**
   * 获取 Agent 的消息
   */
  getMessagesForAgent(agentId: string, limit: number = 50): AgentMessage[] {
    return this.messages.filter((m) => m.toAgentId === agentId || m.toAgentId === undefined).slice(-limit)
  }

  // ==================== 任务分发 ====================

  /**
   * 创建任务
   */
  createTask(task: Omit<AgentTask, 'id' | 'status' | 'createdAt' | 'updatedAt'>): AgentTask {
    const fullTask: AgentTask = {
      ...task,
      id: uuid(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.tasks.set(fullTask.id, fullTask)
    logger.info('Task created:', { id: fullTask.id, title: fullTask.title })

    return fullTask
  }

  /**
   * 分配任务给 Agent
   */
  assignTask(taskId: string, agentId: string): AgentTask {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.assignedAgentId = agentId
    task.status = 'assigned'
    task.updatedAt = new Date()

    // 发送任务分配消息
    this.sendMessage({
      type: 'task_assign',
      fromAgentId: task.creatorAgentId,
      toAgentId: agentId,
      content: `任务分配: ${task.title}`,
      metadata: { taskId, task },
      priority: task.priority
    })

    logger.info('Task assigned:', { taskId, agentId })
    return task
  }

  /**
   * 自动分配任务到最合适的 Agent
   */
  autoAssignTask(taskId: string, requiredSkills: string[]): AgentTask | null {
    const bestAgent = this.findBestAgentForTask(requiredSkills)
    if (!bestAgent) {
      logger.warn('No suitable agent found for task', { taskId })
      return null
    }

    return this.assignTask(taskId, bestAgent.agentId)
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: string, status: AgentTask['status'], result?: unknown): AgentTask {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.status = status
    task.updatedAt = new Date()

    if (result !== undefined) {
      task.result = result
    }

    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date()
    }

    logger.info('Task status updated:', { taskId, status })
    return task
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取 Agent 的任务列表
   */
  getTasksForAgent(agentId: string): AgentTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.assignedAgentId === agentId)
  }

  // ==================== 知识共享 ====================

  /**
   * 分享知识
   */
  shareKnowledge(
    entry: Omit<KnowledgeShareEntry, 'id' | 'quality' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ): KnowledgeShareEntry {
    const fullEntry: KnowledgeShareEntry = {
      ...entry,
      id: uuid(),
      quality: 0.5, // 初始质量评分
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.sharedKnowledge.set(fullEntry.id, fullEntry)

    // 广播知识分享消息
    this.sendMessage({
      type: 'knowledge_share',
      fromAgentId: entry.sourceAgentId,
      content: `新知识分享: ${entry.title}`,
      metadata: { knowledgeId: fullEntry.id, category: entry.category, tags: entry.tags }
    })

    logger.info('Knowledge shared:', { id: fullEntry.id, title: fullEntry.title })
    return fullEntry
  }

  /**
   * 搜索共享知识
   */
  searchKnowledge(query: string, category?: string, tags?: string[]): KnowledgeShareEntry[] {
    const lowerQuery = query.toLowerCase()

    return Array.from(this.sharedKnowledge.values())
      .filter((entry) => {
        // 类别匹配
        if (category && entry.category !== category) return false

        // 标签匹配
        if (tags && tags.length > 0) {
          const hasMatchingTag = tags.some((t) => entry.tags.includes(t))
          if (!hasMatchingTag) return false
        }

        // 文本搜索
        return entry.title.toLowerCase().includes(lowerQuery) || entry.content.toLowerCase().includes(lowerQuery)
      })
      .sort((a, b) => b.quality - a.quality) // 按质量排序
  }

  /**
   * 使用知识（增加使用计数）
   */
  useKnowledge(knowledgeId: string): void {
    const entry = this.sharedKnowledge.get(knowledgeId)
    if (entry) {
      entry.usageCount++
      entry.updatedAt = new Date()
    }
  }

  /**
   * 评价知识质量
   */
  rateKnowledge(knowledgeId: string, rating: number): void {
    const entry = this.sharedKnowledge.get(knowledgeId)
    if (entry) {
      // 简单的移动平均
      entry.quality = entry.quality * 0.8 + rating * 0.2
      entry.updatedAt = new Date()
    }
  }

  // ==================== 群体决策 ====================

  /**
   * 发起投票
   */
  createVotingSession(session: Omit<VotingSession, 'id' | 'votes' | 'status' | 'createdAt' | 'result'>): VotingSession {
    const fullSession: VotingSession = {
      ...session,
      id: uuid(),
      votes: new Map(),
      status: 'open',
      createdAt: new Date()
    }

    this.votingSessions.set(fullSession.id, fullSession)

    // 发送投票请求
    session.participantAgentIds.forEach((agentId) => {
      this.sendMessage({
        type: 'vote_request',
        fromAgentId: session.initiatorAgentId,
        toAgentId: agentId,
        content: `投票请求: ${session.topic}`,
        metadata: {
          sessionId: fullSession.id,
          options: session.options,
          deadline: session.deadline.toISOString()
        },
        priority: 'high'
      })
    })

    logger.info('Voting session created:', { id: fullSession.id, topic: fullSession.topic })
    return fullSession
  }

  /**
   * 提交投票
   */
  submitVote(sessionId: string, agentId: string, optionId: string): void {
    const session = this.votingSessions.get(sessionId)
    if (!session) {
      throw new Error(`Voting session not found: ${sessionId}`)
    }

    if (session.status !== 'open') {
      throw new Error(`Voting session is ${session.status}`)
    }

    if (!session.participantAgentIds.includes(agentId)) {
      throw new Error(`Agent ${agentId} is not a participant`)
    }

    if (!session.options.find((o) => o.id === optionId)) {
      throw new Error(`Invalid option: ${optionId}`)
    }

    session.votes.set(agentId, optionId)

    // 发送投票响应
    this.sendMessage({
      type: 'vote_response',
      fromAgentId: agentId,
      toAgentId: session.initiatorAgentId,
      content: `投票已提交`,
      metadata: { sessionId, optionId }
    })

    logger.debug('Vote submitted:', { sessionId, agentId, optionId })
  }

  /**
   * 关闭投票并计算结果
   */
  closeVotingSession(sessionId: string): VotingResult {
    const session = this.votingSessions.get(sessionId)
    if (!session) {
      throw new Error(`Voting session not found: ${sessionId}`)
    }

    session.status = 'closed'

    // 统计投票
    const breakdown = new Map<string, number>()
    session.options.forEach((o) => breakdown.set(o.id, 0))

    session.votes.forEach((optionId) => {
      breakdown.set(optionId, (breakdown.get(optionId) || 0) + 1)
    })

    // 找出获胜选项
    let winnerId = session.options[0].id
    let maxVotes = 0

    breakdown.forEach((count, optionId) => {
      if (count > maxVotes) {
        maxVotes = count
        winnerId = optionId
      }
    })

    const winnerOption = session.options.find((o) => o.id === winnerId)!

    const result: VotingResult = {
      winnerId,
      winnerLabel: winnerOption.label,
      totalVotes: session.votes.size,
      breakdown
    }

    session.result = result

    logger.info('Voting session closed:', { sessionId, result })
    return result
  }

  /**
   * 获取投票会话
   */
  getVotingSession(sessionId: string): VotingSession | undefined {
    return this.votingSessions.get(sessionId)
  }
}

// ==================== 单例导出 ====================

let collaborationService: AgentCollaborationService | null = null

export function getAgentCollaborationService(): AgentCollaborationService {
  if (!collaborationService) {
    collaborationService = new AgentCollaborationService()
  }
  return collaborationService
}

export default AgentCollaborationService
