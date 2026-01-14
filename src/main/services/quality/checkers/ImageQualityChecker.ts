/**
 * ImageQualityChecker - 图片质量检查器
 *
 * 使用 AI 视觉能力检查图片质量：
 * - 清晰度
 * - 构图
 * - 背景
 * - 风格一致性
 * - 与提示词的匹配度
 */

import { loggerService } from '@logger'

import type {
  AutoFixAction,
  IQualityChecker,
  QualityCheckItem,
  QualityEvaluationRequest,
  QualityMetrics,
  QualitySuggestion
} from '../types'

const logger = loggerService.withContext('ImageQualityChecker')

/**
 * 图片质量检查器
 */
export class ImageQualityChecker implements IQualityChecker {
  readonly contentType = 'image' as const
  readonly name = 'ImageQualityChecker'

  // 检查项定义
  private readonly checkDefinitions = {
    clarity: { id: 'clarity', name: '清晰度', nameEn: 'Clarity', weight: 2 },
    composition: { id: 'composition', name: '构图', nameEn: 'Composition', weight: 1.5 },
    background: { id: 'background', name: '背景', nameEn: 'Background', weight: 1 },
    lighting: { id: 'lighting', name: '光照', nameEn: 'Lighting', weight: 1 },
    color: { id: 'color', name: '色彩', nameEn: 'Color', weight: 1 },
    style: { id: 'style', name: '风格一致性', nameEn: 'Style Consistency', weight: 1.5 },
    promptMatch: { id: 'promptMatch', name: '提示词匹配', nameEn: 'Prompt Match', weight: 2 },
    artifacts: { id: 'artifacts', name: '瑕疵检测', nameEn: 'Artifacts', weight: 1.5 }
  }

