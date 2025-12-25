/**
 * 趋势分析节点执行器
 * Trend Analysis Node Executor
 *
 * 基于知识库数据分析服装趋势，生成设计建议
 */

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../../types/core'
import {
  TrendAnalysisPromptBuilder,
  type TrendAnalysisConfig
} from '../../../prompts/builders/TrendAnalysisPromptBuilder'
import { extractAndParseJson } from '../../../prompts/utils/jsonExtractor'

/**
 * 趋势分析节点配置
 */
export interface TrendAnalysisNodeConfig extends TrendAnalysisConfig {
  /** 分析模型 */
  model?: {
    id: string
    provider: string
  }
}

/**
 * 趋势分析节点执行器
 */
export class TrendAnalysisExecutor extends BaseNodeExecutor {
  constructor() {
    super('trend_analysis')
  }

  async execute(
    inputs: Record<string, any>,
    config: TrendAnalysisNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 获取知识库数据输入
      const knowledgeData = inputs.knowledge_data || inputs.results
      if (!knowledgeData) {
        return this.error('请连接知识库检索节点的输出', Date.now() - startTime)
      }

      // 2. 获取参考图片（可选）
      const images = this.collectImageInputs(inputs)

      this.log(context, '开始趋势分析...')

      // 3. 获取模型
      const { provider, model } = await this.getGeminiModel(config)
      if (!provider || !model) {
        return this.error('未配置分析模型', Date.now() - startTime)
      }

      this.log(context, `使用模型: ${model.name || model.id}`)

      // 4. 构建分析提示词
      const promptBuilder = new TrendAnalysisPromptBuilder({
        config: {
          analysisDepth: config.analysisDepth || 'standard',
          targetCategory: config.targetCategory,
          targetAudience: config.targetAudience,
          dimensions: config.dimensions || ['color', 'pattern', 'silhouette', 'style'],
          marketPosition: config.marketPosition,
          outputLanguage: config.outputLanguage
        }
      })

      const systemPrompt = promptBuilder.buildSystemPrompt()
      const userPrompt = promptBuilder.buildWithKnowledgeData(knowledgeData)

      // 5. 调用分析
      this.log(context, `分析维度: ${(config.dimensions || ['color', 'pattern', 'silhouette', 'style']).join(', ')}`)

      let analysisResult: string

      if (images.length > 0) {
        // 有图片时使用视觉分析
        const loadedImages = await WorkflowAiService.loadImagesForVision(images)
        analysisResult = await WorkflowAiService.visionAnalysis(provider, model, {
          systemPrompt,
          userPrompt,
          images: loadedImages,
          signal: context.abortSignal
        })
      } else {
        // 无图片时使用文本生成
        analysisResult = await WorkflowAiService.generateText(provider, model, {
          systemPrompt,
          userPrompt
        })
      }

      if (!analysisResult) {
        return this.error('趋势分析返回空结果', Date.now() - startTime)
      }

      // 6. 解析 JSON 结果
      const parsedResult = extractAndParseJson<Record<string, any>>(analysisResult)

      if (!parsedResult) {
        this.log(context, '无法解析为 JSON，返回原始文本')
        return this.success(
          {
            trend_report: null,
            design_suggestions: analysisResult,
            color_palette: null,
            raw: analysisResult
          },
          Date.now() - startTime
        )
      }

      // 7. 提取设计建议文本
      const designSuggestions = this.formatDesignSuggestions(parsedResult.designSuggestions || [])

      // 8. 提取推荐配色
      const colorPalette = this.extractColorPalette(parsedResult)

      this.log(context, `分析完成，生成 ${(parsedResult.designSuggestions || []).length} 条设计建议`)

      return this.success(
        {
          trend_report: parsedResult,
          design_suggestions: designSuggestions,
          color_palette: colorPalette,
          raw: analysisResult
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '趋势分析失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 格式化设计建议
   */
  private formatDesignSuggestions(suggestions: any[]): string {
    if (!suggestions || suggestions.length === 0) {
      return '暂无设计建议'
    }

    return suggestions
      .map((s, i) => {
        const parts = [`${i + 1}. ${s.title || '设计建议'}`]
        if (s.description) parts.push(`   描述: ${s.description}`)
        if (s.category) parts.push(`   品类: ${s.category}`)
        if (s.keyFeatures) parts.push(`   特点: ${s.keyFeatures.join(', ')}`)
        if (s.colorPalette) parts.push(`   配色: ${s.colorPalette.join(', ')}`)
        if (s.estimatedAppeal) parts.push(`   预估吸引力: ${s.estimatedAppeal}%`)
        return parts.join('\n')
      })
      .join('\n\n')
  }

  /**
   * 提取推荐配色
   */
  private extractColorPalette(result: Record<string, any>): any {
    const palette: any = {
      trending: [],
      suggested: []
    }

    // 从颜色趋势中提取
    if (result.colorTrends) {
      palette.trending = result.colorTrends.slice(0, 5).map((c: any) => ({
        color: c.color,
        hex: c.hexCode,
        trend: c.trend
      }))
    }

    // 从设计建议中提取
    if (result.designSuggestions) {
      const allColors: string[] = []
      for (const s of result.designSuggestions) {
        if (s.colorPalette) {
          allColors.push(...s.colorPalette)
        }
      }
      palette.suggested = [...new Set(allColors)].slice(0, 10)
    }

    return palette
  }
}
