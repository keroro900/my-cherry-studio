/**
 * AutoContinueService - 自动续写服务（心流锁核心）
 *
 * 实现 VCPChat 的心流锁功能：
 * 1. AI 响应完成后自动触发下一次续写
 * 2. 支持自定义续写提示词
 * 3. 重试机制
 * 4. 上下文检查（切换聊天时自动停止）
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'
import { BrowserWindow } from 'electron'

const logger = loggerService.withContext('AutoContinueService')

// ==================== Types ====================

/**
 * 自动续写状态
 */
export type AutoContinueStatus = 'idle' | 'active' | 'paused' | 'processing'

/**
 * 自动续写会话
 */
export interface AutoContinueSession {
  /** 会话 ID */
  sessionId: string
  /** Agent ID */
  agentId: string
  /** Topic ID */
  topicId: string
  /** 状态 */
  status: AutoContinueStatus
  /** 自定义续写提示词 */
  customPrompt?: string
  /** 重试计数 */
  retryCount: number
  /** 最大重试次数 */
  maxRetries: number
  /** 开始时间 */
  startedAt: Date
  /** 最后活动时间 */
  lastActivityAt: Date
  /** 续写次数 */
  continueCount: number
  /** 最大续写次数 (0 = 无限) */
  maxContinues: number
  /** 续写间隔 (ms) */
  continueDelay: number
}

/**
 * 自动续写配置
 */
export interface AutoContinueConfig {
  /** 默认最大重试次数 */
  defaultMaxRetries?: number
  /** 默认最大续写次数 (0 = 无限) */
  defaultMaxContinues?: number
  /** 默认续写间隔 (ms) */
  defaultContinueDelay?: number
  /** 重试延迟 (ms) */
  retryDelay?: number
}

/**
 * 自动续写事件
 */
export type AutoContinueEvent =
  | { type: 'started'; sessionId: string; agentId: string; topicId: string }
  | { type: 'stopped'; sessionId: string; reason: string }
  | { type: 'paused'; sessionId: string }
  | { type: 'resumed'; sessionId: string }
  | { type: 'continue_triggered'; sessionId: string; continueCount: number }
  | { type: 'error'; sessionId: string; error: string; retryCount: number }
  | { type: 'max_retries_reached'; sessionId: string }
  | { type: 'max_continues_reached'; sessionId: string }

/**
 * 事件监听器
 */
export type AutoContinueEventListener = (event: AutoContinueEvent) => void

// ==================== Constants ====================

const DEFAULT_CONFIG: Required<AutoContinueConfig> = {
  defaultMaxRetries: 3,
  defaultMaxContinues: 0, // 无限
  defaultContinueDelay: 1000,
  retryDelay: 2000
}

// ==================== Service ====================

/**
 * 自动续写服务
 */
export class AutoContinueService {
  private static instance: AutoContinueService | null = null

  private config: Required<AutoContinueConfig>
  private sessions: Map<string, AutoContinueSession> = new Map()
  private eventListeners: Set<AutoContinueEventListener> = new Set()
  private pendingContinues: Map<string, NodeJS.Timeout> = new Map()

  private constructor(config: AutoContinueConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.info('AutoContinueService initialized', { config: this.config })
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: AutoContinueConfig): AutoContinueService {
    if (!AutoContinueService.instance) {
      AutoContinueService.instance = new AutoContinueService(config)
    }
    return AutoContinueService.instance
  }

  /**
   * 重置实例（用于测试）
   */
  static resetInstance(): void {
    if (AutoContinueService.instance) {
      AutoContinueService.instance.destroy()
      AutoContinueService.instance = null
    }
  }

  // ==================== Session Management ====================