  /**
   * 执行质量检查
   */
  async check(request: QualityEvaluationRequest): Promise<QualityMetrics> {
    const startTime = Date.now()
    const { content, context, options } = request

    logger.info('Starting image quality check', {
      checkLevel: options?.checkLevel || 'standard',
      hasReference: !!context?.referenceContent,
      hasPrompt: !!context?.originalPrompt
    })

    try {
      // 根据检查级别确定要执行的检查项
      const checksToRun = this.getChecksForLevel(options?.checkLevel || 'standard')

      // 执行各项检查
      const commonChecks = await this.runCommonChecks(content, context)
      const typeSpecificChecks = await this.runTypeSpecificChecks(content, context, checksToRun)

      // 合并所有检查项
      const allChecks = [...commonChecks, ...typeSpecificChecks]

      // 计算总分
      const overallScore = this.calculateScore(allChecks)
      const minScore = context?.userPreferences?.minAcceptableScore ?? 70
      const passed = overallScore >= minScore

      // 生成建议
      const suggestions = this.generateSuggestions(allChecks, overallScore)

      // 创建指标对象
      const metrics: QualityMetrics = {
        contentType: 'image',
        contentId: this.generateContentId(content),
        timestamp: new Date(),
        passed,
        overallScore,
        checks: {
          common: commonChecks,
          typeSpecific: typeSpecificChecks
        },
        suggestions,
        canAutoFix: suggestions.some((s) => s.fixDescription),
        duration: Date.now() - startTime,
        metadata: {
          checkLevel: options?.checkLevel || 'standard',
          checksRun: checksToRun
        }
      }

      logger.info('Image quality check completed', {
        score: overallScore,
        passed,
        checksRun: checksToRun.length
      })

      return metrics
    } catch (error) {
      logger.error('Image quality check failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 获取支持的检查项
   */
  getSupportedChecks(): string[] {
    return Object.keys(this.checkDefinitions)
  }

  /**
   * 生成自动修复动作
   */
  async generateAutoFix(metrics: QualityMetrics): Promise<AutoFixAction[]> {
    const actions: AutoFixAction[] = []

    // 分析哪些检查项未通过
    const failedChecks = [...metrics.checks.common, ...metrics.checks.typeSpecific].filter(
      (c) => !c.passed || c.score < 60
    )

    for (const check of failedChecks) {
      const action = this.createAutoFixAction(check)
      if (action) {
        actions.push(action)
      }
    }

    // 如果有提示词匹配问题，添加提示词优化动作
    const promptMatchCheck = metrics.checks.typeSpecific.find((c) => c.id === 'promptMatch')
    if (promptMatchCheck && promptMatchCheck.score < 70) {
      actions.push({
        id: `fix-prompt-${Date.now()}`,
        type: 'prompt_optimization',
        description: '优化提示词以提高图片匹配度',
        changes: [],
        requiresApproval: false,
        riskLevel: 'low',
        estimatedImprovement: 15
      })
    }

    return actions
  }

  /**
   * 根据检查级别获取要执行的检查项
   */
  private getChecksForLevel(level: string): string[] {
    switch (level) {
      case 'basic':
        return ['clarity', 'composition']
      case 'thorough':
        return Object.keys(this.checkDefinitions)
      case 'standard':
      default:
        return ['clarity', 'composition', 'background', 'lighting', 'promptMatch']
    }
  }

  /**
   * 运行通用检查
   */
  private async runCommonChecks(
    content: unknown,
    _context?: QualityEvaluationRequest['context']
  ): Promise<QualityCheckItem[]> {
    const checks: QualityCheckItem[] = []

    // 检查内容是否存在
    const contentExists = content !== null && content !== undefined
    checks.push({
      id: 'content_exists',
      name: '内容存在性',
      passed: contentExists,
      score: contentExists ? 100 : 0,
      weight: 1,
      details: contentExists ? '图片内容存在' : '图片内容为空'
    })

    // 检查格式
    if (typeof content === 'string') {
      const isValidFormat =
        content.startsWith('data:image') ||
        /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(content) ||
        content.startsWith('http')

      checks.push({
        id: 'format_valid',
        name: '格式有效性',
        passed: isValidFormat,
        score: isValidFormat ? 100 : 0,
        weight: 1,
        details: isValidFormat ? '图片格式有效' : '图片格式无效或无法识别'
      })
    }

    return checks
  }

  /**
   * 运行类型特定检查
   */
  private async runTypeSpecificChecks(
    content: unknown,
    context: QualityEvaluationRequest['context'] | undefined,
    checksToRun: string[]
  ): Promise<QualityCheckItem[]> {
    const checks: QualityCheckItem[] = []

    // TODO: 使用 AI 视觉模型进行实际检查
    // 目前使用模拟数据
    for (const checkId of checksToRun) {
      const checkDef = this.checkDefinitions[checkId as keyof typeof this.checkDefinitions]
      if (!checkDef) continue

      // 模拟检查结果（实际实现需要调用 AI 视觉模型）
      const score = this.simulateCheckScore(checkId, content, context)
      const passed = score >= 60

      checks.push({
        id: checkDef.id,
        name: checkDef.name,
        nameEn: checkDef.nameEn,
        passed,
        score,
        weight: checkDef.weight,
        details: this.generateCheckDetails(checkId, score, passed),
        category: 'image'
      })
    }

    return checks
  }

  /**
   * 模拟检查分数（实际实现需要 AI）
   */
  private simulateCheckScore(
    _checkId: string,
    _content: unknown,
    _context?: QualityEvaluationRequest['context']
  ): number {
    // 这里应该调用 AI 视觉模型
    // 目前返回随机分数用于测试
    const baseScore = 70
    const variance = 20
    return Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * variance * 2) - variance))
  }

  /**
   * 生成检查详情
   */
  private generateCheckDetails(checkId: string, score: number, _passed: boolean): string {
    const qualityLevel = score >= 90 ? '优秀' : score >= 70 ? '良好' : score >= 50 ? '一般' : '较差'

    const details: Record<string, string> = {
      clarity: `图片清晰度${qualityLevel}，评分 ${score}/100`,
      composition: `构图${qualityLevel}，评分 ${score}/100`,
      background: `背景处理${qualityLevel}，评分 ${score}/100`,
      lighting: `光照效果${qualityLevel}，评分 ${score}/100`,
      color: `色彩表现${qualityLevel}，评分 ${score}/100`,
      style: `风格一致性${qualityLevel}，评分 ${score}/100`,
      promptMatch: `与提示词匹配度${qualityLevel}，评分 ${score}/100`,
      artifacts: `瑕疵检测${score >= 70 ? '通过' : '发现瑕疵'}，评分 ${score}/100`
    }

    return details[checkId] || `检查项 ${checkId} 评分 ${score}/100`
  }

