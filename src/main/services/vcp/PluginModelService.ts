/**
 * Plugin Model Service
 *
 * 为 VCP 插件提供 AI 模型调用能力
 * 使用 Cherry Studio 的 Provider 系统
 * 已集成 UnifiedAIClientFactory 提供统一的重试、限流、日志功能
 */

import OpenAI from '@cherrystudio/openai'
import { loggerService } from '@logger'
import { UnifiedAIClientFactory } from '@main/services/ai'
import { reduxService } from '@main/services/ReduxService'
import type { Provider } from '@types'

import type { PluginModelConfig } from './types'

const logger = loggerService.withContext('VCP:PluginModelService')

/**
 * 模型调用请求
 */
export interface PluginModelRequest {
  /** 用户消息 */
  userMessage: string
  /** 系统提示词（可选） */
  systemPrompt?: string
  /** 历史消息（可选） */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  /** 温度（可选，覆盖 modelConfig） */
  temperature?: number
  /** 最大 Token（可选，覆盖 modelConfig） */
  maxTokens?: number
}

/**
 * 模型调用结果
 */
export interface PluginModelResult {
  success: boolean
  content?: string
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Plugin Model Service
 */
class PluginModelServiceImpl {
  private providerCache: Map<string, Provider> = new Map()
  private lastCacheUpdate: number = 0
  private readonly cacheTTL = 30000 // 30 seconds

  /**
   * 获取所有可用的 Provider
   */
  private async getProviders(): Promise<Provider[]> {
    const now = Date.now()
    if (now - this.lastCacheUpdate > this.cacheTTL) {
      this.providerCache.clear()
      this.lastCacheUpdate = now
    }

    try {
      const providers = await reduxService.select('state.llm.providers')
      if (!providers || !Array.isArray(providers)) {
        return []
      }
      return providers.filter((p: Provider) => p.enabled)
    } catch (error) {
      logger.error('Failed to get providers', { error: String(error) })
      return []
    }
  }

  /**
   * 获取指定的 Provider
   */
  private async getProvider(providerId: string): Promise<Provider | null> {
    if (this.providerCache.has(providerId)) {
      return this.providerCache.get(providerId)!
    }

    const providers = await this.getProviders()
    const provider = providers.find((p) => p.id === providerId)

    if (provider) {
      this.providerCache.set(providerId, provider)
    }

    return provider || null
  }

  /**
   * 调用模型
   */
  async callModel(modelConfig: PluginModelConfig, request: PluginModelRequest): Promise<PluginModelResult> {
    if (!modelConfig.enabled) {
      return {
        success: false,
        error: 'Model binding is not enabled'
      }
    }

    if (!modelConfig.providerId || !modelConfig.modelId) {
      return {
        success: false,
        error: 'Provider or model not configured'
      }
    }

    const provider = await this.getProvider(modelConfig.providerId)
    if (!provider) {
      return {
        success: false,
        error: `Provider '${modelConfig.providerId}' not found or disabled`
      }
    }

    // 构建消息
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    // 系统提示词
    const systemPrompt = request.systemPrompt || modelConfig.systemPrompt
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    // 历史消息
    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // 用户消息
    messages.push({ role: 'user', content: request.userMessage })

    // 创建 OpenAI 客户端
    const client = new OpenAI({
      baseURL: provider.apiHost,
      apiKey: provider.apiKey
    })

    // 调用模型 (通过 UnifiedAIClientFactory 提供重试、限流、日志)
    const temperature = request.temperature ?? modelConfig.temperature ?? 0.7
    const maxTokens = request.maxTokens ?? modelConfig.maxTokens ?? 4096
    const modelId = modelConfig.modelId! // 已在上方验证非空

    logger.info('Calling model for plugin', {
      providerId: modelConfig.providerId,
      modelId,
      messageCount: messages.length,
      temperature,
      maxTokens
    })

    const result = await UnifiedAIClientFactory.execute(
      modelConfig.providerId!,
      modelId,
      async () => {
        const response = await client.chat.completions.create({
          model: modelId,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        })

        const content = response.choices[0]?.message?.content || ''
        const usage = response.usage

        return {
          content,
          usage: usage
            ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens
              }
            : undefined
        }
      },
      {
        maxRetries: 2,
        enableRateLimit: true
      }
    )

    if (result.success && result.data) {
      logger.info('Model call completed', {
        providerId: modelConfig.providerId,
        modelId: modelConfig.modelId,
        duration: result.metadata.duration,
        contentLength: result.data.content.length
      })

      return {
        success: true,
        content: result.data.content,
        usage: result.data.usage
      }
    } else {
      logger.error('Model call failed', {
        providerId: modelConfig.providerId,
        modelId: modelConfig.modelId,
        error: result.error?.message
      })

      return {
        success: false,
        error: result.error?.message || 'Unknown error'
      }
    }
  }

  /**
   * 流式调用模型
   */
  async callModelStream(
    modelConfig: PluginModelConfig,
    request: PluginModelRequest,
    onChunk: (chunk: string) => void
  ): Promise<PluginModelResult> {
    if (!modelConfig.enabled) {
      return {
        success: false,
        error: 'Model binding is not enabled'
      }
    }

    if (!modelConfig.providerId || !modelConfig.modelId) {
      return {
        success: false,
        error: 'Provider or model not configured'
      }
    }

    const provider = await this.getProvider(modelConfig.providerId)
    if (!provider) {
      return {
        success: false,
        error: `Provider '${modelConfig.providerId}' not found or disabled`
      }
    }

    // 构建消息
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    const systemPrompt = request.systemPrompt || modelConfig.systemPrompt
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: request.userMessage })

    const client = new OpenAI({
      baseURL: provider.apiHost,
      apiKey: provider.apiKey
    })

    const temperature = request.temperature ?? modelConfig.temperature ?? 0.7
    const maxTokens = request.maxTokens ?? modelConfig.maxTokens ?? 4096
    const modelId = modelConfig.modelId! // 已在上方验证非空

    logger.info('Calling model (stream) for plugin', {
      providerId: modelConfig.providerId,
      modelId,
      messageCount: messages.length
    })

    // 通过 UnifiedAIClientFactory 提供重试、限流功能
    const result = await UnifiedAIClientFactory.execute(
      modelConfig.providerId!,
      modelId,
      async () => {
        const stream = await client.chat.completions.create({
          model: modelId,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true
        })

        let fullContent = ''

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            onChunk(delta)
          }
        }

        return { content: fullContent }
      },
      {
        maxRetries: 1, // 流式调用重试次数较少
        enableRateLimit: true
      }
    )

    if (result.success && result.data) {
      logger.info('Model stream completed', {
        providerId: modelConfig.providerId,
        modelId: modelConfig.modelId,
        contentLength: result.data.content.length,
        duration: result.metadata.duration
      })

      return {
        success: true,
        content: result.data.content
      }
    } else {
      logger.error('Model stream failed', {
        providerId: modelConfig.providerId,
        modelId: modelConfig.modelId,
        error: result.error?.message
      })

      return {
        success: false,
        error: result.error?.message || 'Unknown error'
      }
    }
  }
}

// 单例
let instance: PluginModelServiceImpl | null = null

export function getPluginModelService(): PluginModelServiceImpl {
  if (!instance) {
    instance = new PluginModelServiceImpl()
  }
  return instance
}

export type PluginModelService = PluginModelServiceImpl
