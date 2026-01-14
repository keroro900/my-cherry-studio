/**
 * Reranker 模块统一导出
 *
 * 包含两类重排序服务:
 * 1. API 策略 (Cohere, Jina, BGE 等) - 调用外部 API
 * 2. 本地策略 (SwissTournament) - 本地多轮比较
 */

// ==================== API-based Rerankers ====================

export { default as BaseReranker } from './BaseReranker'
export { default as GeneralReranker } from './GeneralReranker'
export { default as Reranker } from './Reranker'

// 策略工厂
export { StrategyFactory } from './strategies/StrategyFactory'
export type { RerankStrategy, MultiModalDocument } from './strategies/RerankStrategy'
export { RERANKER_PROVIDERS, isKnownProvider, isTEIProvider } from './strategies/types'
export type { RerankProvider } from './strategies/types'

// 具体策略
export { BailianStrategy } from './strategies/BailianStrategy'
export { BGEStrategy } from './strategies/BGEStrategy'
export { CohereStrategy } from './strategies/CohereStrategy'
export { DefaultStrategy } from './strategies/DefaultStrategy'
export { JinaStrategy } from './strategies/JinaStrategy'
export { TEIStrategy } from './strategies/TeiStrategy'
export { VoyageAIStrategy } from './strategies/VoyageStrategy'

// ==================== Local Rerankers ====================

// 瑞士制重排序服务 (本地多轮比较)
export {
  createAIComparisonStrategy,
  getSwissTournamentRerankService,
  SwissTournamentRerankService,
  swissRerank,
  VectorSimilarityStrategy
} from './SwissTournamentRerankService'

export type {
  ComparisonStrategy,
  SwissTournamentConfig,
  SwissTournamentResult,
  TournamentDocument
} from './SwissTournamentRerankService'

// ==================== 统一重排序入口 ====================

import type { KnowledgeSearchResult } from '@types'
import { getSwissTournamentRerankService, type TournamentDocument } from './SwissTournamentRerankService'

/**
 * 高级重排序选项
 */
export interface AdvancedRerankOptions {
  /** 使用瑞士制多轮重排序 */
  useSwissTournament?: boolean
  /** 瑞士制轮数 (默认 3) */
  swissRounds?: number
  /** 查询文本 (用于瑞士制比较) */
  query?: string
}

/**
 * 使用瑞士制重排序知识库搜索结果
 */
export async function swissRerankSearchResults(
  query: string,
  results: KnowledgeSearchResult[],
  options?: { rounds?: number }
): Promise<KnowledgeSearchResult[]> {
  if (results.length < 2) return results

  // 转换为 TournamentDocument 格式
  const documents: TournamentDocument[] = results.map((r, idx) => ({
    id: `doc_${idx}`,
    content: r.pageContent,
    originalScore: r.score,
    metadata: r.metadata
  }))

  const service = getSwissTournamentRerankService()
  if (options?.rounds) {
    service.updateConfig({ rounds: options.rounds })
  }

  const result = await service.rerank(query, documents)

  // 映射回原始格式并保持新分数
  return result.rankings.map((ranking) => {
    const original = results.find((r) => r.pageContent === result.documents.find((d) => d.id === ranking.id)?.content)!
    return {
      ...original,
      score: ranking.finalScore
    }
  })
}