  /**
   * 计算总分
   */
  private calculateScore(checks: QualityCheckItem[]): number {
    if (checks.length === 0) return 0

    const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0)
    if (totalWeight === 0) return 0

    const weightedSum = checks.reduce((sum, check) => sum + check.score * check.weight, 0)
    return Math.round(weightedSum / totalWeight)
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(checks: QualityCheckItem[], overallScore: number): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = []

    // 找出低分项
    const lowScoreChecks = checks.filter((c) => c.score < 70).sort((a, b) => a.score - b.score)

    for (const check of lowScoreChecks.slice(0, 3)) {
      // 最多 3 条建议
      suggestions.push(this.createSuggestion(check))
    }

    // 如果总分较低，添加通用建议
    if (overallScore < 60) {
      suggestions.push({
        id: 'overall_improvement',
        severity: 'warning',
        category: 'general',
        message: '建议重新生成图片，当前质量较低',
        fixDescription: '优化提示词后重新生成',
        estimatedImpact: 20
      })
    }

    return suggestions
  }

  /**
   * 创建单条建议
   */
  private createSuggestion(check: QualityCheckItem): QualitySuggestion {
    const suggestionMap: Record<string, Partial<QualitySuggestion>> = {
      clarity: {
        category: 'clarity',
        message: '图片清晰度不足，建议增加分辨率或减少模糊',
        fixDescription: '在提示词中添加 "high resolution, sharp details"'
      },
      composition: {
        category: 'composition',
        message: '构图需要改进，主体位置或比例不够理想',
        fixDescription: '调整提示词中的构图描述'
      },
      background: {
        category: 'background',
        message: '背景处理不够干净或与主体不协调',
        fixDescription: '添加背景描述，如 "clean background, simple backdrop"'
      },
      lighting: {
        category: 'lighting',
        message: '光照效果需要优化',
        fixDescription: '添加光照描述，如 "soft lighting, natural light"'
      },
      promptMatch: {
        category: 'relevance',
        message: '生成内容与提示词匹配度较低',
        fixDescription: '优化提示词，使描述更具体明确'
      }
    }

    const suggestion = suggestionMap[check.id] || {
      category: 'general',
      message: `${check.name}需要改进`
    }

    return {
      id: `suggestion-${check.id}-${Date.now()}`,
      severity: check.score < 40 ? 'critical' : check.score < 60 ? 'warning' : 'info',
      category: suggestion.category || 'general',
      message: suggestion.message || `${check.name}评分较低`,
      fixDescription: suggestion.fixDescription,
      estimatedImpact: Math.round((70 - check.score) * 0.5)
    }
  }

  /**
   * 创建自动修复动作
   */
  private createAutoFixAction(check: QualityCheckItem): AutoFixAction | null {
    // 只为特定检查项创建修复动作
    const fixableChecks = ['clarity', 'background', 'lighting', 'promptMatch']
    if (!fixableChecks.includes(check.id)) return null

    return {
      id: `fix-${check.id}-${Date.now()}`,
      type: 'prompt_optimization',
      description: `修复 ${check.name} 问题`,
      changes: [],
      requiresApproval: false,
      riskLevel: 'low',
      estimatedImprovement: Math.round((70 - check.score) * 0.5)
    }
  }

  /**
   * 生成内容 ID
   */
  private generateContentId(content: unknown): string {
    if (typeof content === 'string') {
      // 使用内容开头作为标识
      const prefix = content.substring(0, 32)
      return `img-${this.simpleHash(prefix)}`
    }
    return `img-${Date.now()}`
  }

  /**
   * 简单哈希
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).substring(0, 8)
  }
}
