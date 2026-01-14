import type { BaseEmbeddings } from '@cherrystudio/embedjs-interfaces'
import { TraceMethod } from '@mcp-trace/trace-core'
import type { ApiClient } from '@types'

import EmbeddingsFactory from './EmbeddingsFactory'

// 带超时的 Promise 包装器 (参考 VCPToolBox)
function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Embedding operation timed out'): Promise<T> {
  let timeoutId: NodeJS.Timeout
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId)
  })
}

// 默认超时 15 秒
const EMBEDDING_TIMEOUT = 15000

export default class Embeddings {
  private sdk: BaseEmbeddings
  constructor({ embedApiClient, dimensions }: { embedApiClient: ApiClient; dimensions?: number }) {
    this.sdk = EmbeddingsFactory.create({
      embedApiClient,
      dimensions
    })
  }
  public async init(): Promise<void> {
    return this.sdk.init()
  }

  @TraceMethod({ spanName: 'dimensions', tag: 'Embeddings' })
  public async getDimensions(): Promise<number> {
    return this.sdk.getDimensions()
  }

  @TraceMethod({ spanName: 'embedDocuments', tag: 'Embeddings' })
  public async embedDocuments(texts: string[]): Promise<number[][]> {
    return withTimeout(this.sdk.embedDocuments(texts), EMBEDDING_TIMEOUT, 'embedDocuments timed out')
  }

  @TraceMethod({ spanName: 'embedQuery', tag: 'Embeddings' })
  public async embedQuery(text: string): Promise<number[]> {
    return withTimeout(this.sdk.embedQuery(text), EMBEDDING_TIMEOUT, 'embedQuery timed out')
  }
}
