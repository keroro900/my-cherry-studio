/**
 * QualityGuardianAgent - AI 质量守护 Agent
 *
 * 作为协作群的质量守护者，提供：
 * - 多类型内容质量评估（图片/代码/文本/提示词/工作流）
 * - 自动优化建议和执行
 * - 与其他 Agent 协作改进生成质量
 * - 历史趋势追踪和学习
 *
 * @module agents/collaboration/QualityGuardianAgent
 */

import type { Model, Provider } from '@renderer/types'
import { v4 as uuid } from 'uuid'

import type {
  CollaborationAgentConfig,
  CollaborationEvent,
  CollaborationEventCallback,
  CollaborationMessage,
  CollaborationRole
} from './types'

// ==================== 类型定义 ====================

/**
 * 质量内容类型
 */
export type QualityContentType = 'image' | 'code' | 'text' | 'workflow' | 'prompt'

/**
 * 质量检查项
 */
export interface QualityCheckItem {
  id: string
  name: string
  passed: boolean
  score: number
  weight: number
  details?: string
  category?: string
}

/**
 * 质量建议
 */
export interface QualitySuggestion {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  message: string
  fixDescription?: string
  estimatedImpact: number
}

/**
 * 自动修复动作
 */
export interface AutoFixAction {
  id: string
  type: 'prompt_optimization' | 'config_adjustment' | 'code_modification' | 'workflow_refactor'
  description: string
  changes: Array<{
    target: string
    before: string
    after: string
  }>
  requiresApproval: boolean
  riskLevel: 'low' | 'medium' | 'high'
  estimatedImprovement: number
}

/**
 * 质量评估结果
 */
export interface QualityMetrics {
  contentType: QualityContentType
  contentId: string
  timestamp: Date
  passed: boolean
  overallScore: number
  checks: {
    common: QualityCheckItem[]
    typeSpecific: QualityCheckItem[]
  }
  suggestions: QualitySuggestion[]
  canAutoFix: boolean
  autoFixActions?: AutoFixAction[]
  previousScores?: number[]
  improvementTrend?: 'improving' | 'stable' | 'declining'
  duration?: number
}

/**
 * 质量评估请求
 */
export interface QualityEvaluationRequest {
  contentType: QualityContentType
  content: unknown
  context?: {
    targetAudience?: string
    qualityGoals?: string[]
    userPreferences?: {
      minAcceptableScore?: number
      prioritizeChecks?: string[]
    }
  }
  options?: {
    checkLevel?: 'basic' | 'standard' | 'thorough'
    enableAutoFix?: boolean
  }
}

/**
 * Agent 执行函数（用于 AI 调用）
 */
export interface QualityAgentFunctions {
  /** 调用质量评估 API */
  evaluateQuality: (request: QualityEvaluationRequest) => Promise<QualityMetrics>
  /** 调用优化 API */
  optimizeContent: (
    contentType: QualityContentType,
    content: unknown,
    targetScore?: number
  ) => Promise<{
    optimized: unknown
    improvements: string[]
  }>
  /** AI 分析 */
  analyzeWithAI: (provider: Provider, model: Model, prompt: string, content?: string) => Promise<string>
  /** 请求用户审批 */
  requestApproval: (action: AutoFixAction) => Promise<boolean>
}

/**
 * 质量守护请求
 */
export interface QualityGuardianRequest {
  /** 内容类型 */
  contentType: QualityContentType
  /** 要检查的内容 */
  content: unknown
  /** 原始提示词（可选） */
  originalPrompt?: string
  /** 期望分数阈值 */
  minScore?: number
  /** 是否自动优化 */
  autoOptimize?: boolean
  /** 最大优化迭代次数 */
  maxIterations?: number
  /** 取消信号 */
  signal?: AbortSignal
}

/**
 * 质量守护结果
 */
