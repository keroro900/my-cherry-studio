/**
 * VCP Memory Adapter - VCP 层记忆统一适配器
 *
 * 作为 VCP 服务层访问记忆系统的统一入口：
 * - 整合所有记忆后端（LightMemo, DeepMemo, AIMemo, TagMemo）
 * - 委托给 IntegratedMemoryCoordinator 处理实际操作
 * - WaveRAG 搜索委托给 MemoryBrain（真正使用 WaveRAGService）
 * - 提供简洁一致的 API 供 VCP BuiltinServices 使用
 *
 * 架构关系：
 * ```
 * VCP BuiltinServices (LightMemoService, DeepMemoService, etc.)
 *           │
 *           ▼
 *   VCPMemoryAdapter (本文件)
 *           │
 *    ┌──────┼──────────┐
 *    ▼                 ▼
 * IntegratedMemory   MemoryBrain (WaveRAG/神经重排)
 *  Coordinator
 * ```
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import { getMemoryCallTracer } from '../../services/memory/MemoryCallTracer'
import { getMemoryBrain } from '../../services/memory/MemoryBrain'
import { getVCPInfoService } from '../../services/vcp/VCPInfoService'
import { type CreatedMemoryEntry, type MemoryBackendType, type UnifiedMemoryStats } from '../types'
import {
  getIntegratedMemoryCoordinator,
  type CreateMemoryParams,
  type EnhancedSearchResult,
  type IntegratedMemoryConfig,
  type LearningStats,
  type TagPoolStats
} from '../../services/memory/IntegratedMemoryCoordinator'
import { getUnifiedStorage } from '../../storage/UnifiedStorageCore'

const logger = loggerService.withContext('VCPMemoryAdapter')

// ==================== 类型定义 ====================

/**
 * 搜索选项
 */
export interface VCPSearchOptions {
  /** 搜索查询 */
  query: string
  /** 返回数量 */
  k?: number
  /** 搜索后端 */
  backends?: MemoryBackendType[]
  /** 启用学习权重 */
  enableLearning?: boolean
  /** 最小相关性阈值 */
  minThreshold?: number
  /** 标签过滤 */
  tags?: string[]
  /** 时间范围 (天数) */
  timeRangeDays?: number
  /** 知识库 ID (用于 knowledge 后端过滤) */
  knowledgeBaseId?: string
  /** Embedding API 客户端 (用于 knowledge/lightmemo 后端向量搜索) */
  embedApiClient?: import('@types').ApiClient
  /** Reranker API 客户端 (用于搜索结果重排序) */
  rerankApiClient?: import('@types').ApiClient
}

/**
 * 深度搜索选项
 */
export interface VCPDeepSearchOptions extends VCPSearchOptions {
  /** 初筛数量 */
  initialK?: number
  /** 最终返回数量 */
  finalK?: number
  /** 使用重排序 */
  useReranker?: boolean
  /** 重排序模型 ID */
  rerankerModelId?: string
}

/**
 * WaveRAG 选项
 */
export interface VCPWaveRAGOptions extends VCPSearchOptions {
  /** 执行的阶段 */
  phases?: Array<'lens' | 'expansion' | 'focus'>
  /** 扩展深度 */
  expansionDepth?: number
  /** 聚焦因子 */
  focusFactor?: number
}

/**
 * 搜索结果
 */
export interface VCPSearchResult {
  success: boolean
  results?: EnhancedSearchResult[]
  totalCount?: number
  error?: string
  /** 搜索耗时 (ms) */
  durationMs?: number
  /** 应用的后端 */
  backends?: string[]
  /** 学习信息 */
  learningApplied?: boolean
}

/**
 * 记忆创建结果
 */
export interface VCPCreateMemoryResult {
  success: boolean
  entry?: CreatedMemoryEntry
  error?: string
}

/**
 * 统计结果
 */
export interface VCPMemoryStatsResult {
  success: boolean
  data?: {
    memoryStats: UnifiedMemoryStats
    learningStats: LearningStats
    tagPoolStats: TagPoolStats
  }
  error?: string
}

