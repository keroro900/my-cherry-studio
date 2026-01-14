/**
 * useFlowLock - FlowLock 状态管理 Hook
 *
 * 功能:
 * - 管理当前会话的话题锁定状态
 * - 提供锁定/解锁/偏离检测方法
 * - 自动同步后端状态
 */

import { loggerService } from '@logger'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('useFlowLock')

// ==================== 类型定义 ====================

export type LockStatus = 'unlocked' | 'locked' | 'pending' | 'expired'
export type LockType = 'manual' | 'ai_triggered' | 'system' | 'keyword'

export interface LockReason {
  type: LockType
  description: string
  triggeredBy?: string
  confidence?: number
}

export interface TopicContext {
  topicId: string
  topicName: string
  keywords: string[]
  contextSnippets: string[]
  startedAt: Date
  relatedMessageIds: string[]
}

export interface FlowLock {
  lockId: string
  sessionId: string
  status: LockStatus
  reason: LockReason
  topicContext: TopicContext
  lockedAt: Date
  timeout: number
  expiresAt: Date
  unlockedAt?: Date
  unlockReason?: string
  deviationThreshold: number
  deviationCount: number
  maxDeviations: number
}

export interface DeviationResult {
  isDeviated: boolean
  deviationScore: number
  reason?: string
  suggestion?: 'warn' | 'redirect' | 'unlock'
}

export interface UseFlowLockOptions {
  /** 会话 ID */
  sessionId: string
  /** 自动检测偏离 */
  autoDetectDeviation?: boolean
  /** 偏离回调 */
  onDeviation?: (result: DeviationResult) => void
  /** 锁定状态变化回调 */
  onLockChange?: (lock: FlowLock | null) => void
}

export interface UseFlowLockReturn {
  /** 当前锁定状态 */
  lock: FlowLock | null
  /** 是否已锁定 */
  isLocked: boolean
  /** 是否正在加载 */
  loading: boolean
  /** 剩余时间 (毫秒) */
  remainingTime: number
  /** 创建锁定 */
  createLock: (topicName: string, keywords?: string[], options?: { timeout?: number }) => Promise<FlowLock | null>
  /** 解锁 */
  unlock: (reason?: string) => Promise<boolean>
  /** 延长锁定时间 */
  extendLock: (additionalTime: number) => Promise<boolean>
  /** 检测偏离 */
  detectDeviation: (content: string) => Promise<DeviationResult>
  /** 检测是否应该锁定 */
  shouldTriggerLock: (content: string) => Promise<{ shouldLock: boolean; confidence: number; suggestedTopic?: string }>
  /** 刷新状态 */
  refresh: () => Promise<void>
}

// ==================== Hook 实现 ====================

