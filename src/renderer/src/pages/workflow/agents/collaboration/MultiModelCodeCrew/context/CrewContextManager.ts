/**
 * CrewContextManager - Crew 上下文管理器
 *
 * 为 MultiModelCodeCrew 提供上下文管理能力：
 * - Token 估算
 * - 历史消息裁剪
 * - 会话隔离
 * - TTL 自动清理
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('CrewContextManager')

// ==================== 类型定义 ====================

/**
 * 消息类型
 */
interface CrewMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  memberId?: string
  toolCallId?: string
  metadata?: Record<string, unknown>
}

/**
 * 成员历史记录
 */
interface MemberHistory {
  memberId: string
  messages: CrewMessage[]
  tokenCount: number
  lastActivity: number
  sessionId: string
}

/**
 * 上下文配置
 */
interface ContextConfig {
  /** 最大 Token 数 */
  maxTokens: number
  /** 保留的系统消息数 */
  systemMessageCount: number
  /** 保留的最近轮数 */
  recentRoundsToKeep: number
  /** 历史 TTL（毫秒） */
  historyTTL: number
  /** 清理间隔（毫秒） */
  cleanupInterval: number
}

/**
 * 上下文统计
 */
interface ContextStats {
  totalMembers: number
  totalMessages: number
  totalTokens: number
  oldestMessage: number | null
  newestMessage: number | null
}

// ==================== 上下文管理器实现 ====================

class CrewContextManagerImpl {
  private histories: Map<string, MemberHistory> = new Map()
  private config: ContextConfig = {
    maxTokens: 8000,
    systemMessageCount: 1,
    recentRoundsToKeep: 10,
    historyTTL: 3600000, // 1 小时
    cleanupInterval: 300000 // 5 分钟
  }
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private currentSessionId: string = ''

  /**
   * 初始化上下文管理器
   */
  initialize(config?: Partial<ContextConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.currentSessionId = `session_${Date.now()}`
    this.startCleanupTimer()

    logger.info('Initialized', { config: this.config, sessionId: this.currentSessionId })
  }

  /**
   * 关闭上下文管理器
   */
  shutdown(): void {
    this.stopCleanupTimer()
    this.histories.clear()
    logger.info('Shutdown')
  }

  /**
   * 设置当前会话 ID
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId
    logger.debug('Session ID set', { sessionId })
  }

  // ==================== Token 估算 ====================

  /**
   * 估算消息的 Token 数
   * 使用简单的字符估算方法（中文约 2 字符/token，英文约 4 字符/token）
   */
  estimateTokens(messages: CrewMessage[]): number {
    let totalTokens = 0

    for (const message of messages) {
      const content = message.content || ''

      // 计算中文字符数
      const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length
      // 计算非中文字符数
      const otherChars = content.length - chineseChars

      // 中文约 2 字符/token，其他约 4 字符/token
      const estimatedTokens = Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4)

      // 角色标记额外 token
      totalTokens += estimatedTokens + 4
    }

