/**
 * IntegratedMemoryCoordinator - 统一记忆协调器
 *
 * 基于 VCPToolBox 概念设计的完整记忆生命周期管理：
 * - 整合多后端搜索、MemoryMasterService、SelfLearningService
 * - 提供记忆创建、搜索、反馈、整理的统一入口
 * - 实现自动补标、学习权重应用、语义关联发现
 * - 集成 DiaryModeParser 支持四种日记调用模式
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { mcpBridge } from '@main/mcpServers/shared/MCPBridge'
import type { UnifiedStorageCore } from '@main/storage/UnifiedStorageCore'

import { diaryModeParser, type RetrievalConfig } from '../../knowledge/modes'
import { getSelfLearningService, type SelfLearningService } from '../../knowledge/tagmemo/SelfLearningService'
import { type VCPSearchResult as VCPServiceSearchResult, vcpSearchService } from '../../knowledge/vcp/VCPSearchService'
import {
  type BackendStatus,
  type CreatedMemoryEntry,
  type MemoryBackendType,
  type UnifiedMemoryStats,
  type UnifiedSearchOptions,
  type UnifiedSearchResult
} from '../../memory/types'
import { type SearchResult as RRFSearchResult,weightedRRFFuse, type WeightedSource } from '../../memory/utils/RRFUtils'
import { hasTimeExpression, parseTimeExpressions } from '../../utils/TimeExpressionParser'
import type { MemoryService, SearchResult } from '../memory/MemoryService'
import type { UnifiedKnowledgeAdapter, VCPSearchResult as NativeVCPSearchResult } from '../NativeKnowledgeService'
import { getToolCallTracer, type ToolCallTracer } from '../vcp/ToolCallTracer'
import { getMemoryMasterService, type MemoryMasterService, type OrganizeResult } from './MemoryMasterService'
import { getAdvancedMemoryServices } from './MemoryServiceFactory'
import { getRerankerService, type RerankerService } from './RerankerService'
import {
  getNativeSemanticGroupService,
  type NativeSemanticGroupService
} from './SemanticGroupService'

const logger = loggerService.withContext('IntegratedMemoryCoordinator')

// ==================== 类型定义 ====================

// CreatedMemoryEntry 和 MemoryBackendType 已移至 @main/memory/types
// 请从 '@main/memory/types' 或 '../../memory/types' 导入

// 重导出以保持向后兼容
export type { CreatedMemoryEntry, MemoryBackendType }

/**
 * 增强的搜索结果 (含学习信息)
 */
export interface EnhancedSearchResult extends UnifiedSearchResult {
  /** 学习增强信息 */
  learning?: {
    /** 应用的学习权重 */
    appliedWeight: number
    /** 原始分数 (未加权) */
    rawScore: number
    /** 匹配的学习标签 */
    matchedLearningTags: string[]
    /** 用户历史选择次数 */
    userSelectionCount: number
  }
}

/**
 * 学习统计
 */
export interface LearningStats {
  totalTags: number
  totalQueries: number
  totalFeedback: number
  pendingSuggestions: number
  topTags: Array<{ tag: string; weight: number; queryCount: number }>
}

/**
 * 标签池统计
 */
export interface TagPoolStats {
  totalTags: number
  topTags: string[]
  recentTags: string[]
}

/**
 * 语义关联建议
 */
export interface SemanticSuggestion {
  sourceTag: string
  suggestedTag: string
  confidence: number
  discoveredAt: number
  confirmed: boolean
}

/**
 * 统一记忆配置
 */
export interface IntegratedMemoryConfig {
  /** MemoryMaster 配置 */
  memoryMaster: {
    enabled: boolean
    autoTagOnCreate: boolean
    defaultModelId?: string
    defaultProviderId?: string
    maxTags: number
  }

  /** SelfLearning 配置 */
  selfLearning: {
    enabled: boolean
    recordQueries: boolean
    applyWeights: boolean
    decayHalfLifeDays: number
    feedbackGain: number
    feedbackDecay: number
  }

  /** 搜索配置 */
  search: {
    defaultBackends: MemoryBackendType[]
    useRRF: boolean
    rrfK: number
    defaultTopK: number
    minThreshold: number
  }

  /** 自动确认配置 */
  autoConfirm?: {
    /** 是否启用自动确认 */
    enabled: boolean
    /** 自动确认的置信度阈值 (建议 0.9) */
    confidenceThreshold: number
    /** 每次运行最多自动确认数量 */
    maxAutoConfirmPerRun: number
  }
}

/**
 * 创建记忆参数
 */
export interface CreateMemoryParams {
  content: string
  title?: string
  backend?: 'diary' | 'memory' | 'notes'
  tags?: string[]
  autoTag?: boolean
  modelId?: string
  providerId?: string
  metadata?: Record<string, unknown>
}

/**
 * 智能搜索参数
 */
export interface IntelligentSearchOptions extends UnifiedSearchOptions {
  applyLearning?: boolean
  recordQuery?: boolean
  /** VCPToolBox 兼容: 显式指定 tag_boost 值 */
  tagBoost?: number
  /** VCPToolBox 兼容: 元数据过滤 (如 maid) */
  metadata?: Record<string, unknown>
  /** VCPToolBox 兼容: 是否启用语义组查询扩展 */
  expandQuery?: boolean
  /** 是否自动解析时间表达式 */
  parseTimeExpressions?: boolean
  /** 时间范围过滤 (可由 TimeParser 自动生成或手动指定) */
  timeRange?: { start: Date; end: Date }
  /** 角色名称过滤 (日记专用) */
  characterName?: string
  /** 时间表达式 (日记专用, 会自动解析) */
  timeExpression?: string
  /** 是否启用 WaveRAG 多阶段搜索 */
  useWaveRAG?: boolean
  /** 是否启用 TagMemo 标签共现扩展 */
  useTagMemo?: boolean
  /** 是否启用 LLM 重排序 (::Rerank 修饰符) */
  useRerank?: boolean
  /** 重排序配置 */
  rerankConfig?: {
    modelId?: string
    providerId?: string
    maxDocuments?: number
  }
  /** 是否启用语义组扩展 (::Group 修饰符) */
  useGroup?: boolean
  /** 指定的语义组名列表 (用于 ::Group(a,b,c) 语法) */
  groupNames?: string[]
}

/**
 * 日记上下文参数
 */
export interface DiaryContextOptions {
  mode: 'full' | 'rag' | 'threshold' | 'threshold_rag'
  query?: string
  characterName?: string
  timeExpression?: string
}

/**
 * 日记上下文结果
 */
export interface DiaryContextResult {
  usedMode: string  // 实际使用的模式 (可能包含派生状态如 'threshold (跳过)', 'truncated', 'recent')
  sourceCount: number
  content: string
}

/**
 * 整理参数
 */
export interface OrganizeOptions {
  backend?: MemoryBackendType
  dateRange?: { start: Date; end: Date }
  tasks: Array<'merge' | 'deduplicate' | 'tag'>
  modelId?: string
  providerId?: string
}

// ==================== IntegratedMemoryCoordinator ====================

export class IntegratedMemoryCoordinator {
  private static instance: IntegratedMemoryCoordinator | null = null

  /** 内部服务引用 */
  private memoryMaster: MemoryMasterService
  private selfLearning: SelfLearningService
  private semanticGroup: NativeSemanticGroupService
  private vcpLog: ToolCallTracer
  private reranker: RerankerService

  /** 后端服务 (懒加载) */
  private _knowledgeService: Awaited<typeof import('../KnowledgeService')>['default'] | null = null
  private _unifiedKnowledgeAdapter: UnifiedKnowledgeAdapter | null = null
  private _memoryService: MemoryService | null = null
  private _unifiedStorage: UnifiedStorageCore | null = null

  /** 配置 */
  private config: IntegratedMemoryConfig = {
    memoryMaster: {
      enabled: true,
      autoTagOnCreate: false, // 默认关闭自动补标，避免意外触发 AI API 调用
      maxTags: 10
    },
    selfLearning: {
      enabled: true,
      recordQueries: true,
      applyWeights: true,
      decayHalfLifeDays: 7,
      feedbackGain: 0.1,
      feedbackDecay: 0.05
    },
    search: {
      defaultBackends: ['diary', 'notes', 'deepmemo', 'lightmemo', 'memory', 'knowledge'],
      useRRF: true,
      rrfK: 60,
      defaultTopK: 10,
      minThreshold: 0.1
    },
    autoConfirm: {
      enabled: true,
      confidenceThreshold: 0.9,
      maxAutoConfirmPerRun: 10
    }
  }

  /** 搜索会话跟踪 (用于反馈关联) */
  private searchSessions: Map<string, { query: string; results: EnhancedSearchResult[]; timestamp: number }> = new Map()

  /** AIMemo 缓存 (移植自 VCPToolBox AIMemoHandler) */
  private aiMemoCache: Map<string, { content: string; timestamp: number }> = new Map()

  /** 搜索结果 LRU 缓存 (Phase 3 性能优化) */
  private searchResultCache: Map<
    string,
    { results: EnhancedSearchResult[]; timestamp: number; hitCount: number }
  > = new Map()
  private readonly searchCacheMaxSize = 100
  private readonly searchCacheTTLMs = 60 * 1000 // 1 分钟

  /** AIMemo 配置 */
  private aiMemoConfig = {
    maxTokensPerBatch: 8000,
    cacheEnabled: true,
    cacheTTLMs: 5 * 60 * 1000 // 5分钟
  }

  private constructor() {
    this.memoryMaster = getMemoryMasterService()
    this.selfLearning = getSelfLearningService()
    this.semanticGroup = getNativeSemanticGroupService()
    this.vcpLog = getToolCallTracer()
    this.reranker = getRerankerService()

    logger.info('IntegratedMemoryCoordinator initialized')
  }

  static getInstance(): IntegratedMemoryCoordinator {
    if (!IntegratedMemoryCoordinator.instance) {
      IntegratedMemoryCoordinator.instance = new IntegratedMemoryCoordinator()
    }
    return IntegratedMemoryCoordinator.instance
  }

  // ==================== 搜索结果缓存管理 ====================

  /**
   * 生成搜索缓存键
   */
  private generateSearchCacheKey(query: string, options: IntelligentSearchOptions): string {
    const normalizedQuery = query.trim().toLowerCase()
    const keyParts = [
      normalizedQuery,
      options.backends?.sort().join(',') || 'default',
      options.topK?.toString() || '10',
      options.useWaveRAG ? 'waverag' : '',
      options.useTagMemo ? 'tagmemo' : '',
      options.threshold?.toString() || '',
      options.timeRange ? `${options.timeRange.start.getTime()}-${options.timeRange.end.getTime()}` : ''
    ]
    return keyParts.filter(Boolean).join(':')
  }

  /**
   * 获取缓存的搜索结果
   */
  private getSearchCache(cacheKey: string): EnhancedSearchResult[] | null {
    const cached = this.searchResultCache.get(cacheKey)
    if (!cached) return null

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.searchCacheTTLMs) {
      this.searchResultCache.delete(cacheKey)
      return null
    }

    // 更新命中计数并移到末尾 (LRU)
    cached.hitCount++
    this.searchResultCache.delete(cacheKey)
    this.searchResultCache.set(cacheKey, cached)

