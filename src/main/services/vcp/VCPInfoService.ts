/**
 * VCPInfo Service - 实时状态推送服务
 *
 * 追踪和广播插件/工具执行步骤：
 * 1. 开始执行
 * 2. 步骤进度
 * 3. 完成/错误
 *
 * 用于 ShowVCP 面板实时显示执行状态
 */

import { loggerService } from '@logger'
import { BrowserWindow } from 'electron'

const logger = loggerService.withContext('VCPInfoService')

/**
 * 执行状态类型
 */
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

/**
 * 执行步骤
 */
export interface ExecutionStep {
  id: string
  name: string
  status: ExecutionStatus
  startTime?: Date
  endTime?: Date
  duration?: number // ms
  message?: string
  progress?: number // 0-100
  metadata?: Record<string, unknown>
}

/**
 * 执行会话
 */
export interface ExecutionSession {
  id: string
  type: 'tool' | 'plugin' | 'workflow' | 'agent'
  name: string
  status: ExecutionStatus
  startTime: Date
  endTime?: Date
  steps: ExecutionStep[]
  currentStepIndex: number
  metadata?: Record<string, unknown>
  parentSessionId?: string // 用于嵌套调用
  error?: {
    message: string
    stack?: string
  }
}

/**
 * VCPInfo 事件类型
 */
export type VCPInfoEvent =
  | { type: 'session:start'; session: ExecutionSession }
  | { type: 'session:update'; sessionId: string; updates: Partial<ExecutionSession> }
  | { type: 'session:end'; sessionId: string; status: ExecutionStatus; error?: { message: string; stack?: string } }
  | { type: 'step:start'; sessionId: string; step: ExecutionStep }
  | { type: 'step:progress'; sessionId: string; stepId: string; progress: number; message?: string }
  | { type: 'step:end'; sessionId: string; stepId: string; status: ExecutionStatus; message?: string }

/**
 * VCPInfo Service
 */
export class VCPInfoService {
  private sessions: Map<string, ExecutionSession> = new Map()
  private listeners: Set<(event: VCPInfoEvent) => void> = new Set()
  private maxSessions: number = 100 // 最大保留会话数

  constructor() {
    logger.info('VCPInfoService initialized')
  }

  /**
   * 开始一个新的执行会话
   */
  startSession(params: {
    type: 'tool' | 'plugin' | 'workflow' | 'agent'
    name: string
    metadata?: Record<string, unknown>
    parentSessionId?: string
  }): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const session: ExecutionSession = {
      id: sessionId,
      type: params.type,
      name: params.name,
      status: 'running',
      startTime: new Date(),
      steps: [],
      currentStepIndex: -1,
      metadata: params.metadata,
      parentSessionId: params.parentSessionId
    }

    this.sessions.set(sessionId, session)
    this.cleanupOldSessions()

    const event: VCPInfoEvent = {
      type: 'session:start',
      session
    }

    this.emit(event)
    this.broadcastToRenderer(event)

    logger.debug('Session started', { sessionId, type: params.type, name: params.name })

