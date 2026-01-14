/**
 * 统一嵌入服务
 *
 * 功能:
 * 1. 统一的嵌入生成接口
 * 2. 智能缓存 (LRU + TTL)
 * 3. 维度自动适配
 * 4. 批量处理优化
 *
 * 使用示例:
 * ```typescript
 * const service = getEmbeddingService()
 * service.setDefaultConfig({ apiClient, targetDimension: 1536 })
 *
 * const result = await service.embedText('Hello world')
 * console.log(result.embedding, result.fromCache)
 * ```
 */

import { loggerService } from '@logger'
import type { ApiClient } from '@types'

import Embeddings from '../embedjs/embeddings/Embeddings'
import { EmbeddingCache } from './EmbeddingCache'

const logger = loggerService.withContext('UnifiedEmbeddingService')

// ==================== 类型定义 ====================

/**
 * 嵌入配置
 */
export interface EmbeddingConfig {
  /** API 客户端配置 */
  apiClient: ApiClient
  /** 目标维度 (可选，自动适配) */
  targetDimension?: number
  /** 是否启用缓存 (默认 true) */
  enableCache?: boolean
  /** 缓存 TTL (毫秒，默认 1 小时) */
  cacheTTL?: number
}

/**
 * 嵌入结果
 */
export interface EmbeddingResult {
  embedding: number[]
  dimension: number
  fromCache: boolean
  modelId: string
}

// ==================== 服务类 ====================

/**
 * 统一嵌入服务 (单例模式)
 *
 * 解决问题:
 * - 分散的嵌入生成逻辑
 * - 不同服务使用不同维度
 * - 缺乏统一缓存
 *
 * 设计:
 * - 单例确保全局缓存共享
 * - 支持多个 API 客户端
 * - 自动维度适配 (pad/truncate)
 */
export class UnifiedEmbeddingService {
  private static instance: UnifiedEmbeddingService | null = null

  private cache: EmbeddingCache
  private embeddingsInstances: Map<string, Embeddings> = new Map()
  private defaultConfig?: EmbeddingConfig

  private constructor() {
    this.cache = new EmbeddingCache({
      maxSize: 10000,
      ttlMs: 60 * 60 * 1000 // 1 小时
    })

    logger.info('UnifiedEmbeddingService initialized')
  }

  /**
   * 获取单例实例
   */
  static getInstance(): UnifiedEmbeddingService {
    if (!UnifiedEmbeddingService.instance) {
      UnifiedEmbeddingService.instance = new UnifiedEmbeddingService()
    }
    return UnifiedEmbeddingService.instance
  }

  /**
   * 重置单例 (主要用于测试)
   */
  static resetInstance(): void {
    if (UnifiedEmbeddingService.instance) {
      UnifiedEmbeddingService.instance.cache.clear()
      UnifiedEmbeddingService.instance.embeddingsInstances.clear()
      UnifiedEmbeddingService.instance = null
    }
  }

  /**
   * 设置默认配置
   */
  setDefaultConfig(config: EmbeddingConfig): void {
    this.defaultConfig = config
    logger.info('Default embedding config set', {
      provider: config.apiClient.provider,
      model: config.apiClient.model,
      targetDimension: config.targetDimension
    })
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): EmbeddingConfig | undefined {
    return this.defaultConfig
  }

