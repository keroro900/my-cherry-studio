/**
 * 服装分析提示词构建器
 * Garment Analysis Prompt Builder
 *
 * 用于分析服装图片，提取结构化属性
 * 支持预设品类、分析粒度等配置
 */

import type { GarmentAnalysis } from '../modules/types'
import { getFashionCategoryPreset } from '../presets/fashionCategory'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 服装分析 promptJson 类型
 */
export interface GarmentAnalysisPromptJson extends BasePromptJson {
  /** 目标品类 */
  category?: string
  /** 分析粒度 */
  detailLevel?: 'basic' | 'standard' | 'detailed'
}

/**
 * 服装分析配置类型
 */
export interface GarmentAnalysisConfig {
  /** 分析粒度 */
  detailLevel?: 'basic' | 'standard' | 'detailed'
  /** 提取颜色 */
  extractColors?: boolean
  /** 提取图案 */
  extractPatterns?: boolean
  /** 目标品类 */
  targetCategory?: string
  /** 输出语言 */
  outputLanguage?: 'en' | 'zh'
}

/**
 * 服装分析提示词构建器
 *
 * 使用示例：
 * ```typescript
 * const builder = new GarmentAnalysisPromptBuilder({
 *   config: {
 *     detailLevel: 'standard',
 *     extractColors: true,
 *     extractPatterns: true,
 *     targetCategory: 'tops'
 *   }
 * })
 *
 * const { prompt, source } = builder.build()
 * ```
 */
export class GarmentAnalysisPromptBuilder extends PromptBuilder<GarmentAnalysisConfig, GarmentAnalysisPromptJson> {
  constructor(options: PromptBuilderOptions<GarmentAnalysisPromptJson> & { config?: GarmentAnalysisConfig }) {
    super(options)
    this.initializeModules()
  }

  /**
   * 初始化基础模块
   */
  private initializeModules(): void {
    // 添加角色定义
    this.withCustomBlock(
      'role',
      `[Role: Professional Fashion Analyst]
You are an expert fashion analyst specializing in garment attribute extraction for e-commerce platforms.
Your analysis will be used for trend identification, product categorization, and search optimization.
You have extensive experience with fast-fashion brands like SHEIN, TEMU, and Zaful.`,
      100
    )

    // 添加分析规则
    this.withCustomBlock(
      'analysis_rules',
      `[Analysis Rules]
1. Identify the garment category and subcategory precisely
2. Extract exact color information using standard color names (e.g., "coral pink" not just "pink")
3. Describe patterns accurately with scale (small/medium/large) and placement
4. Note structural details (collar type, sleeve length, hem style)
5. Infer material based on visual texture cues (sheen, drape, weave)
6. Assign relevant style tags for searchability (e.g., "Y2K", "cottagecore", "minimalist")
7. Consider target audience based on styling and fit`,
      90
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
    // 服装分析节点不需要从分析结果构建，直接返回默认
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
    const categoryPreset = config.targetCategory ? getFashionCategoryPreset(config.targetCategory) : null

    const detailInstructions = {
      basic: 'Provide essential attributes only: category, primary color, pattern type.',
      standard: 'Provide complete attribute analysis with colors, patterns, structure, and style tags.',
      detailed:
        'Provide comprehensive analysis with material inference, styling suggestions, and market positioning.'
    }

    const outputFormat =
      config.outputLanguage === 'zh'
        ? `{
  "category": "上装|下装|连衣裙|外套|配饰",
  "subcategory": "具体类型",
  "primaryColor": "主色名称",
  "secondaryColors": ["颜色1", "颜色2"],
  "colorTone": "warm|cool|neutral",
  "pattern": "solid|stripes|plaid|floral|abstract|graphic|character",
  "patternScale": "small|medium|large",
  "patternDescription": "图案详细描述",
  "silhouette": "fitted|relaxed|oversized",
  "neckline": "如适用",
  "sleeveLength": "如适用",
  "length": "short|medium|long",
  "material": ["推断材质"],
  "styleTags": ["风格1", "风格2"],
  "targetAudience": "kids|teens|adults",
  "gender": "male|female|unisex",
  "season": ["适合季节"]
}`
        : `{
  "category": "tops|bottoms|dresses|outerwear|accessories",
  "subcategory": "specific type",
  "primaryColor": "main color name",
  "secondaryColors": ["color1", "color2"],
  "colorTone": "warm|cool|neutral",
  "pattern": "solid|stripes|plaid|floral|abstract|graphic|character",
  "patternScale": "small|medium|large",
  "patternDescription": "detailed pattern description",
  "silhouette": "fitted|relaxed|oversized",
  "neckline": "if applicable",
  "sleeveLength": "if applicable",
  "length": "short|medium|long",
  "material": ["inferred materials"],
  "styleTags": ["style1", "style2"],
  "targetAudience": "kids|teens|adults",
  "gender": "male|female|unisex",
  "season": ["suitable seasons"]
}`

    return `[Task: Garment Attribute Extraction]

Analyze the garment image and extract structured attributes for e-commerce cataloging.

${categoryPreset ? `[Target Category: ${categoryPreset.nameZh} (${categoryPreset.name})]\n${categoryPreset.analysisPrompt}\nKey features to analyze: ${categoryPreset.keyFeatures.join(', ')}\n` : ''}

[Detail Level: ${config.detailLevel || 'standard'}]
${detailInstructions[config.detailLevel || 'standard']}

${config.extractColors !== false ? '[Color Extraction: Enabled]\nExtract primary color, secondary colors, and overall color tone (warm/cool/neutral).\nUse descriptive color names (e.g., "dusty rose", "sage green", "burnt orange").\n' : ''}

${config.extractPatterns !== false ? '[Pattern Extraction: Enabled]\nIdentify pattern type, scale (small/medium/large), and placement.\nFor prints with characters or text, describe them specifically.\n' : ''}

[Output Format]
Return a JSON object with the following structure:
${outputFormat}

[Output Constraints]
- Return ONLY the JSON object, no additional text
- All string values must be in English (except for Chinese output mode)
- Use standardized, searchable color names
- Be specific with pattern descriptions for SEO purposes
- Style tags should be current and trend-relevant`
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    return `You are a professional fashion analyst with expertise in garment categorization and trend analysis.
Your task is to analyze clothing images and extract precise, structured attributes.
You work with fast-fashion e-commerce platforms and understand their cataloging needs.
Focus on accuracy, consistency, and commercial relevance in your classifications.
Your analysis should be suitable for product search optimization and trend tracking.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    return this.buildDefaultPrompt()
  }
}
