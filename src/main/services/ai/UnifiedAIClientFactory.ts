/**
 * UnifiedAIClientFactory - 统一 AI 客户端工厂
 *
 * 提供统一的 AI 调用基础设施：
 * - RequestInterceptor: 请求拦截（日志/追踪）
 * - ErrorHandler: 统一错误处理
 * - RetryManager: 指数退避重试
 * - RateLimiter: 请求限流
 * - StreamProcessor: 统一流处理
 * - UsageTracker: 用量统计
 *
 * 设计原则：
 * 1. 与现有 ApiClientFactory 互补，不替换
 * 2. 提供横切关注点（cross-cutting concerns）的统一处理
 * 3. 支持中间件模式扩展
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('UnifiedAIClientFactory')

// ==================== 类型定义 ====================

/**
 * AI 请求选项
 */
export interface AIRequestOptions {
  /** 请求 ID（用于追踪） */
  requestId?: string
  /** 超时时间（毫秒） */
  timeout?: number
  /** 最大重试次数 */
  maxRetries?: number
  /** 是否启用限流 */
  enableRateLimit?: boolean
  /** 优先级 (0-10, 数值越高优先级越高) */
  priority?: number
  /** 上下文信息 */
  context?: Record<string, unknown>
  /** AbortSignal */
  signal?: AbortSignal
}

/**
 * AI 请求结果
 */
export interface AIRequestResult<T = unknown> {
  success: boolean
  data?: T
  error?: AIError
  metadata: AIRequestMetadata
}

/**
 * AI 错误
 */
export interface AIError {
  code: AIErrorCode
  message: string
  details?: unknown
  retryable: boolean
  httpStatus?: number
  provider?: string
}

/**
 * AI 错误代码
 */
export enum AIErrorCode {
  // 客户端错误
  INVALID_REQUEST = 'INVALID_REQUEST',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // 服务端错误
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  MODEL_NOT_AVAILABLE = 'MODEL_NOT_AVAILABLE',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  CONTENT_FILTERED = 'CONTENT_FILTERED',

  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',

  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN = 'UNKNOWN'
}

/**
 * 请求元数据
 */
export interface AIRequestMetadata {
  requestId: string
  startTime: number
  endTime?: number
  duration?: number
  retryCount: number
  provider?: string
  model?: string
  tokenUsage?: TokenUsage
}

/**
 * Token 使用量
 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedTokens?: number
}

/**
 * 限流配置
 */
export interface RateLimitConfig {
  /** 每分钟最大请求数 */
  maxRequestsPerMinute: number
  /** 每分钟最大 Token 数 */
  maxTokensPerMinute?: number
  /** 并发请求限制 */
  maxConcurrent?: number
  /** 突发请求限制 */
  burstLimit?: number
}

/**
 * 流处理回调
 */
export interface StreamCallbacks<T = string> {
  onStart?: () => void
  onChunk?: (chunk: T) => void
  onEnd?: (fullContent: T) => void
  onError?: (error: AIError) => void
  onMetadata?: (metadata: AIRequestMetadata) => void
}

/**
 * 中间件函数类型
 */
export type AIMiddleware = (request: AIRequestContext, next: () => Promise<AIRequestResult>) => Promise<AIRequestResult>

/**
 * 请求上下文
 */
export interface AIRequestContext {
  requestId: string
  provider: string
  model: string
  payload: unknown
  options: AIRequestOptions
  metadata: AIRequestMetadata
}

// ==================== 请求拦截器 ====================

class RequestInterceptor {
  private static requestCounter = 0

  /**
   * 生成请求 ID
   */
  static generateRequestId(): string {
    this.requestCounter++
    return `ai_${Date.now()}_${this.requestCounter.toString(36)}`
  }

  /**
   * 拦截请求前
   */
  static beforeRequest(context: AIRequestContext): void {
    logger.debug('AI Request started', {
      requestId: context.requestId,
      provider: context.provider,
      model: context.model
    })
  }

  /**
   * 拦截请求后
   */
  static afterRequest(context: AIRequestContext, result: AIRequestResult): void {
    const duration = Date.now() - context.metadata.startTime

    if (result.success) {
      logger.debug('AI Request completed', {
        requestId: context.requestId,
        duration,
        tokenUsage: result.metadata.tokenUsage
      })
    } else {
      logger.warn('AI Request failed', {
        requestId: context.requestId,
        duration,
        errorCode: result.error?.code,
        errorMessage: result.error?.message
      })
    }
  }
}

// ==================== 错误处理器 ====================

