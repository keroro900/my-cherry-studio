/**
 * LibSqlDbAdapter - LibSqlDb 的包装器
 * 为现有的 @cherrystudio/embedjs-libsql 提供统一接口
 */

import { LibSqlDb } from '@cherrystudio/embedjs-libsql'

import { logger, type VectorDbAdapter, type VectorDbConfig, type VectorDbStats, type VectorSearchResult } from './types'

/**
 * LibSqlDb 适配器
 * 包装 @cherrystudio/embedjs-libsql 以符合 VectorDbAdapter 接口
 */
export class LibSqlDbAdapter implements VectorDbAdapter {
  private db: LibSqlDb
  private config: VectorDbConfig
  private vectorCount = 0

  constructor(config: VectorDbConfig) {
    this.config = config
    this.db = new LibSqlDb({ path: config.path })
    logger.info('LibSqlDbAdapter initialized', { path: config.path })
  }

  /**
   * 获取底层 LibSqlDb 实例
   * 用于与 RAGApplicationBuilder 集成
   */
  getUnderlyingDb(): LibSqlDb {
    return this.db
  }

  async insertChunks(
    chunks: Array<{
      pageContent: string
      metadata: Record<string, any>
    }>,
    vectors: number[][]
  ): Promise<number> {
    // LibSqlDb 的 insertChunks 方法
    const count = await (this.db as any).insertChunks(chunks, vectors)
    this.vectorCount += count
    return count
  }

  async similaritySearch(queryVector: number[], k: number): Promise<VectorSearchResult[]> {
    const results = await (this.db as any).similaritySearch(queryVector, k)
    return results.map((r: any) => ({
      id: r.id || r.metadata?.id || '',
      score: r.score,
      metadata: r.metadata,
      pageContent: r.pageContent
    }))
  }

  async deleteKeys(uniqueLoaderId: string): Promise<boolean> {
    try {
      await (this.db as any).deleteKeys(uniqueLoaderId)
      return true
    } catch (error) {
      logger.error('Failed to delete keys', { uniqueLoaderId, error })
      return false
    }
  }

  async reset(): Promise<void> {
    await (this.db as any).reset()
    this.vectorCount = 0
  }

  async getVectorCount(): Promise<number> {
    try {
      const count = await (this.db as any).getVectorCount()
      return count || this.vectorCount
    } catch {
      return this.vectorCount
    }
  }

  async getStats(): Promise<VectorDbStats> {
    const count = await this.getVectorCount()
    return {
      totalVectors: count,
      dimensions: this.config.dimensions || 0,
      indexType: 'libsql'
    }
  }

  async close(): Promise<void> {
    // LibSqlDb 可能没有显式的 close 方法
    logger.info('LibSqlDbAdapter closed', { path: this.config.path })
  }
}

/**
 * 创建 LibSqlDb 适配器
 */
export function createLibSqlDbAdapter(config: VectorDbConfig): LibSqlDbAdapter {
  return new LibSqlDbAdapter(config)
}
