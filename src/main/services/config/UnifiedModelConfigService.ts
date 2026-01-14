/**
 * UnifiedModelConfigService - 统一模型配置服务
 *
 * 解决 Embedding/Rerank 模型配置碎片化问题:
 * - 统一前端 MemoryConfig.embeddingModel/rerankModel
 * - 初始化 UnifiedEmbeddingService 和 UnifiedRerankService
 * - 提供 IPC 接口供 UI 配置
 * - 支持场景覆盖配置 (knowledge/memory/deepmemo)
 *
 * 配置优先级:
 * 1. 调用时传入的配置
 * 2. 场景特定配置
 * 3. 全局默认配置
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'
import { ipcMain } from 'electron'

import { getEmbeddingService } from '../../knowledge/embedding/UnifiedEmbeddingService'
import { getUnifiedRerankService, type RerankProvider, type RerankScene } from '../rerank/UnifiedRerankService'

const logger = loggerService.withContext('UnifiedModelConfigService')

// ==================== 类型定义 ====================

/**
 * 模型标识 (前端 Model 对象的精简版)
 */
export interface ModelIdentifier {
  /** 模型 ID */
  id: string
  /** 提供商 ID */
  provider: string
  /** 模型名称 (显示用) */
  name?: string
  /** 模型维度 (仅 Embedding 模型) */
  dimensions?: number
}

/**
 * Provider 配置 (用于构建 ApiClient)
 */
export interface ProviderConfig {
  /** 提供商 ID */
  id: string
  /** API Key */
  apiKey?: string
  /** Base URL */
  baseUrl?: string
}

/**
 * Embedding 模型配置
 */
export interface EmbeddingModelConfig {
  /** 模型标识 */
  model: ModelIdentifier
  /** 提供商配置 */
  provider: ProviderConfig
  /** 目标维度 (自动适配) */
  targetDimension?: number
  /** 是否启用缓存 */
  enableCache?: boolean
}

/**
 * Rerank 模型配置
 */
export interface RerankModelConfig {
  /** 模型标识 */
  model: ModelIdentifier
  /** 提供商配置 */
  provider: ProviderConfig
  /** 返回数量 */
  topN?: number
}

/**
 * 全局模型配置
 */
export interface GlobalModelConfig {
  /** 全局 Embedding 配置 */
  embedding?: EmbeddingModelConfig
  /** 全局 Rerank 配置 */
  rerank?: RerankModelConfig
  /** 场景覆盖配置 */
  sceneOverrides?: {
    knowledge?: {
      embedding?: EmbeddingModelConfig
      rerank?: RerankModelConfig
    }
    memory?: {
      embedding?: EmbeddingModelConfig
      rerank?: RerankModelConfig
    }
    deepmemo?: {
      embedding?: EmbeddingModelConfig
      rerank?: RerankModelConfig
    }
    lightmemo?: {
      embedding?: EmbeddingModelConfig
      rerank?: RerankModelConfig
    }
  }
}

/**
 * 场景类型
 */
export type ModelScene = 'knowledge' | 'memory' | 'deepmemo' | 'lightmemo' | 'default'

// ==================== UnifiedModelConfigService ====================

class UnifiedModelConfigServiceImpl {
  private config: GlobalModelConfig = {}
  private initialized = false

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // 注册 IPC 处理器
    this.registerIpcHandlers()

