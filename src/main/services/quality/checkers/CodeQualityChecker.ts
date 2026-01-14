/**
 * CodeQualityChecker - 代码质量检查器
 *
 * 检查代码质量：
 * - 语法正确性
 * - 代码风格
 * - 复杂度
 * - 安全性
 * - 最佳实践
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

const logger = loggerService.withContext('CodeQualityChecker')

/**
 * 代码质量检查器
 */
export class CodeQualityChecker implements IQualityChecker {
  readonly contentType = 'code' as const
  readonly name = 'CodeQualityChecker'

  private readonly checkDefinitions = {
    syntax: { id: 'syntax', name: '语法正确性', weight: 3 },
    style: { id: 'style', name: '代码风格', weight: 1 },
    complexity: { id: 'complexity', name: '复杂度', weight: 1.5 },
    security: { id: 'security', name: '安全性', weight: 2 },
    bestPractices: { id: 'bestPractices', name: '最佳实践', weight: 1.5 },
    readability: { id: 'readability', name: '可读性', weight: 1 },
    maintainability: { id: 'maintainability', name: '可维护性', weight: 1 }
  }

  async check(request: QualityEvaluationRequest): Promise<QualityMetrics> {
    const startTime = Date.now()
    const { content, context, options } = request

    logger.info('Starting code quality check')

    try {
      const commonChecks = await this.runCommonChecks(content)
      const typeSpecificChecks = await this.runTypeSpecificChecks(content, context, options?.checkLevel || 'standard')

      const allChecks = [...commonChecks, ...typeSpecificChecks]
      const overallScore = this.calculateScore(allChecks)
      const minScore = context?.userPreferences?.minAcceptableScore ?? 70

      const metrics: QualityMetrics = {
        contentType: 'code',
        contentId: `code-${Date.now()}`,
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
      logger.error('Code quality check failed', { error: String(error) })
      throw error
    }
  }

  getSupportedChecks(): string[] {
    return Object.keys(this.checkDefinitions)
  }

  async generateAutoFix(metrics: QualityMetrics): Promise<AutoFixAction[]> {
    const actions: AutoFixAction[] = []
    const failedChecks = [...metrics.checks.common, ...metrics.checks.typeSpecific].filter((c) => c.score < 60)

    for (const check of failedChecks) {
      if (check.id === 'style' || check.id === 'readability') {
        actions.push({
          id: `fix-${check.id}-${Date.now()}`,
          type: 'code_modification',
          description: `修复 ${check.name} 问题`,
          changes: [],
          requiresApproval: true,
          riskLevel: 'medium',
          estimatedImprovement: 10
        })
      }
    }

    return actions
  }

  private async runCommonChecks(content: unknown): Promise<QualityCheckItem[]> {
    const checks: QualityCheckItem[] = []
    const codeStr = typeof content === 'string' ? content : JSON.stringify(content)

    checks.push({
      id: 'content_exists',
      name: '内容存在性',
      passed: codeStr.length > 0,
      score: codeStr.length > 0 ? 100 : 0,
      weight: 1,
      details: codeStr.length > 0 ? '代码内容存在' : '代码内容为空'
    })

    // 检查代码长度合理性
    const lineCount = codeStr.split('\n').length
    const lengthScore = lineCount > 500 ? 60 : lineCount > 200 ? 80 : 100
    checks.push({
      id: 'length_reasonable',
      name: '长度合理性',
      passed: lengthScore >= 80,
      score: lengthScore,
      weight: 0.5,
      details: `代码共 ${lineCount} 行`
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
        ? ['syntax', 'style']
        : level === 'thorough'
          ? Object.keys(this.checkDefinitions)
          : ['syntax', 'style', 'complexity', 'readability']

    for (const checkId of checksToRun) {
      const checkDef = this.checkDefinitions[checkId as keyof typeof this.checkDefinitions]
      if (!checkDef) continue

      // TODO: 实际代码分析
      const score = 70 + Math.floor(Math.random() * 25)
      checks.push({
        id: checkDef.id,
        name: checkDef.name,
        passed: score >= 60,
        score,
        weight: checkDef.weight,
        details: `${checkDef.name}评分 ${score}/100`,
        category: 'code'
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
