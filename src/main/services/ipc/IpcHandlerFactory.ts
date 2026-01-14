/**
 * IpcHandlerFactory - 统一 IPC Handler 工厂
 *
 * 解决 IPC 通道碎片化问题：
 * - 统一 Handler 创建模板
 * - 统一错误处理
 * - 统一返回格式
 * - 自动日志记录
 * - 请求追踪
 *
 * 替代 35+ 个分散的 Handler 文件
 * 统一命名规范: Domain_Action (如 Memory_Search)
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron'

import { loggerService } from '@logger'

const logger = loggerService.withContext('IpcHandlerFactory')

// ==================== 类型定义 ====================

/**
 * 统一 IPC 返回格式
 */
export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: IpcError
  meta?: IpcResultMeta
}

/**
 * IPC 错误格式
 */
export interface IpcError {
  code: string
  message: string
  details?: unknown
  stack?: string
}

/**
 * IPC 结果元数据
 */
export interface IpcResultMeta {
  requestId?: string
  duration?: number
  timestamp: number
}

/**
 * Handler 选项
 */
export interface HandlerOptions {
  /** 是否记录日志 */
  logging?: boolean
  /** 是否包含堆栈跟踪 */
  includeStack?: boolean
  /** 超时时间 (毫秒) */
  timeout?: number
  /** 是否验证权限 */
  requiresAuth?: boolean
  /** 描述 */
  description?: string
}

/**
 * Handler 定义
 */
export interface HandlerDefinition<TPayload = unknown, TResult = unknown> {
  channel: string
  handler: (payload: TPayload, event: IpcMainInvokeEvent) => Promise<TResult>
  options?: HandlerOptions
}

/**
 * Handler 组定义
 */
export interface HandlerGroup {
  domain: string
  handlers: HandlerDefinition[]
}

// ==================== 错误代码 ====================

export const IpcErrorCodes = {
  // 通用错误
  UNKNOWN: 'ERR_UNKNOWN',
  VALIDATION: 'ERR_VALIDATION',
  NOT_FOUND: 'ERR_NOT_FOUND',
  TIMEOUT: 'ERR_TIMEOUT',
  PERMISSION: 'ERR_PERMISSION',

  // 网络错误
  NETWORK: 'ERR_NETWORK',
  API_ERROR: 'ERR_API',

  // 数据错误
  PARSE: 'ERR_PARSE',
  SERIALIZE: 'ERR_SERIALIZE',

  // 服务错误
  SERVICE_UNAVAILABLE: 'ERR_SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'ERR_RATE_LIMITED'
} as const

export type IpcErrorCode = (typeof IpcErrorCodes)[keyof typeof IpcErrorCodes]

// ==================== 错误类 ====================

export class IpcHandlerError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'IpcHandlerError'
    this.code = code
    this.details = details
  }
}

// ==================== 工厂实现 ====================

class IpcHandlerFactoryImpl {
  private registeredChannels: Set<string> = new Set()
  private handlerStats: Map<
    string,
    {
      calls: number
      errors: number
      totalDuration: number
    }
  > = new Map()

  /**
   * 注册单个 Handler
   */
  register<TPayload = unknown, TResult = unknown>(
    channel: string,
    handler: (payload: TPayload, event: IpcMainInvokeEvent) => Promise<TResult>,
    options?: HandlerOptions
  ): void {
    if (this.registeredChannels.has(channel)) {
      logger.warn('Handler already registered, overwriting', { channel })
    }

    const wrappedHandler = this.wrapHandler(channel, handler, options)
    ipcMain.handle(channel, wrappedHandler)
    this.registeredChannels.add(channel)

    this.handlerStats.set(channel, { calls: 0, errors: 0, totalDuration: 0 })

    if (options?.logging !== false) {
      logger.debug('Handler registered', { channel, description: options?.description })
    }
  }

  /**
   * 批量注册 Handlers
   */
  registerGroup(group: HandlerGroup): void {
    for (const def of group.handlers) {
      const channel = `${group.domain}_${def.channel}`
      this.register(channel, def.handler, def.options)
    }
    logger.info('Handler group registered', { domain: group.domain, count: group.handlers.length })
  }

  /**
   * 注册多个组
   */
  registerGroups(groups: HandlerGroup[]): void {
    for (const group of groups) {
      this.registerGroup(group)
    }
  }

  /**
   * 取消注册
   */
  unregister(channel: string): void {
    if (this.registeredChannels.has(channel)) {
      ipcMain.removeHandler(channel)
      this.registeredChannels.delete(channel)
      this.handlerStats.delete(channel)
      logger.debug('Handler unregistered', { channel })
    }
  }

  /**
   * 取消注册组
   */
  unregisterGroup(domain: string): void {
    for (const channel of this.registeredChannels) {
      if (channel.startsWith(`${domain}_`)) {
        this.unregister(channel)
      }
    }
  }

  /**
   * 获取所有注册的通道
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.registeredChannels)
  }

  /**
   * 获取 Handler 统计
   */
  getStats(): Record<
    string,
    {
      calls: number
      errors: number
      errorRate: number
      avgDuration: number
    }
  > {
    const result: Record<
      string,
      {
        calls: number
        errors: number
        errorRate: number
        avgDuration: number
      }
    > = {}

    for (const [channel, stats] of this.handlerStats) {
      result[channel] = {
        calls: stats.calls,
        errors: stats.errors,
        errorRate: stats.calls > 0 ? stats.errors / stats.calls : 0,
        avgDuration: stats.calls > 0 ? stats.totalDuration / stats.calls : 0
      }
    }

    return result
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    for (const stats of this.handlerStats.values()) {
      stats.calls = 0
      stats.errors = 0
      stats.totalDuration = 0
    }
  }

