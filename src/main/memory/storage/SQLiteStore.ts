/**
 * SQLite 持久化存储适配器
 *
 * 封装现有的 MemoryService，提供统一的存储接口：
 * - 向量存储和检索
 * - 记忆的增删改查
 * - 时间范围查询
 * - 类型和标签过滤
 *
 * @module memory/storage/SQLiteStore
 */

import { loggerService } from '@logger'
import { MemoryService } from '@main/services/memory/MemoryService'

import type {
  AddMemoryInput,
  MemoryEntry,
  MemoryRelation,
  MemorySource,
  MemoryType,
  RetrievalOptions,
  ScoredMemoryEntry,
  TimeRange
} from '../types'

const logger = loggerService.withContext('SQLiteStore')

// ==================== 类型定义 ====================

/**
 * 存储配置
 */
export interface SQLiteStoreConfig {
  /** 用户 ID */
  userId?: string
  /** Agent ID */
  agentId?: string
  /** 嵌入模型配置 */
  embeddingConfig?: {
    model: string
    provider: string
    apiKey: string
    baseURL: string
    dimensions?: number
  }
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  success: number
  failed: number
  errors: string[]
}

// ==================== SQLite 存储适配器 ====================

/**
 * SQLite 持久化存储
 */
export class SQLiteStore {
  private memoryService: MemoryService
  private config: SQLiteStoreConfig
  private initialized = false

  constructor(config: SQLiteStoreConfig = {}) {
    this.config = config
    this.memoryService = MemoryService.getInstance()
  }

  // ==================== 初始化 ====================

  /**
   * 初始化存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 迁移旧数据库
      this.memoryService.migrateMemoryDb()
      this.initialized = true
      logger.info('SQLite store initialized')
    } catch (error) {
      logger.error('Failed to initialize SQLite store', { error })
      throw error
    }
  }

  /**
   * 关闭存储
   */
  async close(): Promise<void> {
    await this.memoryService.close()
    this.initialized = false
  }

  // ==================== 添加记忆 ====================

  /**
   * 添加单条记忆
   */
  async add(input: AddMemoryInput): Promise<MemoryEntry> {
    await this.initialize()

    const metadata: Record<string, any> = {
      type: input.type,
      source: input.source,
      importance: input.importance,
      confidence: input.confidence,
      tags: input.tags,
      ...input.customMetadata
    }

    const result = await this.memoryService.add(input.content, {
      userId: this.config.userId || 'default-user',
      agentId: this.config.agentId,
      metadata
    })

    if (result.error || result.memories.length === 0) {
      throw new Error(result.error || 'Failed to add memory')
    }

    const added = result.memories[0]
    return this.toMemoryEntry(added)
  }

  /**
   * 批量添加记忆
   */
  async addBatch(inputs: AddMemoryInput[]): Promise<BatchOperationResult> {
    await this.initialize()

    const result: BatchOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    }

    for (const input of inputs) {
      try {
        await this.add(input)
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    return result
  }

  // ==================== 检索记忆 ====================

  /**
   * 向量搜索
   */
  async search(query: string, options: Partial<RetrievalOptions> = {}): Promise<ScoredMemoryEntry[]> {
    await this.initialize()

    const searchResult = await this.memoryService.search(query, {
      limit: options.topK || 10,
      userId: this.config.userId,
      agentId: this.config.agentId,
      filters: this.buildFilters(options)
    })

    if (searchResult.error) {
      logger.error('Search failed', { error: searchResult.error })
      return []
    }

    return searchResult.memories.map((m) => this.toScoredMemoryEntry(m))
  }

  /**
   * 按 ID 获取记忆
   */
  async getById(id: string): Promise<MemoryEntry | null> {
    await this.initialize()

    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: 1000
    })

