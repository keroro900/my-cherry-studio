/**
 * MemoryVectorDb - 内存向量数据�?
 * 使用 HNSW 算法的高性能实现
 *
 * 特点:
 * - �?TypeScript 实现，无原生依赖
 * - HNSW (Hierarchical Navigable Small World) 索引
 * - 支持增量添加和删�?
 * - 适合中小规模数据�?(< 100k 向量)
 */

import { logger, type VectorDbAdapter, type VectorDbConfig, type VectorDbStats, type VectorSearchResult } from './types'

/**
 * HNSW 节点
 */
interface HNSWNode {
  id: string
  vector: number[]
  pageContent: string
  metadata: Record<string, any>
  loaderId?: string
  connections: Map<number, Set<string>> // level -> connected node ids
}

/**
 * HNSW 索引配置
 */
interface HNSWConfig {
  m: number // 每层最大连接数
  efConstruction: number // 构建时搜索宽�?
  efSearch: number // 查询时搜索宽�?
  ml: number // 层数乘数 (1/ln(m))
}

/**
 * 余弦相似度计�?
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * 欧氏距离计算
 */
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * 内存向量数据�?
 */
export class MemoryVectorDb implements VectorDbAdapter {
  private nodes: Map<string, HNSWNode> = new Map()
  private entryPoint: string | null = null
  private maxLevel = 0
  private hnswConfig: HNSWConfig
  private dimensions = 0
  private idCounter = 0

  constructor(config: VectorDbConfig) {
    this.hnswConfig = {
      m: config.hnswConfig?.m || 16,
      efConstruction: config.hnswConfig?.efConstruction || 100,
      efSearch: config.hnswConfig?.efSearch || 50,
      ml: 1 / Math.log(config.hnswConfig?.m || 16)
    }
    this.dimensions = config.dimensions || 0

    logger.info('MemoryVectorDb initialized', {
      m: this.hnswConfig.m,
      efConstruction: this.hnswConfig.efConstruction
    })
  }

  /**
   * 随机选择层级
   */
  private getRandomLevel(): number {
    let level = 0
    while (Math.random() < 1 / this.hnswConfig.m && level < 16) {
      level++
    }
    return level
  }

  /**
   * 在指定层搜索最近邻
   */
  private searchLayer(
    queryVector: number[],
    entryPoints: Set<string>,
    ef: number,
    layer: number
  ): Array<{ id: string; distance: number }> {
    const visited = new Set<string>()
    const candidates: Array<{ id: string; distance: number }> = []
    const results: Array<{ id: string; distance: number }> = []

    // 初始化候选集
    for (const ep of entryPoints) {
      const node = this.nodes.get(ep)
      if (!node) continue

      const distance = euclideanDistance(queryVector, node.vector)
      candidates.push({ id: ep, distance })
      results.push({ id: ep, distance })
      visited.add(ep)
    }

    // 按距离排�?
    candidates.sort((a, b) => a.distance - b.distance)
    results.sort((a, b) => a.distance - b.distance)

    while (candidates.length > 0) {
      const current = candidates.shift()!

      // 如果当前候选比结果集最差的还差，停�?
      if (results.length >= ef && current.distance > results[results.length - 1].distance) {
        break
      }

      const currentNode = this.nodes.get(current.id)
      if (!currentNode) continue

      const connections = currentNode.connections.get(layer)
      if (!connections) continue

      for (const neighborId of connections) {
        if (visited.has(neighborId)) continue
        visited.add(neighborId)

        const neighbor = this.nodes.get(neighborId)
        if (!neighbor) continue

        const distance = euclideanDistance(queryVector, neighbor.vector)

        if (results.length < ef || distance < results[results.length - 1].distance) {
          candidates.push({ id: neighborId, distance })
          results.push({ id: neighborId, distance })

          // 保持候选集和结果集有序
          candidates.sort((a, b) => a.distance - b.distance)
          results.sort((a, b) => a.distance - b.distance)

          // 限制结果集大�?
          if (results.length > ef) {
            results.pop()
          }
        }
      }
    }

    return results
  }

  /**
   * 选择要连接的邻居
   */
  private selectNeighbors(
    _queryVector: number[],
    candidates: Array<{ id: string; distance: number }>,
    m: number
  ): string[] {
    // 简单策略：选择最近的 m �?
    return candidates.slice(0, m).map((c) => c.id)
  }