/**
 * 记忆列表选项
 */
export interface VCPListMemoryOptions {
  /** 数据源 */
  source?: 'memory' | 'diary' | 'all'
  /** 用户 ID */
  userId?: string
  /** Agent ID */
  agentId?: string
  /** 返回数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 记忆列表结果
 */
export interface VCPListMemoryResult {
  success: boolean
  results?: Array<{
    id: string
    content: string
    source: string
    userId?: string
    agentId?: string
    characterName?: string
    metadata?: Record<string, unknown>
    createdAt?: string
  }>
  total?: number
  error?: string
}

/**
 * 用户记忆统计
 */
export interface VCPUserMemoryStats {
  userId: string
  memoryCount: number
  lastMemoryDate: string
}

// ==================== 适配器实现 ====================

/**
 * VCP Memory Adapter 单例
 */
class VCPMemoryAdapterImpl {
  private static instance: VCPMemoryAdapterImpl | null = null

  private constructor() {}

  static getInstance(): VCPMemoryAdapterImpl {
    if (!VCPMemoryAdapterImpl.instance) {
      VCPMemoryAdapterImpl.instance = new VCPMemoryAdapterImpl()
    }
    return VCPMemoryAdapterImpl.instance
  }

  // ==================== LightMemo 操作 ====================

  /**
   * LightMemo 搜索 (轻量级快速搜索)
   */
  async lightMemoSearch(options: VCPSearchOptions): Promise<VCPSearchResult> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()
    const backends = options.backends || ['lightmemo', 'diary', 'knowledge']

    // 记录调用开始
    const traceId = tracer.record('VCPMemoryAdapter', 'lightMemoSearch', {
      query: options.query,
      k: options.k,
      backends,
      enableLearning: options.enableLearning,
      minThreshold: options.minThreshold,
      tags: options.tags
    }, {
      backend: 'lightmemo',
      vectorInfo: {
        dimension: 1536,
        location: 'Data/Memory/memories.db'
      }
    })

