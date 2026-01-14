/**
 * Pinecone 向量数据库适配器
 *
 * 实现 VectorDbAdapter 接口，连接 Pinecone 云端向量库
 *
 * 特点:
 * - 分批上传 (每批 100 条)
 * - 元数据存储
 * - 命名空间隔离
 */

import { loggerService } from '@logger'

import type { VectorDbAdapter, VectorSearchResult } from '../types'
import type { CloudVectorOperationResult, CloudVectorStatus, PineconeConfig } from './types'

const logger = loggerService.withContext('PineconeAdapter')

/**
 * Pinecone 适配器
 */
export class PineconeAdapter implements VectorDbAdapter {
  private client: any // Pinecone client
  private index: any // Pinecone index
  private config: PineconeConfig
  private initialized: boolean = false

  constructor(config: PineconeConfig) {
    this.config = config
  }

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 动态导入 Pinecone SDK
      const { Pinecone } = await import('@pinecone-database/pinecone')

      this.client = new Pinecone({
        apiKey: this.config.apiKey
      })

      this.index = this.client.index(this.config.indexName)

      if (this.config.namespace) {
        this.index = this.index.namespace(this.config.namespace)
      }

      this.initialized = true
      logger.info('Pinecone adapter initialized', {
        indexName: this.config.indexName,
        namespace: this.config.namespace
      })
    } catch (error) {
      logger.error('Failed to initialize Pinecone adapter', { error: String(error) })
      throw error
    }
  }

  /**
   * 插入向量块
   */
  async insertChunks(
    chunks: Array<{
      pageContent: string
      metadata: Record<string, any>
    }>,
    vectors: number[][]
  ): Promise<number> {
    await this.ensureInitialized()

    const records = chunks.map((chunk, i) => ({
      id: chunk.metadata?.uniqueLoaderId || `chunk_${Date.now()}_${i}`,
      values: vectors[i],
      metadata: {
        content: chunk.pageContent,
        ...this.sanitizeMetadata(chunk.metadata)
      }
    }))

    // 分批上传 (Pinecone 限制每批 100 条)
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      try {
        await this.index.upsert(batch)
        inserted += batch.length
        logger.debug('Pinecone batch upserted', { count: batch.length, total: inserted })
      } catch (error) {
        logger.error('Pinecone upsert batch failed', { error: String(error), batchIndex: i })
        // 继续处理其他批次
      }
    }

    logger.info('Pinecone insertChunks completed', { total: inserted })
    return inserted
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(queryVector: number[], k: number): Promise<VectorSearchResult[]> {
    await this.ensureInitialized()

    try {
      const response = await this.index.query({
        vector: queryVector,
        topK: k,
        includeMetadata: true
      })

      return (response.matches || []).map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
        pageContent: match.metadata?.content || ''
      }))
    } catch (error) {
      logger.error('Pinecone similarity search failed', { error: String(error) })
      return []
    }
  }

  /**
   * 删除指定 ID 的向量
   */
  async deleteKeys(uniqueLoaderId: string): Promise<boolean> {
    await this.ensureInitialized()

    try {
      await this.index.deleteOne(uniqueLoaderId)
      logger.debug('Pinecone vector deleted', { id: uniqueLoaderId })
      return true
    } catch (error) {
      logger.error('Pinecone delete failed', { error: String(error), id: uniqueLoaderId })
      return false
    }
  }

  /**
   * 批量删除
   */
  async deleteMany(ids: string[]): Promise<CloudVectorOperationResult> {
    await this.ensureInitialized()

    const startTime = Date.now()
    let successCount = 0

    try {
      // Pinecone 支持批量删除
      await this.index.deleteMany(ids)
      successCount = ids.length
    } catch (error) {
      logger.error('Pinecone batch delete failed', { error: String(error) })
    }

    return {
      success: successCount === ids.length,
      affectedCount: successCount,
      durationMs: Date.now() - startTime
    }
  }

  /**
   * 重置索引 (删除所有向量)
   */
  async reset(): Promise<void> {
    await this.ensureInitialized()

    try {
      await this.index.deleteAll()
      logger.info('Pinecone index reset')
    } catch (error) {
      logger.error('Pinecone reset failed', { error: String(error) })
      throw error
    }
  }

  /**
   * 获取向量数量
   */
  async getVectorCount(): Promise<number> {
    await this.ensureInitialized()

    try {
      const stats = await this.index.describeIndexStats()
      return stats.totalRecordCount ?? 0
    } catch (error) {
      logger.error('Pinecone getVectorCount failed', { error: String(error) })
      return 0
    }
  }

  /**
   * 获取索引状态
   */
  async getStatus(): Promise<CloudVectorStatus> {
    try {
      await this.ensureInitialized()

      const stats = await this.index.describeIndexStats()

      return {
        connected: true,
        indexExists: true,
        vectorCount: stats.totalRecordCount ?? 0,
        dimensions: stats.dimension,
        lastSyncTime: new Date()
      }
    } catch (error) {
      return {
        connected: false,
        indexExists: false,
        vectorCount: 0,
        error: String(error)
      }
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // Pinecone 客户端无需显式关闭
    this.initialized = false
    logger.info('Pinecone adapter closed')
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * 清理元数据 (移除 Pinecone 不支持的类型)
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(metadata)) {
      // Pinecone 支持: string, number, boolean, string[]
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value
      } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        sanitized[key] = value
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString()
      } else if (value !== null && value !== undefined) {
        // 转换其他类型为字符串
        sanitized[key] = JSON.stringify(value)
      }
    }

    return sanitized
  }
}

/**
 * 创建 Pinecone 适配器
 */
export function createPineconeAdapter(config: PineconeConfig): PineconeAdapter {
  return new PineconeAdapter(config)
}
