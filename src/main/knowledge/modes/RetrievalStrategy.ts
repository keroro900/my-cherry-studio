/**
 * 检索策略服务
 * 基于 VCPToolBox 的 4 种检索模式实现
 *
 * 策略:
 * 1. fulltext - 全文注入，获取知识库全部内容
 * 2. rag - RAG 片段，向量检索相关片段
 * 3. threshold_fulltext - 阈值全文，超过阈值才注入
 * 4. threshold_rag - 阈值 RAG，超过阈值才检索
 */

import { loggerService } from '@logger'
import type { KnowledgeSearchResult } from '@types'

import type { SemanticGroupSearchService } from '../search/SemanticGroupSearch'
import { createSemanticGroupSearchService } from '../search/SemanticGroupSearch'
import type { TimeAwareSearchService } from '../search/TimeAwareSearch'
import { createTimeAwareSearchService } from '../search/TimeAwareSearch'
import type { TagMemoService } from '../tagmemo/TagMemoService'
import { getTagMemoService } from '../tagmemo/TagMemoService'
import type { RetrievalConfig, RetrievalMode } from './types'

const logger = loggerService.withContext('RetrievalStrategy')

/**
 * 知识库访问接口
 * 需要由外部实现
 */
export interface KnowledgeBaseAccessor {
  /**
   * 获取知识库全部内容
   */
  getFullContent(knowledgeBaseName: string): Promise<string>

  /**
   * 向量检索
   */
  vectorSearch(
    knowledgeBaseName: string,
    query: string,
    options?: {
      topK?: number
      threshold?: number
    }
  ): Promise<KnowledgeSearchResult[]>

  /**
   * 获取知识库元数据
   */
  getMetadata(knowledgeBaseName: string): Promise<{
    documentCount: number
    totalChunks: number
    lastUpdated?: Date
  }>

  /**
   * 计算查询与知识库的整体相似度
   */
  computeRelevance(knowledgeBaseName: string, query: string): Promise<number>
}

/**
 * 检索结果
 */
export interface RetrievalResult {
  mode: RetrievalMode
  knowledgeBaseName: string
  content: string | null // 对于 fulltext 模式返回完整内容
  chunks: KnowledgeSearchResult[] // 对于 rag 模式返回片段
  metadata: {
    relevanceScore?: number // 整体相关性分数
    chunkCount?: number
    thresholdMet?: boolean // 是否满足阈值条件
    skipped?: boolean // 是否跳过 (阈值不满足)
    enhancementsApplied?: string[] // 应用的增强功能
  }
}

export class RetrievalStrategyService {
  private timeAwareService: TimeAwareSearchService
  private semanticGroupService: SemanticGroupSearchService
  private tagMemoService: TagMemoService

  constructor() {
    this.timeAwareService = createTimeAwareSearchService()
    this.semanticGroupService = createSemanticGroupSearchService()
    this.tagMemoService = getTagMemoService()
  }

  /**
   * 执行检索策略
   */
  async execute(
    accessor: KnowledgeBaseAccessor,
    knowledgeBaseName: string,
    query: string,
    config: RetrievalConfig
  ): Promise<RetrievalResult> {
    logger.info('Executing retrieval strategy', {
      knowledgeBase: knowledgeBaseName,
      mode: config.mode,
      hasThreshold: !!config.threshold
    })

    const enhancementsApplied: string[] = []

    // 1. 对于阈值模式，先计算整体相关性
    if (config.mode === 'threshold_fulltext' || config.mode === 'threshold_rag') {
      const relevance = await accessor.computeRelevance(knowledgeBaseName, query)
      const threshold = config.threshold || 0.7

      if (relevance < threshold) {
        logger.debug('Threshold not met, skipping retrieval', {
          relevance,
          threshold
        })

        return {
          mode: config.mode,
          knowledgeBaseName,
          content: null,
          chunks: [],
          metadata: {
            relevanceScore: relevance,
            thresholdMet: false,
            skipped: true
          }
        }
      }

      logger.debug('Threshold met, proceeding with retrieval', { relevance, threshold })
    }

    // 2. 根据模式执行检索
    let result: RetrievalResult

    switch (config.mode) {
      case 'fulltext':
      case 'threshold_fulltext':
        result = await this.executeFulltextRetrieval(accessor, knowledgeBaseName, config)
        break

      case 'rag':
      case 'threshold_rag':
        result = await this.executeRagRetrieval(accessor, knowledgeBaseName, query, config)
        break

      default:
        throw new Error(`Unknown retrieval mode: ${config.mode}`)
    }

    // 3. 应用增强功能 (仅对 RAG 模式)
    if (result.chunks.length > 0) {
      result = await this.applyEnhancements(result, query, config, enhancementsApplied)
    }

    result.metadata.enhancementsApplied = enhancementsApplied

    logger.info('Retrieval completed', {
      mode: config.mode,
      contentLength: result.content?.length || 0,
      chunkCount: result.chunks.length
    })

    return result
  }