    logger.debug('Search cache hit', { cacheKey, hitCount: cached.hitCount })
    return cached.results
  }

  /**
   * 设置搜索结果缓存
   */
  private setSearchCache(cacheKey: string, results: EnhancedSearchResult[]): void {
    // LRU 淘汰: 如果超过最大容量，删除最旧的条目
    if (this.searchResultCache.size >= this.searchCacheMaxSize) {
      const oldestKey = this.searchResultCache.keys().next().value
      if (oldestKey) {
        this.searchResultCache.delete(oldestKey)
        logger.debug('Search cache evicted', { evictedKey: oldestKey })
      }
    }

    this.searchResultCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
      hitCount: 0
    })
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredSearchCache(): void {
    const now = Date.now()
    let cleaned = 0
    for (const [key, value] of this.searchResultCache.entries()) {
      if (now - value.timestamp > this.searchCacheTTLMs) {
        this.searchResultCache.delete(key)
        cleaned++
      }
    }
    if (cleaned > 0) {
      logger.debug('Expired search cache cleaned', { count: cleaned })
    }
  }

  /**
   * 获取搜索缓存统计
   */
  getSearchCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.searchResultCache.size,
      maxSize: this.searchCacheMaxSize,
      ttlMs: this.searchCacheTTLMs
    }
  }

  /**
   * 清空搜索缓存
   */
  clearSearchCache(): void {
    this.searchResultCache.clear()
    logger.info('Search cache cleared')
  }

  // ==================== 后端服务访问器 ====================

  /**
   * 获取 UnifiedKnowledgeAdapter (VCPToolBox 日记知识库)
   */
  private async getUnifiedKnowledgeAdapter(): Promise<UnifiedKnowledgeAdapter | null> {
    if (!this._unifiedKnowledgeAdapter) {
      try {
        const { getUnifiedKnowledgeAdapter } = await import('../NativeKnowledgeService')
        this._unifiedKnowledgeAdapter = getUnifiedKnowledgeAdapter()
        if (this._unifiedKnowledgeAdapter) {
          await this._unifiedKnowledgeAdapter.initialize()
        }
      } catch (error) {
        logger.warn('Failed to initialize NativeKnowledgeService:', error as Error)
        return null
      }
    }
    return this._unifiedKnowledgeAdapter
  }

  /**
   * 获取 KnowledgeService (通用文档知识库)
   */
  private async getKnowledgeService() {
    if (!this._knowledgeService) {
      const KnowledgeServiceModule = await import('../KnowledgeService')
      this._knowledgeService = KnowledgeServiceModule.default
    }
    return this._knowledgeService
  }

  /**
   * 获取 MemoryService (全局对话记忆 - mem0)
   */
  private async getMemoryService(): Promise<MemoryService | null> {
    if (!this._memoryService) {
      try {
        const { MemoryService: Service } = await import('../memory/MemoryService')
        this._memoryService = Service.getInstance()
      } catch (error) {
        logger.warn('Failed to initialize MemoryService:', error as Error)
        return null
      }
    }
    return this._memoryService
  }

  /**
   * 获取 UnifiedStorageCore (Phase 6 统一存储)
   */
  private async getUnifiedStorage(): Promise<UnifiedStorageCore | null> {
    if (!this._unifiedStorage) {
      try {
        const { getUnifiedStorage } = await import('@main/storage')
        this._unifiedStorage = getUnifiedStorage()
        await this._unifiedStorage.initialize()
      } catch (error) {
        logger.warn('Failed to initialize UnifiedStorageCore:', error as Error)
        return null
      }
    }
    return this._unifiedStorage
  }

  /**
   * 获取高级记忆服务 (LightMemo/DeepMemo/MeshMemo)
   */
  private getAdvancedMemoryServices() {
    return getAdvancedMemoryServices()
  }

  // ==================== 记忆创建 ====================

  /**
   * 创建记忆 (带自动补标)
   */
  async createMemory(params: CreateMemoryParams): Promise<CreatedMemoryEntry> {
    const { content, title, backend = 'diary', tags = [], autoTag = true, modelId, providerId, metadata } = params

    const startTime = Date.now()
    let finalTags = [...tags]

    // 自动补标
    if (autoTag && this.config.memoryMaster.enabled && this.config.memoryMaster.autoTagOnCreate) {
      try {
        const suggestedTags = await this.memoryMaster.autoTag(content, {
          existingTags: tags,
          maxTags: this.config.memoryMaster.maxTags,
          modelId: modelId || this.config.memoryMaster.defaultModelId,
          providerId: providerId || this.config.memoryMaster.defaultProviderId
        })

        // 合并标签 (去重)
        finalTags = [...new Set([...tags, ...suggestedTags])]
        logger.debug('Auto-tagged memory', { originalTags: tags.length, suggestedTags: suggestedTags.length })
      } catch (error) {
        logger.warn('Auto-tagging failed, using original tags', error as Error)
      }
    }

    // 更新标签池
    if (this.config.selfLearning.enabled && finalTags.length > 0) {
      this.memoryMaster.addTagsToPool(finalTags)
    }

    // 根据后端存储
    const id = crypto.randomUUID()
    const entry: CreatedMemoryEntry = {
      id,
      content,
      title,
      tags: finalTags,
      backend,
      createdAt: new Date(),
      metadata
    }

    // 存储到对应后端
    try {
      switch (backend) {
        case 'memory': {
          const { MemoryService } = await import('./MemoryService')
          const memoryService = MemoryService.getInstance()
          await memoryService.add(content, {
            userId: (metadata?.userId as string) || 'default',
            metadata: { ...metadata, tags: finalTags, title }
          })
          break
        }
        case 'notes': {
          const { getNoteService } = await import('../notes')
          const noteService = getNoteService()
          const date = new Date().toISOString().split('T')[0]
          const safeTitle = (title || '记忆').replace(/[<>:"/\\|?*]/g, '_')
          const fileName = `${date}-${safeTitle}.md`
          await noteService.write(fileName, content, {
            title: title || `记忆 ${date}`,
            tags: finalTags,
            ...metadata
          })
          break
        }
        case 'diary':
        default: {
          // 日记通过 DailyNoteWritePlugin 统一入口写入
          // 确保自动补标、标签校验、文件路径组织等功能
          const { getDailyNoteWritePlugin } = await import('../notes/DailyNoteWritePlugin')
          const plugin = getDailyNoteWritePlugin()
          const result = await plugin.agentWrite({
            content,
            title,
            tags: finalTags,
            characterName: metadata?.characterName as string | undefined,
            metadata,
            skipAutoTag: !autoTag, // 已在上面处理过自动补标，这里根据参数决定
            modelId,
            providerId,
            syncToKnowledge: false // 关键！避免循环调用：createMemory → agentWrite → syncToKnowledge → createMemory
          })
          if (!result.success) {
            throw new Error(result.error || '日记写入失败')
          }
          // 更新 entry ID 为实际写入的笔记 ID
          if (result.note) {
            entry.id = result.note.id
          }
          break
        }
      }
    } catch (error) {
      logger.error('Failed to store memory', error as Error)
      throw error
    }

    logger.info('Memory created', {
      id,
      backend,
      tagCount: finalTags.length,
      durationMs: Date.now() - startTime
    })

    return entry
  }

  /**
   * 批量创建记忆
   */
  async batchCreateMemories(
    entries: Array<{ content: string; title?: string; tags?: string[] }>,
    options?: { autoTag?: boolean; backend?: 'diary' | 'memory' | 'notes'; modelId?: string; providerId?: string }
  ): Promise<CreatedMemoryEntry[]> {
    const results: CreatedMemoryEntry[] = []

    for (const entry of entries) {
      try {
        const result = await this.createMemory({
          ...entry,
          backend: options?.backend,
          autoTag: options?.autoTag,
          modelId: options?.modelId,
          providerId: options?.providerId
        })
        results.push(result)
      } catch (error) {
        logger.warn('Failed to create memory in batch', error as Error)
      }
    }

    return results
  }

  // ==================== 记忆搜索 (带学习增强) ====================

  /**
   * 智能搜索 (自动应用学习权重)
   * VCPToolBox 兼容: 支持显式 tagBoost 和 metadata 过滤
   */
  async intelligentSearch(query: string, options?: IntelligentSearchOptions): Promise<EnhancedSearchResult[]> {
    const {
      applyLearning = true,
      recordQuery = true,
      backends,
      topK,
      threshold,
      tagBoost: explicitTagBoost,
      metadata,
      expandQuery = false,
      parseTimeExpressions: shouldParseTime = true,
      timeRange: explicitTimeRange,
      useWaveRAG = false,
      useTagMemo = true,
      useRerank: explicitUseRerank,
      rerankConfig: explicitRerankConfig,
      useGroup = false,
      groupNames,
      ...restOptions
    } = options || {}

    // 自动从 UnifiedModelConfigService 获取 rerank 配置（如果未显式传入）
    let useRerank = explicitUseRerank ?? false
    let rerankConfig = explicitRerankConfig

    if (!explicitRerankConfig) {
      try {
        const { getUnifiedModelConfigService } = await import('../config/UnifiedModelConfigService')
        const modelConfigService = getUnifiedModelConfigService()
        const effectiveRerankConfig = modelConfigService.getEffectiveRerankConfig('memory')

        if (effectiveRerankConfig) {
          // 如果配置了 rerank 模型，自动启用（除非显式禁用）
          if (explicitUseRerank !== false) {
            useRerank = true
          }
          rerankConfig = {
            modelId: effectiveRerankConfig.model.id,
            providerId: effectiveRerankConfig.provider.id,
            maxDocuments: effectiveRerankConfig.topN ?? 20
          }
          logger.debug('Auto-loaded rerank config from UnifiedModelConfigService', {
            modelId: rerankConfig.modelId,
            providerId: rerankConfig.providerId,
            useRerank
          })
        }
      } catch (error) {
        logger.debug('UnifiedModelConfigService not available, skipping auto rerank config')
      }
    }

    // 检查缓存 (仅对非记录查询启用，避免影响学习)
    const cacheKey = this.generateSearchCacheKey(query, options || {})
    if (!recordQuery) {
      // 清理过期缓存
      this.cleanExpiredSearchCache()

      const cachedResults = this.getSearchCache(cacheKey)
      if (cachedResults) {
        logger.debug('Returning cached search results', { query: query.slice(0, 50), cacheKey })
        return cachedResults
      }
    }

    const startTime = Date.now()
    const chainId = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // 发送 RETRIEVAL_CHAIN 事件 - 开始
    let vcpInfoService: any = null
    try {
      const { getVCPInfoService } = await import('../vcp/VCPInfoService')
      vcpInfoService = getVCPInfoService()

      vcpInfoService.broadcastEvent({
        type: 'RETRIEVAL_CHAIN',
        traceId: chainId,
        chainId,
        stages: [],
        totalDurationMs: 0,
        timestamp: Date.now()
      })
    } catch (error) {
      logger.warn('Failed to initialize VCPInfoService for chain tracking', error as Error)
    }

    const chainStages: Array<{
      stageName: string
      status: 'pending' | 'running' | 'completed' | 'skipped' | 'error'
      durationMs?: number
      inputCount?: number
      outputCount?: number
      details?: Record<string, unknown>
    }> = []

    const updateChainStage = (stageName: string, status: 'running' | 'completed' | 'skipped' | 'error', details?: Record<string, unknown>) => {
      const stage = chainStages.find((s) => s.stageName === stageName)
      if (stage) {
        stage.status = status
        if (details) stage.details = details
        if (status === 'completed' || status === 'error') {
          const endTime = Date.now()
          stage.durationMs = endTime - (stage.durationMs || endTime)
        }
      } else {
        chainStages.push({
          stageName,
          status,
          durationMs: status === 'running' ? Date.now() : undefined,
          ...details
        })
      }

      // 实时更新链事件
      if (vcpInfoService) {
        vcpInfoService.broadcastEvent({
          type: 'RETRIEVAL_CHAIN',
          traceId: chainId,
          chainId,
          stages: [...chainStages],
          totalDurationMs: Date.now() - startTime,
          timestamp: Date.now()
        })
      }
    }

    // VCP 日志: 开始 RAG 搜索
    const traceId = this.vcpLog.startTrace({ source: 'IntegratedMemoryCoordinator' })
    const callId = this.vcpLog.startCall({
      traceId,
      toolName: 'RAG_Search',
      toolType: 'builtin',
      params: {
        query: query.slice(0, 100),
        backends: backends || this.config.search.defaultBackends,
        topK: topK || this.config.search.defaultTopK,
        expandQuery,
        parseTimeExpressions: shouldParseTime
      }
    })

    try {
      // 阶段 1: 解析 (Parse)
      updateChainStage('parse', 'running', { inputQuery: query })
      const parseStartTime = Date.now()

      // 时间表达式解析
      let timeRange = explicitTimeRange
      if (shouldParseTime && !explicitTimeRange && hasTimeExpression(query)) {
        try {
          const timeRanges = parseTimeExpressions(query)
          if (timeRanges.length > 0) {
            // 使用第一个解析出的时间范围
            timeRange = {
              start: timeRanges[0].start,
              end: timeRanges[0].end
            }
            logger.debug('Time expression parsed for search', {
              query,
              timeRange: {
                start: timeRange.start.toISOString(),
                end: timeRange.end.toISOString()
              }
            })
          }
        } catch (error) {
          logger.warn('Time expression parsing failed', error as Error)
        }
      }

      // 提取查询中的标签关键词
      let extractedTags = this.extractTagsFromQuery(query)

      updateChainStage('parse', 'completed', {
        durationMs: Date.now() - parseStartTime,
        extractedTags: extractedTags.length,
        hasTimeRange: !!timeRange
      })

      // 阶段 2: 扩展 (Expand)
      let expandedQuery = query
      if (expandQuery || useGroup) {
        updateChainStage('expand', 'running', {
          originalTags: extractedTags.length,
          useGroup,
          groupNames: groupNames?.length || 0
        })
        const expandStartTime = Date.now()
        let addedTokens: string[] = []

        // ::Group 显式组扩展
        if (useGroup && groupNames && groupNames.length > 0) {
          const groupExpandedTokens = this.semanticGroup.expandBySpecificGroups(extractedTags, groupNames)
          if (groupExpandedTokens.length > 0) {
            addedTokens = [...addedTokens, ...groupExpandedTokens]
            logger.debug('Query expanded with explicit groups', {
              groupNames,
              addedTokens: groupExpandedTokens.length
            })
          }
        }

        // VCPToolBox 兼容: 语义组查询扩展 (自动检测)
        if (expandQuery) {
          const autoExpandedTokens = this.semanticGroup.expandQueryTokens(extractedTags)
          // 避免重复添加
          const uniqueAutoTokens = autoExpandedTokens.filter(
            t => !addedTokens.some(a => a.toLowerCase() === t.toLowerCase())
          )
          if (uniqueAutoTokens.length > 0) {
            addedTokens = [...addedTokens, ...uniqueAutoTokens]
            logger.debug('Query expanded with auto-detected groups', {
              addedTokens: uniqueAutoTokens.length
            })
          }
        }

        // 应用扩展
        if (addedTokens.length > 0) {
          expandedQuery = `${query} ${addedTokens.join(' ')}`
          extractedTags = [...extractedTags, ...addedTokens]
          logger.debug('Query expansion complete', {
            original: query,
            expanded: expandedQuery,
            totalAddedTokens: addedTokens.length
          })
        }

        updateChainStage('expand', 'completed', {
          durationMs: Date.now() - expandStartTime,
          inputCount: extractedTags.length - addedTokens.length,
          outputCount: extractedTags.length,
          addedTokens: addedTokens.length,
          useGroup,
          groupNames: groupNames?.length || 0
        })
      } else {
        updateChainStage('expand', 'skipped')
      }

      // 阶段 3: 学习权重获取 (Learning)
      // 提前声明 tagBoost 和 tagWeights，确保在后续阶段可用
      let finalTagBoost = explicitTagBoost ?? 0.5
      const finalTagWeights: Map<string, number> = new Map()

      if (applyLearning && this.config.selfLearning.enabled) {
        updateChainStage('learning', 'running')
        const learningStartTime = Date.now()

        // 记录查询
        if (recordQuery && this.config.selfLearning.recordQueries) {
          this.selfLearning.recordQuery(extractedTags, 'search')
        }

        // 获取学习权重
        if (this.config.selfLearning.applyWeights) {
          for (const tag of extractedTags) {
            const weight = this.selfLearning.getLearnedWeight(tag)
            finalTagWeights.set(tag.toLowerCase(), weight)
          }

          // 如果没有显式指定 tagBoost，则根据学习权重计算
          if (explicitTagBoost === undefined && finalTagWeights.size > 0) {
            const avgWeight = Array.from(finalTagWeights.values()).reduce((a, b) => a + b, 0) / finalTagWeights.size
            finalTagBoost = Math.min(1.0, Math.max(0.1, avgWeight * 0.5))
          }
        }

        updateChainStage('learning', 'completed', {
          durationMs: Date.now() - learningStartTime,
          tagWeights: finalTagWeights.size,
          tagBoost: finalTagBoost
        })
      } else {
        updateChainStage('learning', 'skipped')
      }

      // 执行搜索
      const searchOptions: UnifiedSearchOptions = {
        backends: backends || this.config.search.defaultBackends,
        topK: topK || this.config.search.defaultTopK,
        threshold: threshold || this.config.search.minThreshold,
        useRRF: this.config.search.useRRF,
        rrfK: this.config.search.rrfK,
        tagBoost: finalTagBoost,
        timeRange, // 传递解析后的时间范围
        ...restOptions
      }

      // 阶段 4: 搜索 (Search)
      updateChainStage('search', 'running', {
        backends: searchOptions.backends,
        topK: searchOptions.topK,
        useWaveRAG
      })
      const searchStartTime = Date.now()

      let results: UnifiedSearchResult[]

      // WaveRAG 三阶段检索 (启用时)
      if (useWaveRAG) {
        try {
          const { createWaveRAGEngine, waveragOps, isNativeModuleAvailable } = await import('../native')

          if (isNativeModuleAvailable()) {
            // 创建 WaveRAG 引擎
            const waveragEngine = createWaveRAGEngine({
              lensMaxTags: 10,
              expansionDepth: 2,
              expansionThreshold: 0.3,
              expansionMaxTags: 20,
              focusTopK: searchOptions.topK,
              focusScoreThreshold: searchOptions.threshold,
              tagMemoWeight: useTagMemo ? 0.65 : 0,
              bm25Weight: 0.5,
              vectorWeight: 0.5
            })

            // 先执行基础搜索获取 BM25 和向量结果
            const baseResults = await this._search(expandedQuery, {
              ...searchOptions,
              topK: (searchOptions.topK || 10) * 2 // 获取更多候选
            })

            // 转换为 SearchResultItem 格式
            const bm25Results = baseResults
              .filter((r) => r.backend !== 'diary')
              .map((r) => ({
                id: r.id,
                content: r.content,
                metadata: r.metadata ? JSON.stringify(r.metadata) : undefined,
                score: r.score
              }))

            const vectorResults = baseResults
              .filter((r) => r.backend === 'diary' || r.backend === 'memory')
              .map((r) => ({
                id: r.id,
                content: r.content,
                metadata: r.metadata ? JSON.stringify(r.metadata) : undefined,
                score: r.score
              }))

            // 执行三阶段检索
            const waveragResult = waveragOps.search(
              waveragEngine,
              extractedTags,
              bm25Results,
              vectorResults
            )

            logger.info('WaveRAG search completed', {
              traceId: waveragResult.traceId,
              lensPhase: waveragResult.lensPhase,
              expansionPhase: waveragResult.expansionPhase,
              focusPhase: waveragResult.focusPhase,
              totalDurationMs: waveragResult.totalDurationMs
            })

            // 发送 WAVERAG_SEARCH 事件到 RAGObserverPanel
            try {
              const { getVCPInfoService } = await import('../vcp/VCPInfoService')
              const vcpInfoService = getVCPInfoService()

              // 提取标签信息
              const queryTags = extractedTags || []
              const lensTags = waveragResult.lensPhase?.tags || []
              const expandedTags = waveragResult.lensPhase?.expandedTags || []
              const allTags = waveragResult.expansionPhase?.allTags || expandedTags

              vcpInfoService.broadcastEvent({
                type: 'WAVERAG_SEARCH',
                traceId: waveragResult.traceId || `waverag_${Date.now()}`,
                query: expandedQuery || query,
                queryTags,
                phases: {
                  lens: {
                    tags: lensTags,
                    expandedTags: expandedTags.slice(0, 10), // 限制显示数量
                    durationMs: waveragResult.lensPhase?.durationMs || 0
                  },
                  expansion: {
                    allTags,
                    depthReached: waveragResult.expansionPhase?.depthReached || 0,
                    durationMs: waveragResult.expansionPhase?.durationMs || 0
                  },
                  focus: {
                    resultCount: waveragResult.results?.length || 0,
                    tagBoostApplied: useTagMemo || false,
                    durationMs: waveragResult.focusPhase?.durationMs || 0
                  }
                },
                results: (waveragResult.results || []).map((r) => ({
                  id: r.id || '',
                  content: r.content || '',
                  finalScore: r.finalScore || 0,
                  originalScore: r.originalScore || r.finalScore || 0,
                  tagBoostScore: r.tagBoostScore || 0,
                  matchedTags: r.matchedTags || [],
                  source: r.source || 'unknown'
                })),
                totalDurationMs: waveragResult.totalDurationMs || 0,
                timestamp: Date.now()
              })

              logger.debug('WaveRAG event broadcasted', { traceId: waveragResult.traceId })
            } catch (error) {
              logger.warn('Failed to broadcast WaveRAG event', error as Error)
            }

            // 转换回 UnifiedSearchResult 格式
            results = waveragResult.results.map((r) => ({
              id: r.id,
              content: r.content,
              score: r.finalScore,
              backend: (r.source === 'both' ? 'diary' : r.source) as MemoryBackendType,
              matchedTags: r.matchedTags,
              metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
              tagBoostInfo: {
                boostFactor: r.tagBoostScore / Math.max(0.001, r.originalScore),
                spikeCount: r.matchedTags.length,
                totalSpikeScore: r.tagBoostScore
              }
            }))
          } else {
            // Native 模块不可用，回退到普通搜索
            logger.warn('WaveRAG requested but native module not available, falling back to normal search')
            results = await this._search(expandedQuery, searchOptions)
          }
        } catch (error) {
          logger.error('WaveRAG search failed, falling back to normal search', error as Error)
          results = await this._search(expandedQuery, searchOptions)
        }
      } else {
        // 普通搜索
        results = await this._search(expandedQuery, searchOptions)
      }

      updateChainStage('search', 'completed', {
        durationMs: Date.now() - searchStartTime,
        outputCount: results.length,
        backends: searchOptions.backends
      })

      // 阶段 5: 增强 (Boost/Fuse)
      let boostStartTime: number | undefined
      // 使用已在 learning 阶段计算的 finalTagBoost 和 finalTagWeights

      if (finalTagBoost > 0 || useTagMemo) {
        updateChainStage('boost', 'running', {
          inputCount: results.length,
          tagBoost: finalTagBoost,
          useTagMemo
        })
        boostStartTime = Date.now()
      }

      // 增强结果
      const enhancedResults: EnhancedSearchResult[] = results.map((result) => {
        const matchedTags = result.matchedTags || []
        const matchedLearningTags = matchedTags.filter((tag) => finalTagWeights.has(tag.toLowerCase()))

        // 计算应用的权重
        let appliedWeight = 1.0
        if (matchedLearningTags.length > 0 && finalTagWeights.size > 0) {
          appliedWeight =
            matchedLearningTags.reduce((sum, tag) => sum + (finalTagWeights.get(tag.toLowerCase()) || 1.0), 0) /
            matchedLearningTags.length
        }

        return {
          ...result,
          learning: {
            appliedWeight,
            rawScore: result.score / appliedWeight,
            matchedLearningTags,
            userSelectionCount: this.selfLearning.getResultSelectionCount(result.id)
          }
        }
      })

      if (finalTagBoost > 0 || useTagMemo) {
        updateChainStage('boost', 'completed', {
          durationMs: boostStartTime ? Date.now() - boostStartTime : 0,
          outputCount: enhancedResults.length
        })
      } else {
        updateChainStage('boost', 'skipped')
      }

      // 阶段 6: 时间重排序 (Time Rerank) - 仅当有时间范围时
      let finalResults = enhancedResults
      if (timeRange) {
        updateChainStage('time_rerank', 'running', {
          inputCount: enhancedResults.length,
          timeRange: {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString()
          }
        })
        const timeRerankStartTime = Date.now()

        finalResults = this.applyTimeBasedReranking(enhancedResults, timeRange)

        updateChainStage('time_rerank', 'completed', {
          durationMs: Date.now() - timeRerankStartTime,
          outputCount: finalResults.length
        })

        logger.debug('Time-based reranking applied', {
          inputCount: enhancedResults.length,
          outputCount: finalResults.length,
          timeRange: { start: timeRange.start.toISOString(), end: timeRange.end.toISOString() }
        })
      } else {
        updateChainStage('time_rerank', 'skipped')
      }

      // 阶段 7: LLM 重排序 (Rerank) - 仅当启用时
      if (useRerank && finalResults.length > 1) {
        updateChainStage('llm_rerank', 'running', {
          inputCount: finalResults.length,
          modelId: rerankConfig?.modelId || 'default'
        })
        const rerankStartTime = Date.now()

        try {
          // 调用 LLM 重排序
          const documents = finalResults.map(r => r.content)
          const rerankResults = await this.reranker.rerank(query, documents, {
            modelId: rerankConfig?.modelId,
            providerId: rerankConfig?.providerId,
            maxDocuments: rerankConfig?.maxDocuments || 20,
            timeout: 10000
          })

          // 应用重排序结果
          finalResults = this.reranker.applyRerankResults(finalResults, rerankResults)

          updateChainStage('llm_rerank', 'completed', {
            durationMs: Date.now() - rerankStartTime,
            outputCount: finalResults.length
          })

          logger.debug('LLM reranking applied', {
            inputCount: documents.length,
            outputCount: finalResults.length,
            durationMs: Date.now() - rerankStartTime
          })
        } catch (error) {
          logger.warn('LLM reranking failed, using original order', error as Error)
          updateChainStage('llm_rerank', 'error', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      } else {
        updateChainStage('llm_rerank', 'skipped')
      }

      // 保存搜索会话 (用于反馈)
      const searchId = crypto.randomUUID()
      this.searchSessions.set(searchId, {
        query,
        results: finalResults,
        timestamp: Date.now()
      })

      // 清理旧会话 (保留最近 100 个)
      if (this.searchSessions.size > 100) {
        const oldestKeys = Array.from(this.searchSessions.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)
          .slice(0, this.searchSessions.size - 100)
          .map(([key]) => key)

        for (const key of oldestKeys) {
          this.searchSessions.delete(key)
        }
      }

      const durationMs = Date.now() - startTime

      // 发送最终 RETRIEVAL_CHAIN 事件
      if (vcpInfoService) {
        vcpInfoService.broadcastEvent({
          type: 'RETRIEVAL_CHAIN',
          traceId: chainId,
          chainId,
          stages: chainStages.map((stage) => ({
            ...stage,
            durationMs: stage.status === 'completed' && stage.durationMs ? stage.durationMs : undefined
          })),
          totalDurationMs: durationMs,
          timestamp: Date.now()
        })
      }

      // VCP 日志: 搜索成功
      this.vcpLog.endCallSuccess(callId, {
        resultCount: finalResults.length,
        extractedTags: extractedTags.length,
        durationMs
      })
      this.vcpLog.endTrace(traceId)

      logger.info('Intelligent search completed', {
        query: query.slice(0, 50),
        queryExpanded: expandQuery && expandedQuery !== query,
        resultCount: finalResults.length,
        extractedTags: extractedTags.length,
        timeRangeApplied: !!timeRange,
        avgAppliedWeight:
          finalResults.length > 0
            ? finalResults.reduce((s, r) => s + (r.learning?.appliedWeight || 1), 0) / finalResults.length
            : 1,
        durationMs
      })

      // 缓存结果 (仅对非记录查询启用)
      if (!recordQuery && finalResults.length > 0) {
        this.setSearchCache(cacheKey, finalResults)
      }

      return finalResults
    } catch (error) {
      // VCP 日志: 搜索失败
      this.vcpLog.endCallError(callId, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      this.vcpLog.endTrace(traceId)
      throw error
    }
  }

  /**
   * 获取搜索建议 (基于历史查询和学习)
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    const suggestions: string[] = []

    // 从标签池获取匹配的标签
    const tagPool = this.memoryMaster.getTagPool()
    const matchingTags = tagPool.filter((tag) => tag.toLowerCase().includes(partialQuery.toLowerCase())).slice(0, limit)

    suggestions.push(...matchingTags)

    // 从学习统计获取热门标签
    const stats = this.selfLearning.getStats()
    const topTags = stats.topTags
      .filter((t) => t.tag.toLowerCase().includes(partialQuery.toLowerCase()))
      .map((t) => t.tag)
      .slice(0, limit - suggestions.length)

    suggestions.push(...topTags.filter((t) => !suggestions.includes(t)))

    return suggestions.slice(0, limit)
  }

  // ==================== 反馈学习 ====================

  /**
   * 记录正向反馈
   */
  async recordPositiveFeedback(searchId: string, selectedResultId: string, query: string): Promise<void> {
    if (!this.config.selfLearning.enabled) return

    const session = this.searchSessions.get(searchId)
    const selectedResult = session?.results.find((r) => r.id === selectedResultId)
    const relatedTags = selectedResult?.matchedTags || this.extractTagsFromQuery(query)

    this.selfLearning.recordPositiveFeedback(query, selectedResultId, relatedTags)

    logger.debug('Positive feedback recorded', { searchId, selectedResultId, tagCount: relatedTags.length })
  }

  /**
   * 记录负向反馈
   */
  async recordNegativeFeedback(searchId: string, ignoredResultId: string, query: string): Promise<void> {
    if (!this.config.selfLearning.enabled) return

    const session = this.searchSessions.get(searchId)
    const ignoredResult = session?.results.find((r) => r.id === ignoredResultId)
    const relatedTags = ignoredResult?.matchedTags || this.extractTagsFromQuery(query)

    this.selfLearning.recordNegativeFeedback(query, ignoredResultId, relatedTags)

    logger.debug('Negative feedback recorded', { searchId, ignoredResultId, tagCount: relatedTags.length })
  }

  // ==================== 记忆整理 ====================

  /**
   * 智能整理 (合并 + 去重 + 补标)
   */
  async organizeMemories(options: OrganizeOptions): Promise<OrganizeResult> {
    const { tasks, modelId, providerId } = options

    return this.memoryMaster.batchOrganize([], {
      tasks,
      modelId: modelId || this.config.memoryMaster.defaultModelId,
      providerId: providerId || this.config.memoryMaster.defaultProviderId
    })
  }

  /**
   * 发现并应用语义关联
   */
  async discoverAndApplyAssociations(): Promise<{
    discoveredCount: number
    appliedCount: number
    suggestions: SemanticSuggestion[]
  }> {
    // 1. 发现新的语义关联
    const suggestions = this.selfLearning.discoverSemanticAssociations()

    let appliedCount = 0

    // 2. 自动确认高置信度关联
    if (this.config.autoConfirm?.enabled) {
      const threshold = this.config.autoConfirm.confidenceThreshold ?? 0.9
      const maxConfirm = this.config.autoConfirm.maxAutoConfirmPerRun ?? 10

      // 获取所有待确认的建议 (包括新发现的)
      const pendingSuggestions = this.selfLearning.getPendingSuggestions()

      // 按置信度降序排列，取前 N 个高于阈值的
      const highConfidence = pendingSuggestions
        .filter((s) => s.confidence >= threshold)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxConfirm)

      // 自动确认每个高置信度建议
      for (const suggestion of highConfidence) {
        const confirmed = this.selfLearning.confirmSuggestion(suggestion.sourceTag, suggestion.suggestedTag)
        if (confirmed) {
          appliedCount++
          logger.info('Auto-confirmed semantic association', {
            sourceTag: suggestion.sourceTag,
            suggestedTag: suggestion.suggestedTag,
            confidence: suggestion.confidence.toFixed(3)
          })
        }
      }

      // 已确认的建议会在 confirmSuggestion 方法中自动同步到共现矩阵
      if (appliedCount > 0) {
        logger.info('Auto-confirmed semantic associations', { appliedCount })
      }
    }

    return {
      discoveredCount: suggestions.length,
      appliedCount,
      suggestions
    }
  }

  // ==================== 统计和状态 ====================

  /**
   * 获取综合统计
   */
  async getIntegratedStats(): Promise<{
    memoryStats: UnifiedMemoryStats
    learningStats: LearningStats
    tagPoolStats: TagPoolStats
  }> {
    const memoryStats = await this._getStats()
    const learningStats = this.selfLearning.getStats()
    const tagPool = this.memoryMaster.getTagPool()
    const tagStats = this.memoryMaster.getTagStats()

    return {
      memoryStats,
      learningStats,
      tagPoolStats: {
        totalTags: tagPool.length,
        topTags: tagStats.slice(0, 10).map((s) => s.tag),
        recentTags: tagStats
          .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
          .slice(0, 10)
          .map((s) => s.tag)
      }
    }
  }

  /**
   * 获取学习进度
   */
  getLearningProgress(): {
    queryCount: number
    feedbackCount: number
    tagWeightRange: { min: number; max: number }
    topLearningTags: Array<{ tag: string; weight: number }>
  } {
    const stats = this.selfLearning.getStats()

    const weights = stats.topTags.map((t) => t.weight)
    const minWeight = weights.length > 0 ? Math.min(...weights) : 1.0
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 1.0

    return {
      queryCount: stats.totalQueries,
      feedbackCount: stats.totalFeedback,
      tagWeightRange: { min: minWeight, max: maxWeight },
      topLearningTags: stats.topTags.slice(0, 10).map((t) => ({ tag: t.tag, weight: t.weight }))
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 获取配置
   */
  getConfig(): IntegratedMemoryConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<IntegratedMemoryConfig>): void {
    if (updates.memoryMaster) {
      this.config.memoryMaster = { ...this.config.memoryMaster, ...updates.memoryMaster }
    }
    if (updates.selfLearning) {
      this.config.selfLearning = { ...this.config.selfLearning, ...updates.selfLearning }
    }
    if (updates.search) {
      this.config.search = { ...this.config.search, ...updates.search }
    }

    logger.info('Config updated', { config: this.config })
  }

  // ==================== 辅助方法 ====================

  /**
   * 从查询中提取标签关键词
   */
  private extractTagsFromQuery(query: string): string[] {
    // 简单实现：提取中文词和英文词
    const words: string[] = []

    // 提取中文词 (2-4字)
    const chineseMatches = query.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (chineseMatches) {
      words.push(...chineseMatches)
    }

    // 提取英文词 (3字母以上)
    const englishMatches = query.match(/[a-zA-Z]{3,}/g)
    if (englishMatches) {
      words.push(...englishMatches.map((w) => w.toLowerCase()))
    }

    // 去重并限制数量
    return [...new Set(words)].slice(0, 10)
  }

  // ==================== AIMemo (VCPToolBox 移植) ====================

  /**
   * 带 AI 合成的搜索 (移植自 VCPToolBox AIMemoHandler)
   *
   * 功能说明:
   * - 执行智能搜索获取相关记忆片段
   * - 使用 LLM 将多个片段合成为连贯的摘要
   * - 支持缓存以提高性能
   * - 增强版: 支持超时降级
   *
   * @param query - 用户查询
   * @param characterNames - 角色名称列表 (用于缓存 key)
   * @param options - 搜索和合成选项
   * @returns 合成结果
   */
  async searchWithSynthesis(
    query: string,
    characterNames: string[] = [],
    options?: {
      modelId?: string
      providerId?: string
      maxResults?: number
      skipCache?: boolean
      timeout?: number // 新增: 超时时间 (ms)
    }
  ): Promise<{
    synthesizedMemory: string
    rawResults: EnhancedSearchResult[]
    fromCache: boolean
    durationMs: number
    fallback?: boolean // 新增: 是否使用了降级方案
  }> {
    const startTime = Date.now()
    const timeout = options?.timeout || 5000 // 默认 5 秒超时
    const cacheKey = this.getAIMemoCacheKey(characterNames, query, {
      modelId: options?.modelId,
      providerId: options?.providerId,
      topK: options?.maxResults
    })

    // 检查缓存
    if (this.aiMemoConfig.cacheEnabled && !options?.skipCache) {
      const cached = this.aiMemoCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.aiMemoConfig.cacheTTLMs) {
        logger.debug('AIMemo cache hit', { query: query.slice(0, 50) })
        return {
          synthesizedMemory: cached.content,
          rawResults: [],
          fromCache: true,
          durationMs: Date.now() - startTime
        }
      }
    }

    // 执行搜索
    const rawResults = await this.intelligentSearch(query, {
      topK: options?.maxResults || 20,
      tagBoost: 0.5,
      expandQuery: true
    })

    // 如果结果少于等于3条，直接拼接返回
    if (rawResults.length <= 3) {
      const content = rawResults.map((r) => r.content).join('\n\n')
      return {
        synthesizedMemory: content,
        rawResults,
        fromCache: false,
        durationMs: Date.now() - startTime
      }
    }

    // AI 合成 (带超时降级)
    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('AIMemo synthesis timeout')), timeout)
      })

      // 竞争: 合成 vs 超时
      const synthesizedMemory = await Promise.race([
        this.synthesizeMemoryWithAI(query, rawResults, options),
        timeoutPromise
      ])

      if (synthesizedMemory === null) {
        throw new Error('Synthesis returned null')
      }

      // 缓存结果
      if (this.aiMemoConfig.cacheEnabled) {
        this.aiMemoCache.set(cacheKey, {
          content: synthesizedMemory,
          timestamp: Date.now()
        })

        // 清理过期缓存
        this.cleanExpiredAIMemoCache()
      }

      logger.info('AIMemo synthesis completed', {
        query: query.slice(0, 50),
        resultCount: rawResults.length,
        durationMs: Date.now() - startTime
      })

      return {
        synthesizedMemory,
        rawResults,
        fromCache: false,
        durationMs: Date.now() - startTime
      }
    } catch (error) {
      logger.warn('AIMemo synthesis failed or timed out, returning raw results', error as Error)
      // 降级: 直接返回拼接的原始结果
      const fallbackContent = rawResults.map((r) => r.content).join('\n\n')
      return {
        synthesizedMemory: fallbackContent,
        rawResults,
        fromCache: false,
        durationMs: Date.now() - startTime,
        fallback: true // 标记使用了降级方案
      }
    }
  }

  /**
   * 使用 AI 合成记忆片段
   */
  private async synthesizeMemoryWithAI(
    query: string,
    results: EnhancedSearchResult[],
    options?: { modelId?: string; providerId?: string }
  ): Promise<string> {
    // 使用 MCPBridge 调用 LLM (与 MemoryMasterService 保持一致)
    const { MCPBridge } = await import('../../mcpServers/shared/MCPBridge')
    const bridge = MCPBridge.getInstance()

    const systemPrompt = '你是一个记忆助手，擅长将多个记忆片段整合成连贯的摘要。保持简洁，提取关键信息。'
    const userPrompt = `根据以下记忆片段，针对查询 "${query}" 合成一个连贯的摘要。

记忆片段:
${results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n')}

请提供一个简洁、整合的摘要，捕捉与查询相关的关键信息。`

    const response = await bridge.generateText({
      systemPrompt,
      userPrompt,
      providerId: options?.providerId || this.config.memoryMaster.defaultProviderId,
      modelId: options?.modelId || this.config.memoryMaster.defaultModelId
    })

    return response || results.map((r) => r.content).join('\n\n')
  }

  /**
   * 生成 AIMemo 缓存 key
   * 增强版: 包含 model/provider 确保缓存粒度正确
   */
  private getAIMemoCacheKey(
    characterNames: string[],
    query: string,
    options?: { modelId?: string; providerId?: string; topK?: number }
  ): string {
    const sortedNames = [...characterNames].sort().join('|')
    const queryKey = query.slice(0, 100).toLowerCase().replace(/\s+/g, ' ')
    const modelKey = options?.modelId || 'default'
    const providerKey = options?.providerId || 'default'
    const topKKey = options?.topK?.toString() || '20'
    return `${sortedNames}:${queryKey}:${modelKey}:${providerKey}:${topKKey}`
  }

  /**
   * 清理过期的 AIMemo 缓存
   */
  private cleanExpiredAIMemoCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, value] of this.aiMemoCache) {
      if (now - value.timestamp > this.aiMemoConfig.cacheTTLMs) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.aiMemoCache.delete(key)
    }

    if (expiredKeys.length > 0) {
      logger.debug('Cleaned expired AIMemo cache entries', { count: expiredKeys.length })
    }
  }

  /**
   * 更新 AIMemo 配置
   */
  updateAIMemoConfig(config: Partial<typeof this.aiMemoConfig>): void {
    this.aiMemoConfig = { ...this.aiMemoConfig, ...config }
    logger.debug('AIMemo config updated', { config: this.aiMemoConfig })
  }

  /**
   * 清空 AIMemo 缓存
   */
  clearAIMemoCache(): void {
    this.aiMemoCache.clear()
    logger.info('AIMemo cache cleared')
  }

  // ==================== 日记声明模式集成 (Phase 5) ====================

  /**
   * 解析并执行日记声明语法
   *
   * 支持四种模式:
   * - {{知识库}} - 全文注入 (fulltext)
   * - [[知识库]] - RAG 片段 (rag)
   * - <<知识库>> - 阈值全文 (threshold_fulltext)
   * - 《《知识库》》 - 阈值 RAG (threshold_rag)
   *
   * 支持修饰符:
   * - ::Time - 时间感知
   * - ::Group(a,b,c) - 语义组
   * - ::TagMemo0.65 - TagMemo 增强
   * - ::AIMemo - AI 合成召回
   * - ::TopK10 - 限制数量
   * - ::Threshold0.8 - 相似度阈值
   *
   * @param text - 包含日记声明的文本 (如系统提示词)
   * @param query - 用户查询
   * @param options - 搜索选项
   * @returns 解析和搜索结果
   */
  async searchWithDiaryDeclarations(
    text: string,
    query: string,
    options?: {
      topK?: number
      knowledgeBaseAccessor?: {
        getFullContent: (name: string) => Promise<string>
        vectorSearch: (
          name: string,
          query: string,
          opts?: { topK?: number; threshold?: number }
        ) => Promise<Array<{ pageContent: string; score: number; metadata?: Record<string, unknown> }>>
      }
    }
  ): Promise<{
    cleanedText: string
    injections: string[]
    searchResults: Map<string, VCPServiceSearchResult>
  }> {
    const startTime = Date.now()

    // 1. 解析日记声明
    const parseResult = diaryModeParser.parse(text)

    if (parseResult.declarations.length === 0) {
      logger.debug('No diary declarations found in text')
      return {
        cleanedText: text,
        injections: [],
        searchResults: new Map()
      }
    }

    logger.info('Parsing diary declarations', {
      declarationCount: parseResult.declarations.length,
      knowledgeBases: Array.from(parseResult.configs.keys())
    })

    // 发送 MODIFIER_PARSING 事件到 RAGObserverPanel
    if (parseResult.declarations.length > 0) {
      try {
        const { getVCPInfoService } = await import('../vcp/VCPInfoService')
        const vcpInfoService = getVCPInfoService()

        // 收集所有修饰符信息
        const parsedModifiers: Array<{ modifier: string; value?: string | number; parsed: boolean }> = []
        let retrievalMode = 'unified' // 默认检索模式

        for (const decl of parseResult.declarations) {
          // 添加模式修饰符
          parsedModifiers.push({
            modifier: `Mode:${decl.mode}`,
            parsed: true
          })

          // 添加动态 K 值修饰符
          if (decl.modifiers.find((m) => m.type === 'kFactor')) {
            const kFactor = decl.modifiers.find((m) => m.type === 'kFactor')
            parsedModifiers.push({
              modifier: ':kFactor',
              value: (kFactor?.parsed as { factor?: number })?.factor || 1,
              parsed: true
            })
          }

          // 添加其他修饰符
          for (const mod of decl.modifiers) {
            if (mod.type === 'time') {
              parsedModifiers.push({ modifier: '::Time', parsed: true })
            } else if (mod.type === 'group') {
              const groups = mod.parsed?.groups as string[] | null
              parsedModifiers.push({
                modifier: groups && groups.length > 0 ? `::Group(${groups.join(',')})` : '::Group',
                parsed: true
              })
            } else if (mod.type === 'tagmemo') {
              parsedModifiers.push({
                modifier: '::TagMemo',
                value: (mod.parsed as { threshold?: number })?.threshold || 0.65,
                parsed: true
              })
            } else if (mod.type === 'aimemo') {
              parsedModifiers.push({ modifier: '::AIMemo', parsed: true })
            } else if (mod.type === 'rerank') {
              parsedModifiers.push({ modifier: '::Rerank', parsed: true })
            } else if (mod.type === 'topk' || mod.type === 'k') {
              parsedModifiers.push({
                modifier: `::${mod.type === 'k' ? 'K' : 'TopK'}`,
                value: (mod.parsed as { count?: number })?.count || 10,
                parsed: true
              })
            } else if (mod.type === 'threshold') {
              parsedModifiers.push({
                modifier: '::Threshold',
                value: (mod.parsed as { value?: number })?.value || 0.7,
                parsed: true
              })
            } else if (mod.type === 'backend') {
              retrievalMode = (mod.value as string) || 'unified'
            }
          }
        }

        vcpInfoService.broadcastEvent({
          type: 'MODIFIER_PARSING',
          traceId: `modifier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          originalQuery: text,
          parsedModifiers,
          cleanQuery: parseResult.cleanedText,
          retrievalMode,
          timestamp: Date.now()
        })

        logger.debug('Modifier parsing event broadcasted', {
          declarationCount: parseResult.declarations.length,
          modifierCount: parsedModifiers.length
        })
      } catch (error) {
        logger.warn('Failed to broadcast modifier parsing event', error as Error)
      }
    }

    const injections: string[] = []
    const searchResults = new Map<string, VCPServiceSearchResult>()

    // 2. 对每个声明执行检索
    for (const [knowledgeBaseName, config] of parseResult.configs) {
      try {
        const result = await this.executeRetrievalConfig(knowledgeBaseName, query, config, options)

        if (result) {
          searchResults.set(knowledgeBaseName, result)

          // 格式化注入内容
          const injection = this.formatRetrievalResult(knowledgeBaseName, config, result)
          if (injection) {
            injections.push(injection)
          }
        }
      } catch (error) {
        logger.error('Failed to execute diary declaration', {
          knowledgeBase: knowledgeBaseName,
          error: String(error)
        })
      }
    }

    logger.info('Diary declarations processed', {
      totalDeclarations: parseResult.declarations.length,
      successfulInjections: injections.length,
      durationMs: Date.now() - startTime
    })

    return {
      cleanedText: parseResult.cleanedText,
      injections,
      searchResults
    }
  }

  /**
   * 执行单个检索配置
   */
  private async executeRetrievalConfig(
    knowledgeBaseName: string,
    query: string,
    config: RetrievalConfig,
    options?: {
      topK?: number
      knowledgeBaseAccessor?: {
        getFullContent: (name: string) => Promise<string>
        vectorSearch: (
          name: string,
          query: string,
          opts?: { topK?: number; threshold?: number }
        ) => Promise<Array<{ pageContent: string; score: number; metadata?: Record<string, unknown> }>>
      }
    }
  ): Promise<VCPServiceSearchResult | null> {
    // 检查是否启用 AIMemo
    if (config.aiMemo) {
      try {
        const synthesisResult = await this.searchWithSynthesis(query, [knowledgeBaseName], {
          maxResults: config.topK || options?.topK || 10
        })

        return {
          results: synthesisResult.rawResults.map((r) => ({
            pageContent: r.content,
            score: 1.0,
            metadata: {}
          })),
          metadata: {
            mode: config.mode,
            enhancementsApplied: ['aiMemo']
          }
        }
      } catch (error) {
        logger.warn('AIMemo failed, falling back to standard search', { error: String(error) })
      }
    }

    // 创建访问器适配器
    const accessor = options?.knowledgeBaseAccessor || this.createDefaultAccessor()

    // 使用 VCPSearchService 执行搜索
    return vcpSearchService.search(accessor as any, query, {
      mode: config.mode,
      threshold: config.threshold,
      topK: config.topK || options?.topK || 10,
      backend: config.backend,
      timeAware: config.timeAware,
      timeRange: config.timeRange as any,
      semanticGroups: config.semanticGroups as any,
      tagMemo: config.tagMemo,
      tagMemoThreshold: config.tagMemoThreshold,
      aiMemo: config.aiMemo,
      rerank: config.rerank
    })
  }

  /**
   * 创建默认的知识库访问器
   * 使用内部多后端搜索进行检索
   */
  private createDefaultAccessor() {
    return {
      getFullContent: async (_name: string): Promise<string> => {
        // 从日记后端获取全部内容
        const results = await this._search('', {
          backends: ['diary'],
          topK: 1000
        })
        return results.map((r) => r.content).join('\n\n')
      },
      vectorSearch: async (_name: string, query: string, opts?: { topK?: number; threshold?: number }) => {
        const results = await this._search(query, {
          backends: ['diary', 'memory', 'knowledge'],
          topK: opts?.topK || 10
        })
        return results.map((r) => ({
          pageContent: r.content,
          score: r.score,
          metadata: r.metadata || {}
        }))
      }
    }
  }

  /**
   * 格式化检索结果为注入内容
   */
  private formatRetrievalResult(
    knowledgeBaseName: string,
    config: RetrievalConfig,
    result: VCPServiceSearchResult
  ): string | null {
    if (!result.results || result.results.length === 0) {
      return null
    }

    // 检查阈值条件
    if (config.mode === 'threshold_fulltext' || config.mode === 'threshold_rag') {
      const avgScore =
        result.results.slice(0, 3).reduce((acc, r) => acc + r.score, 0) / Math.min(3, result.results.length)
      if (avgScore < (config.threshold || 0.7)) {
        logger.debug('Threshold not met', { knowledgeBase: knowledgeBaseName, avgScore, threshold: config.threshold })
        return null
      }
    }

    // 格式化内容
    if (config.mode === 'fulltext' || config.mode === 'threshold_fulltext') {
      // 全文模式
      return `--- ${knowledgeBaseName} ---\n${result.results.map((r) => r.pageContent).join('\n\n')}`
    } else {
      // RAG 片段模式
      const enhancements = result.metadata?.enhancementsApplied || []
      const enhancementStr = enhancements.length > 0 ? ` [${enhancements.join(', ')}]` : ''
      return `--- ${knowledgeBaseName}${enhancementStr} ---\n${result.results.map((r, i) => `[${i + 1}] ${r.pageContent}`).join('\n\n')}`
    }
  }

  /**
   * 检查文本是否包含日记声明
   */
  hasDiaryDeclarations(text: string): boolean {
    return diaryModeParser.hasDeclarations(text)
  }

  /**
   * 获取文本中声明的知识库列表
   */
  getDeclaredKnowledgeBases(text: string): string[] {
    return diaryModeParser.getKnowledgeBases(text)
  }

  // ==================== 日记上下文 (统一入口) ====================

  /**
   * 获取日记上下文 - 统一入口
   * 支持四种模式: full, rag, threshold, threshold_rag
   *
   * 这是 DailyNoteWriteService.executeGetDiaryContextUnified 调用的核心方法
   * 整合了 NoteService、时间表达式解析、RAG 搜索等能力
   */
  async getDiaryContext(options: DiaryContextOptions): Promise<DiaryContextResult> {
    const { mode, query, characterName, timeExpression } = options
    const startTime = Date.now()

    logger.debug('Getting diary context', { mode, characterName, timeExpression, hasQuery: !!query })

    try {
      // 获取 NoteService
      const { getNoteService } = await import('../notes')
      const noteService = getNoteService()

      // 获取所有日记
      let allNotes = await noteService.listAll()

      // 过滤: 只保留日记类型的笔记
      allNotes = allNotes.filter((n) => {
        // 通过 frontmatter 属性识别日记
        return (
          n.frontmatter.aiGenerated === true ||
          n.frontmatter.characterName ||
          n.filePath.includes('diary') ||
          n.filePath.includes('日记')
        )
      })

      // 角色过滤
      if (characterName) {
        allNotes = allNotes.filter((n) => n.frontmatter.characterName === characterName)
      }

      // 时间表达式过滤
      if (timeExpression) {
        const timeRange = parseTimeExpressions(timeExpression)
        if (timeRange.length > 0) {
          const range = timeRange[0]
          allNotes = allNotes.filter((n) => {
            const noteDate = n.frontmatter.date ? new Date(n.frontmatter.date) : n.createdAt
            return noteDate >= range.start && noteDate <= range.end
          })
        }
      }

      // 按更新时间排序
      allNotes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      const sourceCount = allNotes.length
      let content = ''
      let usedMode: string = mode  // 允许派生状态如 'threshold (跳过)', 'truncated', 'recent'

      // 阈值配置
      const fullThreshold = 10
      const maxContentLength = 8000
      const ragTopK = 5

      switch (mode) {
        case 'full':
          // 全量模式
          content = this.formatDiaryNotes(allNotes)
          break

        case 'threshold':
          // 阈值模式：日记少于阈值时全量，否则空
          if (allNotes.length <= fullThreshold) {
            content = this.formatDiaryNotes(allNotes)
            usedMode = 'full'
          } else {
            content = ''
            usedMode = 'threshold (跳过)'
          }
          break

        case 'threshold_rag':
          // 阈值+RAG 模式
          if (allNotes.length <= fullThreshold) {
            content = this.formatDiaryNotes(allNotes)
            usedMode = 'full'
          } else if (query) {
            // 使用统一记忆搜索
            const ragResults = await this.intelligentSearch(query, {
              backends: ['diary'],
              topK: ragTopK,
              expandQuery: true
            })
            content = ragResults
              .map((r) => `## ${(r.metadata?.title as string) || '日记'}\n\n${r.content}`)
              .join('\n\n---\n\n')
            usedMode = 'rag'
          } else {
            content = this.formatDiaryNotes(allNotes.slice(0, fullThreshold))
            usedMode = 'truncated'
          }
          break

        case 'rag':
        default:
          // RAG 模式
          if (query) {
            const ragResults = await this.intelligentSearch(query, {
              backends: ['diary'],
              topK: ragTopK,
              expandQuery: true
            })
            content = ragResults
              .map((r) => `## ${(r.metadata?.title as string) || '日记'}\n\n${r.content}`)
              .join('\n\n---\n\n')
          } else {
            // 无查询时使用最近的日记
            content = this.formatDiaryNotes(allNotes.slice(0, ragTopK))
            usedMode = 'recent'
          }
          break
      }

      // 截断过长内容
      if (content.length > maxContentLength) {
        content = content.slice(0, maxContentLength) + '\n\n[内容已截断...]'
      }

      logger.info('Diary context generated', {
        mode,
        usedMode,
        sourceCount,
        contentLength: content.length,
        durationMs: Date.now() - startTime
      })

      return {
        usedMode,
        sourceCount,
        content
      }
    } catch (error) {
      logger.error('Failed to get diary context', error as Error)
      throw error
    }
  }

  /**
   * 格式化日记笔记列表为文本
   */
  private formatDiaryNotes(notes: Array<{ title: string; content: string; frontmatter: { date?: string } }>): string {
    if (notes.length === 0) return ''

    return notes
      .map((n) => {
        const header = `## ${n.title} (${n.frontmatter.date || '未设置日期'})`
        return `${header}\n\n${n.content}`
      })
      .join('\n\n---\n\n')
  }

  // ==================== 内部多后端搜索 ====================

  /**
   * 内部统一搜索 - 跨多个后端搜索
   *
   * 默认搜索顺序 (按推荐度):
   * 1. diary - VCP 日记系统 (TagMemo + rust-vexus)
   * 2. deepmemo - Tantivy + Reranker 深度检索
   * 3. lightmemo - BM25 快速检索
   * 4. memory - 全局对话记忆
   * 5. knowledge - 通用文档知识库
   */
  private async _search(query: string, options: UnifiedSearchOptions = {}): Promise<UnifiedSearchResult[]> {
    const {
      backends = ['diary', 'lightmemo', 'deepmemo', 'meshmemo'],
      topK = 10,
      threshold = 0.1,
      useRRF = true,
      rrfK = 60
    } = options

    logger.debug('Internal unified search started', { query: query.slice(0, 50), backends, topK })

    const allResults: UnifiedSearchResult[] = []
    const searchPromises: Promise<void>[] = []

    // 并行搜索各后端 (错误隔离 - 单个后端失败不影响其他)
    for (const backend of backends) {
      searchPromises.push(
        this._searchBackend(backend, query, { ...options, topK })
          .then((results) => {
            allResults.push(...results)
          })
          .catch((error) => {
            // 错误隔离：记录警告但不中断搜索
            logger.warn(`Search failed for backend ${backend}:`, error)
          })
      )
    }

    await Promise.all(searchPromises)

    // 过滤低分结果
    let filteredResults = allResults.filter((r) => r.score >= threshold)

    // 应用 RRF 融合排序
    if (useRRF && backends.length > 1) {
      filteredResults = this._applyRRF(filteredResults, rrfK)
    } else {
      // 简单按分数排序
      filteredResults.sort((a, b) => b.score - a.score)
    }

    // 截取 topK
    return filteredResults.slice(0, topK)
  }

  /**
   * 搜索单个后端
   */
  private async _searchBackend(
    backend: MemoryBackendType,
    query: string,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const { topK = 10 } = options

    switch (backend) {
      case 'knowledge':
        return this._searchKnowledge(query, options)
      case 'diary':
        return this._searchDiary(query, options)
      case 'notes':
        return this._searchNotes(query, topK, options)
      case 'memory':
        return this._searchMemory(query, options)
      case 'lightmemo':
        return this._searchLightMemo(query, topK, options)
      case 'deepmemo':
        return this._searchDeepMemo(query, topK, options)
      case 'meshmemo':
        return this._searchMeshMemo(query, topK, options)
      case 'unified':
        return this._searchUnified(query, topK, options)
      default:
        logger.warn(`Unknown backend: ${backend}`)
        return []
    }
  }

  /**
   * 搜索统一存储 (Phase 6)
   * 支持运行时 embedApiClient 传递
   */
  private async _searchUnified(
    query: string,
    topK: number,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    try {
      const storage = await this.getUnifiedStorage()
      if (!storage) return []

      const results = await storage.searchWithTagBoost(query, {
        source: 'all',
        topK,
        threshold: options.threshold || 0.1,
        enableTagBoost: true,
        userId: options.userId,
        characterName: options.characterName,
        embedApiClient: options.embedApiClient // 传递运行时 embedApiClient
      })

      return results.map((r) => ({
        id: r.id,
        content: r.content,
        score: r.score,
        backend: 'unified' as MemoryBackendType,
        metadata: { ...r.metadata, source: r.source, characterName: r.characterName }
      }))
    } catch (error) {
      logger.warn('Unified storage search failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索笔记 (NoteService 集成)
   * 支持时间范围过滤 (::Time 修饰符)
   */
  private async _searchNotes(
    query: string,
    topK: number,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    try {
      const { getNoteService } = await import('../notes')
      const noteService = getNoteService()

      const results = await noteService.fullTextSearch(query, {
        limit: topK * 2, // 请求更多以支持过滤
        minScore: 0.1
      })

      let filteredResults = results

      // 应用时间范围过滤
      if (options.timeRange) {
        const { start, end } = options.timeRange
        filteredResults = results.filter((note) => {
          const noteDate = note.frontmatter.date
            ? new Date(note.frontmatter.date)
            : note.createdAt || new Date(0)
          return noteDate >= start && noteDate <= end
        })

        logger.debug('Notes time-filtered', {
          original: results.length,
          filtered: filteredResults.length,
          timeRange: { start: start.toISOString(), end: end.toISOString() }
        })
      }

      return filteredResults.slice(0, topK).map((note) => ({
        id: note.id,
        content: note.content,
        score: note.searchScore,
        backend: 'notes' as MemoryBackendType,
        sourceFile: note.filePath,
        metadata: {
          title: note.title,
          tags: note.frontmatter.tags,
          date: note.frontmatter.date,
          aiGenerated: note.frontmatter.aiGenerated,
          characterName: note.frontmatter.characterName
        }
      }))
    } catch (error) {
      logger.warn('Notes search failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索通用知识库
   */
  private async _searchKnowledge(query: string, options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const { knowledgeBaseId, embedApiClient } = options

    if (!knowledgeBaseId || !embedApiClient) {
      return []
    }

    try {
      const service = await this.getKnowledgeService()
      const results = await service.search(null as any, {
        search: query,
        base: { id: knowledgeBaseId, embedApiClient }
      })

      return results.map((r) => ({
        id: r.metadata?.uniqueLoaderId || crypto.randomUUID(),
        content: r.pageContent,
        score: r.score,
        backend: 'knowledge' as MemoryBackendType,
        metadata: r.metadata
      }))
    } catch (error) {
      logger.warn('Knowledge search failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索日记/笔记知识库 (VCP 原生)
   * 支持时间范围过滤 (::Time 修饰符)
   */
  private async _searchDiary(query: string, options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const { diaryName, topK = 10, tagBoost = 0.5, timeRange } = options

    try {
      const adapter = await this.getUnifiedKnowledgeAdapter()
      if (!adapter) return []

      // 请求更多结果以支持时间过滤
      const requestTopK = timeRange ? topK * 3 : topK
      const results: NativeVCPSearchResult[] = await adapter.searchByText(diaryName || null, query, requestTopK, tagBoost)

      let filteredResults = results

      // 应用时间范围过滤
      if (timeRange) {
        const { start, end } = timeRange
        filteredResults = results.filter((r) => {
          // 尝试从文件路径中提取日期 (格式: YYYY-MM-DD 或 YYYYMMDD)
          const dateMatch = r.fullPath?.match(/(\d{4}[-/]?\d{2}[-/]?\d{2})/) ||
                           r.sourceFile?.match(/(\d{4}[-/]?\d{2}[-/]?\d{2})/)
          if (dateMatch) {
            const dateStr = dateMatch[1].replace(/[-/]/g, '')
            const year = parseInt(dateStr.slice(0, 4))
            const month = parseInt(dateStr.slice(4, 6)) - 1
            const day = parseInt(dateStr.slice(6, 8))
            const entryDate = new Date(year, month, day)
            return entryDate >= start && entryDate <= end
          }
          // 如果无法从路径提取日期，保留结果
          return true
        })

        logger.debug('Diary time-filtered', {
          original: results.length,
          filtered: filteredResults.length,
          timeRange: { start: start.toISOString(), end: end.toISOString() }
        })
      }

      return filteredResults.slice(0, topK).map((r) => ({
        id: crypto.randomUUID(),
        content: r.text,
        score: r.score,
        backend: 'diary' as MemoryBackendType,
        sourceFile: r.sourceFile,
        matchedTags: r.matchedTags,
        tagBoostInfo: r.boostFactor
          ? {
              boostFactor: r.boostFactor,
              spikeCount: r.tagMatchCount || 0,
              totalSpikeScore: r.tagMatchScore || 0
            }
          : undefined,
        metadata: {
          fullPath: r.fullPath,
          boostFactor: r.boostFactor,
          tagMatchScore: r.tagMatchScore
        }
      }))
    } catch (error) {
      logger.warn('Diary search failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索全局对话记忆
   */
  private async _searchMemory(query: string, options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const { userId, agentId, topK = 10 } = options

    try {
      const service = await this.getMemoryService()
      if (!service) return []

      const results: SearchResult = await service.search(query, {
        userId,
        agentId,
        limit: topK
      })

      return results.memories.map((m) => ({
        id: m.id,
        content: m.memory,
        score: 0.5,
        backend: 'memory' as MemoryBackendType,
        metadata: m.metadata
      }))
    } catch (error) {
      logger.warn('Memory search failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索 LightMemo (BM25 + 向量)
   */
  private async _searchLightMemo(
    query: string,
    topK: number,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    try {
      const services = this.getAdvancedMemoryServices()
      const lightMemo = services.lightMemo()

      let queryEmbedding: number[] | undefined
      if (options?.embedApiClient) {
        try {
          const { getEmbeddingService } = await import('../../knowledge/embedding/UnifiedEmbeddingService')
          const embeddingService = getEmbeddingService()
          const result = await embeddingService.embedText(query, {
            apiClient: options.embedApiClient
          })
          queryEmbedding = result.embedding
        } catch {
          // 降级为纯 BM25 搜索
        }
      }

      const results = await lightMemo.search(query, queryEmbedding, { topK })

      return results.map((r) => ({
        id: r.id,
        content: r.content,
        score: r.score,
        backend: 'lightmemo' as MemoryBackendType,
        metadata: r.metadata
      }))
    } catch (error) {
      logger.warn('LightMemo search failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索 DeepMemo (Tantivy + Reranker)
   */
  private async _searchDeepMemo(
    query: string,
    topK: number,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    try {
      const services = this.getAdvancedMemoryServices()
      const deepMemo = services.deepMemo()

      let enhancedQuery = query
      const advanced = options?.vcpAdvanced
      if (advanced) {
        if (advanced.exactPhrase) {
          enhancedQuery = `"${advanced.exactPhrase}" ${enhancedQuery}`
        }
        if (advanced.boostKeywords?.length) {
          enhancedQuery += ' ' + advanced.boostKeywords.map((k) => `+${k}`).join(' ')
        }
        if (advanced.excludeKeywords?.length) {
          enhancedQuery += ' ' + advanced.excludeKeywords.map((k) => `-${k}`).join(' ')
        }
      }

      const results = await deepMemo.search(enhancedQuery, undefined, {
        finalTopK: topK,
        rerank: advanced?.useReranker ?? true,
        rerankModelId: advanced?.rerankerModelId
      })

      return results.map((r) => ({
        id: r.id,
        content: r.content,
        score: r.score,
        backend: 'deepmemo' as MemoryBackendType,
        metadata: r.metadata
      }))
    } catch (error) {
      logger.warn('DeepMemo search failed:', error as Error)
      return []
    }
  }

  /**
   * 搜索 MeshMemo (多维网状聚合)
   */
  private async _searchMeshMemo(
    query: string,
    topK: number,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    try {
      const { embedApiClient } = options || {}

      if (!embedApiClient) {
        return []
      }

      const { getEmbeddingService } = await import('../../knowledge/embedding/UnifiedEmbeddingService')
      const embeddingService = getEmbeddingService()

      const result = await embeddingService.embedText(query, { apiClient: embedApiClient })
      const queryEmbedding = result.embedding

      const services = this.getAdvancedMemoryServices()
      const meshMemo = services.meshMemo()
      const vcpAdvanced = options?.vcpAdvanced

      const results = await meshMemo.search([], queryEmbedding, {
        query: '',
        finalTopK: topK,
        rerank: vcpAdvanced?.useReranker,
        timeDecay: !!vcpAdvanced?.timeRange
      } as any)

      return results.map((r: any) => ({
        id: r.id || r.chunk?.id || crypto.randomUUID(),
        content: r.content || r.chunk?.content || '',
        score: r.score || 0,
        backend: 'meshmemo' as MemoryBackendType,
        metadata: r.metadata || r.chunk?.metadata
      }))
    } catch (error) {
      logger.warn('MeshMemo search failed:', error as Error)
      return []
    }
  }

  /**
   * RRF 融合排序
   */
  private _applyRRF(results: UnifiedSearchResult[], k: number = 60): UnifiedSearchResult[] {
    const backendResults = new Map<MemoryBackendType, UnifiedSearchResult[]>()
    for (const result of results) {
      const list = backendResults.get(result.backend) || []
      list.push(result)
      backendResults.set(result.backend, list)
    }

    const sources: WeightedSource<RRFSearchResult>[] = []
    for (const [backend, list] of backendResults) {
      list.sort((a, b) => b.score - a.score)

      const searchResults: RRFSearchResult[] = list.map((r) => ({
        pageContent: r.content,
        score: r.score,
        metadata: {
          ...r.metadata,
          _originalId: r.id,
          _backend: r.backend,
          _sourceFile: r.sourceFile,
          _matchedTags: r.matchedTags,
          _tagBoostInfo: r.tagBoostInfo
        }
      }))

      sources.push({ name: backend, results: searchResults, weight: 1.0 })
    }

    const fusedResults = weightedRRFFuse(sources, { k, normalize: true })

    return fusedResults.map((r) => ({
      id: (r.metadata?._originalId as string) || crypto.randomUUID(),
      content: r.pageContent,
      score: r.score,
      backend: (r.metadata?._backend as MemoryBackendType) || 'memory',
      metadata: r.metadata,
      sourceFile: r.metadata?._sourceFile as string | undefined,
      matchedTags: r.metadata?._matchedTags as string[] | undefined,
      tagBoostInfo: r.metadata?._tagBoostInfo as UnifiedSearchResult['tagBoostInfo']
    }))
  }

  /**
   * 内部获取后端状态统计
   */
  private async _getStats(): Promise<UnifiedMemoryStats> {
    const backends: BackendStatus[] = []
    let totalDocuments = 0

    // Knowledge Service
    try {
      const bases = await mcpBridge.listKnowledgeBases()
      const knowledgeCount = bases?.length || 0
      backends.push({ backend: 'knowledge', available: true, documentCount: knowledgeCount })
      totalDocuments += knowledgeCount
    } catch {
      backends.push({ backend: 'knowledge', available: false, documentCount: 0, error: 'Failed to connect' })
    }

    // Diary - 优先从 SQLite chunks 表统计，回退到 NoteService
    try {
      const storage = await this.getUnifiedStorage()
      if (storage) {
        const db = storage.getDatabase()
        const result = await db.execute(
          `SELECT COUNT(*) as count FROM chunks WHERE source = 'diary'`
        )
        const diaryCount = (result.rows[0] as Record<string, unknown>).count as number
        backends.push({ backend: 'diary', available: true, documentCount: diaryCount })
        totalDocuments += diaryCount
      } else {
        // 回退到 NoteService
        const { getNoteService } = await import('../notes/NoteService')
        const noteService = getNoteService()
        const allNotes = await noteService.listAll()
        const diaryCount = allNotes?.length || 0
        backends.push({ backend: 'diary', available: true, documentCount: diaryCount })
        totalDocuments += diaryCount
      }
    } catch {
      backends.push({ backend: 'diary', available: false, documentCount: 0, error: 'Failed to get diary stats' })
    }

    // Memory Service (mem0-based)
    try {
      const service = await this.getMemoryService()
      if (service) {
        const result = await service.list({ limit: 1 })
        const memoryCount = result.count || 0
        backends.push({ backend: 'memory', available: true, documentCount: memoryCount })
        totalDocuments += memoryCount
      } else {
        backends.push({ backend: 'memory', available: false, documentCount: 0, error: 'Service not initialized' })
      }
    } catch {
      backends.push({ backend: 'memory', available: false, documentCount: 0 })
    }

    // Advanced Memory services
    const advancedServices = this.getAdvancedMemoryServices()

    try {
      const lightMemo = advancedServices.lightMemo()
      const count = lightMemo.getDocumentCount()
      backends.push({ backend: 'lightmemo', available: true, documentCount: count })
      totalDocuments += count
    } catch {
      backends.push({ backend: 'lightmemo', available: false, documentCount: 0 })
    }

    try {
      const deepMemo = advancedServices.deepMemo()
      const count = deepMemo.getDocumentCount()
      backends.push({ backend: 'deepmemo', available: true, documentCount: count })
      totalDocuments += count
    } catch {
      backends.push({ backend: 'deepmemo', available: false, documentCount: 0 })
    }

    try {
      const meshMemo = advancedServices.meshMemo()
      const count = meshMemo.getChunkCount()
      backends.push({ backend: 'meshmemo', available: true, documentCount: count })
      totalDocuments += count
    } catch {
      backends.push({ backend: 'meshmemo', available: false, documentCount: 0 })
    }

    return { backends, totalDocuments, lastQueryTime: new Date() }
  }

  // ==================== 新增方法 (替代废弃API) ====================

  /**
   * 获取单个标签的详细统计
   * 替代: selfLearning.getTagStats
   */
  getTagStats(tag: string): {
    queryCount: number
    positiveCount: number
    negativeCount: number
    lastQueryTime: number
    learnedWeight: number
  } | null {
    return this.selfLearning.getTagStats(tag)
  }

  /**
   * 确认语义关联建议
   * 替代: selfLearning.confirmSuggestion
   */
  confirmSuggestion(sourceTag: string, suggestedTag: string): boolean {
    return this.selfLearning.confirmSuggestion(sourceTag, suggestedTag)
  }

  /**
   * 获取待确认的语义关联建议
   * 替代: selfLearning.getPendingSuggestions
   */
  getPendingSuggestions(): Array<{
    sourceTag: string
    suggestedTag: string
    confidence: number
    discoveredAt: number
    confirmed: boolean
  }> {
    return this.selfLearning.getPendingSuggestions()
  }

  /**
   * 清空指定后端的数据
   * 替代: advancedMemory.clear / unifiedMemory.clearBackend
   */
  async clearBackend(backend: 'lightmemo' | 'deepmemo' | 'meshmemo' | 'diary' | 'notes'): Promise<void> {
    const services = this.getAdvancedMemoryServices()

    switch (backend) {
      case 'lightmemo':
        await services.lightMemo().clear()
        break
      case 'deepmemo':
        await services.deepMemo().clear()
        break
      case 'meshmemo':
        await services.meshMemo().clear()
        break
      case 'diary':
      case 'notes':
        // 日记和笔记通过 NoteService 清理，这里只清理索引
        await services.lightMemo().clear()
        break
    }

    logger.info('Backend cleared', { backend })
  }

  /**
   * 添加文档到指定后端
   * 替代: advancedMemory.addDocument
   */
  async addDocument(
    backend: 'lightmemo' | 'deepmemo' | 'meshmemo',
    document: { id: string; content: string; embedding?: number[]; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const services = this.getAdvancedMemoryServices()

    switch (backend) {
      case 'lightmemo':
        services.lightMemo().addDocument({
          id: document.id,
          content: document.content,
          embedding: document.embedding,
          metadata: document.metadata
        })
        break
      case 'deepmemo':
        services.deepMemo().addDocument({
          id: document.id,
          content: document.content,
          embedding: document.embedding,
          metadata: document.metadata
        })
        break
      case 'meshmemo':
        await services.meshMemo().addChunk({
          id: document.id,
          content: document.content,
          embedding: document.embedding,
          metadata: document.metadata as Record<string, unknown>
        })
        break
    }
  }

  /**
   * 获取指定后端的文档数量
   * 替代: advancedMemory.getDocumentCount
   */
  getDocumentCount(backend: 'lightmemo' | 'deepmemo' | 'meshmemo'): number {
    const services = this.getAdvancedMemoryServices()

    switch (backend) {
      case 'lightmemo':
        return services.lightMemo().getDocumentCount()
      case 'deepmemo':
        return services.deepMemo().getDocumentCount()
      case 'meshmemo':
        return services.meshMemo().getChunkCount()
      default:
        return 0
    }
  }

  /**
   * 时间感知重排序 (::Time 增强)
   *
   * 根据结果的时间戳对分数进行衰减/提升:
   * - 在指定时间范围内的结果获得提升
   * - 越接近查询时间点的结果分数越高
   * - 使用指数衰减函数: score * e^(-λ * daysDiff)
   *
   * @param results - 搜索结果
   * @param timeRange - 时间范围 (来自 ::Time 解析)
   * @param options - 重排序配置
   * @returns 重排序后的结果
   */
  private applyTimeBasedReranking(
    results: EnhancedSearchResult[],
    timeRange: { start: Date; end: Date },
    options?: {
      decayFactor?: number // 衰减因子 λ, 默认 0.1
      boostInRange?: number // 范围内的额外提升, 默认 1.5
      recencyBoost?: boolean // 是否提升近期结果, 默认 true
    }
  ): EnhancedSearchResult[] {
    const { decayFactor = 0.1, boostInRange = 1.5, recencyBoost = true } = options || {}

    const rangeCenter = (timeRange.start.getTime() + timeRange.end.getTime()) / 2
    const rangeStart = timeRange.start.getTime()
    const rangeEnd = timeRange.end.getTime()

    return results
      .map((result) => {
        let resultDate: Date | null = null

        // 尝试提取结果的日期
        if (result.metadata?.date) {
          resultDate = new Date(result.metadata.date as string)
        } else if (result.sourceFile) {
          // 从文件路径提取日期
          const dateMatch = result.sourceFile.match(/(\d{4}[-/]?\d{2}[-/]?\d{2})/)
          if (dateMatch) {
            const dateStr = dateMatch[1].replace(/[-/]/g, '')
            const year = parseInt(dateStr.slice(0, 4))
            const month = parseInt(dateStr.slice(4, 6)) - 1
            const day = parseInt(dateStr.slice(6, 8))
            resultDate = new Date(year, month, day)
          }
        }

        if (!resultDate) {
          // 无法提取日期，保持原分数
          return result
        }

        const resultTime = resultDate.getTime()
        let timeMultiplier = 1.0

        // 检查是否在时间范围内
        if (resultTime >= rangeStart && resultTime <= rangeEnd) {
          // 范围内: 提升分数，越接近中心越高
          const distanceFromCenter = Math.abs(resultTime - rangeCenter)
          const maxDistance = (rangeEnd - rangeStart) / 2
          const normalizedDistance = maxDistance > 0 ? distanceFromCenter / maxDistance : 0
          timeMultiplier = boostInRange * (1 - normalizedDistance * 0.3) // 最大衰减 30%
        } else if (recencyBoost) {
          // 范围外: 根据与范围的距离衰减
          const distanceFromRange = resultTime < rangeStart
            ? (rangeStart - resultTime) / (1000 * 60 * 60 * 24) // 天数
            : (resultTime - rangeEnd) / (1000 * 60 * 60 * 24)
          timeMultiplier = Math.exp(-decayFactor * distanceFromRange)
        }

        // 应用时间乘数到分数
        const adjustedScore = result.score * timeMultiplier

        return {
          ...result,
          score: adjustedScore,
          metadata: {
            ...result.metadata,
            _timeBoostApplied: true,
            _timeMultiplier: timeMultiplier,
            _originalTimeScore: result.score
          }
        }
      })
      .sort((a, b) => b.score - a.score) // 重新按分数排序
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.searchSessions.clear()
    this.aiMemoCache.clear()
    logger.info('IntegratedMemoryCoordinator disposed')
  }
}

// ==================== 导出 ====================

let coordinatorInstance: IntegratedMemoryCoordinator | null = null

export function getIntegratedMemoryCoordinator(): IntegratedMemoryCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = IntegratedMemoryCoordinator.getInstance()
  }
  return coordinatorInstance
}

/**
 * 便捷的智能搜索函数
 */
export async function intelligentSearch(
  query: string,
  options?: IntelligentSearchOptions
): Promise<EnhancedSearchResult[]> {
  return getIntegratedMemoryCoordinator().intelligentSearch(query, options)
}

/**
 * 便捷的创建记忆函数
 */
export async function createMemory(params: CreateMemoryParams): Promise<CreatedMemoryEntry> {
  return getIntegratedMemoryCoordinator().createMemory(params)
}
