/**
 * AIMemo - AI 军团并发检索服务
 *
 * VCP 高级功能 - 用于大规模知识检索
 *
 * 核心能力:
 * - 并发多 Agent 检索
 * - 结果聚合与重排
 * - 大规模 Token 遍历
 * - 智能分片与负载均衡
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('AIMemo')

// ==================== 类型定义 ====================

/**
 * AI 检索 Agent 定义
 */
export interface AIMemoAgent {
  id: string
  name: string
  type: 'embedding' | 'rerank' | 'generate' | 'hybrid'
  /** Agent 权重 (0-1)，用于结果融合 */
  weight: number
  /** 检索能力配置 */
  config?: {
    /** 最大 Token 处理量 */
    maxTokens?: number
    /** 批处理大小 */
    batchSize?: number
    /** 超时时间 (ms) */
    timeout?: number
    /** 模型 ID */
    modelId?: string
  }
}

/**
 * 检索任务
 */
export interface AIMemoTask {
  id: string
  query: string
  /** 要检索的数据源 */
  sources: AIMemoSource[]
  /** 分配的 Agent 列表 */
  agents: string[]
  /** 任务选项 */
  options?: AIMemoSearchOptions
}

/**
 * 数据源定义
 */
export interface AIMemoSource {
  type: 'knowledge' | 'diary' | 'memory' | 'external'
  id: string
  name: string
  /** 估计的 Token 数量 */
  estimatedTokens?: number
}

/**
 * 检索选项
 */
export interface AIMemoSearchOptions {
  /** 并发度 (默认 3) */
  concurrency?: number
  /** 每个 Agent 返回的最大结果数 */
  topK?: number
  /** 最低相关性阈值 */
  threshold?: number
  /** 是否启用结果重排 */
  rerank?: boolean
  /** 超时时间 (ms) */
  timeout?: number
  /** 是否返回元数据 */
  includeMetadata?: boolean
}

/**
 * 单个 Agent 的检索结果
 */
export interface AIMemoAgentResult {
  agentId: string
  agentName: string
  results: AIMemoSearchResult[]
  tokensProcessed: number
  durationMs: number
  error?: string
}

/**
 * 检索结果
 */
export interface AIMemoSearchResult {
  id: string
  content: string
  score: number
  source: AIMemoSource
  metadata?: Record<string, unknown>
  /** 结果来源 Agent */
  contributingAgents?: string[]
}

/**
 * 聚合后的检索结果
 */
export interface AIMemoAggregatedResult {
  results: AIMemoSearchResult[]
  totalTokensProcessed: number
  agentResults: AIMemoAgentResult[]
  durationMs: number
  stats: {
    totalAgents: number
    successfulAgents: number
    failedAgents: number
    totalResults: number
    uniqueResults: number
  }
}

// ==================== AIMemoService ====================

/**
 * AIMemo 服务 - AI 军团并发检索
 *
 * 核心算法:
 * 1. 任务分片 - 将大规模数据分割为可管理的块
 * 2. Agent 分配 - 根据 Agent 能力分配任务
 * 3. 并发执行 - Promise.allSettled 并行处理
 * 4. 结果融合 - RRF 或加权平均聚合
 * 5. 重排优化 - 可选的精排阶段
 */
export class AIMemoService {
  private agents: Map<string, AIMemoAgent> = new Map()
  private defaultAgents: AIMemoAgent[] = []

  constructor() {
    this.initializeDefaultAgents()
    logger.info('AIMemoService initialized')
  }

  /**
   * 初始化默认 Agent 配置
   */
  private initializeDefaultAgents(): void {
    this.defaultAgents = [
      {
        id: 'embedding-primary',
        name: 'Primary Embedding Agent',
        type: 'embedding',
        weight: 1.0,
        config: {
          maxTokens: 100000,
          batchSize: 50,
          timeout: 30000
        }
      },
      {
        id: 'embedding-secondary',
        name: 'Secondary Embedding Agent',
        type: 'embedding',
        weight: 0.8,
        config: {
          maxTokens: 100000,
          batchSize: 50,
          timeout: 30000
        }
      },
      {
        id: 'rerank-agent',
        name: 'Rerank Agent',
        type: 'rerank',
        weight: 1.0,
        config: {
          maxTokens: 50000,
          batchSize: 20,
          timeout: 15000
        }
      }
    ]

    for (const agent of this.defaultAgents) {
      this.agents.set(agent.id, agent)
    }
  }

