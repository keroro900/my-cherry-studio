/**
 * 趋势分析提示词构建器
 * Trend Analysis Prompt Builder
 *
 * 用于分析服装趋势，生成设计建议
 * 支持多维度分析、分析深度等配置
 */

import type { GarmentAnalysis } from '../modules/types'
import { buildDimensionAnalysisPrompt } from '../presets/trendDimension'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 趋势分析 promptJson 类型
 */
export interface TrendAnalysisPromptJson extends BasePromptJson {
  /** 知识库数据 */
  knowledgeData?: unknown
  /** 分析维度 */
  dimensions?: string[]
}

/**
 * 趋势分析配置类型
 */
export interface TrendAnalysisConfig {
  /** 分析深度 */
  analysisDepth?: 'quick' | 'standard' | 'deep'
  /** 目标品类 */
  targetCategory?: string
  /** 目标人群 */
  targetAudience?: string
  /** 分析维度 */
  dimensions?: string[]
  /** 市场定位 */
  marketPosition?: 'budget' | 'mid-range' | 'premium'
  /** 输出语言 */
  outputLanguage?: 'en' | 'zh'
}

/**
 * 趋势分析提示词构建器
 *
 * 使用示例：
 * ```typescript
 * const builder = new TrendAnalysisPromptBuilder({
 *   config: {
 *     analysisDepth: 'standard',
 *     targetCategory: 'tops',
 *     dimensions: ['color', 'pattern', 'style']
 *   }
 * })
 *
 * const { prompt, source } = builder.build()
 * ```
 */
export class TrendAnalysisPromptBuilder extends PromptBuilder<TrendAnalysisConfig, TrendAnalysisPromptJson> {
  constructor(options: PromptBuilderOptions<TrendAnalysisPromptJson> & { config?: TrendAnalysisConfig }) {
    super(options)
    this.initializeModules()
  }

  /**
   * 初始化基础模块
   */
  private initializeModules(): void {
    this.withCustomBlock(
      'role',
      `[Role: Fashion Trend Analyst]
You are a senior fashion trend analyst specializing in fast-fashion e-commerce markets (SHEIN, TEMU, Zaful).
Your insights drive product development and inventory decisions worth millions of dollars.
You combine data analysis with fashion intuition to identify actionable trends.`,
      100
    )

    this.withCustomBlock(
      'market_context',
      `[Market Context]
Fast-fashion e-commerce characteristics:
- Rapid trend turnover (2-4 week cycles)
- Price-sensitive consumers seeking trendy looks
- Heavy social media influence (TikTok, Instagram)
- Global audience with regional variations
- High SKU volume requiring quick decisions`,
      85
    )
  }

  /**
   * 从上游 promptJson 构建提示词
   */
  protected fromPromptJson(): string {
    return this.promptJson?.full_prompt || this.buildDefaultPrompt()
  }

  /**
   * 从预设构建提示词
   */
  protected fromPreset(): string {
    return this.buildDefaultPrompt()
  }

  /**
   * 从分析结果构建提示词
   */
  protected fromAnalysis(_analysis: GarmentAnalysis): string {
    return this.buildDefaultPrompt()
  }

  /**
   * 获取分析提示词
   */
  protected getAnalysisPrompt(): string {
    return this.buildDefaultPrompt()
  }

