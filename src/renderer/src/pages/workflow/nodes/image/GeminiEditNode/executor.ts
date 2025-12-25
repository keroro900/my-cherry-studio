/**
 * Gemini 图片编辑节点执行器 v2.0
 *
 * 使用 ModelPromptBuilder 统一架构重构版本:
 * - 支持上游 promptJson 输入（来自 UnifiedPromptNode）
 * - 支持 preset 预设模式
 * - 支持 custom 自定义模式
 *
 * 模式：
 * - preset: 预设模式，根据年龄、性别、场景等参数构建专业提示词
 * - custom: 自定义模式，使用用户输入的提示词
 */

import { ModelPromptBuilder } from '../../../prompts'
import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import { buildPresetPrompt, getNegativePrompt } from './prompts'

export interface GeminiEditConfig {
  providerId?: string
  modelId?: string
  model?: { id: string; provider: string }
  mode: 'preset' | 'custom'
  imageSize?: string
  aspectRatio?: string
  // 预设模式参数
  ageGroup?: 'small_kid' | 'big_kid' | 'adult'
  gender?: 'male' | 'female'
  scenePreset?: 'home' | 'outdoor' | 'studio' | 'playground' | 'nature'
  styleMode?: 'daily' | 'commercial'
  ethnicityPreset?: 'asian' | 'caucasian' | 'african_american' | 'hispanic' | 'mixed'
  posePreset?: 'natural' | 'sitting' | 'playing' | 'walking'
  // 自定义模式参数
  customPrompt?: string
  // 用户自定义提示词（UI 编辑后保存）
  customPrompts?: Record<string, string>
}

export class GeminiEditExecutor extends BaseNodeExecutor {
  constructor() {
    super('gemini_edit')
  }

  async execute(
    inputs: Record<string, any>,
    config: GeminiEditConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 调试日志：打印完整的 config 对象，追踪参数传递
      this.log(context, '开始执行图片编辑节点 v2.0 (Builder 架构)', {
        mode: config.mode,
        imageSize: config.imageSize,
        aspectRatio: config.aspectRatio,
        hasImageSize: 'imageSize' in config,
        hasAspectRatio: 'aspectRatio' in config,
        configKeys: Object.keys(config)
      })

      // 获取用户自定义提示词（UI 编辑后保存到此）
      const customPrompts = config.customPrompts as Record<string, string> | undefined

      // 查找 Gemini 图片生成 Provider
      const providerId = config.model?.provider || config.providerId
      const modelId = config.model?.id || config.modelId
      const geminiProvider = await WorkflowAiService.findGeminiImageProvider(providerId, modelId)

      if (!geminiProvider) {
        return this.error(
          '未找到可用的 Gemini 图像生成服务。请在设置 → 模型服务中添加 Provider，并为模型设置端点类型为 "图像生成 (Gemini)"'
        )
      }

      this.log(context, '找到 Gemini Provider', {
        providerId: geminiProvider.provider.id,
        modelId: geminiProvider.model.id
      })

      // 收集所有图片输入
      const images = this.collectImageInputs(inputs)
      this.log(context, `收集到 ${images.length} 张图片`)

      // 获取基础图片
      const baseImage = images[0] || inputs.image || inputs.baseImage

      if (!baseImage) {
        return this.error('图片编辑节点需要输入图片')
      }

      // 获取可能的 promptJson 输入（从智能提示词节点传入）
      const promptJson = inputs.promptJson as Record<string, any> | undefined

      // 构建提示词
      let prompt = ''
      let promptSource: 'promptJson' | 'preset' | 'auto' | 'custom' = 'preset'

      if (config.mode === 'custom') {
        // 自定义模式：直接使用用户输入的提示词
        prompt = config.customPrompt || inputs.customPrompt || inputs.prompt || ''
        promptSource = 'custom'
        this.log(context, '使用自定义提示词模式')
      } else if (promptJson?.full_prompt) {
        // 有上游 promptJson 的 full_prompt，使用 Builder 处理
        const builder = new ModelPromptBuilder({
          promptJson: promptJson,
          preset: config.styleMode,
          config: {
            mode: config.mode,
            ageGroup: config.ageGroup,
            gender: config.gender,
            scenePreset: config.scenePreset,
            styleMode: config.styleMode,
            ethnicityPreset: config.ethnicityPreset,
            posePreset: config.posePreset,
            imageSize: config.imageSize,
            aspectRatio: config.aspectRatio
          }
        })

        const result = builder.build()
        prompt = result.prompt
        promptSource = result.source
        this.log(context, '使用上游 promptJson 构建提示词')
      } else {
        // 预设模式：使用 prompts.ts 中的函数构建专业的模特换装/编辑提示词
        // 保留遗留逻辑以确保兼容性
        prompt = buildPresetPrompt(config, promptJson)
        promptSource = 'preset'
        this.log(context, '使用预设模式构建提示词')
      }

      // 如果用户在 UI 编辑过提示词，优先使用
      if (customPrompts?.main) {
        prompt = customPrompts.main
        promptSource = 'custom'
        this.log(context, '使用用户自定义提示词')
      }

      if (!prompt) {
        return this.error('缺少编辑提示词')
      }

      this.log(context, '提示词准备完成', { promptLength: prompt.length, promptSource })

      // 加载所有图片为 base64
      const imageBase64List = await WorkflowAiService.loadImagesAsBase64(images)

      if (imageBase64List.length === 0) {
        return this.error('无法加载图片文件')
      }

      // 调用 Gemini API
      this.log(context, '调用 Gemini API 编辑图片...', {
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize
      })

      // 检查是否已取消
      if (this.shouldAbort(context)) {
        return this.error('执行已取消', Date.now() - startTime)
      }

      // 确保 imageSize 和 aspectRatio 有值（回退到默认值）
      // 这是关键修复：即使 defaultConfig 没有正确合并到旧节点，执行时也能使用默认值
      const imageSize = config.imageSize || '2K'
      const aspectRatio = config.aspectRatio || '3:4'

      this.log(context, '最终使用的参数', {
        imageSize,
        aspectRatio,
        configImageSize: config.imageSize,
        configAspectRatio: config.aspectRatio
      })

      const editedImageResult = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
        prompt,
        negativePrompt: customPrompts?.negative || getNegativePrompt(),
        images: imageBase64List,
        aspectRatio,
        imageSize,
        signal: context.abortSignal
      })

      const outputs = {
        editedImage: editedImageResult,
        image: editedImageResult,
        metadata: {
          promptSource,
          promptLength: prompt.length
        }
      }

      this.log(context, '图片编辑完成', { promptSource })

      return this.success(outputs, Date.now() - startTime)
    } catch (error) {
      this.logError(context, '图片编辑失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default GeminiEditExecutor
