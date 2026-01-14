/**
 * SelfLearningService - 三大自学习系统实现
 *
 * 基于 VCPToolBox 概念设计的完整实现：
 * 1. 查询频率自学习 (Query Frequency Learning)
 * 2. 用户反馈学习 (User Feedback Learning)
 * 3. 语义关联发现 (Semantic Association Discovery)
 *
 * 使用 native-vcp 原生 TagCooccurrenceMatrix 实现 Tag Boost
 *
 * @author Cherry Studio Team
 * @see external/VCPToolBox/KnowledgeBaseManager.js:377-554
 */

import { loggerService } from '@logger'
import { createTagCooccurrenceMatrix } from '@main/services/native'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('SelfLearningService')

// ==================== 类型定义 ====================

/**
 * 查询记录
 */
interface QueryRecord {
  /** 查询的标签 */
  tags: string[]
  /** 查询时间戳 */
  timestamp: number
  /** 查询类型 */
  type: 'search' | 'rag' | 'tagmemo'
}

/**
 * 反馈记录
 */
interface FeedbackRecord {
  /** 查询 */
  query: string
  /** 被选择的结果 ID */
  selectedResultId: string
  /** 相关标签 */
  tags: string[]
  /** 时间戳 */
  timestamp: number
  /** 反馈类型: 正向(用户选择) 或 负向(用户忽略) */
  type: 'positive' | 'negative'
}

/**
 * 标签学习统计
 */
interface TagLearningStats {
  /** 查询次数 */
  queryCount: number
  /** 正向反馈次数 */
  positiveCount: number
  /** 负向反馈次数 */
  negativeCount: number
  /** 最后查询时间 */
  lastQueryTime: number
  /** 学习权重调整因子 */
  learnedWeight: number
}

/**
 * 语义关联建议
 */
interface SemanticSuggestion {
  /** 源标签 */
  sourceTag: string
  /** 建议关联的标签 */
  suggestedTag: string
  /** 置信度 */
  confidence: number
  /** 发现时间 */
  discoveredAt: number
  /** 是否已确认 */
  confirmed: boolean
}

/**
 * 结果选择统计
 */
interface ResultSelectionStats {
  /** 被选择次数 */
  positiveCount: number
  /** 被忽略次数 */
  negativeCount: number
  /** 最后选择时间 */
  lastSelectedTime: number
  /** 关联的查询 (最近10个) */
  associatedQueries: string[]
}

// ==================== 自学习服务 ====================

/**
 * 自学习服务 - 实现三大自学习系统
 */
export class SelfLearningService {
  private static instance: SelfLearningService

  /** 标签学习统计 */
  private tagStats: Map<string, TagLearningStats> = new Map()

  /** 查询历史 (最近 1000 条) */
  private queryHistory: QueryRecord[] = []

  /** 反馈历史 (最近 500 条) */
  private feedbackHistory: FeedbackRecord[] = []

  /** 语义关联建议 */
  private semanticSuggestions: SemanticSuggestion[] = []

  /** 结果选择统计 */
  private resultStats: Map<string, ResultSelectionStats> = new Map()

  /** 结果统计最大条目数 */
  private readonly MAX_RESULT_STATS = 1000

  /** 数据目录 */
  private dataDir: string

  /** 自动保存定时器 */
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  /** Native TagCooccurrenceMatrix */
  private tagMatrix: ReturnType<typeof createTagCooccurrenceMatrix>

  /** 配置 */
  private config = {
    /** 时间衰减半衰期 (毫秒) - 7天 */
    decayHalfLife: 7 * 24 * 60 * 60 * 1000,
    /** 最大查询历史数 */
    maxQueryHistory: 1000,
    /** 最大反馈历史数 */
    maxFeedbackHistory: 500,
    /** 正向反馈权重增益 */
    positiveFeedbackGain: 0.1,
    /** 负向反馈权重衰减 */
    negativeFeedbackDecay: 0.05,
    /** 自动保存间隔 (毫秒) */
    saveInterval: 30000,
    /** 关联发现阈值 */
    associationThreshold: 0.7
  }

