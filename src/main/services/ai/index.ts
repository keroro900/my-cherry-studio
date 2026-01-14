/**
 * 统一 AI 客户端模块
 *
 * 导出统一 AI 客户端工厂和相关类型
 */

export {
  AIErrorCode,
  AIErrorHandler,
  createAIError,
  RequestInterceptor,
  RetryManager,
  StreamProcessor,
  UnifiedAIClientFactory,
  UsageTracker,
  type AIError,
  type AIMiddleware,
  type AIRequestContext,
  type AIRequestMetadata,
  type AIRequestOptions,
  type AIRequestResult,
  type RateLimitConfig,
  type StreamCallbacks,
  type TokenUsage
} from './UnifiedAIClientFactory'

// 便捷初始化函数
import { UnifiedAIClientFactory as factory } from './UnifiedAIClientFactory'

let initialized = false

/**
 * 初始化 AI 客户端工厂
 */
export function initializeAIClientFactory(): void {
  if (initialized) return

  // 配置常见 Provider 的限流
  const defaultProviders = [
    { id: 'openai', maxRequests: 60, maxConcurrent: 10 },
    { id: 'anthropic', maxRequests: 60, maxConcurrent: 10 },
    { id: 'gemini', maxRequests: 60, maxConcurrent: 10 },
    { id: 'azure-openai', maxRequests: 100, maxConcurrent: 20 },
    { id: 'zhipu', maxRequests: 30, maxConcurrent: 5 }
  ]

  for (const provider of defaultProviders) {
    factory.configureRateLimit(provider.id, {
      maxRequestsPerMinute: provider.maxRequests,
      maxConcurrent: provider.maxConcurrent
    })
  }

  initialized = true
}

/**
 * 获取统一 AI 客户端工厂实例
 */
export function getUnifiedAIClientFactory(): typeof factory {
  if (!initialized) {
    initializeAIClientFactory()
  }
  return factory
}
