/**
 * ModelWhitelistService - 模型白名单透传服务
 *
 * 功能:
 * 1. 模型白名单配置管理
 * 2. 模型可用性验证
 * 3. 动态模型发现 (从 Provider API 获取)
 * 4. 绕过用户端限制的模型透传
 *
 * VCPToolBox 对标功能:
 * - 模型白名单透传
 * - 动态模型列表获取
 * - 服务端模型可用性检查
 */

import OpenAI from '@cherrystudio/openai'
import { loggerService } from '@logger'
import { reduxService } from '@main/services/ReduxService'
import type { Provider } from '@types'

const logger = loggerService.withContext('VCP:ModelWhitelistService')

// ==================== 类型定义 ====================

/**
 * 白名单条目
 */
export interface WhitelistEntry {
  /** Provider ID */
  providerId: string
  /** 允许的模型列表 (空数组表示允许该 Provider 所有模型) */
  allowedModels: string[]
  /** 是否允许动态发现新模型 */
  allowDiscovery?: boolean
  /** 上次更新时间 */
  lastUpdated?: number
}

/**
 * 白名单配置
 */
export interface WhitelistConfig {
  /** 是否启用白名单 (false 表示允许所有) */
  enabled: boolean
  /** 白名单条目 */
  entries: WhitelistEntry[]
  /** 默认行为: 'allow' | 'deny' 未在白名单中的模型 */
  defaultBehavior: 'allow' | 'deny'
}

/**
 * 模型可用性检查结果
 */
export interface ModelAvailabilityResult {
  modelId: string
  providerId: string
  available: boolean
  reason?: string
  checkedAt: number
}

/**
 * 发现的模型
 */
export interface DiscoveredModel {
  id: string
  name?: string
  providerId: string
  providerName: string
  createdAt?: number
  ownedBy?: string
}

// ==================== ModelWhitelistService 实现 ====================

class ModelWhitelistServiceImpl {
  private config: WhitelistConfig = {
    enabled: false,
    entries: [],
    defaultBehavior: 'allow'
  }

  private availabilityCache: Map<string, ModelAvailabilityResult> = new Map()
  private discoveredModelsCache: Map<string, DiscoveredModel[]> = new Map()
  private readonly cacheTTL = 5 * 60 * 1000 // 5 minutes

  constructor() {
    logger.info('ModelWhitelistService initialized')
  }

  // ==================== 配置管理 ====================

  /**
   * 设置白名单配置
   */
  setConfig(config: Partial<WhitelistConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
    logger.info('Whitelist config updated', {
      enabled: this.config.enabled,
      entryCount: this.config.entries.length,
      defaultBehavior: this.config.defaultBehavior
    })
  }

  /**
   * 获取当前配置
   */
  getConfig(): WhitelistConfig {
    return { ...this.config }
  }

  /**
   * 添加 Provider 到白名单
   */
  addProviderToWhitelist(providerId: string, allowedModels: string[] = []): void {
    const existingIndex = this.config.entries.findIndex((e) => e.providerId === providerId)

    const entry: WhitelistEntry = {
      providerId,
      allowedModels,
      allowDiscovery: allowedModels.length === 0,
      lastUpdated: Date.now()
    }

    if (existingIndex >= 0) {
      this.config.entries[existingIndex] = entry
    } else {
      this.config.entries.push(entry)
    }

    logger.info('Provider added to whitelist', { providerId, modelCount: allowedModels.length })
  }

  /**
   * 从白名单移除 Provider
   */
  removeProviderFromWhitelist(providerId: string): boolean {
    const index = this.config.entries.findIndex((e) => e.providerId === providerId)
    if (index >= 0) {
      this.config.entries.splice(index, 1)
      logger.info('Provider removed from whitelist', { providerId })
      return true
    }
    return false
  }

  // ==================== 模型验证 ====================

