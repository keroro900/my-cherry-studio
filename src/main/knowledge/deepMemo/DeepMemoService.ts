/**
 * DeepMemo - 深度检索服务
 *
 * 实现双层检索策略：
 * 1. 关键词检索 (Tantivy / BM25 fallback)
 * 2. 向量语义检索 (rust-vexus-lite)
 * 3. Reranker 精排融合
 *
 * 特点:
 * - 高召回率
 * - 支持大规模文档集
 * - 可插拔的检索后端
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'
import { vectorOps } from '@main/services/native'
import { getUnifiedRerankService } from '@main/services/rerank'

import { getLightMemoService, type LightMemoService } from '../lightMemo'
import { getTantivyLikeAdapter } from './TantivyLikeAdapter'

const logger = loggerService.withContext('DeepMemoService')

// ==================== 类型定义 ====================

/**
 * 文档条目
 */
export interface DeepMemoDocument {
  id: string
  content: string
  embedding?: number[]
  metadata?: Record<string, unknown>
  /** 文档创建时间 */
  createdAt?: Date
  /** 文档更新时间 */
  updatedAt?: Date
}

/**
 * 搜索结果
 */
export interface DeepMemoSearchResult {
  id: string
  content: string
  score: number
  keywordScore: number
  semanticScore: number
  rerankScore?: number
  metadata?: Record<string, unknown>
}

/**
 * 检索后端类型
 */
export type KeywordBackend = 'tantivy' | 'bm25'

/**
 * Reranker 函数类型
 */
export type RerankerFn = (query: string, results: DeepMemoSearchResult[]) => Promise<DeepMemoSearchResult[]>

/**
 * 检索配置
 */
export interface DeepMemoConfig {
  /** 关键词检索后端 */
  keywordBackend?: KeywordBackend
  /** 关键词检索权重 (0-1) */
  keywordWeight?: number
  /** 语义检索权重 (0-1) */
  semanticWeight?: number
  /** 初始召回数量 */
  initialTopK?: number
  /** 最终返回数量 */
  finalTopK?: number
  /** 最低分数阈值 */
  threshold?: number
  /** 是否启用 Reranker */
  rerank?: boolean
  /** 自定义 Reranker 函数 */
  rerankFn?: RerankerFn
  /** Reranker 模型 ID (用于 Cherry Studio 模型服务) */
  rerankModelId?: string
}

/**
 * Tantivy 适配器接口 (用于未来的 Rust 绑定)
 */
export interface TantivyAdapter {
  /** 添加文档 */
  addDocument(id: string, content: string, metadata?: Record<string, unknown>): Promise<void>
  /** 搜索 */
  search(query: string, limit: number): Promise<Array<{ id: string; score: number }>>
  /** 删除文档 */
  deleteDocument(id: string): Promise<void>
  /** 提交更改 */
  commit(): Promise<void>
  /** 清空索引 */
  clear(): Promise<void>
}

// ==================== DeepMemo 服务类 ====================

export class DeepMemoService {
  private documents: Map<string, DeepMemoDocument> = new Map()
  private bm25Fallback: LightMemoService
  private tantivyAdapter?: TantivyAdapter
  private keywordBackend: KeywordBackend = 'bm25'

  constructor(config?: { tantivyAdapter?: TantivyAdapter }) {
    this.bm25Fallback = getLightMemoService()

    if (config?.tantivyAdapter) {
      this.tantivyAdapter = config.tantivyAdapter
      this.keywordBackend = 'tantivy'
      logger.info('DeepMemoService initialized with Tantivy backend')
    } else {
      logger.info('DeepMemoService initialized with BM25 fallback')
    }
  }

  /**
   * 设置 Tantivy 适配器
   */
  setTantivyAdapter(adapter: TantivyAdapter): void {
    this.tantivyAdapter = adapter
    this.keywordBackend = 'tantivy'
    logger.info('Tantivy adapter set')
  }

