/**
 * VCPLogBridge - Crew 日志与 VCP 控制台桥接
 *
 * 实现 Crew 执行日志与 VCP 日志系统的双向同步：
 * - Crew 日志 → VCP 日志流（在 WorkbenchPanel 中显示）
 * - VCP 日志 → Crew 可视化面板（过滤 crew: 前缀）
 */

import { loggerService } from '@logger'

import type { CrewLogEntry, CrewLogLevel } from '../types'

const logger = loggerService.withContext('VCPLogBridge')

// ==================== 类型定义 ====================

/**
 * VCP 日志条目格式
 */
interface VCPLogEntry {
  id?: string
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  message: string
  data?: unknown
  timestamp: number
}

/**
 * 日志桥接配置
 */
interface VCPLogBridgeConfig {
  /** 是否启用向 VCP 转发 */
  forwardToVCP: boolean
  /** 是否启用从 VCP 接收 */
  receiveFromVCP: boolean
  /** 日志级别过滤 */
  minLevel: CrewLogLevel
  /** Crew 日志前缀 */
  crewPrefix: string
}

// ==================== 日志桥接器实现 ====================

class VCPLogBridgeImpl {
  private config: VCPLogBridgeConfig = {
    forwardToVCP: true,
    receiveFromVCP: true,
    minLevel: 'info',
    crewPrefix: 'crew:'
  }
  private vcpUnsubscribe: (() => void) | null = null
  private crewLogCallbacks: Set<(entry: CrewLogEntry) => void> = new Set()
  private logBuffer: CrewLogEntry[] = []
  private maxBufferSize = 500

  /**
   * 初始化桥接器
   */
  initialize(config?: Partial<VCPLogBridgeConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // 订阅 VCP 日志事件
    if (this.config.receiveFromVCP && window.api?.vcpLog?.onLog) {
      this.vcpUnsubscribe = window.api.vcpLog.onLog((entry) => {
        this.handleVCPLog(entry as VCPLogEntry)
      })
    }

    logger.debug('Initialized', { config: this.config })
  }

  /**
   * 销毁桥接器
   */
  destroy(): void {
    if (this.vcpUnsubscribe) {
      this.vcpUnsubscribe()
      this.vcpUnsubscribe = null
    }
    this.crewLogCallbacks.clear()
    this.logBuffer = []
    logger.debug('Destroyed')
  }

  /**
   * 将 Crew 日志转发到 VCP
   */
  forwardToVCP(entry: CrewLogEntry): void {
    if (!this.config.forwardToVCP) return
    if (!this.shouldLog(entry.level)) return

    // 添加到本地缓冲
    this.addToBuffer(entry)

    // 转换并发送到 VCP
    const vcpEntry: VCPLogEntry = {
      level: this.mapLevel(entry.level),
      source: `${this.config.crewPrefix}${entry.source}`,
      message: entry.message,
      data: entry.details,
      timestamp: entry.timestamp.getTime()
    }

    // 通过 IPC 发送
    this.sendToVCP(vcpEntry)
  }

  /**
   * 订阅 Crew 日志（来自 VCP 或本地）
   */
  subscribeCrewLogs(callback: (entry: CrewLogEntry) => void): () => void {
    this.crewLogCallbacks.add(callback)
    return () => {
      this.crewLogCallbacks.delete(callback)
    }
  }

  /**
   * 获取缓冲的日志
   */
  getBufferedLogs(): CrewLogEntry[] {
    return [...this.logBuffer]
  }

  /**
   * 清空日志缓冲
   */
  clearBuffer(): void {
    this.logBuffer = []
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VCPLogBridgeConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // ==================== 便捷日志方法 ====================

  debug(source: string, message: string, details?: unknown): void {
    this.log('debug', source, message, details)
  }

  info(source: string, message: string, details?: unknown): void {
    this.log('info', source, message, details)
  }

  warn(source: string, message: string, details?: unknown): void {
    this.log('warn', source, message, details)
  }

  error(source: string, message: string, details?: unknown): void {
    this.log('error', source, message, details)
  }

  success(source: string, message: string, details?: unknown): void {
    this.log('success', source, message, details)
  }

  log(level: CrewLogLevel, source: string, message: string, details?: unknown): void {
    const entry: CrewLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      source,
      message,
      details,
      timestamp: new Date()
    }
    this.forwardToVCP(entry)
    this.notifyCallbacks(entry)
  }

  // ==================== 私有方法 ====================

  private handleVCPLog(entry: VCPLogEntry): void {
    // 只处理 crew: 前缀的日志
    if (!entry.source?.startsWith(this.config.crewPrefix)) {
      return
    }

    // 转换为 Crew 日志格式
    const crewEntry: CrewLogEntry = {
      id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: this.reverseMapLevel(entry.level),
      source: entry.source.replace(this.config.crewPrefix, ''),
      message: entry.message,
      details: entry.data,
      timestamp: new Date(entry.timestamp)
    }

    // 通知订阅者
    this.notifyCallbacks(crewEntry)
  }

  private sendToVCP(entry: VCPLogEntry): void {
    try {
      // 如果有专门的日志写入 API
      if (window.api?.vcpLog?.write) {
        window.api.vcpLog.write(entry)
        return
      }

      // 备用：通过 vcpInfo 发布事件
      if (window.api?.vcpInfo?.publishEvent) {
        window.api.vcpInfo.publishEvent({
          type: 'crew:log',
          data: entry,
          timestamp: entry.timestamp
        })
      }
    } catch (error) {
      console.debug('[VCPLogBridge] Failed to forward log:', error)
    }
  }

  private notifyCallbacks(entry: CrewLogEntry): void {
    this.crewLogCallbacks.forEach((callback) => {
      try {
        callback(entry)
      } catch (error) {
        console.error('[VCPLogBridge] Callback error:', error)
      }
    })
  }

  private addToBuffer(entry: CrewLogEntry): void {
    this.logBuffer.push(entry)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }
  }

  private shouldLog(level: CrewLogLevel): boolean {
    const levels: CrewLogLevel[] = ['debug', 'info', 'success', 'warn', 'error']
    const minIndex = levels.indexOf(this.config.minLevel)
    const currentIndex = levels.indexOf(level)
    return currentIndex >= minIndex
  }

  private mapLevel(level: CrewLogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case 'debug':
        return 'debug'
      case 'success':
      case 'info':
        return 'info'
      case 'warn':
        return 'warn'
      case 'error':
        return 'error'
      default:
        return 'info'
    }
  }

  private reverseMapLevel(level: string): CrewLogLevel {
    switch (level) {
      case 'debug':
        return 'debug'
      case 'warn':
        return 'warn'
      case 'error':
        return 'error'
      default:
        return 'info'
    }
  }
}

// ==================== 导出 ====================

export const VCPLogBridge = new VCPLogBridgeImpl()

export default VCPLogBridge
