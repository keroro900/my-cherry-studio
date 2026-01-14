/**
 * ModelServiceBridge - 模型服务桥接器
 *
 * 为 VCP 插件提供完整的模型服务访问能力：
 * - 列出所有 Provider 和 Model
 * - 获取 Provider 的 API 配置（API Key、Base URL）
 * - 按能力查询合适的模型
 * - 直接调用任意模型
 * - 自动选择默认模型
 *
 * 权限级别：完全开放
 * 插件可以访问用户配置的所有模型资源
 *
 * @author Cherry Studio Team
 */

import OpenAI from '@cherrystudio/openai'
import type { ChatCompletionMessageParam } from '@cherrystudio/openai/resources/chat/completions'
import { loggerService } from '@logger'
import { reduxService } from '@main/services/ReduxService'
import type { Model, Provider } from '@types'

const logger = loggerService.withContext('VCP:ModelServiceBridge')

// ==================== 类型定义 ====================

/**
 * 模型能力标签
 */
export type ModelCapability =
  | 'chat' // 基础对话
  | 'vision' // 图像理解
  | 'coding' // 代码生成
  | 'long_context' // 长上下文
  | 'function_call' // 函数调用
  | 'reasoning' // 推理/思考
  | 'embedding' // 向量化
  | 'image_generation' // 图像生成
  | 'audio' // 音频处理
  | 'video' // 视频处理

/**
 * Provider 信息（对插件暴露）
 */
export interface ProviderInfo {
  id: string
  name: string
  type: string
  apiHost: string
  apiKey: string
  enabled: boolean
  isSystem: boolean
  modelCount: number
}

/**
 * Model 信息（对插件暴露）
 */
export interface ModelInfo {
  id: string
  name: string
  providerId: string
  providerName: string
  group?: string
  contextLength?: number
  maxTokens?: number
  capabilities: ModelCapability[]
  // API 配置
  apiHost: string
  apiKey: string
}

/**
 * 模型查询条件
 */
export interface ModelQuery {
  /** 所需能力（满足任一即可） */
  capabilities?: ModelCapability[]
  /** 必须满足所有能力 */
  requireAllCapabilities?: boolean
  /** 指定 Provider */
  providerId?: string
  /** 模型名称包含 */
  nameContains?: string
  /** 最小上下文长度 */
  minContextLength?: number
  /** 最大返回数量 */
  limit?: number
}

/**
 * 模型调用请求
 */
export interface ModelCallRequest {
  /** 模型 ID（如果不指定，使用能力匹配或默认模型） */
  modelId?: string
  /** Provider ID（如果不指定，自动查找） */
  providerId?: string
  /** 所需能力（用于自动选择模型） */
  capabilities?: ModelCapability[]
  /** 消息 */
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
  }>
  /** 温度 */
  temperature?: number
  /** 最大 Token */
  maxTokens?: number
  /** 是否流式 */
  stream?: boolean
}

/**
 * 模型调用结果
 */