  /**
   * 执行全文检索
   */
  private async executeFulltextRetrieval(
    accessor: KnowledgeBaseAccessor,
    knowledgeBaseName: string,
    config: RetrievalConfig
  ): Promise<RetrievalResult> {
    const content = await accessor.getFullContent(knowledgeBaseName)
    const metadata = await accessor.getMetadata(knowledgeBaseName)

    return {
      mode: config.mode,
      knowledgeBaseName,
      content,
      chunks: [],
      metadata: {
        chunkCount: metadata.totalChunks,
        thresholdMet: true
      }
    }
  }

  /**
   * 执行 RAG 检索
   */
  private async executeRagRetrieval(
    accessor: KnowledgeBaseAccessor,
    knowledgeBaseName: string,
    query: string,
    config: RetrievalConfig
  ): Promise<RetrievalResult> {
    const chunks = await accessor.vectorSearch(knowledgeBaseName, query, {
      topK: config.topK || 10,
      threshold: config.threshold
    })

    return {
      mode: config.mode,
      knowledgeBaseName,
      content: null,
      chunks,
      metadata: {
        chunkCount: chunks.length,
        thresholdMet: true
      }
    }
  }

  /**
   * 应用增强功能
   */
  private async applyEnhancements(
    result: RetrievalResult,
    query: string,
    config: RetrievalConfig,
    enhancementsApplied: string[]
  ): Promise<RetrievalResult> {
    let chunks = result.chunks

    // 1. 时间感知增强
    if (config.timeAware) {
      const timeConfig = {
        enabled: true,
        timeRange: { range: (config.timeRange as 'all' | 'week' | 'month' | 'quarter') || ('all' as const) },
        decayEnabled: true
      }

      chunks = this.timeAwareService.applyTimeAwareness(chunks, timeConfig) as KnowledgeSearchResult[]
      enhancementsApplied.push('timeAware')

      logger.debug('Applied time awareness', { resultCount: chunks.length })
    }

    // 2. 语义组增强
    if (config.semanticGroups && config.semanticGroups.length > 0) {
      const groupConfig = {
        enabled: true,
        groups: config.semanticGroups as Array<'color' | 'pattern' | 'silhouette' | 'style'>
      }

      chunks = this.semanticGroupService.applySemanticGroupEnhancement(
        query,
        chunks,
        groupConfig
      ) as KnowledgeSearchResult[]
      enhancementsApplied.push('semanticGroups')

      logger.debug('Applied semantic group enhancement', { groups: config.semanticGroups })
    }

    // 3. TagMemo 增强
    if (config.tagMemo) {
      // 初始化 TagMemo (如果需要)
      await this.tagMemoService.initializeFromSearchResults(chunks)

      // 从查询中提取标签
      const queryTags = this.tagMemoService.extractTagsFromQuery(query)

      if (queryTags.length > 0) {
        chunks = (await this.tagMemoService.applyTagBoost(query, queryTags, chunks)) as KnowledgeSearchResult[]
        enhancementsApplied.push('tagMemo')

        logger.debug('Applied TagMemo boost', { queryTags })
      }
    }

    return {
      ...result,
      chunks
    }
  }

  /**
   * 批量执行多个知识库的检索
   */
  async executeBatch(
    accessor: KnowledgeBaseAccessor,
    configs: Map<string, RetrievalConfig>,
    query: string
  ): Promise<Map<string, RetrievalResult>> {
    const results = new Map<string, RetrievalResult>()

    // 并行执行检索
    const promises = Array.from(configs.entries()).map(async ([knowledgeBaseName, config]) => {
      try {
        const result = await this.execute(accessor, knowledgeBaseName, query, config)
        return { knowledgeBaseName, result }
      } catch (error) {
        logger.error('Retrieval failed', { knowledgeBaseName, error })
        return {
          knowledgeBaseName,
          result: {
            mode: config.mode,
            knowledgeBaseName,
            content: null,
            chunks: [],
            metadata: { skipped: true }
          } as RetrievalResult
        }
      }
    })

    const resolvedResults = await Promise.all(promises)

    for (const { knowledgeBaseName, result } of resolvedResults) {
      results.set(knowledgeBaseName, result)
    }

    return results
  }

  /**
   * 将检索结果合并为上下文字符串
   */
  formatResultsAsContext(results: Map<string, RetrievalResult>, options?: { maxLength?: number }): string {
    const maxLength = options?.maxLength || 8000
    const parts: string[] = []

    for (const [knowledgeBaseName, result] of results.entries()) {
      if (result.metadata.skipped) {
        continue
      }

      let content = ''

      if (result.content) {
        // 全文模式
        content = result.content
      } else if (result.chunks.length > 0) {
        // RAG 模式
        content = result.chunks.map((chunk, i) => `[${i + 1}] ${chunk.pageContent}`).join('\n\n')
      }

      if (content) {
        parts.push(`--- ${knowledgeBaseName} ---\n${content}`)
      }
    }

    let combined = parts.join('\n\n')

    // 截断到最大长度
    if (combined.length > maxLength) {
      combined = combined.slice(0, maxLength - 3) + '...'
    }

    return combined
  }
}

// 导出工厂函数
export function createRetrievalStrategyService(): RetrievalStrategyService {
  return new RetrievalStrategyService()
}

// 导出默认实例
export const retrievalStrategyService = new RetrievalStrategyService()