    return sessionId
  }

  /**
   * 添加执行步骤
   */
  addStep(sessionId: string, step: Omit<ExecutionStep, 'id' | 'status' | 'startTime'>): string {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn('Session not found', { sessionId })
      return ''
    }

    const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    const newStep: ExecutionStep = {
      ...step,
      id: stepId,
      status: 'pending',
      startTime: undefined
    }

    session.steps.push(newStep)

    return stepId
  }

  /**
   * 开始执行步骤
   */
  startStep(sessionId: string, stepId: string, message?: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const step = session.steps.find((s) => s.id === stepId)
    if (!step) return

    step.status = 'running'
    step.startTime = new Date()
    step.message = message
    session.currentStepIndex = session.steps.indexOf(step)

    const event: VCPInfoEvent = {
      type: 'step:start',
      sessionId,
      step
    }

    this.emit(event)
    this.broadcastToRenderer(event)

    logger.debug('Step started', { sessionId, stepId, name: step.name })
  }

  /**
   * 更新步骤进度
   */
  updateStepProgress(sessionId: string, stepId: string, progress: number, message?: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const step = session.steps.find((s) => s.id === stepId)
    if (!step) return

    step.progress = Math.min(100, Math.max(0, progress))
    if (message) step.message = message

    const event: VCPInfoEvent = {
      type: 'step:progress',
      sessionId,
      stepId,
      progress: step.progress,
      message
    }

    this.emit(event)
    this.broadcastToRenderer(event)
  }

  /**
   * 完成步骤
   */
  endStep(sessionId: string, stepId: string, status: 'success' | 'error', message?: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const step = session.steps.find((s) => s.id === stepId)
    if (!step) return

    step.status = status
    step.endTime = new Date()
    step.duration = step.startTime ? step.endTime.getTime() - step.startTime.getTime() : 0
    if (message) step.message = message

    const event: VCPInfoEvent = {
      type: 'step:end',
      sessionId,
      stepId,
      status,
      message
    }

    this.emit(event)
    this.broadcastToRenderer(event)

    logger.debug('Step ended', { sessionId, stepId, status, duration: step.duration })
  }

  /**
   * 结束会话
   */
  endSession(
    sessionId: string,
    status: 'success' | 'error' | 'cancelled',
    error?: { message: string; stack?: string }
  ): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.status = status
    session.endTime = new Date()
    if (error) session.error = error

    // 标记所有未完成的步骤为取消
    for (const step of session.steps) {
      if (step.status === 'pending' || step.status === 'running') {
        step.status = 'cancelled'
        step.endTime = new Date()
      }
    }

    const event: VCPInfoEvent = {
      type: 'session:end',
      sessionId,
      status,
      error
    }

    this.emit(event)
    this.broadcastToRenderer(event)

    logger.info('Session ended', {
      sessionId,
      status,
      duration: session.endTime.getTime() - session.startTime.getTime()
    })
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): ExecutionSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): ExecutionSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'running')
  }

  /**
   * 获取最近的会话
   */
  getRecentSessions(limit: number = 20): ExecutionSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit)
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: (event: VCPInfoEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 发送事件
   */
  private emit(event: VCPInfoEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        logger.error('Listener error', error as Error)
      }
    }
  }

  /**
   * 广播到 renderer
   */
  private broadcastToRenderer(event: VCPInfoEvent): void {
    try {
      // 序列化日期
      const serializedEvent = JSON.parse(
        JSON.stringify(event, (_key, value) => {
          if (value instanceof Date) {
            return value.toISOString()
          }
          return value
        })
      )

      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) {
          window.webContents.send('vcpinfo:event', serializedEvent)
        }
      })
    } catch (error) {
      logger.error('Failed to broadcast VCPInfo event', error as Error)
    }
  }

  /**
   * 清理旧会话
   */
  private cleanupOldSessions(): void {
    if (this.sessions.size <= this.maxSessions) return

    const sessions = Array.from(this.sessions.entries()).sort(
      (a, b) => a[1].startTime.getTime() - b[1].startTime.getTime()
    )

    const toRemove = sessions.slice(0, sessions.length - this.maxSessions)

    for (const [id] of toRemove) {
      // 只删除已完成的会话
      const session = this.sessions.get(id)
      if (session && session.status !== 'running') {
        this.sessions.delete(id)
      }
    }
  }

  /**
   * 广播任意事件到 renderer
   * 用于自定义事件（如 RAG 检索、Crew 事件等）
   */
  broadcastEvent(event: { type: string; timestamp?: number; sessionId?: string; [key: string]: unknown }): void {
    try {
      const serializedEvent = JSON.parse(
        JSON.stringify(
          {
            ...event,
            timestamp: event.timestamp || Date.now()
          },
          (_key, value) => {
            if (value instanceof Date) {
              return value.toISOString()
            }
            return value
          }
        )
      )

      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) {
          window.webContents.send('vcpinfo:event', serializedEvent)
        }
      })

      logger.debug('Custom event broadcasted', { type: event.type })
    } catch (error) {
      logger.error('Failed to broadcast custom event', error as Error)
    }
  }

  /**
   * 清空所有会话
   */
  clear(): void {
    this.sessions.clear()
    logger.info('All sessions cleared')
  }
}

// 单例
let _instance: VCPInfoService | null = null

export function getVCPInfoService(): VCPInfoService {
  if (!_instance) {
    _instance = new VCPInfoService()
  }
  return _instance
}

export function createVCPInfoService(): VCPInfoService {
  return new VCPInfoService()
}
