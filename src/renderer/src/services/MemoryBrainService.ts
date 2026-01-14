/**
 * MemoryBrainService - 统一记忆大脑服务 (渲染进程)
 *
 * 提供渲染进程与 MemoryBrain 交互的服务层
 * 用于集成到 UI 组件和其他服务
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('MemoryBrainService')

// ==================== 类型定义 ====================

export type MemoryBackendType = 'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo'
export type RerankMode = 'local' | 'neural' | 'auto'

export interface MemoryBrainSearchResult {
  id: string
  content: string
  score: number
  backend: string
  metadata?: Record<string, unknown>
}

export interface MemoryBrainSearchMetadata {
  usedBackends: string[]
  usedNeuralRerank: boolean
  rerankMode: string
  usedSynthesis: boolean
  totalDurationMs: number
  phaseDurations: {
    search: number
    rerank: number
    synthesis: number
  }
}

export interface MemoryBrainSearchOptions {
  backends?: MemoryBackendType[]
  topK?: number
  rerankMode?: RerankMode
  enableSynthesis?: boolean
  synthesisOptions?: {
    modelId?: string
    providerId?: string
  }
}

export interface WaveRAGPhase {
  phase: 'lens' | 'expansion' | 'focus'
  inputCount: number
  outputCount: number
}

export interface WaveRAGSearchResult {
  pageContent: string
  score: number
  metadata?: Record<string, unknown>
}

export interface WaveRAGSearchMetadata {
  query: string
  lensTagCount: number
  expansionTagCount: number
  totalTime: number
}

export interface MemoryTraceStats {
  totalCalls: number
  totalDurationMs: number
  callsByMethod: Record<string, number>
  callsByBackend: Record<string, number>
  averageDurationMs: number
  errorCount: number
}

export interface MemoryTraceRecord {
  id: string
  timestamp: string
  caller: string
  method: string
  params: Record<string, unknown>
  result?: { success: boolean; count?: number; error?: string }
  durationMs: number
  backend?: string
}

export interface VectorStorageInfo {
  backend: string
  location: string
  dimension: number
  documentCount: number
}

export interface RerankModelConfig {
  id: string
  provider: string
  apiKey: string
  baseUrl?: string
}

// ==================== 服务实现 ====================

class MemoryBrainService {
  private static instance: MemoryBrainService

  static getInstance(): MemoryBrainService {
    if (!MemoryBrainService.instance) {
      MemoryBrainService.instance = new MemoryBrainService()
    }
    return MemoryBrainService.instance
  }

  // ==================== 搜索方法 ====================

  /**
   * 统一搜索 - 自动路由 + 智能重排
   */
  async search(
    query: string,
    options?: MemoryBrainSearchOptions
  ): Promise<{
    results: MemoryBrainSearchResult[]
    synthesizedContent?: string
    metadata: MemoryBrainSearchMetadata
  }> {
    try {
      const result = await window.api.memoryBrain.search({ query, options })

      if (!result.success) {
        logger.warn('MemoryBrain search failed', { error: result.error })
        return {
          results: [],
          metadata: {
            usedBackends: [],
            usedNeuralRerank: false,
            rerankMode: 'local',
            usedSynthesis: false,
            totalDurationMs: 0,
            phaseDurations: { search: 0, rerank: 0, synthesis: 0 }
          }
        }
      }

      logger.debug('MemoryBrain search completed', {
        query: query.slice(0, 50),
        resultCount: result.results?.length || 0,
        usedNeuralRerank: result.metadata?.usedNeuralRerank
      })

      return {
        results: result.results || [],
        synthesizedContent: result.synthesizedContent,
        metadata: result.metadata || {
          usedBackends: [],
          usedNeuralRerank: false,
          rerankMode: 'local',
          usedSynthesis: false,
          totalDurationMs: 0,
          phaseDurations: { search: 0, rerank: 0, synthesis: 0 }
        }
      }
    } catch (error) {
      logger.error('MemoryBrain search error', { error: String(error) })
      throw error
    }
  }

  /**
   * 快速搜索 - 仅本地重排，无 AI 合成
   */
  async quickSearch(
    query: string,
    options?: { backends?: MemoryBackendType[]; topK?: number }
  ): Promise<MemoryBrainSearchResult[]> {
    try {
      const result = await window.api.memoryBrain.quickSearch({ query, options })

      if (!result.success) {
        logger.warn('MemoryBrain quick search failed', { error: result.error })
        return []
      }

      return result.results || []
    } catch (error) {
      logger.error('MemoryBrain quick search error', { error: String(error) })
      throw error
    }
  }

  /**
   * 深度搜索 - 神经重排 + AI 合成
   */
  async deepSearch(
    query: string,
    options?: {
      backends?: MemoryBackendType[]
      topK?: number
      modelId?: string
      providerId?: string
    }
  ): Promise<{
    results: MemoryBrainSearchResult[]
    synthesizedContent?: string
    metadata?: Record<string, unknown>
  }> {
    try {
      const result = await window.api.memoryBrain.deepSearch({ query, options })

      if (!result.success) {
        logger.warn('MemoryBrain deep search failed', { error: result.error })
        return { results: [] }
      }

      return {
        results: result.results || [],
        synthesizedContent: result.synthesizedContent,
        metadata: result.metadata
      }
    } catch (error) {
      logger.error('MemoryBrain deep search error', { error: String(error) })
      throw error
    }
  }

  /**
   * WaveRAG 三阶段检索
   */
  async waveRAGSearch(
    query: string,
    options?: {
      backends?: MemoryBackendType[]
      topK?: number
      expansionDepth?: number
      focusScoreThreshold?: number
    }
  ): Promise<{
    results: WaveRAGSearchResult[]
    phases: WaveRAGPhase[]
    metadata: WaveRAGSearchMetadata
  }> {
    try {
      const result = await window.api.memoryBrain.waveRAGSearch({ query, options })

      if (!result.success) {
        logger.warn('WaveRAG search failed', { error: result.error })
        return {
          results: [],
          phases: [],
          metadata: { query, lensTagCount: 0, expansionTagCount: 0, totalTime: 0 }
        }
      }

      return {
        results: result.results || [],
        phases: result.phases || [],
        metadata: result.metadata || { query, lensTagCount: 0, expansionTagCount: 0, totalTime: 0 }
      }
    } catch (error) {
      logger.error('WaveRAG search error', { error: String(error) })
      throw error
    }
  }

  // ==================== 创建方法 ====================

  /**
   * 创建记忆
   */
  async createMemory(params: {
    content: string
    title?: string
    backend?: 'diary' | 'memory' | 'notes'
    tags?: string[]
    autoTag?: boolean
    modelId?: string
    providerId?: string
    metadata?: Record<string, unknown>
  }): Promise<{
    id: string
    content: string
    title?: string
    tags: string[]
    backend: string
    createdAt: Date
  } | null> {
    try {
      const result = await window.api.memoryBrain.createMemory(params)

      if (!result.success || !result.entry) {
        logger.warn('MemoryBrain create memory failed', { error: result.error })
        return null
      }

      return result.entry
    } catch (error) {
      logger.error('MemoryBrain create memory error', { error: String(error) })
      throw error
    }
  }

  // ==================== 状态和配置 ====================

  /**
   * 获取状态
   */
  async getStatus(): Promise<{
    isHealthy: boolean
    neuralRerankAvailable: boolean
    tracingEnabled: boolean
    traceStats: MemoryTraceStats
  }> {
    try {
      const result = await window.api.memoryBrain.getStatus()

      if (!result.success) {
        logger.warn('MemoryBrain get status failed', { error: result.error })
        return {
          isHealthy: false,
          neuralRerankAvailable: false,
          tracingEnabled: false,
          traceStats: {
            totalCalls: 0,
            totalDurationMs: 0,
            callsByMethod: {},
            callsByBackend: {},
            averageDurationMs: 0,
            errorCount: 0
          }
        }
      }

      return {
        isHealthy: result.isHealthy ?? true,
        neuralRerankAvailable: result.neuralRerankAvailable ?? false,
        tracingEnabled: result.tracingEnabled ?? false,
        traceStats: result.traceStats || {
          totalCalls: 0,
          totalDurationMs: 0,
          callsByMethod: {},
          callsByBackend: {},
          averageDurationMs: 0,
          errorCount: 0
        }
      }
    } catch (error) {
      logger.error('MemoryBrain get status error', { error: String(error) })
      throw error
    }
  }

  /**
   * 获取配置
   */
  async getConfig(): Promise<Record<string, unknown>> {
    try {
      const result = await window.api.memoryBrain.getConfig()
      return result.config || {}
    } catch (error) {
      logger.error('MemoryBrain get config error', { error: String(error) })
      throw error
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Record<string, unknown>): Promise<boolean> {
    try {
      const result = await window.api.memoryBrain.updateConfig({ config })
      return result.success
    } catch (error) {
      logger.error('MemoryBrain update config error', { error: String(error) })
      throw error
    }
  }

  /**
   * 配置神经重排模型
   */
  async configureNeuralRerank(model: RerankModelConfig): Promise<boolean> {
    try {
      const result = await window.api.memoryBrain.configureNeuralRerank({ model })
      return result.success
    } catch (error) {
      logger.error('MemoryBrain configure neural rerank error', { error: String(error) })
      throw error
    }
  }

  // ==================== 反馈 ====================

  /**
   * 记录正向反馈
   */
  async recordPositiveFeedback(searchId: string, selectedResultId: string, query: string): Promise<boolean> {
    try {
      const result = await window.api.memoryBrain.recordPositiveFeedback({
        searchId,
        selectedResultId,
        query
      })
      return result.success
    } catch (error) {
      logger.error('MemoryBrain record positive feedback error', { error: String(error) })
      return false
    }
  }

  /**
   * 记录负向反馈
   */
  async recordNegativeFeedback(searchId: string, ignoredResultId: string, query: string): Promise<boolean> {
    try {
      const result = await window.api.memoryBrain.recordNegativeFeedback({
        searchId,
        ignoredResultId,
        query
      })
      return result.success
    } catch (error) {
      logger.error('MemoryBrain record negative feedback error', { error: String(error) })
      return false
    }
  }

  // ==================== 追踪 ====================

  /**
   * 获取追踪统计
   */
  async getTraceStats(): Promise<MemoryTraceStats> {
    try {
      const result = await window.api.memoryBrain.getTraceStats()
      return result.stats || {
        totalCalls: 0,
        totalDurationMs: 0,
        callsByMethod: {},
        callsByBackend: {},
        averageDurationMs: 0,
        errorCount: 0
      }
    } catch (error) {
      logger.error('MemoryBrain get trace stats error', { error: String(error) })
      throw error
    }
  }

  /**
   * 获取追踪记录
   */
  async getTraceRecords(limit?: number): Promise<MemoryTraceRecord[]> {
    try {
      const result = await window.api.memoryBrain.getTraceRecords({ limit })
      return result.records || []
    } catch (error) {
      logger.error('MemoryBrain get trace records error', { error: String(error) })
      throw error
    }
  }

  /**
   * 获取调用链路图
   */
  async getCallGraph(): Promise<Array<{
    timestamp: string
    caller: string
    method: string
    backend?: string
    durationMs: number
    success: boolean
  }>> {
    try {
      const result = await window.api.memoryBrain.getCallGraph()
      return result.graph || []
    } catch (error) {
      logger.error('MemoryBrain get call graph error', { error: String(error) })
      throw error
    }
  }

  /**
   * 获取向量存储信息
   */
  async getVectorStorageInfo(): Promise<VectorStorageInfo[]> {
    try {
      const result = await window.api.memoryBrain.getVectorStorageInfo()
      return result.info || []
    } catch (error) {
      logger.error('MemoryBrain get vector storage info error', { error: String(error) })
      throw error
    }
  }
}

// ==================== 导出 ====================

export const memoryBrainService = MemoryBrainService.getInstance()
export default memoryBrainService