  /**
   * 构建默认提示词
   */
  private buildDefaultPrompt(): string {
    const config = this.config
    const dimensions = config.dimensions || ['color', 'pattern', 'silhouette', 'style']

    const depthInstructions = {
      quick: `Provide a brief summary with:
- Top 3 trends per dimension
- Quick actionable insights
- 1-2 design suggestions`,
      standard: `Provide comprehensive analysis with:
- Top 5 trends per dimension with popularity scores
- Trend direction (rising/stable/declining)
- 3-5 detailed design suggestions with color palettes`,
      deep: `Provide in-depth analysis with:
- Complete trend mapping with market context
- Competitor landscape insights
- Detailed design briefs with specifications
- Risk assessment and timing recommendations`
    }

    const marketPositionContext = {
      budget: 'Focus on cost-effective materials and simple construction. Prioritize high-volume, trend-led pieces.',
      'mid-range': 'Balance trend-forward design with quality materials. Consider versatility and styling options.',
      premium: 'Emphasize quality, unique details, and elevated styling. Focus on differentiation and perceived value.'
    }

    // 构建维度分析提示
    const dimensionPrompts = buildDimensionAnalysisPrompt(dimensions)

    return `[Task: Fashion Trend Analysis]

Based on the provided knowledge base data and reference images, analyze current fashion trends for product development.

[Analysis Depth: ${config.analysisDepth || 'standard'}]
${depthInstructions[config.analysisDepth || 'standard']}

${config.targetCategory ? `[Target Category: ${config.targetCategory}]\n` : ''}
${config.targetAudience ? `[Target Audience: ${config.targetAudience}]\n` : ''}
${config.marketPosition ? `[Market Position: ${config.marketPosition}]\n${marketPositionContext[config.marketPosition]}\n` : ''}

[Analysis Dimensions]
${dimensionPrompts}

[Output Format]
Return a JSON object with the following structure:
{
  "summary": "Overall trend summary (100-200 words)",
  "colorTrends": [
    {
      "color": "color name",
      "hexCode": "#XXXXXX",
      "popularity": 0-100,
      "trend": "rising|stable|declining",
      "context": "usage context and pairing suggestions"
    }
  ],
  "patternTrends": [
    {
      "pattern": "pattern type",
      "popularity": 0-100,
      "trend": "rising|stable|declining",
      "scale": "small|medium|large",
      "examples": ["example1", "example2"]
    }
  ],
  "silhouetteTrends": [
    {
      "silhouette": "silhouette description",
      "fit": "fitted|relaxed|oversized",
      "popularity": 0-100,
      "trend": "rising|stable|declining"
    }
  ],
  "styleTrends": [
    {
      "style": "style name",
      "description": "style description",
      "popularity": 0-100,
      "keyElements": ["element1", "element2"],
      "influencers": ["social media, celebrity, etc."]
    }
  ],
  "designSuggestions": [
    {
      "title": "suggestion title",
      "description": "detailed design brief",
      "category": "target category",
      "colorPalette": ["#XXXXXX", "#XXXXXX", "#XXXXXX"],
      "keyFeatures": ["feature1", "feature2"],
      "targetAudience": "target audience description",
      "estimatedAppeal": 0-100,
      "priority": "high|medium|low"
    }
  ],
  "marketInsights": "Market context, competitor landscape, and timing recommendations (for deep analysis)",
  "riskFactors": ["potential risks or considerations"]
}

[Output Constraints]
- Return ONLY the JSON object
- Base all insights on the provided data, not assumptions
- Include specific, actionable design suggestions
- Quantify popularity and trend direction where possible
- Prioritize commercially viable trends over niche aesthetics
- Consider production feasibility for fast-fashion`
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const config = this.config

    return `You are a senior fashion trend analyst with 10+ years of experience in fast-fashion e-commerce.
Your analysis should be:
- Data-driven and grounded in the provided information
- Actionable for product development teams
- Commercially viable and aligned with fast-fashion economics
- Timely and aware of trend lifecycles

${config.targetAudience ? `You are analyzing trends for ${config.targetAudience} consumers.` : ''}
${config.marketPosition ? `The target market position is ${config.marketPosition}.` : ''}

Focus on trends that can be quickly translated into product development with realistic lead times.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    return this.buildDefaultPrompt()
  }

  /**
   * 构建带知识库数据的提示词
   * @param knowledgeData 知识库检索结果
   */
  buildWithKnowledgeData(knowledgeData: unknown): string {
    const basePrompt = this.buildDefaultPrompt()

    return `${basePrompt}

[Knowledge Base Data]
The following data has been retrieved from the fashion knowledge base. Use this as the primary source for your analysis:

\`\`\`json
${JSON.stringify(knowledgeData, null, 2)}
\`\`\`

Analyze the above data and provide trend insights based on the patterns you observe.`
  }
}
