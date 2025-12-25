/**
 * 知识库检索节点执行器
 * Fashion Knowledge Node Executor
 *
 * 从知识库检索服装趋势和设计参考
 */

import store from '@renderer/store'
import { searchKnowledgeBase } from '@renderer/services/KnowledgeService'
import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../../types/core'
import { GarmentAnalysisPromptBuilder } from '../../../prompts/builders/GarmentAnalysisPromptBuilder'
import { extractAndParseJson } from '../../../prompts/utils/jsonExtractor'

/**
 * 知识库检索节点配置
 */
export interface FashionKnowledgeNodeConfig {
  /** 知识库 ID */
  knowledgeBaseId?: string
  /** 查询类型 */
  queryType?: 'comprehensive' | 'color' | 'pattern' | 'style' | 'similar'
  /** 返回数量 */
  topK?: number
  /** 启用重排序 */
  enableRerank?: boolean
  /** 过滤条件 */
  filters?: string
  /** 视觉模型（用于图片分析） */
  model?: {
    id: string
    provider: string
  }
}

/**
 * 知识库检索节点执行器
 */
export class FashionKnowledgeExecutor extends BaseNodeExecutor {
  constructor() {
    super('fashion_knowledge')
  }

  async execute(
    inputs: Record<string, any>,
    config: FashionKnowledgeNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 构建查询
      let query = (inputs.query as string) || ''

      // 如果有图片输入，先进行视觉分析
      const images = this.collectImageInputs(inputs)
      if (images.length > 0) {
        this.log(context, '检测到图片输入，进行视觉分析...')
        const imageAnalysis = await this.analyzeImage(images, config, context)
        if (imageAnalysis) {
          query = query ? `${query} ${imageAnalysis}` : imageAnalysis
        }
      }

      if (!query) {
        return this.error('请提供查询内容或参考图片', Date.now() - startTime)
      }

      // 2. 获取知识库
      if (!config.knowledgeBaseId) {
        return this.error('请选择知识库', Date.now() - startTime)
      }

      const knowledgeBase = store.getState().knowledge.bases.find((kb) => kb.id === config.knowledgeBaseId)

      if (!knowledgeBase) {
        return this.error(`知识库 ${config.knowledgeBaseId} 未找到`, Date.now() - startTime)
      }

      this.log(context, `在知识库 "${knowledgeBase.name}" 中搜索: ${query.substring(0, 100)}...`)

      // 3. 根据查询类型增强查询
      const enhancedQuery = this.enhanceQuery(query, config.queryType || 'comprehensive')

      // 4. 调用知识库搜索
      const searchResults = await searchKnowledgeBase(enhancedQuery, knowledgeBase, undefined, context.nodeId)

      if (!searchResults || searchResults.length === 0) {
        this.log(context, '未找到相关结果')
        return this.success(
          {
            results: [],
            summary: '未找到相关的趋势或设计参考',
            references: []
          },
          Date.now() - startTime
        )
      }

      this.log(context, `找到 ${searchResults.length} 条相关结果`)

      // 5. 提取结构化信息
      const structuredData = this.extractStructuredData(searchResults, config)

      // 6. 提取参考图片
      const referenceImages = searchResults
        .filter((r) => r.file?.origin_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map((r) => r.file?.name)
        .filter(Boolean)
        .slice(0, 10)

      return this.success(
        {
          results: structuredData,
          summary: this.generateSummary(searchResults),
          references: referenceImages,
          rawResults: searchResults.map((r) => ({
            content: r.pageContent,
            score: r.score,
            source: r.metadata?.source
          }))
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '知识库检索失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 分析输入图片
   */
  private async analyzeImage(
    images: any[],
    config: FashionKnowledgeNodeConfig,
    context: NodeExecutionContext
  ): Promise<string | null> {
    try {
      const { provider, model } = await this.getGeminiModel(config)
      if (!provider || !model) {
        this.log(context, '未配置视觉模型，跳过图片分析')
        return null
      }

      const promptBuilder = new GarmentAnalysisPromptBuilder({
        config: { detailLevel: 'basic' }
      })

      // 加载图片为 base64
      const loadedImages = await WorkflowAiService.loadImagesForVision(images)

      const result = await WorkflowAiService.visionAnalysis(provider, model, {
        systemPrompt: promptBuilder.buildSystemPrompt(),
        userPrompt: promptBuilder.buildUserPrompt(),
        images: loadedImages,
        signal: context.abortSignal
      })

      // 提取关键词用于搜索
      const parsed = extractAndParseJson<Record<string, any>>(result)
      if (parsed) {
        const keywords: string[] = []
        if (parsed.category) keywords.push(parsed.category)
        if (parsed.primaryColor) keywords.push(parsed.primaryColor)
        if (parsed.pattern) keywords.push(parsed.pattern)
        if (parsed.styleTags) keywords.push(...(parsed.styleTags as string[]))
        return keywords.join(' ')
      }

      return result
    } catch (error) {
      this.log(context, `图片分析失败: ${error}`)
      return null
    }
  }

  /**
   * 根据查询类型增强查询
   */
  private enhanceQuery(query: string, queryType: string): string {
    const enhancements: Record<string, string> = {
      comprehensive: query,
      color: `color trend ${query} fashion palette`,
      pattern: `pattern print ${query} fashion textile`,
      style: `style trend ${query} fashion aesthetic`,
      similar: `similar design ${query}`
    }
    return enhancements[queryType] || query
  }

  /**
   * 提取结构化数据
   */
  private extractStructuredData(results: any[], _config: FashionKnowledgeNodeConfig): any {
    // 简单的结构化提取
    const colorMentions: Record<string, number> = {}
    const patternMentions: Record<string, number> = {}
    const styleMentions: Record<string, number> = {}

    for (const result of results) {
      const content = result.pageContent?.toLowerCase() || ''

      // 提取颜色关键词
      const colors = ['red', 'blue', 'green', 'pink', 'black', 'white', 'beige', 'navy', 'coral', 'sage']
      for (const color of colors) {
        if (content.includes(color)) {
          colorMentions[color] = (colorMentions[color] || 0) + 1
        }
      }

      // 提取图案关键词
      const patterns = ['floral', 'stripes', 'plaid', 'solid', 'graphic', 'abstract', 'geometric']
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          patternMentions[pattern] = (patternMentions[pattern] || 0) + 1
        }
      }

      // 提取风格关键词
      const styles = ['casual', 'formal', 'streetwear', 'minimalist', 'romantic', 'sporty', 'bohemian']
      for (const style of styles) {
        if (content.includes(style)) {
          styleMentions[style] = (styleMentions[style] || 0) + 1
        }
      }
    }

    return {
      topColors: Object.entries(colorMentions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([color, count]) => ({ color, frequency: count })),
      topPatterns: Object.entries(patternMentions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, frequency: count })),
      topStyles: Object.entries(styleMentions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([style, count]) => ({ style, frequency: count })),
      documentCount: results.length
    }
  }

  /**
   * 生成摘要
   */
  private generateSummary(results: any[]): string {
    if (results.length === 0) {
      return '未找到相关结果'
    }

    const topResults = results.slice(0, 3)
    const summaryParts = topResults.map((r) => {
      const content = r.pageContent || ''
      return content.substring(0, 150) + (content.length > 150 ? '...' : '')
    })

    return `找到 ${results.length} 条相关结果。摘要:\n${summaryParts.join('\n\n')}`
  }
}
