/**
 * FlowLockService - 话题锁定服务
 *
 * 实现对话流锁定功能：
 * 1. 锁定当前话题，防止对话偏离
 * 2. 支持 AI 主动触发锁定
 * 3. 超时自动解锁
 * 4. 提供上下文感知支持
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('FlowLockService')

// ==================== Types ====================

/**
 * 锁定状态
 */
export type LockStatus = 'unlocked' | 'locked' | 'pending' | 'expired'

/**
 * 锁定类型
 */
export type LockType = 'manual' | 'ai_triggered' | 'system' | 'keyword'

/**
 * 锁定原因
 */
export interface LockReason {
  type: LockType
  description: string
  triggeredBy?: string
  confidence?: number
}

/**
 * 话题上下文
 */
export interface TopicContext {
  /** 话题 ID */
  topicId: string
  /** 话题名称/摘要 */
  topicName: string
  /** 关键词列表 */
  keywords: string[]
  /** 相关上下文片段 */
  contextSnippets: string[]
  /** 话题开始时间 */
  startedAt: Date
  /** 关联的消息 ID */
  relatedMessageIds: string[]
}

/**
 * 锁定会话
 */
export interface FlowLock {
  /** 锁 ID */
  lockId: string
  /** 会话/对话 ID */
  sessionId: string
  /** 锁定状态 */
  status: LockStatus
  /** 锁定原因 */
  reason: LockReason
  /** 锁定的话题上下文 */
  topicContext: TopicContext
  /** 锁定时间 */
  lockedAt: Date
  /** 超时时间 (ms) */
  timeout: number
  /** 过期时间 */
  expiresAt: Date
  /** 解锁时间 */
  unlockedAt?: Date
  /** 解锁原因 */
  unlockReason?: string
  /** 允许的偏离阈值 (0-1) */
  deviationThreshold: number
  /** 偏离计数 */
  deviationCount: number
  /** 最大允许偏离次数 */
  maxDeviations: number
}

/**
 * 锁定配置
 */
export interface FlowLockConfig {
  /** 默认超时时间 (ms), 默认 10 分钟 */
  defaultTimeout?: number
  /** 默认偏离阈值, 默认 0.3 */
  defaultDeviationThreshold?: number
  /** 最大偏离次数, 默认 3 */
  defaultMaxDeviations?: number
  /** 是否启用 AI 自动锁定 */
  enableAITrigger?: boolean
  /** AI 触发的置信度阈值 */
  aiTriggerConfidence?: number
  /** 锁定触发关键词 */
  lockKeywords?: string[]
  /** 解锁触发关键词 */
  unlockKeywords?: string[]
}

/**
 * 偏离检测结果
 */
export interface DeviationResult {
  /** 是否偏离 */
  isDeviated: boolean
  /** 偏离分数 (0-1) */
  deviationScore: number
  /** 偏离原因 */
  reason?: string
  /** 建议操作 */
  suggestion?: 'warn' | 'redirect' | 'unlock'
}

// ==================== Constants ====================

const DEFAULT_CONFIG: Required<FlowLockConfig> = {
  defaultTimeout: 10 * 60 * 1000, // 10 分钟
  defaultDeviationThreshold: 0.3,
  defaultMaxDeviations: 3,
  enableAITrigger: true,
  aiTriggerConfidence: 0.7,
  lockKeywords: ['专注于', '聚焦', '让我们集中讨论', '回到', '继续讨论'],
  unlockKeywords: ['换个话题', '聊点别的', '不说这个了', '解锁', '结束讨论']
}

// ==================== FlowLockService ====================

export class FlowLockService {
  private locks: Map<string, FlowLock> = new Map()
  private config: Required<FlowLockConfig>
  private cleanupInterval?: ReturnType<typeof setInterval>

  constructor(config: FlowLockConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startCleanupTimer()
    logger.info('FlowLockService initialized', { config: this.config })
  }

  /**
   * 创建新的话题锁
   */
  createLock(
    sessionId: string,
    topicContext: TopicContext,
    reason: LockReason,
    options?: {
      timeout?: number
      deviationThreshold?: number
      maxDeviations?: number
    }
  ): FlowLock {
    // 检查是否已有锁
    const existingLock = this.getLock(sessionId)
    if (existingLock && existingLock.status === 'locked') {
      logger.warn('Session already has an active lock', { sessionId, existingLockId: existingLock.lockId })
      return existingLock
    }

    const timeout = options?.timeout ?? this.config.defaultTimeout
    const now = new Date()

    const lock: FlowLock = {
      lockId: this.generateLockId(),
      sessionId,
      status: 'locked',
      reason,
      topicContext,
      lockedAt: now,
      timeout,
      expiresAt: new Date(now.getTime() + timeout),
      deviationThreshold: options?.deviationThreshold ?? this.config.defaultDeviationThreshold,
      deviationCount: 0,
      maxDeviations: options?.maxDeviations ?? this.config.defaultMaxDeviations
    }

    this.locks.set(sessionId, lock)
    logger.info('Flow lock created', {
      lockId: lock.lockId,
      sessionId,
      topic: topicContext.topicName,
      reason: reason.type,
      expiresAt: lock.expiresAt
    })

    return lock
  }