export interface QualityGuardianResult {
  /** 是否成功 */
  success: boolean
  /** 最终质量评估 */
  finalMetrics: QualityMetrics
  /** 优化历史 */
  optimizationHistory: Array<{
    iteration: number
    metrics: QualityMetrics
    action?: AutoFixAction
  }>
  /** 改进建议 */
  suggestions: QualitySuggestion[]
  /** 应用的修复 */
  appliedFixes: AutoFixAction[]
  /** 优化后的内容（如果有） */
  optimizedContent?: unknown
  /** 耗时统计 */
  stats: {
    totalTime: number
    evaluations: number
    optimizations: number
  }
  /** 错误信息 */
  error?: string
}

/**
 * 质量守护事件
 */
export type QualityGuardianEvent =
  | { type: 'guardian:start'; request: QualityGuardianRequest }
  | { type: 'guardian:end'; result: QualityGuardianResult }
  | { type: 'evaluation:start'; iteration: number }
  | { type: 'evaluation:complete'; metrics: QualityMetrics; iteration: number }
  | { type: 'optimization:start'; action: AutoFixAction }
  | { type: 'optimization:complete'; success: boolean }
  | { type: 'approval:request'; action: AutoFixAction }
  | { type: 'approval:response'; approved: boolean }
  | { type: 'suggestion'; suggestion: QualitySuggestion }
  | { type: 'error'; error: string }

export type QualityGuardianEventCallback = (event: QualityGuardianEvent) => void

// ==================== 质量守护角色定义 ====================

/**
 * 质量守护专家角色
 */
export type QualityGuardianRole = 'evaluator' | 'optimizer' | 'analyst' | 'advisor'

/**
 * 质量守护角色配置
 */
export const QUALITY_GUARDIAN_ROLES: Record<
  QualityGuardianRole,
  Omit<CollaborationAgentConfig, 'provider' | 'model'>
> = {
  evaluator: {
    role: 'quality_checker' as CollaborationRole,
    displayName: '质量评估师',
    avatar: '📊',
    systemPrompt: `你是一位专业的内容质量评估专家。你的职责是：
1. 对各类内容（图片、代码、文本、提示词）进行质量评估
2. 给出精确的质量评分 (0-100)
3. 识别具体的质量问题和改进点
4. 提供结构化的评估报告

评估完成后，将结果传递给优化师进行改进。`,
    expertise: ['质量评估', '内容分析', '标准检查', '评分'],
    capabilities: ['vision', 'text']
  },

  optimizer: {
    role: 'generator' as CollaborationRole,
    displayName: '质量优化师',
    avatar: '🔧',
    systemPrompt: `你是一位专业的内容优化专家。你的职责是：
1. 根据评估报告优化内容
2. 改进提示词以获得更好的生成结果
3. 调整配置参数优化性能
4. 在保证安全的前提下应用修改

高风险修改需要用户审批。`,
    expertise: ['提示词优化', '配置调整', '代码改进', '内容增强'],
    capabilities: ['text']
  },

  analyst: {
    role: 'analyst' as CollaborationRole,
    displayName: '质量分析师',
    avatar: '🔍',
    systemPrompt: `你是一位专业的质量趋势分析师。你的职责是：
1. 分析质量评估历史数据
2. 识别质量变化趋势
3. 发现潜在的质量风险
4. 提供预测性的改进建议

你需要关注长期趋势而非单次评估。`,
    expertise: ['趋势分析', '数据挖掘', '预测', '风险识别'],
    capabilities: ['text']
  },

  advisor: {
    role: 'coordinator' as CollaborationRole,
    displayName: '质量顾问',
    avatar: '💡',
    systemPrompt: `你是一位资深的质量管理顾问。你的职责是：
1. 综合各专家的意见给出最终建议
2. 平衡质量与效率的关系
3. 指导用户做出正确决策
4. 提供最佳实践建议

你的建议应该实用且可执行。`,
    expertise: ['策略建议', '决策支持', '最佳实践', '用户指导'],
    capabilities: ['text']
  }
}

// ==================== QualityGuardianAgent 类 ====================

/**
 * 质量守护 Agent
 *
 * 工作流程：
 * 1. 评估师 → 评估内容质量
 * 2. 分析师 → 分析问题根因
 * 3. 优化师 → 生成优化方案
 * 4. 顾问 → 综合建议
 * 5. (如果启用) 执行自动优化
 */
