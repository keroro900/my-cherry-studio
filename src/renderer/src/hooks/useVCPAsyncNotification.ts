/**
 * VCP 异步通知 Hook
 *
 * 用于监听异步插件回调事件，实时接收任务完成通知
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * 异步回调事件数据
 */
export interface VCPAsyncCallbackEvent {
  pluginName: string
  taskId: string
  status: 'completed' | 'failed'
  result?: string
  error?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

/**
 * 回调服务器状态
 */
export interface VCPCallbackServerStatus {
  enabled: boolean
  running: boolean
  port: number
  host: string
  callbackBaseUrl: string
}

/**
 * Hook 返回类型
 */
export interface UseVCPAsyncNotificationResult {
  // 服务器状态
  status: VCPCallbackServerStatus | null
  // 最近的回调事件列表
  recentEvents: VCPAsyncCallbackEvent[]
  // 是否已连接
  isConnected: boolean
  // 获取回调 URL
  getCallbackUrl: () => Promise<string>
  // 启动服务器
  startServer: () => Promise<{ success: boolean; port?: number; error?: string }>
  // 停止服务器
  stopServer: () => Promise<{ success: boolean; error?: string }>
  // 刷新状态
  refreshStatus: () => Promise<void>
  // 清空事件历史
  clearEvents: () => void
}

/**
 * VCP 异步通知 Hook
 *
 * @param options.maxEvents 最大保留事件数量，默认 50
 * @param options.autoConnect 是否自动连接监听，默认 true
 * @param options.onEvent 事件回调函数
 */
export function useVCPAsyncNotification(options?: {
  maxEvents?: number
  autoConnect?: boolean
  onEvent?: (event: VCPAsyncCallbackEvent) => void
}): UseVCPAsyncNotificationResult {
  const { maxEvents = 50, autoConnect = true, onEvent } = options || {}

  const [status, setStatus] = useState<VCPCallbackServerStatus | null>(null)
  const [recentEvents, setRecentEvents] = useState<VCPAsyncCallbackEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)

  // 刷新服务器状态
  const refreshStatus = useCallback(async () => {
    try {
      const serverStatus = await window.api.vcpCallback.getStatus()
      setStatus(serverStatus)
      setIsConnected(serverStatus.running)
    } catch (error) {
      console.error('[useVCPAsyncNotification] Failed to get status:', error)
      setIsConnected(false)
    }
  }, [])

  // 获取回调 URL
  const getCallbackUrl = useCallback(async () => {
    try {
      return await window.api.vcpCallback.getUrl()
    } catch (error) {
      console.error('[useVCPAsyncNotification] Failed to get callback URL:', error)
      return ''
    }
  }, [])

  // 启动服务器
  const startServer = useCallback(async () => {
    try {
      const result = await window.api.vcpCallback.start()
      if (result.success) {
        await refreshStatus()
      }
      return result
    } catch (error) {
      console.error('[useVCPAsyncNotification] Failed to start server:', error)
      return { success: false, error: String(error) }
    }
  }, [refreshStatus])

  // 停止服务器
  const stopServer = useCallback(async () => {
    try {
      const result = await window.api.vcpCallback.stop()
      if (result.success) {
        await refreshStatus()
      }
      return result
    } catch (error) {
      console.error('[useVCPAsyncNotification] Failed to stop server:', error)
      return { success: false, error: String(error) }
    }
  }, [refreshStatus])

  // 清空事件历史
  const clearEvents = useCallback(() => {
    setRecentEvents([])
  }, [])

  // 初始化状态和监听
  useEffect(() => {
    if (!autoConnect) {
      return
    }

    // 获取初始状态
    refreshStatus()

    // 监听回调事件
    const unsubscribe = window.api.vcpCallback.onAsyncCallback((event) => {
      // 添加到事件列表
      setRecentEvents((prev) => {
        const updated = [...prev, event]
        // 保留最近 N 条
        return updated.slice(-maxEvents)
      })

      // 触发回调
      if (onEvent) {
        onEvent(event)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [autoConnect, maxEvents, onEvent, refreshStatus])

  return {
    status,
    recentEvents,
    isConnected,
    getCallbackUrl,
    startServer,
    stopServer,
    refreshStatus,
    clearEvents
  }
}

export default useVCPAsyncNotification
