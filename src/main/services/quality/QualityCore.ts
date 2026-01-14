/**
 * QualityCore - 核心质量评估引擎
 *
 * 提供：
 * - 多类型内容质量评估
 * - AI 驱动的分析
 * - 历史趋势追踪（通过 MemoryMaster 集成）
 * - 类型特定的检查实现
 * - 自动记录到日记和知识库
 * - 与 AgentBrain 专家协作
 */

import { loggerService } from '@logger'

import type {
  ImprovementTrend,
  IQualityChecker,
  IQualityCore,
  QualityCheckItem,
  QualityContentType,
  QualityEvaluationRequest,
  QualityHistory,
  QualityMetrics
} from './types'

const logger = loggerService.withContext('QualityCore')

/**
 * QualityCore 单例类
 */
export class QualityCore implements IQualityCore {
  private static instance: QualityCore | null = null

  // 检查器注册表
  private checkers: Map<QualityContentType, IQualityChecker> = new Map()

  // 历史缓存（内存中，持久化通过 MemoryMaster）
  private historyCache: Map<string, QualityHistory> = new Map()

  // 配置
  private config = {
    defaultCheckLevel: 'standard' as const,
    historyLimit: 20,
    enableMemoryIntegration: true,
    enableAutoRecording: true, // 自动记录到日记和记忆系统
    enableExpertConsultation: true, // 启用专家咨询
    autoSearchBestPractices: true // 自动搜索最佳实践
  }

  private constructor() {
    logger.info('QualityCore initializing...')
  }

  /**
   * 获取单例实例
   */
  static getInstance(): QualityCore {
    if (!QualityCore.instance) {
      QualityCore.instance = new QualityCore()
    }
    return QualityCore.instance
  }

  /**
   * 初始化（注册默认检查器）
   */
  async initialize(): Promise<void> {
    logger.info('Initializing QualityCore with default checkers...')

    // 延迟加载检查器以避免循环依赖
    try {
      const { ImageQualityChecker } = await import('./checkers/ImageQualityChecker')
      this.registerChecker(new ImageQualityChecker())
    } catch (error) {
      logger.warn('Failed to load ImageQualityChecker', { error: String(error) })
    }

    try {
      const { CodeQualityChecker } = await import('./checkers/CodeQualityChecker')
      this.registerChecker(new CodeQualityChecker())
    } catch (error) {
      logger.warn('Failed to load CodeQualityChecker', { error: String(error) })
    }

    try {
      const { TextQualityChecker } = await import('./checkers/TextQualityChecker')
      this.registerChecker(new TextQualityChecker())
    } catch (error) {
      logger.warn('Failed to load TextQualityChecker', { error: String(error) })
    }

    try {
      const { PromptQualityChecker } = await import('./checkers/PromptQualityChecker')
      this.registerChecker(new PromptQualityChecker())
    } catch (error) {
      logger.warn('Failed to load PromptQualityChecker', { error: String(error) })
    }

    logger.info('QualityCore initialized', {
      registeredCheckers: Array.from(this.checkers.keys())
    })
  }

  /**
   * 注册质量检查器
   */
  registerChecker(checker: IQualityChecker): void {
    this.checkers.set(checker.contentType, checker)
    logger.debug('Registered quality checker', {
      contentType: checker.contentType,
      name: checker.name
    })
  }

  /**
   * 获取质量检查器
   */
  getChecker(contentType: QualityContentType): IQualityChecker | undefined {
    return this.checkers.get(contentType)
  }

  /**
   * 获取所有已注册的检查器
   */
  getRegisteredCheckers(): IQualityChecker[] {
    return Array.from(this.checkers.values())
  }