class AIErrorHandler {
  /**
   * 从原始错误创建 AI 错误
   */
  static fromError(error: unknown, provider?: string): AIError {
    if (error instanceof Error) {
      return this.classifyError(error, provider)
    }

    return {
      code: AIErrorCode.UNKNOWN,
      message: String(error),
      retryable: false,
      provider
    }
  }

  /**
   * 分类错误
   */
  private static classifyError(error: Error, provider?: string): AIError {
    const message = error.message.toLowerCase()
    const httpStatus = (error as any).status || (error as any).statusCode

    // 认证错误
    if (httpStatus === 401 || message.includes('unauthorized') || message.includes('api key')) {
      return {
        code: AIErrorCode.AUTHENTICATION_FAILED,
        message: '认证失败，请检查 API 密钥',
        details: error.message,
        retryable: false,
        httpStatus,
        provider
      }
    }

    // 限流错误
    if (httpStatus === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return {
        code: AIErrorCode.RATE_LIMITED,
        message: '请求过于频繁，请稍后重试',
        details: error.message,
        retryable: true,
        httpStatus,
        provider
      }
    }

    // 配额错误
    if (message.includes('quota') || message.includes('insufficient')) {
      return {
        code: AIErrorCode.QUOTA_EXCEEDED,
        message: 'API 配额已用尽',
        details: error.message,
        retryable: false,
        httpStatus,
        provider
      }
    }

    // 上下文长度错误
    if (message.includes('context length') || message.includes('token limit') || message.includes('max tokens')) {
      return {
        code: AIErrorCode.CONTEXT_LENGTH_EXCEEDED,
        message: '输入内容超出模型上下文长度限制',
        details: error.message,
        retryable: false,
        httpStatus,
        provider
      }
    }

    // 内容过滤错误
    if (message.includes('content filter') || message.includes('safety') || message.includes('blocked')) {
      return {
        code: AIErrorCode.CONTENT_FILTERED,
        message: '内容被安全策略过滤',
        details: error.message,
        retryable: false,
        httpStatus,
        provider
      }
    }

    // 超时错误
    if (message.includes('timeout') || error.name === 'TimeoutError') {
      return {
        code: AIErrorCode.TIMEOUT,
        message: '请求超时',
        details: error.message,
        retryable: true,
        httpStatus,
        provider
      }
    }

    // 网络错误
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      error.name === 'TypeError'
    ) {
      return {
        code: AIErrorCode.NETWORK_ERROR,
        message: '网络连接失败',
        details: error.message,
        retryable: true,
        httpStatus,
        provider
      }
    }

    // 服务端错误
    if (httpStatus && httpStatus >= 500) {
      return {
        code: AIErrorCode.PROVIDER_ERROR,
        message: 'AI 服务暂时不可用',
        details: error.message,
        retryable: true,
        httpStatus,
        provider
      }
    }

    // 默认错误
    return {
      code: AIErrorCode.UNKNOWN,
      message: error.message,
      details: error.stack,
      retryable: false,
      httpStatus,
      provider
    }
  }

  /**
   * 判断是否应该重试
   */
  static shouldRetry(error: AIError, attempt: number, maxRetries: number): boolean {
    if (!error.retryable) return false
    if (attempt >= maxRetries) return false

    // 特定错误码的重试策略
    switch (error.code) {
      case AIErrorCode.RATE_LIMITED:
        return attempt < 5 // 限流可以多试几次
      case AIErrorCode.TIMEOUT:
      case AIErrorCode.NETWORK_ERROR:
      case AIErrorCode.PROVIDER_ERROR:
        return true
      default:
        return false
    }
  }
}

// ==================== 重试管理器 ====================

class RetryManager {
  private static readonly DEFAULT_MAX_RETRIES = 3
  private static readonly BASE_DELAY = 1000 // 1 秒
  private static readonly MAX_DELAY = 60000 // 60 秒

