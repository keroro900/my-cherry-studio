/**
 * 统一提示词节点执行器
 *
 * 支持三种输出模式：
 * - model: 模特提示词 JSON
 * - pattern: 图案提示词 JSON
 * - ecom: 电商图提示词 JSON
 * - all: 全部输出
 */

import { isVisionModel } from '@renderer/config/models/vision'

import { PromptBuilder } from '../../../prompts/builders/PromptBuilder'
import { WorkflowAiService } from '../../../services/WorkflowAiService'
import type {
  AllModesPromptJson,
  EcomPromptJson,
  ModelPromptJson,
  OutputMode,
  PatternPromptJson
} from '../../../types/prompt-json'
import { extractJsonFromText, validateJsonSchema } from '../../../utils/extractJson'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import {
  buildAllModesSystemPrompt,
  buildAllModesUserPrompt,
  buildEcomSystemPrompt,
  buildEcomUserPrompt,
  buildModelSystemPrompt,
  buildModelUserPrompt,
  buildPatternSystemPrompt,
  buildPatternUserPrompt
} from './prompts'
import type { UnifiedPromptNodeConfig } from './types'

export class UnifiedPromptExecutor extends BaseNodeExecutor {
  constructor() {
    super('unified_prompt')
  }

  async execute(
    inputs: Record<string, any>,
    config: UnifiedPromptNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const outputMode = config.outputMode || 'model'

    this.log(context, `开始执行统一提示词节点 [${outputMode} 模式]`)

    try {
      // 1. 收集图片输入
      const images = this.collectImageInputs(inputs)

      this.log(context, '收集图片输入', {
        imageCount: images.length,
        imagePaths: images.map((img) => (typeof img === 'string' ? img.substring(0, 80) : typeof img))
      })

      if (images.length === 0) {
        return this.error('统一提示词节点需要至少一张图片输入', Date.now() - startTime)
      }

      // 2. 选择模型
      const modelResult = await this.selectModel(config, context)
      if (!modelResult) {
        return this.error('请在节点配置中选择一个模型', Date.now() - startTime)
      }
      const { provider, model } = modelResult

      // 验证模型是否支持视觉功能
      if (!isVisionModel(model)) {
        return this.error(
          `选择的模型 "${model.name || model.id}" 不支持视觉功能。请选择支持视觉的模型，如 GPT-4o、Claude 3、Gemini Pro Vision、Qwen-VL 等`,
          Date.now() - startTime
        )
      }

      // 详细的调试日志 - 验证 Provider 配置是否正确
      this.log(context, '找到模型 - 完整配置', {
        providerId: provider.id,
        providerType: provider.type,
        providerApiHost: provider.apiHost,
        providerHasApiKey: !!provider.apiKey,
        modelId: model.id,
        modelProvider: model.provider
      })

      // 3. 根据 outputMode 构建提示词
      const { systemPrompt, userPrompt } = this.buildPrompts(outputMode, config)

      this.log(context, '构建提示词', {
        outputMode,
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

      // JSON 结构由系统提示词约束，模型会输出 JSON 格式的文本
      // 我们在 parseJsonResponse 中手动解析 JSON
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

      // 6. 解析并验证 JSON 结果
      const json = this.parseJsonResponse(resultText, context, outputMode)

      // 7. 根据 outputMode 构建输出
      const outputs = this.buildOutputs(json, outputMode)

      const duration = Date.now() - startTime
      this.log(context, '节点执行完成', { duration: `${duration}ms`, outputMode })

      return this.success(outputs, duration)
    } catch (error) {
      this.logError(context, '节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 选择模型
   * 使用用户在配置面板中选择的模型，跟随 Cherry 客户端原生逻辑
   */
  private async selectModel(config: UnifiedPromptNodeConfig, context: NodeExecutionContext) {
    // 从 config 中获取 providerId 和 modelId（由 WorkflowEngine 从 nodeData 注入）
    const providerId = config.providerId
    const modelId = config.modelId

    this.log(context, '模型配置', {
      providerId,
      modelId
    })

    // 必须有用户选择的模型
    if (!providerId || !modelId) {
      this.log(context, '错误：未选择模型')
      return null
    }

    // 使用 Cherry 原生的模型查找逻辑
    return WorkflowAiService.findModel(providerId, modelId)
  }

  /**
   * 根据 outputMode 构建系统提示词和用户提示词
   * 优先使用 customPrompts（用户 UI 编辑后保存），否则使用默认构建函数
   *
   * 重要：constraintPrompt 在此处动态追加，确保：
   * 1. 即使用户保存了自定义系统提示词，constraintPrompt 仍然生效
   * 2. 配置表单中的 constraintPrompt 修改始终反映到执行中
   */
  private buildPrompts(
    outputMode: OutputMode,
    config: UnifiedPromptNodeConfig
  ): { systemPrompt: string; userPrompt: string } {
    const customPrompts = config.customPrompts

    let systemPrompt: string
    let userPrompt: string

    // 优先使用用户自定义提示词
    if (customPrompts) {
      // 检查是否有针对 all 模式的颗粒度自定义
      if (outputMode === 'all') {
        const hasGranularCustom =
          customPrompts.model_system ||
          customPrompts.model_user ||
          customPrompts.pattern_system ||
          customPrompts.pattern_user ||
          customPrompts.ecom_system ||
          customPrompts.ecom_user

        if (hasGranularCustom) {
          // 使用颗粒度自定义重建 all 模式提示词
          systemPrompt = buildAllModesSystemPrompt(config, {
            model: customPrompts.model_system,
            pattern: customPrompts.pattern_system,
            ecom: customPrompts.ecom_system
          })

          userPrompt = buildAllModesUserPrompt(config, {
            model: customPrompts.model_user,
            pattern: customPrompts.pattern_user,
            ecom: customPrompts.ecom_user
          })
        } else {
          // 只有整体自定义
          const defaultPrompts = this.getDefaultPrompts(outputMode, config)
          systemPrompt = customPrompts.system || defaultPrompts.systemPrompt
          userPrompt = customPrompts.user || defaultPrompts.userPrompt
        }
      } else {
        // 非 all 模式，直接使用 customPrompts.system/user
        const defaultPrompts = this.getDefaultPrompts(outputMode, config)
        systemPrompt = customPrompts.system || defaultPrompts.systemPrompt
        userPrompt = customPrompts.user || defaultPrompts.userPrompt
      }
    } else {
      const defaultPrompts = this.getDefaultPrompts(outputMode, config)
      systemPrompt = defaultPrompts.systemPrompt
      userPrompt = defaultPrompts.userPrompt
    }

    // 准备变量
    const variables = {
      visualAnchors: config.visualAnchors || '',
      constraintPrompt: config.constraintPrompt || ''
    }

    // 检查是否使用了变量标签（用于决定是否需要追加）
    const hasVisualAnchorsTag = systemPrompt.includes('{{visualAnchors}}') || userPrompt.includes('{{visualAnchors}}')
    const hasConstraintTag =
      systemPrompt.includes('{{constraintPrompt}}') || userPrompt.includes('{{constraintPrompt}}')

    // 执行变量替换
    systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
    userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

    // 动态追加 visualAnchors (如果未使用 {{visualAnchors}} 标签)
    if (config.visualAnchors && !hasVisualAnchorsTag) {
      systemPrompt += `\n\n[Visual Anchors - STRICTLY PRESERVE]\n${config.visualAnchors}`
    }

    // 动态追加 constraintPrompt (如果未使用 {{constraintPrompt}} 标签)
    if (config.constraintPrompt && !hasConstraintTag) {
      systemPrompt += `\n\n[Additional Constraints]\n${config.constraintPrompt}`
    }

    return { systemPrompt, userPrompt }
  }

  /**
   * 获取默认提示词（内部构建函数）
   */
  private getDefaultPrompts(
    outputMode: OutputMode,
    config: UnifiedPromptNodeConfig
  ): { systemPrompt: string; userPrompt: string } {
    switch (outputMode) {
      case 'model':
        return {
          systemPrompt: buildModelSystemPrompt(config),
          userPrompt: buildModelUserPrompt(config)
        }
      case 'pattern':
        return {
          systemPrompt: buildPatternSystemPrompt(config),
          userPrompt: buildPatternUserPrompt(config)
        }
      case 'ecom':
        return {
          systemPrompt: buildEcomSystemPrompt(config),
          userPrompt: buildEcomUserPrompt(config)
        }
      case 'all':
        return {
          systemPrompt: buildAllModesSystemPrompt(config),
          userPrompt: buildAllModesUserPrompt(config)
        }
      default:
        return {
          systemPrompt: buildModelSystemPrompt(config),
          userPrompt: buildModelUserPrompt(config)
        }
    }
  }

  /**
   * 输出模式对应的必需字段
   */
  private static readonly OUTPUT_SCHEMAS: Record<string, string[]> = {
    model: ['caption', 'type'],
    pattern: ['full_prompt', 'type'],
    ecom: ['full_prompt', 'type'],
    all: ['model', 'pattern', 'ecom']
  }

  /**
   * 解析并验证 JSON 响应
   */
  private parseJsonResponse(
    resultText: string,
    context: NodeExecutionContext,
    outputMode: OutputMode
  ): Record<string, any> {
    try {
      // 尝试提取 JSON
      const extracted = extractJsonFromText(resultText)
      if (extracted.ok && extracted.value && typeof extracted.value === 'object' && !Array.isArray(extracted.value)) {
        const json = extracted.value as Record<string, any>

        // 验证 JSON 结构
        const requiredKeys = UnifiedPromptExecutor.OUTPUT_SCHEMAS[outputMode]
        if (requiredKeys) {
          const validation = validateJsonSchema(json, requiredKeys)
          if (!validation.valid) {
            this.log(context, `JSON 验证警告: ${validation.error}`, {
              missingKeys: validation.missingKeys,
              outputMode
            })
            // 软失败：记录警告但仍返回数据
          }
        }

        return json
      }

      // 尝试匹配代码块
      const codeBlockMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        const json = JSON.parse(codeBlockMatch[1].trim())
        return this.validateAndReturn(json, outputMode, context)
      }

      // 尝试匹配裸 JSON
      const jsonMatch = resultText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0])
        return this.validateAndReturn(json, outputMode, context)
      }

      this.log(context, '未找到 JSON，使用原始文本')
      return { raw: resultText }
    } catch (e) {
      this.log(context, '解析 JSON 失败，使用原始文本', { error: String(e) })
      return { raw: resultText }
    }
  }

  /**
   * 验证并返回 JSON
   */
  private validateAndReturn(
    json: Record<string, any>,
    outputMode: OutputMode,
    context: NodeExecutionContext
  ): Record<string, any> {
    const requiredKeys = UnifiedPromptExecutor.OUTPUT_SCHEMAS[outputMode]
    if (requiredKeys) {
      const validation = validateJsonSchema(json, requiredKeys)
      if (!validation.valid) {
        this.log(context, `JSON 验证警告: ${validation.error}`, {
          missingKeys: validation.missingKeys,
          outputMode
        })
      }
    }
    return json
  }

  /**
   * 根据 outputMode 构建输出
   */
  private buildOutputs(json: Record<string, any>, outputMode: OutputMode): Record<string, any> {
    const outputs: Record<string, any> = {
      promptJson: json,
      caption: '',
      videoPrompt: ''
    }

    // 处理 all 模式的嵌套结构
    if (outputMode === 'all' && json.type === 'all') {
      const allJson = json as AllModesPromptJson
      outputs.modelPromptJson = allJson.model
      outputs.patternPromptJson = allJson.pattern
      outputs.ecomPromptJson = allJson.ecom
      outputs.caption = allJson.model?.caption || allJson.ecom?.full_prompt || ''
      outputs.videoPrompt = allJson.model?.video_prompt || ''
      return outputs
    }

    // 根据 JSON 类型设置输出
    switch (json.type) {
      case 'model':
        outputs.modelPromptJson = json as ModelPromptJson
        outputs.caption = json.caption || ''
        outputs.videoPrompt = json.video_prompt || ''
        break
      case 'pattern':
        outputs.patternPromptJson = json as PatternPromptJson
        outputs.caption = json.full_prompt || ''
        break
      case 'ecom':
        outputs.ecomPromptJson = json as EcomPromptJson
        outputs.caption = json.full_prompt || ''
        break
      default:
        // 处理原始文本（JSON 解析失败时）
        if (json.raw) {
          outputs.caption = json.raw
          // 根据 outputMode 设置对应的输出
          if (outputMode === 'model') {
            outputs.modelPromptJson = { caption: json.raw }
          } else if (outputMode === 'pattern') {
            outputs.patternPromptJson = { full_prompt: json.raw }
          } else if (outputMode === 'ecom') {
            outputs.ecomPromptJson = { full_prompt: json.raw }
          }
        }
        // 兼容旧格式或未知格式
        else if (outputMode === 'model' || json.caption) {
          outputs.modelPromptJson = json
          outputs.caption = json.caption || ''
          outputs.videoPrompt = json.video_prompt || ''
        } else if (outputMode === 'pattern' || json.pattern_style) {
          outputs.patternPromptJson = json
          outputs.caption = json.full_prompt || ''
        } else if (outputMode === 'ecom' || json.display_mode) {
          outputs.ecomPromptJson = json
          outputs.caption = json.full_prompt || ''
        }
    }

    return outputs
  }
}

export default UnifiedPromptExecutor