export interface ModelCallResult {
  success: boolean
  content?: string
  error?: string
  modelUsed?: {
    modelId: string
    providerId: string
    providerName: string
  }
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ==================== 能力推断 ====================

/**
 * 根据模型信息推断其能力
 * 2025 年更新：支持最新模型系列
 */
function inferModelCapabilities(model: Model): ModelCapability[] {
  const capabilities: ModelCapability[] = ['chat'] // 所有模型至少支持对话
  const modelId = model.id.toLowerCase()
  const modelName = (model.name || '').toLowerCase()
  const combined = `${modelId} ${modelName}`

  // Vision 能力 (多模态视觉理解)
  if (
    combined.includes('vision') ||
    // GPT 系列
    combined.includes('4o') ||
    combined.includes('gpt-4-turbo') ||
    combined.includes('gpt-5') ||
    combined.includes('o3') ||
    // Claude 系列
    combined.includes('claude-3') ||
    combined.includes('claude-4') ||
    // Gemini 系列 (全系列支持多模态)
    combined.includes('gemini') ||
    // 国产模型
    combined.includes('qwen-vl') ||
    combined.includes('qwen2-vl') ||
    combined.includes('glm-4v') ||
    combined.includes('deepseek-vl')
  ) {
    capabilities.push('vision')
  }

  // Coding 能力 (代码生成与理解)
  if (
    combined.includes('code') ||
    combined.includes('codex') ||
    // DeepSeek 编程系列
    combined.includes('deepseek-coder') ||
    combined.includes('deepseek-v3') ||
    // StarCoder / CodeLlama
    combined.includes('starcoder') ||
    combined.includes('codellama') ||
    // Qwen 编程系列
    combined.includes('qwen2.5-coder') ||
    combined.includes('qwen3-coder') ||
    // Claude 4.5 Sonnet 编程能力最强
    combined.includes('claude-4.5-sonnet') ||
    combined.includes('claude-4-sonnet')
  ) {
    capabilities.push('coding')
  }

  // 长上下文 - 基于模型名称推断
  if (
    combined.includes('128k') ||
    combined.includes('200k') ||
    combined.includes('1m') ||
    combined.includes('2m') ||
    combined.includes('long') ||
    // Gemini 系列 (1M-2M tokens)
    combined.includes('gemini-1.5') ||
    combined.includes('gemini-2') ||
    combined.includes('gemini-3') ||
    // Claude 系列 (200K tokens)
    combined.includes('claude-3') ||
    combined.includes('claude-4') ||
    // GPT 系列
    combined.includes('gpt-4-turbo') ||
    combined.includes('gpt-4o') ||
    combined.includes('gpt-5') ||
    // DeepSeek (128K+)
    combined.includes('deepseek-v3') ||
    combined.includes('deepseek-r1')
  ) {
    capabilities.push('long_context')
  }

  // 推理能力 (Chain of Thought / Reasoning)
  if (
    // OpenAI O 系列
    combined.includes('o1') ||
    combined.includes('o3') ||
    combined.includes('o4') ||
    // DeepSeek R1 系列 (推理专用)
    combined.includes('deepseek-r1') ||
    combined.includes('deepseek-reasoner') ||
    // Qwen QwQ 系列
    combined.includes('qwq') ||
    combined.includes('qwen-reasoning') ||
    // 通用标记
    combined.includes('thinking') ||
    combined.includes('reasoning') ||
    // Gemini 3 Pro 推理能力强
    combined.includes('gemini-3-pro') ||
    combined.includes('gemini-3-ultra')
  ) {
    capabilities.push('reasoning')
  }

  // Function Call / Tool Use
  if (
    // GPT 系列
    combined.includes('gpt-4') ||
    combined.includes('gpt-5') ||
    combined.includes('gpt-3.5-turbo') ||
    // Claude 系列
    combined.includes('claude-3') ||
    combined.includes('claude-4') ||
    // Gemini 系列
    combined.includes('gemini') ||
    // Qwen 系列
    combined.includes('qwen') ||
    // Mistral
    combined.includes('mistral') ||
    // Llama 3
    combined.includes('llama-3')
  ) {
    capabilities.push('function_call')
  }

  // Embedding
  if (
    combined.includes('embed') ||
    combined.includes('embedding') ||
    combined.includes('text-embedding') ||
    combined.includes('bge-') ||
    combined.includes('e5-')
  ) {
    capabilities.push('embedding')
  }

  // 图像生成
  if (
    combined.includes('dall-e') ||
    combined.includes('imagen') ||
    combined.includes('sd') ||
    combined.includes('stable-diffusion') ||
    combined.includes('midjourney') ||
    combined.includes('flux')
  ) {
    capabilities.push('image_generation')
  }

  // 视频处理
  if (
    combined.includes('video') ||
    combined.includes('sora') ||
    combined.includes('kling') ||
    combined.includes('runway') ||
    combined.includes('pika')
  ) {
    capabilities.push('video')
  }

  // 音频处理
  if (
    combined.includes('whisper') ||
    combined.includes('audio') ||
    combined.includes('speech') ||
    combined.includes('tts') ||
    combined.includes('voice')
  ) {
    capabilities.push('audio')
  }

  return capabilities
}

// ==================== ModelServiceBridge 实现 ====================

/**
 * 将 ModelCallRequest 的消息格式转换为 OpenAI SDK 格式
 */
function toOpenAIMessages(messages: ModelCallRequest['messages']): ChatCompletionMessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content
  })) as ChatCompletionMessageParam[]
}

class ModelServiceBridgeImpl {
  private providerCache: Map<string, Provider> = new Map()
  private lastCacheUpdate: number = 0
  private readonly cacheTTL = 30000 // 30 seconds

  /**
   * 获取所有已启用的 Providers
   */
  async getProviders(): Promise<Provider[]> {
    const now = Date.now()
    if (now - this.lastCacheUpdate > this.cacheTTL) {
      this.providerCache.clear()
      this.lastCacheUpdate = now
    }

    try {
      const providers = await reduxService.select<Provider[]>('state.llm.providers')
      if (!providers || !Array.isArray(providers)) {
        return []
      }
      return providers.filter((p) => p.enabled)
    } catch (error) {
      logger.error('Failed to get providers', { error: String(error) })
      return []
    }
  }

