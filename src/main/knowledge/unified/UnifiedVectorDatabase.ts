/**
 * UnifiedVectorDatabase - embedjs VectorDatabase 适配器
 *
 * 将 embedjs RAGApplication 的数据存储到 UnifiedStorageCore
 * 替代 LibSqlDb，实现 "记忆即知识库" 统一架构
 *
 * @module knowledge/unified/UnifiedVectorDatabase
 */

import type {
  BaseVectorDatabase,
  ExtractChunkData,
  InsertChunkData,
  Metadata
} from '@cherrystudio/embedjs-interfaces'
import { loggerService } from '@logger'
import { getUnifiedStorage, type UnifiedStorageCore } from '@main/storage'

const logger = loggerService.withContext('UnifiedVectorDatabase')

/**
 * 统一向量数据库
 *
 * 实现 embedjs BaseVectorDatabase 接口，
 * 将知识库数据存储到 UnifiedStorageCore.chunks 表 (source='knowledge')
 */
export class UnifiedVectorDatabase implements BaseVectorDatabase {
  private readonly knowledgeBaseId: string
  private storage: UnifiedStorageCore
  private dimensions: number = 1536
  private isInitialized: boolean = false

  /**
   * 创建 UnifiedVectorDatabase 实例
   * @param knowledgeBaseId 知识库唯一标识
   */
  constructor(knowledgeBaseId: string) {
    this.knowledgeBaseId = knowledgeBaseId
    this.storage = getUnifiedStorage()
    logger.debug('UnifiedVectorDatabase created', { knowledgeBaseId })
  }

  /**
   * 初始化数据库
   * @param options.dimensions 向量维度
   */
  async init({ dimensions }: { dimensions?: number } = {}): Promise<void> {
    if (this.isInitialized) {
      logger.debug('UnifiedVectorDatabase already initialized', {
        knowledgeBaseId: this.knowledgeBaseId
      })
      return
    }

    if (dimensions) {
      this.dimensions = dimensions
    }

    // 确保 UnifiedStorageCore 已初始化
    await this.storage.initialize()

    this.isInitialized = true
    logger.info('UnifiedVectorDatabase initialized', {
      knowledgeBaseId: this.knowledgeBaseId,
      dimensions: this.dimensions
    })
  }

  /**
   * 插入 chunks
   * @param chunks 要插入的 chunk 数据数组
   * @returns 插入的数量
   */
  async insertChunks(chunks: InsertChunkData[]): Promise<number> {
    this.ensureInitialized()

    let insertedCount = 0

    for (const chunk of chunks) {
      try {
        const metadata = chunk.metadata as Metadata<Record<string, string | number | boolean>>

        await this.storage.insertKnowledgeChunk(this.knowledgeBaseId, {
          content: chunk.pageContent,
          embedding: chunk.vector,
          uniqueLoaderId: metadata.uniqueLoaderId,
          loaderType: this.extractLoaderType(metadata.source),
          metadata: {
            id: metadata.id,
            source: metadata.source,
            uniqueLoaderId: metadata.uniqueLoaderId,
            images: metadata.images,
            tags: metadata.tags,
            // 保留其他元数据
            ...this.filterMetadata(metadata)
          }
        })

        insertedCount++
      } catch (error) {
        logger.error('Failed to insert chunk', {
          error: error as Error,
          knowledgeBaseId: this.knowledgeBaseId,
          uniqueLoaderId: chunk.metadata?.uniqueLoaderId
        })
      }
    }

    logger.debug('Chunks inserted', {
      knowledgeBaseId: this.knowledgeBaseId,
      requested: chunks.length,
      inserted: insertedCount
    })

    return insertedCount
  }

  /**
   * 相似度搜索
   * @param query 查询向量
   * @param k 返回数量
   * @returns 搜索结果
   */
  async similaritySearch(query: number[], k: number): Promise<ExtractChunkData[]> {
    this.ensureInitialized()

    try {
      const results = await this.storage.searchKnowledge(query, this.knowledgeBaseId, {
        topK: k,
        enableTagBoost: true
      })

      return results.map(result => ({
        score: result.score,
        pageContent: result.content,
        metadata: {
          id: result.id,
          uniqueLoaderId: result.uniqueLoaderId || '',
          source: result.loaderType || 'unknown',
          ...(result.metadata as Record<string, string | number | boolean> || {})
        }
      }))
    } catch (error) {
      logger.error('Similarity search failed', {
        error: error as Error,
        knowledgeBaseId: this.knowledgeBaseId
      })
      return []
    }
  }

  /**
   * 获取向量数量
   * @returns chunks 总数
   */
  async getVectorCount(): Promise<number> {
    this.ensureInitialized()

    try {
      return await this.storage.countChunks({
        source: 'knowledge',
        knowledgeBaseId: this.knowledgeBaseId
      })
    } catch (error) {
      logger.error('Failed to get vector count', {
        error: error as Error,
        knowledgeBaseId: this.knowledgeBaseId
      })
      return 0
    }
  }

  /**
   * 删除指定 Loader 的所有 chunks
   * @param uniqueLoaderId Loader 唯一标识
   * @returns 是否成功
   */
  async deleteKeys(uniqueLoaderId: string): Promise<boolean> {
    this.ensureInitialized()

    try {
      const deletedCount = await this.storage.deleteByLoaderId(uniqueLoaderId, this.knowledgeBaseId)
      logger.debug('Keys deleted', {
        knowledgeBaseId: this.knowledgeBaseId,
        uniqueLoaderId,
        deletedCount
      })
      return deletedCount > 0
    } catch (error) {
      logger.error('Failed to delete keys', {
        error: error as Error,
        knowledgeBaseId: this.knowledgeBaseId,
        uniqueLoaderId
      })
      return false
    }
  }

  /**
   * 重置知识库 (删除所有 chunks)
   */
  async reset(): Promise<void> {
    this.ensureInitialized()

    try {
      await this.storage.resetKnowledgeBase(this.knowledgeBaseId)
      logger.info('Knowledge base reset', { knowledgeBaseId: this.knowledgeBaseId })
    } catch (error) {
      logger.error('Failed to reset knowledge base', {
        error: error as Error,
        knowledgeBaseId: this.knowledgeBaseId
      })
      throw error
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        `UnifiedVectorDatabase not initialized for knowledge base: ${this.knowledgeBaseId}`
      )
    }
  }

  /**
   * 从 source 字符串提取 loader 类型
   */
  private extractLoaderType(source: string): string {
    // source 格式通常是 "file:/path/to/file" 或 "url:https://..." 或 "note:..."
    const colonIndex = source.indexOf(':')
    if (colonIndex > 0) {
      return source.substring(0, colonIndex).toLowerCase()
    }
    return 'unknown'
  }

  /**
   * 过滤元数据，移除 embedjs 专用字段
   */
  private filterMetadata(
    metadata: Metadata<Record<string, string | number | boolean>>
  ): Record<string, unknown> {
    const { id, uniqueLoaderId, source, images, tags, ...rest } = metadata
    return rest
  }
}

/**
 * 创建 UnifiedVectorDatabase 实例
 * @param knowledgeBaseId 知识库 ID
 */
export function createUnifiedVectorDatabase(knowledgeBaseId: string): UnifiedVectorDatabase {
  return new UnifiedVectorDatabase(knowledgeBaseId)
}

export default UnifiedVectorDatabase
