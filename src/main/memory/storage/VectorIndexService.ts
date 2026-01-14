/**
 * 向量索引服务
 *
 * 提供高级向量操作能力：
 * - 多种相似度算法（余弦、欧氏、点积）
 * - 向量聚类
 * - 近邻搜索
 * - 向量空间分析
 *
 * @module memory/storage/VectorIndexService
 */

import { loggerService } from '@logger'

import type { MemoryEntry, ScoredMemoryEntry } from '../types'

const logger = loggerService.withContext('VectorIndexService')

// ==================== 类型定义 ====================

/**
 * 相似度算法类型
 */
export type SimilarityAlgorithm = 'cosine' | 'euclidean' | 'dotProduct'

/**
 * 向量索引配置
 */
export interface VectorIndexConfig {
  /** 向量维度 */
  dimensions: number
  /** 相似度算法 */
  algorithm: SimilarityAlgorithm
  /** 索引类型 */
  indexType: 'flat' | 'ivf' | 'hnsw'
  /** IVF 聚类数量 */
  nlist?: number
  /** HNSW M 参数 */
  hnswM?: number
  /** HNSW efConstruction 参数 */
  hnswEfConstruction?: number
}

/**
 * 向量搜索选项
 */
export interface VectorSearchOptions {
  /** 返回数量 */
  topK?: number
  /** 相似度阈值 */
  threshold?: number
  /** 相似度算法 */
  algorithm?: SimilarityAlgorithm
  /** 是否包含向量 */
  includeVectors?: boolean
  /** 过滤函数 */
  filter?: (entry: MemoryEntry) => boolean
}

/**
 * 向量条目
 */
export interface VectorEntry {
  id: string
  vector: number[]
  entry: MemoryEntry
}

/**
 * 聚类结果
 */
export interface ClusterResult {
  clusterId: number
  centroid: number[]
  members: VectorEntry[]
  radius: number
}

/**
 * 向量空间统计
 */
export interface VectorSpaceStats {
  totalVectors: number
  dimensions: number
  averageNorm: number
  density: number
  clusters?: ClusterResult[]
}

// ==================== 向量索引服务 ====================

/**
 * 向量索引服务
 */
export class VectorIndexService {
  private config: VectorIndexConfig
  private vectors: Map<string, VectorEntry> = new Map()
  private clusters: ClusterResult[] = []
  private _needsRebuild = false

  /** 是否需要重建索引 */
  get needsRebuild(): boolean {
    return this._needsRebuild
  }

  constructor(config?: Partial<VectorIndexConfig>) {
    this.config = {
      dimensions: config?.dimensions || 1536,
      algorithm: config?.algorithm || 'cosine',
      indexType: config?.indexType || 'flat',
      nlist: config?.nlist || 100,
      hnswM: config?.hnswM || 16,
      hnswEfConstruction: config?.hnswEfConstruction || 200
    }
  }

  // ==================== 索引操作 ====================

  /**
   * 添加向量
   */
  add(id: string, vector: number[], entry: MemoryEntry): void {
    if (vector.length !== this.config.dimensions) {
      vector = this.normalizeVector(vector)
    }

    this.vectors.set(id, { id, vector, entry })
    this._needsRebuild = true
  }

  /**
   * 批量添加向量
   */
  addBatch(entries: Array<{ id: string; vector: number[]; entry: MemoryEntry }>): void {
    for (const { id, vector, entry } of entries) {
      this.add(id, vector, entry)
    }
  }

  /**
   * 移除向量
   */
  remove(id: string): boolean {
    const result = this.vectors.delete(id)
    if (result) {
      this._needsRebuild = true
    }
    return result
  }

  /**
   * 更新向量
   */
  update(id: string, vector: number[], entry?: MemoryEntry): boolean {
    const existing = this.vectors.get(id)
    if (!existing) return false

    if (vector.length !== this.config.dimensions) {
      vector = this.normalizeVector(vector)
    }

    this.vectors.set(id, {
      id,
      vector,
      entry: entry || existing.entry
    })
    this._needsRebuild = true
    return true
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.vectors.clear()
    this.clusters = []
    this._needsRebuild = false
  }

  // ==================== 搜索操作 ====================