  // ==================== 私有方法 ====================

  private wrapHandler<TPayload, TResult>(
    channel: string,
    handler: (payload: TPayload, event: IpcMainInvokeEvent) => Promise<TResult>,
    options?: HandlerOptions
  ): (event: IpcMainInvokeEvent, payload: TPayload) => Promise<IpcResult<TResult>> {
    return async (event: IpcMainInvokeEvent, payload: TPayload): Promise<IpcResult<TResult>> => {
      const startTime = Date.now()
      const requestId = this.generateRequestId()
      const stats = this.handlerStats.get(channel)

      if (stats) {
        stats.calls++
      }

      try {
        // 超时处理
        let result: TResult
        if (options?.timeout) {
          result = await this.withTimeout(handler(payload, event), options.timeout, channel)
        } else {
          result = await handler(payload, event)
        }

        const duration = Date.now() - startTime
        if (stats) {
          stats.totalDuration += duration
        }

        return {
          success: true,
          data: result,
          meta: {
            requestId,
            duration,
            timestamp: Date.now()
          }
        }
      } catch (error) {
        if (stats) {
          stats.errors++
        }

        const ipcError = this.normalizeError(error, options)

        if (options?.logging !== false) {
          logger.error(`IPC ${channel} failed`, {
            requestId,
            code: ipcError.code,
            message: ipcError.message,
            details: ipcError.details
          })
        }

        return {
          success: false,
          error: ipcError,
          meta: {
            requestId,
            duration: Date.now() - startTime,
            timestamp: Date.now()
          }
        }
      }
    }
  }

  private normalizeError(error: unknown, options?: HandlerOptions): IpcError {
    if (error instanceof IpcHandlerError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: options?.includeStack ? error.stack : undefined
      }
    }

    if (error instanceof Error) {
      return {
        code: IpcErrorCodes.UNKNOWN,
        message: error.message,
        stack: options?.includeStack ? error.stack : undefined
      }
    }

    return {
      code: IpcErrorCodes.UNKNOWN,
      message: String(error)
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number, channel: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new IpcHandlerError(IpcErrorCodes.TIMEOUT, `Handler ${channel} timed out`)), timeout)
      )
    ])
  }

  private generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
  }
}

// ==================== 单例导出 ====================

let instance: IpcHandlerFactoryImpl | null = null

export function getIpcHandlerFactory(): IpcHandlerFactoryImpl {
  if (!instance) {
    instance = new IpcHandlerFactoryImpl()
  }
  return instance
}

// ==================== 便捷函数 ====================

/**
 * 创建 IPC Handler (便捷函数)
 */
export function createIpcHandler<TPayload = unknown, TResult = unknown>(
  channel: string,
  handler: (payload: TPayload, event: IpcMainInvokeEvent) => Promise<TResult>,
  options?: HandlerOptions
): void {
  getIpcHandlerFactory().register(channel, handler, options)
}

/**
 * 创建 Handler 组 (便捷函数)
 */
export function createHandlerGroup(
  domain: string,
  handlers: Array<Omit<HandlerDefinition, 'channel'> & { action: string }>
): void {
  const group: HandlerGroup = {
    domain,
    handlers: handlers.map((h) => ({
      channel: h.action,
      handler: h.handler,
      options: h.options
    }))
  }
  getIpcHandlerFactory().registerGroup(group)
}

/**
 * 创建成功结果
 */
export function ipcSuccess<T>(data: T): IpcResult<T> {
  return {
    success: true,
    data,
    meta: { timestamp: Date.now() }
  }
}

/**
 * 创建错误结果
 */
export function ipcError(code: string, message: string, details?: unknown): IpcResult<never> {
  return {
    success: false,
    error: { code, message, details },
    meta: { timestamp: Date.now() }
  }
}

export type IpcHandlerFactory = IpcHandlerFactoryImpl

// ==================== safeHandle 兼容函数 ====================

/**
 * 安全执行处理器 (兼容旧版 safeHandle 模式)
 *
 * 用于替换分散在 13+ 个文件中的 safeHandle 函数
 * 提供统一的错误处理和日志记录
 *
 * 用法:
 * ```typescript
 * // 旧写法:
 * ipcMain.handle(channel, async () => safeHandle('name', () => service.method()))
 *
 * // 新写法 (导入此函数):
 * import { safeHandle } from '@/services/ipc'
 * ipcMain.handle(channel, async () => safeHandle('name', () => service.method()))
 * ```
 */
export async function safeHandle<T>(name: string, handler: () => Promise<T> | T): Promise<T | { error: string }> {
  try {
    return await Promise.resolve(handler())
  } catch (error) {
    logger.error(`IPC handler "${name}" failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 安全执行处理器 (返回 IpcResult 格式)
 *
 * 用于需要统一返回格式的场景
 */
export async function safeHandleResult<T>(name: string, handler: () => Promise<T> | T): Promise<IpcResult<T>> {
  const startTime = Date.now()
  try {
    const data = await Promise.resolve(handler())
    return {
      success: true,
      data,
      meta: {
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    }
  } catch (error) {
    logger.error(`IPC handler "${name}" failed`, {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: {
        code: IpcErrorCodes.UNKNOWN,
        message: error instanceof Error ? error.message : String(error)
      },
      meta: {
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    }
  }
}

export default getIpcHandlerFactory
