/**
 * RRF (Reciprocal Rank Fusion) 工具集
 *
 * 统一的 RRF 融合算法实现，用于合并多源检索结果
 *
 * RRF 公式: score(d) = Σ (weight_i / (k + rank_i(d) + 1))
 * 其中 k 是平滑常数 (通常为 60)，rank_i(d) 是文档 d 在第 i 个排名列表中的位置 (从 0 开始)
 *
 * 特性:
 * - 加权融合支持
 * - 去重处理
 * - 分数归一化
 * - 混合检索支持 (向量+关键词)
 * - 类型安全
 *
 * @example
 * // 简单融合
 * const fused = rrfFuse([list1, list2], { k: 60 })
 *
 * // 加权融合
 * const weighted = weightedRRFFuse([
 *   { name: 'vector', results: vectorResults, weight: 0.7 },
 *   { name: 'keyword', results: keywordResults, weight: 0.3 }
 * ])
 *
 * // 混合检索
 * const hybrid = hybridFuse(vectorResults, keywordResults, { vectorWeight: 0.7 })
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('RRFUtils')

// ==================== 类型定义 ====================

/**
 * 通用检索结果接口
 */
export interface SearchResult {
  pageContent: string
  score: number
  metadata?: Record<string, unknown>
}

/**
 * RRF 配置
 */
export interface RRFConfig {
  /** RRF 平滑参数 k (默认 60) */
  k?: number
  /** 是否归一化最终分数 (默认 true) */
  normalize?: boolean
  /** 最小分数阈值，低于此阈值的结果将被过滤 */
  minScore?: number
  /** 最大结果数量 */
  maxResults?: number
  /** 是否去重 (默认 true) */
  deduplicate?: boolean
  /** 去重字段 ('content' | 'id') (默认 'content') */
  deduplicateBy?: 'content' | 'id'
}

/**
 * 加权输入源
 */
export interface WeightedSource<T extends SearchResult = SearchResult> {
  name: string
  results: T[]
  weight?: number
}

/**
 * 融合结果 (带元数据)
 */
export interface RRFFusedResult<T extends SearchResult = SearchResult> {
  result: T
  rrfScore: number
  sourceRanks: Record<string, number>
  contributingSources: string[]
}

// ==================== 核心算法 ====================

/**
 * 计算单个结果的 RRF 分数贡献
 *
 * @param rank 排名 (从 0 开始)
 * @param k RRF 参数 k (默认 60)
 * @param weight 源权重 (默认 1.0)
 * @returns RRF 分数贡献
 */
export function calculateRRFScore(rank: number, k: number = 60, weight: number = 1.0): number {
  return weight / (k + rank + 1)
}

/**
 * 获取结果的唯一标识符
 */
function getResultId<T extends SearchResult>(result: T, deduplicateBy: 'content' | 'id' = 'content'): string {
  if (deduplicateBy === 'id') {
    // 尝试从元数据获取 ID
    const meta = result.metadata
    if (meta?.id) return String(meta.id)
    if (meta?.chunkId) return String(meta.chunkId)
    if (meta?.uniqueId) return String(meta.uniqueId)
    if (meta?.documentId) return String(meta.documentId)
  }

  // 使用内容哈希
  return hashContent(result.pageContent)
}

/**
 * 简单内容哈希 (DJB2 变体)
 */
function hashContent(content: string): string {
  const normalized = content.slice(0, 300).toLowerCase().replace(/\s+/g, ' ')
  let hash = 5381
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) + hash + normalized.charCodeAt(i)
    hash = hash & hash // 转换为 32 位整数
  }
  return `h${hash.toString(16)}`
}

/**
 * 内容指纹 (用于更严格的去重)
 */
function getContentFingerprint(content: string): string {
  const words = content
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 20)
    .sort()

  return words.join('|')
}

// ==================== 融合函数 ====================

/**
 * 基础 RRF 融合
 *
 * 将多个结果列表融合为单一排名列表
 *
 * @param resultLists 多个结果列表
 * @param config RRF 配置
 * @returns 融合后的结果列表
 */
export function rrfFuse<T extends SearchResult>(resultLists: T[][], config: RRFConfig = {}): T[] {
  const sources = resultLists.map((results, index) => ({
    name: `source_${index}`,
    results,
    weight: 1.0
  }))

  return weightedRRFFuse(sources, config)
}