  /**
   * 向量搜索
   */
  search(queryVector: number[], options: VectorSearchOptions = {}): ScoredMemoryEntry[] {
    const { topK = 10, threshold = 0, algorithm = this.config.algorithm, filter } = options

    if (queryVector.length !== this.config.dimensions) {
      queryVector = this.normalizeVector(queryVector)
    }

    // 计算与所有向量的相似度
    const results: Array<{ entry: VectorEntry; similarity: number }> = []

    for (const vectorEntry of this.vectors.values()) {
      // 应用过滤器
      if (filter && !filter(vectorEntry.entry)) continue

      const similarity = this.computeSimilarity(queryVector, vectorEntry.vector, algorithm)

      if (similarity >= threshold) {
        results.push({ entry: vectorEntry, similarity })
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity)

    // 返回前 K 个
    return results.slice(0, topK).map(({ entry, similarity }) => ({
      ...entry.entry,
      score: similarity,
      matchReason: `Vector similarity: ${(similarity * 100).toFixed(1)}%`
    }))
  }

  /**
   * 范围搜索（返回阈值以上的所有结果）
   */
  rangeSearch(queryVector: number[], radius: number, options: VectorSearchOptions = {}): ScoredMemoryEntry[] {
    return this.search(queryVector, {
      ...options,
      topK: this.vectors.size,
      threshold: radius
    })
  }

  /**
   * 多向量搜索（取并集或交集）
   */
  multiSearch(
    queryVectors: number[][],
    mode: 'union' | 'intersection' = 'union',
    options: VectorSearchOptions = {}
  ): ScoredMemoryEntry[] {
    const allResults = queryVectors.map((v) => this.search(v, options))

    if (mode === 'union') {
      // 并集：合并所有结果，保留最高分
      const merged = new Map<string, ScoredMemoryEntry>()
      for (const results of allResults) {
        for (const entry of results) {
          const existing = merged.get(entry.id)
          if (!existing || entry.score > existing.score) {
            merged.set(entry.id, entry)
          }
        }
      }
      return Array.from(merged.values()).sort((a, b) => b.score - a.score)
    } else {
      // 交集：只保留所有查询都匹配的结果
      if (allResults.length === 0) return []

      const idSets = allResults.map((r) => new Set(r.map((e) => e.id)))
      const intersection = allResults[0].filter((e) => idSets.every((s) => s.has(e.id)))

      // 计算平均分数
      const scoreMap = new Map<string, number[]>()
      for (const results of allResults) {
        for (const entry of results) {
          if (!scoreMap.has(entry.id)) {
            scoreMap.set(entry.id, [])
          }
          scoreMap.get(entry.id)!.push(entry.score)
        }
      }

      return intersection
        .map((e) => ({
          ...e,
          score: scoreMap.get(e.id)!.reduce((a, b) => a + b, 0) / scoreMap.get(e.id)!.length
        }))
        .sort((a, b) => b.score - a.score)
    }
  }

  // ==================== 聚类操作 ====================

  /**
   * K-Means 聚类
   */
  cluster(k: number, maxIterations = 100): ClusterResult[] {
    if (this.vectors.size < k) {
      logger.warn('Not enough vectors for clustering', {
        vectorCount: this.vectors.size,
        requestedClusters: k
      })
      k = Math.max(1, this.vectors.size)
    }

    const vectorArray = Array.from(this.vectors.values())

    // 初始化质心（随机选择）
    const indices = new Set<number>()
    while (indices.size < k) {
      indices.add(Math.floor(Math.random() * vectorArray.length))
    }
    let centroids = Array.from(indices).map((i) => [...vectorArray[i].vector])

    // K-Means 迭代
    let assignments: number[] = []
    for (let iter = 0; iter < maxIterations; iter++) {
      // 分配到最近的质心
      const newAssignments = vectorArray.map((v) => {
        let minDist = Infinity
        let closest = 0
        for (let i = 0; i < centroids.length; i++) {
          const dist = this.euclideanDistance(v.vector, centroids[i])
          if (dist < minDist) {
            minDist = dist
            closest = i
          }
        }
        return closest
      })

      // 检查是否收敛
      if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) {
        break
      }
      assignments = newAssignments

      // 更新质心
      centroids = Array.from({ length: k }, (_, i) => {
        const members = vectorArray.filter((_, j) => assignments[j] === i)
        if (members.length === 0) {
          // 保持原质心
          return centroids[i]
        }
        return this.computeCentroid(members.map((m) => m.vector))
      })
    }

    // 构建聚类结果
    this.clusters = Array.from({ length: k }, (_, i) => {
      const members = vectorArray.filter((_, j) => assignments[j] === i)
      const distances = members.map((m) => this.euclideanDistance(m.vector, centroids[i]))

      return {
        clusterId: i,
        centroid: centroids[i],
        members,
        radius: distances.length > 0 ? Math.max(...distances) : 0
      }
    })

    this._needsRebuild = false
    return this.clusters
  }

  /**
   * 获取最近的聚类
   */
  getNearestCluster(vector: number[]): ClusterResult | null {
    if (this.clusters.length === 0) {
      return null
    }

    if (vector.length !== this.config.dimensions) {
      vector = this.normalizeVector(vector)
    }

    let minDist = Infinity
    let nearest: ClusterResult | null = null

    for (const cluster of this.clusters) {
      const dist = this.euclideanDistance(vector, cluster.centroid)
      if (dist < minDist) {
        minDist = dist
        nearest = cluster
      }
    }

    return nearest
  }

