/**
 * Model Proxy Adapter - 将 VCPToolBox 的 AI 调用重定向到 Cherry Studio 的 Provider 系统
 *
 * 这个适配器作为 VCPToolBox 和 Cherry Studio Provider 之间的桥梁：
 * - VCPToolBox 原本直接调用外部 API (如 OpenAI)
 * - 现在通过这个适配器，使用 Cherry Studio 已配置的 Provider
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('ModelProxyAdapter')

// 模型代理适配器 - 将 VCPToolBox 的 AI 调用重定向到 Cherry Studio
export interface ModelProxyAdapter {
  // 执行 chat completion
  chatCompletion: (
    messages: Array<{
      role: string
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
    }>,
    options: {
      model: string
      stream?: boolean
      temperature?: number
      max_tokens?: number
    }
  ) => Promise<{
    content: string
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }>

  // 执行 embedding
  embedding: (texts: string[], model: string) => Promise<number[][]>
}

// Cherry Studio 的 Provider 接口 (简化版)
export interface CherryProvider {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  models: Array<{ id: string; name: string }>
}

// 模型选择策略
export type ModelSelectionStrategy = 'default' | 'by_task' | 'by_name'

export interface ModelProxyConfig {
  // 默认使用的 Provider ID
  defaultProviderId?: string
  // 默认使用的模型 ID
  defaultModelId?: string
  // 嵌入模型 ID
  embeddingModelId?: string
  // 模型选择策略
  selectionStrategy: ModelSelectionStrategy
}

/**
 * 创建 Model Proxy Adapter
 *
 * @param getProvider - 获取 Provider 的函数 (由 Cherry Studio 提供)
 * @param config - 代理配置
 */
export function createModelProxyAdapter(
  getProvider: (providerId?: string) => CherryProvider | null,
  sendChatRequest: (
    providerId: string,
    modelId: string,
    messages: Array<{ role: string; content: any }>,
    options: { stream?: boolean; temperature?: number; max_tokens?: number }
  ) => Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }>,
  sendEmbeddingRequest: (providerId: string, modelId: string, texts: string[]) => Promise<number[][]>,
  config: ModelProxyConfig
): ModelProxyAdapter {
  return {
    async chatCompletion(messages, options) {
      const provider = getProvider(config.defaultProviderId)
      if (!provider) {
        throw new Error('No provider available for chat completion')
      }

      const modelId = options.model || config.defaultModelId
      if (!modelId) {
        throw new Error('No model specified for chat completion')
      }

      logger.debug('Chat completion request', { providerId: provider.id, modelId })

      return await sendChatRequest(provider.id, modelId, messages as any, {
        stream: options.stream,
        temperature: options.temperature,
        max_tokens: options.max_tokens
      })
    },

    async embedding(texts, model) {
      const provider = getProvider(config.defaultProviderId)
      if (!provider) {
        throw new Error('No provider available for embedding')
      }

      const modelId = model || config.embeddingModelId
      if (!modelId) {
        throw new Error('No embedding model specified')
      }

      logger.debug('Embedding request', { providerId: provider.id, modelId, textCount: texts.length })

      return await sendEmbeddingRequest(provider.id, modelId, texts)
    }
  }
}

/**
 * Mock 适配器 - 用于测试
 */
export function createMockModelProxyAdapter(): ModelProxyAdapter {
  const mockLogger = loggerService.withContext('MockModelProxyAdapter')

  return {
    async chatCompletion(messages, options) {
      mockLogger.debug('Chat completion called', { messageCount: messages.length, options })
      return {
        content: `[Mock Response] Received ${messages.length} messages with model ${options.model}`,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }
    },

    async embedding(texts, model) {
      mockLogger.debug('Embedding called', { textCount: texts.length, model })
      // 返回假的嵌入向量 (3072 维)
      return texts.map(() =>
        Array(3072)
          .fill(0)
          .map(() => Math.random())
      )
    }
  }
}