/**
 * 加权 RRF 融合
 *
 * 支持对不同数据源设置不同权重
 *
 * @param sources 带权重的数据源列表
 * @param config RRF 配置
 * @returns 融合后的结果列表
 */
export function weightedRRFFuse<T extends SearchResult>(
  sources: WeightedSource<T>[],
  config: RRFConfig = {}
): T[] {
  const { k = 60, normalize = true, minScore = 0, maxResults, deduplicate = true, deduplicateBy = 'content' } = config

  if (sources.length === 0) {
    return []
  }

  // 单一数据源优化
  if (sources.length === 1) {
    let results = sources[0].results
    if (maxResults && results.length > maxResults) {
      results = results.slice(0, maxResults)
    }
    return results
  }

  // 构建文档分数映射
  const documentScores = new Map<
    string,
    {
      result: T
      rrfScore: number
      sourceRanks: Record<string, number>
      sources: string[]
    }
  >()

  // 遍历所有源计算 RRF 分数
  for (const { name, results, weight = 1.0 } of sources) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank]
      const docId = getResultId(result, deduplicateBy)
      const rrfContribution = calculateRRFScore(rank, k, weight)

      const existing = documentScores.get(docId)
      if (existing) {
        existing.rrfScore += rrfContribution
        existing.sourceRanks[name] = rank
        existing.sources.push(name)
        // 保留分数更高的原始结果
        if (result.score > existing.result.score) {
          existing.result = result
        }
      } else {
        documentScores.set(docId, {
          result,
          rrfScore: rrfContribution,
          sourceRanks: { [name]: rank },
          sources: [name]
        })
      }
    }
  }

  // 转换并排序
  let fusedResults = Array.from(documentScores.values())
  fusedResults.sort((a, b) => b.rrfScore - a.rrfScore)

  // 归一化分数
  if (normalize && fusedResults.length > 0) {
    const maxScore = fusedResults[0].rrfScore
    if (maxScore > 0) {
      for (const item of fusedResults) {
        item.rrfScore = item.rrfScore / maxScore
      }
    }
  }

  // 过滤低分结果
  if (minScore > 0) {
    fusedResults = fusedResults.filter((r) => r.rrfScore >= minScore)
  }

  // 去重
  if (deduplicate) {
    const seen = new Set<string>()
    fusedResults = fusedResults.filter((r) => {
      const fingerprint = getContentFingerprint(r.result.pageContent)
      if (seen.has(fingerprint)) {
        return false
      }
      seen.add(fingerprint)
      return true
    })
  }

  // 限制结果数量
  if (maxResults && fusedResults.length > maxResults) {
    fusedResults = fusedResults.slice(0, maxResults)
  }

  logger.debug('RRF fusion completed', {
    sourcesCount: sources.length,
    inputCount: sources.reduce((sum, s) => sum + s.results.length, 0),
    outputCount: fusedResults.length
  })

  // 返回带融合分数的结果
  return fusedResults.map((f) => ({
    ...f.result,
    score: f.rrfScore,
    metadata: {
      ...f.result.metadata,
      _rrfSources: f.sources,
      _rrfSourceRanks: f.sourceRanks
    }
  }))
}

/**
 * 混合检索融合
 *
 * 专门用于融合向量检索和关键词检索结果
 *
 * @param vectorResults 向量检索结果
 * @param keywordResults 关键词检索结果
 * @param options 融合选项
 * @returns 融合后的结果列表
 */
export function hybridFuse<T extends SearchResult>(
  vectorResults: T[],
  keywordResults: T[],
  options: {
    vectorWeight?: number
    keywordWeight?: number
    k?: number
    maxResults?: number
  } = {}
): T[] {
  const { vectorWeight = 0.7, keywordWeight = 0.3, k = 60, maxResults } = options

  return weightedRRFFuse(
    [
      { name: 'vector', results: vectorResults, weight: vectorWeight },
      { name: 'keyword', results: keywordResults, weight: keywordWeight }
    ],
    { k, normalize: true, maxResults }
  )
}

/**
 * 语义+稀疏融合 (Dify 风格)
 *
 * 使用加权平均而非 RRF，适合语义和稀疏检索的组合
 *
 * @param semanticResults 语义检索结果
 * @param sparseResults 稀疏检索结果
 * @param semanticWeight 语义权重 (默认 0.7)
 * @returns 融合后的结果列表
 */
