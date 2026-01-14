/**
 * ExternalKnowledgeManager - 外部知识源统一管理器
 *
 * 统一管理所有外部知识后端：
 * - 后端生命周期管理
 * - 统一搜索接口
 * - 结果聚合与排序
 * - 配置管理
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import type {
  BackendStatus,
  ExternalKnowledgeBackend,
  ExternalSearchOptions,
  ExternalSearchResult,
  ExternalSourceType
} from './ExternalKnowledgeBackend'
import type { ElasticsearchBackend, ElasticsearchConfig } from './ElasticsearchBackend'
import { getElasticsearchBackend } from './ElasticsearchBackend'
import type { Neo4jBackend, Neo4jConfig } from './Neo4jBackend'
import { getNeo4jBackend } from './Neo4jBackend'
import type { WikidataBackend, WikidataConfig } from './WikidataBackend'
import { getWikidataBackend } from './WikidataBackend'

const logger = loggerService.withContext('ExternalKnowledgeManager')

// ==================== 类型定义 ====================

/**
 * 外部知识源配置
 */
export interface ExternalKnowledgeConfig {
  neo4j?: Neo4jConfig & { enabled: boolean }
  wikidata?: WikidataConfig & { enabled: boolean }
  elasticsearch?: ElasticsearchConfig & { enabled: boolean }
}

/**
 * 聚合搜索选项
 */
export interface AggregatedSearchOptions extends ExternalSearchOptions {
  /** 搜索的后端类型 */
  sources?: ExternalSourceType[]
  /** 是否并行搜索 */
  parallel?: boolean
  /** 结果去重 */
  deduplicate?: boolean
  /** 结果排序方式 */
  sortBy?: 'score' | 'source' | 'relevance'
}

/**
 * 聚合搜索结果
 */
export interface AggregatedSearchResult {
  /** 所有结果 */
  results: ExternalSearchResult[]
  /** 按来源分组的结果 */
  bySource: Record<ExternalSourceType, ExternalSearchResult[]>
  /** 搜索耗时 (毫秒) */
  took: number
  /** 各后端状态 */
  sourceStatus: Record<ExternalSourceType, { success: boolean; error?: string; count: number }>
}

// ==================== ExternalKnowledgeManager ====================

export class ExternalKnowledgeManager {
  private static instance: ExternalKnowledgeManager

  /** 已注册的后端 */
  private backends: Map<ExternalSourceType, ExternalKnowledgeBackend> = new Map()

  /** 配置 */
  private config: ExternalKnowledgeConfig = {}

  private constructor() {
    logger.info('ExternalKnowledgeManager created')
  }

  static getInstance(): ExternalKnowledgeManager {
    if (!ExternalKnowledgeManager.instance) {
      ExternalKnowledgeManager.instance = new ExternalKnowledgeManager()
    }
    return ExternalKnowledgeManager.instance
  }

  // ==================== 初始化方法 ====================

  /**
   * 初始化所有已启用的后端
   */
  async initialize(config: ExternalKnowledgeConfig): Promise<void> {
    this.config = config
    const initPromises: Promise<void>[] = []

    // Neo4j
    if (config.neo4j?.enabled) {
      initPromises.push(this.initializeBackend('neo4j', config.neo4j))
    }

    // Wikidata
    if (config.wikidata?.enabled) {
      initPromises.push(this.initializeBackend('wikidata', config.wikidata))
    }

    // Elasticsearch
    if (config.elasticsearch?.enabled) {
      initPromises.push(this.initializeBackend('elasticsearch', config.elasticsearch))
    }

    await Promise.allSettled(initPromises)
    logger.info('ExternalKnowledgeManager initialized', {
      backends: Array.from(this.backends.keys())
    })
  }

