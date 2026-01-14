/**
 * VCP 通知服务
 *
 * 整合系统级别通知功能：
 * 1. 工具调用完成/失败通知
 * 2. 异步任务回调通知
 * 3. 重要事件广播（可配置邮件/系统通知）
 * 4. 与 Electron Notification API 集成
 */

import { loggerService } from '@logger'
import { Notification as ElectronNotification, ipcMain, BrowserWindow } from 'electron'

import { IpcChannel } from '@shared/IpcChannel'
import type { ToolCallLog, LogEntry } from './ToolCallTracer'
import type { VCPCallbackEvent } from './VCPCallbackServer'
import { windowService } from '../WindowService'

const logger = loggerService.withContext('VCPNotificationService')

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
 * VCP 通知配置
 */
export interface VCPNotificationConfig {
  /** 是否启用系统通知 */
  systemNotificationEnabled: boolean
  /** 是否启用声音 */
  soundEnabled: boolean
  /** 只有错误时才通知 */
  errorOnly: boolean
  /** 是否启用邮件通知（预留） */
  emailEnabled: boolean
  /** 邮件地址（预留） */
  emailAddress?: string
  /** 通知过滤规则 */
  filters: {
    /** 只通知这些工具 */
    includedTools?: string[]
    /** 排除这些工具 */
    excludedTools?: string[]
    /** 最小耗时阈值（ms），低于此值不通知 */
    minDuration?: number
  }
  /** 静默时段（24小时制，如 "22:00-08:00"） */
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
  timestamp: Date
  data?: {
    toolName?: string
    taskId?: string
    pluginName?: string
    traceId?: string
    duration?: number
    error?: string
    [key: string]: unknown
  }
  /** 是否已读 */
  read: boolean
  /** 是否已发送系统通知 */
  systemNotified: boolean
}

/**
 * VCP 通知服务
 */
export class VCPNotificationService {
  private config: VCPNotificationConfig
  private notifications: VCPNotification[] = []
  private maxNotifications: number = 200
  private ipcRegistered: boolean = false

  constructor(config?: Partial<VCPNotificationConfig>) {
    this.config = {
      systemNotificationEnabled: true,
      soundEnabled: false,
      errorOnly: false,
      emailEnabled: false,
      filters: {},
      ...config
    }

    logger.info('VCPNotificationService initialized', { config: this.config })
  }

  /**
   * 注册 IPC 处理器
   */
  registerIpcHandlers(): void {
    if (this.ipcRegistered) {
      return
    }

    // 获取通知配置
    ipcMain.handle(IpcChannel.VCP_Notification_GetConfig, () => {
      return this.config
    })

    // 更新通知配置
    ipcMain.handle(IpcChannel.VCP_Notification_SetConfig, (_, config: Partial<VCPNotificationConfig>) => {
      this.updateConfig(config)
      return { success: true, config: this.config }
    })

    // 获取通知列表
    ipcMain.handle(IpcChannel.VCP_Notification_GetList, (_, options?: { limit?: number; unreadOnly?: boolean }) => {
      return this.getNotifications(options)
    })

    // 标记通知已读
    ipcMain.handle(IpcChannel.VCP_Notification_MarkRead, (_, notificationIds: string[]) => {
      this.markAsRead(notificationIds)
      return { success: true }
    })

    // 清空通知
    ipcMain.handle(IpcChannel.VCP_Notification_Clear, () => {
      this.clearNotifications()
      return { success: true }
    })

    // 发送测试通知
    ipcMain.handle(IpcChannel.VCP_Notification_Test, () => {
      this.sendTestNotification()
      return { success: true }
    })

    this.ipcRegistered = true
    logger.debug('IPC handlers registered')
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VCPNotificationConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('Configuration updated', { config: this.config })

    // 广播配置变更
    this.broadcastToRenderer('vcpNotification:configChanged', this.config)
  }

