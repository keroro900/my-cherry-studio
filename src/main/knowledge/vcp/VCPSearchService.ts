/**
 * VCP 搜索服务
 *
 * 提供统一的知识库检索接口，集成多种增强功能：
 * - RAG / 全文检索模式
 * - 时间感知搜索
 * - 语义组增强
 * - TagMemo 标签共现增强 (使用 Rust Native 层)
 * - Rerank 精准重排序
 *
 * 此服务完全独立，不依赖 VCPToolBox 后端。
 */

import { loggerService } from '@logger'
import type { KnowledgeSearchResult } from '@types'

import type { KnowledgeBaseAccessor } from '../modes/RetrievalStrategy'
import type { RetrievalBackend, RetrievalMode } from '../modes/types'
import { createSemanticGroupSearchService } from '../search/SemanticGroupSearch'
import { createTimeAwareSearchService } from '../search/TimeAwareSearch'
import { getNativeSemanticGroupService } from '../../services/memory/SemanticGroupService'

const logger = loggerService.withContext('VCPSearchService')

// ==================== 类型定义 ====================

/**
 * VCP 搜索配置
 */
export interface VCPSearchConfig {
  mode?: RetrievalMode
  threshold?: number
  topK?: number
  backend?: RetrievalBackend
  timeAware?: boolean
  timeRange?: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'
  semanticGroups?: string[]
  tagMemo?: boolean
  tagMemoThreshold?: number
  aiMemo?: boolean // AI 驱动合成召回
  rerank?: boolean // 精准重排序
}

/**
 * VCP 搜索结果
 */
export interface VCPSearchResult {
  results: KnowledgeSearchResult[]
  metadata?: {
    mode: RetrievalMode
    enhancementsApplied?: string[]
    totalTime?: number
  }
}

// ==================== VCPSearchService 实现 ====================

/**
 * VCP 搜索服务
 */
export class VCPSearchService {
  private nativeTagMemo = getNativeSemanticGroupService()
  private timeAware = createTimeAwareSearchService()
  private semanticGroup = createSemanticGroupSearchService()

  constructor() {
    logger.info('VCPSearchService initialized (Native TagMemo + Rerank)')
  }

  /**
   * 执行 VCP 风格搜索
   */
  async search(accessor: KnowledgeBaseAccessor, query: string, config: VCPSearchConfig = {}): Promise<VCPSearchResult> {
    const startTime = Date.now()
    const {
      mode = 'rag',
      threshold = 0.5,
      topK = 10,
      timeAware = false,
      timeRange = 'all',
      semanticGroups = [],
      tagMemo = false,
      tagMemoThreshold = 0.65,
      rerank = false
    } = config

    const enhancementsApplied: string[] = []

    try {
      // 1. 执行基础检索
      let results: KnowledgeSearchResult[]

      if (mode === 'fulltext' || mode === 'threshold_fulltext') {
        // 全文模式: 获取完整内容
        const fullContent = await accessor.getFullContent('')
        results = [
          {
            pageContent: fullContent,
            score: 1.0,
            metadata: {}
          }
        ]
      } else {
        // RAG 模式: 向量检索
        results = await accessor.vectorSearch('', query, { topK: topK * 2, threshold })
      }

      // 2. 阈值检查
      if (mode === 'threshold_rag' || mode === 'threshold_fulltext') {
        const relevance = await accessor.computeRelevance('', query)
        if (relevance < threshold) {
          logger.debug('Threshold not met', { relevance, threshold })
          return {
            results: [],
            metadata: { mode, enhancementsApplied }
          }
        }
        enhancementsApplied.push('threshold')
      }

      // 3. 时间感知增强
      if (timeAware) {
        const timeConfig = {
          enabled: true,
          timeRange: { range: timeRange as 'all' | 'week' | 'month' | 'quarter' },
          decayEnabled: true
        }
        results = this.timeAware.applyTimeAwareness(results, timeConfig)
        enhancementsApplied.push('timeAware')
      }

      // 4. 语义组增强
      if (semanticGroups.length > 0) {
        const groupConfig = {
          enabled: true,
          groups: semanticGroups as Array<'color' | 'pattern' | 'silhouette' | 'style'>
        }
        results = this.semanticGroup.applySemanticGroupEnhancement(query, results, groupConfig)
        enhancementsApplied.push('semanticGroups')
      }

      // 5. TagMemo 增强 (使用 Native Rust 层)
      if (tagMemo) {
        results = await this.applyNativeTagMemoEnhancement(query, results, tagMemoThreshold)
        enhancementsApplied.push('tagMemo')
      }

      // 6. Rerank 精排 (使用关键词匹配 + LLM)
      if (rerank) {
        results = await this.applyRerank(query, results)
        enhancementsApplied.push('rerank')
      }

      // 7. 截取最终结果
      results = results.slice(0, topK)

      const totalTime = Date.now() - startTime

      logger.debug('VCP search completed', {
        mode,
        resultCount: results.length,
        enhancementsApplied,
        totalTime
      })

      return {
        results,
        metadata: {
          mode,
          enhancementsApplied,
          totalTime
        }
      }
    } catch (error) {
      logger.error('VCP search failed', error as Error)
      return {
        results: [],
        metadata: { mode, enhancementsApplied }
      }
    }
  }

