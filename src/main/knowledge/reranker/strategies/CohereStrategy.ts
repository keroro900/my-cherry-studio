import type { MultiModalDocument, RerankStrategy } from './RerankStrategy'

/**
 * Cohere Rerank API 策略
 *
 * API 文档: https://docs.cohere.com/reference/rerank
 */
export class CohereStrategy implements RerankStrategy {
  buildUrl(baseURL?: string): string {
    // Cohere 官方端点
    if (!baseURL) {
      return 'https://api.cohere.com/v2/rerank'
    }
    // 自定义端点
    if (baseURL.endsWith('/')) {
      return `${baseURL}v2/rerank`
    }
    return `${baseURL}/v2/rerank`
  }

  buildRequestBody(
    query: string,
    documents: MultiModalDocument[],
    topN: number,
    model?: string
  ): Record<string, unknown> {
    const textDocuments = documents.filter((d) => d.text).map((d) => d.text!)

    return {
      model: model || 'rerank-v3.5',
      query,
      documents: textDocuments,
      top_n: topN,
      return_documents: false
    }
  }

  extractResults(data: any): Array<{ index: number; relevance_score: number }> {
    // Cohere v2 响应格式
    // { results: [{ index: 0, relevance_score: 0.98 }, ...] }
    return (data.results || []).map((r: any) => ({
      index: r.index,
      relevance_score: r.relevance_score
    }))
  }
}