  /**
   * 获取会话的锁
   */
  getLock(sessionId: string): FlowLock | undefined {
    const lock = this.locks.get(sessionId)

    // 检查是否过期
    if (lock && lock.status === 'locked' && new Date() > lock.expiresAt) {
      this.expireLock(sessionId)
      return this.locks.get(sessionId)
    }

    return lock
  }

  /**
   * 解锁
   */
  unlock(sessionId: string, reason?: string): boolean {
    const lock = this.locks.get(sessionId)
    if (!lock || lock.status !== 'locked') {
      return false
    }

    lock.status = 'unlocked'
    lock.unlockedAt = new Date()
    lock.unlockReason = reason || 'manual unlock'

    logger.info('Flow lock released', {
      lockId: lock.lockId,
      sessionId,
      reason: lock.unlockReason,
      duration: lock.unlockedAt.getTime() - lock.lockedAt.getTime()
    })

    return true
  }

  /**
   * 过期锁
   */
  private expireLock(sessionId: string): void {
    const lock = this.locks.get(sessionId)
    if (!lock) return

    lock.status = 'expired'
    lock.unlockedAt = new Date()
    lock.unlockReason = 'timeout expired'

    logger.info('Flow lock expired', {
      lockId: lock.lockId,
      sessionId,
      duration: lock.unlockedAt.getTime() - lock.lockedAt.getTime()
    })
  }

  /**
   * 检测内容是否偏离锁定话题
   */
  detectDeviation(sessionId: string, content: string): DeviationResult {
    const lock = this.getLock(sessionId)
    if (!lock || lock.status !== 'locked') {
      return { isDeviated: false, deviationScore: 0 }
    }

    // 计算偏离分数
    const deviationScore = this.calculateDeviationScore(content, lock.topicContext)
    const isDeviated = deviationScore > lock.deviationThreshold

    if (isDeviated) {
      lock.deviationCount++
      logger.debug('Deviation detected', {
        lockId: lock.lockId,
        sessionId,
        deviationScore,
        deviationCount: lock.deviationCount
      })
    }

    // 决定建议操作
    let suggestion: DeviationResult['suggestion']
    if (lock.deviationCount >= lock.maxDeviations) {
      suggestion = 'unlock'
    } else if (isDeviated) {
      suggestion = deviationScore > 0.7 ? 'redirect' : 'warn'
    }

    return {
      isDeviated,
      deviationScore,
      reason: isDeviated ? '内容与锁定话题不相关' : undefined,
      suggestion
    }
  }