  /**
   * 插入单个节点
   */
  private insertNode(node: HNSWNode): void {
    const nodeLevel = this.getRandomLevel()

    // 初始化连接层
    for (let l = 0; l <= nodeLevel; l++) {
      node.connections.set(l, new Set())
    }

    this.nodes.set(node.id, node)

    // 如果是第一个节�?
    if (!this.entryPoint) {
      this.entryPoint = node.id
      this.maxLevel = nodeLevel
      return
    }

    let currentPoint = this.entryPoint
    let currentLevel = this.maxLevel

    // 从顶层向下搜�?
    while (currentLevel > nodeLevel) {
      const neighbors = this.searchLayer(node.vector, new Set([currentPoint]), 1, currentLevel)
      if (neighbors.length > 0) {
        currentPoint = neighbors[0].id
      }
      currentLevel--
    }

    // 在每一层插入并建立连接
    for (let level = Math.min(nodeLevel, currentLevel); level >= 0; level--) {
      const neighbors = this.searchLayer(node.vector, new Set([currentPoint]), this.hnswConfig.efConstruction, level)

      const selectedNeighbors = this.selectNeighbors(
        node.vector,
        neighbors,
        level === 0 ? this.hnswConfig.m * 2 : this.hnswConfig.m
      )

      // 建立双向连接
      const nodeConnections = node.connections.get(level)!
      for (const neighborId of selectedNeighbors) {
        nodeConnections.add(neighborId)

        const neighbor = this.nodes.get(neighborId)
        if (neighbor) {
          let neighborConnections = neighbor.connections.get(level)
          if (!neighborConnections) {
            neighborConnections = new Set()
            neighbor.connections.set(level, neighborConnections)
          }
          neighborConnections.add(node.id)

          // 修剪过多的连�?
          const maxConnections = level === 0 ? this.hnswConfig.m * 2 : this.hnswConfig.m
          if (neighborConnections.size > maxConnections) {
            // 找到最远的连接并删�?
            let maxDist = -1
            let farthestId = ''
            for (const connId of neighborConnections) {
              const connNode = this.nodes.get(connId)
              if (connNode) {
                const dist = euclideanDistance(neighbor.vector, connNode.vector)
                if (dist > maxDist) {
                  maxDist = dist
                  farthestId = connId
                }
              }
            }
            if (farthestId) {
              neighborConnections.delete(farthestId)
            }
          }
        }
      }

      if (neighbors.length > 0) {
        currentPoint = neighbors[0].id
      }
    }

    // 更新入口�?
    if (nodeLevel > this.maxLevel) {
      this.entryPoint = node.id
      this.maxLevel = nodeLevel
    }
  }

  async insertChunks(
    chunks: Array<{
      pageContent: string
      metadata: Record<string, any>
    }>,
    vectors: number[][]
  ): Promise<number> {
    if (chunks.length !== vectors.length) {
      throw new Error('Chunks and vectors count mismatch')
    }

    if (chunks.length === 0) return 0

    // 检测或验证维度
    if (this.dimensions === 0) {
      this.dimensions = vectors[0].length
      logger.info('Vector database dimension initialized', { dimensions: this.dimensions })
    } else if (vectors[0].length !== this.dimensions) {
      // 维度不匹配时，记录警告并重新初始化
      // 这通常发生在用户切换了嵌入模型
      logger.warn(
        `Vector dimension mismatch detected: database has ${this.dimensions} dimensions, new vectors have ${vectors[0].length}. ` +
          `This usually happens when switching embedding models. Re-initializing database with new dimension.`
      )

      // 清空现有数据并使用新维度
      this.nodes.clear()
      this.entryPoint = null
      this.maxLevel = 0
      this.idCounter = 0
      this.dimensions = vectors[0].length

      logger.info('Vector database re-initialized with new dimension', { dimensions: this.dimensions })
    }

    const loaderId = chunks[0].metadata?.uniqueLoaderId || `loader_${Date.now()}`

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const vector = vectors[i]
      const id = `${loaderId}_${this.idCounter++}`

      const node: HNSWNode = {
        id,
        vector,
        pageContent: chunk.pageContent,
        metadata: chunk.metadata,
        loaderId,
        connections: new Map()
      }

      this.insertNode(node)
    }

