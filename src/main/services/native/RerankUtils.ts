/**
 * Rerank 工具函数
 *
 * 提供统一的精排算法，供 VCPSearchService 和 RAGDiaryService 使用。
 * 支持两种模式:
 * - 本地重排: 基于关键词密度、首段匹配、精确短语匹配
 * - 神经重排: 使用 API 调用神经网络模型 (Cohere, Jina, VoyageAI 等)
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('RerankUtils')

// ==================== 类型定义 ====================

export interface RerankItem<T = unknown> {
  item: T
  score: number
  content: string
}

export interface RerankOptions {
  /** 关键词密度最大加分比例 (默认 0.2) */
  maxKeywordDensityBoost?: number
  /** 首段匹配每词加分 (默认 0.05) */
  firstParagraphBoostPerWord?: number
  /** 精确匹配加分倍数 (默认 1.3) */
  exactMatchMultiplier?: number
  /** 首段检查长度 (默认 200) */
  firstParagraphLength?: number
  /** 最小查询长度 (用于精确匹配) (默认 5) */
  minQueryLengthForExact?: number
}

// ==================== Rerank 函数 ====================

/**
 * 通用 Rerank 精排函数
 *
 * 算法：
 * 1. 关键词密度加分 - 匹配次数 / 内容长度
 * 2. 首段匹配加分 - 前 N 字符中的匹配词数
 * 3. 精确短语匹配加分 - 完整查询出现在内容中
 *
 * @param query 查询字符串
 * @param items 待排序项目
 * @param options 选项
 * @returns 排序后的项目
 */
export function rerank<T>(
  query: string,
  items: RerankItem<T>[],
  options: RerankOptions = {}
): RerankItem<T>[] {
  const {
    maxKeywordDensityBoost = 0.2,
    firstParagraphBoostPerWord = 0.05,
    exactMatchMultiplier = 1.3,
    firstParagraphLength = 200,
    minQueryLengthForExact = 5
  } = options

  if (items.length <= 3) {
    // 少量结果不需要重排
    return items
  }

  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter((w) => w.length > 1)

  const reranked = items.map((item) => {
    const content = item.content.toLowerCase()
    let rerankScore = item.score

    // 1. 关键词密度加分
    let matchCount = 0
    for (const term of queryTerms) {
      const regex = new RegExp(escapeRegExp(term), 'gi')
      const matches = content.match(regex)
      matchCount += matches ? matches.length : 0
    }
    const keywordDensity = matchCount / (content.length / 100 + 1)
    rerankScore *= 1 + Math.min(keywordDensity * 0.1, maxKeywordDensityBoost)

    // 2. 首段匹配加分
    const firstParagraph = content.slice(0, firstParagraphLength)
    const firstParaMatches = queryTerms.filter((t) => firstParagraph.includes(t)).length
    rerankScore *= 1 + firstParaMatches * firstParagraphBoostPerWord

    // 3. 精确短语匹配加分
    if (query.length >= minQueryLengthForExact && content.includes(queryLower)) {
      rerankScore *= exactMatchMultiplier
    }

    return { ...item, score: rerankScore }
  })

  reranked.sort((a, b) => b.score - a.score)

  logger.debug('Rerank completed', {
    itemCount: items.length,
    queryTerms: queryTerms.length
  })

  return reranked
}

/**
 * 简化版 Rerank (直接操作分数数组)
 */
export function rerankScores(
  query: string,
  contents: string[],
  scores: number[],
  options: RerankOptions = {}
): number[] {
  const items: RerankItem<number>[] = contents.map((content, i) => ({
    item: i,
    content,
    score: scores[i]
  }))

  const reranked = rerank(query, items, options)
  const result = new Array(scores.length).fill(0)

  for (const item of reranked) {
    result[item.item] = item.score
  }

  return result
}

// ==================== 辅助函数 ====================

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 提取最佳段落
 */