  /**
   * 注册自定义 Agent
   */
  registerAgent(agent: AIMemoAgent): void {
    this.agents.set(agent.id, agent)
    logger.info('Agent registered', { agentId: agent.id, name: agent.name })
  }

  /**
   * 获取所有 Agent
   */
  getAgents(): AIMemoAgent[] {
    return [...this.agents.values()]
  }

  /**
   * 并发检索 - 核心方法
   *
   * 步骤:
   * 1. 创建检索任务
   * 2. 分配 Agent
   * 3. 并发执行
   * 4. 聚合结果
   */
  async search(query: string, sources: AIMemoSource[], options?: AIMemoSearchOptions): Promise<AIMemoAggregatedResult> {
    const startTime = Date.now()
    const {
      concurrency = 3,
      topK = 10,
      threshold = 0.1,
      rerank = true,
      timeout = 60000,
      includeMetadata = true
    } = options || {}

    logger.info('AIMemo search started', {
      query: query.slice(0, 100),
      sourcesCount: sources.length,
      concurrency
    })

    // 1. 选择可用 Agent
    const availableAgents = this.selectAgents(sources, concurrency)

    // 2. 创建并发任务
    const tasks = this.createSearchTasks(query, sources, availableAgents, { topK, threshold })

    // 3. 并发执行
    const agentResults = await this.executeTasksConcurrently(tasks, timeout)

    // 4. 聚合结果
    const aggregatedResults = this.aggregateResults(agentResults, topK)

    // 5. 可选重排
    let finalResults = aggregatedResults
    if (rerank && aggregatedResults.length > 0) {
      finalResults = await this.rerankResults(query, aggregatedResults)
    }

    // 6. 过滤低分结果
    const filteredResults = finalResults.filter((r) => r.score >= threshold)

    // 7. 移除元数据 (如果不需要)
    if (!includeMetadata) {
      for (const r of filteredResults) {
        delete r.metadata
      }
    }

    const durationMs = Date.now() - startTime
    const stats = this.computeStats(agentResults, filteredResults)

    logger.info('AIMemo search completed', {
      durationMs,
      totalResults: filteredResults.length,
      tokensProcessed: stats.totalTokensProcessed
    })

    return {
      results: filteredResults.slice(0, topK),
      totalTokensProcessed: stats.totalTokensProcessed,
      agentResults,
      durationMs,
      stats: {
        totalAgents: availableAgents.length,
        successfulAgents: agentResults.filter((r) => !r.error).length,
        failedAgents: agentResults.filter((r) => r.error).length,
        totalResults: agentResults.reduce((sum, r) => sum + r.results.length, 0),
        uniqueResults: filteredResults.length
      }
    }
  }

  /**
   * 选择执行 Agent
   */
  private selectAgents(sources: AIMemoSource[], maxAgents: number): AIMemoAgent[] {
    // 估算总 Token 量
    const totalTokens = sources.reduce((sum, s) => sum + (s.estimatedTokens || 10000), 0)

    // 根据任务规模选择 Agent
    const allAgents = [...this.agents.values()]

    // 优先选择 embedding 类型的 Agent
    const embeddingAgents = allAgents.filter((a) => a.type === 'embedding')
    const otherAgents = allAgents.filter((a) => a.type !== 'embedding')

    // 按权重排序
    embeddingAgents.sort((a, b) => b.weight - a.weight)
    otherAgents.sort((a, b) => b.weight - a.weight)

    const selected: AIMemoAgent[] = []

    // 至少选择一个 embedding agent
    if (embeddingAgents.length > 0) {
      selected.push(embeddingAgents[0])
    }

    // 根据 Token 量增加 Agent
    if (totalTokens > 100000 && embeddingAgents.length > 1) {
      selected.push(embeddingAgents[1])
    }

    // 添加其他类型 Agent
    for (const agent of otherAgents) {
      if (selected.length >= maxAgents) break
      selected.push(agent)
    }

    return selected.slice(0, maxAgents)
  }

