/**
 * 服务适配器基类
 *
 * 所有需要使用统一存储的服务都应该继承此类。
 * 提供:
 * - 统一存储核心访问
 * - TagMemo 增强搜索
 * - 标准化的搜索/插入接口
 *
 * @module storage/ServiceAdapter
 */

import type { Client } from '@libsql/client'
import { loggerService } from '@logger'
import type { TagMemoService } from '@main/knowledge/tagmemo'
import type { CharacterIndexManager, VexusAdapter } from '@main/knowledge/vector/VexusAdapter'

import type {
  ChunkData,
  ChunkResult,
  SearchOptions,
  UnifiedStorageDependencies
, UnifiedStorageCore } from './UnifiedStorageCore'
import { getUnifiedStorage } from './UnifiedStorageCore'

const logger = loggerService.withContext('ServiceAdapter')

// ==================== 类型定义 ====================

export type SourceType = 'knowledge' | 'memory' | 'diary'

export interface ServiceSearchOptions extends SearchOptions {
  /** 额外的过滤条件 */
  filters?: Record<string, unknown>
  /** 是否使用混合搜索 (向量 + 文本) */
  hybridSearch?: boolean
  /** 重排序配置 */
  rerank?: {
    enabled: boolean
    topK?: number
  }
}

export interface ServiceSearchResult<T = ChunkResult> {
  results: T[]
  count: number
  source: SourceType
  metadata?: {
    searchTime: number
    tagMemoApplied: boolean
    hybridSearchApplied: boolean
  }
}

export interface ServiceInsertOptions {
  /** 是否自动生成 embedding */
  autoEmbed?: boolean
  /** 是否提取并关联标签 */
  extractTags?: boolean
  /** 自定义标签 */
  tags?: string[]
}

// ==================== ServiceAdapter 基类 ====================

/**
 * 服务适配器基类
 *
 * 使用方式:
 * ```typescript
 * class MyService extends ServiceAdapter {
 *   constructor() {
 *     super('knowledge')
 *   }
 *
 *   async search(query: string): Promise<SearchResult[]> {
 *     return this.searchWithEnhancement(query, { topK: 10 })
 *   }
 * }
 * ```
 */
export abstract class ServiceAdapter {
  protected source: SourceType
  protected storage: UnifiedStorageCore
  protected dependencies: UnifiedStorageDependencies | null = null
  protected isConnected = false

  /**
   * 构造函数
   * @param source 数据来源类型
   */
  constructor(source: SourceType) {
    this.source = source
    this.storage = getUnifiedStorage()
  }

  /**
   * 连接到统一存储
   * 必须在使用其他方法前调用
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    try {
      // 确保存储已初始化
      await this.storage.initialize()

      // 获取依赖
      this.dependencies = this.storage.getDependencies()
      this.isConnected = true

      logger.debug(`ServiceAdapter connected`, { source: this.source })
    } catch (error) {
      logger.error('Failed to connect ServiceAdapter', error as Error)
      throw error
    }
  }

  /**
   * 设置依赖 (VCP 风格依赖注入)
   * 允许外部注入依赖，用于测试或特殊场景
   */
  public setDependencies(deps: UnifiedStorageDependencies): void {
    this.dependencies = deps
    this.isConnected = true
    logger.debug('Dependencies injected', { source: this.source })
  }

  /**
   * 确保已连接
   */
  protected ensureConnected(): void {
    if (!this.isConnected || !this.dependencies) {
      throw new Error(`ServiceAdapter not connected. Call connect() first. Source: ${this.source}`)
    }
  }

  // ==================== 核心搜索方法 ====================

  /**
   * 带增强的搜索
   * 自动应用 TagMemo 增强
   */
  protected async searchWithEnhancement(
    query: string,
    options: ServiceSearchOptions = {}
  ): Promise<ServiceSearchResult> {
    this.ensureConnected()

    const startTime = Date.now()
    const {
      topK = 10,
      threshold = 0.5,
      enableTagBoost = true,
      filters
    } = options

    // 使用统一存储搜索
    let results = await this.storage.searchChunks(query, {
      source: this.source,
      topK,
      threshold,
      enableTagBoost,
      ...options
    })

    // 应用额外过滤
    if (filters && Object.keys(filters).length > 0) {
      results = this.applyFilters(results, filters)
    }

    const searchTime = Date.now() - startTime

    return {
      results,
      count: results.length,
      source: this.source,
      metadata: {
        searchTime,
        tagMemoApplied: enableTagBoost,
        hybridSearchApplied: false
      }
    }
  }