  private constructor() {
    // 统一存储到 Data/memory/ 目录 (Cherry Studio 原生化)
    this.dataDir = path.join(app.getPath('userData'), 'Data', 'memory')
    this.ensureDataDir()

    // 创建原生 TagCooccurrenceMatrix (带 fallback)
    this.tagMatrix = createTagCooccurrenceMatrix(0.8, 0.2)

    this.load()
    this.startAutoSave()
    logger.info('SelfLearningService initialized')
  }

  static getInstance(): SelfLearningService {
    if (!SelfLearningService.instance) {
      SelfLearningService.instance = new SelfLearningService()
    }
    return SelfLearningService.instance
  }

  // ==================== 1. 查询频率自学习 ====================

  /**
   * 记录查询事件
   * 每次用户进行搜索/RAG 查询时调用
   */
  recordQuery(tags: string[], type: 'search' | 'rag' | 'tagmemo' = 'search'): void {
    const timestamp = Date.now()

    // 添加到历史
    this.queryHistory.push({ tags, timestamp, type })

    // 限制历史大小
    if (this.queryHistory.length > this.config.maxQueryHistory) {
      this.queryHistory = this.queryHistory.slice(-this.config.maxQueryHistory)
    }

    // 更新标签统计
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim()
      if (!normalizedTag) continue

      const stats = this.tagStats.get(normalizedTag) || this.createDefaultStats()
      stats.queryCount++
      stats.lastQueryTime = timestamp
      stats.learnedWeight = this.calculateLearnedWeight(stats)
      this.tagStats.set(normalizedTag, stats)
    }

    // 更新共现矩阵
    this.updateCooccurrenceMatrix(tags)