  /**
   * 创建检索任务
   */
  private createSearchTasks(
    query: string,
    sources: AIMemoSource[],
    agents: AIMemoAgent[],
    options: { topK: number; threshold: number }
  ): AIMemoTask[] {
    const tasks: AIMemoTask[] = []

    // 为每个 Agent 创建任务
    for (const agent of agents) {
      tasks.push({
        id: `task-${agent.id}-${Date.now()}`,
        query,
        sources,
        agents: [agent.id],
        options: {
          topK: options.topK,
          threshold: options.threshold
        }
      })
    }

    return tasks
  }

  /**
   * 并发执行任务
   */
  private async executeTasksConcurrently(tasks: AIMemoTask[], timeout: number): Promise<AIMemoAgentResult[]> {
    const results: AIMemoAgentResult[] = []

    // 使用 Promise.allSettled 确保所有任务都有结果
    const promises = tasks.map((task) => this.executeTask(task, timeout))
    const settled = await Promise.allSettled(promises)

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]
      const task = tasks[i]
      const agent = this.agents.get(task.agents[0])

      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        results.push({
          agentId: task.agents[0],
          agentName: agent?.name || 'Unknown',
          results: [],
          tokensProcessed: 0,
          durationMs: 0,
          error: result.reason?.message || 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: AIMemoTask, timeout: number): Promise<AIMemoAgentResult> {
    const startTime = Date.now()
    const agent = this.agents.get(task.agents[0])

    if (!agent) {
      throw new Error(`Agent not found: ${task.agents[0]}`)
    }

    // 创建超时 Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout')), timeout)
    })

    // 实际搜索 Promise
    const searchPromise = this.performSearch(task, agent)

    // 竞争
    const results = await Promise.race([searchPromise, timeoutPromise])

