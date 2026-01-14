/**
 * useAutoContinue - 自动续写状态管理 Hook
 *
 * 功能:
 * - 管理 AI 响应完成后的自动续写
 * - 提供启动/停止/暂停/恢复方法
 * - 监听续写触发和状态变化
 */

import { loggerService } from '@logger'
import { useCallback, useEffect, useRef, useState } from 'react'

const logger = loggerService.withContext('useAutoContinue')

// ==================== 类型定义 ====================

export type AutoContinueStatus = 'idle' | 'active' | 'paused' | 'processing'

export interface AutoContinueSession {
  sessionId: string
  agentId: string
  topicId: string
  status: AutoContinueStatus
  customPrompt?: string
  retryCount: number
  maxRetries: number
  startedAt: Date
  lastActivityAt: Date
  continueCount: number
  maxContinues: number
  continueDelay: number
}

export interface AutoContinueOptions {
  /** 自定义续写提示词 */
  customPrompt?: string
  /** 最大重试次数 */
  maxRetries?: number
  /** 最大续写次数 (0 = 无限) */
  maxContinues?: number
  /** 续写间隔 (ms) */
  continueDelay?: number
  /** 是否立即开始 */
  startImmediately?: boolean
}

export interface UseAutoContinueOptions {
  /** Agent ID */
  agentId: string
  /** Topic ID */
  topicId: string
  /** 续写触发回调 */
  onTrigger?: (event: { sessionId: string; customPrompt?: string; continueCount: number }) => void
  /** 状态变化回调 */
  onStatusChange?: (status: AutoContinueStatus, session: AutoContinueSession | null) => void
}

export interface UseAutoContinueReturn {
  /** 当前会话 */
  session: AutoContinueSession | null
  /** 当前状态 */
  status: AutoContinueStatus
  /** 是否活动中 */
  isActive: boolean
  /** 续写次数 */
  continueCount: number
  /** 启动自动续写 */
  start: (options?: AutoContinueOptions) => Promise<AutoContinueSession | null>
  /** 停止自动续写 */
  stop: (reason?: string) => Promise<boolean>
  /** 暂停自动续写 */
  pause: () => Promise<boolean>
  /** 恢复自动续写 */
  resume: () => Promise<boolean>
  /** 设置自定义提示词 */
  setCustomPrompt: (prompt: string | undefined) => Promise<boolean>
  /** 通知消息完成 (触发下一次续写) */
  notifyMessageComplete: () => Promise<void>
  /** 刷新状态 */
  refresh: () => Promise<void>
}

// ==================== Hook 实现 ====================