    logger.debug('Query recorded', { tags, type })
  }

  /**
   * 更新共现矩阵
   */
  private updateCooccurrenceMatrix(tags: string[]): void {
    const normalizedTags = tags.map((t) => t.toLowerCase().trim()).filter((t) => t)
    if (normalizedTags.length < 2) return

    // 记录所有标签对的共现
    for (let i = 0; i < normalizedTags.length; i++) {
      for (let j = i + 1; j < normalizedTags.length; j++) {
        this.tagMatrix.update(normalizedTags[i], normalizedTags[j], 1.0)
      }
    }
  }

  /**
   * 获取标签的学习权重调整因子
   * 用于在 Spike 算法中增强常用标签
   */
  getLearnedWeight(tag: string): number {
    const stats = this.tagStats.get(tag.toLowerCase().trim())
    if (!stats) return 1.0

    // 应用时间衰减
    const timeSinceLastQuery = Date.now() - stats.lastQueryTime
    const decayFactor = Math.pow(0.5, timeSinceLastQuery / this.config.decayHalfLife)

    return Math.max(0.5, Math.min(2.0, stats.learnedWeight * decayFactor))
  }

  // ==================== 2. 用户反馈学习 ====================

  /**
   * 记录正向反馈 - 用户选择了某个搜索结果
   */
  recordPositiveFeedback(query: string, selectedResultId: string, relatedTags: string[]): void {
    this.recordFeedback(query, selectedResultId, relatedTags, 'positive')
  }

  /**
   * 记录负向反馈 - 用户明确标记某个结果不相关
   */
  recordNegativeFeedback(query: string, ignoredResultId: string, relatedTags: string[]): void {
    this.recordFeedback(query, ignoredResultId, relatedTags, 'negative')
  }

  private recordFeedback(query: string, resultId: string, tags: string[], type: 'positive' | 'negative'): void {
    const timestamp = Date.now()
    let weightAdjustment: number | undefined

    // 添加到历史
    this.feedbackHistory.push({
      query,
      selectedResultId: resultId,
      tags,
      timestamp,
      type
    })

    // 限制历史大小
    if (this.feedbackHistory.length > this.config.maxFeedbackHistory) {
      this.feedbackHistory = this.feedbackHistory.slice(-this.config.maxFeedbackHistory)
    }

    // 更新标签统计
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim()
      if (!normalizedTag) continue

      const stats = this.tagStats.get(normalizedTag) || this.createDefaultStats()
      const oldWeight = stats.learnedWeight

      if (type === 'positive') {
        stats.positiveCount++
        stats.learnedWeight = Math.min(2.0, stats.learnedWeight + this.config.positiveFeedbackGain)
        weightAdjustment = stats.learnedWeight - oldWeight
      } else {
        stats.negativeCount++
        stats.learnedWeight = Math.max(0.5, stats.learnedWeight - this.config.negativeFeedbackDecay)
        weightAdjustment = oldWeight - stats.learnedWeight
      }

      this.tagStats.set(normalizedTag, stats)
    }

    // 更新结果级别统计
    if (resultId) {
      const existing = this.resultStats.get(resultId) || {
        positiveCount: 0,
        negativeCount: 0,
        lastSelectedTime: 0,
        associatedQueries: []
      }

      if (type === 'positive') {
        existing.positiveCount++
        existing.lastSelectedTime = timestamp
      } else {
        existing.negativeCount++
      }

      // 关联查询 (最多保留 10 个)
      if (query && !existing.associatedQueries.includes(query)) {
        existing.associatedQueries.push(query)
        if (existing.associatedQueries.length > 10) {
          existing.associatedQueries.shift()
        }
      }

      this.resultStats.set(resultId, existing)

      // 限制条目数量
      if (this.resultStats.size > this.MAX_RESULT_STATS) {
        this.pruneResultStats()
      }
    }

    logger.debug('Feedback recorded', { query, resultId, type, tagsCount: tags.length })

    // 发送 SELFLEARNING_FEEDBACK 事件到 RAGObserverPanel
    try {
      // 动态导入 VCPInfoService 避免循环依赖
      import('../../services/vcp/VCPInfoService').then(({ getVCPInfoService }) => {
        const vcpInfoService = getVCPInfoService()
        vcpInfoService.broadcastEvent({
          type: 'SELFLEARNING_FEEDBACK',
          feedbackType: type,
          query,
          resultId,
          relatedTags: tags,
          weightAdjustment,
          timestamp
        })
        logger.debug('SelfLearning feedback event broadcasted', { query, resultId, type })
      })
    } catch (error) {
      logger.warn('Failed to broadcast self-learning feedback event', error as Error)
    }
  }

  /**
   * 清理旧的结果统计 (保留最近选择的)
   */
  private pruneResultStats(): void {
    const entries = Array.from(this.resultStats.entries())
    entries.sort((a, b) => b[1].lastSelectedTime - a[1].lastSelectedTime)

    // 保留最近的 80%
    const keepCount = Math.floor(this.MAX_RESULT_STATS * 0.8)
    this.resultStats = new Map(entries.slice(0, keepCount))
  }

  // ==================== 3. 语义关联发现 ====================

  /**
   * 分析查询历史，发现潜在的语义关联
   * 定期调用以发现新的 Tag 关联
   */
  discoverSemanticAssociations(): SemanticSuggestion[] {
    const tagPairCounts: Map<string, number> = new Map()
    const tagCounts: Map<string, number> = new Map()

    // 统计共现频率
    for (const record of this.queryHistory) {
      const tags = record.tags.map((t) => t.toLowerCase().trim()).filter((t) => t)

      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }

      // 统计共现对
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const key = [tags[i], tags[j]].sort().join('|')
          tagPairCounts.set(key, (tagPairCounts.get(key) || 0) + 1)
        }
      }
    }

    const suggestions: SemanticSuggestion[] = []
    const timestamp = Date.now()

    // 计算 PMI (Pointwise Mutual Information) 发现关联
    const totalQueries = this.queryHistory.length
    if (totalQueries < 10) return suggestions // 数据太少

    for (const [pairKey, pairCount] of tagPairCounts) {
      const [tag1, tag2] = pairKey.split('|')
      const count1 = tagCounts.get(tag1) || 0
      const count2 = tagCounts.get(tag2) || 0

      if (count1 < 3 || count2 < 3) continue // 样本太少

      // PMI = log(P(x,y) / (P(x) * P(y)))
      const pXY = pairCount / totalQueries
      const pX = count1 / totalQueries
      const pY = count2 / totalQueries
      const pmi = Math.log(pXY / (pX * pY))

      // 归一化到 [0, 1]
      const confidence = Math.max(0, Math.min(1, (pmi + 2) / 4))

      if (confidence >= this.config.associationThreshold) {
        // 检查是否已存在
        const existing = this.semanticSuggestions.find(
          (s) => (s.sourceTag === tag1 && s.suggestedTag === tag2) || (s.sourceTag === tag2 && s.suggestedTag === tag1)
        )

        if (!existing) {
          suggestions.push({
            sourceTag: tag1,
            suggestedTag: tag2,
            confidence,
            discoveredAt: timestamp,
            confirmed: false
          })
        }
      }
    }

    // 保存新发现
    this.semanticSuggestions.push(...suggestions)

    if (suggestions.length > 0) {
      logger.info('Discovered semantic associations', { count: suggestions.length })
    }

    return suggestions
  }

  /**
   * 确认语义关联建议
   * 将建议转换为实际的共现关系
   */
  confirmSuggestion(sourceTag: string, suggestedTag: string): boolean {
    const suggestion = this.semanticSuggestions.find(
      (s) =>
        (s.sourceTag === sourceTag && s.suggestedTag === suggestedTag) ||
        (s.sourceTag === suggestedTag && s.suggestedTag === sourceTag)
    )

    if (suggestion) {
      suggestion.confirmed = true
      // 同步到共现矩阵
      this.tagMatrix.update(sourceTag.toLowerCase(), suggestedTag.toLowerCase(), suggestion.confidence * 2)
      logger.info('Semantic suggestion confirmed', { sourceTag, suggestedTag })
      return true
    }

    return false
  }

  /**
   * 获取待确认的语义关联建议
   */
  getPendingSuggestions(): SemanticSuggestion[] {
    return this.semanticSuggestions.filter((s) => !s.confirmed)
  }

  // ==================== 4. Tag 扩展 (基于共现矩阵) ====================

  /**
   * 获取 Tag 的扩展建议 (基于共现矩阵)
   */
  getExpandedTags(tags: string[]): string[] {
    const normalizedTags = tags.map((t) => t.toLowerCase().trim()).filter((t) => t)
    return this.tagMatrix.expandQuery(normalizedTags, 0.5)
  }

  /**
   * 获取标签的相关标签
   */
  getRelatedTags(tag: string, topK: number = 10): Array<{ tag: string; pmi: number }> {
    const associations = this.tagMatrix.getAssociations(tag.toLowerCase().trim(), topK)
    return associations.map((a) => ({ tag: a.tag, pmi: a.pmi }))
  }

  /**
   * 获取共现矩阵统计信息
   */
  getCooccurrenceStats(): {
    tagCount: number
    pairCount: number
    totalUpdates: number
  } {
    const stats = this.tagMatrix.getStats()
    return {
      tagCount: stats.tagCount,
      pairCount: stats.pairCount,
      totalUpdates: stats.totalUpdates
    }
  }

  // ==================== 辅助方法 ====================

  private createDefaultStats(): TagLearningStats {
    return {
      queryCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      lastQueryTime: 0,
      learnedWeight: 1.0
    }
  }

  private calculateLearnedWeight(stats: TagLearningStats): number {
    // 基础权重 = 1.0
    // 查询频率增益 (对数增长，防止极端值)
    const queryBoost = Math.log(stats.queryCount + 1) / 10

    // 反馈调整
    const feedbackDelta =
      stats.positiveCount * this.config.positiveFeedbackGain - stats.negativeCount * this.config.negativeFeedbackDecay

    // 限制在 [0.5, 2.0] 范围
    return Math.max(0.5, Math.min(2.0, 1.0 + queryBoost + feedbackDelta))
  }

  // ==================== 结果选择统计查询 ====================

  /**
   * 获取结果的用户选择次数
   */
  getResultSelectionCount(resultId: string): number {
    return this.resultStats.get(resultId)?.positiveCount ?? 0
  }

  /**
   * 获取结果的完整统计
   */
  getResultStats(resultId: string): ResultSelectionStats | undefined {
    return this.resultStats.get(resultId)
  }

  /**
   * 批量获取结果选择次数
   */
  getResultSelectionCounts(resultIds: string[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const id of resultIds) {
      counts.set(id, this.getResultSelectionCount(id))
    }
    return counts
  }

  // ==================== 统计接口 ====================

  /**
   * 获取学习统计信息
   */
  getStats(): {
    totalTags: number
    totalQueries: number
    totalFeedback: number
    pendingSuggestions: number
    topTags: Array<{ tag: string; weight: number; queryCount: number }>
  } {
    const topTags = Array.from(this.tagStats.entries())
      .sort((a, b) => b[1].learnedWeight - a[1].learnedWeight)
      .slice(0, 10)
      .map(([tag, stats]) => ({
        tag,
        weight: stats.learnedWeight,
        queryCount: stats.queryCount
      }))

    return {
      totalTags: this.tagStats.size,
      totalQueries: this.queryHistory.length,
      totalFeedback: this.feedbackHistory.length,
      pendingSuggestions: this.getPendingSuggestions().length,
      topTags
    }
  }

  /**
   * 获取标签详细统计
   */
  getTagStats(tag: string): TagLearningStats | null {
    return this.tagStats.get(tag.toLowerCase().trim()) || null
  }

  // ==================== 持久化 ====================

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  private getDataPath(): string {
    return path.join(this.dataDir, 'selflearning.json')
  }

  private getMatrixPath(): string {
    return path.join(this.dataDir, 'tagmatrix.json')
  }

  private load(): void {
    try {
      const dataPath = this.getDataPath()
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

        if (data.tagStats) {
          this.tagStats = new Map(Object.entries(data.tagStats))
        }
        if (data.queryHistory) {
          this.queryHistory = data.queryHistory
        }
        if (data.feedbackHistory) {
          this.feedbackHistory = data.feedbackHistory
        }
        if (data.semanticSuggestions) {
          this.semanticSuggestions = data.semanticSuggestions
        }
        if (data.resultStats) {
          this.resultStats = new Map(Object.entries(data.resultStats as Record<string, ResultSelectionStats>))
        }

        logger.info('Self-learning data loaded', {
          tags: this.tagStats.size,
          queries: this.queryHistory.length,
          resultStats: this.resultStats.size
        })
      }

      // 加载共现矩阵
      const matrixPath = this.getMatrixPath()
      if (fs.existsSync(matrixPath)) {
        const matrixJson = fs.readFileSync(matrixPath, 'utf8')
        // 如果 tagMatrix 支持 fromJson，使用它
        if (typeof (this.tagMatrix.constructor as any).fromJson === 'function') {
          this.tagMatrix = (this.tagMatrix.constructor as any).fromJson(matrixJson)
        }
      }
    } catch (error) {
      logger.error('Failed to load self-learning data', error as Error)
    }
  }

  save(): void {
    try {
      const data = {
        tagStats: Object.fromEntries(this.tagStats),
        queryHistory: this.queryHistory,
        feedbackHistory: this.feedbackHistory,
        semanticSuggestions: this.semanticSuggestions,
        resultStats: Object.fromEntries(this.resultStats),
        savedAt: new Date().toISOString()
      }

      fs.writeFileSync(this.getDataPath(), JSON.stringify(data, null, 2))

      // 保存共现矩阵
      if (typeof this.tagMatrix.toJson === 'function') {
        fs.writeFileSync(this.getMatrixPath(), this.tagMatrix.toJson())
      }

      logger.debug('Self-learning data saved')
    } catch (error) {
      logger.error('Failed to save self-learning data', error as Error)
    }
  }

  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      this.save()
    }, this.config.saveInterval)
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }
    this.save()

    // 清理共现矩阵
    if (typeof this.tagMatrix.clear === 'function') {
      this.tagMatrix.clear()
    }

    logger.info('SelfLearningService disposed')
  }

  /**
   * 重置所有学习数据
   */
  reset(): void {
    this.tagStats.clear()
    this.queryHistory = []
    this.feedbackHistory = []
    this.semanticSuggestions = []
    this.resultStats.clear()
    this.save()

    // 重置共现矩阵
    if (typeof this.tagMatrix.clear === 'function') {
      this.tagMatrix.clear()
    }

    logger.info('Self-learning data reset')
  }

  // ==================== TagMemo 可视化增强 ====================

  /**
   * 获取 TagMemo 的详细 Spike 计算信息
   * 用于 RAGObserverPanel 可视化
   *
   * @param queryTags - 查询标签
   * @param resultTags - 结果标签
   * @returns Spike 计算详情
   */
  computeTagMemoSpike(
    queryTags: string[],
    resultTags: string[]
  ): {
    totalBoost: number
    matchedPairs: Array<{
      queryTag: string
      resultTag: string
      pmi: number
      contribution: number
    }>
    spikeCount: number
  } {
    const normalizedQueryTags = queryTags.map(t => t.toLowerCase().trim()).filter(Boolean)
    const normalizedResultTags = resultTags.map(t => t.toLowerCase().trim()).filter(Boolean)

    const matchedPairs: Array<{
      queryTag: string
      resultTag: string
      pmi: number
      contribution: number
    }> = []

    let totalBoost = 0

    // 计算每对标签的 PMI 贡献
    for (const queryTag of normalizedQueryTags) {
      for (const resultTag of normalizedResultTags) {
        // 跳过相同的标签
        if (queryTag === resultTag) {
          matchedPairs.push({
            queryTag,
            resultTag,
            pmi: 1.0, // 完全匹配
            contribution: 0.5
          })
          totalBoost += 0.5
          continue
        }

        // 获取共现 PMI
        const pmi = this.tagMatrix.computePmi(queryTag, resultTag)
        if (pmi > 0) {
          // PMI 贡献: 归一化到 [0, 0.3] 范围
          const contribution = Math.min(0.3, pmi / 5)
          matchedPairs.push({
            queryTag,
            resultTag,
            pmi,
            contribution
          })
          totalBoost += contribution
        }
      }
    }

    // 应用学习权重调整
    for (const queryTag of normalizedQueryTags) {
      const learnedWeight = this.getLearnedWeight(queryTag)
      if (learnedWeight !== 1.0) {
        totalBoost *= learnedWeight
      }
    }

    // 限制最大 boost
    totalBoost = Math.min(2.0, 1 + totalBoost)

    return {
      totalBoost,
      matchedPairs: matchedPairs.sort((a, b) => b.contribution - a.contribution),
      spikeCount: matchedPairs.filter(p => p.pmi > 0 || p.queryTag === p.resultTag).length
    }
  }

  /**
   * 获取 TagMemo 矩阵的热力图数据
   * 用于可视化标签共现关系
   *
   * @param topK - 返回的顶部标签数量
   * @returns 热力图数据
   */
  getTagMemoHeatmapData(topK: number = 20): {
    tags: string[]
    matrix: number[][]
    maxValue: number
  } {
    // 获取最活跃的标签
    const topTags = Array.from(this.tagStats.entries())
      .sort((a, b) => b[1].queryCount - a[1].queryCount)
      .slice(0, topK)
      .map(([tag]) => tag)

    if (topTags.length === 0) {
      return { tags: [], matrix: [], maxValue: 0 }
    }

    // 构建 PMI 矩阵
    const matrix: number[][] = []
    let maxValue = 0

    for (let i = 0; i < topTags.length; i++) {
      const row: number[] = []
      for (let j = 0; j < topTags.length; j++) {
        if (i === j) {
          row.push(1) // 自身 PMI = 1
        } else {
          const pmi = this.tagMatrix.computePmi(topTags[i], topTags[j])
          row.push(Math.max(0, pmi))
          if (pmi > maxValue) maxValue = pmi
        }
      }
      matrix.push(row)
    }

    return { tags: topTags, matrix, maxValue }
  }

  /**
   * 获取标签的完整 TagMemo 信息
   * 用于单个标签的详情展示
   *
   * @param tag - 标签
   * @returns 标签的 TagMemo 信息
   */
  getTagMemoInfo(tag: string): {
    tag: string
    learningStats: TagLearningStats | null
    topAssociations: Array<{ tag: string; pmi: number }>
    recentQueries: QueryRecord[]
    recentFeedback: FeedbackRecord[]
  } {
    const normalizedTag = tag.toLowerCase().trim()

    // 学习统计
    const learningStats = this.tagStats.get(normalizedTag) || null

    // 顶部关联
    const topAssociations = this.getRelatedTags(normalizedTag, 10)

    // 相关查询历史
    const recentQueries = this.queryHistory
      .filter(q => q.tags.some(t => t.toLowerCase().trim() === normalizedTag))
      .slice(-10)

    // 相关反馈历史
    const recentFeedback = this.feedbackHistory
      .filter(f => f.tags.some(t => t.toLowerCase().trim() === normalizedTag))
      .slice(-10)

    return {
      tag: normalizedTag,
      learningStats,
      topAssociations,
      recentQueries,
      recentFeedback
    }
  }

  /**
   * 导出完整的 TagMemo 状态
   * 用于调试和数据迁移
   */
  exportTagMemoState(): {
    tagStats: Record<string, TagLearningStats>
    cooccurrenceMatrix: string | null
    suggestions: SemanticSuggestion[]
    stats: {
      totalTags: number
      totalQueries: number
      totalFeedback: number
      pendingSuggestions: number
      topTags: Array<{ tag: string; weight: number; queryCount: number }>
    }
  } {
    return {
      tagStats: Object.fromEntries(this.tagStats),
      cooccurrenceMatrix: typeof this.tagMatrix.toJson === 'function' ? this.tagMatrix.toJson() : null,
      suggestions: this.semanticSuggestions,
      stats: this.getStats()
    }
  }

  /**
   * 导入 TagMemo 状态
   * 用于数据恢复
   */
  importTagMemoState(state: {
    tagStats?: Record<string, TagLearningStats>
    cooccurrenceMatrix?: string
    suggestions?: SemanticSuggestion[]
  }): boolean {
    try {
      if (state.tagStats) {
        this.tagStats = new Map(Object.entries(state.tagStats))
      }

      if (state.cooccurrenceMatrix && typeof (this.tagMatrix.constructor as any).fromJson === 'function') {
        this.tagMatrix = (this.tagMatrix.constructor as any).fromJson(state.cooccurrenceMatrix)
      }

      if (state.suggestions) {
        this.semanticSuggestions = state.suggestions
      }

      this.save()
      logger.info('TagMemo state imported successfully')
      return true
    } catch (error) {
      logger.error('Failed to import TagMemo state', error as Error)
      return false
    }
  }

}

// ==================== 导出 ====================

let serviceInstance: SelfLearningService | null = null

export function getSelfLearningService(): SelfLearningService {
  if (!serviceInstance) {
    serviceInstance = SelfLearningService.getInstance()
  }
  return serviceInstance
}