  /**
   * 生成单个文本嵌入
   */
  async embedText(text: string, config?: Partial<EmbeddingConfig>): Promise<EmbeddingResult> {
    const mergedConfig = this.mergeConfig(config)
    const cacheKey = this.buildCacheKey(text, mergedConfig)

    // 检查缓存
    if (mergedConfig.enableCache !== false) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        logger.debug('Embedding cache hit', { textLength: text.length })
        return {
          embedding: cached.embedding,
          dimension: cached.embedding.length,
          fromCache: true,
          modelId: mergedConfig.apiClient.model
        }
      }
    }

    // 获取或创建 Embeddings 实例
    const embeddings = this.getEmbeddingsInstance(mergedConfig.apiClient)

    // 生成嵌入
    const startTime = Date.now()
    const rawEmbedding = await embeddings.embedQuery(text)
    const elapsed = Date.now() - startTime

    logger.debug('Embedding generated', {
      textLength: text.length,
      dimension: rawEmbedding.length,
      elapsed
    })

    // 维度适配
    const embedding = this.adaptDimension(rawEmbedding, mergedConfig.targetDimension)

    // 写入缓存
    if (mergedConfig.enableCache !== false) {
      this.cache.set(cacheKey, {
        embedding,
        createdAt: Date.now()
      })
    }

    return {
      embedding,
      dimension: embedding.length,
      fromCache: false,
      modelId: mergedConfig.apiClient.model
    }
  }

  /**
   * 批量生成文本嵌入
   */
  async embedTexts(texts: string[], config?: Partial<EmbeddingConfig>): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return []
    }

    const mergedConfig = this.mergeConfig(config)

    // 分离缓存命中和未命中
    const results: (EmbeddingResult | null)[] = new Array(texts.length).fill(null)
    const uncachedIndices: number[] = []
    const uncachedTexts: string[] = []

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.buildCacheKey(texts[i], mergedConfig)
      const cached = mergedConfig.enableCache !== false ? this.cache.get(cacheKey) : null

      if (cached) {
        results[i] = {
          embedding: cached.embedding,
          dimension: cached.embedding.length,
          fromCache: true,
          modelId: mergedConfig.apiClient.model
        }
      } else {
        uncachedIndices.push(i)
        uncachedTexts.push(texts[i])
      }
    }

    // 批量生成未缓存的嵌入
    if (uncachedTexts.length > 0) {
      const embeddings = this.getEmbeddingsInstance(mergedConfig.apiClient)
      const rawEmbeddings = await embeddings.embedDocuments(uncachedTexts)

      for (let j = 0; j < uncachedTexts.length; j++) {
        const idx = uncachedIndices[j]
        const embedding = this.adaptDimension(rawEmbeddings[j], mergedConfig.targetDimension)

        results[idx] = {
          embedding,
          dimension: embedding.length,
          fromCache: false,
          modelId: mergedConfig.apiClient.model
        }

        // 写入缓存
        if (mergedConfig.enableCache !== false) {
          const cacheKey = this.buildCacheKey(texts[idx], mergedConfig)
          this.cache.set(cacheKey, { embedding, createdAt: Date.now() })
        }
      }
    }

    logger.info('Batch embedding completed', {
      total: texts.length,
      cached: texts.length - uncachedTexts.length,
      generated: uncachedTexts.length
    })

    return results as EmbeddingResult[]
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number } {
    return this.cache.getStats()
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
    logger.info('Embedding cache cleared')
  }

  /**
   * 清理过期缓存
   */
  pruneCache(): number {
    const pruned = this.cache.prune()
    if (pruned > 0) {
      logger.info('Pruned expired cache entries', { count: pruned })
    }
    return pruned
  }

  // ==================== 私有方法 ====================

  private mergeConfig(config?: Partial<EmbeddingConfig>): EmbeddingConfig {
    if (!this.defaultConfig && !config?.apiClient) {
      throw new Error(
        'No embedding configuration provided. Call setDefaultConfig() first or provide apiClient in config.'
      )
    }

    return {
      ...this.defaultConfig,
      ...config,
      apiClient: config?.apiClient ?? this.defaultConfig!.apiClient
    } as EmbeddingConfig
  }

  private getEmbeddingsInstance(apiClient: ApiClient): Embeddings {
    const key = `${apiClient.provider}:${apiClient.model}:${apiClient.baseURL}`

    if (!this.embeddingsInstances.has(key)) {
      this.embeddingsInstances.set(key, new Embeddings({ embedApiClient: apiClient }))
    }

    return this.embeddingsInstances.get(key)!
  }

  private buildCacheKey(text: string, config: EmbeddingConfig): string {
    // 使用内容哈希 + 模型标识
    const contentHash = this.simpleHash(text)
    return `${config.apiClient.provider}:${config.apiClient.model}:${contentHash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }

  /**
   * 维度适配 (pad/truncate)
   *
   * - 如果原始维度 > 目标维度：截断
   * - 如果原始维度 < 目标维度：零填充
   * - 如果相等或无目标维度：保持原样
   */
  private adaptDimension(embedding: number[], targetDimension?: number): number[] {
    if (!targetDimension || embedding.length === targetDimension) {
      return embedding
    }

    if (embedding.length > targetDimension) {
      // Truncate
      return embedding.slice(0, targetDimension)
    }

    // Pad with zeros
    const padded = new Array(targetDimension).fill(0)
    for (let i = 0; i < embedding.length; i++) {
      padded[i] = embedding[i]
    }
    return padded
  }
}

// ==================== 导出便捷函数 ====================

let defaultService: UnifiedEmbeddingService | null = null

/**
 * 获取默认嵌入服务实例
 */
export function getEmbeddingService(): UnifiedEmbeddingService {
  if (!defaultService) {
    defaultService = UnifiedEmbeddingService.getInstance()
  }
  return defaultService
}

/**
 * 快捷嵌入函数
 */
export async function embedText(text: string, config?: Partial<EmbeddingConfig>): Promise<number[]> {
  const result = await getEmbeddingService().embedText(text, config)
  return result.embedding
}

/**
 * 快捷批量嵌入函数
 */
export async function embedTexts(texts: string[], config?: Partial<EmbeddingConfig>): Promise<number[][]> {
  const results = await getEmbeddingService().embedTexts(texts, config)
  return results.map((r) => r.embedding)
}