export function useAutoContinue(options: UseAutoContinueOptions): UseAutoContinueReturn {
  const { agentId, topicId, onTrigger, onStatusChange } = options

  const [session, setSession] = useState<AutoContinueSession | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // 检查 API 是否可用
  const isApiAvailable = typeof window !== 'undefined' && window.api?.autoContinue !== undefined

  // 生成会话 ID
  const generateSessionId = useCallback(() => {
    return `ac_${agentId}_${topicId}`
  }, [agentId, topicId])

  // 刷新状态
  const refresh = useCallback(async () => {
    if (!isApiAvailable) return

    try {
      const sessionId = sessionIdRef.current || generateSessionId()
      const result = await window.api.autoContinue.getSession(sessionId)
      setSession(result || null)
    } catch (error) {
      logger.error('Failed to refresh auto-continue session', error as Error)
    }
  }, [isApiAvailable, generateSessionId])

  // 启动自动续写
  const start = useCallback(
    async (opts?: AutoContinueOptions): Promise<AutoContinueSession | null> => {
      if (!isApiAvailable) return null

      try {
        const result = await window.api.autoContinue.start({
          agentId,
          topicId,
          options: opts
        })

        sessionIdRef.current = result.sessionId
        setSession(result)
        onStatusChange?.(result.status, result)

        logger.info('Auto-continue started', { agentId, topicId, sessionId: result.sessionId })
        return result
      } catch (error) {
        logger.error('Failed to start auto-continue', error as Error)
        return null
      }
    },
    [isApiAvailable, agentId, topicId, onStatusChange]
  )

  // 停止自动续写
  const stop = useCallback(
    async (reason?: string): Promise<boolean> => {
      if (!isApiAvailable || !sessionIdRef.current) return false

      try {
        const success = await window.api.autoContinue.stop({
          sessionId: sessionIdRef.current,
          reason
        })

        if (success) {
          setSession(null)
          onStatusChange?.('idle', null)
          logger.info('Auto-continue stopped', { sessionId: sessionIdRef.current, reason })
        }

        return success
      } catch (error) {
        logger.error('Failed to stop auto-continue', error as Error)
        return false
      }
    },
    [isApiAvailable, onStatusChange]
  )

  // 暂停自动续写
  const pause = useCallback(async (): Promise<boolean> => {
    if (!isApiAvailable || !sessionIdRef.current) return false

    try {
      const success = await window.api.autoContinue.pause(sessionIdRef.current)

      if (success) {
        await refresh()
        logger.info('Auto-continue paused', { sessionId: sessionIdRef.current })
      }

      return success
    } catch (error) {
      logger.error('Failed to pause auto-continue', error as Error)
      return false
    }
  }, [isApiAvailable, refresh])

  // 恢复自动续写
  const resume = useCallback(async (): Promise<boolean> => {
    if (!isApiAvailable || !sessionIdRef.current) return false

    try {
      const success = await window.api.autoContinue.resume(sessionIdRef.current)

      if (success) {
        await refresh()
        logger.info('Auto-continue resumed', { sessionId: sessionIdRef.current })
      }

      return success
    } catch (error) {
      logger.error('Failed to resume auto-continue', error as Error)
      return false
    }
  }, [isApiAvailable, refresh])

  // 设置自定义提示词
  const setCustomPrompt = useCallback(
    async (prompt: string | undefined): Promise<boolean> => {
      if (!isApiAvailable || !sessionIdRef.current) return false

      try {
        const success = await window.api.autoContinue.setCustomPrompt({
          sessionId: sessionIdRef.current,
          prompt
        })

        if (success) {
          await refresh()
        }

        return success
      } catch (error) {
        logger.error('Failed to set custom prompt', error as Error)
        return false
      }
    },
    [isApiAvailable, refresh]
  )

  // 通知消息完成
  const notifyMessageComplete = useCallback(async (): Promise<void> => {
    if (!isApiAvailable) return

    try {
      await window.api.autoContinue.onMessageComplete({ agentId, topicId })
      logger.debug('Message complete notified', { agentId, topicId })
    } catch (error) {
      logger.error('Failed to notify message complete', error as Error)
    }
  }, [isApiAvailable, agentId, topicId])

  // 初始化时检查是否有活动会话
  useEffect(() => {
    if (!isApiAvailable) return

    const sessionId = generateSessionId()
    sessionIdRef.current = sessionId

    const checkActive = async () => {
      try {
        const isActive = await window.api.autoContinue.isActive({ agentId, topicId })
        if (isActive) {
          await refresh()
        }
      } catch (error) {
        logger.error('Failed to check active status', error as Error)
      }
    }

    checkActive()
  }, [isApiAvailable, agentId, topicId, generateSessionId, refresh])

  // 监听续写触发事件
  useEffect(() => {
    if (!isApiAvailable) return undefined

    const unsubscribe = window.api.autoContinue.onTrigger((event) => {
      // 只处理当前 agent/topic 的事件
      if (event.agentId === agentId && event.topicId === topicId) {
        logger.debug('Auto-continue trigger received', event)
        onTrigger?.({
          sessionId: event.sessionId,
          customPrompt: event.customPrompt,
          continueCount: event.continueCount
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [isApiAvailable, agentId, topicId, onTrigger])

  // 监听状态变化事件
  useEffect(() => {
    if (!isApiAvailable) return undefined

    const unsubscribe = window.api.autoContinue.onStatusChange((event) => {
      // 只处理当前 agent/topic 的事件
      if (event.agentId === agentId && event.topicId === topicId) {
        logger.debug('Auto-continue status change', event)

        // 更新本地状态
        if (event.status === 'idle') {
          setSession(null)
        } else {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: event.status,
                  continueCount: event.continueCount,
                  maxContinues: event.maxContinues
                }
              : null
          )
        }

        onStatusChange?.(event.status, session)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [isApiAvailable, agentId, topicId, onStatusChange, session])

  return {
    session,
    status: session?.status || 'idle',
    isActive: session?.status === 'active' || session?.status === 'processing',
    continueCount: session?.continueCount || 0,
    start,
    stop,
    pause,
    resume,
    setCustomPrompt,
    notifyMessageComplete,
    refresh
  }
}

export default useAutoContinue
