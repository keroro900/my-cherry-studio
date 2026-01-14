/**
 * UnifiedRerankService - 统一重排序服务
 *
 * 解决 Rerank 配置碎片化问题：
 * - 提供统一的 Rerank API 调用入口
 * - 支持全局默认配置 + 各场景覆盖配置
 * - 兼容知识库、记忆系统、深度检索等多个场景
 *
 * 配置优先级：
 * 1. 调用时传入的配置 (最高)
 * 2. 场景特定配置 (knowledge/memory/deepmemo)
 * 3. 全局默认配置
 *
 * @author Cherry Studio Team
 * @version 1.0.0
 */

import { loggerService } from '@logger'
import { net } from 'electron'

import { StrategyFactory } from '../../knowledge/reranker/strategies/StrategyFactory'
import type { RerankStrategy } from '../../knowledge/reranker/strategies/RerankStrategy'
import { ipcMain } from 'electron'

const logger = loggerService.withContext('UnifiedRerankService')

// ==================== 类型定义 ====================

/**
 * Rerank 提供商类型
 */
export type RerankProvider = 'cohere' | 'jina' | 'bge' | 'voyage' | 'bailian' | 'tei' | 'huggingface-tei' | 'silicon-flow' | 'default'

/**
 * Rerank 模型配置
 */
export interface RerankModelConfig {
  /** 提供商 */
  provider: RerankProvider
  /** API Key */
  apiKey?: string
  /** Base URL (可选，用于自定义端点) */
  baseUrl?: string
  /** 模型 ID */
  model?: string
  /** 返回文档数量 */
  topN?: number
}

/**
 * 统一 Rerank 配置
 */
export interface UnifiedRerankConfig {
  /** 是否启用 Rerank */
  enabled: boolean
  /** 全局默认配置 */
  global?: RerankModelConfig
  /** 场景覆盖配置 */
  overrides?: {
    /** 知识库场景 */
    knowledge?: RerankModelConfig
    /** 记忆系统场景 */
    memory?: RerankModelConfig
    /** 深度检索场景 */
    deepmemo?: RerankModelConfig
    /** 轻量检索场景 */
    lightmemo?: RerankModelConfig
  }
}

/**
 * Rerank 场景类型
 */
export type RerankScene = 'knowledge' | 'memory' | 'deepmemo' | 'lightmemo' | 'default'

/**
 * 搜索结果项 (通用格式)
 */
export interface RerankDocument {
  /** 文档 ID */
  id: string
  /** 文档内容 */
  content: string
  /** 原始分数 */
  score?: number
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * Rerank 结果项
 */
export interface RerankResult {
  /** 文档 ID */
  id: string
  /** 文档内容 */
  content: string
  /** Rerank 后的分数 */
  score: number
  /** 原始分数 */
  originalScore?: number
  /** 原始索引 */
  originalIndex: number
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * Rerank 选项
 */
export interface RerankOptions {
  /** 场景 */
  scene?: RerankScene
  /** 覆盖配置 */
  config?: Partial<RerankModelConfig>
  /** 返回数量 */
  topN?: number
}

// ==================== UnifiedRerankService ====================

export class UnifiedRerankService {
  private static instance: UnifiedRerankService | null = null

  /** 配置 */
  private config: UnifiedRerankConfig = {
    enabled: false
  }

  /** 策略缓存 */
  private strategyCache: Map<string, RerankStrategy> = new Map()

  private constructor() {
    logger.info('UnifiedRerankService initialized')
  }

  static getInstance(): UnifiedRerankService {
    if (!UnifiedRerankService.instance) {
      UnifiedRerankService.instance = new UnifiedRerankService()
    }
    return UnifiedRerankService.instance
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UnifiedRerankConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      overrides: {
        ...this.config.overrides,
        ...config.overrides
      }
    }
    // 清除策略缓存
    this.strategyCache.clear()
    logger.info('Config updated', { enabled: this.config.enabled })
  }

  /**
   * 获取当前配置
   */
  getConfig(): UnifiedRerankConfig {
    return { ...this.config }
  }

  /**
   * 设置全局默认配置
   */
  setGlobalConfig(config: RerankModelConfig): void {
    this.config.global = config
    this.config.enabled = true
    this.strategyCache.clear()
    logger.info('Global rerank config set', { provider: config.provider, model: config.model })
  }

  /**
   * 设置场景覆盖配置
   */
  setSceneConfig(scene: RerankScene, config: RerankModelConfig): void {
    if (!this.config.overrides) {
      this.config.overrides = {}
    }
    this.config.overrides[scene] = config
    this.strategyCache.delete(scene)
    logger.info('Scene rerank config set', { scene, provider: config.provider })
  }

  /**
   * 获取场景的有效配置
   * 优先级: 调用参数 > 场景配置 > 全局配置
   */
  getEffectiveConfig(scene: RerankScene = 'default', override?: Partial<RerankModelConfig>): RerankModelConfig | null {
    // 1. 检查是否启用
    if (!this.config.enabled && !override) {
      return null
    }

    // 2. 合并配置
    const sceneConfig = scene !== 'default' ? this.config.overrides?.[scene] : undefined
    const globalConfig = this.config.global

    if (!globalConfig && !sceneConfig && !override) {
      return null
    }

    return {
      provider: override?.provider || sceneConfig?.provider || globalConfig?.provider || 'default',
      apiKey: override?.apiKey || sceneConfig?.apiKey || globalConfig?.apiKey,
      baseUrl: override?.baseUrl || sceneConfig?.baseUrl || globalConfig?.baseUrl,
      model: override?.model || sceneConfig?.model || globalConfig?.model,
      topN: override?.topN || sceneConfig?.topN || globalConfig?.topN || 10
    }
  }

