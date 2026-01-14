/**
 * USearchAdapter - 基于 USearch npm 包的向量数据库适配器
 *
 * 特点:
 * - 使用预编译的原生 HNSW 索引
 * - 支持 Windows/macOS/Linux (x64, arm64)
 * - 高性能向量搜索
 * - 支持持久化到磁盘
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'

import { logger, type VectorDbAdapter, type VectorDbConfig, type VectorDbStats, type VectorSearchResult } from './types'

// USearch npm 包类型定义
interface USearchIndex {
  add(key: number, vector: Float32Array | number[]): void
  search(vector: Float32Array | number[], k: number): { keys: BigInt64Array; distances: Float32Array }
  remove(key: number): boolean
  save(path: string): void
  load(path: string): void
  view(path: string): void
  size(): number
  capacity(): number
  dimensions(): number
  connectivity(): number
}

interface USearchIndexOptions {
  ndim: number
  metric?: 'cos' | 'l2sq' | 'ip' | 'haversine'
  dtype?: 'f64' | 'f32' | 'f16' | 'i8' | 'b1'
  connectivity?: number
  expansion_add?: number
  expansion_search?: number
  multi?: boolean
}

interface USearchModule {
  Index: new (options: USearchIndexOptions) => USearchIndex
}

/**
 * ID 映射数据结构 (用于持久化)
 */
interface IdMappingData {
  nextId: number
  stringToNumeric: Record<string, number>
  numericToString: Record<number, string>
  entries: Record<
    number,
    {
      pageContent: string
      metadata: Record<string, any>
      loaderId?: string
    }
  >
}

/**
 * USearch 向量数据库适配器
 */
export class USearchAdapter implements VectorDbAdapter {
  private index: USearchIndex | null = null
  private USearchModule: USearchModule | null = null

  // ID 映射 (USearch 使用数字 key，我们的接口使用字符串)
  private stringToNumeric: Map<string, number> = new Map()
  private numericToString: Map<number, string> = new Map()
  private nextId: number = 1

  // 存储元数据 (USearch 不存储元数据，需要自己维护)
  private entries: Map<
    number,
    {
      pageContent: string
      metadata: Record<string, any>
      loaderId?: string
    }
  > = new Map()

  private config: VectorDbConfig
  private dimensions: number
  private isNativeLoaded: boolean = false

  constructor(config: VectorDbConfig) {
    this.config = config
    this.dimensions = config.dimensions || 1536

    // 尝试加载原生模块
    this.loadNativeModule()

    if (this.USearchModule) {
      this.initializeIndex()
    }

    logger.info('USearchAdapter initialized', {
      dimensions: this.dimensions,
      nativeLoaded: this.isNativeLoaded,
      path: config.path
    })
  }

  /**
   * 尝试加载 USearch 原生模块
   */
  private loadNativeModule(): void {
    try {
      this.USearchModule = require('usearch') as USearchModule
      this.isNativeLoaded = true
      logger.info('USearch native module loaded successfully')
    } catch (error) {
      logger.warn('Failed to load USearch native module', { error: (error as Error).message })
      this.USearchModule = null
      this.isNativeLoaded = false
    }
  }

  /**
   * 初始化索引
   */
  private initializeIndex(): void {
    if (!this.USearchModule) {
      throw new Error('USearch native module not loaded')
    }

    const options: USearchIndexOptions = {
      ndim: this.dimensions,
      metric: 'cos', // 余弦相似度
      dtype: 'f32',
      connectivity: this.config.hnswConfig?.m || 16,
      expansion_add: this.config.hnswConfig?.efConstruction || 128,
      expansion_search: this.config.hnswConfig?.efSearch || 64,
      multi: false
    }

    this.index = new this.USearchModule.Index(options)
    logger.debug('USearch index initialized', options)
  }

  /**
   * 检查是否使用原生模块
   */
  isNativeMode(): boolean {
    return this.isNativeLoaded && this.index !== null
  }

