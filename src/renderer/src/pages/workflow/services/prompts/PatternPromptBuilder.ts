/**
 * 图案生成节点提示词构建器
 *
 * 将 GeminiPatternNode/prompts.ts 中的提示词逻辑封装为统一接口
 *
 * @module services/prompts/PatternPromptBuilder
 */

import {
  buildNegativePrompt,
  buildPatternPrompt,
  COLOR_TONE_PROMPTS,
  DENSITY_PROMPTS,
  MODE_PROMPTS,
  PATTERN_SYSTEM_PROMPT,
  PATTERN_TYPE_PROMPTS
} from '../../nodes/image/GeminiPatternNode/prompts'
import { BasePromptBuilder, type PromptTemplates } from './PromptBuilder'

/**
 * 图案生成节点提示词构建器
 */
export class PatternPromptBuilder extends BasePromptBuilder {
  readonly nodeType = 'gemini_pattern'

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(config: Record<string, any>): string {
    // 如果禁用了系统提示词，返回空
    if (config.useSystemPrompt === false) {
      return ''
    }

    return PATTERN_SYSTEM_PROMPT
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(config: Record<string, any>, inputs: Record<string, any>): string {
    // 优先使用输入的提示词
    if (inputs.prompt && typeof inputs.prompt === 'string' && inputs.prompt.trim()) {
      return inputs.prompt.trim()
    }

    // 尝试从 promptJson 输入获取提示词
    if (inputs.promptJson && typeof inputs.promptJson === 'object') {
      const json = inputs.promptJson as Record<string, any>
      if (json.prompt || json.userPrompt) {
        return String(json.prompt || json.userPrompt)
      }
    }

    // 使用配置构建提示词
    const outputMode = config.outputType === 'set' ? 'graphic' : 'seamless'
    const builtPrompt = buildPatternPrompt(
      {
        patternType: config.patternType,
        generationMode: config.generationMode,
        density: config.density,
        colorTone: config.colorTone,
        symmetryMode: config.symmetryMode,
        useSystemPrompt: false, // 系统提示词单独处理
        enableSmartScaling: config.enableSmartScaling,
        enableAutoColorMatch: config.enableAutoColorMatch,
        stylePresetPrompt: config.stylePresetPrompt,
        customPrompt: config.customPrompt,
        negativePrompt: config.negativePrompt,
        promptEnhancement: config.promptEnhancement,
        imageSize: config.imageSize,
        aspectRatio: config.aspectRatio,
        outputType: config.outputType,
        mockupType: config.mockupType
      },
      outputMode
    )

    return builtPrompt
  }

  /**
   * 构建负面提示词
   */
  buildNegativePrompt(config: Record<string, any>): string {
    return buildNegativePrompt({
      patternType: config.patternType,
      outputType: config.outputType,
      negativePrompt: config.negativePrompt
    })
  }

  /**
   * 获取默认提示词模板
   */
  getDefaultTemplates(): PromptTemplates {
    return {
      system: PATTERN_SYSTEM_PROMPT,
      user: this.getDefaultUserPrompt(),
      description: '图案生成专家：专门设计和生成各类图案、纹理、装饰元素。支持无缝图案、T恤图案和元素派生。'
    }
  }

  /**
   * 获取默认用户提示词
   */
  private getDefaultUserPrompt(): string {
    const parts: string[] = []

    // 添加图案类型说明
    parts.push('[Pattern Style]')
    parts.push('Style: ' + PATTERN_TYPE_PROMPTS.seamless.style)
    parts.push('Elements: ' + PATTERN_TYPE_PROMPTS.seamless.elements)
    parts.push('Usage: ' + PATTERN_TYPE_PROMPTS.seamless.usage)

    // 添加生成模式
    parts.push('')
    parts.push('[Generation Mode]')
    parts.push(MODE_PROMPTS.mode_a)

    // 添加密度
    parts.push('')
    parts.push('[Density]')
    parts.push(DENSITY_PROMPTS.medium)

    // 添加色调
    parts.push('')
    parts.push('[Color Palette]')
    parts.push(COLOR_TONE_PROMPTS.colorful)

    // 添加技术规格
    parts.push('')
    parts.push('[Technical Specifications]')
    parts.push('Resolution: 2K')
    parts.push('Aspect ratio: 1:1')

    // 添加输出要求
    parts.push('')
    parts.push('[Output Requirements]')
    parts.push(
      'Generate the image directly. Do not output any text descriptions, dialogue, or JSON format. Start generating pixel data immediately.'
    )

    return parts.join('\n')
  }
}

export default PatternPromptBuilder
