/**
 * VCP 日志插件
 *
 * 将系统日志推送到 WebSocket 客户端
 * 类似于 VCPToolBox 的 VCPLog 功能
 */

import { loggerService } from '@logger'

import type { VCPPlugin, VCPPluginWebSocketAPI, WebSocketClientType } from '../types'
import { LogLevel, WebSocketMessageType } from '../types'

const logger = loggerService.withContext('VCPLogPlugin')

/**
 * VCP 日志插件配置
 */
export interface VCPLogPluginConfig {
  /** 最小日志级别 */
  minLevel?: LogLevel
  /** 是否包含上下文 */
  includeContext?: boolean
  /** 目标客户端类型 */
  targetClientTypes?: WebSocketClientType[]
  /** 日志缓冲区大小 */
  bufferSize?: number
  /** 批量发送间隔 (毫秒) */
  batchIntervalMs?: number
}

/**
 * VCP 日志插件
 */
export class VCPLogPlugin implements VCPPlugin {
  readonly id = 'vcp-log'
  readonly name = 'VCP Log Plugin'

  private api: VCPPluginWebSocketAPI | null = null
  private config: Required<VCPLogPluginConfig>
  private logBuffer: Array<{
    level: LogLevel
    message: string
    context?: string
    meta?: Record<string, unknown>
    timestamp: number
  }> = []
  private batchTimer: NodeJS.Timeout | null = null

  constructor(config?: VCPLogPluginConfig) {
    this.config = {
      minLevel: config?.minLevel ?? LogLevel.INFO,
      includeContext: config?.includeContext ?? true,
      targetClientTypes: config?.targetClientTypes ?? [],
      bufferSize: config?.bufferSize ?? 100,
      batchIntervalMs: config?.batchIntervalMs ?? 1000
    }
  }

  async initialize(api: VCPPluginWebSocketAPI): Promise<void> {
    this.api = api
    this.startBatchTimer()
    logger.info('VCP Log Plugin initialized')
  }

  async cleanup(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }

    // 发送剩余的日志
    this.flushBuffer()
    this.api = null

    logger.info('VCP Log Plugin cleaned up')
  }

  /**
   * 推送日志
   */
  pushLog(level: LogLevel, message: string, context?: string, meta?: Record<string, unknown>): void {
    // 检查日志级别
    if (!this.shouldLog(level)) return

    const logEntry = {
      level,
      message,
      context: this.config.includeContext ? context : undefined,
      meta,
      timestamp: Date.now()
    }

    this.logBuffer.push(logEntry)

    // 如果缓冲区满了，立即发送
    if (this.logBuffer.length >= this.config.bufferSize) {
      this.flushBuffer()
    }
  }

  /**
   * 立即推送日志 (不经过缓冲)
   */
  pushLogImmediate(level: LogLevel, message: string, context?: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level) || !this.api) return

    this.api.pushLog(level, message, context, meta)
  }

  /**
   * 检查是否应该记录此级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    const minIndex = levels.indexOf(this.config.minLevel)
    const currentIndex = levels.indexOf(level)
    return currentIndex >= minIndex
  }

  /**
   * 启动批量发送定时器
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flushBuffer()
    }, this.config.batchIntervalMs)
  }

  /**
   * 刷新缓冲区
   */
  private flushBuffer(): void {
    if (this.logBuffer.length === 0 || !this.api) return

    const logs = this.logBuffer.splice(0, this.logBuffer.length)

    // 批量发送
    if (this.config.targetClientTypes.length > 0) {
      for (const clientType of this.config.targetClientTypes) {
        this.api.sendToClientType(clientType, {
          type: WebSocketMessageType.LOG_BATCH,
          data: { logs }
        })
      }
    } else {
      this.api.broadcast({
        type: WebSocketMessageType.LOG_BATCH,
        data: { logs }
      })
    }
  }

  /**
   * 设置最小日志级别
   */
  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level
  }

  /**
   * 获取当前配置
   */
  getConfig(): VCPLogPluginConfig {
    return { ...this.config }
  }
}

/**
 * 创建 VCP 日志插件实例
 */
export function createVCPLogPlugin(config?: VCPLogPluginConfig): VCPLogPlugin {
  return new VCPLogPlugin(config)
}
