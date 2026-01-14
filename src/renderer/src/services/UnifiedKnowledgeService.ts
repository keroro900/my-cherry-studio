/**
 * 统一知识库服务 - 前端封装
 *
 * 提供统一的知识库搜索 API，支持：
 * - 多源融合搜索 (日记、知识库、笔记)
 * - RRF 结果融合
 * - TagMemo 标签增强
 * - 检索模式智能规划
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('UnifiedKnowledgeService')

// ==================== 类型定义 ====================

export type DataSourceType = 'knowledge' | 'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'notes'
export type RetrievalMode = 'fulltext' | 'rag' | 'threshold_fulltext' | 'threshold_rag'
export type TimeRange = 'all' | 'today' | 'week' | 'month' | 'year'

export interface UnifiedSearchOptions {
  /** 搜索的数据源，默认 ['knowledge', 'diary'] */
  sources?: DataSourceType[]
  /** 检索模式，默认 'rag' */
  mode?: RetrievalMode
  /** 返回结果数量，默认 10 */
  topK?: number
  /** 最低分数阈值，默认 0.1 */
  threshold?: number
  /** TagMemo 增强系数 (0-1)，默认 0.5 */
  tagBoost?: number
  /** 是否启用 TagMemo，默认 true */
  tagMemoEnabled?: boolean
  /** 时间范围过滤 */
  timeRange?: TimeRange
  /** 是否使用 RRF 融合，默认 true */
  useRRF?: boolean
  /** RRF k 参数，默认 60 */
  rrfK?: number
  /** 是否使用 Reranker */
  useReranker?: boolean
  /** 角色/Agent 名称过滤 */
  characterName?: string
  /** 标签过滤 */
  tags?: string[]
  /** 知识库 ID 过滤 */
  knowledgeBaseId?: string
}

export interface UnifiedSearchResult {
  /** 内容文本 */
  pageContent: string
  /** 相关性分数 */
  score: number
  /** 唯一标识 */
  uniqueId?: string
  /** 数据源类型 */
  source: DataSourceType
  /** 元数据 */
  metadata: {
    title?: string
    path?: string
    date?: string
    tags?: string[]
    knowledgeBaseId?: string
    diaryName?: string
    characterName?: string
    isPublic?: boolean
    uniqueId?: string
  }
  /** TagMemo 增强信息 */
  tagMemoResult?: {
    originalScore: number
    boostedScore: number
    matchedTags: string[]
    expansionTags?: string[]
    boostFactor: number
    tagMatchScore: number
  }
}

export interface QueryAnalysis {
  keywords: string[]
  tags: string[]
  isTimeRelated: boolean
  timeReference?: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'specific'
  isQuestion: boolean
  intent?: 'search' | 'recall' | 'summary' | 'comparison'
}

export interface RetrievalPlan {
  sources: DataSourceType[]
  sourceTopK: Record<DataSourceType, number>
  mode: RetrievalMode
  useTagMemo: boolean
  useRRF: boolean
  useReranker: boolean
  timeFilter?: { start: Date; end: Date }
  queryAnalysis?: QueryAnalysis
}

export interface BackendStats {
  documentCount: number
  indexSize?: number
  lastUpdated?: Date
  healthy: boolean
}

// ==================== 服务函数 ====================

/**
 * 统一搜索 - 跨多源融合搜索
 */
export async function unifiedSearch(query: string, options?: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
  try {
    logger.debug('Unified search', { query: query.slice(0, 50), options })

    const result = await window.api.unifiedKnowledge.search({
      query,
      options
    })

    logger.debug('Unified search completed', {
      query: query.slice(0, 50),
      resultCount: result?.length ?? 0
    })

    return result ?? []
  } catch (error) {
    logger.error('Unified search failed', error as Error)
    return []
  }
}

/**
 * 分析查询意图
 */
