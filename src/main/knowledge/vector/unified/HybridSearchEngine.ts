/**
 * HybridSearchEngine - 混合检索引擎
 *
 * 支持并行查询多个向量后端，并融合结果
 */

import { loggerService } from '@logger'

import type { VectorSearchResult } from '../types'
import type { BackendSearchResults, ResultAggregator } from './ResultAggregator'
import type { ExtendedVectorBackend, VectorBackendRegistry } from './VectorBackendRegistry'

const logger = loggerService.withContext('HybridSearchEngine')

/**
 * 混合搜索选项
 */
export interface HybridSearchOptions {
  /** 要查询的后端列表 */
  backends?: ExtendedVectorBackend[]
  /** 每个后端返回数量 */
  topK?: number
  /** 最低分数阈值 */
  threshold?: number
  /** 是否并行查询 (默认 true) */
  parallel?: boolean
  /** 单个后端超时 (毫秒) */
  timeout?: number
  /** 向量搜索配置 (用于本地后端) */
  vectorConfig?: {
    path: string
    dimensions?: number
  }
}

/**
 * 混合检索引擎
 */
export class HybridSearchEngine {
  private registry: VectorBackendRegistry
  private aggregator: ResultAggregator

  constructor(registry: VectorBackendRegistry, aggregator: ResultAggregator) {
    this.registry = registry
    this.aggregator = aggregator
  }

  /**
   * 执行混合搜索
   */
  async search(queryVector: number[], options: HybridSearchOptions = {}): Promise<BackendSearchResults[]> {
    const {
      backends = this.registry.getAvailableBackends(),
      topK = 10,
      threshold = 0,
      parallel = true,
      timeout = 30000
    } = options

    logger.debug('HybridSearchEngine starting', {
      backends: backends.length,
      topK,
      parallel
    })

    if (parallel) {
      return this.searchParallel(queryVector, backends, {
        topK,
        threshold,
        timeout,
        vectorConfig: options.vectorConfig
      })
    }

    return this.searchSequential(queryVector, backends, {
      topK,
      threshold,
      timeout,
      vectorConfig: options.vectorConfig
    })
  }

  /**
   * 并行搜索所有后端
   */
  private async searchParallel(
    queryVector: number[],
    backends: ExtendedVectorBackend[],
    options: Pick<HybridSearchOptions, 'topK' | 'threshold' | 'timeout' | 'vectorConfig'>
  ): Promise<BackendSearchResults[]> {
    const { topK = 10, threshold = 0, timeout = 30000 } = options

    const searchPromises = backends.map(async (backend): Promise<BackendSearchResults> => {
      const startTime = Date.now()

      try {
        const adapter = await this.registry.getAdapter(backend, options.vectorConfig)

        if (!adapter) {
          return {
            backend,
            results: [],
            durationMs: Date.now() - startTime,
            error: 'Adapter not available'
          }
        }

        // 创建超时 Promise
        const searchWithTimeout = Promise.race([
          adapter.similaritySearch(queryVector, topK),
          new Promise<VectorSearchResult[]>((_, reject) =>
            setTimeout(() => reject(new Error('Search timeout')), timeout)
          )
        ])

        const results = await searchWithTimeout

        // 过滤低分结果
        const filtered = threshold > 0 ? results.filter((r) => r.score >= threshold) : results

        return {
          backend,
          results: filtered,
          durationMs: Date.now() - startTime
        }
      } catch (error) {
        logger.warn(`Search failed for backend ${backend}`, { error: String(error) })
        return {
          backend,
          results: [],
          durationMs: Date.now() - startTime,
          error: String(error)
        }
      }
    })

    const results = await Promise.allSettled(searchPromises)

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      return {
        backend: backends[index],
        results: [],
        durationMs: 0,
        error: result.reason?.message || 'Unknown error'
      }
    })
  }

  /**
   * 顺序搜索所有后端
   */
  private async searchSequential(
    queryVector: number[],
    backends: ExtendedVectorBackend[],
    options: Pick<HybridSearchOptions, 'topK' | 'threshold' | 'timeout' | 'vectorConfig'>
  ): Promise<BackendSearchResults[]> {
    const { topK = 10, threshold = 0, timeout = 30000 } = options
    const results: BackendSearchResults[] = []

    for (const backend of backends) {
      const startTime = Date.now()

      try {
        const adapter = await this.registry.getAdapter(backend, options.vectorConfig)

        if (!adapter) {
          results.push({
            backend,
            results: [],
            durationMs: Date.now() - startTime,
            error: 'Adapter not available'
          })
          continue
        }

        // 创建超时 Promise
        const searchWithTimeout = Promise.race([
          adapter.similaritySearch(queryVector, topK),
          new Promise<VectorSearchResult[]>((_, reject) =>
            setTimeout(() => reject(new Error('Search timeout')), timeout)
          )
        ])

        const searchResults = await searchWithTimeout

        // 过滤低分结果
        const filtered = threshold > 0 ? searchResults.filter((r) => r.score >= threshold) : searchResults

        results.push({
          backend,
          results: filtered,
          durationMs: Date.now() - startTime
        })
      } catch (error) {
        logger.warn(`Search failed for backend ${backend}`, { error: String(error) })
        results.push({
          backend,
          results: [],
          durationMs: Date.now() - startTime,
          error: String(error)
        })
      }
    }

    return results
  }

  /**
   * 搜索并聚合结果
   */
  async searchAndAggregate(
    queryVector: number[],
    options: HybridSearchOptions & {
      rrfK?: number
      deduplicate?: boolean
    } = {}
  ): Promise<import('./ResultAggregator').UnifiedSearchResult[]> {
    const backendResults = await this.search(queryVector, options)

    return this.aggregator.aggregate(backendResults, {
      rrfK: options.rrfK,
      topK: options.topK,
      deduplicate: options.deduplicate
    })
  }
}

/**
 * 创建混合检索引擎
 */
export function createHybridSearchEngine(
  registry: VectorBackendRegistry,
  aggregator: ResultAggregator
): HybridSearchEngine {
  return new HybridSearchEngine(registry, aggregator)
}