export function useFlowLock(options: UseFlowLockOptions): UseFlowLockReturn {
  const { sessionId, onDeviation, onLockChange } = options

  const [lock, setLock] = useState<FlowLock | null>(null)
  const [loading, setLoading] = useState(false)
  const [remainingTime, setRemainingTime] = useState(0)

  // 检查 API 是否可用
  const isApiAvailable = typeof window !== 'undefined' && window.api?.flowLock !== undefined

  // 刷新状态
  const refresh = useCallback(async () => {
    if (!sessionId || !isApiAvailable) return

    try {
      const result = await window.api.flowLock.get(sessionId)
      setLock(result || null)
      onLockChange?.(result || null)

      // 计算剩余时间
      if (result && result.status === 'locked') {
        const remaining = new Date(result.expiresAt).getTime() - Date.now()
        setRemainingTime(Math.max(0, remaining))
      } else {
        setRemainingTime(0)
      }
    } catch (error) {
      logger.error('Failed to refresh flow lock', error as Error)
    }
  }, [sessionId, onLockChange, isApiAvailable])

  // 创建锁定
  const createLock = useCallback(
    async (topicName: string, keywords: string[] = [], options?: { timeout?: number }): Promise<FlowLock | null> => {
      if (!sessionId || !isApiAvailable) return null

      setLoading(true)
      try {
        const topicContext: TopicContext = {
          topicId: `topic_${Date.now()}`,
          topicName,
          keywords,
          contextSnippets: [],
          startedAt: new Date(),
          relatedMessageIds: []
        }

        const reason: LockReason = {
          type: 'manual',
          description: `用户手动锁定话题: ${topicName}`
        }

        const result = await window.api.flowLock.create({
          sessionId,
          topicContext,
          reason,
          options
        })

        setLock(result)
        onLockChange?.(result)

        logger.info('Flow lock created', { sessionId, topicName })
        return result
      } catch (error) {
        logger.error('Failed to create flow lock', error as Error)
        return null
      } finally {
        setLoading(false)
      }
    },
    [sessionId, onLockChange, isApiAvailable]
  )

  // 解锁
  const unlock = useCallback(
    async (reason?: string): Promise<boolean> => {
      if (!sessionId || !isApiAvailable) return false

      setLoading(true)
      try {
        const success = await window.api.flowLock.unlock({ sessionId, reason })

        if (success) {
          setLock(null)
          setRemainingTime(0)
          onLockChange?.(null)
          logger.info('Flow lock released', { sessionId, reason })
        }

        return success
      } catch (error) {
        logger.error('Failed to unlock', error as Error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [sessionId, onLockChange, isApiAvailable]
  )

  // 延长锁定时间
  const extendLock = useCallback(
    async (additionalTime: number): Promise<boolean> => {
      if (!sessionId || !isApiAvailable) return false

      try {
        const success = await window.api.flowLock.extend({ sessionId, additionalTime })

        if (success) {
          await refresh()
          logger.info('Flow lock extended', { sessionId, additionalTime })
        }

        return success
      } catch (error) {
        logger.error('Failed to extend lock', error as Error)
        return false
      }
    },
    [sessionId, refresh, isApiAvailable]
  )

  // 检测偏离
  const detectDeviation = useCallback(
    async (content: string): Promise<DeviationResult> => {
      if (!sessionId || !isApiAvailable) {
        return { isDeviated: false, deviationScore: 0 }
      }

      try {
        const result = await window.api.flowLock.detectDeviation({ sessionId, content })

        if (result.isDeviated) {
          onDeviation?.(result)
        }

        // 如果建议解锁，自动刷新状态
        if (result.suggestion === 'unlock') {
          await refresh()
        }

        return result
      } catch (error) {
        logger.error('Failed to detect deviation', error as Error)
        return { isDeviated: false, deviationScore: 0 }
      }
    },
    [sessionId, onDeviation, refresh, isApiAvailable]
  )

  // 检测是否应该锁定
  const shouldTriggerLock = useCallback(
    async (content: string): Promise<{ shouldLock: boolean; confidence: number; suggestedTopic?: string }> => {
      if (!isApiAvailable) {
        return { shouldLock: false, confidence: 0 }
      }
      try {
        return await window.api.flowLock.shouldTriggerLock(content)
      } catch (error) {
        logger.error('Failed to check trigger lock', error as Error)
        return { shouldLock: false, confidence: 0 }
      }
    },
    [isApiAvailable]
  )

  // 初始化时获取状态
  useEffect(() => {
    refresh()
  }, [refresh])

  // 定时更新剩余时间
  useEffect(() => {
    if (!lock || lock.status !== 'locked') return

    const timer = setInterval(() => {
      const remaining = new Date(lock.expiresAt).getTime() - Date.now()
      if (remaining <= 0) {
        setRemainingTime(0)
        refresh() // 刷新状态，可能已过期
      } else {
        setRemainingTime(remaining)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [lock, refresh])

  return {
    lock,
    isLocked: lock?.status === 'locked',
    loading,
    remainingTime,
    createLock,
    unlock,
    extendLock,
    detectDeviation,
    shouldTriggerLock,
    refresh
  }
}

export default useFlowLock