  /**
   * 添加文档
   */
  async addDocument(doc: DeepMemoDocument): Promise<void> {
    this.documents.set(doc.id, doc)

    // 添加到关键词索引
    if (this.keywordBackend === 'tantivy' && this.tantivyAdapter) {
      await this.tantivyAdapter.addDocument(doc.id, doc.content, doc.metadata)
    } else {
      this.bm25Fallback.addDocument({
        id: doc.id,
        content: doc.content,
        embedding: doc.embedding,
        metadata: doc.metadata
      })
    }
  }

  /**
   * 批量添加文档
   */
  async addDocuments(docs: DeepMemoDocument[]): Promise<void> {
    for (const doc of docs) {
      await this.addDocument(doc)
    }

    // 提交 Tantivy 索引
    if (this.keywordBackend === 'tantivy' && this.tantivyAdapter) {
      await this.tantivyAdapter.commit()
    } else {
      this.bm25Fallback.buildIndex()
    }
  }

  /**
   * 搜索
   */
  async search(query: string, queryEmbedding?: number[], config: DeepMemoConfig = {}): Promise<DeepMemoSearchResult[]> {
    const {
      keywordWeight = 0.3,
      semanticWeight = 0.7,
      initialTopK = 100,
      finalTopK = 10,
      threshold = 0,
      rerank = false,
      rerankFn
    } = config

    logger.debug('DeepMemo search started', {
      query: query.substring(0, 50),
      backend: this.keywordBackend,
      documentCount: this.documents.size
    })

    // Step 1: 关键词检索
    const keywordResults = await this.keywordSearch(query, initialTopK)

    // Step 2: 向量检索
    const semanticResults = queryEmbedding
      ? this.semanticSearch(queryEmbedding, initialTopK)
      : new Map<string, number>()

    // Step 3: 分数融合
    const fusedResults = this.fuseResults(keywordResults, semanticResults, keywordWeight, semanticWeight, threshold)

    logger.debug('Results fused', { count: fusedResults.length })

    // Step 4: Rerank
    let finalResults = fusedResults
    if (rerank && rerankFn) {
      finalResults = await rerankFn(query, fusedResults)
    } else if (rerank) {
      finalResults = await this.defaultRerank(query, fusedResults)
    }

    // Step 5: 截取结果
    return finalResults.slice(0, finalTopK)
  }

  /**
   * 关键词检索
   */
  private async keywordSearch(query: string, limit: number): Promise<Map<string, number>> {
    if (this.keywordBackend === 'tantivy' && this.tantivyAdapter) {
      const results = await this.tantivyAdapter.search(query, limit)
      const scoreMap = new Map<string, number>()

      // 归一化分数
      const maxScore = results.length > 0 ? Math.max(...results.map((r) => r.score)) : 1
      for (const r of results) {
        scoreMap.set(r.id, r.score / maxScore)
      }

      return scoreMap
    } else {
      // BM25 fallback
      const results = await this.bm25Fallback.search(query, undefined, { topK: limit })
      const scoreMap = new Map<string, number>()
      for (const r of results) {
        scoreMap.set(r.id, r.bm25Score)
      }
      return scoreMap
    }
  }

  /**
   * 语义检索 - 使用 Native vectorOps 加速
   */
  private semanticSearch(queryEmbedding: number[], limit: number): Map<string, number> {
    const scores = new Map<string, number>()

    // 收集所有有 embedding 的文档
    const docsWithEmbedding: Array<{ id: string; embedding: number[] }> = []
    for (const [id, doc] of this.documents) {
      if (doc.embedding) {
        docsWithEmbedding.push({ id, embedding: doc.embedding })
      }
    }

    if (docsWithEmbedding.length === 0) {
      return scores
    }

    // 使用 Native batchCosineSimilarity 批量计算
    const embeddings = docsWithEmbedding.map((d) => d.embedding)
    const similarities = vectorOps.batchCosineSimilarity(queryEmbedding, embeddings)

    // 构建结果
    const results: Array<{ id: string; score: number }> = docsWithEmbedding.map((doc, i) => ({
      id: doc.id,
      score: similarities[i]
    }))

    // 过滤非正分数并排序取 top-K
    results
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .forEach((r) => scores.set(r.id, r.score))

    return scores
  }

