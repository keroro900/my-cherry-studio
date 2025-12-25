/**
 * A+ 内容 / 详情页生成执行器
 * A+ Content / Detail Page Node Executor
 *
 * 专业级电商详情页内容生成：
 * - 多图深度分析提取产品信息
 * - 结构化内容生成
 * - 多平台适配
 * - SEO 优化
 */

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { extractJsonFromText } from '../../../utils/extractJson'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import { buildImageAnalysisPrompt, buildMultiImageAnalysisPrompt, buildSystemPrompt, buildUserPrompt } from './prompts'
import type { AplusContentConfig, AplusContentOutput, AplusModuleContent } from './types'

export class AplusContentExecutor extends BaseNodeExecutor {
  constructor() {
    super('aplus_content')
  }

  async execute(
    inputs: Record<string, any>,
    config: AplusContentConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行详情页生成节点', {
      platform: config.platform,
      moduleCount: config.moduleTypes?.length,
      language: config.language,
      contentStyle: config.contentStyle,
      enableDeepAnalysis: config.enableDeepAnalysis
    })

    try {
      // 1. 收集输入
      const productInfo = inputs.productInfo || inputs.text || ''
      const promptJson = inputs.promptJson

      // 收集所有图片输入（支持动态端口）
      const productImages = this.collectImageInputs(inputs, config)

      // 2. 验证配置
      if (!config.moduleTypes || config.moduleTypes.length === 0) {
        return this.error('请至少选择一个内容模块类型', Date.now() - startTime)
      }

      this.log(context, '收集输入', {
        hasProductInfo: !!productInfo,
        productInfoLength: productInfo.length,
        hasPromptJson: !!promptJson,
        imageCount: productImages.length
      })

      // 3. 选择模型
      const modelResult = await this.selectModel(config, context)
      if (!modelResult) {
        return this.error('请在节点配置中选择一个支持视觉分析的 AI 模型', Date.now() - startTime)
      }
      const { provider, model } = modelResult

      this.log(context, '找到模型', {
        providerId: provider.id,
        modelId: model.id
      })

      // 4. 图片分析
      let enhancedProductInfo = productInfo
      if (productImages.length > 0 && config.enableDeepAnalysis !== false) {
        this.log(context, `分析 ${productImages.length} 张产品图片...`)
        try {
          const imageAnalysis = await this.analyzeProductImages(
            productImages,
            provider,
            model,
            context
          )
          if (imageAnalysis) {
            enhancedProductInfo = productInfo
              ? `${productInfo}\n\n[Product Visual Analysis]\n${imageAnalysis}`
              : `[Product Visual Analysis from ${productImages.length} Image(s)]\n${imageAnalysis}`
            this.log(context, '图片分析完成', { analysisLength: imageAnalysis.length })
          }
        } catch (err) {
          this.log(context, '图片分析失败，继续使用文本信息', { error: String(err) })
        }
      }

      // 5. 如果有 promptJson，合并信息
      if (promptJson) {
        const jsonInfo = typeof promptJson === 'string' ? promptJson : JSON.stringify(promptJson, null, 2)
        enhancedProductInfo = enhancedProductInfo
          ? `${enhancedProductInfo}\n\n[Structured Product Data]\n${jsonInfo}`
          : `[Structured Product Data]\n${jsonInfo}`
      }

      // 6. 构建提示词
      const customPrompts = config.customPrompts
      const systemPrompt = customPrompts?.system || buildSystemPrompt(config)
      const userPrompt = customPrompts?.user || buildUserPrompt(config, enhancedProductInfo)

      this.log(context, '构建提示词', {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length
      })

      // 7. 调用文本生成 API
      this.log(context, `生成 ${config.moduleTypes.length} 个详情页模块内容...`)

      const resultText = await WorkflowAiService.generateText(provider, model, {
        systemPrompt,
        userPrompt,
        temperature: config.temperature ?? 0.7
      })

      this.log(context, 'API 调用成功', {
        resultLength: resultText.length
      })

      // 8. 解析 JSON 结果
      const output = this.parseAplusResponse(resultText, config, context)

      // 9. 提取额外输出
      const seoKeywords = config.enableSeoKeywords !== false
        ? this.extractSeoKeywords(output)
        : null
      const imageSuggestions = config.enableImageSuggestions !== false
        ? this.extractImageSuggestions(output)
        : null

      const duration = Date.now() - startTime
      this.log(context, '节点执行完成', {
        duration: `${duration}ms`,
        moduleCount: output.modules.length,
        hasSeoKeywords: !!seoKeywords,
        hasImageSuggestions: !!imageSuggestions
      })

      return this.success(
        {
          modules: output.modules,
          pageSummary: output.pageSummary,
          fullContent: this.formatModulesAsText(output.modules),
          seoKeywords,
          imageSuggestions,
          rawJson: output.rawJson
        },
        duration
      )
    } catch (error) {
      this.logError(context, '节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 收集所有图片输入
   */
  private collectImageInputs(inputs: Record<string, any>, config: AplusContentConfig): string[] {
    const images: string[] = []

    // 从动态端口收集
    const imageInputPorts = config.imageInputPorts || []
    for (const port of imageInputPorts) {
      const image = inputs[port.id]
      if (image) {
        images.push(image)
      }
    }

    // 也检查旧的 image_N 格式
    for (let i = 1; i <= 10; i++) {
      const image = inputs[`image_${i}`]
      if (image && !images.includes(image)) {
        images.push(image)
      }
    }

    // 兼容单图输入
    if (inputs.image && !images.includes(inputs.image)) {
      images.push(inputs.image)
    }

    return images
  }

  /**
   * 分析产品图片
   */
  private async analyzeProductImages(
    images: string[],
    provider: any,
    model: any,
    context: NodeExecutionContext
  ): Promise<string | null> {
    try {
      const imageBase64List = await WorkflowAiService.loadImagesForVision(images)

      if (imageBase64List.length === 0) {
        return null
      }

      // 根据图片数量选择分析提示词
      const analysisPrompt = imageBase64List.length > 1
        ? buildMultiImageAnalysisPrompt(imageBase64List.length)
        : buildImageAnalysisPrompt()

      const analysisResult = await WorkflowAiService.visionAnalysis(provider, model, {
        systemPrompt: `You are an expert product analyst and e-commerce content strategist.
Analyze the product image(s) with the precision of a professional buyer and merchandiser.
Extract every detail that could be used to create compelling product detail page content.`,
        userPrompt: analysisPrompt,
        images: imageBase64List,
        temperature: 0.3,
        signal: context.abortSignal
      })

      return analysisResult
    } catch (err) {
      this.log(context, '图片分析出错', { error: String(err) })
      return null
    }
  }

  /**
   * 选择模型
   */
  private async selectModel(config: AplusContentConfig, context: NodeExecutionContext) {
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
   * 解析 A+ 内容响应
   */
  private parseAplusResponse(
    resultText: string,
    config: AplusContentConfig,
    context: NodeExecutionContext
  ): AplusContentOutput {
    try {
      // 尝试使用工具函数提取 JSON
      const extracted = extractJsonFromText(resultText)
      if (extracted.ok && extracted.value && typeof extracted.value === 'object' && !Array.isArray(extracted.value)) {
        const parsed = extracted.value as Record<string, any>
        return this.buildOutputFromParsed(parsed)
      }

      // 尝试匹配代码块
      const codeBlockMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        const parsed = JSON.parse(codeBlockMatch[1].trim())
        return this.buildOutputFromParsed(parsed)
      }

      // 尝试匹配裸 JSON
      const jsonMatch = resultText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return this.buildOutputFromParsed(parsed)
      }

      // 如果无法解析为 JSON，创建基本结构
      this.log(context, 'JSON 解析失败，使用原始文本构建输出')
      return this.buildFallbackOutput(resultText, config)
    } catch (e) {
      this.log(context, '解析 JSON 失败', { error: String(e) })
      return this.buildFallbackOutput(resultText, config)
    }
  }

  /**
   * 从解析的 JSON 构建输出
   */
  private buildOutputFromParsed(parsed: Record<string, any>): AplusContentOutput {
    const modules: AplusModuleContent[] = (parsed.modules || []).map((m: any) => ({
      type: m.type,
      moduleName: m.moduleName || m.type,
      headline: m.headline,
      body: m.body,
      captions: m.captions || [],
      imageCount: m.imageCount || 0,
      imageSuggestions: m.imageSuggestions || [],
      designNotes: m.designNotes
    }))

    return {
      modules,
      pageSummary: parsed.pageSummary || 'Detail page content generated successfully',
      rawJson: parsed
    }
  }

  /**
   * 构建回退输出
   */
  private buildFallbackOutput(resultText: string, config: AplusContentConfig): AplusContentOutput {
    const modules: AplusModuleContent[] = config.moduleTypes.map((type) => ({
      type,
      moduleName: type,
      body: resultText,
      imageCount: 0
    }))

    return {
      modules,
      pageSummary: 'Content generated (raw format)',
      rawJson: { raw: resultText }
    }
  }

  /**
   * 提取 SEO 关键词
   */
  private extractSeoKeywords(output: AplusContentOutput): Record<string, string> | null {
    const rawJson = output.rawJson
    if (rawJson.keywordUsage) {
      return rawJson.keywordUsage
    }
    if (rawJson.seoKeywords) {
      return rawJson.seoKeywords
    }
    // 从模块内容中提取
    const keywords: Record<string, string> = {}
    output.modules.forEach((m) => {
      if (m.headline) {
        // 提取首个关键短语
        const words = m.headline.split(' ').slice(0, 3).join(' ')
        if (words) {
          keywords[words] = `Used in ${m.moduleName} headline`
        }
      }
    })
    return Object.keys(keywords).length > 0 ? keywords : null
  }

  /**
   * 提取图片建议
   */
  private extractImageSuggestions(output: AplusContentOutput): Record<string, string[]> | null {
    const suggestions: Record<string, string[]> = {}
    output.modules.forEach((m) => {
      if (m.imageSuggestions && m.imageSuggestions.length > 0) {
        suggestions[m.moduleName || m.type] = m.imageSuggestions
      }
    })
    return Object.keys(suggestions).length > 0 ? suggestions : null
  }

  /**
   * 将模块格式化为文本输出
   */
  private formatModulesAsText(modules: AplusModuleContent[]): string {
    return modules
      .map((m, i) => {
        const parts: string[] = [`## Module ${i + 1}: ${m.moduleName}`]

        if (m.headline) {
          parts.push(`**Headline**: ${m.headline}`)
        }
        if (m.body) {
          parts.push(`**Body**: ${m.body}`)
        }
        if (m.captions && m.captions.length > 0) {
          parts.push(`**Captions**:\n${m.captions.map((c, j) => `  ${j + 1}. ${c}`).join('\n')}`)
        }
        if (m.imageSuggestions && m.imageSuggestions.length > 0) {
          parts.push(`**Image Suggestions**:\n${m.imageSuggestions.map((s, j) => `  ${j + 1}. ${s}`).join('\n')}`)
        }
        if ((m as any).designNotes) {
          parts.push(`**Design Notes**: ${(m as any).designNotes}`)
        }

        return parts.join('\n')
      })
      .join('\n\n---\n\n')
  }
}

export default AplusContentExecutor
