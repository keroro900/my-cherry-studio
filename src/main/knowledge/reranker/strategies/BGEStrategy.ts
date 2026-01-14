import type { MultiModalDocument, RerankStrategy } from './RerankStrategy'

/**
 * BGE-Reranker 策略 (自托管)
 *
 * 兼容 HuggingFace TEI 格式，但有不同的默认模型
 * 常用模型: BAAI/bge-reranker-v2-m3, BAAI/bge-reranker-large
 */
export class BGEStrategy implements RerankStrategy {
  buildUrl(baseURL?: string): string {
    if (!baseURL) {
      throw new Error('BGE reranker requires a baseURL (self-hosted endpoint)')
    }
    // 兼容 TEI 和 Xinference 格式
    if (baseURL.endsWith('/')) {
      return `${baseURL}rerank`
    }
    if (baseURL.endsWith('/v1')) {
      return `${baseURL}/rerank`
    }
    return `${baseURL}/v1/rerank`
  }

  buildRequestBody(
    query: string,
    documents: MultiModalDocument[],
    topN: number,
    model?: string
  ): Record<string, unknown> {
    const textDocuments = documents.filter((d) => d.text).map((d) => d.text!)

    return {
      model: model || 'BAAI/bge-reranker-v2-m3',
      query,
      // 某些 BGE 服务使用 texts 而非 documents
      texts: textDocuments,
      documents: textDocuments,
      top_n: topN
    }
  }

  extractResults(data: any): Array<{ index: number; relevance_score: number }> {
    // BGE 可能返回不同格式
    // 格式 1 (TEI 风格): [{ index: 0, score: 0.98 }, ...]
    // 格式 2 (results 包装): { results: [...] }

    const results = data.results || data

    if (Array.isArray(results)) {
      return results.map((r: any) => ({
        index: r.index,
        relevance_score: r.score ?? r.relevance_score ?? 0
      }))
    }

    return []
  }
}
