/**
 * 模特图生成策略
 * Model Image Generation Strategy
 *
 * 处理 gemini_generate_model 和 gemini_model_from_clothes 节点类型
 * 使用 ModelPromptBuilder 构建专业的模特图提示词
 *
 * **Feature: executor-strategy-pattern, Phase 3.2b**
 */

import { type ModelConfig, ModelPromptBuilder } from '../../../prompts/builders'
import { ImageRefService } from '../../../services/ImageRefService'
import { createErrorResult, createSuccessResult, type ImageRef, type NodeExecutionResult } from '../../../types/core'
import { BaseImageGenerationStrategy, type OutputMapping, type StrategyContext } from './ImageGenerationStrategy'

/**
 * 模特图生成策略
 *
 * 支持节点类型：
 * - gemini_generate_model: 从 promptJson 生成模特图
 * - gemini_model_from_clothes: 从衣服图片生成模特图
 *
 * 特点：
 * - 使用 ModelPromptBuilder 构建专业提示词
 * - 支持年龄、性别、人种、姿态、场景等预设
 * - System/User 提示词分离（Gemini 3 Pro Image 支持）
 */
export class ModelStrategy extends BaseImageGenerationStrategy {
  readonly supportedNodeTypes = ['gemini_generate_model', 'gemini_model_from_clothes']
  readonly name = 'ModelStrategy'
  readonly supportsMultiStep = false

  getOutputMapping(_config: Record<string, any>): OutputMapping {
    return {
      primaryOutput: 'image'
    }
  }

  /**
   * 执行模特图生成
   */
  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: StrategyContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 构建 ModelConfig
      const imageSize = config.imageSize || '2K'
      const aspectRatio = config.aspectRatio || '3:4'
      const customPrompts = config.customPrompts as { system?: string; user?: string } | undefined

      const modelConfig: ModelConfig = {
        ageGroup: (config.ageGroup as ModelConfig['ageGroup']) || 'big_kid',
        gender: (config.gender as ModelConfig['gender']) || 'female',
        scenePreset: (config.scenePreset as ModelConfig['scenePreset']) || 'home',
        posePreset: (config.posePreset as ModelConfig['posePreset']) || 'natural',
        ethnicityPreset: (config.ethnicityPreset as ModelConfig['ethnicityPreset']) || 'asian',
        imageSize,
        aspectRatio
      }

      // 2. 从 promptJson 合并配置（如果有）
      if (inputs.promptJson && typeof inputs.promptJson === 'object') {
        modelConfig.ageGroup = (inputs.promptJson.age_group as ModelConfig['ageGroup']) || modelConfig.ageGroup
        modelConfig.gender = (inputs.promptJson.gender as ModelConfig['gender']) || modelConfig.gender
        modelConfig.scenePreset =
          (inputs.promptJson.scene_preset as ModelConfig['scenePreset']) || modelConfig.scenePreset
        // 从 promptJson 读取种族和姿势配置
        modelConfig.ethnicityPreset =
          (inputs.promptJson.ethnicity_preset as ModelConfig['ethnicityPreset']) ||
          (inputs.promptJson.ethnicity as ModelConfig['ethnicityPreset']) ||
          modelConfig.ethnicityPreset
        modelConfig.posePreset =
          (inputs.promptJson.pose_preset as ModelConfig['posePreset']) ||
          (inputs.promptJson.pose as ModelConfig['posePreset']) ||
          modelConfig.posePreset
      }

      // 3. 使用 ModelPromptBuilder 构建提示词
      const builder = new ModelPromptBuilder({
        promptJson: inputs.promptJson,
        config: modelConfig as ModelConfig & Record<string, unknown>
      })

      const systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      const userPrompt = customPrompts?.user || builder.buildUserPrompt()

      if (!userPrompt) {
        return createErrorResult('缺少提示词', Date.now() - startTime)
      }

      context.log?.('ModelStrategy: 提示词构建完成', {
        hasSystemPrompt: !!systemPrompt,
        userPromptLength: userPrompt.length,
        modelConfig: {
          ageGroup: modelConfig.ageGroup,
          gender: modelConfig.gender,
          scenePreset: modelConfig.scenePreset,
          ethnicityPreset: modelConfig.ethnicityPreset,
          posePreset: modelConfig.posePreset
        }
      })

      // 4. 收集输入图片（衣服图片等）
      const imageInputs = this.collectImageInputs(inputs)
      const imageBase64List = imageInputs.length > 0 ? await context.loadImagesAsBase64(imageInputs) : undefined

      context.log?.(`ModelStrategy: 收集到 ${imageInputs.length} 张参考图片`)

      // 5. 检查取消
      if (context.executionContext.abortSignal?.aborted) {
        return createErrorResult('执行已取消', Date.now() - startTime)
      }

      // 6. 调用图片生成
      const imageResult = await context.generateImage({
        prompt: userPrompt,
        systemPrompt,
        negativePrompt: config.negativePrompt,
        images: imageBase64List,
        aspectRatio,
        imageSize,
        signal: context.executionContext.abortSignal
      })

      // 7. 构建输出 - 使用 ImageRef 而非 Base64
      // **Feature: image-ref-optimization**
      const imageRef: ImageRef = ImageRefService.fromApiResponse(imageResult)

      const outputs: Record<string, any> = {
        image: imageRef
      }

      context.log?.('ModelStrategy: 模特图生成完成')

      return createSuccessResult(outputs, Date.now() - startTime)
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

/**
 * 导出策略实例
 */
export const modelStrategy = new ModelStrategy()
