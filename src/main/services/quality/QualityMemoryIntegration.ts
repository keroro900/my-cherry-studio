/**
 * QualityMemoryIntegration - 质量守护与记忆系统集成
 *
 * 提供：
 * - 质量评估结果记录到记忆系统
 * - 自动记录到日记（diary）
 * - 从历史记忆中搜索相似质量模式
 * - 知识库搜索最佳实践
 * - 基于历史数据学习优化策略
 * - 与 AgentBrain 协作进行质量决策
 */

import { loggerService } from '@logger'

import { getAgentBrain } from '../AgentBrain'
import { getIntegratedMemoryCoordinator, type IntegratedMemoryCoordinator } from '../memory/IntegratedMemoryCoordinator'
import type { OptimizationResult, QualityContentType, QualityMetrics } from './types'

const logger = loggerService.withContext('QualityMemoryIntegration')

// ==================== 类型定义 ====================

/**
 * 质量记忆条目
 */
export interface QualityMemoryEntry {
  id: string
  contentType: QualityContentType
  contentHash: string
  metrics: QualityMetrics
  optimization?: OptimizationResult
  tags: string[]
  createdAt: Date
  metadata?: Record<string, unknown>
}

/**
 * 质量模式
 */
export interface QualityPattern {
  id: string
  contentType: QualityContentType
  averageScore: number
  commonIssues: string[]
  successfulFixes: string[]
  occurrences: number
  lastSeen: Date
}

/**
 * 质量学习结果
 */
export interface QualityLearningResult {
  suggestedOptimizations: string[]
  predictedScore: number
  confidence: number
  basedOnPatterns: string[]
}

/**
 * 最佳实践
 */
export interface BestPractice {
  id: string
  title: string
  category: string
  contentType: QualityContentType
  description: string
  score: number
  appliedCount: number
  successRate: number
  source: 'knowledge' | 'memory' | 'learned'
}

/**
 * 专家咨询结果
 */
export interface ExpertConsultResult {
  expertId: string
  expertName: string
  recommendation: string
  confidence: number
  suggestedActions: string[]
  reasoning?: string
}

// ==================== QualityMemoryIntegration ====================

export class QualityMemoryIntegration {
  private static instance: QualityMemoryIntegration | null = null
  private memoryCoordinator: IntegratedMemoryCoordinator | null = null
  private initialized = false

  // 质量模式缓存
  private patternCache: Map<string, QualityPattern> = new Map()

  // 配置
  private config = {
    enableMemoryRecording: true,
    enableDiaryRecording: true, // 自动记录到日记
    enablePatternLearning: true,
    enableExpertConsultation: true, // 专家咨询
    patternMinOccurrences: 3,
    memoryCacheTTL: 300000, // 5 分钟
    diaryScoreThreshold: 0, // 所有评估都记录到日记（0 = 全部）
    bestPracticeMinScore: 85 // 最佳实践最低分数
  }

  private constructor() {
    logger.info('QualityMemoryIntegration created')
  }

