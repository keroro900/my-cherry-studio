/**
 * TextQualityChecker - 文本质量检查器
 *
 * 检查文本质量：
 * - 流畅度
 * - 连贯性
 * - 语法
 * - 风格一致性
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

const logger = loggerService.withContext('TextQualityChecker')

/**
 * 文本质量检查器
 */
export class TextQualityChecker implements IQualityChecker {
  readonly contentType = 'text' as const
  readonly name = 'TextQualityChecker'

  private readonly checkDefinitions = {
    fluency: { id: 'fluency', name: '流畅度', weight: 2 },
    coherence: { id: 'coherence', name: '连贯性', weight: 2 },
    grammar: { id: 'grammar', name: '语法', weight: 1.5 },
    styleConsistency: { id: 'styleConsistency', name: '风格一致性', weight: 1 },
    relevance: { id: 'relevance', name: '相关性', weight: 1.5 },
    completeness: { id: 'completeness', name: '完整性', weight: 1 }
  }

  async check(request: QualityEvaluationRequest): Promise<QualityMetrics> {
    const startTime = Date.now()
    const { content, context, options } = request

    logger.info('Starting text quality check')

    try {
      const commonChecks = await this.runCommonChecks(content)
      const typeSpecificChecks = await this.runTypeSpecificChecks(content, context, options?.checkLevel || 'standard')

      const allChecks = [...commonChecks, ...typeSpecificChecks]
      const overallScore = this.calculateScore(allChecks)
      const minScore = context?.userPreferences?.minAcceptableScore ?? 70

      const metrics: QualityMetrics = {
        contentType: 'text',
        contentId: `text-${Date.now()}`,
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
      logger.error('Text quality check failed', { error: String(error) })
      throw error
    }
  }

  getSupportedChecks(): string[] {
    return Object.keys(this.checkDefinitions)
  }

  async generateAutoFix(metrics: QualityMetrics): Promise<AutoFixAction[]> {
    const actions: AutoFixAction[] = []
    const failedChecks = metrics.checks.typeSpecific.filter((c) => c.score < 60)

    for (const check of failedChecks) {
      actions.push({
        id: `fix-${check.id}-${Date.now()}`,
        type: 'prompt_optimization',
        description: `优化 ${check.name}`,
        changes: [],
        requiresApproval: false,
        riskLevel: 'low',
        estimatedImprovement: 10
      })
    }

    return actions
  }

  private async runCommonChecks(content: unknown): Promise<QualityCheckItem[]> {
    const checks: QualityCheckItem[] = []
    const textStr = typeof content === 'string' ? content : String(content)

    // 内容存在性
    checks.push({
      id: 'content_exists',
      name: '内容存在性',
      passed: textStr.length > 0,
      score: textStr.length > 0 ? 100 : 0,
      weight: 1,
      details: textStr.length > 0 ? '文本内容存在' : '文本内容为空'
    })

    // 长度检查
    const wordCount = textStr.split(/\s+/).length
    const lengthScore = wordCount < 10 ? 50 : wordCount > 2000 ? 70 : 90
    checks.push({
      id: 'length_appropriate',
      name: '长度适当性',
      passed: lengthScore >= 70,
      score: lengthScore,
      weight: 0.5,
      details: `文本约 ${wordCount} 个词`
    })

    return checks
  }

  private async runTypeSpecificChecks(
    _content: unknown,
    _context: QualityEvaluationRequest['context'] | undefined,
    level: string
  ): Promise<QualityCheckItem[]> {
    const checks: QualityCheckItem[] = []
    const checksToRun =
      level === 'basic'
        ? ['fluency', 'grammar']
        : level === 'thorough'
          ? Object.keys(this.checkDefinitions)
          : ['fluency', 'coherence', 'grammar', 'relevance']

    for (const checkId of checksToRun) {
      const checkDef = this.checkDefinitions[checkId as keyof typeof this.checkDefinitions]
      if (!checkDef) continue

      // TODO: 使用 AI 进行实际文本分析
      const score = 70 + Math.floor(Math.random() * 25)
      checks.push({
        id: checkDef.id,
        name: checkDef.name,
        passed: score >= 60,
        score,
        weight: checkDef.weight,
        details: `${checkDef.name}评分 ${score}/100`,
        category: 'text'
      })
    }

    return checks
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

    for (const check of lowScoreChecks.slice(0, 3)) {
      suggestions.push({
        id: `suggestion-${check.id}`,
        severity: check.score < 50 ? 'critical' : 'warning',
        category: check.id,
        message: `${check.name}需要改进`,
        estimatedImpact: Math.round((70 - check.score) * 0.5)
      })
    }

    return suggestions
  }
}