    this.initialized = true
    logger.info('UnifiedModelConfigService initialized')
  }

  // ==================== Embedding 配置 ====================

  /**
   * 设置全局 Embedding 模型配置
   */
  async setEmbeddingConfig(config: EmbeddingModelConfig): Promise<void> {
    this.config.embedding = config

    // 同步到 UnifiedEmbeddingService
    const apiClient = this.buildApiClient(config.model, config.provider)
    const embeddingService = getEmbeddingService()
    embeddingService.setDefaultConfig({
      apiClient,
      targetDimension: config.targetDimension ?? config.model.dimensions,
      enableCache: config.enableCache ?? true
    })

    // 同步到 UnifiedStorageCore (全局记忆存储)
    try {
      const { getUnifiedStorage } = await import('@main/storage')
      const storage = getUnifiedStorage()
      await storage.setEmbeddingConfig(apiClient, config.targetDimension ?? config.model.dimensions)
      logger.debug('Embedding config synced to UnifiedStorageCore')
    } catch (error) {
      logger.warn('Failed to sync embedding config to UnifiedStorageCore', { error: String(error) })
    }

    logger.info('Global embedding config set', {
      provider: config.provider.id,
      model: config.model.id,
      dimension: config.targetDimension ?? config.model.dimensions
    })
  }

  /**
   * 设置场景 Embedding 配置
   */
  setSceneEmbeddingConfig(scene: ModelScene, config: EmbeddingModelConfig): void {
    if (!this.config.sceneOverrides) {
      this.config.sceneOverrides = {}
    }
    if (!this.config.sceneOverrides[scene]) {
      this.config.sceneOverrides[scene] = {}
    }
    this.config.sceneOverrides[scene]!.embedding = config

    logger.info('Scene embedding config set', {
      scene,
      provider: config.provider.id,
      model: config.model.id
    })
  }

  /**
   * 获取有效的 Embedding 配置
   */
  getEffectiveEmbeddingConfig(scene: ModelScene = 'default'): EmbeddingModelConfig | undefined {
    // 优先场景配置
    if (scene !== 'default') {
      const sceneConfig = this.config.sceneOverrides?.[scene]?.embedding
      if (sceneConfig) return sceneConfig
    }

    // 回退到全局配置
    return this.config.embedding
  }

  // ==================== Rerank 配置 ====================

  /**
   * 设置全局 Rerank 模型配置
   */
  setRerankConfig(config: RerankModelConfig): void {
    this.config.rerank = config

    // 同步到 UnifiedRerankService
    const rerankService = getUnifiedRerankService()
    rerankService.setGlobalConfig({
      provider: this.mapToRerankProvider(config.provider.id),
      apiKey: config.provider.apiKey,
      baseUrl: config.provider.baseUrl,
      model: config.model.id,
      topN: config.topN ?? 10
    })

    logger.info('Global rerank config set', {
      provider: config.provider.id,
      model: config.model.id
    })
  }

  /**
   * 设置场景 Rerank 配置
   */
  setSceneRerankConfig(scene: ModelScene, config: RerankModelConfig): void {
    if (!this.config.sceneOverrides) {
      this.config.sceneOverrides = {}
    }
    if (!this.config.sceneOverrides[scene]) {
      this.config.sceneOverrides[scene] = {}
    }
    this.config.sceneOverrides[scene]!.rerank = config

    // 同步到 UnifiedRerankService
    const rerankService = getUnifiedRerankService()
    rerankService.setSceneConfig(scene as RerankScene, {
      provider: this.mapToRerankProvider(config.provider.id),
      apiKey: config.provider.apiKey,
      baseUrl: config.provider.baseUrl,
      model: config.model.id,
      topN: config.topN ?? 10
    })

    logger.info('Scene rerank config set', {
      scene,
      provider: config.provider.id,
      model: config.model.id
    })
  }

  /**
   * 获取有效的 Rerank 配置
   */
  getEffectiveRerankConfig(scene: ModelScene = 'default'): RerankModelConfig | undefined {
    // 优先场景配置
    if (scene !== 'default') {
      const sceneConfig = this.config.sceneOverrides?.[scene]?.rerank
      if (sceneConfig) return sceneConfig
    }

    // 回退到全局配置
    return this.config.rerank
  }

  // ==================== 批量配置 ====================

  /**
   * 更新完整配置
   */
  async updateConfig(config: Partial<GlobalModelConfig>): Promise<void> {
    // 更新 Embedding
    if (config.embedding) {
      await this.setEmbeddingConfig(config.embedding)
    }

    // 更新 Rerank
    if (config.rerank) {
      this.setRerankConfig(config.rerank)
    }

    // 更新场景覆盖
    if (config.sceneOverrides) {
      for (const [scene, sceneConfig] of Object.entries(config.sceneOverrides)) {
        if (sceneConfig?.embedding) {
          this.setSceneEmbeddingConfig(scene as ModelScene, sceneConfig.embedding)
        }
        if (sceneConfig?.rerank) {
          this.setSceneRerankConfig(scene as ModelScene, sceneConfig.rerank)
        }
      }
    }

    logger.info('Model config updated')
  }

  /**
   * 获取完整配置
   */
  getConfig(): GlobalModelConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * 检查是否已配置 Embedding 模型
   */
  hasEmbeddingConfig(scene: ModelScene = 'default'): boolean {
    return !!this.getEffectiveEmbeddingConfig(scene)
  }

  /**
   * 检查是否已配置 Rerank 模型
   */
  hasRerankConfig(scene: ModelScene = 'default'): boolean {
    return !!this.getEffectiveRerankConfig(scene)
  }

  // ==================== 私有方法 ====================

  /**
   * 构建 ApiClient 对象
   */
  private buildApiClient(model: ModelIdentifier, provider: ProviderConfig): import('@types').ApiClient {
    return {
      provider: provider.id,
      model: model.id,
      baseURL: provider.baseUrl || '',
      apiKey: provider.apiKey || ''
    }
  }

  /**
   * 映射 provider ID 到 RerankProvider 类型
   */
  private mapToRerankProvider(providerId: string): RerankProvider {
    const mapping: Record<string, RerankProvider> = {
      cohere: 'cohere',
      jina: 'jina',
      voyage: 'voyage',
      'silicon-flow': 'silicon-flow',
      siliconflow: 'silicon-flow',
      bailian: 'bailian',
      tei: 'tei',
      'huggingface-tei': 'huggingface-tei',
      bge: 'bge'
    }

    return mapping[providerId.toLowerCase()] || 'default'
  }

  /**
   * 注册 IPC 处理器
   */
  private registerIpcHandlers(): void {
    // 设置全局 Embedding 配置
    ipcMain.handle('model-config:setEmbedding', async (_event, config: EmbeddingModelConfig) => {
      try {
        await this.setEmbeddingConfig(config)
        return { success: true }
      } catch (error) {
        logger.error('Failed to set embedding config', { error: String(error) })
        return { success: false, error: String(error) }
      }
    })

    // 设置全局 Rerank 配置
    ipcMain.handle('model-config:setRerank', (_event, config: RerankModelConfig) => {
      try {
        this.setRerankConfig(config)
        return { success: true }
      } catch (error) {
        logger.error('Failed to set rerank config', { error: String(error) })
        return { success: false, error: String(error) }
      }
    })

    // 设置场景配置
    ipcMain.handle(
      'model-config:setSceneConfig',
      (_event, scene: ModelScene, embedding?: EmbeddingModelConfig, rerank?: RerankModelConfig) => {
        try {
          if (embedding) {
            this.setSceneEmbeddingConfig(scene, embedding)
          }
          if (rerank) {
            this.setSceneRerankConfig(scene, rerank)
          }
          return { success: true }
        } catch (error) {
          logger.error('Failed to set scene config', { error: String(error) })
          return { success: false, error: String(error) }
        }
      }
    )

    // 更新完整配置
    ipcMain.handle('model-config:update', async (_event, config: Partial<GlobalModelConfig>) => {
      try {
        await this.updateConfig(config)
        return { success: true }
      } catch (error) {
        logger.error('Failed to update config', { error: String(error) })
        return { success: false, error: String(error) }
      }
    })

    // 获取完整配置
    ipcMain.handle('model-config:get', () => {
      return this.getConfig()
    })

    // 获取有效 Embedding 配置
    ipcMain.handle('model-config:getEffectiveEmbedding', (_event, scene?: ModelScene) => {
      return this.getEffectiveEmbeddingConfig(scene)
    })

    // 获取有效 Rerank 配置
    ipcMain.handle('model-config:getEffectiveRerank', (_event, scene?: ModelScene) => {
      return this.getEffectiveRerankConfig(scene)
    })

    // 检查配置状态
    ipcMain.handle('model-config:status', (_event, scene?: ModelScene) => {
      return {
        hasEmbedding: this.hasEmbeddingConfig(scene),
        hasRerank: this.hasRerankConfig(scene)
      }
    })

    logger.info('Model config IPC handlers registered')
  }
}

// ==================== 单例导出 ====================

let instance: UnifiedModelConfigServiceImpl | null = null

export function getUnifiedModelConfigService(): UnifiedModelConfigServiceImpl {
  if (!instance) {
    instance = new UnifiedModelConfigServiceImpl()
  }
  return instance
}

export async function initializeUnifiedModelConfigService(): Promise<UnifiedModelConfigServiceImpl> {
  const service = getUnifiedModelConfigService()
  await service.initialize()
  return service
}

export type UnifiedModelConfigService = UnifiedModelConfigServiceImpl
