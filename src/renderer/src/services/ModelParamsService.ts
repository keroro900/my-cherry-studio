/**
 * 模型参数动态获取服务
 *
 * 通过 OpenAI 兼容协议从中转服务获取模型参数定义
 * GET /v1/params/{model} -> 返回该模型的完整参数 Schema
 *
 * 设计原则：
 * 1. 动态获取，不硬编码参数
 * 2. 本地缓存，减少请求
 * 3. 降级到静态配置（当 API 不可用时）
 */

import { loggerService } from '@logger'
import { FIELD_DEFINITIONS, inferModelConfigType, MODEL_CONFIGS } from '@renderer/config/imageGenerationConfig'
import { getModelCapabilities } from '@renderer/config/modelCapabilities'
import type { Provider } from '@renderer/types'

const logger = loggerService.withContext('ModelParamsService')

// ============================================================================
// 类型定义 - 远程参数 Schema
// ============================================================================

/**
 * 参数字段类型
 */
export type RemoteFieldType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'image' // 图片上传
  | 'seed' // 种子值（带随机按钮）
  | 'aspectRatio' // 宽高比选择器

/**
 * 远程参数字段定义（JSON Schema 扩展）
 */
export interface RemoteFieldSchema {
  // === JSON Schema 标准字段 ===
  type: RemoteFieldType
  title?: string
  description?: string
  default?: any
  enum?: (string | number)[]
  enumNames?: string[] // 枚举显示名称

  // === 数值约束 ===
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number // 步进值

  // === 字符串约束 ===
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'uri' | 'date' | 'email' | 'base64'

  // === 数组约束 ===
  minItems?: number
  maxItems?: number
  items?: RemoteFieldSchema

  // === UI 扩展字段 ===
  'x-ui-widget'?: 'slider' | 'select' | 'radio' | 'switch' | 'textarea' | 'upload' | 'aspectRatio' | 'seed'
  'x-ui-group'?: 'basic' | 'advanced' | 'style' | 'output' | 'controlnet'
  'x-ui-order'?: number
  'x-ui-hidden'?: boolean
  'x-ui-disabled'?: boolean
  'x-ui-placeholder'?: string
  'x-ui-tooltip'?: string

  // === 依赖关系 ===
  'x-depends-on'?: {
    field: string
    values?: any[]
    condition?: string // JavaScript 表达式
  }

  // === 动态范围 ===
  'x-dynamic-range'?: {
    min?: string // JavaScript 表达式
    max?: string // JavaScript 表达式
  }

  // === 验证规则 ===
  'x-validation'?: {
    required?: boolean
    custom?: string // JavaScript 表达式
    message?: string
  }
}

/**
 * 远程模型参数 Schema
 */
export interface RemoteModelParamsSchema {
  // === 模型信息 ===
  model: string
  provider?: string
  name?: string
  description?: string
  version?: string

  // === 能力标识 ===
  capabilities?: {
    supportsNegativePrompt?: boolean
    supportsImg2Img?: boolean
    supportsInpainting?: boolean
    supportsControlNet?: boolean
    supportsLoRA?: boolean
    supportsUpscale?: boolean
    maxBatchSize?: number
    supportsChinesePrompt?: boolean
  }

  // === 参数定义 ===
  properties: Record<string, RemoteFieldSchema>

  // === 必填字段 ===
  required?: string[]

  // === 字段分组 ===
  groups?: {
    id: string
    title: string
    description?: string
    collapsed?: boolean
    fields: string[]
  }[]

  // === 预设配置 ===
  presets?: {
    id: string
    name: string
    description?: string
    values: Record<string, any>
  }[]
}

/**
 * 参数获取结果
 */
export interface ModelParamsResult {
  success: boolean
  schema?: RemoteModelParamsSchema
  error?: string
  fromCache?: boolean
}

// ============================================================================
// 缓存管理
// ============================================================================

interface CacheEntry {
  schema: RemoteModelParamsSchema
  timestamp: number
  expiresAt: number
}

class ParamsCache {
  private cache = new Map<string, CacheEntry>()
  private defaultTTL = 30 * 60 * 1000 // 30 分钟

  private getCacheKey(providerId: string, modelId: string): string {
    return `${providerId}:${modelId}`
  }

  get(providerId: string, modelId: string): RemoteModelParamsSchema | null {
    const key = this.getCacheKey(providerId, modelId)
    const entry = this.cache.get(key)

    if (!entry) return null

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.schema
  }

