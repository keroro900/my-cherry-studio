/**
 * DeepMemo 深度回忆检索器
 *
 * 提供跨会话历史记忆的深度检索能力：
 * - 两阶段搜索（广度初筛 + 精排重排）
 * - 时间线检索
 * - 关联发现
 * - 主题聚类
 *
 * @module memory/retrieval/DeepMemoRetriever
 */

import { loggerService } from '@logger'
import crypto from 'crypto'

import type {
  DeepSearchOptions,
  MemoryEntry,
  MemoryRelation,
  RetrievalResult,
  ScoredMemoryEntry,
  TimeRange,
  TopicCluster
} from '../types'

const logger = loggerService.withContext('DeepMemoRetriever')

// ==================== 类型定义 ====================

/**
 * 搜索阶段
 */
type SearchPhase = 'lens' | 'expansion' | 'focus' | 'rerank'

/**
 * 阶段结果
 */
interface PhaseResult {
  phase: SearchPhase
  entries: ScoredMemoryEntry[]
  metadata: Record<string, unknown>
  timeElapsed: number
}

/**
 * 关联发现结果
 */
interface RelationDiscoveryResult {
  relations: MemoryRelation[]
  relatedEntries: ScoredMemoryEntry[]
}

/**
 * 时间线结果
 */
interface TimelineResult {
  entries: ScoredMemoryEntry[]
  groupedByDate: Map<string, ScoredMemoryEntry[]>
  span: {
    start: Date
    end: Date
    durationDays: number
  }
}

/**
 * 存储访问器接口
 */
interface StoreAccessor {
  search(query: string, options: DeepSearchOptions): Promise<ScoredMemoryEntry[]>
  getById(id: string): Promise<MemoryEntry | null>
  getByIds(ids: string[]): Promise<MemoryEntry[]>
  getRelations(entryId: string): Promise<MemoryRelation[]>
  searchByTimeRange(range: TimeRange): Promise<MemoryEntry[]>
}

// ==================== DeepMemo 检索器 ====================

/**
 * DeepMemo 深度回忆检索器
 */
export class DeepMemoRetriever {
  private store: StoreAccessor

  constructor(store: StoreAccessor) {
    this.store = store
  }

  // ==================== 主搜索方法 ====================

  /**
   * 深度搜索 - 两阶段检索
   *
   * 第一阶段：广度搜索获取候选集
   * 第二阶段：精排重排获取最终结果
   */
  async search(query: string, options: Partial<DeepSearchOptions> = {}): Promise<RetrievalResult> {
    const startTime = Date.now()
    const phases: PhaseResult[] = []

    try {
      // 阶段 1: 广度搜索
      const lensResult = await this.lensPhase(query, options)
      phases.push(lensResult)

      if (lensResult.entries.length === 0) {
        return this.buildEmptyResult(startTime, phases)
      }

      // 阶段 2: 扩展
      const expansionResult = await this.expansionPhase(lensResult.entries, query, options)
      phases.push(expansionResult)

      // 阶段 3: 聚焦精排
      const focusResult = await this.focusPhase(expansionResult.entries, query, options)
      phases.push(focusResult)

      // 阶段 4: 重排序
      const rerankResult = await this.rerankPhase(focusResult.entries, query, options)
      phases.push(rerankResult)

      // 可选：聚类
      let finalEntries = rerankResult.entries
      let clusters: TopicCluster[] | undefined

      if (options.enableClustering) {
        clusters = await this.clusterByTopic(finalEntries, options.clusterCount || 5)
        // 从每个聚类中取代表性结果
        finalEntries = this.selectFromClusters(clusters, options.topK || 10)
      }

      return {
        entries: finalEntries.slice(0, options.topK || 10),
        metadata: {
          totalFound: finalEntries.length,
          timeElapsed: Date.now() - startTime,
          strategy: 'deepmemo',
          expansions: (expansionResult.metadata.expandedTerms as string[]) || []
        }
      }
    } catch (error) {
      logger.error('DeepMemo search failed', { query, error })
      return this.buildEmptyResult(startTime, phases)
    }
  }