  private async initializeBackend(
    type: ExternalSourceType,
    config: Neo4jConfig | WikidataConfig | ElasticsearchConfig
  ): Promise<void> {
    try {
      let backend: ExternalKnowledgeBackend

      switch (type) {
        case 'neo4j':
          backend = getNeo4jBackend(config as Neo4jConfig)
          break
        case 'wikidata':
          backend = getWikidataBackend(config as WikidataConfig)
          break
        case 'elasticsearch':
          backend = getElasticsearchBackend(config as ElasticsearchConfig)
          break
        default:
          throw new Error(`Unknown backend type: ${type}`)
      }

      await backend.initialize()
      this.backends.set(type, backend)
      logger.info(`Backend ${type} initialized successfully`)
    } catch (error) {
      logger.error(`Failed to initialize backend ${type}`, error as Error)
      throw error
    }
  }

  /**
   * 关闭所有后端
   */
  async shutdown(): Promise<void> {
    const closePromises = Array.from(this.backends.values()).map((b) => b.close())
    await Promise.allSettled(closePromises)
    this.backends.clear()
    logger.info('ExternalKnowledgeManager shutdown')
  }

  // ==================== 后端管理 ====================

  /**
   * 获取后端
   */
  getBackend<T extends ExternalKnowledgeBackend>(type: ExternalSourceType): T | null {
    return (this.backends.get(type) as T) || null
  }

  /**
   * 获取所有已启用的后端类型
   */
  getEnabledBackends(): ExternalSourceType[] {
    return Array.from(this.backends.keys())
  }

  /**
   * 检查后端是否已启用
   */
  isBackendEnabled(type: ExternalSourceType): boolean {
    return this.backends.has(type)
  }

  /**
   * 获取所有后端状态
   */
  async getBackendStatuses(): Promise<Record<ExternalSourceType, BackendStatus>> {
    const statuses: Record<string, BackendStatus> = {}

    for (const [type, backend] of this.backends) {
      try {
        statuses[type] = await backend.checkConnection()
      } catch (error) {
        statuses[type] = {
          connected: false,
          healthy: false,
          lastCheck: new Date(),
          error: String(error)
        }
      }
    }

    return statuses as Record<ExternalSourceType, BackendStatus>
  }

  // ==================== 搜索方法 ====================

  /**
   * 聚合搜索 - 在所有启用的后端中搜索
   */
  async search(query: string, options?: AggregatedSearchOptions): Promise<AggregatedSearchResult> {
    const startTime = Date.now()
    const sources = options?.sources || Array.from(this.backends.keys())
    const parallel = options?.parallel !== false

    const result: AggregatedSearchResult = {
      results: [],
      bySource: {} as Record<ExternalSourceType, ExternalSearchResult[]>,
      took: 0,
      sourceStatus: {} as Record<ExternalSourceType, { success: boolean; error?: string; count: number }>
    }

    // 执行搜索
    const searchTasks = sources
      .filter((s) => this.backends.has(s))
      .map(async (source) => {
        try {
          const backend = this.backends.get(source)!
          const results = await backend.search(query, options)
          return { source, results, error: null }
        } catch (error) {
          return { source, results: [], error: String(error) }
        }
      })

    const searchResults = parallel ? await Promise.all(searchTasks) : await this.runSequential(searchTasks)

    // 聚合结果
    for (const { source, results, error } of searchResults) {
      result.bySource[source] = results
      result.sourceStatus[source] = {
        success: !error,
        error: error || undefined,
        count: results.length
      }
      result.results.push(...results)
    }

    // 去重
    if (options?.deduplicate) {
      result.results = this.deduplicateResults(result.results)
    }

    // 排序
    result.results = this.sortResults(result.results, options?.sortBy || 'score')

    // 限制数量
    if (options?.limit) {
      result.results = result.results.slice(0, options.limit)
    }

    result.took = Date.now() - startTime
    return result
  }

  /**
   * 在指定后端搜索
   */
  async searchInBackend(
    type: ExternalSourceType,
    query: string,
    options?: ExternalSearchOptions
  ): Promise<ExternalSearchResult[]> {
    const backend = this.backends.get(type)
    if (!backend) {
      throw new Error(`Backend ${type} not enabled`)
    }

    return backend.search(query, options)
  }

  /**
   * 获取实体
   */
  async getEntity(type: ExternalSourceType, id: string): Promise<ExternalSearchResult | null> {
    const backend = this.backends.get(type)
    if (!backend) {
      throw new Error(`Backend ${type} not enabled`)
    }

    return backend.getEntity(id)
  }