  /**
   * 处理工具调用完成事件
   */
  onToolCallEnd(call: ToolCallLog): void {
    // 检查是否应该通知
    if (!this.shouldNotify(call)) {
      return
    }

    const isError = call.status === 'error'
    const notification = this.createNotification({
      type: isError ? 'tool_call_error' : 'tool_call_success',
      level: isError ? 'error' : 'success',
      title: isError ? `Tool Call Failed: ${call.toolName}` : `Tool Completed: ${call.toolName}`,
      message: isError
        ? `Error: ${call.error?.message || 'Unknown error'}`
        : `Completed in ${call.duration || 0}ms`,
      data: {
        toolName: call.toolName,
        traceId: call.traceId,
        duration: call.duration,
        error: call.error?.message
      }
    })

    this.addNotification(notification)

    // 发送系统通知
    if (this.config.systemNotificationEnabled && (!this.config.errorOnly || isError)) {
      this.sendSystemNotification(notification)
    }
  }

  /**
   * 处理异步回调事件
   */
  onAsyncCallback(event: VCPCallbackEvent): void {
    const isError = event.status === 'failed'

    // 如果配置了只在错误时通知，检查是否是错误
    if (this.config.errorOnly && !isError) {
      return
    }

    const notification = this.createNotification({
      type: isError ? 'async_callback_error' : 'async_callback_success',
      level: isError ? 'error' : 'success',
      title: isError
        ? `Async Task Failed: ${event.pluginName}`
        : `Async Task Completed: ${event.pluginName}`,
      message: isError
        ? `Error: ${event.error || 'Unknown error'}`
        : `Task ${event.taskId} completed`,
      data: {
        pluginName: event.pluginName,
        taskId: event.taskId,
        error: event.error
      }
    })

    this.addNotification(notification)

    // 发送系统通知
    if (this.config.systemNotificationEnabled) {
      this.sendSystemNotification(notification)
    }
  }

  /**
   * 处理日志事件
   */
  onLogEntry(entry: LogEntry): void {
    // 只处理 error 和 warn 级别
    if (entry.level !== 'error' && entry.level !== 'warn') {
      return
    }

    const notification = this.createNotification({
      type: 'system_alert',
      level: entry.level === 'error' ? 'error' : 'warning',
      title: `VCP ${entry.level.toUpperCase()}: ${entry.category}`,
      message: entry.message,
      data: {
        traceId: entry.traceId,
        ...entry.data
      }
    })

    this.addNotification(notification)

    // 只对 error 发送系统通知
    if (this.config.systemNotificationEnabled && entry.level === 'error') {
      this.sendSystemNotification(notification)
    }
  }

  /**
   * 发送自定义通知
   */
  notify(options: {
    level: NotificationLevel
    title: string
    message: string
    data?: Record<string, unknown>
    systemNotify?: boolean
  }): VCPNotification {
    const notification = this.createNotification({
      type: 'custom',
      level: options.level,
      title: options.title,
      message: options.message,
      data: options.data
    })

    this.addNotification(notification)

    if (options.systemNotify !== false && this.config.systemNotificationEnabled) {
      this.sendSystemNotification(notification)
    }

    return notification
  }

  /**
   * 检查是否应该发送通知
   */
  private shouldNotify(call: ToolCallLog): boolean {
    const { filters, errorOnly, quietHours } = this.config

    // 检查静默时段
    if (quietHours && this.isQuietHours(quietHours)) {
      return false
    }

    // 检查只错误通知
    if (errorOnly && call.status !== 'error') {
      return false
    }

    // 检查工具过滤
    if (filters.includedTools?.length && !filters.includedTools.includes(call.toolName)) {
      return false
    }
    if (filters.excludedTools?.includes(call.toolName)) {
      return false
    }

    // 检查最小耗时
    if (filters.minDuration && (call.duration || 0) < filters.minDuration) {
      return false
    }

    return true
  }

  /**
   * 检查是否在静默时段
   */
  private isQuietHours(quietHours: string): boolean {
    const match = quietHours.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
    if (!match) return false

    const [, startH, startM, endH, endM] = match.map(Number)
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (startMinutes <= endMinutes) {
      // 同一天内的时段，如 09:00-17:00
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    } else {
      // 跨天时段，如 22:00-08:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }
  }

  /**
   * 创建通知对象
   */
  private createNotification(params: {
    type: NotificationType
    level: NotificationLevel
    title: string
    message: string
    data?: Record<string, unknown>
  }): VCPNotification {
    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: params.type,
      level: params.level,
      title: params.title,
      message: params.message,
      timestamp: new Date(),
      data: params.data,
      read: false,
      systemNotified: false
    }
  }

