/**
 * OptimizationEngine - 自动优化引擎
 *
 * 提供：
 * - 提示词优化
 * - 配置调整
 * - 代码修改建议
 * - 工作流重构
 * - 用户审批流程
 */

import { loggerService } from '@logger'
import { v4 as uuid } from 'uuid'

import { getQualityCore } from './QualityCore'
import type {
  ApprovalRequest,
  AutoFixAction,
  AutoFixChange,
  IOptimizationEngine,
  OptimizationRequest,
  OptimizationResult,
  QualityMetrics
} from './types'

const logger = loggerService.withContext('OptimizationEngine')

/**
 * 待审批操作存储
 */
interface PendingApproval {
  request: ApprovalRequest
  resolve: (approved: boolean) => void
  reject: (error: Error) => void
}

/**
 * OptimizationEngine 单例类
 */
export class OptimizationEngine implements IOptimizationEngine {
  private static instance: OptimizationEngine | null = null

  // 待审批操作
  private pendingApprovals: Map<string, PendingApproval> = new Map()

  // 优化历史
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map()

  // 配置
  private config = {
    maxIterations: 5,
    defaultTargetScore: 80,
    autoApproveThreshold: 90,
    approvalTimeoutMs: 300000 // 5 分钟
  }

  private constructor() {
    logger.info('OptimizationEngine initializing...')
  }

  /**
   * 获取单例实例
   */
  static getInstance(): OptimizationEngine {
    if (!OptimizationEngine.instance) {
      OptimizationEngine.instance = new OptimizationEngine()
    }
    return OptimizationEngine.instance
  }

  /**
   * 执行优化
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResult> {
    const startTime = Date.now()
    const { targetType, target, constraints, options } = request

    logger.info('Starting optimization', {
      targetType,
      style: options?.style || 'moderate',
      maxIterations: constraints?.maxIterations || this.config.maxIterations
    })

    try {
      // 获取初始质量指标
      let initialMetrics = request.metrics
      if (!initialMetrics) {
        const qualityCore = getQualityCore()
        initialMetrics = await qualityCore.evaluate({
          contentType: this.mapTargetTypeToContentType(targetType),
          content: typeof target === 'string' ? target : target,
          options: { checkLevel: 'standard', enableAutoFix: true }
        })
      }

      // 如果已经达到目标分数，直接返回
      const targetScore = constraints?.targetScore || this.config.defaultTargetScore
      if (initialMetrics.overallScore >= targetScore) {
        logger.info('Already at target score', { current: initialMetrics.overallScore, target: targetScore })
        return {
          success: true,
          optimizedContent: target,
          improvements: {
            before: initialMetrics,
            after: initialMetrics,
            scoreImprovement: 0
          },
          changes: [],
          requiresUserApproval: false,
          iterations: 0
        }
      }

      // 执行优化循环
      const maxIterations = constraints?.maxIterations || this.config.maxIterations
      let currentContent = target
      let currentMetrics = initialMetrics
      const allChanges: AutoFixChange[] = []
      let iterations = 0

      for (let i = 0; i < maxIterations; i++) {
        iterations++

        // 生成优化建议
        const optimizationActions = await this.generateOptimizations(
          targetType,
          currentContent,
          currentMetrics,
          options?.style || 'moderate'
        )

        if (optimizationActions.length === 0) {
          logger.info('No more optimizations available')
          break
        }

        // 应用优化
        for (const action of optimizationActions) {
          // 检查是否需要审批
          if (action.requiresApproval && action.riskLevel !== 'low') {
            const approvalRequest: ApprovalRequest = {
              requestId: uuid(),
              operation: action.type,
              description: action.description,
              changes: action.changes,
              riskLevel: action.riskLevel,
              expiresAt: Date.now() + this.config.approvalTimeoutMs
            }

            logger.info('Requesting approval for high-risk operation', {
              requestId: approvalRequest.requestId,
              riskLevel: action.riskLevel
            })

            const approved = await this.requestApproval(approvalRequest)
            if (!approved) {
              logger.info('Operation rejected by user')
              continue
            }
          }

          // 应用变更
          const result = await this.applyOptimization(currentContent, action)
          currentContent = result.content
          allChanges.push(...action.changes)
        }

        // 重新评估
        const qualityCore = getQualityCore()
        currentMetrics = await qualityCore.evaluate({
          contentType: this.mapTargetTypeToContentType(targetType),
          content: typeof currentContent === 'string' ? currentContent : currentContent,
          options: { checkLevel: 'standard', enableAutoFix: true }
        })

        logger.info('Optimization iteration complete', {
          iteration: iterations,
          score: currentMetrics.overallScore,
          target: targetScore
        })

        // 检查是否达到目标
        if (currentMetrics.overallScore >= targetScore) {
          logger.info('Target score reached')
          break
        }
      }

      // 计算改进
      const scoreImprovement = currentMetrics.overallScore - initialMetrics.overallScore

      const result: OptimizationResult = {
        success: currentMetrics.overallScore >= targetScore || scoreImprovement > 0,
        optimizedContent: currentContent,
        improvements: {
          before: initialMetrics,
          after: currentMetrics,
          scoreImprovement
        },
        changes: allChanges,
        requiresUserApproval: false,
        iterations
      }

      // 记录历史
      this.recordOptimization(
        typeof target === 'string'
          ? `content-${Date.now()}`
          : ((target as Record<string, unknown>).id as string) || `content-${Date.now()}`,
        result
      )

      logger.info('Optimization completed', {
        success: result.success,
        scoreImprovement,
        iterations,
        duration: Date.now() - startTime
      })

      return result
    } catch (error) {
      logger.error('Optimization failed', { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        optimizedContent: target,
        improvements: {
          before: request.metrics || this.createEmptyMetrics(),
          after: request.metrics || this.createEmptyMetrics(),
          scoreImprovement: 0
        },
        changes: [],
        requiresUserApproval: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 优化提示词
   */
  async optimizePrompt(
    prompt: string,
    targetType: 'image_generation' | 'text_generation' | 'code_generation',
    context?: Record<string, unknown>
  ): Promise<string> {
    logger.info('Optimizing prompt', { targetType, promptLength: prompt.length })

    try {
      // 分析当前提示词
      const issues = this.analyzePrompt(prompt, targetType)

      if (issues.length === 0) {
        logger.info('Prompt is already well-structured')
        return prompt
      }

      // 应用优化
      let optimizedPrompt = prompt

      for (const issue of issues) {
        optimizedPrompt = this.applyPromptFix(optimizedPrompt, issue, targetType)
      }

      // 添加上下文增强
      if (context) {
        optimizedPrompt = this.enhanceWithContext(optimizedPrompt, context, targetType)
      }

      logger.info('Prompt optimization complete', {
        originalLength: prompt.length,
        optimizedLength: optimizedPrompt.length,
        issuesFixed: issues.length
      })

      return optimizedPrompt
    } catch (error) {
      logger.error('Prompt optimization failed', { error: error instanceof Error ? error.message : String(error) })
      return prompt
    }
  }