  /**
   * 分数融合
   */
  private fuseResults(
    keywordScores: Map<string, number>,
    semanticScores: Map<string, number>,
    keywordWeight: number,
    semanticWeight: number,
    threshold: number
  ): DeepMemoSearchResult[] {
    const allIds = new Set([...keywordScores.keys(), ...semanticScores.keys()])
    const results: DeepMemoSearchResult[] = []

    for (const id of allIds) {
      const doc = this.documents.get(id)
      if (!doc) continue

      const kScore = keywordScores.get(id) || 0
      const sScore = semanticScores.get(id) || 0

      // 加权融合
      const score = keywordWeight * kScore + semanticWeight * sScore

      if (score >= threshold) {
        results.push({
          id,
          content: doc.content,
          score,
          keywordScore: kScore,
          semanticScore: sScore,
          metadata: doc.metadata
        })
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score)
    return results
  }

  /**
   * 默认 Rerank - 使用 UnifiedRerankService
   * 如果 UnifiedRerankService 不可用，则回退到关键词增强
   */
  private async defaultRerank(query: string, results: DeepMemoSearchResult[]): Promise<DeepMemoSearchResult[]> {
    // 1. 尝试使用 UnifiedRerankService
    const rerankService = getUnifiedRerankService()
    if (rerankService.isAvailable('deepmemo')) {
      try {
        const documents = results.map((r) => ({
          id: r.id,
          content: r.content,
          score: r.score,
          metadata: r.metadata
        }))

        const reranked = await rerankService.rerankForDeepMemo(query, documents, results.length)

        return reranked.map((r) => {
          const original = results.find((o) => o.id === r.id)!
          return {
            ...original,
            score: r.score,
            rerankScore: r.score
          }
        })
      } catch (error) {
        logger.warn('UnifiedRerankService failed, falling back to keyword boost', { error })
      }
    }

    // 2. 回退到关键词增强
    return this.keywordBoostRerank(query, results)
  }

  /**
   * 关键词增强 Rerank (本地备用)
   */
  private keywordBoostRerank(query: string, results: DeepMemoSearchResult[]): DeepMemoSearchResult[] {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0)

    return results
      .map((r) => {
        const contentLower = r.content.toLowerCase()
        let boost = 1

        // 检查查询词完整匹配
        if (contentLower.includes(query.toLowerCase())) {
          boost += 0.2
        }

        // 检查各个词
        let matchCount = 0
        for (const term of queryTerms) {
          if (contentLower.includes(term)) {
            matchCount++
          }
        }

        boost += 0.1 * (matchCount / queryTerms.length)

        return {
          ...r,
          score: r.score * boost,
          rerankScore: boost
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: string): Promise<boolean> {
    const existed = this.documents.has(id)
    this.documents.delete(id)

    if (this.keywordBackend === 'tantivy' && this.tantivyAdapter) {
      await this.tantivyAdapter.deleteDocument(id)
    }

    return existed
  }

  /**
   * 清空所有文档
   */
  async clear(): Promise<void> {
    this.documents.clear()

    if (this.keywordBackend === 'tantivy' && this.tantivyAdapter) {
      await this.tantivyAdapter.clear()
    } else {
      this.bm25Fallback.clear()
    }
  }

  /**
   * 获取文档数量
   */
  getDocumentCount(): number {
    return this.documents.size
  }

  /**
   * 获取当前后端类型
   */
  getKeywordBackend(): KeywordBackend {
    return this.keywordBackend
  }
}

// ==================== 导出 ====================

let serviceInstance: DeepMemoService | null = null

/**
 * 获取 DeepMemo 服务实例 (单例)
 * 默认使用 TantivyLikeAdapter 提供增强的全文检索
 */
export function getDeepMemoService(): DeepMemoService {
  if (!serviceInstance) {
    // 默认使用 TantivyLikeAdapter
    const tantivyAdapter = getTantivyLikeAdapter()
    serviceInstance = new DeepMemoService({ tantivyAdapter })
  }
  return serviceInstance
}

/**
 * 创建新的 DeepMemo 服务实例
 */
export function createDeepMemoService(config?: { tantivyAdapter?: TantivyAdapter }): DeepMemoService {
  return new DeepMemoService(config)
}
