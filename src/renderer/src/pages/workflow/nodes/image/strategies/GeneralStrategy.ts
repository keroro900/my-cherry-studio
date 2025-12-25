/**
 * 通用图片生成策略
 * General Image Generation Strategy
 *
 * 处理 gemini_generate 节点类型
 * 支持结构化 promptJson 或普通文本提示词
 *
 * **Feature: executor-strategy-pattern, Phase 3.2a**
 */

import { type ModelConfig, ModelPromptBuilder } from '../../../prompts/builders'
import { ImageRefService } from '../../../services/ImageRefService'
import { createErrorResult, createSuccessResult, type ImageRef, type NodeExecutionResult } from '../../../types/core'
import { BaseImageGenerationStrategy, type OutputMapping, type StrategyContext } from './ImageGenerationStrategy'

/**
 * 通用图片生成策略
 *
 * 作为回退策略，处理：
 * 1. gemini_generate 节点
 * 2. 结构化 promptJson（如果有）
 * 3. 普通文本提示词
 */
export class GeneralStrategy extends BaseImageGenerationStrategy {
  readonly supportedNodeTypes = ['gemini_generate']
  readonly name = 'GeneralStrategy'
  readonly supportsMultiStep = false

  getOutputMapping(_config: Record<string, any>): OutputMapping {
    return {
      primaryOutput: 'image'
    }
  }

  /**
   * 覆盖提示词构建逻辑
   * 支持结构化 promptJson 或普通文本提示词
   */
  protected buildPromptsInternal(
    inputs: Record<string, any>,
    config: Record<string, any>
  ): { systemPrompt?: string; userPrompt: string } {
    const customPrompts = this.getCustomPrompts(config)
    const imageSize = config.imageSize || '2K'
    const aspectRatio = config.aspectRatio || '1:1'

    // 如果有结构化 promptJson，使用 ModelPromptBuilder
    if (inputs.promptJson && typeof inputs.promptJson === 'object') {
      const hasStructuredFields =
        inputs.promptJson.foreground ||
        inputs.promptJson.midground ||
        inputs.promptJson.background ||
        inputs.promptJson.visual_guidance ||
        inputs.promptJson.camera_params

      if (hasStructuredFields || inputs.promptJson.full_prompt) {
        const modelConfig: ModelConfig = {
          ageGroup:
            (config.ageGroup as ModelConfig['ageGroup']) ||
            (inputs.promptJson.age_group as ModelConfig['ageGroup']) ||
            'big_kid',
          gender:
            (config.gender as ModelConfig['gender']) || (inputs.promptJson.gender as ModelConfig['gender']) || 'female',
          scenePreset:
            (config.scenePreset as ModelConfig['scenePreset']) ||
            (inputs.promptJson.scene_preset as ModelConfig['scenePreset']) ||
            'home',
          imageSize,
          aspectRatio
        }

        const builder = new ModelPromptBuilder({
          promptJson: inputs.promptJson,
          config: modelConfig as ModelConfig & Record<string, unknown>
        })

        const systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
        const userPrompt = customPrompts?.user || builder.buildUserPrompt()

        return { systemPrompt, userPrompt }
      }

      // JSON 没有结构化字段，使用 caption 作为用户提示词
      const userPrompt = customPrompts?.user || inputs.promptJson.caption || inputs.prompt || config.prompt || ''
      return { systemPrompt: customPrompts?.system, userPrompt }
    }

    // 没有 promptJson，使用普通提示词
    const userPrompt = customPrompts?.user || inputs.prompt || config.prompt || ''
    return { systemPrompt: customPrompts?.system, userPrompt }
  }

  /**
   * 获取自定义提示词
   */
  private getCustomPrompts(config: Record<string, any>): { system?: string; user?: string } | undefined {
    return config.customPrompts as { system?: string; user?: string } | undefined
  }

  /**
   * 执行通用图片生成
   */
  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: StrategyContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 构建提示词
      const { systemPrompt, userPrompt } = this.buildPromptsInternal(inputs, config)

      if (!userPrompt) {
        return createErrorResult('缺少提示词', Date.now() - startTime)
      }

      context.log?.('GeneralStrategy: 提示词构建完成', {
        hasSystemPrompt: !!systemPrompt,
        userPromptLength: userPrompt.length
      })

      // 2. 收集输入图片
      const imageInputs = this.collectImageInputs(inputs)
      const imageBase64List = imageInputs.length > 0 ? await context.loadImagesAsBase64(imageInputs) : undefined

      context.log?.(`GeneralStrategy: 收集到 ${imageInputs.length} 张图片`)

      // 3. 检查取消
      if (context.executionContext.abortSignal?.aborted) {
        return createErrorResult('执行已取消', Date.now() - startTime)
      }

      // 4. 调用图片生成
      const imageResult = await context.generateImage({
        prompt: userPrompt,
        systemPrompt,
        negativePrompt: config.negativePrompt,
        images: imageBase64List,
        aspectRatio: config.aspectRatio || '1:1',
        imageSize: config.imageSize || '2K',
        signal: context.executionContext.abortSignal
      })

      // 5. 构建输出 - 使用 ImageRef 而非 Base64
      // **Feature: image-ref-optimization**
      const imageRef: ImageRef = ImageRefService.fromApiResponse(imageResult)

      const outputs: Record<string, any> = {
        image: imageRef
      }

      context.log?.('GeneralStrategy: 图片生成完成')

      return createSuccessResult(outputs, Date.now() - startTime)
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

/**
 * 导出策略实例
 */
export const generalStrategy = new GeneralStrategy()
