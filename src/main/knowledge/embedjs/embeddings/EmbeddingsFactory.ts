import type { BaseEmbeddings } from '@cherrystudio/embedjs-interfaces'
import { OllamaEmbeddings } from '@cherrystudio/embedjs-ollama'
import { OpenAiEmbeddings } from '@cherrystudio/embedjs-openai'
import type { ApiClient } from '@types'
import { net } from 'electron'

import { VoyageEmbeddings } from './VoyageEmbeddings'

export default class EmbeddingsFactory {
  static create({ embedApiClient, dimensions }: { embedApiClient: ApiClient; dimensions?: number }): BaseEmbeddings {
    const batchSize = 10
    const { model, provider, apiKey, baseURL } = embedApiClient
    if (provider === 'voyageai') {
      return new VoyageEmbeddings({
        modelName: model,
        apiKey,
        outputDimension: dimensions,
        batchSize: 8
      })
    }
    if (provider === 'ollama') {
      return new OllamaEmbeddings({
        model: model,
        baseUrl: baseURL.replace(/\/api$/, ''),
        requestOptions: {
          // @ts-ignore expected
          'encoding-format': 'float'
        }
      })
    }

    // 检查是否为 Jina 模型（包括通过 302ai 等代理使用的 Jina 模型）
    // Jina CLIP 模型不支持 dimensions 参数，因为它们有固定的输出维度
    const isJinaModel = model.toLowerCase().includes('jina')
    const effectiveDimensions = isJinaModel ? undefined : dimensions

    // NOTE: Azure OpenAI 也走 OpenAIEmbeddings, baseURL是https://xxxx.openai.azure.com/openai/v1
    return new OpenAiEmbeddings({
      model,
      apiKey,
      dimensions: effectiveDimensions,
      batchSize,
      maxRetries: 2, // 减少重试次数，避免长时间等待
      timeout: 30000, // 30秒超时
      configuration: { baseURL, fetch: net.fetch as typeof fetch }
    })
  }
}