  /**
   * 初始化 (加载已有索引)
   */
  async initialize(): Promise<void> {
    if (!this.index) {
      throw new Error('USearch index not initialized')
    }

    const indexPath = this.getIndexPath()
    const mappingPath = this.getMappingPath()

    // 尝试加载已有索引
    if (existsSync(indexPath) && existsSync(mappingPath)) {
      try {
        this.index.load(indexPath)
        this.loadMapping(mappingPath)
        logger.info('USearch index loaded from disk', { path: indexPath, count: this.entries.size })
      } catch (error) {
        logger.warn('Failed to load existing index, starting fresh', { error: (error as Error).message })
      }
    }
  }

  /**
   * 插入向量
   */
  async insertChunks(
    chunks: Array<{
      pageContent: string
      metadata: Record<string, any>
    }>,
    vectors: number[][]
  ): Promise<number> {
    if (!this.index) {
      throw new Error('USearch index not initialized')
    }

    if (chunks.length !== vectors.length) {
      throw new Error('Chunks and vectors count mismatch')
    }

    if (chunks.length === 0) return 0

    // 检测或验证维度
    if (vectors[0].length !== this.dimensions) {
      // 维度不匹配时，记录警告
      // USearch 原生索引不支持动态维度变更，需要重新创建索引
      logger.warn(
        `Vector dimension mismatch: USearch index expects ${this.dimensions} dimensions, got ${vectors[0].length}. ` +
          `USearch requires re-creating the index with the new dimension. Please re-index your knowledge base.`
      )
      // 返回 0 而不是抛出错误，让上层代码可以继续处理
      return 0
    }

    const loaderId = chunks[0].metadata?.uniqueLoaderId || `loader_${Date.now()}`

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const vector = vectors[i]

      // 生成唯一 ID
      const stringId = `${loaderId}_${this.nextId}`
      const numericId = this.nextId++

      // 建立映射
      this.stringToNumeric.set(stringId, numericId)
      this.numericToString.set(numericId, stringId)

      // 存储元数据
      this.entries.set(numericId, {
        pageContent: chunk.pageContent,
        metadata: chunk.metadata,
        loaderId
      })

      // 添加到索引
      this.index.add(numericId, new Float32Array(vector))
    }

    logger.debug('USearch inserted chunks', { count: chunks.length, loaderId })
    return chunks.length
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(queryVector: number[], k: number): Promise<VectorSearchResult[]> {
    if (!this.index) {
      throw new Error('USearch index not initialized')
    }

    if (this.entries.size === 0) {
      return []
    }

    // 维度不匹配时优雅降级：返回空结果并记录警告
    if (queryVector.length !== this.dimensions) {
      logger.warn(
        `Dimension mismatch in USearch vector search: index has ${this.dimensions} dimensions, query has ${queryVector.length}. ` +
          `Consider re-indexing with the correct embedding model.`
      )
      return []
    }

    // 执行搜索
    const result = this.index.search(new Float32Array(queryVector), Math.min(k, this.entries.size))

    const results: VectorSearchResult[] = []

    for (let i = 0; i < result.keys.length; i++) {
      const numericId = Number(result.keys[i])
      const distance = result.distances[i]

      const entry = this.entries.get(numericId)
      const stringId = this.numericToString.get(numericId)

      if (entry && stringId) {
        results.push({
          id: stringId,
          score: 1 - distance, // 余弦距离转相似度
          metadata: entry.metadata,
          pageContent: entry.pageContent
        })
      }
    }

    return results
  }