  /**
   * 启动自动续写
   */
  start(
    agentId: string,
    topicId: string,
    options?: {
      customPrompt?: string
      maxRetries?: number
      maxContinues?: number
      continueDelay?: number
      startImmediately?: boolean
    }
  ): AutoContinueSession {
    const sessionId = this.generateSessionId(agentId, topicId)

    // 检查是否已有活动会话
    const existingSession = this.sessions.get(sessionId)
    if (existingSession && existingSession.status !== 'idle') {
      logger.warn('Auto-continue session already active', { sessionId })
      return existingSession
    }

    const session: AutoContinueSession = {
      sessionId,
      agentId,
      topicId,
      status: 'active',
      customPrompt: options?.customPrompt,
      retryCount: 0,
      maxRetries: options?.maxRetries ?? this.config.defaultMaxRetries,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      continueCount: 0,
      maxContinues: options?.maxContinues ?? this.config.defaultMaxContinues,
      continueDelay: options?.continueDelay ?? this.config.defaultContinueDelay
    }

    this.sessions.set(sessionId, session)

    logger.info('Auto-continue started', {
      sessionId,
      agentId,
      topicId,
      customPrompt: session.customPrompt?.substring(0, 50)
    })

    this.emitEvent({ type: 'started', sessionId, agentId, topicId })
    this.broadcastStatusChange(session)

    // 如果需要立即开始
    if (options?.startImmediately) {
      setTimeout(() => this.triggerContinue(sessionId), 500)
    }

    return session
  }

  /**
   * 停止自动续写
   */
  stop(sessionId: string, reason: string = 'manual'): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    // 清除待处理的续写
    this.clearPendingContinue(sessionId)

    session.status = 'idle'
    session.lastActivityAt = new Date()

    logger.info('Auto-continue stopped', { sessionId, reason })

    this.emitEvent({ type: 'stopped', sessionId, reason })
    this.broadcastStatusChange(session)