    logger.debug('Inserted chunks', { count: chunks.length, loaderId })
    return chunks.length
  }

  async similaritySearch(queryVector: number[], k: number): Promise<VectorSearchResult[]> {
    if (!this.entryPoint || this.nodes.size === 0) {
      return []
    }

    // 维度不匹配时优雅降级：返回空结果并记录警告
    if (queryVector.length !== this.dimensions) {
      logger.warn(
        `Dimension mismatch in vector search: database has ${this.dimensions} dimensions, query has ${queryVector.length}. ` +
          `Consider re-indexing with the correct embedding model.`
      )
      return []
    }

    // 从入口点开始搜索
    let currentPoint = this.entryPoint

    // 从顶层向下搜索到�?0 �?
    for (let level = this.maxLevel; level > 0; level--) {
      const neighbors = this.searchLayer(queryVector, new Set([currentPoint]), 1, level)
      if (neighbors.length > 0) {
        currentPoint = neighbors[0].id
      }
    }

    // 在第 0 层进行最终搜�?
    const results = this.searchLayer(queryVector, new Set([currentPoint]), Math.max(k, this.hnswConfig.efSearch), 0)

    // 转换为搜索结果格式（使用余弦相似度作�?score�?
    return results.slice(0, k).map((r) => {
      const node = this.nodes.get(r.id)!
      return {
        id: r.id,
        score: cosineSimilarity(queryVector, node.vector), // 转换为相似度分数
        metadata: node.metadata,
        pageContent: node.pageContent
      }
    })
  }

  async deleteKeys(uniqueLoaderId: string): Promise<boolean> {
    const nodesToDelete: string[] = []

    for (const [id, node] of this.nodes) {
      if (node.loaderId === uniqueLoaderId || node.metadata?.uniqueLoaderId === uniqueLoaderId) {
        nodesToDelete.push(id)
      }
    }

    for (const id of nodesToDelete) {
      const node = this.nodes.get(id)
      if (!node) continue

      // 从所有邻居的连接中移除此节点
      for (const [level, connections] of node.connections) {
        for (const neighborId of connections) {
          const neighbor = this.nodes.get(neighborId)
          if (neighbor) {
            const neighborConns = neighbor.connections.get(level)
            if (neighborConns) {
              neighborConns.delete(id)
            }
          }
        }
      }

      this.nodes.delete(id)
    }

    // 如果删除了入口点，需要重新选择
    if (this.entryPoint && !this.nodes.has(this.entryPoint)) {
      if (this.nodes.size > 0) {
        // 选择第一个节点作为新入口�?
        this.entryPoint = this.nodes.keys().next().value!
        // 重新计算最大层�?
        this.maxLevel = 0
        for (const node of this.nodes.values()) {
          const nodeMaxLevel = Math.max(...node.connections.keys())
          if (nodeMaxLevel > this.maxLevel) {
            this.maxLevel = nodeMaxLevel
          }
        }
      } else {
        this.entryPoint = null
        this.maxLevel = 0
      }
    }

    logger.debug('Deleted keys', { loaderId: uniqueLoaderId, count: nodesToDelete.length })
    return nodesToDelete.length > 0
  }

  async reset(): Promise<void> {
    this.nodes.clear()
    this.entryPoint = null
    this.maxLevel = 0
    this.idCounter = 0
    logger.info('MemoryVectorDb reset')
  }

  async getVectorCount(): Promise<number> {
    return this.nodes.size
  }

  async getStats(): Promise<VectorDbStats> {
    // 估算内存使用 (每个向量�?dimensions * 4 bytes + 元数�?
    const vectorMemory = this.nodes.size * this.dimensions * 4
    const metadataMemory = this.nodes.size * 200 // 估算每个节点元数据约 200 bytes

    return {
      totalVectors: this.nodes.size,
      dimensions: this.dimensions,
      memoryUsage: vectorMemory + metadataMemory,
      indexType: 'hnsw-memory'
    }
  }

  async close(): Promise<void> {
    // 内存数据库不需要显式关�?
    logger.info('MemoryVectorDb closed')
  }
}

/**
 * 创建内存向量数据�?
 */
export function createMemoryVectorDb(config: VectorDbConfig): MemoryVectorDb {
  return new MemoryVectorDb(config)
}
