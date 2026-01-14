/**
 * MemoryBrain - 统一记忆大脑
 *
 * 作为所有记忆系统的中央协调器和任务分配大脑：
 * - 统一管理知识库、日记、全局记忆
 * - 智能路由搜索请求到最佳后端
 * - 集成神经网络重排序
 * - 支持 WaveRAG 三阶段检索
 * - 集成调用追踪 (MemoryCallTracer)
 * - 提供统一的记忆操作 API
 *
 * 设计理念来自 VCP 的统一管理和任务分配概念。
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import {
  getIntegratedMemoryCoordinator,
  type CreateMemoryParams,
  type EnhancedSearchResult,
  type IntegratedMemoryConfig,
  type IntelligentSearchOptions,
  type MemoryBackendType
} from './IntegratedMemoryCoordinator'
import { getMemoryCallTracer } from './MemoryCallTracer'
import { getNeuralRerankService, type NeuralRerankConfig, type RerankModelConfig } from '../native/NeuralRerankService'
import { unifiedRerank, type RerankItem, type RerankMode } from '../native/RerankUtils'
// WaveRAG 直接使用 IntegratedMemoryCoordinator 的 Rust 原生实现
import type { WaveRAGConfig, WaveRAGResult } from '../native/NativeVCPBridge'

const logger = loggerService.withContext('MemoryBrain')

// ==================== 类型定义 ====================

/**
 * 记忆任务类型
 */
export type MemoryTaskType =
  | 'search' // 搜索记忆
  | 'create' // 创建记忆
  | 'organize' // 整理记忆
  | 'learn' // 学习反馈
  | 'synthesize' // AI 合成
  | 'rerank' // 重排序

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * 任务路由策略
 */
export type RoutingStrategy =
  | 'fastest' // 最快响应
  | 'quality' // 最高质量
  | 'balanced' // 平衡
  | 'cost_efficient' // 成本优先

/**
 * MemoryBrain 配置
 */
export interface MemoryBrainConfig {
  /** 基础记忆协调器配置 */
  coordinator: IntegratedMemoryConfig

  /** 神经重排配置 */
  neuralRerank: NeuralRerankConfig

  /** WaveRAG 配置 */
  waveRAG: WaveRAGConfig

  /** 任务路由策略 */
  routing: {
    /** 默认路由策略 */
    defaultStrategy: RoutingStrategy
    /** 搜索任务默认后端优先级 */
    searchBackendPriority: MemoryBackendType[]
    /** 是否启用自动后端选择 */
    autoBackendSelection: boolean
    /** 结果合并使用 RRF */
    useRRFMerge: boolean
    /** RRF K 值 */
    rrfK: number
  }

  /** 重排配置 */
  rerank: {
    /** 默认重排模式 */
    defaultMode: RerankMode
    /** 触发神经重排的最小结果数 */
    neuralMinResults: number
    /** 重排后保留的最大结果数 */
    maxResultsAfterRerank: number
  }

  /** 性能配置 */
  performance: {
    /** 搜索超时 (ms) */
    searchTimeout: number
    /** 重排超时 (ms) */
    rerankTimeout: number
    /** 是否启用并行搜索 */
    parallelSearch: boolean
    /** 最大并行搜索数 */
    maxParallelSearches: number
  }

  /** 调用追踪配置 */
  tracing: {
    /** 是否启用追踪 */
    enabled: boolean
  }
}

/**
 * 搜索任务参数
 */
export interface SearchTaskParams extends IntelligentSearchOptions {
  /** 任务优先级 */
  priority?: TaskPriority
  /** 路由策略 */
  routingStrategy?: RoutingStrategy
  /** 重排模式 */
  rerankMode?: RerankMode
  /** 是否启用 AI 合成 */
  enableSynthesis?: boolean
  /** 合成选项 */
  synthesisOptions?: {
    modelId?: string
    providerId?: string
  }
}

/**
 * 搜索任务结果
 */
export interface SearchTaskResult {
  /** 搜索结果 */
  results: EnhancedSearchResult[]
  /** 合成内容 (如启用) */
  synthesizedContent?: string
  /** 元数据 */
  metadata: {
    /** 使用的后端 */
    usedBackends: MemoryBackendType[]
    /** 是否使用了神经重排 */
    usedNeuralRerank: boolean
    /** 重排模式 */
    rerankMode: RerankMode
    /** 是否使用了 AI 合成 */
    usedSynthesis: boolean
    /** 总耗时 (ms) */
    totalDurationMs: number
    /** 各阶段耗时 */
    phaseDurations: {
      search: number
      rerank: number
      synthesis: number
    }
  }
}