  /**
   * 删除向量
   */
  async deleteKeys(uniqueLoaderId: string): Promise<boolean> {
    if (!this.index) {
      throw new Error('USearch index not initialized')
    }

    const idsToDelete: number[] = []

    // 查找要删除的条目
    for (const [numericId, entry] of this.entries) {
      if (entry.loaderId === uniqueLoaderId || entry.metadata?.uniqueLoaderId === uniqueLoaderId) {
        idsToDelete.push(numericId)
      }
    }

    // 删除
    for (const numericId of idsToDelete) {
      this.index.remove(numericId)

      const stringId = this.numericToString.get(numericId)
      if (stringId) {
        this.stringToNumeric.delete(stringId)
      }
      this.numericToString.delete(numericId)
      this.entries.delete(numericId)
    }

    logger.debug('USearch deleted keys', { loaderId: uniqueLoaderId, count: idsToDelete.length })
    return idsToDelete.length > 0
  }

  /**
   * 重置数据库
   */
  async reset(): Promise<void> {
    // 重新初始化索引
    this.initializeIndex()

    // 清空映射
    this.stringToNumeric.clear()
    this.numericToString.clear()
    this.entries.clear()
    this.nextId = 1

    // 删除磁盘文件
    const indexPath = this.getIndexPath()
    const mappingPath = this.getMappingPath()

    if (existsSync(indexPath)) {
      unlinkSync(indexPath)
    }
    if (existsSync(mappingPath)) {
      unlinkSync(mappingPath)
    }

    logger.info('USearch database reset')
  }

  /**
   * 获取向量数量
   */
  async getVectorCount(): Promise<number> {
    return this.entries.size
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<VectorDbStats> {
    const vectorMemory = this.entries.size * this.dimensions * 4 // f32 = 4 bytes
    const metadataMemory = this.entries.size * 200 // 估算

    return {
      totalVectors: this.entries.size,
      dimensions: this.dimensions,
      memoryUsage: vectorMemory + metadataMemory,
      indexType: 'usearch-hnsw'
    }
  }

  /**
   * 保存到磁盘
   */
  async save(): Promise<void> {
    if (!this.index) {
      throw new Error('USearch index not initialized')
    }

    const indexPath = this.getIndexPath()
    const mappingPath = this.getMappingPath()

    // 保存索引
    this.index.save(indexPath)

    // 保存映射数据
    this.saveMapping(mappingPath)

    logger.info('USearch index saved', { indexPath, count: this.entries.size })
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // 保存数据
    if (this.index && this.entries.size > 0) {
      await this.save()
    }

    this.index = null
    logger.info('USearch adapter closed')
  }

  // ==================== 私有方法 ====================

  private getIndexPath(): string {
    return path.join(this.config.path, 'usearch.index')
  }

  private getMappingPath(): string {
    return path.join(this.config.path, 'usearch.mapping.json')
  }

  private saveMapping(mappingPath: string): void {
    const data: IdMappingData = {
      nextId: this.nextId,
      stringToNumeric: Object.fromEntries(this.stringToNumeric),
      numericToString: Object.fromEntries(this.numericToString),
      entries: Object.fromEntries(this.entries)
    }
    writeFileSync(mappingPath, JSON.stringify(data, null, 2))
  }

  private loadMapping(mappingPath: string): void {
    const raw = readFileSync(mappingPath, 'utf-8')
    const data = JSON.parse(raw) as IdMappingData

    this.nextId = data.nextId
    this.stringToNumeric = new Map(Object.entries(data.stringToNumeric))
    this.numericToString = new Map(Object.entries(data.numericToString).map(([k, v]) => [parseInt(k), v]))
    this.entries = new Map(
      Object.entries(data.entries).map(([k, v]) => [
        parseInt(k),
        v as { pageContent: string; metadata: Record<string, any>; loaderId?: string }
      ])
    )
  }
}

/**
 * 创建 USearch 适配器
 */
export function createUSearchAdapter(config: VectorDbConfig): USearchAdapter {
  return new USearchAdapter(config)
}

/**
 * 检查 USearch 是否可用
 */
export function isUSearchAvailable(): boolean {
  try {
    require('usearch')
    return true
  } catch {
    return false
  }
}