  /**
   * 添加通知
   */
  private addNotification(notification: VCPNotification): void {
    this.notifications.unshift(notification)

    // 清理旧通知
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications)
    }

    // 广播到渲染进程
    this.broadcastToRenderer('vcpNotification:new', notification)
  }

  /**
   * 发送系统通知
   */
  private sendSystemNotification(notification: VCPNotification): void {
    try {
      // 检查 Electron Notification 是否支持
      if (!ElectronNotification.isSupported()) {
        logger.warn('System notifications not supported')
        return
      }

      const electronNotification = new ElectronNotification({
        title: notification.title,
        body: notification.message,
        silent: !this.config.soundEnabled,
        icon: this.getNotificationIcon(notification.level)
      })

      electronNotification.on('click', () => {
        // 点击通知时显示主窗口
        const mainWindow = windowService.getMainWindow()
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          // 发送点击事件
          mainWindow.webContents.send('vcpNotification:click', notification)
        }
      })

      electronNotification.show()
      notification.systemNotified = true

      logger.debug('System notification sent', { id: notification.id, title: notification.title })
    } catch (error) {
      logger.error('Failed to send system notification', error as Error)
    }
  }

  /**
   * 获取通知图标路径
   */
  private getNotificationIcon(_level: NotificationLevel): string | undefined {
    // TODO: 返回不同级别的图标路径
    return undefined
  }

  /**
   * 获取通知列表
   */
  getNotifications(options?: { limit?: number; unreadOnly?: boolean }): VCPNotification[] {
    let result = this.notifications

    if (options?.unreadOnly) {
      result = result.filter((n) => !n.read)
    }

    if (options?.limit) {
      result = result.slice(0, options.limit)
    }

    return result
  }

  /**
   * 获取未读数量
   */
  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length
  }

  /**
   * 标记为已读
   */
  markAsRead(notificationIds: string[]): void {
    const idSet = new Set(notificationIds)
    for (const notification of this.notifications) {
      if (idSet.has(notification.id)) {
        notification.read = true
      }
    }

    this.broadcastToRenderer('vcpNotification:readStatusChanged', {
      ids: notificationIds,
      unreadCount: this.getUnreadCount()
    })
  }

  /**
   * 标记全部已读
   */
  markAllAsRead(): void {
    for (const notification of this.notifications) {
      notification.read = true
    }

    this.broadcastToRenderer('vcpNotification:readStatusChanged', {
      ids: this.notifications.map((n) => n.id),
      unreadCount: 0
    })
  }

  /**
   * 清空通知
   */
  clearNotifications(): void {
    this.notifications = []
    this.broadcastToRenderer('vcpNotification:cleared', {})
  }

  /**
   * 发送测试通知
   */
  sendTestNotification(): void {
    const notification = this.createNotification({
      type: 'custom',
      level: 'info',
      title: 'VCP Test Notification',
      message: 'This is a test notification from VCP Notification Service',
      data: { test: true }
    })

    this.addNotification(notification)

    if (this.config.systemNotificationEnabled) {
      this.sendSystemNotification(notification)
    }
  }

  /**
   * 广播消息到渲染进程
   */
  private broadcastToRenderer(channel: string, data: unknown): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, data)
        }
      }
    } catch (error) {
      logger.error('Failed to broadcast to renderer', error as Error)
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): VCPNotificationConfig {
    return { ...this.config }
  }
}

// 单例实例
let _instance: VCPNotificationService | null = null

/**
 * 获取 VCPNotificationService 单例
 */
export function getVCPNotificationService(): VCPNotificationService {
  if (!_instance) {
    _instance = new VCPNotificationService()
  }
  return _instance
}

/**
 * 创建新的 VCPNotificationService 实例
 */
export function createVCPNotificationService(config?: Partial<VCPNotificationConfig>): VCPNotificationService {
  return new VCPNotificationService(config)
}