  /**
   * 列出所有 Provider 信息
   */
  async listProviders(): Promise<ProviderInfo[]> {
    const providers = await this.getProviders()
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      apiHost: p.apiHost,
      apiKey: p.apiKey,
      enabled: p.enabled ?? true,
      isSystem: p.isSystem ?? false,
      modelCount: p.models?.length ?? 0
    }))
  }

  /**
   * 获取指定 Provider 的完整信息
   */
  async getProvider(providerId: string): Promise<ProviderInfo | null> {
    const providers = await this.getProviders()
    const provider = providers.find((p) => p.id === providerId)
    if (!provider) return null

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      apiHost: provider.apiHost,
      apiKey: provider.apiKey,
      enabled: provider.enabled ?? true,
      isSystem: provider.isSystem ?? false,
      modelCount: provider.models?.length ?? 0
    }
  }

  /**
   * 获取 Provider 的 API 配置（直接暴露 API Key）
   */
  async getProviderCredentials(providerId: string): Promise<{ apiKey: string; apiHost: string; type: string } | null> {
    const providers = await this.getProviders()
    const provider = providers.find((p) => p.id === providerId)
    if (!provider) return null

    return {
      apiKey: provider.apiKey,
      apiHost: provider.apiHost,
      type: provider.type
    }
  }

  /**
   * 列出所有模型
   */
  async listModels(providerId?: string): Promise<ModelInfo[]> {
    const providers = await this.getProviders()
    const models: ModelInfo[] = []

    for (const provider of providers) {
      if (providerId && provider.id !== providerId) continue

      for (const model of provider.models || []) {
        models.push({
          id: model.id,
          name: model.name || model.id,
          providerId: provider.id,
          providerName: provider.name,
          group: model.group,
          contextLength: undefined, // Model 类型中暂无此属性
          maxTokens: undefined, // Model 类型中暂无此属性
          capabilities: inferModelCapabilities(model),
          apiHost: provider.apiHost,
          apiKey: provider.apiKey
        })
      }
    }

    return models
  }

  /**
   * 按条件查询模型
   */
  async queryModels(query: ModelQuery): Promise<ModelInfo[]> {
    let models = await this.listModels(query.providerId)

    // 按能力过滤
    if (query.capabilities && query.capabilities.length > 0) {
      models = models.filter((m) => {
        if (query.requireAllCapabilities) {
          return query.capabilities!.every((c) => m.capabilities.includes(c))
        } else {
          return query.capabilities!.some((c) => m.capabilities.includes(c))
        }
      })
    }

    // 按名称过滤
    if (query.nameContains) {
      const search = query.nameContains.toLowerCase()
      models = models.filter((m) => m.id.toLowerCase().includes(search) || m.name.toLowerCase().includes(search))
    }

    // 按上下文长度过滤 - 由于 Model 类型无此属性，改用 long_context 能力过滤
    if (query.minContextLength && query.minContextLength >= 100000) {
      models = models.filter((m) => m.capabilities.includes('long_context'))
    }

    // 限制数量
    if (query.limit && query.limit > 0) {
      models = models.slice(0, query.limit)
    }

    return models
  }

  /**
   * 获取最适合的模型（用于自动选择）
   * 优先级基于 2025 年最新模型排名
   */
  async getBestModel(capabilities?: ModelCapability[]): Promise<ModelInfo | null> {
    // 2025 年最新模型优先级列表（基于综合能力排名）
    const preferredModels = [
      // Tier 1: 2025 顶级模型
      'gemini-3-pro', // Reasoning 基准测试领先 (1501 Elo)
      'gemini-3', // Gemini 3 系列
      'claude-4.5-sonnet', // 编码能力最强 (77.2% SWE-bench)
      'claude-4-opus', // Claude 4 旗舰
      'gpt-5', // OpenAI 最新旗舰
      'gpt-5.1', // GPT-5.1 改进版
      'o3', // OpenAI 推理模型
      'o3-mini', // O3 精简版
      'deepseek-r1', // 推理能力出色，性价比高
      'deepseek-v3', // DeepSeek V3 系列

      // Tier 2: 高性能模型
      'gemini-2.5-pro', // Gemini 2.5 系列
      'gemini-2.0-flash', // Gemini 2.0 快速版
      'claude-3.5-sonnet', // Claude 3.5 系列
      'claude-3-opus', // Claude 3 旗舰
      'gpt-4o', // GPT-4o 多模态
      'gpt-4-turbo', // GPT-4 Turbo
      'qwen3', // 通义千问 3
      'qwen2.5-max', // Qwen 2.5 旗舰

      // Tier 3: 性价比模型
      'gemini-1.5-pro', // Gemini 1.5 系列
      'deepseek-chat', // DeepSeek 对话模型
      'qwen-plus', // 通义千问 Plus
      'llama-3.3', // Meta Llama 3.3
      'mistral-large' // Mistral Large
    ]

    const models = await this.queryModels({
      capabilities,
      requireAllCapabilities: capabilities ? true : false
    })

    if (models.length === 0) {
      // 回退：获取任意可用模型
      const allModels = await this.listModels()
      return allModels[0] || null
    }

    // 按优先级排序
    models.sort((a, b) => {
      const aIndex = preferredModels.findIndex((p) => a.id.toLowerCase().includes(p))
      const bIndex = preferredModels.findIndex((p) => b.id.toLowerCase().includes(p))
      const aScore = aIndex === -1 ? 999 : aIndex
      const bScore = bIndex === -1 ? 999 : bIndex
      return aScore - bScore
    })

    return models[0]
  }

  /**
   * 获取模型的 API 配置
   */
  async getModelCredentials(
    modelId: string,
    providerId?: string
  ): Promise<{ modelId: string; providerId: string; apiKey: string; apiHost: string } | null> {
    const models = await this.listModels(providerId)
    const model = models.find((m) => m.id === modelId || m.id.includes(modelId))
    if (!model) return null

    return {
      modelId: model.id,
      providerId: model.providerId,
      apiKey: model.apiKey,
      apiHost: model.apiHost
    }
  }

  /**
   * 调用模型
   */
  async callModel(request: ModelCallRequest): Promise<ModelCallResult> {
    try {
      // 确定使用哪个模型
      let targetModel: ModelInfo | null = null

      if (request.modelId) {
        // 指定了模型 ID
        const models = await this.listModels(request.providerId)
        targetModel = models.find((m) => m.id === request.modelId) || null
      } else if (request.capabilities) {
        // 按能力匹配
        targetModel = await this.getBestModel(request.capabilities)
      } else {
        // 使用默认模型
        targetModel = await this.getBestModel()
      }

      if (!targetModel) {
        return {
          success: false,
          error: 'No suitable model found'
        }
      }

      logger.info('Calling model via bridge', {
        modelId: targetModel.id,
        providerId: targetModel.providerId,
        capabilities: targetModel.capabilities
      })

      // 创建 OpenAI 客户端
      const client = new OpenAI({
        baseURL: targetModel.apiHost,
        apiKey: targetModel.apiKey
      })

      const temperature = request.temperature ?? 0.7
      const maxTokens = request.maxTokens ?? 4096

      if (request.stream) {
        // 流式调用（返回完整内容）
        const stream = await client.chat.completions.create({
          model: targetModel.id,
          messages: toOpenAIMessages(request.messages),
          temperature,
          max_tokens: maxTokens,
          stream: true
        })

        let fullContent = ''
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
          }
        }

        return {
          success: true,
          content: fullContent,
          modelUsed: {
            modelId: targetModel.id,
            providerId: targetModel.providerId,
            providerName: targetModel.providerName
          }
        }
      } else {
        // 非流式调用
        const response = await client.chat.completions.create({
          model: targetModel.id,
          messages: toOpenAIMessages(request.messages),
          temperature,
          max_tokens: maxTokens,
          stream: false
        })

        // 安全访问 response.choices
        if (!response || !response.choices || response.choices.length === 0) {
          logger.error('Model returned empty response', { modelId: targetModel.id })
          return {
            success: false,
            error: 'Model returned empty response (no choices)',
            modelUsed: {
              modelId: targetModel.id,
              providerId: targetModel.providerId,
              providerName: targetModel.providerName
            }
          }
        }

        const content = response.choices[0]?.message?.content || ''
        const usage = response.usage

        return {
          success: true,
          content,
          modelUsed: {
            modelId: targetModel.id,
            providerId: targetModel.providerId,
            providerName: targetModel.providerName
          },
          usage: usage
            ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens
              }
            : undefined
        }
      }
    } catch (error) {
      logger.error('Model call failed', { error: String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 创建 OpenAI 兼容客户端（直接暴露给插件使用）
   */
  async createClient(providerId?: string, modelId?: string): Promise<{ client: OpenAI; modelId: string } | null> {
    let credentials: { modelId: string; apiKey: string; apiHost: string } | null = null

    if (providerId && modelId) {
      credentials = await this.getModelCredentials(modelId, providerId)
    } else if (modelId) {
      credentials = await this.getModelCredentials(modelId)
    } else {
      // 获取默认模型
      const bestModel = await this.getBestModel()
      if (bestModel) {
        credentials = {
          modelId: bestModel.id,
          apiKey: bestModel.apiKey,
          apiHost: bestModel.apiHost
        }
      }
    }

    if (!credentials) return null

    const client = new OpenAI({
      baseURL: credentials.apiHost,
      apiKey: credentials.apiKey
    })

    return { client, modelId: credentials.modelId }
  }
}

// ==================== 单例导出 ====================

let instance: ModelServiceBridgeImpl | null = null

export function getModelServiceBridge(): ModelServiceBridgeImpl {
  if (!instance) {
    instance = new ModelServiceBridgeImpl()
  }
  return instance
}

export type ModelServiceBridge = ModelServiceBridgeImpl
