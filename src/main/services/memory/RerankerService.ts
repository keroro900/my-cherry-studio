/**
 * RerankerService - LLM-based 重排序服务
 *
 * 使用大语言模型对搜索结果进行精确重排序
 * 支持 VCPToolBox ::Rerank 修饰符
 *
 * 功能:
 * - 基于 LLM 的语义相关性评分
 * - 批量重排序以提高效率
 * - 超时和降级机制
 * - 缓存支持
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { mcpBridge } from '@main/mcpServers/shared/MCPBridge'

const logger = loggerService.withContext('RerankerService')

/**
 * 重排序结果项
 */
export interface RerankResult {
  /** 文档索引 (原始顺序) */
  docIndex: number
  /** 重排序分数 (0-1) */
  score: number
  /** 原始分数 */
  originalScore: number
  /** LLM 给出的相关性解释 (可选) */
  explanation?: string
}

/**
 * 重排序配置
 */
export interface RerankConfig {
  /** 使用的模型 ID */
  modelId?: string
  /** 提供商 ID */
  providerId?: string
  /** 超时时间 (毫秒) */
  timeout?: number
  /** 最大重排序文档数 */
  maxDocuments?: number
  /** 是否返回解释 */
  includeExplanation?: boolean
  /** 批次大小 (每次 LLM 调用处理的文档数) */
  batchSize?: number
}

/**
 * LLM 重排序服务
 *
 * 使用 LLM 对搜索结果进行语义重排序
 * 相比传统的 cross-encoder，LLM 能够理解更复杂的语义关系
 */
export class RerankerService {
  private static instance: RerankerService | null = null

  /** 重排序结果缓存 */
  private cache: Map<string, { results: RerankResult[]; timestamp: number }> = new Map()
  private readonly cacheTTLMs = 5 * 60 * 1000 // 5 分钟

  private constructor() {
    logger.info('RerankerService initialized')
  }

  static getInstance(): RerankerService {
    if (!RerankerService.instance) {
      RerankerService.instance = new RerankerService()
    }
    return RerankerService.instance
  }

  /**
   * 对搜索结果进行 LLM 重排序
   *
   * @param query - 用户查询
   * @param documents - 待重排序的文档内容列表
   * @param config - 重排序配置
   * @returns 重排序结果 (按分数降序)
   */
  async rerank(
    query: string,
    documents: string[],
    config?: RerankConfig
  ): Promise<RerankResult[]> {
    const {
      modelId,
      providerId,
      timeout = 10000,
      maxDocuments = 20,
      includeExplanation = false,
      batchSize = 5
    } = config || {}

    const startTime = Date.now()

    // 限制文档数量
    const docsToRerank = documents.slice(0, maxDocuments)

    if (docsToRerank.length === 0) {
      return []
    }

    // 检查缓存
    const cacheKey = this.generateCacheKey(query, docsToRerank)
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      logger.debug('Rerank cache hit', { query: query.slice(0, 50) })
      return cached
    }