  /**
   * 使用 Native TagMemo 进行标签增强
   */
  private async applyNativeTagMemoEnhancement(
    query: string,
    results: KnowledgeSearchResult[],
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    try {
      // 提取查询标签
      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1)

      // 使用 Native TagMemo 扩展查询
      const expandedTags = this.nativeTagMemo.expandQueryTokens(queryWords)
      const expandedSet = new Set(expandedTags.map((t) => t.toLowerCase()))

      logger.debug('Native TagMemo expansion', {
        queryWords,
        expandedTags: expandedTags.slice(0, 10),
        threshold
      })

      // 计算增强分数
      return results
        .map((r) => {
          const content = r.pageContent.toLowerCase()
          let tagBoost = 0

          for (const tag of expandedSet) {
            if (content.includes(tag)) {
              tagBoost += 0.05
            }
          }

          // 限制最大增强比例
          const boostedScore = r.score * (1 + Math.min(tagBoost, 0.3))

          return {
            ...r,
            score: boostedScore >= threshold ? boostedScore : r.score
          }
        })
        .sort((a, b) => b.score - a.score)
    } catch (error) {
      logger.warn('Native TagMemo enhancement failed, using original results', { error })
      return results
    }
  }

  /**
   * Rerank 精排
   * 基于关键词匹配和内容质量
   */
  private async applyRerank(query: string, results: KnowledgeSearchResult[]): Promise<KnowledgeSearchResult[]> {
    if (results.length <= 3) {
      return results
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1)

    return results
      .map((r) => {
        const content = r.pageContent.toLowerCase()
        let rerankScore = r.score

        // 1. 关键词密度加分
        let matchCount = 0
        for (const term of queryTerms) {
          const regex = new RegExp(term, 'gi')
          const matches = content.match(regex)
          matchCount += matches ? matches.length : 0
        }
        const keywordDensity = matchCount / (content.length / 100 + 1)
        rerankScore *= 1 + Math.min(keywordDensity * 0.1, 0.2)

        // 2. 首段匹配加分 (前 200 字符)
        const firstParagraph = content.slice(0, 200)
        const firstParaMatches = queryTerms.filter((t) => firstParagraph.includes(t)).length
        rerankScore *= 1 + firstParaMatches * 0.05

        // 3. 精确短语匹配加分
        if (query.length > 5 && content.includes(query.toLowerCase())) {
          rerankScore *= 1.3
        }

        return {
          ...r,
          score: rerankScore
        }
      })
      .sort((a, b) => b.score - a.score)
  }
}

// ==================== 导出 ====================

/**
 * 创建 VCP 搜索服务
 */
export function createVCPSearchService(): VCPSearchService {
  return new VCPSearchService()
}

/**
 * 默认单例实例
 */
export const vcpSearchService = new VCPSearchService()
