/**
 * ResultAggregator - 向量搜索结果聚合器
 *
 * 使用 RRF (Reciprocal Rank Fusion) 算法融合多个后端的搜索结果
 *
 * 注意: RRF 核心算法统一使用 @main/memory/utils/RRFUtils
 */

import { loggerService } from '@logger'
import { calculateRRFScore } from '@main/memory/utils/RRFUtils'

import type { VectorSearchResult } from '../types'
import type { ExtendedVectorBackend } from './VectorBackendRegistry'

const logger = loggerService.withContext('ResultAggregator')

/**
 * 统一搜索结果
 */
export interface UnifiedSearchResult {
  /** 唯一标识 */
  id: string
  /** 内容 */
  content: string
  /** 融合后分数 */
  score: number
  /** 来源后端 */
  source: ExtendedVectorBackend
  /** 元数据 */
  metadata?: Record<string, any>
  /** 贡献后端列表 (RRF 融合时) */
  contributingBackends?: ExtendedVectorBackend[]
  /** 原始分数 (融合前) */
  originalScore?: number
}

/**
 * 后端搜索结果
 */
export interface BackendSearchResults {
  backend: ExtendedVectorBackend
  results: VectorSearchResult[]
  durationMs: number
  error?: string
}

/**
 * 聚合选项
 */
export interface AggregationOptions {
  /** RRF k 常数 (默认 60) */
  rrfK?: number
  /** 返回数量 */
  topK?: number
  /** 是否去重 */
  deduplicate?: boolean
  /** 去重阈值 (内容相似度) */
  deduplicateThreshold?: number
}

/**
 * 结果聚合器
 */
export class ResultAggregator {
  /** RRF 常数 */
  private readonly defaultRrfK = 60

  /**
   * 聚合多个后端的搜索结果
   */
  aggregate(backendResults: BackendSearchResults[], options: AggregationOptions = {}): UnifiedSearchResult[] {
    const { rrfK = this.defaultRrfK, topK = 10, deduplicate = true, deduplicateThreshold = 0.9 } = options

    const scoreMap = new Map<
      string,
      {
        result: UnifiedSearchResult
        rrfScore: number
        sources: ExtendedVectorBackend[]
      }
    >()

    for (const { backend, results, error } of backendResults) {
      if (error) {
        logger.warn(`Skipping backend ${backend} due to error`, { error })
        continue
      }

      // 按分数排序
      const sorted = [...results].sort((a, b) => b.score - a.score)

      for (let rank = 0; rank < sorted.length; rank++) {
        const item = sorted[rank]
        const contentKey = this.generateContentKey(item)

        // 使用统一的 RRF 分数计算
        const rrfScore = calculateRRFScore(rank, rrfK)

        if (scoreMap.has(contentKey)) {
          const existing = scoreMap.get(contentKey)!
          existing.rrfScore += rrfScore // 累加分数
          existing.sources.push(backend)
        } else {
          scoreMap.set(contentKey, {
            result: {
              id: item.id,
              content: item.pageContent ?? '',
              score: item.score,
              source: backend,
              metadata: item.metadata,
              originalScore: item.score
            },
            rrfScore,
            sources: [backend]
          })
        }
      }
    }

    // 按 RRF 分数排序
    let aggregated: UnifiedSearchResult[] = [...scoreMap.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map((item) => ({
        ...item.result,
        score: item.rrfScore,
        contributingBackends: [...new Set(item.sources)]
      }))

    // 去重
    if (deduplicate) {
      aggregated = this.deduplicateResults(aggregated, deduplicateThreshold)
    }

    logger.debug('Results aggregated', {
      inputBackends: backendResults.length,
      totalResults: scoreMap.size,
      outputResults: Math.min(aggregated.length, topK)
    })

    return aggregated.slice(0, topK)
  }

  /**
   * 简单合并 (不使用 RRF)
   */
  simpleMerge(
    backendResults: BackendSearchResults[],
    options: Pick<AggregationOptions, 'topK' | 'deduplicate'>
  ): UnifiedSearchResult[] {
    const { topK = 10, deduplicate = true } = options

    const allResults: UnifiedSearchResult[] = []

    for (const { backend, results, error } of backendResults) {
      if (error) continue

      for (const item of results) {
        allResults.push({
          id: item.id,
          content: item.pageContent ?? '',
          score: item.score,
          source: backend,
          metadata: item.metadata
        })
      }
    }

    // 按分数排序
    allResults.sort((a, b) => b.score - a.score)

    // 去重
    let finalResults = allResults
    if (deduplicate) {
      finalResults = this.deduplicateResults(allResults, 0.9)
    }

    return finalResults.slice(0, topK)
  }

  /**
   * 加权合并
   */
  weightedMerge(
    backendResults: BackendSearchResults[],
    weights: Map<ExtendedVectorBackend, number>,
    options: Pick<AggregationOptions, 'topK' | 'deduplicate'>
  ): UnifiedSearchResult[] {
    const { topK = 10, deduplicate = true } = options

    const allResults: UnifiedSearchResult[] = []

    for (const { backend, results, error } of backendResults) {
      if (error) continue

      const weight = weights.get(backend) ?? 1.0

      for (const item of results) {
        allResults.push({
          id: item.id,
          content: item.pageContent ?? '',
          score: item.score * weight,
          source: backend,
          metadata: item.metadata,
          originalScore: item.score
        })
      }
    }

    // 按加权分数排序
    allResults.sort((a, b) => b.score - a.score)

    // 去重
    let finalResults = allResults
    if (deduplicate) {
      finalResults = this.deduplicateResults(allResults, 0.9)
    }

    return finalResults.slice(0, topK)
  }

  /**
   * 生成内容唯一键
   */
  private generateContentKey(item: VectorSearchResult): string {
    // 使用内容哈希作为键
    const content = item.pageContent || ''
    const prefix = content.slice(0, 100).toLowerCase().replace(/\s+/g, ' ')
    return `${prefix}_${this.simpleHash(content)}`
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }

  /**
   * 结果去重
   */
  private deduplicateResults(results: UnifiedSearchResult[], threshold: number): UnifiedSearchResult[] {
    const unique: UnifiedSearchResult[] = []

    for (const result of results) {
      let isDuplicate = false

      for (const existing of unique) {
        const similarity = this.calculateSimilarity(result.content, existing.content)
        if (similarity >= threshold) {
          isDuplicate = true
          // 保留分数较高的来源信息
          if (result.score > existing.score) {
            existing.contributingBackends = [...(existing.contributingBackends || []), result.source]
          }
          break
        }
      }

      if (!isDuplicate) {
        unique.push(result)
      }
    }

    return unique
  }

  /**
   * 计算文本相似度 (简单的 Jaccard)
   */
  private calculateSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/))
    const setB = new Set(b.toLowerCase().split(/\s+/))

    const intersection = new Set([...setA].filter((x) => setB.has(x)))
    const union = new Set([...setA, ...setB])

    return intersection.size / union.size
  }
}

/**
 * 创建结果聚合器
 */
export function createResultAggregator(): ResultAggregator {
  return new ResultAggregator()
}
