/**
 * Gemini 模特生成节点执行器
 *
 * 支持两种模式：
 * - gemini_generate_model: 从 promptJson 生成模特
 * - gemini_model_from_clothes: 从衣服图片生成模特
 */

import { resolveScene } from '../../../presets'
import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { ImageGenerateNodeConfig, NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import { buildModelFromClothesPrompt, buildModelPromptFromJson } from '../GeminiEditNode/prompts'

interface ModelNodeConfig extends ImageGenerateNodeConfig {
  poseStyle?: 'natural' | 'sitting' | 'playing'
  additionalPrompt?: string
  // 用户自定义提示词（UI 编辑后保存）
  customPrompts?: Record<string, string>
}

export class GeminiModelExecutor extends BaseNodeExecutor {
  private mode: 'gemini_generate_model' | 'gemini_model_from_clothes'

  constructor(mode: 'gemini_generate_model' | 'gemini_model_from_clothes' = 'gemini_generate_model') {
    super(mode)
    this.mode = mode
  }

  async execute(
    inputs: Record<string, any>,
    config: ModelNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, `开始执行模特生成节点 [${this.mode}]`)

      // 获取用户自定义提示词（UI 编辑后保存到此）
      const customPrompts = config.customPrompts

      // 1. 查找 Gemini 图片生成 Provider
      // 支持新格式 config.model 和旧格式 config.providerId/modelId
      const modelConfig = (config as any).model
      const providerId = modelConfig?.provider || config.providerId
      const modelId = modelConfig?.id || config.modelId
      const geminiProvider = await WorkflowAiService.findGeminiImageProvider(providerId, modelId)

      if (!geminiProvider) {
        return this.error(
          '未找到可用的 Gemini 图像生成服务。请在设置 → 模型服务中添加 Provider，并为模型设置端点类型为 "图像生成 (Gemini)"',
          Date.now() - startTime
        )
      }

      this.log(context, '找到 Gemini Provider', {
        providerId: geminiProvider.provider.id,
        modelId: geminiProvider.model.id
      })

      // 2. 收集图片输入
      const images = this.collectImageInputs(inputs)
      this.log(context, `收集到 ${images.length} 张图片`)

      // 3. 根据模式构建提示词
      let prompt = ''

      if (this.mode === 'gemini_model_from_clothes') {
        // 从衣服图片生成模特 - 优先使用 promptJson（来自 UnifiedPromptNode）
        if (images.length === 0) {
          return this.error('需要提供服装图片', Date.now() - startTime)
        }

        if (inputs.promptJson && typeof inputs.promptJson === 'object') {
          const hasStructuredFields =
            inputs.promptJson.foreground ||
            inputs.promptJson.midground ||
            inputs.promptJson.background ||
            inputs.promptJson.visual_guidance ||
            inputs.promptJson.camera_params

          if (hasStructuredFields) {
            // 使用 resolveScene 处理场景，支持所有预设场景和 random
            const resolvedScene = resolveScene(config.scenePreset || inputs.promptJson.scene_preset || 'home')
            prompt = buildModelPromptFromJson(
              inputs.promptJson,
              config.ageGroup || inputs.promptJson.age_group || 'big_kid',
              resolvedScene,
              config.gender || inputs.promptJson.gender || 'female'
            )
            this.log(context, '使用 buildModelPromptFromJson 构建提示词（MODEL_FROM_CLOTHES + JSON）', {
              hasFields: Object.keys(inputs.promptJson)
                .filter((k) => inputs.promptJson[k])
                .join(', ')
            })
          } else if (inputs.promptJson.caption || inputs.promptJson.full_prompt) {
            prompt = inputs.promptJson.caption || inputs.promptJson.full_prompt
            this.log(context, '使用 promptJson.caption 作为提示词（MODEL_FROM_CLOTHES）')
          } else {
            // 回退到旧模板
            const resolvedScene = resolveScene(config.scenePreset || 'home')
            prompt = buildModelFromClothesPrompt(
              inputs.prompt || config.additionalPrompt || '',
              resolvedScene,
              config.poseStyle || 'natural',
              config.ageGroup || 'big_kid',
              ''
            )
            this.log(context, '使用 MODEL_FROM_CLOTHES 提示词模板（无有效 JSON）')
          }
        } else {
          // 没有 promptJson，使用旧模板
          const resolvedScene = resolveScene(config.scenePreset || 'home')
          prompt = buildModelFromClothesPrompt(
            inputs.prompt || config.additionalPrompt || '',
            resolvedScene,
            config.poseStyle || 'natural',
            config.ageGroup || 'big_kid',
            ''
          )
          this.log(context, '使用 MODEL_FROM_CLOTHES 提示词模板', {
            scene: config.scenePreset,
            pose: config.poseStyle,
            age: config.ageGroup
          })
        }
      } else {
        // gemini_generate_model: 从 promptJson 生成模特
        if (!inputs.promptJson) {
          return this.error('需要提供提示词 JSON（来自视觉分析节点）', Date.now() - startTime)
        }

        // 修复：使用 resolveScene 处理场景，支持所有预设场景和 random
        const resolvedScene = resolveScene(config.scenePreset || 'home')
        prompt = buildModelPromptFromJson(
          inputs.promptJson,
          config.ageGroup || 'adult',
          resolvedScene,
          config.gender || 'female'
        )

        this.log(context, '使用 buildModelPromptFromJson 构建提示词', {
          hasPromptJson: !!inputs.promptJson,
          age: config.ageGroup,
          scene: config.scenePreset,
          gender: config.gender
        })
      }

      // 优先使用用户自定义提示词（UI 编辑后保存）
      if (customPrompts?.main) {
        prompt = customPrompts.main
        this.log(context, '使用用户自定义提示词')
      }

      if (!prompt) {
        return this.error('无法构建生成提示词', Date.now() - startTime)
      }

      this.log(context, '提示词准备完成', { promptLength: prompt.length })

      // 4. 加载图片
      const imageBase64List = images.length > 0 ? await WorkflowAiService.loadImagesAsBase64(images) : undefined

      // 5. 调用图片生成服务
      this.log(context, '调用 Gemini 图片生成服务...')

      // 检查是否已取消
      if (this.shouldAbort(context)) {
        return this.error('执行已取消', Date.now() - startTime)
      }

      const imageResult = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
        prompt,
        negativePrompt: config.negativePrompt,
        images: imageBase64List,
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize,
        signal: context.abortSignal // 传递取消信号
      })

      const duration = Date.now() - startTime
      this.log(context, '模特图片生成完成', { duration: `${duration}ms` })

      return this.success(
        {
          modelImage: imageResult,
          image: imageResult // 兼容输出
        },
        duration
      )
    } catch (error) {
      this.logError(context, '模特生成失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default GeminiModelExecutor