  static getInstance(): QualityMemoryIntegration {
    if (!QualityMemoryIntegration.instance) {
      QualityMemoryIntegration.instance = new QualityMemoryIntegration()
    }
    return QualityMemoryIntegration.instance
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.memoryCoordinator = getIntegratedMemoryCoordinator()
      this.initialized = true
      logger.info('QualityMemoryIntegration initialized')
    } catch (error) {
      logger.warn('Failed to initialize memory coordinator, quality memory features disabled', {
        error: String(error)
      })
      this.initialized = false
    }
  }

  /**
   * 记录质量评估到记忆系统
   */
  async recordQualityEvaluation(metrics: QualityMetrics): Promise<string | null> {
    if (!this.config.enableMemoryRecording || !this.memoryCoordinator) {
      return null
    }

    try {
      // 构建记忆内容
      const content = this.buildMemoryContent(metrics)
      const tags = this.buildTags(metrics)

      // 创建记忆
      const result = await this.memoryCoordinator.createMemory({
        content,
        title: `Quality: ${metrics.contentType} - Score ${metrics.overallScore}`,
        backend: 'memory',
        tags,
        autoTag: true,
        metadata: {
          type: 'quality_evaluation',
          contentType: metrics.contentType,
          contentId: metrics.contentId,
          score: metrics.overallScore,
          passed: metrics.passed,
          timestamp: metrics.timestamp.toISOString()
        }
      })

      logger.debug('Quality evaluation recorded to memory', {
        memoryId: result.id,
        contentType: metrics.contentType,
        score: metrics.overallScore
      })

      return result.id
    } catch (error) {
      logger.error('Failed to record quality evaluation', { error: String(error) })
      return null
    }
  }

  /**
   * 记录优化结果到记忆系统
   */
  async recordOptimization(contentId: string, result: OptimizationResult): Promise<string | null> {
    if (!this.config.enableMemoryRecording || !this.memoryCoordinator) {
      return null
    }

    try {
      const content = this.buildOptimizationContent(result)
      const tags = [
        'optimization',
        result.success ? 'success' : 'failed',
        `improvement:${Math.round(result.improvements.scoreImprovement)}`,
        ...result.improvements.before.suggestions.map((s) => `fix:${s.category}`)
      ]

      const memoryResult = await this.memoryCoordinator.createMemory({
        content,
        title: `Optimization: +${result.improvements.scoreImprovement} points`,
        backend: 'memory',
        tags,
        autoTag: true,
        metadata: {
          type: 'optimization_result',
          contentId,
          scoreBefore: result.improvements.before.overallScore,
          scoreAfter: result.improvements.after.overallScore,
          improvement: result.improvements.scoreImprovement,
          iterations: result.iterations,
          success: result.success
        }
      })

      return memoryResult.id
    } catch (error) {
      logger.error('Failed to record optimization', { error: String(error) })
      return null
    }
  }

  /**
   * 自动记录质量评估到日记
   * 这会创建一个人类可读的日记条目
   */
  async recordToDiary(
    metrics: QualityMetrics,
    context?: { workflowName?: string; nodeName?: string; userNote?: string }
  ): Promise<string | null> {
    if (!this.config.enableDiaryRecording || !this.memoryCoordinator) {
      return null
    }

    // 检查分数阈值
    if (metrics.overallScore < this.config.diaryScoreThreshold) {
      return null
    }

    try {
      // 构建日记内容（人类可读格式）
      const diaryContent = this.buildDiaryContent(metrics, context)
      const diaryTitle = this.buildDiaryTitle(metrics)
      const tags = [
        'quality-diary',
        `type:${metrics.contentType}`,
        metrics.passed ? 'passed' : 'needs-improvement',
        `score:${Math.round(metrics.overallScore / 10) * 10}`
      ]

      // 如果是高分，标记为最佳实践
      if (metrics.overallScore >= this.config.bestPracticeMinScore) {
        tags.push('best-practice')
      }

      const result = await this.memoryCoordinator.createMemory({
        content: diaryContent,
        title: diaryTitle,
        backend: 'diary', // 使用日记后端
        tags,
        autoTag: true,
        metadata: {
          type: 'quality_diary',
          contentType: metrics.contentType,
          contentId: metrics.contentId,
          score: metrics.overallScore,
          passed: metrics.passed,
          timestamp: metrics.timestamp.toISOString(),
          trend: metrics.improvementTrend,
          workflowName: context?.workflowName,
          nodeName: context?.nodeName
        }
      })

      logger.info('Quality evaluation recorded to diary', {
        diaryId: result.id,
        contentType: metrics.contentType,
        score: metrics.overallScore
      })

      return result.id
    } catch (error) {
      logger.error('Failed to record to diary', { error: String(error) })
      return null
    }
  }

  /**
   * 搜索知识库中的最佳实践
   */
  async searchBestPractices(
    contentType: QualityContentType,
    category?: string,
    topK: number = 5
  ): Promise<BestPractice[]> {
    if (!this.memoryCoordinator) {
      return []
    }

    try {
      // 构建搜索查询
      const queryParts = [`best practice for ${contentType} quality`]
      if (category) {
        queryParts.push(category)
      }
      const query = queryParts.join(' ')

      // 搜索高分评估记录
      const results = await this.memoryCoordinator.intelligentSearch(query, {
        topK: topK * 2, // 多取一些用于过滤
        metadata: {
          type: 'quality_evaluation',
          contentType
        },
        applyLearning: true
      })

      // 过滤高分记录并转换为最佳实践
      const practices: BestPractice[] = []

      for (const result of results) {
        const score = result.metadata?.score as number
        if (score >= this.config.bestPracticeMinScore) {
          practices.push({
            id: result.id,
            title: (result.metadata?.title as string) || `Best Practice: ${contentType}`,
            category: category || 'general',
            contentType,
            description: result.content.substring(0, 500),
            score,
            appliedCount: 1,
            successRate: score / 100,
            source: 'memory'
          })
        }
      }

      // 也搜索标记为最佳实践的日记
      const diaryResults = await this.memoryCoordinator.intelligentSearch(`${contentType} quality best-practice`, {
        topK,
        applyLearning: true
      })

      for (const result of diaryResults) {
        const tags = result.matchedTags || []
        if (tags.includes('best-practice')) {
          practices.push({
            id: result.id,
            title: (result.metadata?.title as string) || `Best Practice from Diary`,
            category: category || 'learned',
            contentType,
            description: result.content.substring(0, 500),
            score: (result.metadata?.score as number) || 90,
            appliedCount: 1,
            successRate: 0.9,
            source: 'learned'
          })
        }
      }

      // 去重并排序
      const uniquePractices = practices.reduce((acc, practice) => {
        if (!acc.find((p) => p.id === practice.id)) {
          acc.push(practice)
        }
        return acc
      }, [] as BestPractice[])

      return uniquePractices.sort((a, b) => b.score - a.score).slice(0, topK)
    } catch (error) {
      logger.error('Failed to search best practices', { error: String(error) })
      return []
    }
  }

  /**
   * 咨询 AgentBrain 中的质量专家
   */
  async consultExpert(
    contentType: QualityContentType,
    metrics: QualityMetrics,
    question?: string
  ): Promise<ExpertConsultResult | null> {
    if (!this.config.enableExpertConsultation) {
      return null
    }

    try {
      const brain = getAgentBrain()

      // 构建咨询上下文
      const context = {
        conversationId: `quality-consult-${Date.now()}`,
        lastMessage: question || this.buildConsultationQuestion(metrics),
        keywords: [contentType, 'quality', 'optimization', ...metrics.suggestions.map((s) => s.category)],
        userIntent: 'question' as const,
        messageHistory: []
      }

      // 请求 AgentBrain 决定最合适的专家
      const expert = await brain.decideNextSpeaker(context)

      if (!expert) {
        logger.debug('No suitable expert found for quality consultation')
        return null
      }

      // 构建推荐内容
      const suggestedActions = metrics.suggestions.map((s) => s.message)

      return {
        expertId: expert.id,
        expertName: expert.displayName || expert.name,
        recommendation: this.buildExpertRecommendation(expert, metrics),
        confidence: metrics.overallScore >= 60 ? 0.8 : 0.6,
        suggestedActions,
        reasoning: `Based on ${expert.expertise.join(', ')} expertise`
      }
    } catch (error) {
      logger.error('Failed to consult expert', { error: String(error) })
      return null
    }
  }

  /**
   * 综合评估并记录（一站式调用）
   * 自动记录到日记 + 搜索最佳实践 + 咨询专家
   */
  async comprehensiveRecord(
    metrics: QualityMetrics,
    options?: {
      recordToDiary?: boolean
      searchBestPractices?: boolean
      consultExpert?: boolean
      context?: { workflowName?: string; nodeName?: string; userNote?: string }
    }
  ): Promise<{
    diaryId: string | null
    memoryId: string | null
    bestPractices: BestPractice[]
    expertAdvice: ExpertConsultResult | null
  }> {
    const { recordToDiary = true, searchBestPractices = true, consultExpert = true, context } = options || {}

    // 并行执行各项操作
    const [diaryId, memoryId, bestPractices, expertAdvice] = await Promise.all([
      recordToDiary ? this.recordToDiary(metrics, context) : Promise.resolve(null),
      this.recordQualityEvaluation(metrics),
      searchBestPractices ? this.searchBestPractices(metrics.contentType) : Promise.resolve([]),
      consultExpert && !metrics.passed ? this.consultExpert(metrics.contentType, metrics) : Promise.resolve(null)
    ])

    logger.info('Comprehensive quality record completed', {
      diaryId,
      memoryId,
      bestPracticesCount: bestPractices.length,
      hasExpertAdvice: !!expertAdvice
    })

    return { diaryId, memoryId, bestPractices, expertAdvice }
  }

  /**
   * 搜索类似的质量模式
   */
  async searchSimilarPatterns(contentType: QualityContentType, issues: string[]): Promise<QualityPattern[]> {
    if (!this.memoryCoordinator) {
      return []
    }

    try {
      // 构建搜索查询
      const query = `${contentType} quality issues: ${issues.join(', ')}`

      const results = await this.memoryCoordinator.intelligentSearch(query, {
        topK: 10,
        metadata: { type: 'quality_evaluation' },
        applyLearning: true
      })

      // 转换为质量模式
      const patterns = this.extractPatterns(results)

      // 更新缓存
      for (const pattern of patterns) {
        this.patternCache.set(pattern.id, pattern)
      }

      return patterns
    } catch (error) {
      logger.error('Failed to search similar patterns', { error: String(error) })
      return []
    }
  }

  /**
   * 基于历史学习预测优化策略
   */
  async learnOptimizationStrategy(
    contentType: QualityContentType,
    currentMetrics: QualityMetrics
  ): Promise<QualityLearningResult> {
    if (!this.config.enablePatternLearning || !this.memoryCoordinator) {
      return {
        suggestedOptimizations: [],
        predictedScore: currentMetrics.overallScore,
        confidence: 0,
        basedOnPatterns: []
      }
    }

    try {
      // 搜索成功的优化案例
      const query = `successful optimization for ${contentType} quality improvement`

      const results = await this.memoryCoordinator.intelligentSearch(query, {
        topK: 20,
        metadata: {
          type: 'optimization_result',
          success: true
        },
        applyLearning: true
      })

      if (results.length === 0) {
        return {
          suggestedOptimizations: currentMetrics.suggestions.map((s) => s.message),
          predictedScore: currentMetrics.overallScore + 10,
          confidence: 0.3,
          basedOnPatterns: []
        }
      }

      // 分析成功模式
      const successfulStrategies = this.analyzeSuccessfulStrategies(results, currentMetrics)

      return successfulStrategies
    } catch (error) {
      logger.error('Failed to learn optimization strategy', { error: String(error) })
      return {
        suggestedOptimizations: [],
        predictedScore: currentMetrics.overallScore,
        confidence: 0,
        basedOnPatterns: []
      }
    }
  }

  /**
   * 获取质量趋势
   */
  async getQualityTrend(
    contentType: QualityContentType,
    timeRangeDays: number = 7
  ): Promise<{
    averageScore: number
    trend: 'improving' | 'stable' | 'declining'
    totalEvaluations: number
    topIssues: string[]
  }> {
    if (!this.memoryCoordinator) {
      return {
        averageScore: 0,
        trend: 'stable',
        totalEvaluations: 0,
        topIssues: []
      }
    }

    try {
      const query = `${contentType} quality evaluation`
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - timeRangeDays * 24 * 60 * 60 * 1000)

      const results = await this.memoryCoordinator.intelligentSearch(query, {
        topK: 100,
        metadata: {
          type: 'quality_evaluation',
          contentType
        }
      })

      // 过滤时间范围内的结果
      const recentResults = results.filter((r) => {
        const timestamp = r.metadata?.timestamp
        if (!timestamp) return false
        const date = new Date(timestamp as string)
        return date >= startDate && date <= endDate
      })

      if (recentResults.length === 0) {
        return {
          averageScore: 0,
          trend: 'stable',
          totalEvaluations: 0,
          topIssues: []
        }
      }

      // 计算统计
      const scores = recentResults.map((r) => (r.metadata?.score as number) || 0)
      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length

      // 计算趋势
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2))
      const secondHalf = scores.slice(Math.floor(scores.length / 2))
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      const diff = secondAvg - firstAvg

      let trend: 'improving' | 'stable' | 'declining' = 'stable'
      if (diff > 5) trend = 'improving'
      else if (diff < -5) trend = 'declining'

      // 提取常见问题
      const issueCount: Record<string, number> = {}
      for (const r of recentResults) {
        const tags = r.matchedTags || []
        for (const tag of tags) {
          if (tag.startsWith('issue:') || tag.startsWith('check:')) {
            issueCount[tag] = (issueCount[tag] || 0) + 1
          }
        }
      }
      const topIssues = Object.entries(issueCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag)

      return {
        averageScore: Math.round(averageScore),
        trend,
        totalEvaluations: recentResults.length,
        topIssues
      }
    } catch (error) {
      logger.error('Failed to get quality trend', { error: String(error) })
      return {
        averageScore: 0,
        trend: 'stable',
        totalEvaluations: 0,
        topIssues: []
      }
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 构建记忆内容
   */
  private buildMemoryContent(metrics: QualityMetrics): string {
    const parts: string[] = []

    parts.push(`Quality Evaluation: ${metrics.contentType}`)
    parts.push(`Score: ${metrics.overallScore}/100 (${metrics.passed ? 'PASSED' : 'FAILED'})`)

    // 添加失败的检查项
    const failedChecks = [
      ...metrics.checks.common.filter((c) => !c.passed),
      ...metrics.checks.typeSpecific.filter((c) => !c.passed)
    ]

    if (failedChecks.length > 0) {
      parts.push('\nFailed Checks:')
      for (const check of failedChecks) {
        parts.push(`- ${check.name}: ${check.details || 'Score ' + check.score}`)
      }
    }

    // 添加建议
    if (metrics.suggestions.length > 0) {
      parts.push('\nSuggestions:')
      for (const suggestion of metrics.suggestions.slice(0, 3)) {
        parts.push(`- [${suggestion.severity}] ${suggestion.message}`)
      }
    }

    return parts.join('\n')
  }

  /**
   * 构建优化内容
   */
  private buildOptimizationContent(result: OptimizationResult): string {
    const parts: string[] = []

    parts.push(`Optimization Result: ${result.success ? 'SUCCESS' : 'FAILED'}`)
    parts.push(`Score: ${result.improvements.before.overallScore} → ${result.improvements.after.overallScore}`)
    parts.push(`Improvement: +${result.improvements.scoreImprovement}`)
    parts.push(`Iterations: ${result.iterations}`)

    if (result.changes.length > 0) {
      parts.push('\nChanges Applied:')
      for (const change of result.changes.slice(0, 5)) {
        parts.push(`- ${change.type}: ${change.target}`)
      }
    }

    return parts.join('\n')
  }

  /**
   * 构建标签
   */
  private buildTags(metrics: QualityMetrics): string[] {
    const tags: string[] = [
      'quality',
      `type:${metrics.contentType}`,
      `score:${Math.round(metrics.overallScore / 10) * 10}`,
      metrics.passed ? 'passed' : 'failed'
    ]

    // 添加失败检查项作为标签
    const failedChecks = [
      ...metrics.checks.common.filter((c) => !c.passed),
      ...metrics.checks.typeSpecific.filter((c) => !c.passed)
    ]

    for (const check of failedChecks.slice(0, 5)) {
      tags.push(`check:${check.id}`)
    }

    // 添加建议类别
    for (const suggestion of metrics.suggestions.slice(0, 3)) {
      tags.push(`issue:${suggestion.category}`)
    }

    return tags
  }

  /**
   * 从搜索结果提取模式
   */
  private extractPatterns(results: unknown[]): QualityPattern[] {
    const patternMap: Map<string, QualityPattern> = new Map()

    for (const result of results) {
      const r = result as { id: string; tags?: string[]; metadata?: Record<string, unknown> }
      const contentType = r.metadata?.contentType as QualityContentType
      const score = r.metadata?.score as number

      if (!contentType) continue

      const patternKey = `${contentType}-${r.tags?.join('-') || 'default'}`

      let pattern = patternMap.get(patternKey)
      if (!pattern) {
        pattern = {
          id: patternKey,
          contentType,
          averageScore: 0,
          commonIssues: [],
          successfulFixes: [],
          occurrences: 0,
          lastSeen: new Date()
        }
        patternMap.set(patternKey, pattern)
      }

      // 更新模式
      pattern.occurrences++
      pattern.averageScore = (pattern.averageScore * (pattern.occurrences - 1) + (score || 0)) / pattern.occurrences

      // 提取问题
      const issues = (r.tags || []).filter((t: string) => t.startsWith('issue:') || t.startsWith('check:'))
      for (const issue of issues) {
        if (!pattern.commonIssues.includes(issue)) {
          pattern.commonIssues.push(issue)
        }
      }
    }

    return Array.from(patternMap.values()).filter((p) => p.occurrences >= this.config.patternMinOccurrences)
  }

  /**
   * 分析成功的优化策略
   */
  private analyzeSuccessfulStrategies(results: unknown[], currentMetrics: QualityMetrics): QualityLearningResult {
    const strategies: string[] = []
    const patternIds: string[] = []
    let totalImprovement = 0
    let count = 0

    for (const result of results) {
      const r = result as { id: string; content: string; metadata?: Record<string, unknown> }
      const improvement = r.metadata?.improvement as number

      if (improvement && improvement > 0) {
        totalImprovement += improvement
        count++
        patternIds.push(r.id)

        // 从内容中提取策略
        const lines = r.content.split('\n')
        for (const line of lines) {
          if (line.startsWith('- ') && !strategies.includes(line.substring(2))) {
            strategies.push(line.substring(2))
          }
        }
      }
    }

    const avgImprovement = count > 0 ? totalImprovement / count : 0
    const predictedScore = Math.min(100, currentMetrics.overallScore + avgImprovement)

    return {
      suggestedOptimizations: strategies.slice(0, 5),
      predictedScore: Math.round(predictedScore),
      confidence: Math.min(0.9, count * 0.1),
      basedOnPatterns: patternIds.slice(0, 5)
    }
  }

  /**
   * 构建日记内容（人类可读格式）
   */
  private buildDiaryContent(
    metrics: QualityMetrics,
    context?: { workflowName?: string; nodeName?: string; userNote?: string }
  ): string {
    const lines: string[] = []
    const now = new Date()

    // 标题和时间
    lines.push(`## 质量评估日记`)
    lines.push(``)
    lines.push(`**时间**: ${now.toLocaleString('zh-CN')}`)
    lines.push(`**类型**: ${this.getContentTypeLabel(metrics.contentType)}`)
    lines.push(`**评分**: ${metrics.overallScore}/100 ${this.getScoreEmoji(metrics.overallScore)}`)
    lines.push(`**结果**: ${metrics.passed ? '✅ 通过' : '❌ 需改进'}`)

    // 上下文信息
    if (context?.workflowName || context?.nodeName) {
      lines.push(``)
      lines.push(`### 来源`)
      if (context.workflowName) lines.push(`- 工作流: ${context.workflowName}`)
      if (context.nodeName) lines.push(`- 节点: ${context.nodeName}`)
    }

    // 趋势
    if (metrics.improvementTrend) {
      const trendLabel = {
        improving: '📈 持续改进',
        stable: '➡️ 保持稳定',
        declining: '📉 有所下降'
      }[metrics.improvementTrend]
      lines.push(`**趋势**: ${trendLabel}`)
    }

    // 检查项摘要
    lines.push(``)
    lines.push(`### 检查摘要`)
    const allChecks = [...metrics.checks.common, ...metrics.checks.typeSpecific]
    const passedCount = allChecks.filter((c) => c.passed).length
    lines.push(`- 通过: ${passedCount}/${allChecks.length} 项检查`)

    // 失败的检查项
    const failedChecks = allChecks.filter((c) => !c.passed)
    if (failedChecks.length > 0) {
      lines.push(``)
      lines.push(`### 需要改进`)
      for (const check of failedChecks.slice(0, 5)) {
        lines.push(`- **${check.name}** (${check.score}分): ${check.details || '未达标'}`)
      }
    }

    // 建议
    if (metrics.suggestions.length > 0) {
      lines.push(``)
      lines.push(`### 优化建议`)
      for (const suggestion of metrics.suggestions.slice(0, 5)) {
        const severityIcon = { critical: '🔴', warning: '🟡', info: '🔵' }[suggestion.severity] || '⚪'
        lines.push(`- ${severityIcon} ${suggestion.message}`)
      }
    }

    // 自动修复
    if (metrics.canAutoFix && metrics.autoFixActions && metrics.autoFixActions.length > 0) {
      lines.push(``)
      lines.push(`### 可自动修复`)
      for (const action of metrics.autoFixActions.slice(0, 3)) {
        lines.push(`- ${action.description}`)
      }
    }

    // 用户备注
    if (context?.userNote) {
      lines.push(``)
      lines.push(`### 备注`)
      lines.push(context.userNote)
    }

    lines.push(``)
    lines.push(`---`)
    lines.push(`*由 QualityGuardian 自动记录*`)

    return lines.join('\n')
  }

  /**
   * 构建日记标题
   */
  private buildDiaryTitle(metrics: QualityMetrics): string {
    const typeLabel = this.getContentTypeLabel(metrics.contentType)
    const statusEmoji = metrics.passed ? '✅' : '⚠️'
    return `${statusEmoji} ${typeLabel}质量评估 - ${metrics.overallScore}分`
  }

  /**
   * 获取内容类型标签
   */
  private getContentTypeLabel(contentType: QualityContentType): string {
    const labels: Record<QualityContentType, string> = {
      image: '图像',
      code: '代码',
      text: '文本',
      workflow: '工作流',
      prompt: '提示词'
    }
    return labels[contentType] || contentType
  }

  /**
   * 获取分数表情
   */
  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🌟'
    if (score >= 80) return '👍'
    if (score >= 60) return '👌'
    if (score >= 40) return '🤔'
    return '😟'
  }

  /**
   * 构建专家咨询问题
   */
  private buildConsultationQuestion(metrics: QualityMetrics): string {
    const typeLabel = this.getContentTypeLabel(metrics.contentType)
    const issues = metrics.suggestions
      .slice(0, 3)
      .map((s) => s.message)
      .join('; ')

    return (
      `我正在进行${typeLabel}质量评估，当前得分 ${metrics.overallScore}/100。` +
      `主要问题: ${issues || '需要提升整体质量'}。` +
      `请提供专业的优化建议。`
    )
  }

  /**
   * 构建专家推荐
   */
  private buildExpertRecommendation(expert: { name: string; expertise: string[] }, metrics: QualityMetrics): string {
    const expertiseStr = expert.expertise.slice(0, 3).join('、')
    const typeLabel = this.getContentTypeLabel(metrics.contentType)

    if (metrics.passed) {
      return (
        `作为${expertiseStr}专家，我认为这个${typeLabel}质量良好（${metrics.overallScore}分）。` +
        `建议继续保持当前的质量标准，并考虑进一步优化以达到更高水平。`
      )
    } else {
      const mainIssue = metrics.suggestions[0]?.message || '整体质量需要提升'
      return (
        `作为${expertiseStr}专家，我注意到这个${typeLabel}需要改进（${metrics.overallScore}分）。` +
        `主要问题是: ${mainIssue}。建议按照优化建议逐步改进。`
      )
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): Record<string, unknown> {
    return {
      initialized: this.initialized,
      patternCacheSize: this.patternCache.size,
      config: this.config
    }
  }
}

/**
 * 获取 QualityMemoryIntegration 单例
 */
export function getQualityMemoryIntegration(): QualityMemoryIntegration {
  return QualityMemoryIntegration.getInstance()
}

/**
 * 初始化质量记忆集成
 */
export async function initializeQualityMemoryIntegration(): Promise<QualityMemoryIntegration> {
  const integration = getQualityMemoryIntegration()
  await integration.initialize()
  return integration
}