export async function analyzeQuery(query: string): Promise<QueryAnalysis | null> {
  try {
    const result = await window.api.unifiedKnowledge.analyzeQuery({ query })
    return result ?? null
  } catch (error) {
    logger.error('Query analysis failed', error as Error)
    return null
  }
}

/**
 * 生成检索计划
 */
export async function generateRetrievalPlan(
  query: string,
  options?: UnifiedSearchOptions
): Promise<RetrievalPlan | null> {
  try {
    const result = await window.api.unifiedKnowledge.plan({
      query,
      options: options as Record<string, unknown>
    })
    return result ?? null
  } catch (error) {
    logger.error('Retrieval plan generation failed', error as Error)
    return null
  }
}

/**
 * 获取可用的数据源列表
 */
export async function getAvailableBackends(): Promise<DataSourceType[]> {
  try {
    const result = await window.api.unifiedKnowledge.getBackends()
    return result ?? []
  } catch (error) {
    logger.error('Get backends failed', error as Error)
    return []
  }
}

/**
 * 获取后端统计信息
 */
export async function getBackendStats(): Promise<Record<DataSourceType, BackendStats> | null> {
  try {
    const result = await window.api.unifiedKnowledge.getStats()
    return result ?? null
  } catch (error) {
    logger.error('Get stats failed', error as Error)
    return null
  }
}

/**
 * 初始化统一知识库服务
 */
export async function initializeUnifiedKnowledge(): Promise<boolean> {
  try {
    const result = await window.api.unifiedKnowledge.initialize()
    return result?.success ?? false
  } catch (error) {
    logger.error('Initialize failed', error as Error)
    return false
  }
}

/**
 * 获取相关标签
 */
export async function getRelatedTags(
  tag: string,
  limit = 10
): Promise<Array<{ tag1: string; tag2: string; weight: number }>> {
  try {
    const result = await window.api.unifiedKnowledge.tagMemo.getRelatedTags({ tag, limit })
    return result ?? []
  } catch (error) {
    logger.error('Get related tags failed', error as Error)
    return []
  }
}

/**
 * 应用 TagMemo 增强
 */
export async function applyTagBoost<T extends { score: number }>(
  query: string,
  tags: string[],
  results: T[]
): Promise<T[]> {
  try {
    const boostedResults = await window.api.unifiedKnowledge.tagMemo.boost({
      query,
      tags,
      results
    })
    return (boostedResults as T[]) ?? results
  } catch (error) {
    logger.error('Tag boost failed', error as Error)
    return results
  }
}

// ==================== 便捷函数 ====================

/**
 * 搜索日记
 */
export async function searchDiary(
  query: string,
  options?: {
    characterName?: string
    tags?: string[]
    timeRange?: TimeRange
    topK?: number
  }
): Promise<UnifiedSearchResult[]> {
  return unifiedSearch(query, {
    sources: ['diary'],
    ...options
  })
}

/**
 * 搜索知识库
 */
export async function searchKnowledge(
  query: string,
  knowledgeBaseId?: string,
  options?: {
    topK?: number
    threshold?: number
  }
): Promise<UnifiedSearchResult[]> {
  return unifiedSearch(query, {
    sources: ['knowledge'],
    knowledgeBaseId,
    ...options
  })
}

/**
 * 全源搜索
 */
export async function searchAll(
  query: string,
  options?: {
    topK?: number
    threshold?: number
    useRRF?: boolean
    tagBoost?: number
  }
): Promise<UnifiedSearchResult[]> {
  return unifiedSearch(query, {
    sources: ['knowledge', 'diary', 'lightmemo', 'deepmemo', 'meshmemo'],
    useRRF: true,
    tagMemoEnabled: true,
    ...options
  })
}

// ==================== 导出 ====================

export default {
  search: unifiedSearch,
  searchDiary,
  searchKnowledge,
  searchAll,
  analyzeQuery,
  generateRetrievalPlan,
  getAvailableBackends,
  getBackendStats,
  initialize: initializeUnifiedKnowledge,
  getRelatedTags,
  applyTagBoost
}
