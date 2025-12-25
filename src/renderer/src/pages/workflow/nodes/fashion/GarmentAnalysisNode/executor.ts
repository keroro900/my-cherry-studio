/**
 * 服装分析节点执行器
 * Garment Analysis Node Executor
 *
 * 分析服装图片，提取结构化属性
 */

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../../types/core'
import {
  GarmentAnalysisPromptBuilder,
  type GarmentAnalysisConfig
} from '../../../prompts/builders/GarmentAnalysisPromptBuilder'
import { extractAndParseJson } from '../../../prompts/utils/jsonExtractor'

/**
 * 服装分析节点配置
 */
export interface GarmentAnalysisNodeConfig extends GarmentAnalysisConfig {
  /** 视觉模型 */
  model?: {
    id: string
    provider: string
  }
}

/**
 * 服装分析节点执行器
 */
export class GarmentAnalysisExecutor extends BaseNodeExecutor {
  constructor() {
    super('garment_analysis')
  }

  async execute(
    inputs: Record<string, any>,
    config: GarmentAnalysisNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 收集图片输入
      const images = this.collectImageInputs(inputs)
      if (images.length === 0) {
        return this.error('没有找到服装图片输入', Date.now() - startTime)
      }

      this.log(context, `开始分析 ${images.length} 张服装图片`)

      // 2. 获取模型
      const { provider, model } = await this.getGeminiModel(config)
      if (!provider || !model) {
        return this.error('未配置视觉分析模型', Date.now() - startTime)
      }

      this.log(context, `使用模型: ${model.name || model.id}`)

      // 3. 构建分析提示词
      const promptBuilder = new GarmentAnalysisPromptBuilder({
        config: {
          detailLevel: config.detailLevel || 'standard',
          extractColors: config.extractColors !== false,
          extractPatterns: config.extractPatterns !== false,
          targetCategory: config.targetCategory,
          outputLanguage: config.outputLanguage || 'en'
        }
      })

      const systemPrompt = promptBuilder.buildSystemPrompt()
      const userPrompt = promptBuilder.buildUserPrompt()

      // 4. 调用视觉分析
      this.log(context, '正在分析服装属性...')

      // 加载图片为 base64
      const loadedImages = await WorkflowAiService.loadImagesForVision(images)

      const analysisResult = await WorkflowAiService.visionAnalysis(provider, model, {
        systemPrompt,
        userPrompt,
        images: loadedImages,
        signal: context.abortSignal
      })

      if (!analysisResult) {
        return this.error('视觉分析返回空结果', Date.now() - startTime)
      }

      // 5. 解析 JSON 结果
      const parsedAttributes = extractAndParseJson<Record<string, any>>(analysisResult)

      if (!parsedAttributes) {
        this.log(context, '无法解析为 JSON，返回原始文本')
        return this.success(
          {
            attributes: null,
            colors: null,
            description: analysisResult,
            raw: analysisResult
          },
          Date.now() - startTime
        )
      }

      // 6. 提取颜色信息
      const colors = {
        primary: parsedAttributes.primaryColor,
        secondary: parsedAttributes.secondaryColors || [],
        tone: parsedAttributes.colorTone
      }

      // 7. 生成描述文本
      const description = this.generateDescription(parsedAttributes)

      this.log(context, `分析完成: ${parsedAttributes.category} - ${parsedAttributes.subcategory}`)

      return this.success(
        {
          attributes: parsedAttributes,
          colors,
          description,
          raw: analysisResult
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '服装分析失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 生成服装描述文本
   */
  private generateDescription(attributes: Record<string, any>): string {
    const parts: string[] = []

    if (attributes.category) {
      parts.push(`Category: ${attributes.category}`)
    }
    if (attributes.subcategory) {
      parts.push(`Type: ${attributes.subcategory}`)
    }
    if (attributes.primaryColor) {
      parts.push(`Primary Color: ${attributes.primaryColor}`)
    }
    if (attributes.pattern && attributes.pattern !== 'solid') {
      parts.push(`Pattern: ${attributes.pattern}`)
    }
    if (attributes.silhouette) {
      parts.push(`Fit: ${attributes.silhouette}`)
    }
    if (attributes.styleTags && attributes.styleTags.length > 0) {
      parts.push(`Style: ${attributes.styleTags.join(', ')}`)
    }

    return parts.join(' | ')
  }
}
