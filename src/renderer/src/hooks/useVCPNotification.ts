/**
 * VCP 通知服务 Hook
 *
 * 提供系统级通知管理功能：
 * - 获取/设置通知配置
 * - 获取通知列表
 * - 监听新通知
 * - 标记已读/清空
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * 通知级别
 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * 通知类型
 */
export type NotificationType =
  | 'tool_call_success'
  | 'tool_call_error'
  | 'async_callback_success'
  | 'async_callback_error'
  | 'trace_completed'
  | 'system_alert'
  | 'custom'

/**
 * 通知配置
 */
export interface VCPNotificationConfig {
  systemNotificationEnabled: boolean
  soundEnabled: boolean
  errorOnly: boolean
  emailEnabled: boolean
  emailAddress?: string
  filters: {
    includedTools?: string[]
    excludedTools?: string[]
    minDuration?: number
  }
  quietHours?: string
}

/**
 * 通知数据
 */
export interface VCPNotification {
  id: string
  type: NotificationType
  level: NotificationLevel
  title: string
  message: string
  timestamp: string
  data?: {
    toolName?: string
    taskId?: string
    pluginName?: string
    traceId?: string
    duration?: number
    error?: string
    [key: string]: unknown
  }
  read: boolean
  systemNotified: boolean
}

/**
 * Hook 返回值
 */
export interface UseVCPNotificationResult {
  // 配置
  config: VCPNotificationConfig | null
  // 通知列表
  notifications: VCPNotification[]
  // 未读数量
  unreadCount: number
  // 是否加载中
  loading: boolean
  // 更新配置
  updateConfig: (config: Partial<VCPNotificationConfig>) => Promise<void>
  // 获取通知列表
  refreshNotifications: (options?: { limit?: number; unreadOnly?: boolean }) => Promise<void>
  // 标记已读
  markAsRead: (notificationIds: string[]) => Promise<void>
  // 标记全部已读
  markAllAsRead: () => Promise<void>
  // 清空通知
  clearAll: () => Promise<void>
  // 发送测试通知
  sendTestNotification: () => Promise<void>
}

/**
 * VCP 通知服务 Hook
 *
 * @param options.autoConnect 是否自动连接监听，默认 true
 * @param options.maxNotifications 最大通知数量，默认 100
 * @param options.onNewNotification 新通知回调
 * @param options.onNotificationClick 通知点击回调
 */
export function useVCPNotification(options?: {
  autoConnect?: boolean
  maxNotifications?: number
  onNewNotification?: (notification: VCPNotification) => void
  onNotificationClick?: (notification: VCPNotification) => void
}): UseVCPNotificationResult {
  const { autoConnect = true, maxNotifications = 100, onNewNotification, onNotificationClick } = options || {}

  const [config, setConfig] = useState<VCPNotificationConfig | null>(null)
  const [notifications, setNotifications] = useState<VCPNotification[]>([])
  const [loading, setLoading] = useState(false)

  // 计算未读数量
  const unreadCount = notifications.filter((n) => !n.read).length

  // 刷新配置
  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await window.api.vcpNotification.getConfig()
      setConfig(cfg)
    } catch (error) {
      console.error('[useVCPNotification] Failed to get config:', error)
    }
  }, [])

  // 更新配置
  const updateConfig = useCallback(async (newConfig: Partial<VCPNotificationConfig>) => {
    try {
      const result = await window.api.vcpNotification.setConfig(newConfig)
      if (result.success && result.config) {
        setConfig(result.config as VCPNotificationConfig)
      }
    } catch (error) {
      console.error('[useVCPNotification] Failed to update config:', error)
    }
  }, [])

  // 刷新通知列表
  const refreshNotifications = useCallback(
    async (opts?: { limit?: number; unreadOnly?: boolean }) => {
      setLoading(true)
      try {
        const list = await window.api.vcpNotification.getList({
          limit: opts?.limit || maxNotifications,
          unreadOnly: opts?.unreadOnly
        })
        setNotifications(list as VCPNotification[])
      } catch (error) {
        console.error('[useVCPNotification] Failed to get notifications:', error)
      } finally {
        setLoading(false)
      }
    },
    [maxNotifications]
  )

  // 标记已读
  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      await window.api.vcpNotification.markRead(notificationIds)
      setNotifications((prev) =>
        prev.map((n) => (notificationIds.includes(n.id) ? { ...n, read: true } : n))
      )
    } catch (error) {
      console.error('[useVCPNotification] Failed to mark as read:', error)
    }
  }, [])

  // 标记全部已读
  const markAllAsRead = useCallback(async () => {
    const allIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (allIds.length > 0) {
      await markAsRead(allIds)
    }
  }, [notifications, markAsRead])

  // 清空通知
  const clearAll = useCallback(async () => {
    try {
      await window.api.vcpNotification.clear()
      setNotifications([])
    } catch (error) {
      console.error('[useVCPNotification] Failed to clear notifications:', error)
    }
  }, [])

  // 发送测试通知
  const sendTestNotification = useCallback(async () => {
    try {
      await window.api.vcpNotification.test()
    } catch (error) {
      console.error('[useVCPNotification] Failed to send test notification:', error)
    }
  }, [])

  // 初始化和监听
  useEffect(() => {
    if (!autoConnect) {
      return
    }

    // 获取初始数据
    refreshConfig()
    refreshNotifications()

    // 监听新通知
    const unsubNew = window.api.vcpNotification.onNew((notification) => {
      setNotifications((prev) => {
        const updated = [notification as VCPNotification, ...prev]
        return updated.slice(0, maxNotifications)
      })

      if (onNewNotification) {
        onNewNotification(notification as VCPNotification)
      }
    })

    // 监听配置变更
    const unsubConfig = window.api.vcpNotification.onConfigChanged((cfg) => {
      // Validate config structure before setting
      const typedConfig = cfg as Partial<VCPNotificationConfig>
      if (
        typeof typedConfig.systemNotificationEnabled === 'boolean' &&
        typeof typedConfig.soundEnabled === 'boolean' &&
        typeof typedConfig.errorOnly === 'boolean' &&
        typeof typedConfig.emailEnabled === 'boolean' &&
        typedConfig.filters
      ) {
        setConfig(typedConfig as VCPNotificationConfig)
      }
    })

    // 监听通知点击
    const unsubClick = window.api.vcpNotification.onClick((notification) => {
      if (onNotificationClick) {
        onNotificationClick(notification as VCPNotification)
      }
    })

    return () => {
      unsubNew()
      unsubConfig()
      unsubClick()
    }
  }, [autoConnect, maxNotifications, onNewNotification, onNotificationClick, refreshConfig, refreshNotifications])

  return {
    config,
    notifications,
    unreadCount,
    loading,
    updateConfig,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    sendTestNotification
  }
}

export default useVCPNotification