// ==================== MemoryBrain ====================

export class MemoryBrain {
  private static instance: MemoryBrain | null = null

  private config: MemoryBrainConfig

  private constructor() {
    this.config = this.getDefaultConfig()
    logger.info('MemoryBrain initialized')
  }

  static getInstance(): MemoryBrain {
    if (!MemoryBrain.instance) {
      MemoryBrain.instance = new MemoryBrain()
    }
    return MemoryBrain.instance
  }

  // ==================== 配置 ====================

  private getDefaultConfig(): MemoryBrainConfig {
    return {
      coordinator: {
        memoryMaster: {
          enabled: true,
          autoTagOnCreate: true,
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
          defaultBackends: ['diary', 'deepmemo', 'lightmemo', 'memory', 'knowledge'],
          useRRF: true,
          rrfK: 60,
          defaultTopK: 10,
          minThreshold: 0.1
        }
      },
      neuralRerank: {
        enabled: false,
        fallbackToLocal: true,
        maxDocuments: 100,
        minScore: 0.0,
        timeout: 30000
      },
      waveRAG: {
        lensMaxTags: 10,
        expansionDepth: 2,
        expansionThreshold: 0.3,
        expansionMaxTags: 20,
        focusTopK: 10,
        focusScoreThreshold: 0.5,
        tagMemoWeight: 0.65
      },
      routing: {
        defaultStrategy: 'balanced',
        searchBackendPriority: ['diary', 'knowledge', 'memory', 'deepmemo', 'lightmemo'],
        autoBackendSelection: true,
        useRRFMerge: true,
        rrfK: 60
      },
      rerank: {
        defaultMode: 'auto',
        neuralMinResults: 5,
        maxResultsAfterRerank: 20
      },
      performance: {
        searchTimeout: 10000,
        rerankTimeout: 30000,
        parallelSearch: true,
        maxParallelSearches: 3
      },
      tracing: {
        enabled: true
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<MemoryBrainConfig>): void {
    if (updates.coordinator) {
      this.config.coordinator = { ...this.config.coordinator, ...updates.coordinator }
      // 同步到协调器
      getIntegratedMemoryCoordinator().updateConfig(this.config.coordinator)
    }
    if (updates.neuralRerank) {
      this.config.neuralRerank = { ...this.config.neuralRerank, ...updates.neuralRerank }
      // 同步到神经重排服务
      getNeuralRerankService().updateConfig(this.config.neuralRerank)
    }
    if (updates.waveRAG) {
      this.config.waveRAG = { ...this.config.waveRAG, ...updates.waveRAG }
    }
    if (updates.routing) {
      this.config.routing = { ...this.config.routing, ...updates.routing }
    }
    if (updates.rerank) {
      this.config.rerank = { ...this.config.rerank, ...updates.rerank }
    }
    if (updates.performance) {
      this.config.performance = { ...this.config.performance, ...updates.performance }
    }
    if (updates.tracing !== undefined) {
      this.config.tracing = { ...this.config.tracing, ...updates.tracing }
      // 同步到追踪器
      getMemoryCallTracer().setEnabled(this.config.tracing.enabled)
    }

    logger.info('MemoryBrain config updated')
  }

  /**
   * 获取当前配置
   */
  getConfig(): MemoryBrainConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * 配置神经重排模型
   */
  configureNeuralRerank(model: RerankModelConfig): void {
    this.config.neuralRerank.enabled = true
    this.config.neuralRerank.model = model
    getNeuralRerankService().updateConfig({
      enabled: true,
      model
    })
    logger.info('Neural rerank model configured', { provider: model.provider, modelId: model.id })
  }

  // ==================== 核心任务方法 ====================

  /**
   * 执行搜索任务
   *
   * 中央搜索入口，自动处理:
   * 1. 后端路由选择
   * 2. 并行搜索执行
   * 3. 结果合并 (RRF)
   * 4. 智能重排序 (本地/神经)
   * 5. AI 合成 (可选)
   */
  async search(query: string, params?: SearchTaskParams): Promise<SearchTaskResult> {
    const startTime = Date.now()
    const phaseDurations = { search: 0, rerank: 0, synthesis: 0 }
    const tracer = getMemoryCallTracer()

    const coordinator = getIntegratedMemoryCoordinator()

    // 确定后端
    const backends = params?.backends || this.selectBackends(query, params?.routingStrategy)

    // 确定重排模式
    const rerankMode = params?.rerankMode || this.config.rerank.defaultMode

    // 开始追踪
    const traceId = this.config.tracing.enabled
      ? tracer.record('MemoryBrain', 'search', {
          query: query.slice(0, 100),
          backends,
          rerankMode,
          enableSynthesis: params?.enableSynthesis
        }, {
          backend: 'unified',
          metadata: { strategy: params?.routingStrategy || this.config.routing.defaultStrategy }
        })
      : null

    logger.info('MemoryBrain search started', {
      query: query.slice(0, 50),
      backends,
      rerankMode
    })

    try {
      // Phase 1: 搜索
      const searchStart = Date.now()
      const searchResults = await coordinator.intelligentSearch(query, {
        ...params,
        backends: backends as any
      })
      phaseDurations.search = Date.now() - searchStart

      // Phase 2: 重排序
      const rerankStart = Date.now()
      let finalResults = searchResults
      let usedNeuralRerank = false

      if (searchResults.length > 3) {
        const rerankItems: RerankItem<EnhancedSearchResult>[] = searchResults.map((r) => ({
          item: r,
          content: r.content,
          score: r.score
        }))

        const rerankResult = await unifiedRerank(query, rerankItems, {
          mode: rerankMode,
          neuralMinItems: this.config.rerank.neuralMinResults
        })

        finalResults = rerankResult.results
          .slice(0, this.config.rerank.maxResultsAfterRerank)
          .map((r) => r.item)
        usedNeuralRerank = rerankResult.usedNeural
      }
      phaseDurations.rerank = Date.now() - rerankStart

      // Phase 3: AI 合成 (可选)
      let synthesizedContent: string | undefined
      if (params?.enableSynthesis && finalResults.length > 0) {
        const synthesisStart = Date.now()
        try {
          const synthesisResult = await coordinator.searchWithSynthesis(query, [], {
            maxResults: Math.min(finalResults.length, 10),
            modelId: params.synthesisOptions?.modelId,
            providerId: params.synthesisOptions?.providerId
          })
          synthesizedContent = synthesisResult.synthesizedMemory
        } catch (error) {
          logger.warn('AI synthesis failed', { error: String(error) })
        }
        phaseDurations.synthesis = Date.now() - synthesisStart
      }

      const totalDurationMs = Date.now() - startTime

      // 完成追踪
      if (traceId && this.config.tracing.enabled) {
        tracer.complete(traceId, {
          success: true,
          count: finalResults.length
        }, totalDurationMs, {
          count: finalResults.length,
          similarity: finalResults[0]?.score
        })
      }

      logger.info('MemoryBrain search completed', {
        resultCount: finalResults.length,
        usedNeuralRerank,
        totalDurationMs
      })

      return {
        results: finalResults,
        synthesizedContent,
        metadata: {
          usedBackends: backends as MemoryBackendType[],
          usedNeuralRerank,
          rerankMode,
          usedSynthesis: !!synthesizedContent,
          totalDurationMs,
          phaseDurations
        }
      }
    } catch (error) {
      // 记录追踪失败
      if (traceId && this.config.tracing.enabled) {
        tracer.complete(traceId, {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, Date.now() - startTime)
      }

      logger.error('MemoryBrain search failed', error as Error)
      throw error
    }
  }

  /**
   * 创建记忆
   */
  async createMemory(params: CreateMemoryParams) {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    const traceId = this.config.tracing.enabled
      ? tracer.record('MemoryBrain', 'createMemory', {
          content: params.content?.slice(0, 100),
          backend: params.backend,
          tags: params.tags,
          autoTag: params.autoTag
        }, {
          backend: params.backend || 'memory'
        })
      : null

    try {
      const result = await getIntegratedMemoryCoordinator().createMemory(params)

      if (traceId && this.config.tracing.enabled) {
        tracer.complete(traceId, { success: true, count: 1 }, Date.now() - startTime)
      }

      return result
    } catch (error) {
      if (traceId && this.config.tracing.enabled) {
        tracer.complete(traceId, {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, Date.now() - startTime)
      }
      throw error
    }
  }

  /**
   * WaveRAG 三阶段检索 (Lens-Expansion-Focus)
   *
   * 直接使用 IntegratedMemoryCoordinator 的 Rust 原生 WaveRAGEngine 实现:
   * 1. Lens (透镜): 从查询提取和扩展标签
   * 2. Expansion (扩展): 通过标签共现网络扩散
   * 3. Focus (聚焦): 结果精排和融合
   *
   * @deprecated 推荐直接使用 IntegratedMemoryCoordinator.intelligentSearch({ useWaveRAG: true })
   */
  async waveRAGSearch(
    query: string,
    options?: {
      backends?: MemoryBackendType[]
      topK?: number
      expansionDepth?: number
      focusScoreThreshold?: number
    }
  ): Promise<EnhancedSearchResult[]> {
    const startTime = Date.now()
    const tracer = getMemoryCallTracer()

    const traceId = this.config.tracing.enabled
      ? tracer.record('MemoryBrain', 'waveRAGSearch', {
          query: query.slice(0, 100),
          backends: options?.backends,
          topK: options?.topK
        }, {
          backend: 'waverag',
          metadata: { phase: 'lens-expansion-focus' }
        })
      : null

    try {
      const coordinator = getIntegratedMemoryCoordinator()
      const backends = options?.backends || ['deepmemo', 'lightmemo', 'knowledge']

      // 直接使用 IntegratedMemoryCoordinator 的 Rust 原生 WaveRAG 实现
      const results = await coordinator.intelligentSearch(query, {
        topK: options?.topK ?? this.config.waveRAG.focusTopK,
        backends: backends as MemoryBackendType[],
        threshold: options?.focusScoreThreshold ?? this.config.waveRAG.focusScoreThreshold,
        useWaveRAG: true, // 启用 Rust 原生 WaveRAG 三阶段检索
        useTagMemo: true,
        applyLearning: true
      })

      if (traceId && this.config.tracing.enabled) {
        tracer.complete(traceId, {
          success: true,
          count: results.length
        }, Date.now() - startTime, {
          count: results.length,
          similarity: results[0]?.score
        })
      }

      logger.info('WaveRAG search completed (native)', {
        query: query.slice(0, 50),
        resultCount: results.length,
        totalTime: Date.now() - startTime
      })

      return results
    } catch (error) {
      if (traceId && this.config.tracing.enabled) {
        tracer.complete(traceId, {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, Date.now() - startTime)
      }

      logger.error('WaveRAG search failed', error as Error)
      throw error
    }
  }

  /**
   * 快速搜索 (仅本地重排，无 AI 合成)
   */
  async quickSearch(
    query: string,
    options?: {
      backends?: MemoryBackendType[]
      topK?: number
    }
  ): Promise<EnhancedSearchResult[]> {
    const result = await this.search(query, {
      backends: options?.backends,
      topK: options?.topK,
      rerankMode: 'local',
      enableSynthesis: false
    })
    return result.results
  }

  /**
   * 深度搜索 (神经重排 + AI 合成)
   */
  async deepSearch(
    query: string,
    options?: {
      backends?: MemoryBackendType[]
      topK?: number
      modelId?: string
      providerId?: string
    }
  ): Promise<SearchTaskResult> {
    return this.search(query, {
      backends: options?.backends,
      topK: options?.topK,
      rerankMode: 'neural',
      enableSynthesis: true,
      synthesisOptions: {
        modelId: options?.modelId,
        providerId: options?.providerId
      }
    })
  }

  // ==================== 智能路由 ====================

  /**
   * 根据查询和策略选择后端
   */
  private selectBackends(query: string, strategy?: RoutingStrategy): MemoryBackendType[] {
    const effectiveStrategy = strategy || this.config.routing.defaultStrategy

    // 分析查询特征
    const hasTimeRef = /昨天|今天|上周|上个月|最近|之前/.test(query)
    const isKnowledgeQuery = /什么是|如何|怎么|定义|解释/.test(query)
    const isPersonalQuery = /我|我的|喜欢|偏好|习惯/.test(query)

    let backends: MemoryBackendType[] = []

    switch (effectiveStrategy) {
      case 'fastest':
        // 只使用最快的后端
        backends = ['lightmemo', 'memory']
        break

      case 'quality':
        // 使用所有后端以获得最佳质量
        backends = ['diary', 'knowledge', 'deepmemo', 'memory', 'lightmemo']
        break

      case 'cost_efficient':
        // 优先本地后端
        backends = ['diary', 'memory', 'lightmemo']
        break

      case 'balanced':
      default:
        // 根据查询特征智能选择
        if (hasTimeRef) {
          backends.push('diary')
        }
        if (isKnowledgeQuery) {
          backends.push('knowledge')
        }
        if (isPersonalQuery) {
          backends.push('memory', 'diary')
        }
        // 确保至少有基本后端
        if (backends.length === 0) {
          backends = this.config.routing.searchBackendPriority.slice(0, 3)
        }
        break
    }

    // 去重
    return [...new Set(backends)]
  }

  // ==================== 统计和监控 ====================

  /**
   * 获取记忆大脑状态
   */
  async getStatus(): Promise<{
    isHealthy: boolean
    neuralRerankAvailable: boolean
    tracingEnabled: boolean
    coordinatorConfig: IntegratedMemoryConfig
    stats: Awaited<ReturnType<typeof getIntegratedMemoryCoordinator.prototype.getIntegratedStats>>
    traceStats: ReturnType<typeof getMemoryCallTracer.prototype.getStats>
  }> {
    const coordinator = getIntegratedMemoryCoordinator()
    const neuralService = getNeuralRerankService()
    const tracer = getMemoryCallTracer()

    const stats = await coordinator.getIntegratedStats()
    const traceStats = tracer.getStats()

    return {
      isHealthy: true,
      neuralRerankAvailable: neuralService.isAvailable(),
      tracingEnabled: this.config.tracing.enabled,
      coordinatorConfig: coordinator.getConfig(),
      stats,
      traceStats
    }
  }

  /**
   * 获取调用追踪统计
   */
  getTraceStats() {
    return getMemoryCallTracer().getStats()
  }

  /**
   * 获取调用追踪记录
   */
  getTraceRecords(limit?: number) {
    return getMemoryCallTracer().getRecords(limit)
  }

  /**
   * 获取调用链路图
   */
  getCallGraph() {
    return getMemoryCallTracer().getCallGraph()
  }

  /**
   * 获取向量存储信息
   */
  getVectorStorageInfo() {
    return getMemoryCallTracer().getVectorStorageInfo()
  }

  /**
   * 记录正向反馈
   */
  async recordPositiveFeedback(searchId: string, selectedResultId: string, query: string): Promise<void> {
    return getIntegratedMemoryCoordinator().recordPositiveFeedback(searchId, selectedResultId, query)
  }

  /**
   * 记录负向反馈
   */
  async recordNegativeFeedback(searchId: string, ignoredResultId: string, query: string): Promise<void> {
    return getIntegratedMemoryCoordinator().recordNegativeFeedback(searchId, ignoredResultId, query)
  }
}

// ==================== 导出 ====================

let brainInstance: MemoryBrain | null = null

export function getMemoryBrain(): MemoryBrain {
  if (!brainInstance) {
    brainInstance = MemoryBrain.getInstance()
  }
  return brainInstance
}

/**
 * 便捷函数: 记忆搜索
 */
export async function memorySearch(query: string, params?: SearchTaskParams): Promise<SearchTaskResult> {
  return getMemoryBrain().search(query, params)
}

/**
 * 便捷函数: 快速搜索
 */
export async function quickMemorySearch(
  query: string,
  options?: { backends?: MemoryBackendType[]; topK?: number }
): Promise<EnhancedSearchResult[]> {
  return getMemoryBrain().quickSearch(query, options)
}

/**
 * 便捷函数: 深度搜索
 */
export async function deepMemorySearch(
  query: string,
  options?: { backends?: MemoryBackendType[]; topK?: number; modelId?: string; providerId?: string }
): Promise<SearchTaskResult> {
  return getMemoryBrain().deepSearch(query, options)
}

/**
 * 便捷函数: WaveRAG 三阶段检索
 * @deprecated 推荐直接使用 IntegratedMemoryCoordinator.intelligentSearch({ useWaveRAG: true })
 */
export async function waveRAGMemorySearch(
  query: string,
  options?: {
    backends?: MemoryBackendType[]
    topK?: number
    expansionDepth?: number
    focusScoreThreshold?: number
  }
): Promise<EnhancedSearchResult[]> {
  return getMemoryBrain().waveRAGSearch(query, options)
}

// 重导出 WaveRAG 类型 (从 native 模块)
export type { WaveRAGResult, WaveRAGConfig }