  /**
   * 应用过滤条件
   */
  private applyFilters(
    results: ChunkResult[],
    filters: Record<string, unknown>
  ): ChunkResult[] {
    return results.filter(result => {
      for (const [key, value] of Object.entries(filters)) {
        const resultValue = result.metadata?.[key]
        if (resultValue !== value) {
          return false
        }
      }
      return true
    })
  }

  /**
   * 直接向量搜索 (不使用 TagMemo)
   */
  protected async vectorSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<ChunkResult[]> {
    this.ensureConnected()

    return this.storage.searchChunks(query, {
      ...options,
      source: this.source,
      enableTagBoost: false
    })
  }

  // ==================== 核心插入方法 ====================

  /**
   * 插入内容
   */
  protected async insertContent(
    content: string,
    options: ServiceInsertOptions & Partial<ChunkData> = {}
  ): Promise<string> {
    this.ensureConnected()

    const {
      autoEmbed = true,
      extractTags = true,
      tags = [],
      ...chunkData
    } = options

    // 提取标签 (如果启用)
    let allTags = [...tags]
    if (extractTags) {
      const tagMemo = this.getTagMemo()
      if (tagMemo) {
        const extractedTags = tagMemo.extractTagsFromQuery(content)
        allTags = [...new Set([...allTags, ...extractedTags])]
      }
    }

    // 生成 embedding (如果启用且有 embeddings)
    let embedding: number[] | undefined
    if (autoEmbed) {
      try {
        embedding = await this.storage.getSingleEmbedding(content)
      } catch (error) {
        logger.warn('Failed to generate embedding, inserting without vector', error as Error)
      }
    }

    // 插入到统一存储
    const id = await this.storage.insertChunk({
      content,
      source: this.source,
      embedding,
      tags: allTags.length > 0 ? allTags : undefined,
      ...chunkData
    })

    return id
  }

  /**
   * 批量插入内容
   */
  protected async insertBatch(
    items: Array<{ content: string; options?: ServiceInsertOptions & Partial<ChunkData> }>
  ): Promise<string[]> {
    const ids: string[] = []

    for (const item of items) {
      try {
        const id = await this.insertContent(item.content, item.options)
        ids.push(id)
      } catch (error) {
        logger.error('Failed to insert item in batch', error as Error)
      }
    }

    return ids
  }

  // ==================== 标签操作 ====================

  /**
   * 为内容添加标签
   */
  protected async addTags(chunkId: string, tags: string[]): Promise<void> {
    this.ensureConnected()
    await this.storage.addTagsToChunk(chunkId, tags)
  }

  /**
   * 获取内容的标签
   */
  protected async getTags(chunkId: string): Promise<string[]> {
    this.ensureConnected()
    return this.storage.getTagsForChunk(chunkId)
  }

  // ==================== 依赖访问 ====================

  /**
   * 获取数据库实例
   */
  protected getDatabase(): Client {
    this.ensureConnected()
    return this.dependencies!.db
  }

  /**
   * 获取向量索引
   */
  protected getVectorIndex(): VexusAdapter {
    this.ensureConnected()
    return this.dependencies!.vectorIndex
  }

  /**
   * 获取角色索引管理器
   */
  protected getCharacterIndexManager(): CharacterIndexManager {
    this.ensureConnected()
    return this.dependencies!.characterIndexManager
  }

  /**
   * 获取 TagMemo 服务
   */
  protected getTagMemo(): TagMemoService | null {
    return this.storage.getTagMemo()
  }

  /**
   * 获取 Embedding 方法
   */
  protected async getEmbedding(text: string): Promise<number[]> {
    this.ensureConnected()
    return this.dependencies!.getSingleEmbedding(text)
  }

  /**
   * 应用 TagMemo 增强
   */
  protected async applyTagBoost(
    query: string,
    tags: string[],
    results: ChunkResult[]
  ): Promise<ChunkResult[]> {
    this.ensureConnected()
    return this.dependencies!.applyTagBoost(query, tags, results)
  }

  // ==================== 生命周期 ====================

  /**
   * 断开连接
   */
  public disconnect(): void {
    this.dependencies = null
    this.isConnected = false
    logger.debug('ServiceAdapter disconnected', { source: this.source })
  }

  /**
   * 获取源类型
   */
  public getSource(): SourceType {
    return this.source
  }

  /**
   * 检查是否已连接
   */
  public connected(): boolean {
    return this.isConnected
  }
}

// ==================== 辅助函数 ====================

/**
 * 创建服务适配器工厂
 * 用于创建预配置的服务适配器
 */
export function createServiceAdapter(source: SourceType): ServiceAdapter {
  // 创建匿名子类实例
  return new (class extends ServiceAdapter {
    constructor() {
      super(source)
    }
  })()
}

export default ServiceAdapter