export function semanticSparseFuse<T extends SearchResult>(
  semanticResults: T[],
  sparseResults: T[],
  semanticWeight: number = 0.7
): T[] {
  const sparseWeight = 1 - semanticWeight
  const combined = new Map<string, T & { combinedScore: number }>()

  // 处理语义结果
  for (const result of semanticResults) {
    const docId = getResultId(result, 'content')
    combined.set(docId, {
      ...result,
      combinedScore: result.score * semanticWeight
    })
  }

  // 处理稀疏结果
  for (const result of sparseResults) {
    const docId = getResultId(result, 'content')
    const existing = combined.get(docId)
    if (existing) {
      existing.combinedScore += result.score * sparseWeight
    } else {
      combined.set(docId, {
        ...result,
        combinedScore: result.score * sparseWeight
      })
    }
  }

  // 转换并排序
  return Array.from(combined.values())
    .map((r) => ({ ...r, score: r.combinedScore }))
    .sort((a, b) => b.score - a.score)
}

/**
 * 带详细元数据的 RRF 融合
 *
 * 返回包含源排名信息的融合结果
 *
 * @param sources 带权重的数据源列表
 * @param config RRF 配置
 * @returns 带元数据的融合结果列表
 */
export function rrfFuseWithMetadata<T extends SearchResult>(
  sources: WeightedSource<T>[],
  config: RRFConfig = {}
): RRFFusedResult<T>[] {
  const { k = 60, normalize = true, minScore = 0, maxResults, deduplicateBy = 'content' } = config

  const documentScores = new Map<string, RRFFusedResult<T>>()

  for (const { name, results, weight = 1.0 } of sources) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank]
      const docId = getResultId(result, deduplicateBy)
      const rrfContribution = calculateRRFScore(rank, k, weight)

      const existing = documentScores.get(docId)
      if (existing) {
        existing.rrfScore += rrfContribution
        existing.sourceRanks[name] = rank
        existing.contributingSources.push(name)
      } else {
        documentScores.set(docId, {
          result,
          rrfScore: rrfContribution,
          sourceRanks: { [name]: rank },
          contributingSources: [name]
        })
      }
    }
  }

  let results = Array.from(documentScores.values())
  results.sort((a, b) => b.rrfScore - a.rrfScore)

  if (normalize && results.length > 0) {
    const maxScore = results[0].rrfScore
    if (maxScore > 0) {
      for (const item of results) {
        item.rrfScore = item.rrfScore / maxScore
      }
    }
  }

  if (minScore > 0) {
    results = results.filter((r) => r.rrfScore >= minScore)
  }

  if (maxResults && results.length > maxResults) {
    results = results.slice(0, maxResults)
  }

  return results
}

// ==================== 工具函数 ====================

/**
 * 计算两个排名列表的 Kendall Tau 相关性
 *
 * 用于评估不同检索方法结果的一致性
 *
 * @param list1 第一个排名列表
 * @param list2 第二个排名列表
 * @returns 相关系数 (-1 到 1)
 */
export function calculateRankCorrelation<T extends SearchResult>(list1: T[], list2: T[]): number {
  const ids1 = list1.map((r) => getResultId(r, 'content'))
  const ids2 = list2.map((r) => getResultId(r, 'content'))

  const common = ids1.filter((id) => ids2.includes(id))

  if (common.length < 2) {
    return 0
  }

  let concordant = 0
  let discordant = 0

  for (let i = 0; i < common.length; i++) {
    for (let j = i + 1; j < common.length; j++) {
      const rank1i = ids1.indexOf(common[i])
      const rank1j = ids1.indexOf(common[j])
      const rank2i = ids2.indexOf(common[i])
      const rank2j = ids2.indexOf(common[j])

      if ((rank1i < rank1j && rank2i < rank2j) || (rank1i > rank1j && rank2i > rank2j)) {
        concordant++
      } else {
        discordant++
      }
    }
  }

  const n = common.length
  const total = (n * (n - 1)) / 2

  return total > 0 ? (concordant - discordant) / total : 0
}

/**
 * 按源分组结果
 *
 * @param results 融合后的结果 (需要有 _rrfSources 元数据)
 * @returns 按源分组的结果
 */
export function groupResultsBySource<T extends SearchResult>(results: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}

  for (const result of results) {
    const sources = (result.metadata?._rrfSources as string[] | undefined) || ['unknown']
    for (const source of sources) {
      if (!grouped[source]) {
        grouped[source] = []
      }
      grouped[source].push(result)
    }
  }

  return grouped
}
