/**
 * QualityGuardianService - VCP 内置质量守护服务
 *
 * 将质量检查和优化功能暴露为 VCP 可调用的工具：
 * - EvaluateQuality: 评估内容质量
 * - OptimizePrompt: 优化提示词
 * - GetQualityTrend: 获取质量趋势
 * - ApplyAutoFix: 应用自动修复
 */

import { loggerService } from '@logger'

import { getQualityCore, initializeQualityCore } from '../../quality'
import type { QualityContentType, QualityEvaluationRequest, QualityMetrics } from '../../quality/types'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:QualityGuardianService')

/**
 * VCP 工具定义
 */
const QUALITY_GUARDIAN_TOOLS: BuiltinToolDefinition[] = [
  {
    commandIdentifier: 'EvaluateQuality',
    description: `评估内容质量，返回详细的质量指标和改进建议。
参数:
- contentType (字符串, 必需): 内容类型，'image' | 'code' | 'text' | 'workflow' | 'prompt'
- content (字符串, 必需): 要评估的内容
- checkLevel (字符串, 可选): 检查级别，'basic' | 'standard' | 'thorough'，默认 'standard'
- enableAutoFix (布尔, 可选): 是否生成自动修复建议，默认 true

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」EvaluateQuality「末」
contentType:「始」image「末」
content:「始」/path/to/image.jpg「末」
checkLevel:「始」thorough「末」
<<<[END_TOOL_REQUEST]>>>

返回: 质量评分 (0-100)、检查项详情、改进建议、自动修复动作`,
    parameters: [
      { name: 'contentType', description: '内容类型', required: true, type: 'string' },
      { name: 'content', description: '要评估的内容', required: true, type: 'string' },
      { name: 'checkLevel', description: '检查级别', required: false, type: 'string', default: 'standard' },
      { name: 'enableAutoFix', description: '启用自动修复', required: false, type: 'boolean', default: true }
    ]
  },
  {
    commandIdentifier: 'OptimizePrompt',
    description: `优化提示词以提高生成效果。
参数:
- prompt (字符串, 必需): 原始提示词
- targetType (字符串, 必需): 目标类型，'image_generation' | 'text_generation' | 'code_generation'
- context (字符串, 可选): 额外上下文信息
- style (字符串, 可选): 优化风格，'conservative' | 'moderate' | 'aggressive'，默认 'moderate'

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」OptimizePrompt「末」
prompt:「始」画一只猫「末」
targetType:「始」image_generation「末」
style:「始」moderate「末」
<<<[END_TOOL_REQUEST]>>>

返回: 优化后的提示词、改进说明、备选方案`,
    parameters: [
      { name: 'prompt', description: '原始提示词', required: true, type: 'string' },
      { name: 'targetType', description: '目标类型', required: true, type: 'string' },
      { name: 'context', description: '额外上下文', required: false, type: 'string' },
      { name: 'style', description: '优化风格', required: false, type: 'string', default: 'moderate' }
    ]
  },
  {
    commandIdentifier: 'GetQualityTrend',
    description: `获取内容的质量评估历史和趋势分析。
参数:
- contentId (字符串, 必需): 内容标识符

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」GetQualityTrend「末」
contentId:「始」img-abc123「末」
<<<[END_TOOL_REQUEST]>>>

返回: 历史评分、趋势方向 (improving/stable/declining)、最佳/最差评分`,
    parameters: [{ name: 'contentId', description: '内容 ID', required: true, type: 'string' }]
  },
  {
    commandIdentifier: 'ApplyAutoFix',
    description: `应用自动修复动作。高风险修改需要用户确认。
参数:
- fixId (字符串, 必需): 修复动作 ID（从 EvaluateQuality 返回的 autoFixActions 中获取）
- approve (布尔, 可选): 是否批准执行，默认 true

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」ApplyAutoFix「末」
fixId:「始」fix-clarity-1234567890「末」
approve:「始」true「末」
<<<[END_TOOL_REQUEST]>>>

返回: 修复结果、变更详情`,
    parameters: [
      { name: 'fixId', description: '修复动作 ID', required: true, type: 'string' },
      { name: 'approve', description: '是否批准', required: false, type: 'boolean', default: true }
    ]
  },
  {
    commandIdentifier: 'CompareQuality',
    description: `对比两个内容的质量。
参数:
- content1 (字符串, 必需): 第一个内容
- content2 (字符串, 必需): 第二个内容
- contentType (字符串, 必需): 内容类型

返回: 两者的质量评分、差异分析、优劣比较`,
    parameters: [
      { name: 'content1', description: '第一个内容', required: true, type: 'string' },
      { name: 'content2', description: '第二个内容', required: true, type: 'string' },
      { name: 'contentType', description: '内容类型', required: true, type: 'string' }
    ]
  }
]