  /**
   * 验证模型是否在白名单中
   */
  validateModel(providerId: string, modelId: string): boolean {
    // 白名单未启用，使用默认行为
    if (!this.config.enabled) {
      return this.config.defaultBehavior === 'allow'
    }

    // 查找 Provider 条目
    const entry = this.config.entries.find((e) => e.providerId === providerId)

    if (!entry) {
      // Provider 不在白名单中
      return this.config.defaultBehavior === 'allow'
    }

    // Provider 在白名单中
    if (entry.allowedModels.length === 0) {
      // 空列表表示允许所有模型
      return true
    }

    // 检查具体模型
    return entry.allowedModels.includes(modelId)
  }

  /**
   * 获取 Provider 的白名单模型列表
   */
  getWhitelistedModels(providerId: string): string[] {
    const entry = this.config.entries.find((e) => e.providerId === providerId)
    if (!entry) return []
    return [...entry.allowedModels]
  }

  // ==================== 模型可用性检查 ====================

  /**
   * 检查模型是否在 Provider 实际可用
   */
  async checkModelAvailability(providerId: string, modelId: string): Promise<ModelAvailabilityResult> {
    const cacheKey = `${providerId}:${modelId}`
    const cached = this.availabilityCache.get(cacheKey)

    // 检查缓存
    if (cached && Date.now() - cached.checkedAt < this.cacheTTL) {
      return cached
    }

    try {
      const provider = await this.getProvider(providerId)
      if (!provider) {
        const result: ModelAvailabilityResult = {
          modelId,
          providerId,
          available: false,
          reason: 'Provider not found',
          checkedAt: Date.now()
        }
        this.availabilityCache.set(cacheKey, result)
        return result
      }

      // 尝试从 API 获取模型列表
      const discoveredModels = await this.discoverModels(providerId)
      const isAvailable = discoveredModels.some((m) => m.id === modelId || m.id.toLowerCase() === modelId.toLowerCase())

      const result: ModelAvailabilityResult = {
        modelId,
        providerId,
        available: isAvailable,
        reason: isAvailable ? undefined : 'Model not found in provider',
        checkedAt: Date.now()
      }

      this.availabilityCache.set(cacheKey, result)
      return result
    } catch (error) {
      const result: ModelAvailabilityResult = {
        modelId,
        providerId,
        available: false,
        reason: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
        checkedAt: Date.now()
      }
      this.availabilityCache.set(cacheKey, result)
      return result
    }
  }

  /**
   * 批量检查模型可用性
   */
  async checkMultipleModels(providerId: string, modelIds: string[]): Promise<Map<string, ModelAvailabilityResult>> {
    const results = new Map<string, ModelAvailabilityResult>()

    // 批量检查可以优化为一次 API 调用
    const discoveredModels = await this.discoverModels(providerId)
    const discoveredIds = new Set(discoveredModels.map((m) => m.id.toLowerCase()))

    for (const modelId of modelIds) {
      const isAvailable = discoveredIds.has(modelId.toLowerCase())
      const result: ModelAvailabilityResult = {
        modelId,
        providerId,
        available: isAvailable,
        reason: isAvailable ? undefined : 'Model not found in provider',
        checkedAt: Date.now()
      }
      results.set(modelId, result)
      this.availabilityCache.set(`${providerId}:${modelId}`, result)
    }

    return results
  }

  // ==================== 动态模型发现 ====================

  /**
   * 从 Provider API 发现可用模型
   */
  async discoverModels(providerId: string, forceRefresh = false): Promise<DiscoveredModel[]> {
    // 检查缓存
    if (!forceRefresh && this.discoveredModelsCache.has(providerId)) {
      return this.discoveredModelsCache.get(providerId)!
    }

    try {
      const provider = await this.getProvider(providerId)
      if (!provider) {
        logger.warn('Provider not found for discovery', { providerId })
        return []
      }

      const client = new OpenAI({
        baseURL: provider.apiHost,
        apiKey: provider.apiKey
      })

      // 调用 /v1/models 端点
      const response = await client.models.list()

      const discoveredModels: DiscoveredModel[] = []
      for await (const model of response) {
        discoveredModels.push({
          id: model.id,
          name: model.id, // OpenAI API 没有单独的 name 字段
          providerId,
          providerName: provider.name,
          createdAt: model.created ? model.created * 1000 : undefined,
          ownedBy: model.owned_by
        })
      }

      logger.info('Models discovered', {
        providerId,
        count: discoveredModels.length
      })

      this.discoveredModelsCache.set(providerId, discoveredModels)
      return discoveredModels
    } catch (error) {
      logger.warn('Failed to discover models', {
        providerId,
        error: error instanceof Error ? error.message : String(error)
      })

      // 返回空列表而不是抛出错误
      return []
    }
  }