    return true
  }

  /**
   * 暂停自动续写
   */
  pause(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'active') {
      return false
    }

    this.clearPendingContinue(sessionId)
    session.status = 'paused'
    session.lastActivityAt = new Date()

    logger.info('Auto-continue paused', { sessionId })

    this.emitEvent({ type: 'paused', sessionId })
    this.broadcastStatusChange(session)

    return true
  }

  /**
   * 恢复自动续写
   */
  resume(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'paused') {
      return false
    }

    session.status = 'active'
    session.lastActivityAt = new Date()

    logger.info('Auto-continue resumed', { sessionId })

    this.emitEvent({ type: 'resumed', sessionId })
    this.broadcastStatusChange(session)

    return true
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): AutoContinueSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * 获取 Agent/Topic 的会话
   */
  getSessionByContext(agentId: string, topicId: string): AutoContinueSession | undefined {
    const sessionId = this.generateSessionId(agentId, topicId)
    return this.sessions.get(sessionId)
  }

  /**
   * 检查是否有活动的自动续写
   */
  isActive(agentId: string, topicId: string): boolean {
    const session = this.getSessionByContext(agentId, topicId)
    return session?.status === 'active' || session?.status === 'processing'
  }

  /**
   * 获取所有活动会话
   */
  getActiveSessions(): AutoContinueSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active' || s.status === 'processing')
  }

  // ==================== Continue Logic ====================

  /**
   * 触发续写
   */
  async triggerContinue(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn('Session not found for continue', { sessionId })
      return false
    }

    if (session.status !== 'active') {
      logger.debug('Session not active, skipping continue', { sessionId, status: session.status })
      return false
    }

    // 检查是否达到最大续写次数
    if (session.maxContinues > 0 && session.continueCount >= session.maxContinues) {
      logger.info('Max continues reached', { sessionId, continueCount: session.continueCount })
      this.emitEvent({ type: 'max_continues_reached', sessionId })
      this.stop(sessionId, 'max_continues_reached')
      return false
    }

    session.status = 'processing'
    session.lastActivityAt = new Date()
    this.broadcastStatusChange(session)

    try {
      // 通知渲染进程触发续写
      await this.notifyRendererToContinue(session)

      session.continueCount++
      session.retryCount = 0
      session.status = 'active'

      logger.info('Continue triggered', {
        sessionId,
        continueCount: session.continueCount,
        customPrompt: session.customPrompt?.substring(0, 30)
      })

      this.emitEvent({
        type: 'continue_triggered',
        sessionId,
        continueCount: session.continueCount
      })

      return true
    } catch (error) {
      session.retryCount++
      session.status = 'active'

      logger.error('Continue failed', {
        sessionId,
        error: String(error),
        retryCount: session.retryCount
      })

      this.emitEvent({
        type: 'error',
        sessionId,
        error: String(error),
        retryCount: session.retryCount
      })

      // 检查是否达到最大重试次数
      if (session.retryCount >= session.maxRetries) {
        logger.warn('Max retries reached', { sessionId, retryCount: session.retryCount })
        this.emitEvent({ type: 'max_retries_reached', sessionId })
        this.stop(sessionId, 'max_retries_reached')
        return false
      }

      // 安排重试
      this.scheduleContinue(sessionId, this.config.retryDelay)
      return false
    }
  }

  /**
   * AI 响应完成时调用
   * 由渲染进程在消息完成后调用
   */
  onMessageComplete(agentId: string, topicId: string): void {
    const session = this.getSessionByContext(agentId, topicId)
    if (!session || session.status !== 'active') {
      return
    }

    logger.debug('Message complete, scheduling next continue', {
      sessionId: session.sessionId,
      delay: session.continueDelay
    })

    // 安排下一次续写
    this.scheduleContinue(session.sessionId, session.continueDelay)
  }

  /**
   * 安排续写
   */
  private scheduleContinue(sessionId: string, delay: number): void {
    // 清除之前的定时器
    this.clearPendingContinue(sessionId)

    const timer = setTimeout(() => {
      this.pendingContinues.delete(sessionId)
      this.triggerContinue(sessionId)
    }, delay)

    this.pendingContinues.set(sessionId, timer)
  }

  /**
   * 清除待处理的续写
   */
  private clearPendingContinue(sessionId: string): void {
    const timer = this.pendingContinues.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.pendingContinues.delete(sessionId)
    }
  }

  /**
   * 通知渲染进程触发续写
   */
  private async notifyRendererToContinue(session: AutoContinueSession): Promise<void> {
    const windows = BrowserWindow.getAllWindows()

    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('auto-continue:trigger', {
          sessionId: session.sessionId,
          agentId: session.agentId,
          topicId: session.topicId,
          customPrompt: session.customPrompt,
          continueCount: session.continueCount
        })
      }
    }
  }

  /**
   * 广播状态变化
   */
  private broadcastStatusChange(session: AutoContinueSession): void {
    const windows = BrowserWindow.getAllWindows()

    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('auto-continue:status-change', {
          sessionId: session.sessionId,
          agentId: session.agentId,
          topicId: session.topicId,
          status: session.status,
          continueCount: session.continueCount,
          maxContinues: session.maxContinues
        })
      }
    }
  }

  // ==================== Prompt Management ====================

  /**
   * 设置自定义提示词
   */
  setCustomPrompt(sessionId: string, prompt: string | undefined): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    session.customPrompt = prompt
    logger.debug('Custom prompt updated', { sessionId, prompt: prompt?.substring(0, 50) })

    return true
  }

  /**
   * 获取续写提示词
   */
  getContinuePrompt(sessionId: string): string {
    const session = this.sessions.get(sessionId)
    return session?.customPrompt || ''
  }

  // ==================== Events ====================

  /**
   * 添加事件监听器
   */
  addEventListener(listener: AutoContinueEventListener): void {
    this.eventListeners.add(listener)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: AutoContinueEventListener): void {
    this.eventListeners.delete(listener)
  }

  /**
   * 发送事件
   */
  private emitEvent(event: AutoContinueEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        logger.error('Event listener error', { error: String(error) })
      }
    }
  }

  // ==================== Utilities ====================

  /**
   * 生成会话 ID
   */
  private generateSessionId(agentId: string, topicId: string): string {
    return `ac_${agentId}_${topicId}`
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 停止所有会话
    for (const sessionId of this.sessions.keys()) {
      this.stop(sessionId, 'service_destroyed')
    }

    // 清除所有定时器
    for (const timer of this.pendingContinues.values()) {
      clearTimeout(timer)
    }
    this.pendingContinues.clear()

    this.sessions.clear()
    this.eventListeners.clear()

    logger.info('AutoContinueService destroyed')
  }
}

// ==================== Exports ====================

let serviceInstance: AutoContinueService | null = null

/**
 * 获取自动续写服务单例
 */
export function getAutoContinueService(config?: AutoContinueConfig): AutoContinueService {
  if (!serviceInstance) {
    serviceInstance = AutoContinueService.getInstance(config)
  }
  return serviceInstance
}

/**
 * 创建新的自动续写服务实例（内部使用单例）
 */
export function createAutoContinueService(config?: AutoContinueConfig): AutoContinueService {
  return AutoContinueService.getInstance(config)
}