    return totalTokens
  }

  /**
   * 估算单条消息的 Token 数
   */
  estimateMessageTokens(content: string): number {
    return this.estimateTokens([{ role: 'user', content, timestamp: Date.now() }])
  }

  // ==================== 历史管理 ====================

  /**
   * 添加消息到成员历史
   */
  addMessage(memberId: string, message: Omit<CrewMessage, 'timestamp'>): void {
    const fullMessage: CrewMessage = {
      ...message,
      timestamp: Date.now(),
      memberId
    }

    const history = this.getOrCreateHistory(memberId)
    history.messages.push(fullMessage)
    history.lastActivity = Date.now()
    history.tokenCount = this.estimateTokens(history.messages)

    logger.debug('Message added', {
      memberId,
      role: message.role,
      tokenCount: history.tokenCount,
      messageCount: history.messages.length
    })

    // 检查是否需要裁剪
    if (history.tokenCount > this.config.maxTokens) {
      this.pruneHistory(memberId, this.config.recentRoundsToKeep)
    }
  }

  /**
   * 获取成员历史消息
   */
  getMemberHistory(memberId: string, sessionId?: string): CrewMessage[] {
    const key = this.getHistoryKey(memberId, sessionId)
    const history = this.histories.get(key)
    return history?.messages || []
  }

  /**
   * 获取成员历史（带 Token 裁剪）
   */
  getMemberHistoryWithLimit(memberId: string, maxTokens?: number): CrewMessage[] {
    const messages = this.getMemberHistory(memberId)
    const limit = maxTokens || this.config.maxTokens

    if (this.estimateTokens(messages) <= limit) {
      return messages
    }

    // 保留系统消息和最近的消息
    const systemMessages = messages.filter((m) => m.role === 'system').slice(0, this.config.systemMessageCount)
    const otherMessages = messages.filter((m) => m.role !== 'system')

    // 从后往前保留消息直到达到 token 限制
    const keptMessages: CrewMessage[] = [...systemMessages]
    let currentTokens = this.estimateTokens(systemMessages)

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateMessageTokens(otherMessages[i].content)
      if (currentTokens + msgTokens > limit) {
        break
      }
      keptMessages.push(otherMessages[i])
      currentTokens += msgTokens
    }

    // 按时间顺序排序
    return keptMessages.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 裁剪历史消息
   */
  pruneHistory(memberId: string, keepRounds: number): CrewMessage[] {
    const key = this.getHistoryKey(memberId)
    const history = this.histories.get(key)

    if (!history) {
      return []
    }

    const messages = history.messages

    // 保留系统消息
    const systemMessages = messages.filter((m) => m.role === 'system').slice(0, this.config.systemMessageCount)

    // 保留最近 N 轮对话（一轮 = user + assistant）
    const otherMessages = messages.filter((m) => m.role !== 'system')
    const roundSize = 2 // user + assistant
    const keepCount = keepRounds * roundSize
    const recentMessages = otherMessages.slice(-keepCount)

    const prunedMessages = [...systemMessages, ...recentMessages]

    history.messages = prunedMessages
    history.tokenCount = this.estimateTokens(prunedMessages)

    logger.info('History pruned', {
      memberId,
      originalCount: messages.length,
      prunedCount: prunedMessages.length,
      tokenCount: history.tokenCount
    })

    return prunedMessages
  }

  /**
   * 清除成员历史
   */
  clearMemberHistory(memberId: string): void {
    const key = this.getHistoryKey(memberId)
    this.histories.delete(key)
    logger.debug('Member history cleared', { memberId })
  }

  /**
   * 清除所有历史
   */
  clearAllHistory(): void {
    this.histories.clear()
    logger.info('All history cleared')
  }

  // ==================== 会话管理 ====================

  /**
   * 获取当前会话的所有成员
   */
  getSessionMembers(sessionId?: string): string[] {
    const targetSession = sessionId || this.currentSessionId
    const members: string[] = []

    for (const [, history] of this.histories) {
      if (history.sessionId === targetSession) {
        members.push(history.memberId)
      }
    }

    return members
  }

  /**
   * 切换会话
   */
  switchSession(newSessionId: string): void {
    this.currentSessionId = newSessionId
    logger.info('Session switched', { sessionId: newSessionId })
  }

  /**
   * 导出会话数据
   */
  exportSession(sessionId?: string): MemberHistory[] {
    const targetSession = sessionId || this.currentSessionId
    const sessionData: MemberHistory[] = []

    for (const [_key, history] of this.histories) {
      if (history.sessionId === targetSession) {
        sessionData.push({ ...history })
      }
    }

    return sessionData
  }

  /**
   * 导入会话数据
   */
  importSession(data: MemberHistory[]): void {
    for (const history of data) {
      const key = this.getHistoryKey(history.memberId, history.sessionId)
      this.histories.set(key, { ...history })
    }
    logger.info('Session imported', { memberCount: data.length })
  }

  // ==================== 统计 ====================

  /**
   * 获取上下文统计
   */
  getStats(): ContextStats {
    let totalMessages = 0
    let totalTokens = 0
    let oldestMessage: number | null = null
    let newestMessage: number | null = null

    for (const [, history] of this.histories) {
      totalMessages += history.messages.length
      totalTokens += history.tokenCount

      for (const msg of history.messages) {
        if (oldestMessage === null || msg.timestamp < oldestMessage) {
          oldestMessage = msg.timestamp
        }
        if (newestMessage === null || msg.timestamp > newestMessage) {
          newestMessage = msg.timestamp
        }
      }
    }

    return {
      totalMembers: this.histories.size,
      totalMessages,
      totalTokens,
      oldestMessage,
      newestMessage
    }
  }

  /**
   * 获取成员统计
   */
  getMemberStats(memberId: string): { messageCount: number; tokenCount: number; lastActivity: number } | null {
    const key = this.getHistoryKey(memberId)
    const history = this.histories.get(key)

    if (!history) {
      return null
    }

    return {
      messageCount: history.messages.length,
      tokenCount: history.tokenCount,
      lastActivity: history.lastActivity
    }
  }

  // ==================== 私有方法 ====================

  private getHistoryKey(memberId: string, sessionId?: string): string {
    return `${sessionId || this.currentSessionId}:${memberId}`
  }

  private getOrCreateHistory(memberId: string): MemberHistory {
    const key = this.getHistoryKey(memberId)
    let history = this.histories.get(key)

    if (!history) {
      history = {
        memberId,
        messages: [],
        tokenCount: 0,
        lastActivity: Date.now(),
        sessionId: this.currentSessionId
      }
      this.histories.set(key, history)
    }

    return history
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return
    }

    this.cleanupTimer = setInterval(() => {
      this.periodicCleanup()
    }, this.config.cleanupInterval)
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 周期性清理过期历史
   */
  private periodicCleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, history] of this.histories) {
      if (now - history.lastActivity > this.config.historyTTL) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.histories.delete(key)
    }

    if (expiredKeys.length > 0) {
      logger.debug('Periodic cleanup completed', { expiredCount: expiredKeys.length })
    }
  }
}

// ==================== 导出 ====================

export const CrewContextManager = new CrewContextManagerImpl()

export type { CrewMessage, MemberHistory, ContextConfig, ContextStats }

export default CrewContextManager