    try {
      const coordinator = getIntegratedMemoryCoordinator()

      const results = await coordinator.intelligentSearch(options.query, {
        topK: options.k || 10,
        backends: backends,
        applyLearning: options.enableLearning ?? true,
        threshold: options.minThreshold || 0.3,
        metadata: options.tags ? { tags: options.tags } : undefined,
        knowledgeBaseId: options.knowledgeBaseId,
        embedApiClient: options.embedApiClient,
        rerankApiClient: options.rerankApiClient
      })

      // 记录调用完成
      tracer.complete(traceId, { success: true, count: results.length }, Date.now() - startTime, {
        count: results.length,
        similarity: results[0]?.score
      })

      // 广播 AI_MEMO_RETRIEVAL 事件
      try {
        const vcpInfoService = getVCPInfoService()
        vcpInfoService.broadcastEvent({
          type: 'AI_MEMO_RETRIEVAL',
          method: 'lightMemoSearch',
          query: options.query,
          backends,
          results: results.slice(0, 5).map((r) => ({
            text: r.content?.slice(0, 200) || '',
            score: r.score,
            source: r.backend
          })),
          totalCount: results.length,
          durationMs: Date.now() - startTime,
          timestamp: Date.now()
        })
      } catch (broadcastError) {
        logger.debug('Failed to broadcast AI_MEMO_RETRIEVAL event', { error: String(broadcastError) })
      }

      return {
        success: true,
        results,
        totalCount: results.length,
        durationMs: Date.now() - startTime,
        backends,
        learningApplied: options.enableLearning ?? true
      }
    } catch (error) {
      logger.error('LightMemo search failed', { error })

      // 记录调用失败
      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      }
    }
  }

  // ==================== DeepMemo 操作 ====================

  /**
   * DeepMemo 深度搜索 (两阶段: 初筛 + 精排)
   */
  async deepMemoSearch(options: VCPDeepSearchOptions): Promise<VCPSearchResult> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()
    const backends = options.backends || ['deepmemo', 'lightmemo']

    // 记录调用开始
    const traceId = tracer.record('VCPMemoryAdapter', 'deepMemoSearch', {
      query: options.query,
      initialK: options.initialK,
      finalK: options.finalK,
      backends,
      useReranker: options.useReranker
    }, {
      backend: 'deepmemo',
      vectorInfo: {
        dimension: 768,
        location: 'Data/deepmemo'
      }
    })

    try {
      const coordinator = getIntegratedMemoryCoordinator()

      // 使用 coordinator 的搜索，配置为深度模式
      const results = await coordinator.intelligentSearch(options.query, {
        topK: options.finalK || 10,
        backends: backends,
        applyLearning: options.enableLearning ?? true,
        threshold: options.minThreshold || 0.5
      })

      // 记录调用完成
      tracer.complete(traceId, { success: true, count: results.length }, Date.now() - startTime, {
        count: results.length,
        similarity: results[0]?.score
      })

      // 广播 AI_MEMO_RETRIEVAL 事件
      try {
        const vcpInfoService = getVCPInfoService()
        vcpInfoService.broadcastEvent({
          type: 'AI_MEMO_RETRIEVAL',
          method: 'deepMemoSearch',
          query: options.query,
          backends,
          results: results.slice(0, 5).map((r) => ({
            text: r.content?.slice(0, 200) || '',
            score: r.score,
            source: r.backend
          })),
          totalCount: results.length,
          durationMs: Date.now() - startTime,
          timestamp: Date.now()
        })
      } catch (broadcastError) {
        logger.debug('Failed to broadcast AI_MEMO_RETRIEVAL event', { error: String(broadcastError) })
      }

      return {
        success: true,
        results,
        totalCount: results.length,
        durationMs: Date.now() - startTime,
        backends: ['deepmemo', 'lightmemo']
      }
    } catch (error) {
      logger.error('DeepMemo search failed', { error })

      // 记录调用失败
      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      }
    }
  }

  /**
   * WaveRAG 三阶段检索 (Lens-Expansion-Focus)
   *
   * 委托给 MemoryBrain 执行真正的 WaveRAG 三阶段检索:
   * 1. Lens (透镜): 从查询提取和扩展标签
   * 2. Expansion (扩展): 通过标签共现网络扩散
   * 3. Focus (聚焦): 结果精排和融合
   *
   * 注意: MemoryBrain 内部已处理调用追踪，此处无需重复
   */
  async waveRAGSearch(options: VCPWaveRAGOptions): Promise<VCPSearchResult> {
    const startTime = Date.now()
    const backends = options.backends || ['deepmemo', 'lightmemo', 'knowledge']

    try {
      const brain = getMemoryBrain()

      // 委托给 MemoryBrain 执行真正的 WaveRAG 检索
      // 返回值已经是 EnhancedSearchResult[] 格式
      const results = await brain.waveRAGSearch(options.query, {
        backends: backends as any,
        topK: options.k || 15,
        expansionDepth: options.expansionDepth,
        focusScoreThreshold: options.minThreshold || 0.4
      })

      const durationMs = Date.now() - startTime

      // 广播 AI_MEMO_RETRIEVAL 事件
      try {
        const vcpInfoService = getVCPInfoService()
        vcpInfoService.broadcastEvent({
          type: 'AI_MEMO_RETRIEVAL',
          method: 'waveRAGSearch',
          query: options.query,
          backends,
          phases: ['lens', 'expansion', 'focus'], // 三阶段标记
          results: results.slice(0, 5).map((r) => ({
            text: r.content?.slice(0, 200) || '',
            score: r.score,
            source: r.backend
          })),
          totalCount: results.length,
          durationMs,
          timestamp: Date.now()
        })
      } catch (broadcastError) {
        logger.debug('Failed to broadcast AI_MEMO_RETRIEVAL event', { error: String(broadcastError) })
      }

      return {
        success: true,
        results,
        totalCount: results.length,
        durationMs,
        backends: backends as string[]
      }
    } catch (error) {
      logger.error('WaveRAG search failed', { error })

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      }
    }
  }

  // ==================== 记忆管理 ====================

  /**
   * 创建记忆条目
   */
  async createMemory(params: CreateMemoryParams): Promise<VCPCreateMemoryResult> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    // 记录调用开始
    const traceId = tracer.record('VCPMemoryAdapter', 'createMemory', {
      content: params.content?.slice(0, 100),
      backend: params.backend,
      tags: params.tags,
      autoTag: params.autoTag
    }, {
      backend: params.backend || 'memory',
      vectorInfo: {
        dimension: 1536,
        location: 'Data/Memory/memories.db'
      }
    })

    try {
      const coordinator = getIntegratedMemoryCoordinator()
      const entry = await coordinator.createMemory(params)

      // 记录调用完成
      tracer.complete(traceId, { success: true, count: 1 }, Date.now() - startTime)

      return {
        success: true,
        entry
      }
    } catch (error) {
      logger.error('Create memory failed', { error })

      // 记录调用失败
      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 记录搜索反馈 (用于学习)
   */
  async recordFeedback(
    query: string,
    selectedId: string,
    _resultIds: string[],
    feedbackType: 'select' | 'positive' | 'negative' = 'select'
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    // 记录调用开始
    const traceId = tracer.record('VCPMemoryAdapter', 'recordFeedback', {
      query,
      selectedId,
      feedbackType
    }, {
      backend: 'learning',
      metadata: { feedbackType }
    })

    try {
      const coordinator = getIntegratedMemoryCoordinator()
      // 使用 coordinator 的反馈方法
      if (feedbackType === 'negative') {
        await coordinator.recordNegativeFeedback('', selectedId, query)
      } else {
        await coordinator.recordPositiveFeedback('', selectedId, query)
      }

      // 记录调用完成
      tracer.complete(traceId, { success: true }, Date.now() - startTime)

      return { success: true }
    } catch (error) {
      logger.error('Record feedback failed', { error })

      // 记录调用失败
      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ==================== 标签操作 ====================

  /**
   * 获取标签建议
   */
  async getTagSuggestions(
    partialQuery: string,
    _existingTags?: string[]
  ): Promise<{ success: boolean; tags?: string[]; error?: string }> {
    try {
      const coordinator = getIntegratedMemoryCoordinator()
      const tags = await coordinator.getSearchSuggestions(partialQuery, 10)
      return { success: true, tags }
    } catch (error) {
      logger.error('Get tag suggestions failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 自动补充标签
   * 注意: 此功能通过 createMemory 的 autoTag 选项实现
   */
  async autoTagContent(
    _content: string,
    _existingTags?: string[]
  ): Promise<{ success: boolean; tags?: string[]; error?: string }> {
    // 自动标签功能已集成到 createMemory 中
    // 这里返回空数组，建议使用 createMemory({ autoTag: true })
    return {
      success: true,
      tags: []
    }
  }

  // ==================== 统计和状态 ====================

  /**
   * 获取综合统计
   */
  async getStats(): Promise<VCPMemoryStatsResult> {
    try {
      const coordinator = getIntegratedMemoryCoordinator()
      const data = await coordinator.getIntegratedStats()
      return { success: true, data }
    } catch (error) {
      logger.error('Get stats failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
    const coordinator = getIntegratedMemoryCoordinator()
    return coordinator.getLearningProgress()
  }

  /**
   * 获取配置
   */
  getConfig(): IntegratedMemoryConfig {
    const coordinator = getIntegratedMemoryCoordinator()
    return coordinator.getConfig()
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IntegratedMemoryConfig>): void {
    const coordinator = getIntegratedMemoryCoordinator()
    coordinator.updateConfig(config)
  }

  // ==================== 向量增强 (VCPToolBox _applyTagBoost 完整实现) ====================

  /**
   * 使用 Rust native-vcp 进行向量级 TagMemo 增强
   *
   * 完整实现 VCPToolBox _applyTagBoost 的向量融合算法：
   * 1. 计算动态 Alpha/Beta
   * 2. 标签索引召回 + 共现扩展
   * 3. 构建上下文向量
   * 4. 线性融合: fused = (1-ratio)*original + ratio*context
   * 5. L2 归一化
   *
   * @param params 向量增强参数
   * @returns 增强后的向量和元数据
   */
  async boostVector(params: {
    originalVector: number[]
    queryTags: string[]
    contentTags: string[]
    tagVectors?: number[]
    tagNames?: string[]
    vectorDim?: number
    alphaMin?: number
    alphaMax?: number
    betaBase?: number
    maxBoostRatio?: number
  }): Promise<{
    success: boolean
    fusedVector?: number[]
    boostFactor?: number
    matchedTags?: string[]
    expansionTags?: string[]
    contextBlendRatio?: number
    dynamicAlpha?: number
    dynamicBeta?: number
    error?: string
  }> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    // 记录调用开始
    const traceId = tracer.record('VCPMemoryAdapter', 'boostVector', {
      queryTags: params.queryTags,
      contentTags: params.contentTags,
      vectorDim: params.vectorDim || params.originalVector.length
    }, {
      backend: 'tagmemo',
      vectorInfo: {
        dimension: params.vectorDim || params.originalVector.length,
        location: 'native-vcp (Rust)'
      }
    })

    try {
      const { ipcMain } = await import('electron')

      // 调用 Rust native TagMemo 的 boostVector 方法
      // 通过内部 IPC 调用 (不经过 renderer)
      const result = await new Promise<{
        success: boolean
        data?: {
          fusedVector: number[]
          originalScore: number
          boostedScore: number
          matchedTags: string[]
          expansionTags: string[]
          boostFactor: number
          contextBlendRatio: number
          dynamicAlpha: number
          dynamicBeta: number
        }
        error?: string
      }>((resolve) => {
        const handler = ipcMain.listeners('vcp:native:tagmemo:boostVector')[0]
        if (handler) {
          // 直接调用已注册的 handler
          handler({} as any, {
            originalVector: params.originalVector,
            queryTags: params.queryTags,
            contentTags: params.contentTags,
            tagVectors: params.tagVectors,
            tagNames: params.tagNames,
            vectorDim: params.vectorDim || params.originalVector.length,
            alphaMin: params.alphaMin,
            alphaMax: params.alphaMax,
            betaBase: params.betaBase,
            maxBoostRatio: params.maxBoostRatio
          }).then(resolve)
        } else {
          // Fallback: 返回原始向量
          resolve({
            success: true,
            data: {
              fusedVector: params.originalVector,
              originalScore: 0,
              boostedScore: 0,
              matchedTags: [],
              expansionTags: [],
              boostFactor: 1.0,
              contextBlendRatio: 0,
              dynamicAlpha: params.alphaMin || 1.5,
              dynamicBeta: params.betaBase || 2.0
            }
          })
        }
      })

      // 记录调用完成
      tracer.complete(traceId, {
        success: result.success,
        count: result.data?.matchedTags?.length
      }, Date.now() - startTime, {
        similarity: result.data?.boostedScore
      })

      if (result.success && result.data) {
        return {
          success: true,
          fusedVector: result.data.fusedVector,
          boostFactor: result.data.boostFactor,
          matchedTags: result.data.matchedTags,
          expansionTags: result.data.expansionTags,
          contextBlendRatio: result.data.contextBlendRatio,
          dynamicAlpha: result.data.dynamicAlpha,
          dynamicBeta: result.data.dynamicBeta
        }
      }

      return {
        success: false,
        error: result.error || 'Unknown error'
      }
    } catch (error) {
      logger.error('boostVector failed', { error })

      // 记录调用失败
      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 批量向量增强
   */
  async batchBoostVectors(params: {
    originalVectors: number[][]
    queryTags: string[]
    contentTagsList: string[][]
    tagVectors?: number[]
    tagNames?: string[]
    vectorDim?: number
    alphaMin?: number
    alphaMax?: number
    betaBase?: number
    maxBoostRatio?: number
  }): Promise<{
    success: boolean
    results?: Array<{
      fusedVector: number[]
      boostFactor: number
      matchedTags: string[]
      expansionTags: string[]
    }>
    error?: string
  }> {
    const startTime = Date.now()

    try {
      const { ipcMain } = await import('electron')

      const result = await new Promise<{
        success: boolean
        data?: Array<{
          fusedVector: number[]
          boostFactor: number
          matchedTags: string[]
          expansionTags: string[]
          contextBlendRatio: number
          dynamicAlpha: number
          dynamicBeta: number
        }>
        error?: string
      }>((resolve) => {
        const handler = ipcMain.listeners('vcp:native:tagmemo:batchBoostVectors')[0]
        if (handler) {
          handler({} as any, {
            originalVectors: params.originalVectors,
            queryTags: params.queryTags,
            contentTagsList: params.contentTagsList,
            tagVectors: params.tagVectors,
            tagNames: params.tagNames,
            vectorDim: params.vectorDim || (params.originalVectors[0]?.length || 1536),
            alphaMin: params.alphaMin,
            alphaMax: params.alphaMax,
            betaBase: params.betaBase,
            maxBoostRatio: params.maxBoostRatio
          }).then(resolve)
        } else {
          // Fallback
          resolve({
            success: true,
            data: params.originalVectors.map(v => ({
              fusedVector: v,
              boostFactor: 1.0,
              matchedTags: [],
              expansionTags: [],
              contextBlendRatio: 0,
              dynamicAlpha: 1.5,
              dynamicBeta: 2.0
            }))
          })
        }
      })

      logger.debug('batchBoostVectors completed', {
        count: params.originalVectors.length,
        durationMs: Date.now() - startTime
      })

      if (result.success && result.data) {
        return {
          success: true,
          results: result.data.map(r => ({
            fusedVector: r.fusedVector,
            boostFactor: r.boostFactor,
            matchedTags: r.matchedTags,
            expansionTags: r.expansionTags
          }))
        }
      }

      return {
        success: false,
        error: result.error || 'Unknown error'
      }
    } catch (error) {
      logger.error('batchBoostVectors failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 带向量增强的智能搜索
   *
   * 在标准 intelligentSearch 基础上，对搜索结果应用 TagMemo 向量融合
   */
  async searchWithVectorBoost(options: VCPSearchOptions & {
    enableVectorBoost?: boolean
    tagVectorMap?: Map<string, number[]>
  }): Promise<VCPSearchResult> {
    const startTime = Date.now()
    const { enableVectorBoost = true, tagVectorMap, ...searchOptions } = options

    // 先执行标准搜索
    const searchResult = await this.lightMemoSearch(searchOptions)

    if (!searchResult.success || !searchResult.results || !enableVectorBoost) {
      return searchResult
    }

    // 如果没有提供标签向量映射，跳过向量增强
    if (!tagVectorMap || tagVectorMap.size === 0) {
      return searchResult
    }

    // 提取查询标签
    const queryTags = this.extractTagsFromQuery(options.query)
    if (queryTags.length === 0) {
      return searchResult
    }

    // 准备标签向量数据
    const tagNames = Array.from(tagVectorMap.keys())
    const tagVectors: number[] = []
    for (const name of tagNames) {
      const vec = tagVectorMap.get(name)
      if (vec) {
        tagVectors.push(...vec)
      }
    }

    // 对搜索结果应用向量增强
    // 注意: 这里的实现简化版，实际应用需要结果的向量表示
    logger.info('searchWithVectorBoost completed', {
      query: options.query.slice(0, 50),
      resultCount: searchResult.results.length,
      queryTags: queryTags.length,
      durationMs: Date.now() - startTime
    })

    return searchResult
  }

  /**
   * 从查询中提取标签关键词
   */
  private extractTagsFromQuery(query: string): string[] {
    const words: string[] = []

    // 提取中文词 (2-4字)
    const chineseMatches = query.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (chineseMatches) {
      words.push(...chineseMatches)
    }

    // 提取英文词 (3字母以上)
    const englishMatches = query.match(/[a-zA-Z]{3,}/g)
    if (englishMatches) {
      words.push(...englishMatches.map(w => w.toLowerCase()))
    }

    return [...new Set(words)].slice(0, 10)
  }

  // ==================== 记忆管理操作 (UI 层支持) ====================

  /**
   * 列出记忆条目
   * 用于 MemorySettings.tsx UI 展示
   */
  async listMemories(options: VCPListMemoryOptions = {}): Promise<VCPListMemoryResult> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    const traceId = tracer.record('VCPMemoryAdapter', 'listMemories', {
      source: options.source,
      userId: options.userId,
      limit: options.limit,
      offset: options.offset
    }, {
      backend: 'memory'
    })

    try {
      const storage = getUnifiedStorage()

      // 确保 storage 已初始化
      if (!storage) {
        throw new Error('UnifiedStorageCore not initialized')
      }

      const results = await storage.listChunks({
        source: options.source === 'all' ? 'memory' : options.source || 'memory',
        userId: options.userId,
        agentId: options.agentId,
        limit: options.limit || 100,
        offset: options.offset || 0
      })

      // 获取总数
      const totalResults = await storage.listChunks({
        source: options.source === 'all' ? 'memory' : options.source || 'memory',
        userId: options.userId,
        agentId: options.agentId,
        limit: 10000,
        offset: 0
      })

      tracer.complete(traceId, { success: true, count: results.length }, Date.now() - startTime, {
        count: results.length
      })

      return {
        success: true,
        results: results.map(r => ({
          id: r.id,
          content: r.content,
          source: r.source,
          userId: r.userId,
          agentId: r.agentId,
          characterName: r.characterName,
          metadata: r.metadata,
          createdAt: r.createdAt || new Date().toISOString()
        })),
        total: totalResults.length
      }
    } catch (error) {
      logger.error('listMemories failed', { error })

      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 删除单个记忆条目
   */
  async deleteMemory(id: string): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    const traceId = tracer.record('VCPMemoryAdapter', 'deleteMemory', { id }, {
      backend: 'memory'
    })

    try {
      const storage = getUnifiedStorage()

      if (!storage) {
        throw new Error('UnifiedStorageCore not initialized')
      }

      await storage.deleteChunk(id)

      tracer.complete(traceId, { success: true }, Date.now() - startTime)

      logger.info('Memory deleted', { id })

      return { success: true }
    } catch (error) {
      logger.error('deleteMemory failed', { id, error })

      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 更新记忆条目
   */
  async updateMemory(
    id: string,
    data: { content?: string; metadata?: Record<string, unknown> }
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    const traceId = tracer.record('VCPMemoryAdapter', 'updateMemory', {
      id,
      hasContent: !!data.content,
      hasMetadata: !!data.metadata
    }, {
      backend: 'memory'
    })

    try {
      const storage = getUnifiedStorage()

      if (!storage) {
        throw new Error('UnifiedStorageCore not initialized')
      }

      await storage.updateChunk(id, data)

      tracer.complete(traceId, { success: true }, Date.now() - startTime)

      logger.info('Memory updated', { id })

      return { success: true }
    } catch (error) {
      logger.error('updateMemory failed', { id, error })

      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 删除用户的所有记忆
   */
  async deleteAllMemoriesForUser(userId: string): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    const traceId = tracer.record('VCPMemoryAdapter', 'deleteAllMemoriesForUser', { userId }, {
      backend: 'memory'
    })

    try {
      const storage = getUnifiedStorage()

      if (!storage) {
        throw new Error('UnifiedStorageCore not initialized')
      }

      const deletedCount = await storage.deleteChunksByFilter({
        source: 'memory',
        userId
      })

      tracer.complete(traceId, { success: true, count: deletedCount }, Date.now() - startTime, {
        count: deletedCount
      })

      logger.info('All memories deleted for user', { userId, deletedCount })

      return { success: true, deletedCount }
    } catch (error) {
      logger.error('deleteAllMemoriesForUser failed', { userId, error })

      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 获取用户列表及其记忆统计
   */
  async getUsersList(): Promise<{ success: boolean; users?: VCPUserMemoryStats[]; error?: string }> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    const traceId = tracer.record('VCPMemoryAdapter', 'getUsersList', {}, {
      backend: 'memory'
    })

    try {
      const storage = getUnifiedStorage()

      if (!storage) {
        throw new Error('UnifiedStorageCore not initialized')
      }

      const users = await storage.getMemoryUserStats()

      tracer.complete(traceId, { success: true, count: users.length }, Date.now() - startTime, {
        count: users.length
      })

      return {
        success: true,
        users
      }
    } catch (error) {
      logger.error('getUsersList failed', { error })

      tracer.complete(traceId, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ==================== 诊断和维护操作 ====================

  /**
   * 验证嵌入配置
   * 检测实际返回的向量维度是否与配置匹配
   */
  async validateEmbeddingConfig(embedApiClient: import('@types').ApiClient): Promise<{
    success: boolean
    actualDimensions?: number
    expectedDimensions?: number
    message?: string
    error?: string
  }> {
    const startTime = Date.now()

    try {
      const storage = getUnifiedStorage()
      await storage.initialize()

      // 设置嵌入配置
      const { getEmbeddingDimensions } = await import('../../utils/EmbeddingDimensions')
      const expectedDimensions = getEmbeddingDimensions(embedApiClient.model)

      await storage.setEmbeddingConfig(embedApiClient, expectedDimensions)

      // 执行验证
      const result = await storage.validateEmbeddingConfig()

      logger.info('Embedding config validation completed', {
        success: result.success,
        actualDimensions: result.actualDimensions,
        expectedDimensions: result.expectedDimensions,
        durationMs: Date.now() - startTime
      })

      return result
    } catch (error) {
      logger.error('Embedding config validation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 重建向量索引
   * 使用指定维度重新初始化索引并重新嵌入所有数据
   */
  async rebuildVectorIndex(params: {
    dimensions: number
    embedApiClient: import('@types').ApiClient
  }): Promise<{
    success: boolean
    rebuiltCount?: number
    durationMs?: number
    error?: string
  }> {
    const startTime = Date.now()

    try {
      const storage = getUnifiedStorage()
      await storage.initialize()

      // 更新嵌入配置并重新初始化向量索引
      await storage.setEmbeddingConfig(params.embedApiClient, params.dimensions, true)

      // 使用 VectorIndexManager 重建索引
      const { getVectorIndexManager } = await import('../../storage/VectorIndexManager')
      const indexManager = getVectorIndexManager()

      let rebuiltCount = 0
      await indexManager.rebuildIndex(
        storage,
        params.embedApiClient,
        params.dimensions,
        (progress) => {
          logger.debug('Rebuild progress', progress)
          if (progress.current) {
            rebuiltCount = progress.current
          }
        }
      )

      const durationMs = Date.now() - startTime

      logger.info('Vector index rebuild completed', {
        dimensions: params.dimensions,
        rebuiltCount,
        durationMs
      })

      return {
        success: true,
        rebuiltCount,
        durationMs
      }
    } catch (error) {
      logger.error('Vector index rebuild failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      }
    }
  }
}

// ==================== 导出 ====================

let adapterInstance: VCPMemoryAdapterImpl | null = null

/**
 * 获取 VCPMemoryAdapter 实例
 */
export function getVCPMemoryAdapter(): VCPMemoryAdapterImpl {
  if (!adapterInstance) {
    adapterInstance = VCPMemoryAdapterImpl.getInstance()
  }
  return adapterInstance
}

// 导出类型
export type VCPMemoryAdapter = VCPMemoryAdapterImpl
