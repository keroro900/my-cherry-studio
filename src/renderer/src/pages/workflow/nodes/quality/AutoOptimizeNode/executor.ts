/**
 * 自动优化节点执行器
 *
 * 通过 IPC 调用主进程的 OptimizationEngine 进行内容优化
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface AutoOptimizeConfig {
  targetType: 'prompt' | 'config' | 'code' | 'workflow'
  style: 'conservative' | 'moderate' | 'aggressive'
  targetScore: number
  maxIterations: number
  preserveSemantics: boolean
  requireApproval: boolean
  // AI 模型配置
  providerId?: string
  modelId?: string
}

/**
 * 自动优化节点执行器
 */
export class AutoOptimizeExecutor extends BaseNodeExecutor {
  constructor() {
    super('auto_optimize')
  }

  async execute(
    inputs: Record<string, any>,
    config: AutoOptimizeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始自动优化')

      // 获取原始内容
      const content = inputs.content
      if (!content) {
        return this.error('缺少必需的原始内容', Date.now() - startTime)
      }

      // 获取质量指标（如果有）
      const existingMetrics = inputs.metrics

      // 构建优化请求
      const optimizeRequest = {
        targetType: config.targetType,
        target: typeof content === 'string' ? content : JSON.stringify(content),
        metrics: existingMetrics,
        constraints: {
          maxIterations: config.maxIterations,
          targetScore: config.targetScore,
          preserveSemantics: config.preserveSemantics
        },
        options: {
          style: config.style,
          modelId: config.modelId,
          providerId: config.providerId
        },
        context: inputs.context
      }

      this.log(context, `优化目标类型: ${config.targetType}, 风格: ${config.style}`)

      // 通过 IPC 调用主进程的 OptimizationEngine
      const result = await window.api.quality.optimize(optimizeRequest)

      if (!result.success) {
        return this.error(result.error || '优化失败', Date.now() - startTime)
      }

      const improvements = result.improvements!
      const beforeScore = improvements.before.overallScore
      const afterScore = improvements.after.overallScore
      const improved = afterScore > beforeScore

      // 检查是否需要用户确认
      if (config.requireApproval && result.requiresUserApproval) {
        this.log(context, '优化需要用户确认')
        // 在实际实现中，这里会触发用户确认 UI
        // 目前直接继续执行
      }

      // 生成优化报告
      const report = this.formatOptimizeReport(result, config)

      this.log(context, `优化完成: ${beforeScore} -> ${afterScore} (${improved ? '+' : ''}${afterScore - beforeScore})`)

      return this.success(
        {
          optimized: result.optimizedContent,
          improved,
          before_score: beforeScore,
          after_score: afterScore,
          changes: result.changes,
          report
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '自动优化失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 格式化优化报告
   */
  private formatOptimizeReport(result: any, config: AutoOptimizeConfig): string {
    const improvements = result.improvements
    const beforeScore = improvements.before.overallScore
    const afterScore = improvements.after.overallScore
    const scoreDiff = afterScore - beforeScore

    let report = `## 自动优化报告\n\n`
    report += `**目标类型**: ${config.targetType}\n`
    report += `**优化风格**: ${config.style}\n`
    report += `**迭代次数**: ${result.iterations || 1}\n\n`

    report += `### 质量变化\n`
    report += `- 优化前: ${beforeScore}/100\n`
    report += `- 优化后: ${afterScore}/100\n`
    report += `- 变化: ${scoreDiff >= 0 ? '+' : ''}${scoreDiff}\n\n`

    if (result.changes?.length > 0) {
      report += `### 变更详情\n`
      for (const change of result.changes) {
        report += `- **${change.type}**: ${change.description || change.target}\n`
        if (change.before && change.after) {
          report += `  - 前: \`${String(change.before).substring(0, 50)}...\`\n`
          report += `  - 后: \`${String(change.after).substring(0, 50)}...\`\n`
        }
      }
    }

    if (result.requiresUserApproval) {
      report += `\n> ⚠️ 此优化包含高风险修改，建议人工审核后应用。\n`
    }

    return report
  }
}

export default AutoOptimizeExecutor