  /**
   * 计算偏离分数
   */
  private calculateDeviationScore(content: string, context: TopicContext): number {
    const contentLower = content.toLowerCase()
    const keywords = context.keywords.map((k) => k.toLowerCase())

    // 检查关键词匹配
    let matchCount = 0
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        matchCount++
      }
    }

    // 关键词匹配率
    const keywordScore = keywords.length > 0 ? matchCount / keywords.length : 0

    // 如果匹配率高，偏离分数低
    return 1 - keywordScore
  }

  /**
   * 检测是否应该触发锁定 (AI 辅助)
   */
  shouldTriggerLock(content: string): { shouldLock: boolean; confidence: number; suggestedTopic?: string } {
    if (!this.config.enableAITrigger) {
      return { shouldLock: false, confidence: 0 }
    }

    const contentLower = content.toLowerCase()

    // 检查锁定关键词
    for (const keyword of this.config.lockKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        // 提取可能的话题
        const suggestedTopic = this.extractTopicFromContent(content, keyword)

        return {
          shouldLock: true,
          confidence: 0.8,
          suggestedTopic
        }
      }
    }

    return { shouldLock: false, confidence: 0 }
  }

  /**
   * 检测是否应该解锁
   */
  shouldTriggerUnlock(content: string): boolean {
    const contentLower = content.toLowerCase()

    for (const keyword of this.config.unlockKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return true
      }
    }

    return false
  }

  /**
   * 从内容中提取话题
   */
  private extractTopicFromContent(content: string, triggerKeyword: string): string {
    // 简单实现：提取触发关键词后的内容作为话题
    const keywordIndex = content.toLowerCase().indexOf(triggerKeyword.toLowerCase())
    if (keywordIndex === -1) return ''

    const afterKeyword = content.substring(keywordIndex + triggerKeyword.length).trim()
    // 取前 50 个字符作为话题
    return afterKeyword
      .substring(0, 50)
      .replace(/[。！？,.!?].*$/, '')
      .trim()
  }

  /**
   * 生成锁 ID
   */
  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  /**
   * 延长锁定时间
   */
  extendLock(sessionId: string, additionalTime: number): boolean {
    const lock = this.locks.get(sessionId)
    if (!lock || lock.status !== 'locked') {
      return false
    }

    lock.expiresAt = new Date(lock.expiresAt.getTime() + additionalTime)
    lock.timeout += additionalTime

    logger.info('Flow lock extended', {
      lockId: lock.lockId,
      sessionId,
      newExpiresAt: lock.expiresAt,
      additionalTime
    })

    return true
  }

  /**
   * 更新话题上下文
   */
  updateTopicContext(sessionId: string, updates: Partial<TopicContext>): boolean {
    const lock = this.locks.get(sessionId)
    if (!lock || lock.status !== 'locked') {
      return false
    }

    lock.topicContext = { ...lock.topicContext, ...updates }

    logger.debug('Topic context updated', {
      lockId: lock.lockId,
      sessionId,
      updates: Object.keys(updates)
    })

    return true
  }

  /**
   * 获取所有活跃的锁
   */
  getActiveLocks(): FlowLock[] {
    const activeLocks: FlowLock[] = []

    for (const lock of this.locks.values()) {
      if (lock.status === 'locked') {
        // 检查是否过期
        if (new Date() > lock.expiresAt) {
          this.expireLock(lock.sessionId)
        } else {
          activeLocks.push(lock)
        }
      }
    }

    return activeLocks
  }

  /**
   * 生成锁定提示消息
   */
  generateLockMessage(lock: FlowLock): string {
    const remaining = Math.max(0, lock.expiresAt.getTime() - Date.now())
    const remainingMinutes = Math.ceil(remaining / 60000)

    return `🔒 当前对话已锁定到话题: "${lock.topicContext.topicName}"
关键词: ${lock.topicContext.keywords.join(', ')}
剩余时间: ${remainingMinutes} 分钟
偏离次数: ${lock.deviationCount}/${lock.maxDeviations}

说 "${this.config.unlockKeywords[0]}" 可解除锁定。`
  }

  /**
   * 生成偏离警告消息
   */
  generateDeviationWarning(lock: FlowLock, result: DeviationResult): string {
    const topic = lock.topicContext.topicName

    switch (result.suggestion) {
      case 'redirect':
        return `⚠️ 您的消息似乎偏离了当前话题 "${topic}"。让我们回到主题讨论。`
      case 'warn':
        return `💡 提醒: 当前话题是 "${topic}"。如需切换话题，请先解除锁定。`
      case 'unlock':
        return `🔓 检测到多次话题偏离，已自动解除锁定。您可以自由讨论新话题。`
      default:
        return ''
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    // 每分钟清理过期的锁
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks()
    }, 60000)
  }

  /**
   * 清理过期的锁
   */
  private cleanupExpiredLocks(): void {
    const now = new Date()
    let cleanedCount = 0

    for (const [sessionId, lock] of this.locks) {
      if (lock.status === 'locked' && now > lock.expiresAt) {
        this.expireLock(sessionId)
        cleanedCount++
      }

      // 删除很久之前解锁/过期的记录 (超过 1 小时)
      if (lock.status !== 'locked' && lock.unlockedAt) {
        const age = now.getTime() - lock.unlockedAt.getTime()
        if (age > 3600000) {
          this.locks.delete(sessionId)
          cleanedCount++
        }
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up locks', { cleanedCount, remaining: this.locks.size })
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.locks.clear()
    logger.info('FlowLockService destroyed')
  }
}

// ==================== Exports ====================

let serviceInstance: FlowLockService | null = null

/**
 * 获取 FlowLock 服务单例
 */
export function getFlowLockService(config?: FlowLockConfig): FlowLockService {
  if (!serviceInstance) {
    serviceInstance = new FlowLockService(config)
  }
  return serviceInstance
}

/**
 * 创建新的 FlowLock 服务实例
 */
export function createFlowLockService(config?: FlowLockConfig): FlowLockService {
  return new FlowLockService(config)
}
