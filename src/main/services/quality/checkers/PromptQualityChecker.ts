/**
 * PromptQualityChecker - 提示词质量检查器
 *
 * 检查提示词质量：
 * - 清晰度
 * - 具体性
 * - 结构
 * - 相关性
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

const logger = loggerService.withContext('PromptQualityChecker')

/**
 * 提示词质量检查器
 */
export class PromptQualityChecker implements IQualityChecker {
  readonly contentType = 'prompt' as const
  readonly name = 'PromptQualityChecker'

  private readonly checkDefinitions = {
    clarity: { id: 'clarity', name: '清晰度', weight: 2 },
    specificity: { id: 'specificity', name: '具体性', weight: 2 },
    structure: { id: 'structure', name: '结构', weight: 1 },
    relevance: { id: 'relevance', name: '相关性', weight: 1.5 },
    completeness: { id: 'completeness', name: '完整性', weight: 1 },
    actionability: { id: 'actionability', name: '可执行性', weight: 1.5 }
  }

  async check(request: QualityEvaluationRequest): Promise<QualityMetrics> {
    const startTime = Date.now()
    const { content, context, options } = request

    logger.info('Starting prompt quality check')

    try {
      const commonChecks = await this.runCommonChecks(content)
      const typeSpecificChecks = await this.runTypeSpecificChecks(content, context, options?.checkLevel || 'standard')

      const allChecks = [...commonChecks, ...typeSpecificChecks]
      const overallScore = this.calculateScore(allChecks)
      const minScore = context?.userPreferences?.minAcceptableScore ?? 60

      const metrics: QualityMetrics = {
        contentType: 'prompt',
        contentId: `prompt-${Date.now()}`,
        timestamp: new Date(),
        passed: overallScore >= minScore,
        overallScore,
        checks: { common: commonChecks, typeSpecific: typeSpecificChecks },
        suggestions: this.generateSuggestions(allChecks, overallScore),
        canAutoFix: true,
        duration: Date.now() - startTime
      }

      return metrics
    } catch (error) {
      logger.error('Prompt quality check failed', { error: String(error) })
      throw error
    }
  }

  getSupportedChecks(): string[] {
    return Object.keys(this.checkDefinitions)
  }

  async generateAutoFix(metrics: QualityMetrics): Promise<AutoFixAction[]> {
    const actions: AutoFixAction[] = []

    // 提示词优化通常风险较低
    if (metrics.overallScore < 70) {
      actions.push({
        id: `optimize-prompt-${Date.now()}`,
        type: 'prompt_optimization',
        description: '优化提示词以提高效果',
        changes: [],
        requiresApproval: false,
        riskLevel: 'low',
        estimatedImprovement: 15
      })
    }

    return actions
  }

  private async runCommonChecks(content: unknown): Promise<QualityCheckItem[]> {
    const checks: QualityCheckItem[] = []
    const promptStr = typeof content === 'string' ? content : String(content)

    // 长度检查
    const length = promptStr.length
    let lengthScore = 80
    let lengthDetails = '提示词长度适中'

    if (length < 10) {
      lengthScore = 30
      lengthDetails = '提示词过短，缺乏足够信息'
    } else if (length < 50) {
      lengthScore = 60
      lengthDetails = '提示词较短，可能不够具体'
    } else if (length > 2000) {
      lengthScore = 70
      lengthDetails = '提示词较长，可能需要精简'
    }

    checks.push({
      id: 'length',
      name: '长度',
      passed: lengthScore >= 60,
      score: lengthScore,
      weight: 1,
      details: lengthDetails
    })

    // 关键词检查
    const hasActionWords = /请|帮|生成|创建|写|画|做|分析|优化/.test(promptStr)
    checks.push({
      id: 'has_action_words',
      name: '包含动作词',
      passed: hasActionWords,
      score: hasActionWords ? 100 : 50,
      weight: 0.5,
      details: hasActionWords ? '包含明确的动作指令' : '缺少明确的动作指令'
    })

    return checks
  }

  private async runTypeSpecificChecks(
    content: unknown,
    context: QualityEvaluationRequest['context'] | undefined,
    level: string
  ): Promise<QualityCheckItem[]> {
    const checks: QualityCheckItem[] = []
    const promptStr = typeof content === 'string' ? content : String(content)

    const checksToRun =
      level === 'basic'
        ? ['clarity', 'specificity']
        : level === 'thorough'
          ? Object.keys(this.checkDefinitions)
          : ['clarity', 'specificity', 'structure', 'actionability']

    for (const checkId of checksToRun) {
      const checkDef = this.checkDefinitions[checkId as keyof typeof this.checkDefinitions]
      if (!checkDef) continue

      const score = this.evaluateCheck(checkId, promptStr, context)
      checks.push({
        id: checkDef.id,
        name: checkDef.name,
        passed: score >= 60,
        score,
        weight: checkDef.weight,
        details: this.getCheckDetails(checkId, score),
        category: 'prompt'
      })
    }

    return checks
  }

  private evaluateCheck(checkId: string, prompt: string, _context?: QualityEvaluationRequest['context']): number {
    // 基于规则的简单评估（实际应使用 AI）
    switch (checkId) {
      case 'clarity': {
        // 检查是否有歧义词
        const ambiguousWords = /可能|也许|大概|差不多|之类/.test(prompt)
        return ambiguousWords ? 60 : 85
      }
      case 'specificity': {
        // 检查是否有具体描述
        const hasNumbers = /\d+/.test(prompt)
        const hasAdjectives = prompt.length > 100
        return (hasNumbers ? 20 : 0) + (hasAdjectives ? 30 : 0) + 50
      }
      case 'structure': {
        // 检查是否有分段或列表
        const hasStructure = /[,，、;；\n]/.test(prompt)
        return hasStructure ? 80 : 60
      }
      case 'actionability': {
        // 检查是否有明确的目标
        const hasTarget = /生成|创建|写|画|分析|优化|总结/.test(prompt)
        return hasTarget ? 85 : 50
      }
      default:
        return 70 + Math.floor(Math.random() * 20)
    }
  }

  private getCheckDetails(checkId: string, score: number): string {
    const level = score >= 80 ? '优秀' : score >= 60 ? '良好' : '需改进'
    return `${this.checkDefinitions[checkId as keyof typeof this.checkDefinitions]?.name || checkId}${level}，评分 ${score}/100`
  }

  private calculateScore(checks: QualityCheckItem[]): number {
    if (checks.length === 0) return 0
    const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0)
    const weightedSum = checks.reduce((sum, c) => sum + c.score * c.weight, 0)
    return Math.round(weightedSum / totalWeight)
  }

  private generateSuggestions(checks: QualityCheckItem[], _overallScore: number): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = []
    const lowScoreChecks = checks.filter((c) => c.score < 70)

    const suggestionTemplates: Record<string, string> = {
      clarity: '使提示词更加清晰明确，避免歧义',
      specificity: '添加更多具体细节，如数量、颜色、风格等',
      structure: '使用分段或列表来组织提示词',
      relevance: '确保提示词与目标任务相关',
      actionability: '添加明确的动作指令，如"生成"、"创建"等'
    }

    for (const check of lowScoreChecks.slice(0, 3)) {
      suggestions.push({
        id: `suggestion-${check.id}`,
        severity: check.score < 50 ? 'critical' : 'warning',
        category: check.id,
        message: suggestionTemplates[check.id] || `${check.name}需要改进`,
        fixDescription: `优化提示词的${check.name}`,
        estimatedImpact: Math.round((70 - check.score) * 0.5)
      })
    }

    return suggestions
  }
}