  // ==================== 搜索阶段 ====================

  /**
   * Lens 阶段 - 广度初筛
   */
  private async lensPhase(query: string, options: Partial<DeepSearchOptions>): Promise<PhaseResult> {
    const startTime = Date.now()
    const firstStageK = options.firstStageK || 50

    // 提取查询关键词
    const keywords = this.extractKeywords(query)

    // 执行广度搜索
    const entries = await this.store.search(query, {
      ...options,
      query, // 添加 query 满足 DeepSearchOptions 类型要求
      topK: firstStageK,
      threshold: 0.3 // 较低阈值获取更多候选
    } as DeepSearchOptions)

    return {
      phase: 'lens',
      entries,
      metadata: {
        keywords,
        candidateCount: entries.length
      },
      timeElapsed: Date.now() - startTime
    }
  }

  /**
   * Expansion 阶段 - 语义扩展
   */
  private async expansionPhase(
    candidates: ScoredMemoryEntry[],
    query: string,
    options: Partial<DeepSearchOptions>
  ): Promise<PhaseResult> {
    const startTime = Date.now()

    // 从候选中提取高频标签
    const tagFrequency = new Map<string, number>()
    for (const entry of candidates) {
      for (const tag of entry.metadata.tags || []) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1)
      }
    }

    // 选择高频标签作为扩展词
    const expandedTerms = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag)

    // 使用扩展词重新搜索
    if (expandedTerms.length > 0) {
      const expandedQuery = `${query} ${expandedTerms.join(' ')}`
      const expandedResults = await this.store.search(expandedQuery, {
        ...options,
        query: expandedQuery,
        topK: options.firstStageK || 50
      })

      // 合并去重
      const mergedEntries = this.mergeAndDeduplicate(candidates, expandedResults)

      return {
        phase: 'expansion',
        entries: mergedEntries,
        metadata: {
          expandedTerms,
          expandedCount: expandedResults.length
        },
        timeElapsed: Date.now() - startTime
      }
    }

    return {
      phase: 'expansion',
      entries: candidates,
      metadata: { expandedTerms: [] },
      timeElapsed: Date.now() - startTime
    }
  }

  /**
   * Focus 阶段 - 聚焦精排
   */
  private async focusPhase(
    entries: ScoredMemoryEntry[],
    query: string,
    _options: Partial<DeepSearchOptions>
  ): Promise<PhaseResult> {
    const startTime = Date.now()

    // 计算与查询的更精确相关性
    const scoredEntries = entries.map((entry) => ({
      ...entry,
      score: this.computeRelevanceScore(entry, query)
    }))

    // 按分数排序
    scoredEntries.sort((a, b) => b.score - a.score)

    return {
      phase: 'focus',
      entries: scoredEntries,
      metadata: {
        recomputedScores: true
      },
      timeElapsed: Date.now() - startTime
    }
  }

  /**
   * Rerank 阶段 - 最终重排序
   */
  private async rerankPhase(
    entries: ScoredMemoryEntry[],
    query: string,
    _options: Partial<DeepSearchOptions>
  ): Promise<PhaseResult> {
    const startTime = Date.now()

    // 应用多因素重排序
    const reranked = entries.map((entry) => {
      let score = entry.score

      // 时间衰减
      const ageInDays = (Date.now() - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      const timeDecay = Math.exp(-ageInDays / 90) // 90天半衰期
      score *= 0.7 + 0.3 * timeDecay

      // 重要性加权
      const importance = entry.metadata.importance || 5
      score *= 0.8 + (importance / 10) * 0.4

      // 访问频率
      const accessBoost = Math.log(Math.max(entry.accessCount, 1) + 1) / 10
      score *= 1 + accessBoost

      // 置信度
      const confidence = entry.metadata.confidence || 0.5
      score *= 0.7 + confidence * 0.3

      return {
        ...entry,
        score,
        matchReason: this.generateMatchReason(entry, query)
      }
    })

    // 最终排序
    reranked.sort((a, b) => b.score - a.score)

    return {
      phase: 'rerank',
      entries: reranked,
      metadata: {
        factors: ['timeDecay', 'importance', 'accessFrequency', 'confidence']
      },
      timeElapsed: Date.now() - startTime
    }
  }

  // ==================== 时间线检索 ====================

  /**
   * 时间线搜索
   *
   * 检索特定主题在时间维度上的记忆
   */
  async searchTimeline(topic: string, range: TimeRange): Promise<TimelineResult> {
    const startTime = Date.now()

    // 获取时间范围内的记忆
    const entries = await this.store.searchByTimeRange(range)

    // 按主题过滤
    const topicLower = topic.toLowerCase()
    const filtered = entries.filter((entry) => {
      const contentMatch = entry.content.toLowerCase().includes(topicLower)
      const tagMatch = entry.metadata?.tags?.some((t) => t.toLowerCase().includes(topicLower))
      return contentMatch || tagMatch
    })

    // 按日期分组
    const groupedByDate = new Map<string, ScoredMemoryEntry[]>()
    for (const entry of filtered) {
      const dateKey = new Date(entry.createdAt).toISOString().split('T')[0]
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, [])
      }
      groupedByDate.get(dateKey)!.push({
        ...entry,
        score: 1.0
      })
    }

    // 计算时间跨度
    const dates = filtered.map((e) => new Date(e.createdAt).getTime())
    const span = {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
      durationDays: Math.ceil((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24))
    }

    logger.debug('Timeline search completed', {
      topic,
      resultCount: filtered.length,
      span,
      timeElapsed: Date.now() - startTime
    })

    return {
      entries: filtered.map((e) => ({ ...e, score: 1.0 })),
      groupedByDate,
      span
    }
  }

  // ==================== 关联发现 ====================

  /**
   * 发现记忆关联
   *
   * 找出与指定记忆相关联的其他记忆
   */
  async discoverRelations(entryId: string): Promise<RelationDiscoveryResult> {
    // 获取已存在的关系
    const existingRelations = await this.store.getRelations(entryId)

    // 获取原始记忆
    const sourceEntry = await this.store.getById(entryId)
    if (!sourceEntry) {
      return { relations: [], relatedEntries: [] }
    }

    // 搜索相关记忆
    const relatedResults = await this.store.search(sourceEntry.content, {
      topK: 20,
      threshold: 0.5,
      query: sourceEntry.content,
      filters: {
        excludeIds: [entryId]
      }
    })

    // 生成潜在关系
    const discoveredRelations: MemoryRelation[] = relatedResults.map((related) => ({
      id: crypto.randomUUID(),
      sourceId: entryId,
      targetId: related.id,
      relationType: this.inferRelationType(sourceEntry, related),
      weight: related.score,
      createdAt: new Date()
    }))

    // 合并已有和新发现的关系
    const allRelations = [...existingRelations, ...discoveredRelations]

    // 获取关联的记忆条目
    const relatedIds = allRelations.map((r) => (r.sourceId === entryId ? r.targetId : r.sourceId))
    const relatedEntries = await this.store.getByIds(relatedIds)

    return {
      relations: allRelations,
      relatedEntries: relatedEntries.map((e) => ({
        ...e,
        score: discoveredRelations.find((r) => r.targetId === e.id)?.weight || 0.5
      }))
    }
  }

  // ==================== 主题聚类 ====================

  /**
   * 按主题聚类记忆
   */
  async clusterByTopic(entries: ScoredMemoryEntry[], k: number = 5): Promise<TopicCluster[]> {
    if (entries.length === 0) return []

    // 简单的基于标签的聚类
    const tagClusters = new Map<string, ScoredMemoryEntry[]>()

    for (const entry of entries) {
      // 使用第一个标签或类型作为聚类键
      const clusterKey = entry.metadata.tags?.[0] || entry.type || 'other'

      if (!tagClusters.has(clusterKey)) {
        tagClusters.set(clusterKey, [])
      }
      tagClusters.get(clusterKey)!.push(entry)
    }

    // 转换为 TopicCluster 格式
    const clusters: TopicCluster[] = Array.from(tagClusters.entries())
      .sort((a, b) => b[1].length - a[1].length) // 按大小排序
      .slice(0, k)
      .map(([topic, clusterEntries]) => {
        // 计算时间跨度
        const dates = clusterEntries.map((e) => new Date(e.createdAt).getTime())

        return {
          id: crypto.randomUUID(),
          topic,
          entries: clusterEntries.sort((a, b) => b.score - a.score),
          summary: this.generateClusterSummary(clusterEntries),
          timeSpan:
            dates.length > 0
              ? {
                  start: new Date(Math.min(...dates)),
                  end: new Date(Math.max(...dates))
                }
              : undefined
        }
      })

    logger.debug('Clustering completed', {
      inputCount: entries.length,
      clusterCount: clusters.length
    })

    return clusters
  }

  // ==================== 辅助方法 ====================

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1)

    // 去重
    return [...new Set(words)]
  }

  /**
   * 合并去重
   */
  private mergeAndDeduplicate(list1: ScoredMemoryEntry[], list2: ScoredMemoryEntry[]): ScoredMemoryEntry[] {
    const seen = new Set<string>()
    const result: ScoredMemoryEntry[] = []

    for (const entry of [...list1, ...list2]) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        result.push(entry)
      }
    }

    return result
  }

  /**
   * 计算相关性分数
   */
  private computeRelevanceScore(entry: ScoredMemoryEntry, query: string): number {
    const queryTerms = new Set(query.toLowerCase().split(/\s+/))
    const contentTerms = entry.content.toLowerCase().split(/\s+/)

    // 词汇重叠
    const overlap = contentTerms.filter((t) => queryTerms.has(t)).length
    const overlapScore = overlap / Math.max(queryTerms.size, 1)

    // 原始分数
    const originalScore = entry.score

    // 组合
    return originalScore * 0.6 + overlapScore * 0.4
  }

  /**
   * 生成匹配原因
   */
  private generateMatchReason(entry: ScoredMemoryEntry, query: string): string {
    const queryTerms = query.toLowerCase().split(/\s+/)
    const matchedTerms = queryTerms.filter((t) => entry.content.toLowerCase().includes(t))

    if (matchedTerms.length > 0) {
      return `Matched terms: ${matchedTerms.join(', ')}`
    }

    if (entry.metadata.tags?.length) {
      return `Related tags: ${entry.metadata.tags.slice(0, 3).join(', ')}`
    }

    return 'Semantic similarity'
  }

  /**
   * 推断关系类型
   */
  private inferRelationType(source: MemoryEntry, target: ScoredMemoryEntry): string {
    // 基于类型推断
    if (source.type === target.type) {
      return 'similar'
    }

    // 基于标签重叠
    const sourceTags = new Set(source.metadata.tags || [])
    const targetTags = target.metadata.tags || []
    const overlap = targetTags.filter((t) => sourceTags.has(t)).length

    if (overlap > 0) {
      return 'related'
    }

    return 'associated'
  }

  /**
   * 生成聚类摘要
   */
  private generateClusterSummary(entries: ScoredMemoryEntry[]): string {
    // 简单摘要：取前两个条目的内容片段
    const snippets = entries.slice(0, 2).map((e) => e.content.substring(0, 50) + '...')
    return snippets.join(' | ')
  }

  /**
   * 从聚类中选择代表
   */
  private selectFromClusters(clusters: TopicCluster[], limit: number): ScoredMemoryEntry[] {
    const result: ScoredMemoryEntry[] = []
    const perCluster = Math.ceil(limit / clusters.length)

    for (const cluster of clusters) {
      result.push(...cluster.entries.slice(0, perCluster))
    }

    return result.slice(0, limit)
  }

  /**
   * 构建空结果
   */
  private buildEmptyResult(startTime: number, _phases: PhaseResult[]): RetrievalResult {
    return {
      entries: [],
      metadata: {
        totalFound: 0,
        timeElapsed: Date.now() - startTime,
        strategy: 'deepmemo'
      }
    }
  }
}

export default DeepMemoRetriever