  /**
   * 评估内容质量
   */
  async evaluate(request: QualityEvaluationRequest): Promise<QualityMetrics> {
    const startTime = Date.now()
    const { contentType, content, context, options } = request

    logger.info('Starting quality evaluation', {
      contentType,
      checkLevel: options?.checkLevel || 'standard',
      hasContext: !!context
    })

    try {
      // 获取对应的检查器
      const checker = this.checkers.get(contentType)

      if (!checker) {
        // 使用通用评估
        logger.warn('No specific checker found, using generic evaluation', { contentType })
        return this.genericEvaluation(request, startTime)
      }

      // 执行质量检查
      const metrics = await checker.check(request)

      // 添加历史评分
      const history = await this.getHistory(metrics.contentId)
      if (history) {
        metrics.previousScores = history.evaluations.slice(-10).map((e) => e.overallScore)
        metrics.improvementTrend = this.calculateTrend(metrics.previousScores, metrics.overallScore)
      }

      // 生成自动修复动作
      if (options?.enableAutoFix && checker.generateAutoFix) {
        metrics.autoFixActions = await checker.generateAutoFix(metrics)
        metrics.canAutoFix = metrics.autoFixActions.length > 0
      }

      // 设置评估时长
      metrics.duration = Date.now() - startTime

      // 记录到历史
      await this.recordMetrics(metrics)

      // 自动记录到日记、知识库，并咨询专家
      if (this.config.enableAutoRecording) {
        const recordContext = context
          ? {
              workflowName: context.workflowId,
              nodeName: context.nodeId
            }
          : undefined
        this.autoRecordToMemory(metrics, recordContext).catch((err) => {
          logger.warn('Auto-recording failed (non-blocking)', { error: String(err) })
        })
      }

      logger.info('Quality evaluation completed', {
        contentType,
        score: metrics.overallScore,
        passed: metrics.passed,
        duration: metrics.duration
      })

      return metrics
    } catch (error) {
      logger.error('Quality evaluation failed', {
        contentType,
        error: error instanceof Error ? error.message : String(error)
      })

      // 返回错误结果
      return this.createErrorMetrics(contentType, content, error, startTime)
    }
  }

  /**
   * 通用评估（当没有特定检查器时）
   */
  private async genericEvaluation(request: QualityEvaluationRequest, startTime: number): Promise<QualityMetrics> {
    const { contentType, content } = request

    // 基础检查
    const commonChecks: QualityCheckItem[] = [
      {
        id: 'content_exists',
        name: '内容存在性',
        passed: content !== null && content !== undefined && content !== '',
        score: content ? 100 : 0,
        weight: 1,
        details: content ? '内容存在' : '内容为空'
      }
    ]

    const overallScore = this.calculateOverallScore(commonChecks)
    const minScore = request.context?.userPreferences?.minAcceptableScore ?? 60

    return {
      contentType,
      contentId: this.generateContentId(content),
      timestamp: new Date(),
      passed: overallScore >= minScore,
      overallScore,
      checks: {
        common: commonChecks,
        typeSpecific: []
      },
      suggestions:
        overallScore < minScore
          ? [
              {
                id: 'improve_content',
                severity: 'warning',
                category: 'general',
                message: '内容质量需要改进',
                estimatedImpact: 20
              }
            ]
          : [],
      canAutoFix: false,
      duration: Date.now() - startTime
    }
  }

  /**
   * 创建错误指标
   */
  private createErrorMetrics(
    contentType: QualityContentType,
    content: unknown,
    error: unknown,
    startTime: number
  ): QualityMetrics {
    return {
      contentType,
      contentId: this.generateContentId(content),
      timestamp: new Date(),
      passed: false,
      overallScore: 0,
      checks: {
        common: [
          {
            id: 'evaluation_error',
            name: '评估错误',
            passed: false,
            score: 0,
            weight: 1,
            details: error instanceof Error ? error.message : String(error)
          }
        ],
        typeSpecific: []
      },
      suggestions: [
        {
          id: 'retry_evaluation',
          severity: 'critical',
          category: 'error',
          message: '评估失败，请重试',
          estimatedImpact: 0
        }
      ],
      canAutoFix: false,
      duration: Date.now() - startTime,
      metadata: { error: true }
    }
  }

  /**
   * 获取质量历史
   */
  async getHistory(contentId: string): Promise<QualityHistory | null> {
    // 首先检查内存缓存
    if (this.historyCache.has(contentId)) {
      return this.historyCache.get(contentId)!
    }

    // TODO: 从 MemoryMaster 查询历史
    // const memoryCoordinator = getIntegratedMemoryCoordinator()
    // const results = await memoryCoordinator.intelligentSearch(...)

    return null
  }

