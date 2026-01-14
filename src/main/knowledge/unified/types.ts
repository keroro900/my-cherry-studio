/**
 * 统一知识库类型定义
 *
 * 定义跨多个数据源的统一搜索接口和结果类型
 */

import type { KnowledgeSearchResult } from '@types'

// ==================== 搜索选项 ====================

/**
 * 检索模式
 * - fulltext: 全文检索，返回完整文档
 * - rag: RAG 片段检索，返回相关片段
 * - threshold_fulltext: 阈值全文检索
 * - threshold_rag: 阈值 RAG 检索
 */
export type RetrievalMode = 'fulltext' | 'rag' | 'threshold_fulltext' | 'threshold_rag'

/**
 * 数据源类型
 */
export type DataSourceType = 'knowledge' | 'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'notes'

/**
 * 统一搜索选项
 */
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
  timeRange?: 'all' | 'today' | 'week' | 'month' | 'year'

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

// ==================== 搜索结果 ====================

/**
 * 统一搜索结果
 */
export interface UnifiedSearchResult extends KnowledgeSearchResult {
  /** 结果唯一标识 */
  uniqueId?: string

  /** 数据源类型 */
  source: DataSourceType

  /** 元数据 */
  metadata: UnifiedResultMetadata

  /** TagMemo 增强信息 */
  tagMemoResult?: TagMemoBoostInfo
}

/**
 * 结果元数据
 */
export interface UnifiedResultMetadata {
  /** 索引签名 - 允许任意额外字段 */
  [key: string]: unknown

  /** 标题 */
  title?: string

  /** 文件路径 */
  path?: string

  /** 日期 */
  date?: string

  /** 标签列表 */
  tags?: string[]

  /** 知识库 ID */
  knowledgeBaseId?: string

  /** 日记本名称 */
  diaryName?: string

  /** 角色名称 */
  characterName?: string

  /** 是否公共 */
  isPublic?: boolean

  /** 原始 uniqueId */
  uniqueId?: string

  /** 文件路径 (兼容) */
  filePath?: string
}

/**
 * TagMemo 增强信息
 */
export interface TagMemoBoostInfo {
  /** 原始分数 */
  originalScore: number

  /** 增强后分数 */
  boostedScore: number

  /** 直接匹配的标签 */
  matchedTags: string[]

  /** 扩展匹配的标签 */
  expansionTags?: string[]

  /** 增强因子 */
  boostFactor: number

  /** 标签匹配得分 */
  tagMatchScore: number
}

// ==================== RRF 融合 ====================

/**
 * RRF 融合配置
 */
export interface RRFFusionConfig {
  /** k 参数，控制排名位置的影响，默认 60 */
  k?: number

  /** 每个源的权重 */
  sourceWeights?: Partial<Record<DataSourceType, number>>

  /** 是否去重 */
  deduplicate?: boolean

  /** 去重使用的字段 */
  deduplicateField?: 'content' | 'uniqueId'
}

/**
 * RRF 融合输入
 */
export interface RRFFusionInput {
  source: DataSourceType
  results: UnifiedSearchResult[]
}

// ==================== 检索规划 ====================

/**
 * 检索计划
 */
export interface RetrievalPlan {
  /** 使用的数据源 */
  sources: DataSourceType[]

  /** 每个源的 topK */
  sourceTopK: Record<DataSourceType, number>

  /** 检索模式 */
  mode: RetrievalMode

  /** 是否使用 TagMemo */
  useTagMemo: boolean

  /** 是否使用 RRF */
  useRRF: boolean

  /** 是否使用 Reranker */
  useReranker: boolean

  /** 时间过滤器 */
  timeFilter?: {
    start: Date
    end: Date
  }

  /** 查询分析结果 */
  queryAnalysis?: QueryAnalysis
}

/**
 * 查询分析结果
 */
export interface QueryAnalysis {
  /** 提取的关键词 */
  keywords: string[]

  /** 提取的标签 */
  tags: string[]

  /** 是否时间相关 */
  isTimeRelated: boolean

  /** 时间引用 */
  timeReference?: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'specific'

  /** 是否问题类查询 */
  isQuestion: boolean

  /** 查询意图 */
  intent?: 'search' | 'recall' | 'summary' | 'comparison'
}

// ==================== 服务接口 ====================

/**
 * 知识后端接口
 */
export interface KnowledgeBackend {
  /** 后端名称 */
  readonly name: DataSourceType

  /** 搜索 */
  search(query: string, topK: number, options?: Record<string, unknown>): Promise<UnifiedSearchResult[]>

  /** 是否可用 */
  isAvailable(): Promise<boolean>

  /** 获取统计信息 */
  getStats(): Promise<BackendStats>
}

/**
 * 后端统计信息
 */
export interface BackendStats {
  /** 文档/条目数量 */
  documentCount: number

  /** 索引大小 (bytes) */
  indexSize?: number

  /** 最后更新时间 */
  lastUpdated?: Date

  /** 是否健康 */
  healthy: boolean
}

// ==================== 日记特定类型 ====================

/**
 * 日记搜索选项
 */
export interface DiarySearchOptions {
  /** 角色名称 */
  characterName?: string

  /** 日期范围 */
  dateRange?: {
    start: string // YYYY-MM-DD
    end: string
  }

  /** 标签过滤 */
  tags?: string[]

  /** 是否仅公共 */
  publicOnly?: boolean

  /** 排序方式 */
  sortBy?: 'date' | 'relevance'
}

// ==================== 配置类型 ====================

/**
 * 统一知识库服务配置
 */
export interface UnifiedKnowledgeConfig {
  /** TagMemo 配置 */
  tagMemo?: {
    enabled?: boolean
    defaultBoost?: number
  }

  /** RRF 配置 */
  rrf?: RRFFusionConfig

  /** 默认搜索选项 */
  defaultSearchOptions?: Partial<UnifiedSearchOptions>

  /** 启用的后端 */
  enabledBackends?: DataSourceType[]
}

// ==================== 事件类型 ====================

/**
 * 搜索事件
 */
export interface SearchEvent {
  type: 'search_start' | 'search_complete' | 'search_error'
  query: string
  options: UnifiedSearchOptions
  results?: UnifiedSearchResult[]
  error?: Error
  duration?: number
}

/**
 * 后端事件
 */
export interface BackendEvent {
  type: 'backend_ready' | 'backend_error' | 'backend_updated'
  backend: DataSourceType
  error?: Error
}
