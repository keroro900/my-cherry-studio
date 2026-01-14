/**
 * MemoryService - 全局记忆服务 (VCP 底层实现)
 *
 * 重构说明:
 * - 移除独立的 LibSQL 数据库，改用 UnifiedStorageCore 统一存储
 * - 记忆存储为 chunks (source='memory')，与知识库、日记共用存储层
 * - 自动获得 TagMemo 增强、VexusAdapter 向量索引
 * - 保持原有 API 签名以兼容 UI 和 IPC 层
 *
 * 架构关系:
 * ```
 * MemoryService (本文件)
 *       │
 *       ▼
 * UnifiedStorageCore
 *       │
 *  ┌────┼────┬────────────┐
 *  ▼    ▼    ▼            ▼
 * SQLite VexusAdapter TagMemo Embeddings
 * (chunks)  (向量索引)  (共现矩阵)
 * ```
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { getUnifiedStorage } from '@main/storage'
import type { UnifiedStorageCore } from '@main/storage/UnifiedStorageCore'
import type {
  AddMemoryOptions,
  AssistantMessage,
  MemoryConfig,
  MemoryHistoryItem,
  MemoryItem,
  MemoryListOptions,
  MemorySearchOptions
} from '@types'
import crypto from 'crypto'

const logger = loggerService.withContext('MemoryService')

export interface EmbeddingOptions {
  model: string
  provider: string
  apiKey: string
  apiVersion?: string
  baseURL: string
  dimensions?: number
  batchSize?: number
}

export interface VectorSearchOptions {
  limit?: number
  threshold?: number
  userId?: string
  agentId?: string
  filters?: Record<string, any>
}

export interface SearchResult {
  memories: MemoryItem[]
  count: number
  error?: string
}

export class MemoryService {
  private static instance: MemoryService | null = null
  private isInitialized = false
  private config: MemoryConfig | null = null
  private storage: UnifiedStorageCore | null = null

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService()
    }
    return MemoryService.instance
  }

  public static reload(): MemoryService {
    if (MemoryService.instance) {
      MemoryService.instance.close()
    }
    MemoryService.instance = new MemoryService()
    return MemoryService.instance
  }

  /**
   * 数据库迁移方法 (兼容性保留，不执行实际操作)
   * 旧版使用独立的 memories.db，现在使用 UnifiedStorageCore
   */
  public migrateMemoryDb(): void {
    logger.debug('migrateMemoryDb called - using UnifiedStorageCore, no migration needed')
  }

  /**
   * 初始化服务
   */
  private async init(): Promise<void> {
    if (this.isInitialized && this.storage) {
      return
    }

    try {
      this.storage = getUnifiedStorage()
      await this.storage.initialize()

      // 如果配置了 embedding，设置到 UnifiedStorageCore
      if (this.config?.embeddingApiClient) {
        await this.storage.setEmbeddingConfig(
          this.config.embeddingApiClient,
          this.config.embeddingDimensions
        )
      }

      this.isInitialized = true
      logger.debug('MemoryService initialized with UnifiedStorageCore')
    } catch (error) {
      logger.error('Failed to initialize MemoryService:', error as Error)
      throw new Error(
        `MemoryService initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * 添加新记忆
   */
  public async add(messages: string | AssistantMessage[], options: AddMemoryOptions): Promise<SearchResult> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    const { userId, agentId, metadata } = options

    try {
      // 将消息转换为字符串
      const memoryStrings = Array.isArray(messages)
        ? messages.map((m) => (typeof m === 'string' ? m : m.content))
        : [messages]

      const addedMemories: MemoryItem[] = []

      for (const memory of memoryStrings) {
        const trimmedMemory = memory.trim()
        if (!trimmedMemory) continue

        // 生成哈希用于去重
        const hash = crypto.createHash('sha256').update(trimmedMemory).digest('hex')

        // 检查是否已存在相似记忆 (通过搜索)
        try {
          const similarResults = await this.storage.searchChunks(trimmedMemory, {
            source: 'memory',
            userId,
            topK: 5,
            threshold: 0.85
          })

          if (similarResults.length > 0 && similarResults[0].score >= 0.85) {
            logger.debug(`Skipping duplicate memory, similarity: ${similarResults[0].score.toFixed(3)}`)
            continue
          }
        } catch (searchError) {
          // 搜索失败不阻止添加
          logger.warn('Similarity check failed, continuing with add', searchError as Error)
        }

        // 使用 UnifiedStorageCore 插入记忆
        const id = await this.storage.insertChunk({
          content: trimmedMemory,
          source: 'memory',
          userId: userId || 'default-user',
          agentId,
          tags: metadata?.tags as string[] | undefined,
          metadata: {
            ...metadata,
            hash,
            type: 'global_memory'
          }
        })

        const now = new Date().toISOString()

        addedMemories.push({
          id,
          memory: trimmedMemory,
          hash,
          createdAt: now,
          updatedAt: now,
          metadata: { ...metadata, userId }
        })
      }

      logger.debug('Memories added', { count: addedMemories.length })

      return {
        memories: addedMemories,
        count: addedMemories.length
      }
    } catch (error) {
      logger.error('Failed to add memories:', error as Error)
      return {
        memories: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 搜索记忆
   * 支持按 userId 和 agentId 双重隔离 (VCP 角色记忆)
   */
  public async search(query: string, options: MemorySearchOptions = {}): Promise<SearchResult> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    const { limit = 10, userId, agentId } = options

    try {
      // 使用 UnifiedStorageCore 搜索，自动获得 TagMemo 增强
      // 支持 agentId 过滤实现 VCP 角色记忆隔离
      const results = await this.storage.searchChunks(query, {
        source: 'memory',
        userId,
        agentId,
        topK: limit,
        threshold: 0.3,
        enableTagBoost: true
      })

      const memories: MemoryItem[] = results.map((r) => ({
        id: r.id,
        memory: r.content,
        hash: (r.metadata?.hash as string) || undefined,
        metadata: r.metadata,
        createdAt: (r.metadata?.createdAt as string) || new Date().toISOString(),
        updatedAt: (r.metadata?.updatedAt as string) || new Date().toISOString(),
        score: r.score,
        agentId: r.agentId
      }))

      return {
        memories,
        count: memories.length
      }
    } catch (error) {
      logger.error('Search failed:', error as Error)
      return {
        memories: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 列出所有记忆
   * 支持按 userId 和 agentId 双重隔离 (VCP 角色记忆)
   */
  public async list(options: MemoryListOptions = {}): Promise<SearchResult> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    const { userId, agentId, limit = 100, offset = 0 } = options

    try {
      // 使用 listChunks 直接查询数据库，不需要向量搜索
      const results = await this.storage.listChunks({
        source: 'memory',
        userId,
        agentId,
        limit,
        offset
      })

      const memories: MemoryItem[] = results.map((r) => ({
        id: r.id,
        memory: r.content,
        hash: (r.metadata?.hash as string) || undefined,
        metadata: r.metadata,
        createdAt: (r.metadata?.createdAt as string) || new Date().toISOString(),
        updatedAt: (r.metadata?.updatedAt as string) || new Date().toISOString(),
        score: r.score,
        agentId: r.agentId
      }))

      return {
        memories,
        count: memories.length
      }
    } catch (error) {
      logger.error('List failed:', error as Error)
      return {
        memories: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 删除记忆
   */
  public async delete(id: string): Promise<void> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    try {
      await this.storage.deleteChunk(id)
      logger.debug(`Memory deleted: ${id}`)
    } catch (error) {
      logger.error('Delete failed:', error as Error)
      throw new Error(`Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 更新记忆
   */
  public async update(id: string, memory: string, metadata?: Record<string, any>): Promise<void> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    try {
      // UnifiedStorageCore 的 updateChunk 方法
      const hash = crypto.createHash('sha256').update(memory.trim()).digest('hex')

      await this.storage.updateChunk(id, {
        content: memory.trim(),
        metadata: {
          ...metadata,
          hash,
          updatedAt: new Date().toISOString()
        }
      })

      logger.debug(`Memory updated: ${id}`)
    } catch (error) {
      logger.error('Update failed:', error as Error)
      throw new Error(`Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 获取记忆历史
   * 注意: VCP 统一存储不维护历史记录，返回空数组
   */
  public async get(_memoryId: string): Promise<MemoryHistoryItem[]> {
    await this.init()
    logger.debug('Memory history requested - not supported in VCP mode')
    return []
  }

  /**
   * 删除用户的所有记忆
   */
  public async deleteAllMemoriesForUser(userId: string): Promise<void> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    if (!userId) {
      throw new Error('User ID is required')
    }

    try {
      await this.storage.deleteChunksByFilter({
        source: 'memory',
        userId
      })

      logger.debug(`Reset all memories for user ${userId}`)
    } catch (error) {
      logger.error('Reset user memories failed:', error as Error)
      throw new Error(`Failed to reset user memories: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 删除用户及其所有记忆
   */
  public async deleteUser(userId: string): Promise<void> {
    await this.init()

    if (!userId) {
      throw new Error('User ID is required')
    }

    if (userId === 'default-user') {
      throw new Error('Cannot delete the default user')
    }

    // 删除用户的所有记忆
    await this.deleteAllMemoriesForUser(userId)
    logger.debug(`Deleted user ${userId}`)
  }

  // ==================== VCP 角色记忆隔离 (Agent Memory Isolation) ====================

  /**
   * 删除指定 Agent 的所有记忆
   * VCP 角色记忆功能：每个 Agent 有独立的记忆空间
   */
  public async deleteAllMemoriesForAgent(agentId: string, userId?: string): Promise<void> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    if (!agentId) {
      throw new Error('Agent ID is required')
    }

    try {
      const filter: { source: 'memory'; agentId: string; userId?: string } = {
        source: 'memory',
        agentId
      }
      if (userId) {
        filter.userId = userId
      }

      await this.storage.deleteChunksByFilter(filter)
      logger.debug(`Reset all memories for agent ${agentId}`, { userId })
    } catch (error) {
      logger.error('Reset agent memories failed:', error as Error)
      throw new Error(`Failed to reset agent memories: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 获取 Agent 记忆统计列表
   * VCP 角色记忆功能：列出所有有记忆的 Agent
   */
  public async getAgentsList(userId?: string): Promise<Array<{
    agentId: string
    memoryCount: number
    lastMemoryDate: string
  }>> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    try {
      const stats = await this.storage.getMemoryAgentStats(userId)
      return stats
    } catch (error) {
      logger.error('Get agents list failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索所有 Agent 的记忆 (跨 Agent 搜索)
   * VCP 统一记忆功能：类似于 search_all_knowledge_bases
   */
  public async searchAllAgents(query: string, options: Omit<MemorySearchOptions, 'agentId'> = {}): Promise<SearchResult> {
    // 不传 agentId 即可搜索所有 Agent 的记忆
    return this.search(query, options)
  }

  /**
   * 获取用户列表
   */
  public async getUsersList(): Promise<{ userId: string; memoryCount: number; lastMemoryDate: string }[]> {
    await this.init()
    if (!this.storage) throw new Error('Storage not initialized')

    try {
      const users = await this.storage.getMemoryUserStats()
      return users
    } catch (error) {
      logger.error('Get users list failed:', error as Error)
      // 返回默认用户
      return [{
        userId: 'default-user',
        memoryCount: 0,
        lastMemoryDate: new Date().toISOString()
      }]
    }
  }

  /**
   * 更新配置
   */
  public setConfig(config: MemoryConfig): void {
    this.config = config

    // 如果已初始化，更新 embedding 配置
    if (this.storage && config.embeddingApiClient) {
      this.storage.setEmbeddingConfig(
        config.embeddingApiClient,
        config.embeddingDimensions
      ).catch((error) => {
        logger.error('Failed to update embedding config:', error as Error)
      })
    }

    logger.debug('MemoryService config updated')
  }

  /**
   * 关闭服务
   */
  public async close(): Promise<void> {
    // UnifiedStorageCore 是单例，不需要关闭
    this.isInitialized = false
    this.storage = null
    logger.debug('MemoryService closed')
  }

  // ==================== TagMemo 配置方法 (兼容性) ====================

  /**
   * 启用/禁用 TagMemo 增强
   * VCP 模式下自动启用，此方法仅作日志记录
   */
  public setTagMemoEnhancement(enabled: boolean): void {
    logger.info('TagMemo enhancement setting (always enabled in VCP mode)', { enabled })
  }

  /**
   * 获取 TagMemo 统计信息
   */
  public getTagMemoStats(): { mode: string; tagCount: number; relationCount: number; documentCount: number } | null {
    if (!this.storage) return null

    try {
      const stats = this.storage.getTagMemoStats()
      return {
        mode: 'vcp-unified',
        tagCount: stats?.totalTags || 0,
        relationCount: stats?.totalRelations || 0,
        documentCount: stats?.totalDocuments || 0
      }
    } catch {
      return null
    }
  }

  /**
   * 获取 TagMemo 服务实例
   */
  public getTagMemoService() {
    return this.storage?.getTagMemoService() || null
  }
}

export default MemoryService