  /**
   * 记录评估结果
   */
  async recordMetrics(metrics: QualityMetrics): Promise<void> {
    const { contentId } = metrics

    // 更新内存缓存
    let history = this.historyCache.get(contentId)

    if (!history) {
      history = {
        contentId,
        evaluations: [],
        optimizations: [],
        trend: {
          direction: 'stable',
          averageScore: metrics.overallScore,
          bestScore: metrics.overallScore,
          worstScore: metrics.overallScore,
          scoreChanges: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    // 添加新评估
    history.evaluations.push(metrics)

    // 保持历史限制
    if (history.evaluations.length > this.config.historyLimit) {
      history.evaluations = history.evaluations.slice(-this.config.historyLimit)
    }

    // 更新趋势
    const scores = history.evaluations.map((e) => e.overallScore)
    history.trend = {
      direction: this.calculateTrend(scores.slice(0, -1), metrics.overallScore),
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
      scoreChanges: this.calculateScoreChanges(scores)
    }
    history.updatedAt = new Date()

    this.historyCache.set(contentId, history)

    // TODO: 持久化到 MemoryMaster
    // await this.persistToMemory(metrics)

    logger.debug('Recorded quality metrics', {
      contentId,
      score: metrics.overallScore,
      historyLength: history.evaluations.length
    })
  }

  /**
   * 计算总体评分
   */
  private calculateOverallScore(checks: QualityCheckItem[]): number {
    if (checks.length === 0) return 0

    const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0)
    if (totalWeight === 0) return 0

    const weightedSum = checks.reduce((sum, check) => sum + check.score * check.weight, 0)
    return Math.round(weightedSum / totalWeight)
  }

  /**
   * 计算改进趋势
   */
  private calculateTrend(previousScores: number[], currentScore: number): ImprovementTrend {
    if (previousScores.length === 0) return 'stable'

    const avgPrevious = previousScores.reduce((a, b) => a + b, 0) / previousScores.length
    const diff = currentScore - avgPrevious

    if (diff > 5) return 'improving'
    if (diff < -5) return 'declining'
    return 'stable'
  }

  /**
   * 计算分数变化
   */
  private calculateScoreChanges(scores: number[]): number[] {
    if (scores.length < 2) return []
    return scores.slice(1).map((score, i) => score - scores[i])
  }

  /**
   * 生成内容 ID
   */
  private generateContentId(content: unknown): string {
    if (typeof content === 'string') {
      // 使用内容哈希
      const hash = this.simpleHash(content)
      return `content-${hash}`
    }
    if (Buffer.isBuffer(content)) {
      return `buffer-${content.length}-${Date.now()}`
    }
    if (typeof content === 'object' && content !== null) {
      return `object-${this.simpleHash(JSON.stringify(content))}`
    }
    return `unknown-${Date.now()}`
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8)
  }

  /**
   * 清理历史缓存
   */
  clearHistoryCache(): void {
    this.historyCache.clear()
    logger.debug('History cache cleared')
  }

  /**
   * 自动记录到记忆系统（日记 + 知识库 + 专家咨询）
   */
  private async autoRecordToMemory(
    metrics: QualityMetrics,
    context?: { workflowName?: string; nodeName?: string }
  ): Promise<void> {
    try {
      // 延迟加载以避免循环依赖
      const { getQualityMemoryIntegration } = await import('./QualityMemoryIntegration')
      const memoryIntegration = getQualityMemoryIntegration()

      // 调用综合记录
      const result = await memoryIntegration.comprehensiveRecord(metrics, {
        recordToDiary: true,
        searchBestPractices: this.config.autoSearchBestPractices,
        consultExpert: this.config.enableExpertConsultation && !metrics.passed,
        context
      })

      // 如果有专家建议且评估失败，记录到 metadata
      if (result.expertAdvice) {
        metrics.metadata = {
          ...metrics.metadata,
          expertAdvice: {
            expertName: result.expertAdvice.expertName,
            recommendation: result.expertAdvice.recommendation,
            suggestedActions: result.expertAdvice.suggestedActions
          }
        }
      }

      // 如果找到最佳实践，也记录到 metadata
      if (result.bestPractices.length > 0) {
        metrics.metadata = {
          ...metrics.metadata,
          relatedBestPractices: result.bestPractices.slice(0, 3).map((bp) => ({
            title: bp.title,
            score: bp.score,
            description: bp.description.substring(0, 200)
          }))
        }
      }

      logger.debug('Auto-recording completed', {
        diaryId: result.diaryId,
        memoryId: result.memoryId,
        bestPracticesCount: result.bestPractices.length,
        hasExpertAdvice: !!result.expertAdvice
      })
    } catch (error) {
      logger.warn('Auto-recording to memory failed', { error: String(error) })
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): Record<string, unknown> {
    return {
      registeredCheckers: Array.from(this.checkers.keys()),
      cachedHistories: this.historyCache.size,
      config: this.config
    }
  }
}

/**
 * 获取 QualityCore 单例
 */
export function getQualityCore(): QualityCore {
  return QualityCore.getInstance()
}

/**
 * 初始化 QualityCore
 */
export async function initializeQualityCore(): Promise<QualityCore> {
  const core = getQualityCore()
  await core.initialize()
  return core
}
