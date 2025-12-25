/**
 * 产品描述生成节点执行器
 * Product Description Node Executor
 *
 * 使用文本模型生成电商产品描述
 * 支持可选的图片输入用于视觉分析
 */

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { extractJsonFromText } from '../../../utils/extractJson'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import type { ProductDescriptionConfig, ProductDescriptionOutput } from './types'

export class ProductDescriptionExecutor extends BaseNodeExecutor {
  constructor() {
    super('product_description')
  }

  async execute(
    inputs: Record<string, any>,
    config: ProductDescriptionConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行产品描述生成节点', {
      platform: config.platform,
      language: config.language,
      toneStyle: config.toneStyle
    })

    try {
      // 1. 收集输入
      const productInfo = inputs.productInfo || inputs.product_info || ''
      const features = inputs.features || ''
      const image = inputs.image

      if (!productInfo && !image) {
        return this.error('请提供产品信息或产品图片', Date.now() - startTime)
      }

      this.log(context, '收集输入', {
        hasProductInfo: !!productInfo,
        productInfoLength: productInfo.length,
        hasFeatures: !!features,
        hasImage: !!image
      })

      // 2. 选择模型
      const modelResult = await this.selectModel(config, context)
      if (!modelResult) {
        return this.error('请在节点配置中选择一个文本模型', Date.now() - startTime)
      }
      const { provider, model } = modelResult

      this.log(context, '找到模型', {
        providerId: provider.id,
        modelId: model.id
      })

      // 3. 构建提示词
      const customPrompts = config.customPrompts
      const systemPrompt = customPrompts?.system || buildSystemPrompt(config)
      const userPrompt = customPrompts?.user || buildUserPrompt(config, productInfo, features, !!image)

      this.log(context, '构建提示词', {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length
      })

      // 4. 调用 API
      let resultText: string

      if (image) {
        // 有图片输入，使用视觉分析 API
        this.log(context, '使用视觉分析 API（包含产品图片）')

        const imageBase64List = await WorkflowAiService.loadImagesForVision([image])

        if (imageBase64List.length === 0) {
          return this.error('无法加载产品图片', Date.now() - startTime)
        }

        resultText = await WorkflowAiService.visionAnalysis(provider, model, {
          systemPrompt,
          userPrompt,
          images: imageBase64List,
          temperature: config.temperature,
          signal: context.abortSignal
        })
      } else {
        // 纯文本输入，使用文本生成 API
        this.log(context, '使用文本生成 API')

        resultText = await WorkflowAiService.generateText(provider, model, {
          systemPrompt,
          userPrompt,
          temperature: config.temperature
        })
      }

      this.log(context, 'API 调用成功', {
        resultLength: resultText.length
      })

      // 5. 解析 JSON 结果
      const parsedResult = this.parseJsonResponse(resultText, context)

      // 6. 构建输出
      const output: ProductDescriptionOutput = {
        title: parsedResult.title || '',
        description: parsedResult.description || '',
        bullets: Array.isArray(parsedResult.bullets) ? parsedResult.bullets : [],
        seoKeywords: Array.isArray(parsedResult.seoKeywords) ? parsedResult.seoKeywords : [],
        rawJson: parsedResult
      }

      const duration = Date.now() - startTime
      this.log(context, '节点执行完成', {
        duration: `${duration}ms`,
        titleLength: output.title.length,
        bulletCount: output.bullets.length,
        seoKeywordCount: output.seoKeywords.length
      })

      return this.success(
        {
          title: output.title,
          description: output.description,
          bullets: output.bullets,
          seoKeywords: output.seoKeywords,
          json: output.rawJson
        },
        duration
      )
    } catch (error) {
      this.logError(context, '节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 选择模型
   */
  private async selectModel(config: ProductDescriptionConfig, context: NodeExecutionContext) {
    const providerId = config.providerId
    const modelId = config.modelId

    this.log(context, '模型配置', {
      providerId,
      modelId
    })

    if (!providerId || !modelId) {
      this.log(context, '错误：未选择模型')
      return null
    }

    return WorkflowAiService.findModel(providerId, modelId)
  }

  /**
   * 解析 JSON 响应
   */
  private parseJsonResponse(resultText: string, context: NodeExecutionContext): Record<string, any> {
    try {
      // 尝试使用工具函数提取 JSON
      const extracted = extractJsonFromText(resultText)
      if (extracted.ok && extracted.value && typeof extracted.value === 'object' && !Array.isArray(extracted.value)) {
        return extracted.value as Record<string, any>
      }

      // 尝试匹配代码块
      const codeBlockMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1].trim())
      }

      // 尝试匹配裸 JSON
      const jsonMatch = resultText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // 如果无法解析为 JSON，创建基本结构
      this.log(context, 'JSON 解析失败，使用原始文本构建输出')
      return {
        title: '',
        description: resultText,
        bullets: [],
        seoKeywords: []
      }
    } catch (e) {
      this.log(context, '解析 JSON 失败', { error: String(e) })
      return {
        title: '',
        description: resultText,
        bullets: [],
        seoKeywords: []
      }
    }
  }
}

export default ProductDescriptionExecutor
