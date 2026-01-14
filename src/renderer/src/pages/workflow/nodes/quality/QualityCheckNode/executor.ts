/**
 * 质量检查节点执行器
 *
 * 通过 IPC 调用主进程的 QualityCore 进行质量评估
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface QualityCheckConfig {
  contentType: 'auto' | 'image' | 'code' | 'text' | 'prompt' | 'workflow'
  checkLevel: 'basic' | 'standard' | 'thorough'
  minScore: number
  enableAutoFix: boolean
  outputFormat: 'markdown' | 'text' | 'json'
  focusAreas?: string
}

/**
 * 质量检查节点执行器
 */
export class QualityCheckExecutor extends BaseNodeExecutor {
  constructor() {
    super('quality_check')
  }

  async execute(
    inputs: Record<string, any>,
    config: QualityCheckConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始质量检查')

      // 获取输入内容
      const content = inputs.content
      if (!content) {
        return this.error('缺少必需的输入内容', Date.now() - startTime)
      }

      // 自动检测内容类型
      const contentType = config.contentType === 'auto' ? this.detectContentType(content) : config.contentType

      this.log(context, `检测到内容类型: ${contentType}`)

      // 构建评估请求
      const evaluationRequest = {
        contentType,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        context: {
          originalPrompt: inputs.prompt,
          referenceContent: inputs.reference,
          userPreferences: {
            minAcceptableScore: config.minScore,
            focusAreas: config.focusAreas
              ?.split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          }
        },
        options: {
          checkLevel: config.checkLevel,
          enableAutoFix: config.enableAutoFix
        }
      }

      // 通过 IPC 调用主进程的 QualityCore
      const result = await window.api.quality.evaluate(evaluationRequest)

      if (!result.success) {
        return this.error(result.error || '质量评估失败', Date.now() - startTime)
      }

      const metrics = result.metrics!

      // 生成报告
      const report = this.formatReport(metrics, config.outputFormat)

      this.log(context, `质量评估完成: ${metrics.overallScore}/100 (${metrics.passed ? '通过' : '未通过'})`)

      return this.success(
        {
          passed: metrics.passed,
          score: metrics.overallScore,
          report,
          metrics,
          suggestions: metrics.suggestions,
          content_out: content
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '质量检查失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 自动检测内容类型
   */
  private detectContentType(content: any): 'image' | 'code' | 'text' | 'prompt' | 'workflow' {
    if (typeof content === 'string') {
      // 图片检测
      if (content.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(content)) {
        return 'image'
      }

      // 代码检测
      if (
        /^(import |from |export |function |class |const |let |var |def |public |private )/.test(content) ||
        (/\{[\s\S]*\}/.test(content) && (content.includes('=>') || content.includes('function')))
      ) {
        return 'code'
      }

      // 提示词检测（较短且包含动作词）
      if (content.length < 500 && /请|帮|生成|创建|写|画|做|分析|优化/.test(content)) {
        return 'prompt'
      }

      // 默认文本
      return 'text'
    }

    // JSON 对象
    if (typeof content === 'object') {
      // 检查是否是工作流定义
      if (content.nodes && content.edges) {
        return 'workflow'
      }
      return 'text'
    }

    return 'text'
  }

  /**
   * 格式化质量报告
   */
  private formatReport(metrics: any, format: 'markdown' | 'text' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2)
    }

    const statusIcon = metrics.passed ? '✅' : '❌'
    const trendIcon =
      metrics.improvementTrend === 'improving' ? '📈' : metrics.improvementTrend === 'declining' ? '📉' : '➡️'

    if (format === 'text') {
      let text = `质量评估报告 ${statusIcon}\n\n`
      text += `内容类型: ${metrics.contentType}\n`
      text += `总体评分: ${metrics.overallScore}/100 ${trendIcon}\n`
      text += `状态: ${metrics.passed ? '通过' : '未通过'}\n\n`

      text += '检查项:\n'
      for (const check of [...metrics.checks.common, ...metrics.checks.typeSpecific]) {
        text += `  ${check.passed ? '✓' : '✗'} ${check.name}: ${check.score}/100\n`
      }

      if (metrics.suggestions?.length > 0) {
        text += '\n改进建议:\n'
        for (const s of metrics.suggestions) {
          text += `  - ${s.message}\n`
        }
      }

      return text
    }

    // Markdown 格式
    let md = `## 质量评估报告 ${statusIcon}\n\n`
    md += `**内容类型**: ${metrics.contentType}\n`
    md += `**总体评分**: ${metrics.overallScore}/100 ${trendIcon}\n`
    md += `**状态**: ${metrics.passed ? '通过' : '未通过'}\n`
    md += `**评估时长**: ${metrics.duration}ms\n\n`

    md += '### 检查项详情\n\n'
    md += '#### 通用检查\n'
    for (const c of metrics.checks.common) {
      md += `- ${c.passed ? '✅' : '❌'} ${c.name}: ${c.score}/100 - ${c.details}\n`
    }

    md += '\n#### 类型特定检查\n'
    for (const c of metrics.checks.typeSpecific) {
      md += `- ${c.passed ? '✅' : '❌'} ${c.name}: ${c.score}/100 - ${c.details}\n`
    }

    if (metrics.suggestions?.length > 0) {
      md += '\n### 改进建议\n'
      for (const s of metrics.suggestions) {
        const icon = s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : '🔵'
        md += `- ${icon} ${s.message}\n`
      }
    }

    if (metrics.autoFixActions?.length > 0) {
      md += '\n### 可用的自动修复\n'
      for (const a of metrics.autoFixActions) {
        md += `- **${a.id}**: ${a.description} (${a.riskLevel}风险)\n`
      }
    }

    return md
  }
}

export default QualityCheckExecutor