  // ==================== 相似度计算 ====================

  /**
   * 计算相似度
   */
  computeSimilarity(v1: number[], v2: number[], algorithm: SimilarityAlgorithm = 'cosine'): number {
    switch (algorithm) {
      case 'cosine':
        return this.cosineSimilarity(v1, v2)
      case 'euclidean':
        return this.euclideanSimilarity(v1, v2)
      case 'dotProduct':
        return this.dotProduct(v1, v2)
      default:
        return this.cosineSimilarity(v1, v2)
    }
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    const dot = this.dotProduct(v1, v2)
    const norm1 = Math.sqrt(this.dotProduct(v1, v1))
    const norm2 = Math.sqrt(this.dotProduct(v2, v2))

    if (norm1 === 0 || norm2 === 0) return 0
    return dot / (norm1 * norm2)
  }

  /**
   * 欧氏距离相似度（转换为 0-1 范围）
   */
  private euclideanSimilarity(v1: number[], v2: number[]): number {
    const distance = this.euclideanDistance(v1, v2)
    return 1 / (1 + distance)
  }

  /**
   * 欧氏距离
   */
  private euclideanDistance(v1: number[], v2: number[]): number {
    let sum = 0
    for (let i = 0; i < Math.min(v1.length, v2.length); i++) {
      sum += Math.pow(v1[i] - v2[i], 2)
    }
    return Math.sqrt(sum)
  }

  /**
   * 点积
   */
  private dotProduct(v1: number[], v2: number[]): number {
    let sum = 0
    for (let i = 0; i < Math.min(v1.length, v2.length); i++) {
      sum += v1[i] * v2[i]
    }
    return sum
  }

  // ==================== 向量操作 ====================

  /**
   * 归一化向量维度
   */
  private normalizeVector(vector: number[]): number[] {
    if (vector.length === this.config.dimensions) {
      return vector
    }

    if (vector.length < this.config.dimensions) {
      // 填充零
      return [...vector, ...new Array(this.config.dimensions - vector.length).fill(0)]
    } else {
      // 截断
      return vector.slice(0, this.config.dimensions)
    }
  }

  /**
   * 计算质心
   */
  private computeCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) {
      return new Array(this.config.dimensions).fill(0)
    }

    const centroid = new Array(this.config.dimensions).fill(0)
    for (const v of vectors) {
      for (let i = 0; i < v.length; i++) {
        centroid[i] += v[i]
      }
    }

    for (let i = 0; i < centroid.length; i++) {
      centroid[i] /= vectors.length
    }

    return centroid
  }

  /**
   * 计算向量范数
   */
  private vectorNorm(v: number[]): number {
    return Math.sqrt(this.dotProduct(v, v))
  }

  // ==================== 统计信息 ====================

  /**
   * 获取索引统计
   */
  getStats(): VectorSpaceStats {
    const vectors = Array.from(this.vectors.values())

    if (vectors.length === 0) {
      return {
        totalVectors: 0,
        dimensions: this.config.dimensions,
        averageNorm: 0,
        density: 0
      }
    }

    // 计算平均范数
    const norms = vectors.map((v) => this.vectorNorm(v.vector))
    const averageNorm = norms.reduce((a, b) => a + b, 0) / norms.length

    // 估算密度（使用平均最近邻距离）
    let totalDist = 0
    let count = 0
    const sampleSize = Math.min(100, vectors.length)
    const sample = vectors.slice(0, sampleSize)

    for (const v1 of sample) {
      let minDist = Infinity
      for (const v2 of sample) {
        if (v1.id === v2.id) continue
        const dist = this.euclideanDistance(v1.vector, v2.vector)
        if (dist < minDist) minDist = dist
      }
      if (minDist < Infinity) {
        totalDist += minDist
        count++
      }
    }

    const density = count > 0 ? 1 / (totalDist / count) : 0

    return {
      totalVectors: vectors.length,
      dimensions: this.config.dimensions,
      averageNorm,
      density,
      clusters: this.clusters.length > 0 ? this.clusters : undefined
    }
  }

  /**
   * 获取索引大小
   */
  get size(): number {
    return this.vectors.size
  }

  /**
   * 检查索引是否为空
   */
  get isEmpty(): boolean {
    return this.vectors.size === 0
  }

  /**
   * 获取配置
   */
  getConfig(): VectorIndexConfig {
    return { ...this.config }
  }
}

// ==================== 工厂方法 ====================

/**
 * 创建向量索引服务
 */
export function createVectorIndex(config?: Partial<VectorIndexConfig>): VectorIndexService {
  return new VectorIndexService(config)
}

export default VectorIndexService