  /**
   * 请求用户批准
   */
  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      // 存储待审批请求
      this.pendingApprovals.set(request.requestId, { request, resolve, reject })

      // 设置超时
      setTimeout(() => {
        if (this.pendingApprovals.has(request.requestId)) {
          this.pendingApprovals.delete(request.requestId)
          logger.warn('Approval request timed out', { requestId: request.requestId })
          resolve(false)
        }
      }, this.config.approvalTimeoutMs)

      // TODO: 通过 IPC 发送审批请求到渲染进程
      // 目前返回自动批准（低风险）或拒绝（高风险）
      if (request.riskLevel === 'low') {
        this.pendingApprovals.delete(request.requestId)
        resolve(true)
      }
    })
  }

  /**
   * 处理用户审批响应
   */
  handleApprovalResponse(requestId: string, approved: boolean): void {
    const pending = this.pendingApprovals.get(requestId)
    if (pending) {
      this.pendingApprovals.delete(requestId)
      pending.resolve(approved)
      logger.info('Approval response received', { requestId, approved })
    }
  }

  /**
   * 获取待审批请求
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).map((p) => p.request)
  }

  /**
   * 生成优化建议
   */
  private async generateOptimizations(
    targetType: string,
    content: string | Record<string, unknown>,
    metrics: QualityMetrics,
    style: 'conservative' | 'moderate' | 'aggressive'
  ): Promise<AutoFixAction[]> {
    const actions: AutoFixAction[] = []

    // 基于建议生成优化动作
    for (const suggestion of metrics.suggestions) {
      // 根据风格过滤
      if (style === 'conservative' && suggestion.severity !== 'critical') {
        continue
      }
      if (style === 'moderate' && suggestion.severity === 'info') {
        continue
      }

      const action = this.suggestionToAction(suggestion, targetType, content)
      if (action) {
        actions.push(action)
      }
    }

    // 添加基于检查失败项的优化
    const failedChecks = [
      ...metrics.checks.common.filter((c) => !c.passed),
      ...metrics.checks.typeSpecific.filter((c) => !c.passed)
    ]

    for (const check of failedChecks.slice(0, 3)) {
      const action = this.checkToAction(check, targetType, content)
      if (action) {
        actions.push(action)
      }
    }

    // 如果有现成的 autoFixActions，优先使用
    if (metrics.autoFixActions?.length) {
      // 合并，去重
      for (const existingAction of metrics.autoFixActions) {
        if (!actions.find((a) => a.id === existingAction.id)) {
          actions.push(existingAction)
        }
      }
    }

    return actions.slice(0, 5) // 限制每次最多5个优化
  }

  /**
   * 将建议转换为动作
   */
  private suggestionToAction(
    suggestion: { id: string; severity: string; category: string; message: string; fixDescription?: string },
    targetType: string,
    _content: string | Record<string, unknown>
  ): AutoFixAction | null {
    const actionType = this.mapCategoryToActionType(suggestion.category, targetType)

    return {
      id: `action-${suggestion.id}-${Date.now()}`,
      type: actionType,
      description: suggestion.fixDescription || suggestion.message,
      changes: [], // 具体变更由 applyOptimization 生成
      requiresApproval: suggestion.severity === 'critical',
      riskLevel: suggestion.severity === 'critical' ? 'high' : suggestion.severity === 'warning' ? 'medium' : 'low',
      estimatedImprovement: 10
    }
  }

  /**
   * 将检查项转换为动作
   */
  private checkToAction(
    check: { id: string; name: string; score: number; details?: string },
    _targetType: string,
    _content: string | Record<string, unknown>
  ): AutoFixAction | null {
    if (check.score >= 60) return null

    return {
      id: `fix-${check.id}-${Date.now()}`,
      type: 'prompt_optimization',
      description: `修复 ${check.name}: ${check.details || '需要改进'}`,
      changes: [],
      requiresApproval: check.score < 30,
      riskLevel: check.score < 30 ? 'high' : check.score < 50 ? 'medium' : 'low',
      estimatedImprovement: Math.min(30, 60 - check.score)
    }
  }

  /**
   * 应用优化
   */
  private async applyOptimization(
    content: string | Record<string, unknown>,
    action: AutoFixAction
  ): Promise<{ content: string | Record<string, unknown>; success: boolean }> {
    try {
      switch (action.type) {
        case 'prompt_optimization':
          if (typeof content === 'string') {
            const optimized = await this.optimizePrompt(content, 'text_generation')
            return { content: optimized, success: true }
          }
          break

        case 'config_adjustment':
          if (typeof content === 'object') {
            // 应用配置调整
            const modified = { ...content }
            for (const change of action.changes) {
              if (change.type === 'modify' && change.target) {
                const keys = change.target.split('.')
                let obj: Record<string, unknown> = modified
                for (let i = 0; i < keys.length - 1; i++) {
                  if (obj[keys[i]] === undefined) {
                    obj[keys[i]] = {}
                  }
                  obj = obj[keys[i]] as Record<string, unknown>
                }
                obj[keys[keys.length - 1]] = change.after
              }
            }
            return { content: modified, success: true }
          }
          break

        case 'code_modification':
          // 代码修改需要更复杂的处理
          logger.warn('Code modification not yet implemented')
          break

        case 'workflow_refactor':
          // 工作流重构需要更复杂的处理
          logger.warn('Workflow refactor not yet implemented')
          break
      }

      return { content, success: false }
    } catch (error) {
      logger.error('Failed to apply optimization', { action: action.id, error })
      return { content, success: false }
    }
  }

  /**
   * 分析提示词问题
   */
  private analyzePrompt(
    prompt: string,
    targetType: 'image_generation' | 'text_generation' | 'code_generation'
  ): Array<{ type: string; message: string }> {
    const issues: Array<{ type: string; message: string }> = []

    // 长度检查
    if (prompt.length < 20) {
      issues.push({ type: 'too_short', message: '提示词过短，可能不够具体' })
    }

    // 缺少动作词
    if (!/请|帮|生成|创建|写|画|做|分析|优化|转换/.test(prompt)) {
      issues.push({ type: 'missing_action', message: '缺少明确的动作指令' })
    }

    // 根据目标类型检查
    switch (targetType) {
      case 'image_generation':
        if (!/风格|颜色|背景|构图|光线|角度|细节/.test(prompt)) {
          issues.push({ type: 'missing_visual_details', message: '缺少视觉细节描述' })
        }
        break

      case 'code_generation':
        if (!/语言|函数|类|接口|返回|参数/.test(prompt)) {
          issues.push({ type: 'missing_code_specs', message: '缺少代码规格说明' })
        }
        break

      case 'text_generation':
        if (!/格式|长度|风格|受众|目的/.test(prompt)) {
          issues.push({ type: 'missing_text_requirements', message: '缺少文本需求说明' })
        }
        break
    }

    return issues
  }

  /**
   * 应用提示词修复
   */
  private applyPromptFix(
    prompt: string,
    issue: { type: string; message: string },
    _targetType: 'image_generation' | 'text_generation' | 'code_generation'
  ): string {
    switch (issue.type) {
      case 'too_short':
        // 添加通用增强
        return `${prompt}，请提供详细的结果，包含完整的细节。`

      case 'missing_action':
        return `请${prompt}`

      case 'missing_visual_details':
        return `${prompt}。请注意画面构图和视觉效果。`

      case 'missing_code_specs':
        return `${prompt}。请使用清晰的代码结构和适当的注释。`

      case 'missing_text_requirements':
        return `${prompt}。请确保内容清晰、逻辑连贯。`

      default:
        return prompt
    }
  }

  /**
   * 使用上下文增强提示词
   */
  private enhanceWithContext(
    prompt: string,
    context: Record<string, unknown>,
    _targetType: 'image_generation' | 'text_generation' | 'code_generation'
  ): string {
    const enhancements: string[] = []

    if (context.style && typeof context.style === 'string') {
      enhancements.push(`风格：${context.style}`)
    }

    if (context.audience && typeof context.audience === 'string') {
      enhancements.push(`目标受众：${context.audience}`)
    }

    if (context.constraints && Array.isArray(context.constraints)) {
      enhancements.push(`约束条件：${context.constraints.join('、')}`)
    }

    if (enhancements.length > 0) {
      return `${prompt}\n\n${enhancements.join('\n')}`
    }

    return prompt
  }

  /**
   * 映射目标类型到内容类型
   */
  private mapTargetTypeToContentType(
    targetType: 'prompt' | 'config' | 'code' | 'workflow'
  ): 'prompt' | 'code' | 'text' | 'workflow' {
    switch (targetType) {
      case 'prompt':
        return 'prompt'
      case 'code':
        return 'code'
      case 'workflow':
        return 'workflow'
      default:
        return 'text'
    }
  }

  /**
   * 映射分类到动作类型
   */
  private mapCategoryToActionType(category: string, targetType: string): AutoFixAction['type'] {
    if (category.includes('prompt') || category.includes('提示')) {
      return 'prompt_optimization'
    }
    if (category.includes('config') || category.includes('配置')) {
      return 'config_adjustment'
    }
    if (category.includes('code') || category.includes('代码')) {
      return 'code_modification'
    }
    if (category.includes('workflow') || category.includes('工作流')) {
      return 'workflow_refactor'
    }

    // 默认基于目标类型
    switch (targetType) {
      case 'prompt':
        return 'prompt_optimization'
      case 'code':
        return 'code_modification'
      case 'workflow':
        return 'workflow_refactor'
      default:
        return 'config_adjustment'
    }
  }

  /**
   * 创建空指标
   */
  private createEmptyMetrics(): QualityMetrics {
    return {
      contentType: 'text',
      contentId: `empty-${Date.now()}`,
      timestamp: new Date(),
      passed: false,
      overallScore: 0,
      checks: { common: [], typeSpecific: [] },
      suggestions: [],
      canAutoFix: false
    }
  }

  /**
   * 记录优化历史
   */
  private recordOptimization(contentId: string, result: OptimizationResult): void {
    let history = this.optimizationHistory.get(contentId)
    if (!history) {
      history = []
      this.optimizationHistory.set(contentId, history)
    }

    history.push(result)

    // 限制历史记录数量
    if (history.length > 20) {
      this.optimizationHistory.set(contentId, history.slice(-20))
    }
  }

  /**
   * 获取优化历史
   */
  getOptimizationHistory(contentId: string): OptimizationResult[] {
    return this.optimizationHistory.get(contentId) || []
  }

  /**
   * 获取统计信息
   */
  getStats(): Record<string, unknown> {
    let totalOptimizations = 0
    let totalImprovement = 0
    let successCount = 0

    for (const history of this.optimizationHistory.values()) {
      totalOptimizations += history.length
      for (const result of history) {
        totalImprovement += result.improvements.scoreImprovement
        if (result.success) successCount++
      }
    }

    return {
      totalOptimizations,
      averageImprovement: totalOptimizations > 0 ? totalImprovement / totalOptimizations : 0,
      successRate: totalOptimizations > 0 ? successCount / totalOptimizations : 0,
      pendingApprovals: this.pendingApprovals.size,
      trackedContents: this.optimizationHistory.size
    }
  }
}

/**
 * 获取 OptimizationEngine 单例
 */
export function getOptimizationEngine(): OptimizationEngine {
  return OptimizationEngine.getInstance()
}
