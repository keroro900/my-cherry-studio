/**
 * UnifiedVectorService - 统一向量检索服务
 *
 * 整合本地和云端向量数据库，提供统一的搜索和管理入口
 *
 * 核心功能:
 * 1. 统一搜索入口 - 跨多个后端并行检索
 * 2. RRF 融合 - 多源结果智能融合
 * 3. 后端管理 - 本地 + 云端统一注册
 * 4. 缓存 - 利用 UnifiedEmbeddingService 的缓存
 */

import { loggerService } from '@logger'
import type { ApiClient } from '@types'

import type { VectorDbConfig } from '../types'
import type { CloudVectorBackend, CloudVectorConfig } from '../cloud/types'
import { createHybridSearchEngine, type HybridSearchEngine } from './HybridSearchEngine'
import { createResultAggregator, type ResultAggregator, type UnifiedSearchResult } from './ResultAggregator'
import {
  getVectorBackendRegistry,
  type ExtendedVectorBackend,
  type VectorBackendRegistry
} from './VectorBackendRegistry'

const logger = loggerService.withContext('UnifiedVectorService')

/**
 * 统一搜索选项
 */
export interface UnifiedSearchOptions {
  /** 搜索数量 */
  topK?: number
  /** 分数阈值 */
  threshold?: number

  /** 后端选择 */
  backends?: ExtendedVectorBackend[]
  /** 是否并行查询 (默认 true) */
  parallel?: boolean

  /** 向量配置 (本地后端) */
  vectorConfig?: VectorDbConfig

  /** RRF 融合选项 */
  useRRF?: boolean
  rrfK?: number

  /** 去重 */
  deduplicate?: boolean

  /** 超时 (毫秒) */
  timeout?: number
}

/**
 * 文本搜索选项 (自动生成 embedding)
 */
export interface TextSearchOptions extends UnifiedSearchOptions {
  /** Embedding API 客户端 */
  apiClient: ApiClient
  /** 目标维度 (可选) */
  targetDimension?: number
}

/**
 * 插入选项
 */
export interface InsertOptions {
  /** 目标后端 */
  backend?: ExtendedVectorBackend
  /** 向量配置 */
  vectorConfig?: VectorDbConfig
}

/**
 * 统一向量服务
 */
export class UnifiedVectorService {
  private static instance: UnifiedVectorService | null = null

  private registry: VectorBackendRegistry
  private hybridEngine: HybridSearchEngine
  private aggregator: ResultAggregator

  private constructor() {
    this.registry = getVectorBackendRegistry()
    this.aggregator = createResultAggregator()
    this.hybridEngine = createHybridSearchEngine(this.registry, this.aggregator)

    logger.info('UnifiedVectorService initialized')
  }

  /**
   * 获取单例实例
   */
  static getInstance(): UnifiedVectorService {
    if (!UnifiedVectorService.instance) {
      UnifiedVectorService.instance = new UnifiedVectorService()
    }
    return UnifiedVectorService.instance
  }

  /**
   * 重置单例 (测试用)
   */
  static resetInstance(): void {
    if (UnifiedVectorService.instance) {
      UnifiedVectorService.instance.dispose()
      UnifiedVectorService.instance = null
    }
  }

  // ==================== 后端管理 ====================

  /**
   * 注册云端后端
   */
  registerCloudBackend(type: CloudVectorBackend, config: CloudVectorConfig): void {
    this.registry.registerCloudBackend(type, config)
    logger.info('Cloud backend registered via UnifiedVectorService', { type })
  }

  /**
   * 移除云端后端
   */
  unregisterCloudBackend(type: CloudVectorBackend): void {
    this.registry.unregisterCloudBackend(type)
  }

  /**
   * 获取可用后端列表
   */
  getAvailableBackends(): ExtendedVectorBackend[] {
    return this.registry.getAvailableBackends()
  }

  /**
   * 获取后端元信息
   */
  getBackendsMeta() {
    return this.registry.getBackendsMeta()
  }

  /**
   * 检查后端是否可用
   */
  isBackendAvailable(backend: ExtendedVectorBackend): boolean {
    return this.registry.isAvailable(backend)
  }

  // ==================== 向量搜索 ====================