  // ==================== 特定后端方法 ====================

  /**
   * 获取 Neo4j 后端
   */
  getNeo4j(): Neo4jBackend | null {
    return this.getBackend<Neo4jBackend>('neo4j')
  }

  /**
   * 获取 Wikidata 后端
   */
  getWikidata(): WikidataBackend | null {
    return this.getBackend<WikidataBackend>('wikidata')
  }

  /**
   * 获取 Elasticsearch 后端
   */
  getElasticsearch(): ElasticsearchBackend | null {
    return this.getBackend<ElasticsearchBackend>('elasticsearch')
  }

  // ==================== 辅助方法 ====================

  private async runSequential<T>(tasks: Array<Promise<T>>): Promise<T[]> {
    const results: T[] = []
    for (const task of tasks) {
      results.push(await task)
    }
    return results
  }

  private deduplicateResults(results: ExternalSearchResult[]): ExternalSearchResult[] {
    const seen = new Set<string>()
    const deduped: ExternalSearchResult[] = []

    for (const result of results) {
      // 使用标题和内容前 100 字符作为去重键
      const key = `${result.title}:${result.content.slice(0, 100)}`
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(result)
      }
    }

    return deduped
  }

  private sortResults(
    results: ExternalSearchResult[],
    sortBy: 'score' | 'source' | 'relevance'
  ): ExternalSearchResult[] {
    switch (sortBy) {
      case 'score':
        return results.sort((a, b) => b.score - a.score)

      case 'source':
        // 按来源分组，每个来源内按分数排序
        const bySource: Record<string, ExternalSearchResult[]> = {}
        for (const r of results) {
          if (!bySource[r.sourceType]) {
            bySource[r.sourceType] = []
          }
          bySource[r.sourceType].push(r)
        }

        const sorted: ExternalSearchResult[] = []
        for (const source of Object.keys(bySource).sort()) {
          sorted.push(...bySource[source].sort((a, b) => b.score - a.score))
        }
        return sorted

      case 'relevance':
        // 综合考虑分数和来源多样性
        // 交替从不同来源取结果
        const queues: Record<string, ExternalSearchResult[]> = {}
        for (const r of results.sort((a, b) => b.score - a.score)) {
          if (!queues[r.sourceType]) {
            queues[r.sourceType] = []
          }
          queues[r.sourceType].push(r)
        }

        const interleaved: ExternalSearchResult[] = []
        const sources = Object.keys(queues)
        let i = 0

        while (interleaved.length < results.length) {
          const source = sources[i % sources.length]
          const queue = queues[source]
          if (queue.length > 0) {
            interleaved.push(queue.shift()!)
          }
          i++
        }

        return interleaved

      default:
        return results
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 更新后端配置
   */
  async updateBackendConfig(
    type: ExternalSourceType,
    config: Partial<Neo4jConfig | WikidataConfig | ElasticsearchConfig>
  ): Promise<void> {
    const backend = this.backends.get(type)
    if (backend) {
      backend.updateConfig(config)
    }
  }

  /**
   * 启用后端
   */
  async enableBackend(
    type: ExternalSourceType,
    config: Neo4jConfig | WikidataConfig | ElasticsearchConfig
  ): Promise<void> {
    if (this.backends.has(type)) {
      logger.warn(`Backend ${type} already enabled`)
      return
    }

    await this.initializeBackend(type, config)
  }

  /**
   * 禁用后端
   */
  async disableBackend(type: ExternalSourceType): Promise<void> {
    const backend = this.backends.get(type)
    if (backend) {
      await backend.close()
      this.backends.delete(type)
      logger.info(`Backend ${type} disabled`)
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): ExternalKnowledgeConfig {
    return { ...this.config }
  }
}

// ==================== 导出 ====================

let managerInstance: ExternalKnowledgeManager | null = null

export function getExternalKnowledgeManager(): ExternalKnowledgeManager {
  if (!managerInstance) {
    managerInstance = ExternalKnowledgeManager.getInstance()
  }
  return managerInstance
}