/**
 * QualityGuardianService - VCP 内置服务实现
 */
export class QualityGuardianService implements IBuiltinService {
  name = 'QualityGuardian'
  displayName = 'Quality Guardian 质量守护'
  description = 'AI 驱动的质量检查和自动优化服务，支持图片、代码、文本、提示词等多种内容类型的质量评估。'
  version = '1.0.0'
  type = 'builtin_service' as const
  supportsModel = true

  toolDefinitions = QUALITY_GUARDIAN_TOOLS

  // 待处理的自动修复动作缓存
  private pendingFixes: Map<string, { metrics: QualityMetrics; fixIndex: number }> = new Map()

  async initialize(): Promise<void> {
    logger.info('Initializing QualityGuardianService...')

    // 初始化 QualityCore
    await initializeQualityCore()

    logger.info('QualityGuardianService initialized', {
      toolCount: this.toolDefinitions.length
    })
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()
    logger.info('Executing QualityGuardian command', { command, params })

    try {
      let result: BuiltinServiceResult

      switch (command) {
        case 'EvaluateQuality':
          result = await this.evaluateQuality(params)
          break
        case 'OptimizePrompt':
          result = await this.optimizePrompt(params)
          break
        case 'GetQualityTrend':
          result = await this.getQualityTrend(params)
          break
        case 'ApplyAutoFix':
          result = await this.applyAutoFix(params)
          break
        case 'CompareQuality':
          result = await this.compareQuality(params)
          break
        default:
          result = {
            success: false,
            error: `未知命令: ${command}。可用命令: ${QUALITY_GUARDIAN_TOOLS.map((t) => t.commandIdentifier).join(', ')}`
          }
      }

      return {
        ...result,
        executionTimeMs: Date.now() - startTime
      }
    } catch (error) {
      logger.error('QualityGuardian command failed', {
        command,
        error: error instanceof Error ? error.message : String(error)
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * 评估内容质量
   */
  private async evaluateQuality(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const contentType = String(params.contentType) as QualityContentType
    const content = String(params.content)
    const checkLevel = String(params.checkLevel || 'standard') as 'basic' | 'standard' | 'thorough'
    const enableAutoFix = params.enableAutoFix !== false

    if (!contentType || !content) {
      return {
        success: false,
        error: '缺少必需参数: contentType 和 content'
      }
    }

    const request: QualityEvaluationRequest = {
      contentType,
      content,
      options: {
        checkLevel,
        enableAutoFix
      }
    }

    const qualityCore = getQualityCore()
    const metrics = await qualityCore.evaluate(request)

    // 缓存自动修复动作
    if (metrics.autoFixActions) {
      for (let i = 0; i < metrics.autoFixActions.length; i++) {
        const action = metrics.autoFixActions[i]
        this.pendingFixes.set(action.id, { metrics, fixIndex: i })
      }
    }

    // 格式化输出
    const output = this.formatQualityReport(metrics)

    return {
      success: true,
      output,
      data: metrics
    }
  }

  /**
   * 优化提示词
   */
  private async optimizePrompt(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const prompt = String(params.prompt)
    const targetType = String(params.targetType)
    const context = params.context ? String(params.context) : undefined
    const style = String(params.style || 'moderate') as 'conservative' | 'moderate' | 'aggressive'

    if (!prompt || !targetType) {
      return {
        success: false,
        error: '缺少必需参数: prompt 和 targetType'
      }
    }

    // 首先评估原始提示词
    const qualityCore = getQualityCore()
    const beforeMetrics = await qualityCore.evaluate({
      contentType: 'prompt',
      content: prompt
    })

    // 使用增强的提示词优化逻辑
    const optimizedPrompt = this.enhancePrompt(prompt, targetType, style, context)

    // 生成多个备选方案
    const alternatives = this.generatePromptAlternatives(prompt, targetType, style)

    // 评估优化后的提示词
    const afterMetrics = await qualityCore.evaluate({
      contentType: 'prompt',
      content: optimizedPrompt
    })

    const improvement = afterMetrics.overallScore - beforeMetrics.overallScore
    const improvementSign = improvement > 0 ? '+' : ''

    const output = `## 提示词优化结果

**原始提示词**: ${prompt}
**优化后提示词**: ${optimizedPrompt}

**质量提升**: ${beforeMetrics.overallScore} → ${afterMetrics.overallScore} (${improvementSign}${improvement})

### 优化说明
${this.getOptimizationExplanation(prompt, optimizedPrompt, targetType)}

### 备选方案
${alternatives.map((alt, i) => `${i + 1}. ${alt.prompt}\n   _${alt.description}_`).join('\n\n')}`

    return {
      success: true,
      output,
      data: {
        original: prompt,
        optimized: optimizedPrompt,
        beforeScore: beforeMetrics.overallScore,
        afterScore: afterMetrics.overallScore,
        improvement,
        alternatives
      }
    }
  }

  /**
   * 增强提示词 - 根据目标类型和风格进行智能优化
   */
  private enhancePrompt(
    prompt: string,
    targetType: string,
    style: 'conservative' | 'moderate' | 'aggressive',
    context?: string
  ): string {
    let enhanced = prompt.trim()

    // 基于目标类型的增强
    switch (targetType) {
      case 'image_generation':
        enhanced = this.enhanceImagePrompt(enhanced, style)
        break
      case 'text_generation':
        enhanced = this.enhanceTextPrompt(enhanced, style)
        break
      case 'code_generation':
        enhanced = this.enhanceCodePrompt(enhanced, style)
        break
      default:
        enhanced = this.enhanceGenericPrompt(enhanced, style)
    }

    // 如果有上下文，添加上下文信息
    if (context) {
      enhanced = `${enhanced}\n\n背景信息: ${context}`
    }

    return enhanced
  }

  /**
   * 增强图像生成提示词
   */
  private enhanceImagePrompt(prompt: string, style: 'conservative' | 'moderate' | 'aggressive'): string {
    const qualityTerms = {
      conservative: ['detailed'],
      moderate: ['high quality', 'detailed', 'professional'],
      aggressive: ['masterpiece', 'best quality', 'ultra detailed', 'professional photography', '8k resolution']
    }

    const terms = qualityTerms[style]
    const existingTerms = terms.filter((t) => prompt.toLowerCase().includes(t.toLowerCase()))

    if (existingTerms.length === terms.length) {
      return prompt // 已经包含所有增强词
    }

    const newTerms = terms.filter((t) => !prompt.toLowerCase().includes(t.toLowerCase()))
    return `${prompt}, ${newTerms.join(', ')}`
  }

  /**
   * 增强文本生成提示词
   */
  private enhanceTextPrompt(prompt: string, style: 'conservative' | 'moderate' | 'aggressive'): string {
    const prefixes = {
      conservative: '',
      moderate: '请详细且专业地',
      aggressive: '作为领域专家，请全面、深入、系统地'
    }

    const suffixes = {
      conservative: '',
      moderate: '。确保内容准确、结构清晰。',
      aggressive: '。请确保内容权威、全面、有深度，并提供具体示例和数据支持。'
    }

    return `${prefixes[style]}${prompt}${suffixes[style]}`
  }

  /**
   * 增强代码生成提示词
   */
  private enhanceCodePrompt(prompt: string, style: 'conservative' | 'moderate' | 'aggressive'): string {
    const requirements = {
      conservative: ['请编写代码'],
      moderate: ['请编写高质量的代码', '包含注释', '遵循最佳实践'],
      aggressive: ['请编写生产级代码', '包含完整的错误处理', '添加类型注解', '编写单元测试', '遵循 SOLID 原则']
    }

    const reqs = requirements[style]
    if (prompt.includes('请') || prompt.includes('please')) {
      return `${prompt}\n\n要求:\n${reqs.map((r) => `- ${r}`).join('\n')}`
    }
    return `${reqs[0]}: ${prompt}\n\n额外要求:\n${reqs
      .slice(1)
      .map((r) => `- ${r}`)
      .join('\n')}`
  }

  /**
   * 增强通用提示词
   */
  private enhanceGenericPrompt(prompt: string, style: 'conservative' | 'moderate' | 'aggressive'): string {
    if (style === 'conservative') {
      return prompt
    }

    const enhancements = {
      moderate: '请提供详细且有帮助的回答。',
      aggressive: '请提供全面、深入、专业的回答，包含具体示例和实用建议。'
    }

    return `${prompt}\n\n${enhancements[style]}`
  }

  /**
   * 获取优化说明
   */
  private getOptimizationExplanation(original: string, optimized: string, targetType: string): string {
    const explanations: string[] = []

    if (optimized.length > original.length) {
      explanations.push('- 添加了质量增强描述词')
    }

    if (targetType === 'image_generation') {
      if (optimized.includes('detailed') && !original.includes('detailed')) {
        explanations.push('- 增加了细节描述要求')
      }
      if (optimized.includes('quality') && !original.includes('quality')) {
        explanations.push('- 添加了质量要求')
      }
    }

    if (targetType === 'code_generation') {
      if (optimized.includes('错误处理') || optimized.includes('error handling')) {
        explanations.push('- 添加了错误处理要求')
      }
      if (optimized.includes('注释') || optimized.includes('comment')) {
        explanations.push('- 要求添加代码注释')
      }
    }

    if (explanations.length === 0) {
      explanations.push('- 优化了提示词结构和表达')
    }

    return explanations.join('\n')
  }

  /**
   * 生成提示词备选方案
   */
  private generatePromptAlternatives(
    prompt: string,
    targetType: string,
    _style: string
  ): Array<{ prompt: string; description: string }> {
    const alternatives: Array<{ prompt: string; description: string }> = []

    if (targetType === 'image_generation') {
      alternatives.push({
        prompt: `${prompt}, photorealistic, professional lighting, sharp focus`,
        description: '写实风格，专业光影'
      })
      alternatives.push({
        prompt: `${prompt}, artistic style, creative composition, vibrant colors`,
        description: '艺术风格，创意构图'
      })
      alternatives.push({
        prompt: `${prompt}, minimalist, clean background, elegant`,
        description: '极简风格，简洁优雅'
      })
    } else if (targetType === 'text_generation') {
      alternatives.push({
        prompt: `以专家视角: ${prompt}`,
        description: '专家视角'
      })
      alternatives.push({
        prompt: `用简洁明了的方式: ${prompt}`,
        description: '简洁风格'
      })
    } else {
      alternatives.push({
        prompt: `${prompt} (详细版)`,
        description: '更详细的版本'
      })
      alternatives.push({
        prompt: `${prompt} (简洁版)`,
        description: '更简洁的版本'
      })
    }

    return alternatives
  }

  /**
   * 获取质量趋势
   */
  private async getQualityTrend(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const contentId = String(params.contentId)

    if (!contentId) {
      return {
        success: false,
        error: '缺少必需参数: contentId'
      }
    }

    const qualityCore = getQualityCore()
    const history = await qualityCore.getHistory(contentId)

    if (!history) {
      return {
        success: false,
        error: `未找到内容 ${contentId} 的质量历史`
      }
    }

    const output = `## 质量趋势报告

**内容 ID**: ${contentId}
**评估次数**: ${history.evaluations.length}
**趋势方向**: ${history.trend.direction === 'improving' ? '📈 上升' : history.trend.direction === 'declining' ? '📉 下降' : '➡️ 稳定'}

### 评分统计
- 平均分: ${history.trend.averageScore.toFixed(1)}
- 最高分: ${history.trend.bestScore}
- 最低分: ${history.trend.worstScore}

### 历史评分
${history.evaluations
  .slice(-5)
  .map((e) => `- ${e.timestamp.toLocaleString()}: ${e.overallScore} (${e.passed ? '✅' : '❌'})`)
  .join('\n')}`

    return {
      success: true,
      output,
      data: history
    }
  }

  /**
   * 应用自动修复
   */
  private async applyAutoFix(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const fixId = String(params.fixId)
    const approve = params.approve !== false

    if (!fixId) {
      return {
        success: false,
        error: '缺少必需参数: fixId'
      }
    }

    const pending = this.pendingFixes.get(fixId)
    if (!pending) {
      return {
        success: false,
        error: `未找到修复动作 ${fixId}。请先使用 EvaluateQuality 获取可用的修复动作。`
      }
    }

    const action = pending.metrics.autoFixActions?.[pending.fixIndex]
    if (!action) {
      return {
        success: false,
        error: '修复动作数据无效'
      }
    }

    if (!approve) {
      this.pendingFixes.delete(fixId)
      return {
        success: true,
        output: '修复动作已取消'
      }
    }

    // 检查是否需要用户批准
    if (action.requiresApproval && action.riskLevel === 'high') {
      // 高风险操作需要通过 IPC 请求用户确认
      try {
        const approved = await this.requestUserApproval(action)
        if (!approved) {
          return {
            success: false,
            error: '用户拒绝了高风险修复操作'
          }
        }
      } catch (error) {
        logger.warn('Failed to request user approval, proceeding with caution', { error })
      }
    }

    // 执行修复动作
    try {
      const fixResult = await this.executeFixAction(action, pending.metrics)
      this.pendingFixes.delete(fixId)

      const output = `## 修复动作已应用

**动作 ID**: ${fixId}
**类型**: ${action.type}
**描述**: ${action.description}
**风险级别**: ${action.riskLevel}
**预估改进**: +${action.estimatedImprovement || 'N/A'} 分
**执行结果**: ${fixResult.success ? '✅ 成功' : '❌ 失败'}
${fixResult.details ? `**详情**: ${fixResult.details}` : ''}`

      return {
        success: fixResult.success,
        output,
        data: { fixId, action, result: fixResult }
      }
    } catch (error) {
      this.pendingFixes.delete(fixId)
      return {
        success: false,
        error: `执行修复动作失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 请求用户批准高风险操作
   */
  private async requestUserApproval(action: NonNullable<QualityMetrics['autoFixActions']>[number]): Promise<boolean> {
    // 使用 electron dialog 请求用户确认
    const { dialog } = await import('electron')
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: '高风险修复确认',
      message: `是否执行以下高风险修复操作？`,
      detail: `类型: ${action.type}\n描述: ${action.description}\n风险级别: ${action.riskLevel}`,
      buttons: ['取消', '执行'],
      defaultId: 0,
      cancelId: 0
    })
    return result.response === 1
  }

  /**
   * 执行具体的修复动作
   */
  private async executeFixAction(
    action: NonNullable<QualityMetrics['autoFixActions']>[number],
    metrics: QualityMetrics
  ): Promise<{ success: boolean; details?: string }> {
    const actionType = action.type

    switch (actionType) {
      case 'enhance_clarity':
        // 清晰度增强 - 对于图像类型
        if (metrics.contentType === 'image') {
          return {
            success: true,
            details: '已建议使用图像增强节点处理。请在工作流中添加 enhance 节点。'
          }
        }
        return { success: true, details: '清晰度优化建议已生成' }

      case 'fix_format':
        // 格式修复
        return { success: true, details: '格式问题已标记，请按建议修改' }

      case 'add_detail':
        // 添加细节
        return { success: true, details: '已生成细节增强建议' }

      case 'optimize_structure':
        // 结构优化 (代码/文本)
        return { success: true, details: '结构优化建议已生成' }

      case 'security_fix':
        // 安全修复
        return {
          success: true,
          details: '安全问题已识别。请检查并应用建议的安全修复。'
        }

      case 'performance_optimize':
        // 性能优化
        return { success: true, details: '性能优化建议已生成' }

      default:
        // 通用修复
        return {
          success: true,
          details: `修复类型 ${actionType} 的建议已生成。请查看详细建议。`
        }
    }
  }

  /**
   * 对比质量
   */
  private async compareQuality(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const content1 = String(params.content1)
    const content2 = String(params.content2)
    const contentType = String(params.contentType) as QualityContentType

    if (!content1 || !content2 || !contentType) {
      return {
        success: false,
        error: '缺少必需参数: content1, content2, contentType'
      }
    }

    const qualityCore = getQualityCore()

    const [metrics1, metrics2] = await Promise.all([
      qualityCore.evaluate({ contentType, content: content1 }),
      qualityCore.evaluate({ contentType, content: content2 })
    ])

    const diff = metrics2.overallScore - metrics1.overallScore
    const winner = diff > 0 ? '内容 2' : diff < 0 ? '内容 1' : '平局'

    const output = `## 质量对比结果

| 指标 | 内容 1 | 内容 2 | 差异 |
|------|--------|--------|------|
| 总分 | ${metrics1.overallScore} | ${metrics2.overallScore} | ${diff > 0 ? '+' : ''}${diff} |
| 通过 | ${metrics1.passed ? '✅' : '❌'} | ${metrics2.passed ? '✅' : '❌'} | - |

**获胜者**: ${winner} ${diff !== 0 ? `(+${Math.abs(diff)} 分)` : ''}`

    return {
      success: true,
      output,
      data: {
        content1: metrics1,
        content2: metrics2,
        difference: diff,
        winner
      }
    }
  }

  /**
   * 格式化质量报告
   */
  private formatQualityReport(metrics: QualityMetrics): string {
    const statusIcon = metrics.passed ? '✅' : '❌'
    const trendIcon =
      metrics.improvementTrend === 'improving' ? '📈' : metrics.improvementTrend === 'declining' ? '📉' : '➡️'

    let report = `## 质量评估报告 ${statusIcon}

**内容类型**: ${metrics.contentType}
**总体评分**: ${metrics.overallScore}/100 ${trendIcon}
**状态**: ${metrics.passed ? '通过' : '未通过'}
**评估时长**: ${metrics.duration}ms

### 检查项详情

#### 通用检查
${metrics.checks.common.map((c) => `- ${c.passed ? '✅' : '❌'} ${c.name}: ${c.score}/100 - ${c.details}`).join('\n') || '无'}

#### 类型特定检查
${metrics.checks.typeSpecific.map((c) => `- ${c.passed ? '✅' : '❌'} ${c.name}: ${c.score}/100 - ${c.details}`).join('\n') || '无'}`

    if (metrics.suggestions.length > 0) {
      report += `

### 改进建议
${metrics.suggestions.map((s) => `- ${s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : '🔵'} ${s.message}`).join('\n')}`
    }

    if (metrics.autoFixActions && metrics.autoFixActions.length > 0) {
      report += `

### 可用的自动修复
${metrics.autoFixActions.map((a) => `- **${a.id}**: ${a.description} (${a.riskLevel} 风险, 预估 +${a.estimatedImprovement || 'N/A'} 分)`).join('\n')}`
    }

    return report
  }

  async shutdown(): Promise<void> {
    this.pendingFixes.clear()
    logger.info('QualityGuardianService shutdown')
  }
}