  set(providerId: string, modelId: string, schema: RemoteModelParamsSchema, ttl?: number): void {
    const key = this.getCacheKey(providerId, modelId)
    const now = Date.now()

    this.cache.set(key, {
      schema,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTTL)
    })
  }

  invalidate(providerId: string, modelId: string): void {
    const key = this.getCacheKey(providerId, modelId)
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

// ============================================================================
// 服务实现
// ============================================================================

class ModelParamsService {
  private cache = new ParamsCache()

  // 记录不支持动态参数的 provider，避免重复请求
  private unsupportedProviders = new Set<string>()

  /**
   * 获取模型参数 Schema
   *
   * 策略：
   * 1. 优先使用缓存
   * 2. 如果 provider 已知不支持动态参数，直接使用静态配置
   * 3. 尝试从远程获取（仅对支持的 provider）
   * 4. 降级到静态配置
   *
   * @param provider - Provider 配置
   * @param modelId - 模型 ID
   * @param options - 选项
   */
  async getModelParams(
    provider: Provider,
    modelId: string,
    options?: {
      forceRefresh?: boolean
      timeout?: number
    }
  ): Promise<ModelParamsResult> {
    const { forceRefresh = false, timeout = 5000 } = options || {}

    // 检查缓存
    if (!forceRefresh) {
      const cached = this.cache.get(provider.id, modelId)
      if (cached) {
        logger.debug(`Using cached params for ${provider.id}/${modelId}`)
        return { success: true, schema: cached, fromCache: true }
      }
    }

    // 如果已知该 provider 不支持动态参数，直接使用静态配置
    if (this.unsupportedProviders.has(provider.id)) {
      logger.debug(`Provider ${provider.id} doesn't support dynamic params, using static config`)
      return this.getFallbackParams(provider.id, modelId)
    }

    // 检查是否应该尝试远程获取
    // 大多数中转 API 不支持 /v1/params 端点，所以默认使用静态配置
    // 只有明确配置了支持动态参数的 provider 才尝试远程获取
    const supportsDynamicParams = this.checkDynamicParamsSupport(provider)
    if (!supportsDynamicParams) {
      logger.debug(`Provider ${provider.id} not configured for dynamic params, using static config`)
      return this.getFallbackParams(provider.id, modelId)
    }

    // 构建请求 URL
    const baseUrl = this.getBaseUrl(provider)
    const url = `${baseUrl}/v1/params/${encodeURIComponent(modelId)}`

    try {
      logger.info(`Fetching params for ${provider.id}/${modelId} from ${url}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // 404 表示该端点不支持，标记并降级到静态配置
        if (response.status === 404) {
          logger.warn(`Params endpoint not supported for ${provider.id}, marking as unsupported`)
          this.unsupportedProviders.add(provider.id)
          return this.getFallbackParams(provider.id, modelId)
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const schema: RemoteModelParamsSchema = await response.json()

      // 验证 Schema 格式
      if (!schema.properties || typeof schema.properties !== 'object') {
        throw new Error('Invalid schema format: missing properties')
      }

      // 缓存结果
      this.cache.set(provider.id, modelId, schema)

      logger.info(`Successfully fetched params for ${provider.id}/${modelId}`)
      return { success: true, schema, fromCache: false }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // AbortError 表示超时
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn(`Timeout fetching params for ${provider.id}/${modelId}, falling back to static config`)
      } else {
        logger.debug(`Failed to fetch params for ${provider.id}/${modelId}: ${errorMessage}`)
      }

      // 标记为不支持，避免后续重复请求
      this.unsupportedProviders.add(provider.id)

      // 降级到静态配置
      return this.getFallbackParams(provider.id, modelId)
    }
  }

  /**
   * 检查 provider 是否支持动态参数获取
   *
   * 目前大多数中转 API 不支持 /v1/params 端点
   * 只有特定的 provider 才尝试远程获取
   *
   * 注意：大多数中转 API（如 one-api、new-api）使用 /v1/models 获取模型列表
   * 但不提供模型参数元数据端点，所以默认使用静态配置
   */
  private checkDynamicParamsSupport(provider: Provider): boolean {
    // 已知支持动态参数的 provider 列表
    // 如果你的中转服务支持 /v1/params/{model} 端点，可以添加到这里
    const supportedProviders: string[] = [
      // 'cherryin' // 如果 cherryin 支持，可以添加到这里
    ]

    // 检查 provider ID 是否匹配
    if (supportedProviders.includes(provider.id)) {
      return true
    }

    // 检查 apiHost 是否包含已知支持的域名
    const supportedHosts: string[] = [
      // 'api.cherryin.ai' // 如果支持，可以添加
    ]

    if (provider.apiHost) {
      for (const host of supportedHosts) {
        if (provider.apiHost.includes(host)) {
          return true
        }
      }
    }

    // 默认不支持，使用静态配置
    return false
  }

  /**
   * 获取 API 基础 URL
   */
  private getBaseUrl(provider: Provider): string {
    if (provider.apiHost) {
      return provider.apiHost.replace(/\/$/, '')
    }

    // 默认地址映射
    const defaultUrls: Record<string, string> = {
      openai: 'https://api.openai.com',
      zhipu: 'https://open.bigmodel.cn',
      siliconflow: 'https://api.siliconflow.cn',
      dmxapi: 'https://api.dmxapi.cn',
      cherryin: 'https://open.cherryin.ai'
    }

    return defaultUrls[provider.id] || 'https://api.openai.com'
  }

  /**
   * 降级到静态配置
   */
  private getFallbackParams(providerId: string, modelId: string): ModelParamsResult {
    // 从静态配置生成 Schema
    const schema = this.generateStaticSchema(providerId, modelId)

    if (schema) {
      // 缓存静态配置（较短的 TTL）
      this.cache.set(providerId, modelId, schema, 5 * 60 * 1000)
      return { success: true, schema, fromCache: false }
    }

    return {
      success: false,
      error: `No params available for ${providerId}/${modelId}`
    }
  }

  /**
   * 从静态配置生成 Schema
   */
  private generateStaticSchema(providerId: string, modelId: string): RemoteModelParamsSchema | null {
    const configType = inferModelConfigType(modelId, providerId)
    const modelConfig = MODEL_CONFIGS[configType]

    if (!modelConfig) {
      return null
    }

    const capabilities = getModelCapabilities(modelId, providerId)

    // 转换为远程 Schema 格式
    const properties: Record<string, RemoteFieldSchema> = {}

    for (const fieldKey of modelConfig.fields) {
      const fieldDef = FIELD_DEFINITIONS[fieldKey]
      if (!fieldDef) continue

      // 应用字段覆盖
      const override = modelConfig.fieldOverrides?.[fieldKey] || {}
      const field = { ...fieldDef, ...override }

      properties[fieldKey] = this.convertToRemoteSchema(field)
    }

    return {
      model: modelId,
      provider: providerId,
      name: modelConfig.name,
      capabilities: {
        supportsNegativePrompt: capabilities.supportsNegativePrompt,
        supportsImg2Img: capabilities.supportsImg2Img,
        supportsInpainting: capabilities.supportsInpainting,
        supportsControlNet: capabilities.supportsControlNet,
        supportsLoRA: capabilities.supportsLoRA,
        supportsUpscale: capabilities.supportsUpscale,
        maxBatchSize: capabilities.maxBatchSize,
        supportsChinesePrompt: capabilities.supportsChinesePrompt
      },
      properties,
      required: ['prompt']
    }
  }

  /**
   * 转换本地字段定义为远程 Schema 格式
   */
  private convertToRemoteSchema(field: any): RemoteFieldSchema {
    const schema: RemoteFieldSchema = {
      type: this.mapFieldType(field.type),
      title: field.label,
      description: field.description,
      default: field.defaultValue,
      'x-ui-group': field.group,
      'x-ui-placeholder': field.placeholder
    }

    // 数值范围
    if (field.min !== undefined) schema.minimum = field.min
    if (field.max !== undefined) schema.maximum = field.max
    if (field.step !== undefined) schema.multipleOf = field.step

    // 枚举选项
    if (field.options) {
      schema.enum = field.options.map((opt: any) => opt.value)
      schema.enumNames = field.options.map((opt: any) => opt.label)
    }

    // UI 控件类型
    if (field.type === 'slider') schema['x-ui-widget'] = 'slider'
    if (field.type === 'select') schema['x-ui-widget'] = 'select'
    if (field.type === 'switch') schema['x-ui-widget'] = 'switch'
    if (field.type === 'textarea') schema['x-ui-widget'] = 'textarea'
    if (field.type === 'seed') schema['x-ui-widget'] = 'seed'
    if (field.type === 'aspectRatio') schema['x-ui-widget'] = 'aspectRatio'
    if (field.type === 'images') schema['x-ui-widget'] = 'upload'

    return schema
  }

  /**
   * 映射字段类型
   */
  private mapFieldType(type: string): RemoteFieldType {
    const typeMap: Record<string, RemoteFieldType> = {
      text: 'string',
      textarea: 'string',
      number: 'number',
      slider: 'number',
      select: 'string',
      switch: 'boolean',
      seed: 'integer',
      aspectRatio: 'string',
      images: 'array'
    }
    return typeMap[type] || 'string'
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 使特定模型的缓存失效
   */
  invalidateCache(providerId: string, modelId: string): void {
    this.cache.invalidate(providerId, modelId)
  }
}

// ============================================================================
// 导出单例
// ============================================================================

export const modelParamsService = new ModelParamsService()

export default modelParamsService