export function extractBestParagraph(content: string, query: string, maxLength = 500): string {
  const paragraphs = content.split(/\n\n+/)
  const queryTerms = query.toLowerCase().split(/\s+/)

  let bestParagraph = paragraphs[0] || content.slice(0, 300)
  let bestScore = 0

  for (const para of paragraphs) {
    const paraLower = para.toLowerCase()
    let paraScore = 0
    for (const term of queryTerms) {
      if (paraLower.includes(term)) paraScore++
    }
    if (paraScore > bestScore) {
      bestScore = paraScore
      bestParagraph = para
    }
  }

  return bestParagraph.length > maxLength
    ? bestParagraph.slice(0, maxLength) + '...'
    : bestParagraph
}

// ==================== 统一重排接口 ====================

export type RerankMode = 'local' | 'neural' | 'auto'

export interface UnifiedRerankOptions extends RerankOptions {
  /** 重排模式: local (本地关键词), neural (神经网络), auto (自动选择) */
  mode?: RerankMode
  /** 强制使用神经重排 (即使不可用也抛出错误) */
  forceNeural?: boolean
  /** 神经重排最小结果数量阈值 (低于此值使用本地重排) */
  neuralMinItems?: number
}

export interface UnifiedRerankResult<T> {
  /** 重排后的结果 */
  results: RerankItem<T>[]
  /** 实际使用的模式 */
  usedMode: RerankMode
  /** 是否使用了神经重排 */
  usedNeural: boolean
  /** 处理耗时 (ms) */
  durationMs: number
  /** 错误信息 (如有回退) */
  error?: string
}

/**
 * 统一重排入口
 *
 * 根据配置和条件自动选择最佳重排策略:
 * - auto: 如果神经重排可用且结果数量足够，使用神经重排，否则本地
 * - neural: 强制使用神经重排
 * - local: 强制使用本地重排
 *
 * @param query 查询字符串
 * @param items 待排序项目
 * @param options 选项
 * @returns 统一重排结果
 */
export async function unifiedRerank<T>(
  query: string,
  items: RerankItem<T>[],
  options: UnifiedRerankOptions = {}
): Promise<UnifiedRerankResult<T>> {
  const startTime = Date.now()
  const { mode = 'auto', forceNeural = false, neuralMinItems = 5, ...rerankOptions } = options

  // 本地重排处理
  const doLocalRerank = (): UnifiedRerankResult<T> => {
    const results = rerank(query, items, rerankOptions)
    return {
      results,
      usedMode: 'local',
      usedNeural: false,
      durationMs: Date.now() - startTime
    }
  }

  // 强制本地模式
  if (mode === 'local') {
    return doLocalRerank()
  }

  // 尝试神经重排
  if (mode === 'neural' || mode === 'auto') {
    try {
      // 动态导入避免循环依赖
      const { getNeuralRerankService } = await import('./NeuralRerankService')
      const neuralService = getNeuralRerankService()

      // 检查是否可用
      const isAvailable = neuralService.isAvailable()

      // auto 模式下的条件检查
      if (mode === 'auto') {
        if (!isAvailable) {
          logger.debug('Neural rerank not available, using local')
          return doLocalRerank()
        }
        if (items.length < neuralMinItems) {
          logger.debug('Too few items for neural rerank, using local', {
            itemCount: items.length,
            threshold: neuralMinItems
          })
          return doLocalRerank()
        }
      }

      // 强制模式但不可用
      if (mode === 'neural' && !isAvailable) {
        if (forceNeural) {
          throw new Error('Neural rerank is not available but forceNeural is true')
        }
        logger.warn('Neural rerank requested but not available, falling back to local')
        return doLocalRerank()
      }

      // 执行神经重排
      const neuralResult = await neuralService.rerank(query, items, { forceNeural })

      return {
        results: neuralResult.results,
        usedMode: 'neural',
        usedNeural: neuralResult.usedNeural,
        durationMs: neuralResult.durationMs,
        error: neuralResult.error
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.warn('Neural rerank failed', { error: errorMessage })

      // 如果强制神经模式且 forceNeural=true，则抛出错误
      if (mode === 'neural' && forceNeural) {
        throw error
      }

      // 回退到本地重排
      const localResult = doLocalRerank()
      return {
        ...localResult,
        error: `Neural failed: ${errorMessage}, fell back to local`
      }
    }
  }

  // 默认本地重排
  return doLocalRerank()
}