    const found = result.memories.find((m) => m.id === id)
    return found ? this.toMemoryEntry(found) : null
  }

  /**
   * 按哈希查找记忆（用于去重检测）
   */
  async findByHash(hash: string): Promise<MemoryEntry | null> {
    await this.initialize()

    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: 1000
    })

    const found = result.memories.find((m) => {
      // 检查元数据中的哈希
      const memHash = m.metadata?.hash || m.metadata?.contentHash
      return memHash === hash
    })

    return found ? this.toMemoryEntry(found) : null
  }

  /**
   * 批量获取记忆
   */
  async getByIds(ids: string[]): Promise<MemoryEntry[]> {
    await this.initialize()

    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: 1000
    })

    const idSet = new Set(ids)
    return result.memories.filter((m) => idSet.has(m.id)).map((m) => this.toMemoryEntry(m))
  }

  /**
   * 按类型搜索
   */
  async searchByType(types: MemoryType[], query?: string, limit = 20): Promise<MemoryEntry[]> {
    await this.initialize()

    // 使用 list 然后过滤
    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: 500
    })

    let filtered = result.memories.filter((m) => {
      const memType = m.metadata?.type as MemoryType
      return types.includes(memType)
    })

    // 如果有查询，进一步过滤
    if (query) {
      const queryLower = query.toLowerCase()
      filtered = filtered.filter((m) => m.memory.toLowerCase().includes(queryLower))
    }

    return filtered.slice(0, limit).map((m) => this.toMemoryEntry(m))
  }

  /**
   * 按标签搜索
   */
  async searchByTags(tags: string[], limit = 20): Promise<MemoryEntry[]> {
    await this.initialize()

    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: 500
    })

    const tagSet = new Set(tags.map((t) => t.toLowerCase()))

    const filtered = result.memories.filter((m) => {
      const memTags = (m.metadata?.tags as string[]) || []
      return memTags.some((t) => tagSet.has(t.toLowerCase()))
    })

    return filtered.slice(0, limit).map((m) => this.toMemoryEntry(m))
  }

  /**
   * 按时间范围搜索
   */
  async searchByTimeRange(range: TimeRange): Promise<MemoryEntry[]> {
    await this.initialize()

    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: 1000
    })

    const startTime = (range.start || range.startDate)?.getTime() ?? 0
    const endTime = (range.end || range.endDate)?.getTime() ?? Date.now()

    const filtered = result.memories.filter((m) => {
      const createdAt = new Date(m.createdAt || Date.now()).getTime()
      return createdAt >= startTime && createdAt <= endTime
    })

    return filtered.map((m) => this.toMemoryEntry(m))
  }

  /**
   * 获取记忆关系
   */
  async getRelations(_entryId: string): Promise<MemoryRelation[]> {
    // 当前 MemoryService 不支持关系，返回空数组
    // 后续可以扩展支持
    return []
  }

  // ==================== 更新和删除 ====================

  /**
   * 更新记忆
   */
  async update(id: string, updates: Partial<AddMemoryInput>): Promise<MemoryEntry | null> {
    await this.initialize()

    const existing = await this.getById(id)
    if (!existing) return null

    const newContent = updates.content || existing.content
    const newMetadata: Record<string, any> = {
      ...existing.metadata,
      ...(updates.type && { type: updates.type }),
      ...(updates.tags && { tags: updates.tags }),
      ...(updates.importance !== undefined && { importance: updates.importance }),
      ...(updates.confidence !== undefined && { confidence: updates.confidence }),
      ...updates.metadata
    }

    await this.memoryService.update(id, newContent, newMetadata)

    return this.getById(id)
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    await this.initialize()

    try {
      await this.memoryService.delete(id)
      return true
    } catch {
      return false
    }
  }

  /**
   * 批量删除
   */
  async deleteBatch(ids: string[]): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    }

    for (const id of ids) {
      const deleted = await this.delete(id)
      if (deleted) {
        result.success++
      } else {
        result.failed++
        result.errors.push(`Failed to delete ${id}`)
      }
    }

    return result
  }

  /**
   * 清空用户所有记忆
   */
  async clearAll(): Promise<void> {
    await this.initialize()

    if (this.config.userId) {
      await this.memoryService.deleteAllMemoriesForUser(this.config.userId)
    }
  }

  // ==================== 统计和列表 ====================

  /**
   * 获取记忆列表
   */
  async list(options: { limit?: number; offset?: number } = {}): Promise<MemoryEntry[]> {
    await this.initialize()

    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: options.limit || 100,
      offset: options.offset || 0
    })

    return result.memories.map((m) => this.toMemoryEntry(m))
  }

  /**
   * 获取记忆总数
   */
  async count(): Promise<number> {
    await this.initialize()

    const result = await this.memoryService.list({
      userId: this.config.userId,
      limit: 1
    })

    return result.count
  }

  /**
   * 获取记忆历史
   */
  async getHistory(memoryId: string): Promise<any[]> {
    await this.initialize()
    return this.memoryService.get(memoryId)
  }

  // ==================== 辅助方法 ====================

  /**
   * 构建过滤条件
   */
  private buildFilters(options: Partial<RetrievalOptions>): Record<string, any> {
    const filters: Record<string, any> = {}

    if (options.filters?.types?.length) {
      filters.type = options.filters.types[0] // 简化处理
    }

    if (options.filters?.minImportance !== undefined) {
      filters.minImportance = options.filters.minImportance
    }

    return filters
  }

  /**
   * 转换为 MemoryEntry
   */
  private toMemoryEntry(item: any): MemoryEntry {
    const metadata = item.metadata || {}

    return {
      id: item.id,
      content: item.memory,
      type: (metadata.type as MemoryType) || 'fact',
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt || item.createdAt),
      accessCount: metadata.accessCount || 0,
      lastAccessedAt: metadata.lastAccessedAt ? new Date(metadata.lastAccessedAt) : undefined,
      metadata: {
        source: (metadata.source as MemorySource) || 'conversation',
        importance: metadata.importance || 5,
        confidence: metadata.confidence || 0.5,
        tags: metadata.tags || [],
        entities: metadata.entities || [],
        relations: metadata.relations || [],
        context: metadata.context
      }
    }
  }

  /**
   * 转换为 ScoredMemoryEntry
   */
  private toScoredMemoryEntry(item: any): ScoredMemoryEntry {
    const entry = this.toMemoryEntry(item)
    return {
      ...entry,
      score: item.score || 0.5,
      matchReason: item.matchReason
    }
  }

}

// ==================== 工厂方法 ====================

/**
 * 创建 SQLite 存储实例
 */
export function createSQLiteStore(config?: SQLiteStoreConfig): SQLiteStore {
  return new SQLiteStore(config)
}

export default SQLiteStore