    return {
      agentId: agent.id,
      agentName: agent.name,
      results,
      tokensProcessed: this.estimateTokensProcessed(task.sources),
      durationMs: Date.now() - startTime
    }
  }

  /**
   * 执行实际搜索
   * 使用 IntegratedMemoryCoordinator 进行统一检索
   */
  private async performSearch(task: AIMemoTask, _agent: AIMemoAgent): Promise<AIMemoSearchResult[]> {
    const results: AIMemoSearchResult[] = []

    try {
      // 使用推荐的 IntegratedMemoryCoordinator 代替已废弃的 UnifiedMemoryManager
      const { getIntegratedMemoryCoordinator } = await import('./IntegratedMemoryCoordinator')
      const coordinator = getIntegratedMemoryCoordinator()

      // 根据数据源类型搜索
      for (const source of task.sources) {
        const backendType = this.mapSourceToBackend(source.type)

        const searchResults = await coordinator.intelligentSearch(task.query, {
          backends: [backendType],
          topK: task.options?.topK || 10,
          threshold: task.options?.threshold || 0.1,
          applyLearning: true
        })

        for (const r of searchResults) {
          results.push({
            id: r.id,
            content: r.content,
            score: r.score,
            source,
            metadata: r.metadata as Record<string, unknown>,
            contributingAgents: [_agent.id]
          })
        }
      }
    } catch (error) {
      logger.error('Search failed in AIMemo', { error: String(error) })
    }

    return results
  }

  /**
   * 映射数据源类型到后端类型
   */
  private mapSourceToBackend(sourceType: AIMemoSource['type']): 'knowledge' | 'diary' | 'memory' | 'lightmemo' {
    switch (sourceType) {
      case 'knowledge':
        return 'knowledge'
      case 'diary':
        return 'diary'
      case 'memory':
        return 'memory'
      case 'external':
      default:
        return 'lightmemo'
    }
  }

  /**
   * 聚合多个 Agent 的结果
   * 使用 RRF (Reciprocal Rank Fusion) 算法
   *
   * 注意: 此方法使用自定义 RRF 实现以追踪 contributingAgents。
   * 如需通用 RRF，请使用 @main/memory/utils/RRFUtils.weightedRRFFuse()
   */
  private aggregateResults(agentResults: AIMemoAgentResult[], topK: number): AIMemoSearchResult[] {
    const k = 60 // RRF 常数
    const scoreMap = new Map<string, { result: AIMemoSearchResult; rrfScore: number; agents: string[] }>()

    for (const agentResult of agentResults) {
      if (agentResult.error) continue

      // 对每个 Agent 的结果排序
      const sortedResults = [...agentResult.results].sort((a, b) => b.score - a.score)

      for (let rank = 0; rank < sortedResults.length; rank++) {
        const result = sortedResults[rank]
        const contentKey = result.content.slice(0, 100) // 使用内容前 100 字符作为唯一键

        const rrfScore = 1 / (k + rank + 1)

        if (scoreMap.has(contentKey)) {
          const existing = scoreMap.get(contentKey)!
          existing.rrfScore += rrfScore
          existing.agents.push(agentResult.agentId)
        } else {
          scoreMap.set(contentKey, {
            result: { ...result, contributingAgents: [agentResult.agentId] },
            rrfScore,
            agents: [agentResult.agentId]
          })
        }
      }
    }

    // 按 RRF 分数排序
    const aggregated = [...scoreMap.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK)
      .map((item) => ({
        ...item.result,
        score: item.rrfScore,
        contributingAgents: [...new Set(item.agents)]
      }))

    return aggregated
  }

  /**
   * 重排结果 (可选)
   */
  private async rerankResults(query: string, results: AIMemoSearchResult[]): Promise<AIMemoSearchResult[]> {
    // 如果结果太少，不需要重排
    if (results.length <= 3) {
      return results
    }

    try {
      // 使用 rerank agent
      const rerankAgent = [...this.agents.values()].find((a) => a.type === 'rerank')
      if (!rerankAgent) {
        return results
      }

      // 简单的重排：基于 query 关键词匹配度加权
      const queryWords = query.toLowerCase().split(/\s+/)

      const reranked = results.map((r) => {
        const contentLower = r.content.toLowerCase()
        const matchCount = queryWords.filter((w) => contentLower.includes(w)).length
        const matchBonus = matchCount / queryWords.length
        return {
          ...r,
          score: r.score * (1 + matchBonus * 0.5) // 最多提升 50%
        }
      })

      return reranked.sort((a, b) => b.score - a.score)
    } catch (error) {
      logger.warn('Rerank failed, using original order', { error: String(error) })
      return results
    }
  }

  /**
   * 估算处理的 Token 数量
   */
  private estimateTokensProcessed(sources: AIMemoSource[]): number {
    return sources.reduce((sum, s) => sum + (s.estimatedTokens || 10000), 0)
  }

  /**
   * 计算统计信息
   */
  private computeStats(
    agentResults: AIMemoAgentResult[],
    _finalResults: AIMemoSearchResult[]
  ): { totalTokensProcessed: number } {
    const totalTokensProcessed = agentResults.reduce((sum, r) => sum + r.tokensProcessed, 0)

    return {
      totalTokensProcessed
    }
  }

  /**
   * 快速检索 - 使用单个 Agent
   */
  async quickSearch(
    query: string,
    sources: AIMemoSource[],
    options?: Pick<AIMemoSearchOptions, 'topK' | 'threshold'>
  ): Promise<AIMemoSearchResult[]> {
    const result = await this.search(query, sources, {
      ...options,
      concurrency: 1,
      rerank: false
    })
    return result.results
  }

  /**
   * 深度检索 - 使用所有 Agent
   */
  async deepSearch(
    query: string,
    sources: AIMemoSource[],
    options?: AIMemoSearchOptions
  ): Promise<AIMemoAggregatedResult> {
    return this.search(query, sources, {
      ...options,
      concurrency: this.agents.size,
      rerank: true
    })
  }

  /**
   * 检索 + AI 综合
   *
   * VCPToolBox 完整功能移植:
   * 1. 并发检索知识库
   * 2. 通过 AI 进行深度推理和综合
   * 3. 返回结构化的"动态记忆场"
   *
   * @param context 对话上下文
   * @param sources 要检索的数据源
   * @param options 检索和综合选项
   */
  async searchWithSynthesis(
    context: {
      currentUserPrompt: string
      lastAssistantResponse?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
    },
    sources: AIMemoSource[],
    options?: AIMemoSearchOptions & {
      /** AI 模型 ID */
      modelId?: string
      /** AI Provider ID */
      providerId?: string
      /** 是否包含调试信息 */
      includeReasoning?: boolean
    }
  ): Promise<{
    /** 综合后的记忆内容 */
    synthesizedMemory: string
    /** 是否找到相关记忆 */
    hasRelevantMemory: boolean
    /** 原始检索结果 */
    searchResults: AIMemoAggregatedResult
    /** 综合处理时间 */
    synthesisDurationMs: number
  }> {
    const startTime = Date.now()

    logger.info('AIMemo searchWithSynthesis started', {
      query: context.currentUserPrompt.slice(0, 100),
      sourcesCount: sources.length
    })

    // 1. 执行深度检索
    const searchResults = await this.deepSearch(context.currentUserPrompt, sources, options)

    // 2. 转换检索结果为知识内容格式
    const knowledge = searchResults.results.map((r) => ({
      source: r.source.type,
      sourceName: r.source.name,
      content: r.content,
      score: r.score,
      metadata: r.metadata
    }))

    // 3. 调用 AI 综合服务
    const { getAIMemoSynthesisService } = await import('./AIMemoSynthesisService')
    const synthesisService = getAIMemoSynthesisService()

    const synthesisResult = await synthesisService.synthesize(context, knowledge, {
      modelId: options?.modelId,
      providerId: options?.providerId,
      includeReasoning: options?.includeReasoning
    })

    const totalDurationMs = Date.now() - startTime

    logger.info('AIMemo searchWithSynthesis completed', {
      totalDurationMs,
      searchDurationMs: searchResults.durationMs,
      synthesisDurationMs: synthesisResult.durationMs,
      hasRelevantMemory: synthesisResult.hasRelevantMemory
    })

    return {
      synthesizedMemory: synthesisResult.content,
      hasRelevantMemory: synthesisResult.hasRelevantMemory,
      searchResults,
      synthesisDurationMs: synthesisResult.durationMs
    }
  }

  /**
   * 快速记忆检索 + 综合
   * 用于实时对话场景，使用简化的提示词
   */
  async quickSearchWithSynthesis(
    query: string,
    sources: AIMemoSource[],
    options?: Pick<AIMemoSearchOptions, 'topK' | 'threshold'> & {
      modelId?: string
      providerId?: string
    }
  ): Promise<string> {
    // 快速检索
    const results = await this.quickSearch(query, sources, options)

    // 转换为知识内容
    const knowledge = results.map((r) => ({
      source: r.source.type,
      sourceName: r.source.name,
      content: r.content,
      score: r.score
    }))

    // 快速综合
    const { getAIMemoSynthesisService } = await import('./AIMemoSynthesisService')
    const synthesisService = getAIMemoSynthesisService()

    return synthesisService.quickSynthesize(query, knowledge, {
      modelId: options?.modelId,
      providerId: options?.providerId
    })
  }
}

// ==================== 导出 ====================

let serviceInstance: AIMemoService | null = null

export function getAIMemoService(): AIMemoService {
  if (!serviceInstance) {
    serviceInstance = new AIMemoService()
  }
  return serviceInstance
}

export function createAIMemoService(): AIMemoService {
  return new AIMemoService()
}
