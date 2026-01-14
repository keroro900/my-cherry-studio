/**
 * 提示词优化节点执行器
 *
 * 通过 IPC 调用主进程的 QualityGuardianService 进行提示词优化
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface PromptOptimizerConfig {
  targetType: 'image_generation' | 'text_generation' | 'code_generation' | 'chat'
  style: 'conservative' | 'moderate' | 'aggressive'
  language: 'auto' | 'zh' | 'en'
  addQualityTags: boolean
  addStyleTags: boolean
  maxLength: number
  alternativeCount: number
  // AI 模型配置
  providerId?: string
  modelId?: string
}

/**
 * 提示词优化节点执行器
 */
export class PromptOptimizerExecutor extends BaseNodeExecutor {
  constructor() {
    super('prompt_optimizer')
  }

  async execute(
    inputs: Record<string, any>,
    config: PromptOptimizerConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始提示词优化')

      // 获取原始提示词
      const prompt = inputs.prompt
      if (!prompt || typeof prompt !== 'string') {
        return this.error('缺少必需的原始提示词', Date.now() - startTime)
      }

      this.log(context, `原始提示词长度: ${prompt.length} 字符`)

      // 首先评估原始提示词
      const beforeMetrics = await window.api.quality.evaluate({
        contentType: 'prompt',
        content: prompt
      })

      const beforeScore = beforeMetrics.metrics?.overallScore || 0

      // 执行基础优化
      let optimized = this.basicOptimize(prompt, config)

      // 如果配置了 AI 模型，使用 AI 进行高级优化
      if (config.providerId && config.modelId) {
        try {
          const aiOptimized = await this.aiOptimize(prompt, config, context)
          if (aiOptimized) {
            optimized = aiOptimized
          }
        } catch (error) {
          this.log(context, '⚠️ AI 优化失败，使用基础优化结果', { error: String(error) })
        }
      }

      // 评估优化后的提示词
      const afterMetrics = await window.api.quality.evaluate({
        contentType: 'prompt',
        content: optimized
      })

      const afterScore = afterMetrics.metrics?.overallScore || 0

      // 生成备选方案
      const alternatives = this.generateAlternatives(prompt, config)

      // 生成改进说明
      const improvement = this.generateImprovementNote(prompt, optimized, beforeScore, afterScore, config)

      this.log(context, `优化完成: ${beforeScore} -> ${afterScore}`)

      return this.success(
        {
          optimized_prompt: optimized,
          alternatives,
          improvement,
          before_score: beforeScore,
          after_score: afterScore
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '提示词优化失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 基础优化（规则驱动）
   */
  private basicOptimize(prompt: string, config: PromptOptimizerConfig): string {
    let optimized = prompt.trim()

    // 根据目标类型添加质量标签
    if (config.addQualityTags && config.targetType === 'image_generation') {
      const qualityTags = ['high quality', 'detailed', 'sharp focus']
      const existingLower = optimized.toLowerCase()

      for (const tag of qualityTags) {
        if (!existingLower.includes(tag)) {
          optimized += `, ${tag}`
        }
      }
    }

    // 根据风格调整
    if (config.style === 'aggressive' && optimized.length < 100) {
      if (config.targetType === 'image_generation') {
        optimized = this.enhanceForImage(optimized)
      }
    }

    // 处理语言
    if (config.language === 'en' && this.containsChinese(optimized)) {
      // 保持原样，实际翻译需要 AI
      this.log({} as NodeExecutionContext, '⚠️ 语言转换需要 AI 模型支持')
    }

    // 截断到最大长度
    if (optimized.length > config.maxLength) {
      optimized = optimized.substring(0, config.maxLength - 3) + '...'
    }

    return optimized
  }

  /**
   * AI 驱动的高级优化
   */
  private async aiOptimize(
    prompt: string,
    config: PromptOptimizerConfig,
    _context: NodeExecutionContext
  ): Promise<string | null> {
    // 构建优化提示
    const systemPrompt = `你是一个专业的提示词优化专家。请优化以下用于${this.getTargetTypeLabel(config.targetType)}的提示词。

优化风格: ${config.style === 'conservative' ? '保守（小幅增强）' : config.style === 'aggressive' ? '激进（大幅增强）' : '适中（平衡增强）'}
${config.addQualityTags ? '需要添加高质量相关的标签' : ''}
${config.addStyleTags ? '需要根据内容添加合适的风格标签' : ''}
${config.language !== 'auto' ? `输出语言: ${config.language === 'zh' ? '中文' : '英文'}` : '保持原语言'}
最大长度: ${config.maxLength} 字符

只返回优化后的提示词，不要添加任何解释。`

    // 调用 AI 模型 - 检查 API 是否可用
    const aiApi = (
      window.api as { ai?: { generateText: (args: unknown) => Promise<{ success: boolean; content?: string }> } }
    ).ai
    if (!aiApi?.generateText) {
      console.warn('AI API not available, returning original prompt')
      return null
    }

    const result = await aiApi.generateText({
      providerId: config.providerId!,
      modelId: config.modelId!,
      systemPrompt,
      userMessage: prompt,
      maxTokens: config.maxLength
    })

    if (result.success && result.content) {
      return result.content.trim()
    }

    return null
  }

  /**
   * 生成备选方案
   */
  private generateAlternatives(prompt: string, config: PromptOptimizerConfig): string[] {
    const alternatives: string[] = []
    const count = config.alternativeCount

    if (count <= 0) return alternatives

    // 方案1: 专业风格
    if (count >= 1) {
      alternatives.push(`${prompt}，专业风格，高品质`)
    }

    // 方案2: 创意风格
    if (count >= 2) {
      alternatives.push(`${prompt}，创意风格，独特视角`)
    }

    // 方案3: 简洁风格
    if (count >= 3) {
      const simplified = prompt.split(/[,，]/).slice(0, 3).join(', ')
      alternatives.push(`${simplified}, minimalist, clean`)
    }

    // 方案4: 详细描述
    if (count >= 4) {
      alternatives.push(`详细描述: ${prompt}，注意细节，高清晰度，专业摄影`)
    }

    // 方案5: 艺术风格
    if (count >= 5) {
      alternatives.push(`${prompt}, artistic, masterpiece, award-winning`)
    }

    return alternatives.slice(0, count)
  }

  /**
   * 生成改进说明
   */
  private generateImprovementNote(
    original: string,
    optimized: string,
    beforeScore: number,
    afterScore: number,
    config: PromptOptimizerConfig
  ): string {
    const improvements: string[] = []

    // 分数变化
    const scoreDiff = afterScore - beforeScore
    if (scoreDiff > 0) {
      improvements.push(`质量分数提升 ${scoreDiff} 分 (${beforeScore} → ${afterScore})`)
    } else if (scoreDiff < 0) {
      improvements.push(`⚠️ 质量分数下降 ${Math.abs(scoreDiff)} 分，建议检查优化结果`)
    }

    // 长度变化
    const lengthDiff = optimized.length - original.length
    if (lengthDiff > 0) {
      improvements.push(`添加了 ${lengthDiff} 个字符的描述`)
    }

    // 质量标签
    if (config.addQualityTags && optimized.includes('high quality')) {
      improvements.push('添加了高质量相关标签')
    }

    // 风格说明
    improvements.push(
      `使用了${config.style === 'conservative' ? '保守' : config.style === 'aggressive' ? '激进' : '适中'}优化风格`
    )

    return improvements.join('\n')
  }

  /**
   * 增强图片生成提示词
   */
  private enhanceForImage(prompt: string): string {
    const enhancements = ['high resolution', 'professional photography', 'studio lighting', '8k quality']
    return `${prompt}, ${enhancements.join(', ')}`
  }

  /**
   * 检测是否包含中文
   */
  private containsChinese(text: string): boolean {
    return /[\u4e00-\u9fa5]/.test(text)
  }

  /**
   * 获取目标类型标签
   */
  private getTargetTypeLabel(targetType: string): string {
    const labels: Record<string, string> = {
      image_generation: '图片生成',
      text_generation: '文本生成',
      code_generation: '代码生成',
      chat: '对话聊天'
    }
    return labels[targetType] || targetType
  }
}

export default PromptOptimizerExecutor
