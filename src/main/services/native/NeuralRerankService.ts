/**
 * NeuralRerankService - 神经网络重排序服务
 *
 * 桥接 Cherry Studio 的知识库重排器到记忆系统。
 * 支持多种神经重排提供商: Cohere, Jina, VoyageAI, BGE, TEI, Bailian
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import type { KnowledgeBaseParams, KnowledgeSearchResult } from '@types'

import type { RerankItem, RerankOptions } from './RerankUtils'

const logger = loggerService.withContext('NeuralRerankService')

// ==================== 类型定义 ====================

/**
 * 重排模型配置
 * 用于配置神经重排服务使用的模型
 */
export interface RerankModelConfig {
  /** 模型 ID */
  id: string
  /** 提供商 (cohere, jina, voyageai, bge, tei, bailian) */
  provider: string
  /** API Key */
  apiKey: string
  /** API Base URL */
  baseUrl?: string
}

export interface NeuralRerankConfig {
  /** 是否启用神经重排 */
  enabled: boolean
  /** 重排模型配置 */
  model?: RerankModelConfig
  /** 最大输入文档数 (防止 token 超限) */
  maxDocuments?: number
  /** 最小分数阈值 (过滤低分结果) */
  minScore?: number
  /** 是否在 API 失败时回退到本地重排 */
  fallbackToLocal?: boolean
  /** 超时时间 (ms) */
  timeout?: number
}

export interface NeuralRerankResult<T> {
  /** 重排后的结果 */
  results: RerankItem<T>[]
  /** 是否使用了神经重排 */
  usedNeural: boolean
  /** 处理耗时 (ms) */
  durationMs: number
  /** 错误信息 (如有回退) */
  error?: string
}

// ==================== 神经重排服务 ====================

export class NeuralRerankService {
  private static instance: NeuralRerankService | null = null

  private config: NeuralRerankConfig = {
    enabled: false,
    maxDocuments: 100,
    minScore: 0.0,
    fallbackToLocal: true,
    timeout: 30000
  }

  private constructor() {
    logger.info('NeuralRerankService initialized')
  }

  static getInstance(): NeuralRerankService {
    if (!NeuralRerankService.instance) {
      NeuralRerankService.instance = new NeuralRerankService()
    }
    return NeuralRerankService.instance
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NeuralRerankConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('NeuralRerank config updated', { config: this.config })
  }

  /**
   * 获取当前配置
   */
  getConfig(): NeuralRerankConfig {
    return { ...this.config }
  }

  /**
   * 检查是否可用
   */
  isAvailable(): boolean {
    return this.config.enabled && !!this.config.model
  }

  // ==================== 核心重排方法 ====================

  /**
   * 神经网络重排
   *
   * @param query - 查询字符串
   * @param items - 待重排项目
   * @param options - 重排选项
   * @returns 重排结果
   */
  async rerank<T>(
    query: string,
    items: RerankItem<T>[],
    options?: RerankOptions & { forceNeural?: boolean }
  ): Promise<NeuralRerankResult<T>> {
    const startTime = Date.now()
    const forceNeural = options?.forceNeural ?? false

    // 检查是否应使用神经重排
    if (!forceNeural && !this.shouldUseNeural(items.length)) {
      return this.localRerank(query, items, options, startTime)
    }

    try {
      // 限制文档数量
      const maxDocs = this.config.maxDocuments || 100
      const limitedItems = items.slice(0, maxDocs)

      // 构建知识库参数
      const baseParams = this.buildKnowledgeBaseParams()

      // 动态导入 GeneralReranker (避免循环依赖)
      const { default: GeneralReranker } = await import('../../knowledge/reranker/GeneralReranker')
      const reranker = new GeneralReranker(baseParams)

      // 转换为 KnowledgeSearchResult 格式
      const searchResults: KnowledgeSearchResult[] = limitedItems.map((item, index) => ({
        pageContent: item.content,
        score: item.score,
        metadata: {
          originalIndex: index,
          originalItem: item.item
        }
      }))

      // 执行神经重排
      const rerankedResults = await reranker.rerank(query, searchResults)

      // 转换回 RerankItem 格式
      const results: RerankItem<T>[] = rerankedResults
        .filter((r) => r.score >= (this.config.minScore || 0))
        .map((r) => ({
          item: r.metadata?.originalItem as T,
          content: r.pageContent,
          score: r.score
        }))

      const durationMs = Date.now() - startTime

      logger.info('Neural rerank completed', {
        inputCount: items.length,
        outputCount: results.length,
        durationMs,
        provider: this.config.model?.provider
      })

      return {
        results,
        usedNeural: true,
        durationMs
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.warn('Neural rerank failed', { error: errorMessage })

      // 是否回退到本地重排
      if (this.config.fallbackToLocal) {
        const localResult = await this.localRerank(query, items, options, startTime)
        return {
          ...localResult,
          error: `Neural failed: ${errorMessage}, fell back to local`
        }
      }

      throw error
    }
  }

  /**
   * 批量神经重排 (多个查询)
   */
  async batchRerank<T>(
    queries: Array<{ query: string; items: RerankItem<T>[] }>,
    options?: RerankOptions
  ): Promise<NeuralRerankResult<T>[]> {
    const results: NeuralRerankResult<T>[] = []

    for (const { query, items } of queries) {
      const result = await this.rerank(query, items, options)
      results.push(result)
    }

    return results
  }

  // ==================== 辅助方法 ====================

  /**
   * 判断是否应使用神经重排
   */
  private shouldUseNeural(itemCount: number): boolean {
    // 未启用或无模型配置
    if (!this.config.enabled || !this.config.model) {
      return false
    }

    // 结果太少不需要神经重排 (节省 API 调用)
    if (itemCount <= 3) {
      return false
    }

    return true
  }

  /**
   * 本地关键词重排
   */
  private async localRerank<T>(
    query: string,
    items: RerankItem<T>[],
    options: RerankOptions | undefined,
    startTime: number
  ): Promise<NeuralRerankResult<T>> {
    // 动态导入避免循环依赖
    const { rerank } = await import('./RerankUtils')
    const results = rerank(query, items, options)

    return {
      results,
      usedNeural: false,
      durationMs: Date.now() - startTime
    }
  }

  /**
   * 构建知识库参数 (用于 GeneralReranker)
   */
  private buildKnowledgeBaseParams(): KnowledgeBaseParams {
    const model = this.config.model
    if (!model) {
      throw new Error('No rerank model configured')
    }

    return {
      id: 'memory-rerank',
      // embedApiClient 是必需的，但对于 rerank 不需要真正的 embedding
      embedApiClient: {
        model: '',
        provider: '',
        apiKey: '',
        baseURL: ''
      },
      rerankApiClient: {
        model: model.id,
        provider: model.provider,
        apiKey: model.apiKey,
        baseURL: model.baseUrl || ''
      }
    }
  }
}

// ==================== 导出 ====================

let serviceInstance: NeuralRerankService | null = null

export function getNeuralRerankService(): NeuralRerankService {
  if (!serviceInstance) {
    serviceInstance = NeuralRerankService.getInstance()
  }
  return serviceInstance
}

/**
 * 便捷函数: 神经重排
 */
export async function neuralRerank<T>(
  query: string,
  items: RerankItem<T>[],
  options?: RerankOptions & { forceNeural?: boolean }
): Promise<NeuralRerankResult<T>> {
  return getNeuralRerankService().rerank(query, items, options)
}
