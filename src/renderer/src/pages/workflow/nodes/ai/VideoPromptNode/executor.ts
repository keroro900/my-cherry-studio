/**
 * 视频提示词节点执行器
 *
 * 根据输入图片生成视频提示词，核心约束：
 * - 禁止转身
 * - 支持 5秒/10秒 视频
 */

import { isVisionModel } from '@renderer/config/models/vision'

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { extractJsonFromText } from '../../../utils/extractJson'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import { buildVideoSystemPrompt, buildVideoUserPrompt } from './prompts'
import type { VideoPromptNodeConfig } from './types'

export class VideoPromptExecutor extends BaseNodeExecutor {
  constructor() {
    super('video_prompt')
  }

  async execute(
    inputs: Record<string, any>,
    config: VideoPromptNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, `开始执行视频提示词节点 [${config.duration} / ${config.motionType}]`)

    try {
      // 1. 收集图片输入
      const images = this.collectImageInputs(inputs)

      this.log(context, '收集图片输入', {
        imageCount: images.length,
        imagePaths: images.map((img) => (typeof img === 'string' ? img.substring(0, 80) : typeof img))
      })

      if (images.length === 0) {
        return this.error('视频提示词节点需要至少一张图片输入', Date.now() - startTime)
      }

      // 2. 查找视觉模型
      const visionModel = await WorkflowAiService.findModel(config.providerId, config.modelId)
      if (!visionModel) {
        return this.error(
          '未找到可用的视觉模型。请在设置中配置支持视觉的模型（如 Gemini、GPT-4V、Claude、Qwen-VL 等）',
          Date.now() - startTime
        )
      }
      const { provider, model } = visionModel

      // 验证模型是否支持视觉功能
      if (!isVisionModel(model)) {
        return this.error(
          `选择的模型 "${model.name || model.id}" 不支持视觉功能。请选择支持视觉的模型，如 GPT-4o、Claude 3、Gemini Pro Vision、Qwen-VL 等`,
          Date.now() - startTime
        )
      }

      this.log(context, '找到视觉模型', {
        providerId: provider.id,
        modelId: model.id
      })

      // 3. 构建提示词 - 优先使用用户自定义提示词
      // 动态追加 constraintPrompt，确保配置表单修改始终生效
      const customPrompts = config.customPrompts
      let systemPrompt = customPrompts?.system || buildVideoSystemPrompt(config)
      const userPrompt = customPrompts?.user || buildVideoUserPrompt(config)

      // 动态追加 constraintPrompt（无论是否有自定义提示词）
      if (config.constraintPrompt) {
        systemPrompt += `\n\n[额外约束]\n${config.constraintPrompt}`
      }

      this.log(context, '构建提示词', {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length
      })

      // 4. 加载图片为 base64（使用压缩版本，避免超过 API 大小限制）
      const imageBase64List = await WorkflowAiService.loadImagesForVision(images)

      if (imageBase64List.length === 0) {
        return this.error('无法加载图片文件', Date.now() - startTime)
      }

      // 5. 调用视觉 API
      this.log(context, '调用视觉 API...')

      const resultText = await WorkflowAiService.visionAnalysis(provider, model, {
        systemPrompt,
        userPrompt,
        images: imageBase64List,
        temperature: config.temperature,
        signal: context.abortSignal // 传递取消信号，支持请求取消和超时控制
      })

      this.log(context, '视觉 API 调用成功', {
        resultLength: resultText.length
      })

      // 6. 解析 JSON 结果
      const json = this.parseJsonResponse(resultText, context)

      // 7. 构建输出
      const outputs = {
        promptJson: json,
        videoPrompt: json.video_prompt || '',
        motionSequence: json.motion_sequence || [],
        safetyNotes: json.safety_notes || ''
      }

      const duration = Date.now() - startTime
      this.log(context, '节点执行完成', { duration: `${duration}ms` })

      return this.success(outputs, duration)
    } catch (error) {
      this.logError(context, '节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 解析 JSON 响应
   */
  private parseJsonResponse(resultText: string, context: NodeExecutionContext): Record<string, any> {
    try {
      // 尝试匹配 JSON 代码块
      const extracted = extractJsonFromText(resultText)
      if (extracted.ok && extracted.value && typeof extracted.value === 'object' && !Array.isArray(extracted.value)) {
        return extracted.value as Record<string, any>
      }

      const codeBlockMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1].trim())
      }

      // 尝试匹配裸 JSON
      const jsonMatch = resultText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      this.log(context, '未找到 JSON，使用原始文本')
      return { raw: resultText, video_prompt: resultText }
    } catch (e) {
      this.log(context, '解析 JSON 失败，使用原始文本', { error: String(e) })
      return { raw: resultText, video_prompt: resultText }
    }
  }
}

export default VideoPromptExecutor