  /**
   * 向量搜索 (直接使用向量)
   */
  async search(queryVector: number[], options: UnifiedSearchOptions = {}): Promise<UnifiedSearchResult[]> {
    const {
      topK = 10,
      threshold = 0,
      backends,
      parallel = true,
      useRRF = true,
      rrfK = 60,
      deduplicate = true,
      timeout = 30000,
      vectorConfig
    } = options

    const startTime = Date.now()

    logger.debug('UnifiedVectorService search started', {
      vectorDimensions: queryVector.length,
      backends: backends?.length || 'all',
      topK
    })

    // 执行混合搜索
    const backendResults = await this.hybridEngine.search(queryVector, {
      backends,
      topK: topK * 2, // 获取更多结果用于融合
      threshold,
      parallel,
      timeout,
      vectorConfig
    })

    // 聚合结果
    let results: UnifiedSearchResult[]
    if (useRRF && backendResults.length > 1) {
      results = this.aggregator.aggregate(backendResults, {
        rrfK,
        topK,
        deduplicate
      })
    } else {
      results = this.aggregator.simpleMerge(backendResults, {
        topK,
        deduplicate
      })
    }

    logger.info('UnifiedVectorService search completed', {
      resultCount: results.length,
      durationMs: Date.now() - startTime
    })

    return results
  }

  /**
   * 文本搜索 (自动生成 embedding)
   */
  async searchByText(query: string, options: TextSearchOptions): Promise<UnifiedSearchResult[]> {
    const { apiClient, targetDimension, ...searchOptions } = options

    // 使用 UnifiedEmbeddingService 生成 embedding
    const { getEmbeddingService } = await import('../../embedding/UnifiedEmbeddingService')
    const embeddingService = getEmbeddingService()

    const result = await embeddingService.embedText(query, {
      apiClient,
      targetDimension
    })

    logger.debug('Query embedding generated', {
      dimensions: result.embedding.length,
      fromCache: result.fromCache
    })

    return this.search(result.embedding, searchOptions)
  }

  // ==================== 数据管理 ====================

  /**
   * 插入向量
   */
  async insert(
    chunks: Array<{ pageContent: string; metadata: Record<string, any> }>,
    vectors: number[][],
    options: InsertOptions = {}
  ): Promise<number> {
    const { backend = 'vexus', vectorConfig } = options

    const adapter = await this.registry.getAdapter(backend, vectorConfig)
    if (!adapter) {
      throw new Error(`Backend ${backend} not available`)
    }

    await adapter.initialize?.()
    return adapter.insertChunks(chunks, vectors)
  }

  /**
   * 删除向量
   */
  async delete(ids: string[], options: InsertOptions = {}): Promise<boolean> {
    const { backend = 'vexus', vectorConfig } = options

    const adapter = await this.registry.getAdapter(backend, vectorConfig)
    if (!adapter) {
      throw new Error(`Backend ${backend} not available`)
    }

    // 逐个删除
    for (const id of ids) {
      await adapter.deleteKeys(id)
    }

    return true
  }

  /**
   * 获取向量数量
   */
  async getVectorCount(backend: ExtendedVectorBackend, vectorConfig?: VectorDbConfig): Promise<number> {
    const adapter = await this.registry.getAdapter(backend, vectorConfig)
    if (!adapter) {
      return 0
    }
    return adapter.getVectorCount()
  }

  /**
   * 重置后端
   */
  async resetBackend(backend: ExtendedVectorBackend, vectorConfig?: VectorDbConfig): Promise<void> {
    const adapter = await this.registry.getAdapter(backend, vectorConfig)
    if (!adapter) {
      throw new Error(`Backend ${backend} not available`)
    }
    await adapter.reset()
  }

  // ==================== 生命周期 ====================

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    await this.registry.dispose()
    logger.info('UnifiedVectorService disposed')
  }
}

/**
 * 获取统一向量服务实例
 */
export function getUnifiedVectorService(): UnifiedVectorService {
  return UnifiedVectorService.getInstance()
}

/**
 * 便捷的向量搜索函数
 */
export async function vectorSearch(
  queryVector: number[],
  options?: UnifiedSearchOptions
): Promise<UnifiedSearchResult[]> {
  return getUnifiedVectorService().search(queryVector, options)
}

/**
 * 便捷的文本搜索函数
 */
export async function textSearch(query: string, options: TextSearchOptions): Promise<UnifiedSearchResult[]> {
  return getUnifiedVectorService().searchByText(query, options)
}