    try {
      // 分批处理以提高效率
      const batches: string[][] = []
      for (let i = 0; i < docsToRerank.length; i += batchSize) {
        batches.push(docsToRerank.slice(i, i + batchSize))
      }

      const allResults: RerankResult[] = []
      let globalIndex = 0

      for (const batch of batches) {
        // 检查超时
        if (Date.now() - startTime > timeout) {
          logger.warn('Rerank timeout, returning partial results')
          break
        }

        const batchResults = await this.rerankBatch(query, batch, globalIndex, {
          modelId,
          providerId,
          includeExplanation,
          timeout: timeout - (Date.now() - startTime)
        })

        allResults.push(...batchResults)
        globalIndex += batch.length
      }

      // 按分数降序排序
      allResults.sort((a, b) => b.score - a.score)

      // 缓存结果
      this.setCache(cacheKey, allResults)

      logger.info('Rerank completed', {
        query: query.slice(0, 50),
        documentCount: docsToRerank.length,
        durationMs: Date.now() - startTime
      })

      return allResults
    } catch (error) {
      logger.error('Rerank failed', error as Error)
      // 降级: 返回原始顺序
      return docsToRerank.map((_, index) => ({
        docIndex: index,
        score: 1 - index * 0.05, // 简单衰减
        originalScore: 1 - index * 0.05
      }))
    }
  }

  /**
   * 重排序单个批次
   */
  private async rerankBatch(
    query: string,
    documents: string[],
    startIndex: number,
    config: {
      modelId?: string
      providerId?: string
      includeExplanation?: boolean
      timeout?: number
    }
  ): Promise<RerankResult[]> {
    const { modelId, providerId, includeExplanation, timeout } = config

    // 构建重排序提示词
    const systemPrompt = `你是一个专业的文档相关性评估专家。
你的任务是评估每个文档与用户查询的相关程度。

评分标准 (0-10):
- 10: 完全相关，直接回答查询
- 7-9: 高度相关，包含查询的核心信息
- 4-6: 中等相关，部分匹配查询意图
- 1-3: 低相关，仅有少量相关内容
- 0: 完全不相关

请以 JSON 格式输出，每个文档一个评分对象。`

    const documentList = documents
      .map((doc, i) => `[文档${startIndex + i + 1}]: ${doc.slice(0, 500)}${doc.length > 500 ? '...' : ''}`)
      .join('\n\n')

    const userPrompt = `用户查询: "${query}"

待评估文档:
${documentList}

请为每个文档评分，输出 JSON 数组格式:
[{"docIndex": ${startIndex + 1}, "score": <0-10的分数>${includeExplanation ? ', "explanation": "<简短解释>"' : ''}}, ...]

只输出 JSON，不要其他内容。`

    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Rerank batch timeout')), timeout || 5000)
      })

      // 调用 LLM
      const responsePromise = mcpBridge.generateText({
        systemPrompt,
        userPrompt,
        providerId,
        modelId
      })

      const response = await Promise.race([responsePromise, timeoutPromise])

      if (!response) {
        throw new Error('Empty response from LLM')
      }

      // 解析 JSON 响应
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        docIndex: number
        score: number
        explanation?: string
      }>

      // 转换为 RerankResult 格式
      return parsed.map((item, i) => ({
        docIndex: (item.docIndex || startIndex + i + 1) - 1, // 转换为 0-indexed
        score: Math.min(1, Math.max(0, (item.score || 5) / 10)), // 归一化到 0-1
        originalScore: 1 - ((item.docIndex || startIndex + i + 1) - 1) * 0.05,
        explanation: item.explanation
      }))
    } catch (error) {
      logger.warn('Rerank batch failed, using fallback', error as Error)
      // 降级: 返回原始顺序的分数
      return documents.map((_, i) => ({
        docIndex: startIndex + i,
        score: 1 - (startIndex + i) * 0.05,
        originalScore: 1 - (startIndex + i) * 0.05
      }))
    }
  }

  /**
   * 使用重排序结果重新排列搜索结果
   *
   * @param results - 原始搜索结果
   * @param rerankResults - 重排序结果
   * @returns 重新排列后的搜索结果
   */
  applyRerankResults<T extends { score: number }>(
    results: T[],
    rerankResults: RerankResult[]
  ): T[] {
    // 创建索引映射
    const rerankMap = new Map(rerankResults.map(r => [r.docIndex, r]))

    // 重新计算分数并排序
    return results
      .map((result, index) => {
        const rerankInfo = rerankMap.get(index)
        if (rerankInfo) {
          return {
            ...result,
            score: rerankInfo.score,
            metadata: {
              ...(result as any).metadata,
              _rerankApplied: true,
              _rerankScore: rerankInfo.score,
              _originalRerankScore: result.score,
              _rerankExplanation: rerankInfo.explanation
            }
          }
        }
        return result
      })
      .sort((a, b) => b.score - a.score)
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(query: string, documents: string[]): string {
    const queryKey = query.toLowerCase().trim().slice(0, 100)
    const docsHash = documents.map(d => d.slice(0, 50)).join('|').slice(0, 200)
    return `${queryKey}::${docsHash}`
  }

  /**
   * 从缓存获取
   */
  private getFromCache(key: string): RerankResult[] | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > this.cacheTTLMs) {
      this.cache.delete(key)
      return null
    }

    return cached.results
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, results: RerankResult[]): void {
    // LRU 清理
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, { results, timestamp: Date.now() })
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
    logger.info('Rerank cache cleared')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: 100 }
  }
}

// 单例导出
let rerankerInstance: RerankerService | null = null

export function getRerankerService(): RerankerService {
  if (!rerankerInstance) {
    rerankerInstance = RerankerService.getInstance()
  }
  return rerankerInstance
}