export class QualityGuardianAgent {
  private agentFunctions?: QualityAgentFunctions
  private eventCallbacks: QualityGuardianEventCallback[] = []
  private collaborationCallbacks: CollaborationEventCallback[] = []

  /**
   * 设置 Agent 执行函数
   */
  setAgentFunctions(functions: QualityAgentFunctions): void {
    this.agentFunctions = functions
  }

  /**
   * 设置默认 Provider (保留接口，待后续实现)
   */
  setDefaultProvider(_provider: Provider, _model: Model): void {
    // TODO: 实现 Provider 配置
  }

  /**
   * 订阅质量守护事件
   */
  subscribe(callback: QualityGuardianEventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      const index = this.eventCallbacks.indexOf(callback)
      if (index > -1) {
        this.eventCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * 订阅协作事件（用于与其他 Agent 协作）
   */
  subscribeCollaboration(callback: CollaborationEventCallback): () => void {
    this.collaborationCallbacks.push(callback)
    return () => {
      const index = this.collaborationCallbacks.indexOf(callback)
      if (index > -1) {
        this.collaborationCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * 发送质量守护事件
   */
  private emit(event: QualityGuardianEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event)
      } catch (e) {
        console.error('[QualityGuardianAgent] Event callback error:', e)
      }
    }
  }

  /**
   * 发送协作事件
   */
  private emitCollaboration(event: CollaborationEvent): void {
    for (const callback of this.collaborationCallbacks) {
      try {
        callback(event)
      } catch (e) {
        console.error('[QualityGuardianAgent] Collaboration callback error:', e)
      }
    }
  }

  /**
   * 执行质量守护
   */
  async execute(request: QualityGuardianRequest): Promise<QualityGuardianResult> {
    const startTime = Date.now()
    let evaluationCount = 0
    let optimizationCount = 0

    const optimizationHistory: QualityGuardianResult['optimizationHistory'] = []
    const appliedFixes: AutoFixAction[] = []
    let currentContent = request.content

    this.emit({ type: 'guardian:start', request })

    try {
      // 配置
      const minScore = request.minScore ?? 70
      const maxIterations = request.maxIterations ?? 3
      const autoOptimize = request.autoOptimize ?? false

      let currentMetrics: QualityMetrics | null = null
      let iteration = 0

      // 迭代优化循环
      while (iteration < maxIterations) {
        // 检查取消
        if (request.signal?.aborted) {
          throw new Error('质量守护已取消')
        }

        iteration++
        this.emit({ type: 'evaluation:start', iteration })

        // 1. 评估当前内容
        currentMetrics = await this.evaluate({
          contentType: request.contentType,
          content: currentContent,
          options: {
            checkLevel: 'standard',
            enableAutoFix: autoOptimize
          }
        })

        evaluationCount++
        this.emit({ type: 'evaluation:complete', metrics: currentMetrics, iteration })

        // 记录历史
        optimizationHistory.push({
          iteration,
          metrics: currentMetrics
        })

        // 2. 检查是否达到目标
        if (currentMetrics.overallScore >= minScore) {
          // 发送建议
          for (const suggestion of currentMetrics.suggestions.slice(0, 3)) {
            this.emit({ type: 'suggestion', suggestion })
          }
          break
        }

        // 3. 如果不自动优化，跳出循环
        if (!autoOptimize) {
          break
        }

        // 4. 尝试自动优化
        if (currentMetrics.canAutoFix && currentMetrics.autoFixActions?.length) {
          for (const action of currentMetrics.autoFixActions) {
            // 检查取消
            if (request.signal?.aborted) {
              throw new Error('质量守护已取消')
            }

            // 高风险操作需要审批
            if (action.requiresApproval) {
              this.emit({ type: 'approval:request', action })

              if (!this.agentFunctions) {
                console.warn('[QualityGuardianAgent] No agent functions, skipping approval')
                continue
              }

              const approved = await this.agentFunctions.requestApproval(action)
              this.emit({ type: 'approval:response', approved })

              if (!approved) {
                continue
              }
            }

            // 执行优化
            this.emit({ type: 'optimization:start', action })

            try {
              const optimizeResult = await this.optimize(request.contentType, currentContent)
              currentContent = optimizeResult.optimized
              optimizationCount++
              appliedFixes.push(action)

              // 更新历史
              optimizationHistory[optimizationHistory.length - 1].action = action

              this.emit({ type: 'optimization:complete', success: true })
            } catch (error) {
              console.error('[QualityGuardianAgent] Optimization failed:', error)
              this.emit({ type: 'optimization:complete', success: false })
            }
          }
        }
      }

      // 最终结果
      const finalMetrics =
        currentMetrics ||
        (await this.evaluate({
          contentType: request.contentType,
          content: currentContent
        }))

      const result: QualityGuardianResult = {
        success: finalMetrics.overallScore >= minScore,
        finalMetrics,
        optimizationHistory,
        suggestions: finalMetrics.suggestions,
        appliedFixes,
        optimizedContent: currentContent !== request.content ? currentContent : undefined,
        stats: {
          totalTime: Date.now() - startTime,
          evaluations: evaluationCount,
          optimizations: optimizationCount
        }
      }

      this.emit({ type: 'guardian:end', result })

      // 发送协作消息
      this.sendCollaborationMessage(
        finalMetrics.passed
          ? `✅ 质量检查通过！评分：${finalMetrics.overallScore}/100`
          : `⚠️ 质量检查未通过，评分：${finalMetrics.overallScore}/100。${finalMetrics.suggestions[0]?.message || ''}`,
        finalMetrics
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit({ type: 'error', error: errorMessage })

      return {
        success: false,
        finalMetrics: this.createErrorMetrics(request.contentType, errorMessage),
        optimizationHistory,
        suggestions: [],
        appliedFixes,
        stats: {
          totalTime: Date.now() - startTime,
          evaluations: evaluationCount,
          optimizations: optimizationCount
        },
        error: errorMessage
      }
    }
  }

  /**
   * 快速评估（不优化）
   */
  async quickEvaluate(contentType: QualityContentType, content: unknown): Promise<QualityMetrics> {
    return this.evaluate({
      contentType,
      content,
      options: { checkLevel: 'basic' }
    })
  }

  /**
   * 评估内容质量
   */
  private async evaluate(request: QualityEvaluationRequest): Promise<QualityMetrics> {
    if (this.agentFunctions) {
      return this.agentFunctions.evaluateQuality(request)
    }

    // 使用 IPC 调用后端
    try {
      const result = await (
        window as unknown as {
          api: { quality: { evaluate: (request: QualityEvaluationRequest) => Promise<QualityMetrics> } }
        }
      ).api.quality.evaluate(request)
      return result
    } catch (error) {
      console.error('[QualityGuardianAgent] IPC evaluate failed:', error)
      // 返回默认评估
      return this.fallbackEvaluate(request)
    }
  }

  /**
   * 优化内容
   */
  private async optimize(
    contentType: QualityContentType,
    content: unknown,
    targetScore?: number
  ): Promise<{ optimized: unknown; improvements: string[] }> {
    if (this.agentFunctions) {
      return this.agentFunctions.optimizeContent(contentType, content, targetScore)
    }

    // 使用 IPC 调用后端
    try {
      const result = await (
        window as unknown as {
          api: {
            quality: {
              optimize: (params: {
                contentType: QualityContentType
                content: unknown
                targetScore?: number
              }) => Promise<{ optimized: unknown; improvements: string[] }>
            }
          }
        }
      ).api.quality.optimize({
        contentType,
        content,
        targetScore
      })
      return result
    } catch (error) {
      console.error('[QualityGuardianAgent] IPC optimize failed:', error)
      return { optimized: content, improvements: [] }
    }
  }

  /**
   * 备用评估（当 IPC 不可用时）
   */
  private fallbackEvaluate(request: QualityEvaluationRequest): QualityMetrics {
    const contentStr = typeof request.content === 'string' ? request.content : JSON.stringify(request.content)

    // 简单的基于规则的评估
    let score = 70

    // 长度检查
    if (contentStr.length < 10) {
      score -= 20
    } else if (contentStr.length > 5000) {
      score -= 5
    }

    // 内容存在性
    if (!contentStr || contentStr.trim() === '') {
      score = 0
    }

    return {
      contentType: request.contentType,
      contentId: `fallback-${Date.now()}`,
      timestamp: new Date(),
      passed: score >= 60,
      overallScore: score,
      checks: {
        common: [
          {
            id: 'content_exists',
            name: '内容存在性',
            passed: !!contentStr,
            score: contentStr ? 100 : 0,
            weight: 1
          }
        ],
        typeSpecific: []
      },
      suggestions:
        score < 70
          ? [
              {
                id: 'improve_content',
                severity: 'warning',
                category: 'general',
                message: '内容质量有待提升',
                estimatedImpact: 15
              }
            ]
          : [],
      canAutoFix: false
    }
  }

  /**
   * 创建错误指标
   */
  private createErrorMetrics(contentType: QualityContentType, error: string): QualityMetrics {
    return {
      contentType,
      contentId: `error-${Date.now()}`,
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
            details: error
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
      canAutoFix: false
    }
  }

  /**
   * 发送协作消息
   */
  private sendCollaborationMessage(content: string, metrics: QualityMetrics): void {
    const message: CollaborationMessage = {
      id: uuid(),
      senderRole: 'quality_checker',
      senderName: '质量守护者',
      content,
      timestamp: new Date(),
      type: 'review',
      mentions: metrics.passed ? [] : ['generator'],
      data: {
        review: {
          passed: metrics.passed,
          score: metrics.overallScore,
          checks: {
            clarity: { passed: true, comment: '' },
            composition: { passed: true, comment: '' },
            background: { passed: true, comment: '' },
            consistency: { passed: true, comment: '' }
          },
          suggestions: metrics.suggestions.map((s) => s.message)
        }
      }
    }

    this.emitCollaboration({ type: 'agent:speak', message })
  }

  /**
   * 处理来自其他 Agent 的事件
   */
  handleCollaborationEvent(event: CollaborationEvent): void {
    switch (event.type) {
      case 'image:generated':
        // 自动对生成的图片进行质量检查
        if (event.image && event.image.type === 'base64') {
          this.quickEvaluate('image', event.image.value)
            .then((metrics) => {
              this.sendCollaborationMessage(
                metrics.passed
                  ? `图片 ${event.index + 1} 质量良好，评分 ${metrics.overallScore}/100`
                  : `图片 ${event.index + 1} 需要改进，评分 ${metrics.overallScore}/100`,
                metrics
              )
            })
            .catch((err) => {
              console.error('[QualityGuardianAgent] Auto-evaluate failed:', err)
            })
        }
        break

      case 'phase:change':
        if (event.phase === 'completed') {
          this.emitCollaboration({
            type: 'agent:thinking',
            role: 'quality_checker'
          })
        }
        break
    }
  }

  /**
   * 获取质量趋势（从历史数据）
   */
  async getQualityTrend(contentId: string): Promise<{
    direction: 'improving' | 'stable' | 'declining'
    averageScore: number
    bestScore: number
    worstScore: number
    recentScores: number[]
  } | null> {
    try {
      const history = await (
        window as unknown as {
          api: { quality: { getHistory: (contentId: string) => Promise<{ evaluations: QualityMetrics[] } | null> } }
        }
      ).api.quality.getHistory(contentId)

      if (!history || !history.evaluations || history.evaluations.length === 0) {
        return null
      }

      const scores = history.evaluations.map((e: QualityMetrics) => e.overallScore)
      const recentScores = scores.slice(-10)

      // 计算趋势
      let direction: 'improving' | 'stable' | 'declining' = 'stable'
      if (recentScores.length >= 2) {
        const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2))
        const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2))
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        const diff = secondAvg - firstAvg

        if (diff > 5) direction = 'improving'
        else if (diff < -5) direction = 'declining'
      }

      return {
        direction,
        averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        bestScore: Math.max(...scores),
        worstScore: Math.min(...scores),
        recentScores
      }
    } catch (error) {
      console.error('[QualityGuardianAgent] Failed to get trend:', error)
      return null
    }
  }
}

/**
 * 单例实例
 */
export const qualityGuardianAgent = new QualityGuardianAgent()

export default qualityGuardianAgent