  // ==================== Rerank 操作 ====================

  /**
   * 执行 Rerank
   */
  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const { scene = 'default', config: overrideConfig, topN } = options

    // 1. 获取有效配置
    const effectiveConfig = this.getEffectiveConfig(scene, {
      ...overrideConfig,
      topN: topN || overrideConfig?.topN
    })

    if (!effectiveConfig) {
      logger.debug('Rerank disabled or not configured, returning original order')
      return documents.map((doc, index) => ({
        id: doc.id,
        content: doc.content,
        score: doc.score || 1 - index * 0.01,
        originalScore: doc.score,
        originalIndex: index,
        metadata: doc.metadata
      }))
    }

    // 2. 获取策略
    const strategy = this.getStrategy(effectiveConfig.provider)

    // 3. 构建请求
    const url = strategy.buildUrl(effectiveConfig.baseUrl)
    const requestBody = strategy.buildRequestBody(
      query,
      documents.map((d) => ({ text: d.content })),
      effectiveConfig.topN || 10,
      effectiveConfig.model
    )

    logger.debug('Rerank request', {
      scene,
      provider: effectiveConfig.provider,
      documentCount: documents.length,
      topN: effectiveConfig.topN
    })

    // 4. 发送请求
    try {
      const response = await net.fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${effectiveConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Rerank API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()

      // 5. 提取结果
      const rerankResults = strategy.extractResults(data)

      // 6. 转换为统一格式
      const results: RerankResult[] = rerankResults.map((r) => {
        const originalDoc = documents[r.index]
        return {
          id: originalDoc.id,
          content: originalDoc.content,
          score: r.relevance_score,
          originalScore: originalDoc.score,
          originalIndex: r.index,
          metadata: originalDoc.metadata
        }
      })

      logger.debug('Rerank completed', {
        scene,
        inputCount: documents.length,
        outputCount: results.length
      })

      return results
    } catch (error) {
      logger.error('Rerank failed', { scene, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * 检查 Rerank 是否可用
   */
  isAvailable(scene: RerankScene = 'default'): boolean {
    const config = this.getEffectiveConfig(scene)
    return config !== null && !!config.apiKey
  }

  /**
   * 获取策略实例
   */
  private getStrategy(provider: RerankProvider): RerankStrategy {
    const cacheKey = provider
    let strategy = this.strategyCache.get(cacheKey)

    if (!strategy) {
      strategy = StrategyFactory.createStrategy(provider)
      this.strategyCache.set(cacheKey, strategy)
    }

    return strategy
  }

  // ==================== 便捷方法 ====================

  /**
   * 知识库 Rerank
   */
  async rerankForKnowledge(query: string, documents: RerankDocument[], topN?: number): Promise<RerankResult[]> {
    return this.rerank(query, documents, { scene: 'knowledge', topN })
  }

  /**
   * 记忆系统 Rerank
   */
  async rerankForMemory(query: string, documents: RerankDocument[], topN?: number): Promise<RerankResult[]> {
    return this.rerank(query, documents, { scene: 'memory', topN })
  }

  /**
   * 深度检索 Rerank
   */
  async rerankForDeepMemo(query: string, documents: RerankDocument[], topN?: number): Promise<RerankResult[]> {
    return this.rerank(query, documents, { scene: 'deepmemo', topN })
  }
}

// ==================== 导出 ====================

let serviceInstance: UnifiedRerankService | null = null

export function getUnifiedRerankService(): UnifiedRerankService {
  if (!serviceInstance) {
    serviceInstance = UnifiedRerankService.getInstance()
  }
  return serviceInstance
}

// ==================== IPC 处理器注册 ====================

/**
 * 注册 IPC 处理器
 * 应在主进程启动时调用
 */
export function registerUnifiedRerankIpcHandlers(): void {
  const service = getUnifiedRerankService()

  // 更新配置
  ipcMain.handle('rerank:updateConfig', (_event, config: Partial<UnifiedRerankConfig>) => {
    service.updateConfig(config)
    return { success: true }
  })

  // 获取配置
  ipcMain.handle('rerank:getConfig', () => {
    return service.getConfig()
  })

  // 设置全局配置
  ipcMain.handle('rerank:setGlobalConfig', (_event, config: RerankModelConfig) => {
    service.setGlobalConfig(config)
    return { success: true }
  })

  // 设置场景配置
  ipcMain.handle('rerank:setSceneConfig', (_event, scene: RerankScene, config: RerankModelConfig) => {
    service.setSceneConfig(scene, config)
    return { success: true }
  })

  // 执行 Rerank
  ipcMain.handle('rerank:rerank', async (_event, query: string, documents: RerankDocument[], options?: RerankOptions) => {
    try {
      const results = await service.rerank(query, documents, options)
      return { success: true, results }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 检查可用性
  ipcMain.handle('rerank:isAvailable', (_event, scene?: RerankScene) => {
    return service.isAvailable(scene)
  })

  logger.info('UnifiedRerankService IPC handlers registered')
}