  /**
   * 执行带重试的操作
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      onRetry?: (attempt: number, error: AIError, delay: number) => void
      shouldRetry?: (error: AIError, attempt: number) => boolean
    } = {}
  ): Promise<{ result?: T; error?: AIError; retryCount: number }> {
    const maxRetries = options.maxRetries ?? this.DEFAULT_MAX_RETRIES
    let lastError: AIError | undefined
    let retryCount = 0

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        return { result, retryCount }
      } catch (error) {
        lastError = AIErrorHandler.fromError(error)
        retryCount = attempt

        const shouldRetry =
          options.shouldRetry?.(lastError, attempt) ?? AIErrorHandler.shouldRetry(lastError, attempt, maxRetries)

        if (shouldRetry && attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt, lastError)

          logger.debug('Retrying AI request', {
            attempt: attempt + 1,
            maxRetries,
            delay,
            errorCode: lastError.code
          })

          options.onRetry?.(attempt + 1, lastError, delay)

          await this.delay(delay)
        } else {
          break
        }
      }
    }

    return { error: lastError, retryCount }
  }

  /**
   * 计算指数退避延迟
   */
  private static calculateBackoffDelay(attempt: number, error: AIError): number {
    // 限流错误使用更长的延迟
    const baseDelay = error.code === AIErrorCode.RATE_LIMITED ? this.BASE_DELAY * 2 : this.BASE_DELAY

    // 指数退避 + 抖动
    const exponentialDelay = baseDelay * Math.pow(2, attempt)
    const jitter = Math.random() * 0.3 * exponentialDelay

    return Math.min(exponentialDelay + jitter, this.MAX_DELAY)
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ==================== 限流器 ====================

class RateLimiter {
  private requestTimestamps: number[] = []
  private tokenTimestamps: Array<{ timestamp: number; tokens: number }> = []
  private currentConcurrent = 0
  private waitingQueue: Array<{ resolve: () => void; priority: number }> = []

  constructor(private config: RateLimitConfig) {}

  /**
   * 获取令牌（阻塞直到可用）
   */
  async acquire(priority: number = 5, estimatedTokens?: number): Promise<void> {
    // 检查并发限制
    if (this.config.maxConcurrent && this.currentConcurrent >= this.config.maxConcurrent) {
      await this.waitForSlot(priority)
    }

    // 检查请求速率限制
    await this.waitForRateLimit()

    // 检查 Token 限制
    if (estimatedTokens && this.config.maxTokensPerMinute) {
      await this.waitForTokenLimit(estimatedTokens)
    }

    this.currentConcurrent++
    this.requestTimestamps.push(Date.now())
  }

  /**
   * 释放令牌
   */
  release(actualTokens?: number): void {
    this.currentConcurrent--

    // 记录实际 Token 使用
    if (actualTokens) {
      this.tokenTimestamps.push({ timestamp: Date.now(), tokens: actualTokens })
    }

    // 唤醒等待队列中优先级最高的请求
    if (this.waitingQueue.length > 0) {
      this.waitingQueue.sort((a, b) => b.priority - a.priority)
      const next = this.waitingQueue.shift()
      next?.resolve()
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    currentConcurrent: number
    requestsInLastMinute: number
    tokensInLastMinute: number
    waitingCount: number
  } {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    this.cleanupOldTimestamps(oneMinuteAgo)

    return {
      currentConcurrent: this.currentConcurrent,
      requestsInLastMinute: this.requestTimestamps.length,
      tokensInLastMinute: this.tokenTimestamps.reduce((sum, t) => sum + t.tokens, 0),
      waitingCount: this.waitingQueue.length
    }
  }

  private async waitForSlot(priority: number): Promise<void> {
    return new Promise((resolve) => {
      this.waitingQueue.push({ resolve, priority })
    })
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    this.cleanupOldTimestamps(oneMinuteAgo)

    if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0]
      const waitTime = oldestTimestamp + 60000 - now

      if (waitTime > 0) {
        logger.debug('Rate limit reached, waiting', { waitTime })
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  private async waitForTokenLimit(estimatedTokens: number): Promise<void> {
    if (!this.config.maxTokensPerMinute) return

    const now = Date.now()
    const oneMinuteAgo = now - 60000

    this.tokenTimestamps = this.tokenTimestamps.filter((t) => t.timestamp > oneMinuteAgo)
    const tokensUsed = this.tokenTimestamps.reduce((sum, t) => sum + t.tokens, 0)

    if (tokensUsed + estimatedTokens > this.config.maxTokensPerMinute) {
      const oldestTimestamp = this.tokenTimestamps[0]?.timestamp || now
      const waitTime = oldestTimestamp + 60000 - now

      if (waitTime > 0) {
        logger.debug('Token limit reached, waiting', { waitTime, tokensUsed, estimatedTokens })
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  private cleanupOldTimestamps(threshold: number): void {
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > threshold)
    this.tokenTimestamps = this.tokenTimestamps.filter((t) => t.timestamp > threshold)
  }
}

// ==================== 流处理器 ====================

class StreamProcessor<T = string> {
  private chunks: T[] = []
  private isCompleted = false
  private error: AIError | undefined

  constructor(private callbacks: StreamCallbacks<T>) {}

  /**
   * 开始流处理
   */
  start(): void {
    this.chunks = []
    this.isCompleted = false
    this.error = undefined
    this.callbacks.onStart?.()
  }

  /**
   * 处理块
   */
  processChunk(chunk: T): void {
    if (this.isCompleted) return
    this.chunks.push(chunk)
    this.callbacks.onChunk?.(chunk)
  }

  /**
   * 完成流处理
   */
  complete(fullContent: T): void {
    if (this.isCompleted) return
    this.isCompleted = true
    this.callbacks.onEnd?.(fullContent)
  }

  /**
   * 处理错误
   */
  handleError(error: AIError): void {
    if (this.isCompleted) return
    this.isCompleted = true
    this.error = error
    this.callbacks.onError?.(error)
  }

  /**
   * 设置元数据
   */
  setMetadata(metadata: AIRequestMetadata): void {
    this.callbacks.onMetadata?.(metadata)
  }

  /**
   * 获取已处理的块
   */
  getChunks(): T[] {
    return [...this.chunks]
  }

  /**
   * 获取错误
   */
  getError(): AIError | undefined {
    return this.error
  }
}

// ==================== 用量追踪器 ====================

interface UsageRecord {
  requestId: string
  provider: string
  model: string
  timestamp: number
  tokenUsage: TokenUsage
  duration: number
  success: boolean
  errorCode?: AIErrorCode
}

class UsageTracker {
  private records: UsageRecord[] = []
  private static readonly MAX_RECORDS = 10000
  private static readonly CLEANUP_THRESHOLD = 12000

  /**
   * 记录使用
   */
  record(metadata: AIRequestMetadata, success: boolean, errorCode?: AIErrorCode): void {
    const record: UsageRecord = {
      requestId: metadata.requestId,
      provider: metadata.provider || 'unknown',
      model: metadata.model || 'unknown',
      timestamp: metadata.startTime,
      tokenUsage: metadata.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      duration: metadata.duration || 0,
      success,
      errorCode
    }

    this.records.push(record)
    this.cleanup()
  }

  /**
   * 获取统计信息
   */
  getStats(since?: number): {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    totalTokens: number
    averageDuration: number
    byProvider: Record<string, { requests: number; tokens: number; errors: number }>
    byModel: Record<string, { requests: number; tokens: number }>
    errorsByCode: Record<string, number>
  } {
    const threshold = since || Date.now() - 24 * 60 * 60 * 1000 // 默认 24 小时
    const filtered = this.records.filter((r) => r.timestamp >= threshold)

    const byProvider: Record<string, { requests: number; tokens: number; errors: number }> = {}
    const byModel: Record<string, { requests: number; tokens: number }> = {}
    const errorsByCode: Record<string, number> = {}

    let totalTokens = 0
    let totalDuration = 0
    let successfulRequests = 0
    let failedRequests = 0

    for (const record of filtered) {
      totalTokens += record.tokenUsage.totalTokens
      totalDuration += record.duration

      if (record.success) {
        successfulRequests++
      } else {
        failedRequests++
        if (record.errorCode) {
          errorsByCode[record.errorCode] = (errorsByCode[record.errorCode] || 0) + 1
        }
      }

      // 按 Provider 统计
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = { requests: 0, tokens: 0, errors: 0 }
      }
      byProvider[record.provider].requests++
      byProvider[record.provider].tokens += record.tokenUsage.totalTokens
      if (!record.success) byProvider[record.provider].errors++

      // 按 Model 统计
      if (!byModel[record.model]) {
        byModel[record.model] = { requests: 0, tokens: 0 }
      }
      byModel[record.model].requests++
      byModel[record.model].tokens += record.tokenUsage.totalTokens
    }

    return {
      totalRequests: filtered.length,
      successfulRequests,
      failedRequests,
      totalTokens,
      averageDuration: filtered.length > 0 ? totalDuration / filtered.length : 0,
      byProvider,
      byModel,
      errorsByCode
    }
  }

  /**
   * 导出记录
   */
  export(since?: number): UsageRecord[] {
    const threshold = since || 0
    return this.records.filter((r) => r.timestamp >= threshold)
  }

  /**
   * 清理旧记录
   */
  private cleanup(): void {
    if (this.records.length > UsageTracker.CLEANUP_THRESHOLD) {
      this.records = this.records.slice(-UsageTracker.MAX_RECORDS)
    }
  }
}

// ==================== 统一 AI 客户端工厂 ====================

class UnifiedAIClientFactoryImpl {
  private rateLimiters: Map<string, RateLimiter> = new Map()
  private usageTracker = new UsageTracker()
  private middlewares: AIMiddleware[] = []

  /**
   * 执行 AI 请求
   */
  async execute<T>(
    provider: string,
    model: string,
    operation: () => Promise<T>,
    options: AIRequestOptions = {}
  ): Promise<AIRequestResult<T>> {
    const requestId = options.requestId || RequestInterceptor.generateRequestId()
    const startTime = Date.now()

    const metadata: AIRequestMetadata = {
      requestId,
      startTime,
      retryCount: 0,
      provider,
      model
    }

    const context: AIRequestContext = {
      requestId,
      provider,
      model,
      payload: null,
      options,
      metadata
    }

    // 请求前拦截
    RequestInterceptor.beforeRequest(context)

    try {
      // 限流检查
      if (options.enableRateLimit !== false) {
        const limiter = this.getRateLimiter(provider)
        await limiter.acquire(options.priority)
      }

      // 执行带重试的操作
      const { result, error, retryCount } = await RetryManager.executeWithRetry(
        async () => {
          // 检查取消信号
          if (options.signal?.aborted) {
            throw new Error('Request was aborted')
          }

          return await operation()
        },
        {
          maxRetries: options.maxRetries ?? 3,
          onRetry: (attempt, err, delay) => {
            logger.debug('AI request retry', { requestId, attempt, errorCode: err.code, delay })
          }
        }
      )

      metadata.retryCount = retryCount
      metadata.endTime = Date.now()
      metadata.duration = metadata.endTime - startTime

      // 释放限流令牌
      if (options.enableRateLimit !== false) {
        const limiter = this.getRateLimiter(provider)
        limiter.release()
      }

      const aiResult: AIRequestResult<T> = error
        ? { success: false, error, metadata }
        : { success: true, data: result, metadata }

      // 请求后拦截
      RequestInterceptor.afterRequest(context, aiResult as AIRequestResult)

      // 记录使用
      this.usageTracker.record(metadata, aiResult.success, error?.code)

      return aiResult
    } catch (error) {
      metadata.endTime = Date.now()
      metadata.duration = metadata.endTime - startTime

      const aiError = AIErrorHandler.fromError(error, provider)
      const result: AIRequestResult<T> = {
        success: false,
        error: aiError,
        metadata
      }

      // 释放限流令牌
      if (options.enableRateLimit !== false) {
        const limiter = this.getRateLimiter(provider)
        limiter.release()
      }

      RequestInterceptor.afterRequest(context, result as AIRequestResult)
      this.usageTracker.record(metadata, false, aiError.code)

      return result
    }
  }

  /**
   * 创建流处理器
   */
  createStreamProcessor<T = string>(callbacks: StreamCallbacks<T>): StreamProcessor<T> {
    return new StreamProcessor(callbacks)
  }

  /**
   * 配置限流
   */
  configureRateLimit(provider: string, config: RateLimitConfig): void {
    this.rateLimiters.set(provider, new RateLimiter(config))
    logger.info('Rate limiter configured', { provider, config })
  }

  /**
   * 获取使用统计
   */
  getUsageStats(since?: number) {
    return this.usageTracker.getStats(since)
  }

  /**
   * 导出使用记录
   */
  exportUsageRecords(since?: number) {
    return this.usageTracker.export(since)
  }

  /**
   * 获取限流状态
   */
  getRateLimitStatus(provider: string) {
    const limiter = this.rateLimiters.get(provider)
    return limiter?.getStatus()
  }

  /**
   * 添加中间件
   */
  use(middleware: AIMiddleware): void {
    this.middlewares.push(middleware)
  }

  /**
   * 获取限流器
   */
  private getRateLimiter(provider: string): RateLimiter {
    if (!this.rateLimiters.has(provider)) {
      // 默认限流配置
      this.rateLimiters.set(
        provider,
        new RateLimiter({
          maxRequestsPerMinute: 60,
          maxConcurrent: 10
        })
      )
    }
    return this.rateLimiters.get(provider)!
  }
}

// ==================== 导出 ====================

export const UnifiedAIClientFactory = new UnifiedAIClientFactoryImpl()

// 导出组件类用于单独使用
export { AIErrorHandler, RequestInterceptor, RetryManager, StreamProcessor, UsageTracker }

// 导出辅助函数
export function createAIError(code: AIErrorCode, message: string, options?: Partial<AIError>): AIError {
  return {
    code,
    message,
    retryable: false,
    ...options
  }
}

export default UnifiedAIClientFactory