  /**
   * 获取所有 Provider 的可用模型
   */
  async discoverAllModels(): Promise<Map<string, DiscoveredModel[]>> {
    const results = new Map<string, DiscoveredModel[]>()
    const providers = await this.getProviders()

    // 并行发现
    const discoveries = await Promise.allSettled(
      providers.map(async (provider) => {
        const models = await this.discoverModels(provider.id)
        return { providerId: provider.id, models }
      })
    )

    for (const result of discoveries) {
      if (result.status === 'fulfilled') {
        results.set(result.value.providerId, result.value.models)
      }
    }

    return results
  }

  // ==================== 透传功能 ====================

  /**
   * 获取可用模型列表 (合并本地配置 + 动态发现)
   *
   * 透传逻辑:
   * 1. 如果白名单启用，优先返回白名单模型
   * 2. 如果允许发现，合并动态发现的模型
   * 3. 如果白名单禁用，返回所有可用模型
   */
  async getAvailableModels(providerId: string): Promise<string[]> {
    const provider = await this.getProvider(providerId)
    if (!provider) return []

    // 白名单禁用时，返回所有模型
    if (!this.config.enabled) {
      // 优先使用本地配置的模型
      const localModels = provider.models?.map((m) => m.id) || []
      if (localModels.length > 0) {
        return localModels
      }

      // 尝试动态发现
      const discovered = await this.discoverModels(providerId)
      return discovered.map((m) => m.id)
    }

    // 白名单启用
    const entry = this.config.entries.find((e) => e.providerId === providerId)

    if (!entry) {
      // Provider 不在白名单中
      return this.config.defaultBehavior === 'allow' ? provider.models?.map((m) => m.id) || [] : []
    }

    // 有指定模型列表
    if (entry.allowedModels.length > 0) {
      return [...entry.allowedModels]
    }

    // 允许发现模式
    if (entry.allowDiscovery) {
      const discovered = await this.discoverModels(providerId)
      return discovered.map((m) => m.id)
    }

    // 返回本地配置
    return provider.models?.map((m) => m.id) || []
  }

  /**
   * 验证并获取可用模型
   * 同时检查白名单和实际可用性
   */
  async validateAndGetModel(
    providerId: string,
    modelId: string
  ): Promise<{
    valid: boolean
    available: boolean
    modelId: string
    reason?: string
  }> {
    // 检查白名单
    const whitelistValid = this.validateModel(providerId, modelId)
    if (!whitelistValid) {
      return {
        valid: false,
        available: false,
        modelId,
        reason: 'Model not in whitelist'
      }
    }

    // 检查实际可用性
    const availability = await this.checkModelAvailability(providerId, modelId)

    return {
      valid: true,
      available: availability.available,
      modelId,
      reason: availability.reason
    }
  }

  // ==================== 辅助方法 ====================

  private async getProvider(providerId: string): Promise<Provider | null> {
    try {
      const providers = await reduxService.select<Provider[]>('state.llm.providers')
      if (!providers || !Array.isArray(providers)) {
        return null
      }
      return providers.find((p) => p.id === providerId && p.enabled) || null
    } catch {
      return null
    }
  }

  private async getProviders(): Promise<Provider[]> {
    try {
      const providers = await reduxService.select<Provider[]>('state.llm.providers')
      if (!providers || !Array.isArray(providers)) {
        return []
      }
      return providers.filter((p) => p.enabled)
    } catch {
      return []
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.availabilityCache.clear()
    this.discoveredModelsCache.clear()
    logger.info('Whitelist caches cleared')
  }
}

// ==================== 单例导出 ====================

let instance: ModelWhitelistServiceImpl | null = null

export function getModelWhitelistService(): ModelWhitelistServiceImpl {
  if (!instance) {
    instance = new ModelWhitelistServiceImpl()
  }
  return instance
}

export type ModelWhitelistService = ModelWhitelistServiceImpl
