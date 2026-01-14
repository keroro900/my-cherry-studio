/**
 * VectorDb 接口类型定义
 * 基于 @cherrystudio/embedjs-interfaces 的 BaseVectorDatabase
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('VectorDb')

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  id: string
  score: number
  metadata?: Record<string, any>
  pageContent?: string
}

/**
 * 向量数据条目
 */
export interface VectorEntry {
  id: string
  vector: number[]
  metadata?: Record<string, any>
  pageContent?: string
}

/**
 * 向量数据库配置
 */
export interface VectorDbConfig {
  /** 存储路径 */
  path: string
  /** 向量维度 (可选，自动检测) */
  dimensions?: number
  /** 最大容量 */
  capacity?: number
  /** 索引类型 */
  indexType?: 'flat' | 'hnsw' | 'ivf'
  /** HNSW 参数 */
  hnswConfig?: {
    m?: number // 每个节点的最大连接数 (默认 16)
    efConstruction?: number // 构建时的搜索宽度 (默认 100)
    efSearch?: number // 搜索时的宽度 (默认 50)
  }
}

/**
 * 向量数据库统计信息
 */
export interface VectorDbStats {
  totalVectors: number
  dimensions: number
  memoryUsage?: number
  indexType?: string
}

/**
 * VectorDb 抽象接口
 * 兼容 @cherrystudio/embedjs 的 BaseVectorDatabase
 */
export interface VectorDbAdapter {
  /**
   * 初始化数据库
   */
  initialize?(): Promise<void>

  /**
   * 插入向量
   */
  insertChunks(
    chunks: Array<{
      pageContent: string
      metadata: Record<string, any>
    }>,
    vectors: number[][]
  ): Promise<number>

  /**
   * 相似度搜索
   */
  similaritySearch(queryVector: number[], k: number): Promise<VectorSearchResult[]>

  /**
   * 删除向量
   * @param uniqueLoaderId Loader 的唯一标识
   */
  deleteKeys(uniqueLoaderId: string): Promise<boolean>

  /**
   * 重置数据库
   */
  reset(): Promise<void>

  /**
   * 获取已存在的 Loader IDs
   */
  getVectorCount(): Promise<number>

  /**
   * 获取统计信息
   */
  getStats?(): Promise<VectorDbStats>

  /**
   * 关闭数据库连接
   */
  close?(): Promise<void>
}

/**
 * 向量数据库后端类型
 */
export type VectorDbBackend = 'libsql' | 'usearch' | 'vexus' | 'hnswlib' | 'memory'

/**
 * 向量数据库工厂配置
 */
export interface VectorDbFactoryConfig {
  backend: VectorDbBackend
  config: VectorDbConfig
}

/**
 * 日志工具
 */
export { logger }
