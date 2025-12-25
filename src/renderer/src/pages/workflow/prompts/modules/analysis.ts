/**
 * 分析模块
 * Analysis Module
 *
 * 提供服装分析的提示词模板
 * 用于让 AI 分析服装图片并返回结构化信息
 */

import type { GarmentAnalysis, PromptModule } from './types'

/**
 * 电商图服装分析提示词
 */
export const ECOM_ANALYSIS_PROMPT = `Analyze this garment image and provide structured information for e-commerce photo generation.

Return a JSON object with these fields:
{
  "garment_type": "t-shirt / pants / dress / pajama set / etc.",
  "prints_patterns": "description of prints, patterns, graphics",
  "ip_character": "IP character name if any (Disney, Sanrio, etc.) or null",
  "theme": "sweet / sporty / street / kpop / school / minimalist / etc.",
  "colors": ["main colors"],
  "fabric_texture": "cotton / polyester / knit / etc.",
  "structural_details": "collar type, sleeve style, special features",
  "recommended_background": "suggested background style",
  "recommended_props": ["suggested props based on theme"],
  "recommended_lighting": "suggested lighting style"
}

Be specific about IP characters - identify exact character names (e.g., "Elsa from Frozen", "Hello Kitty", "Spider-Man").
For themed pajamas, note BOTH the theme AND that it's sleepwear.`

/**
 * 模特图服装分析提示词
 */
export const MODEL_ANALYSIS_PROMPT = `Analyze this garment image for model photography.

Return a JSON object with these fields:
{
  "garment_type": "type of garment",
  "fit_style": "loose / slim / regular",
  "best_pose": "standing / walking / sitting",
  "recommended_angle": "front / 3/4 / side",
  "colors": ["main colors"],
  "mood": "casual / formal / sporty / etc.",
  "target_demographic": "kids / teens / adults",
  "scene_suggestion": "indoor studio / outdoor / lifestyle"
}`

/**
 * 图案分析提示词
 */
export const PATTERN_ANALYSIS_PROMPT = `Analyze this pattern/print design.

Return a JSON object with these fields:
{
  "pattern_type": "floral / geometric / character / abstract / etc.",
  "style": "cartoon / realistic / minimalist / etc.",
  "colors": ["colors used"],
  "repeat_type": "seamless / placement / all-over",
  "suitable_for": ["t-shirts", "dresses", "etc."],
  "mood": "playful / elegant / bold / etc."
}`

/**
 * 分析模块
 */
export const AnalysisModule = {
  /**
   * 获取电商图分析提示词
   */
  getEcomPrompt(): string {
    return ECOM_ANALYSIS_PROMPT
  },

  /**
   * 获取模特图分析提示词
   */
  getModelPrompt(): string {
    return MODEL_ANALYSIS_PROMPT
  },

  /**
   * 获取图案分析提示词
   */
  getPatternPrompt(): string {
    return PATTERN_ANALYSIS_PROMPT
  },

  /**
   * 将分析结果转换为提示词模块
   * @param analysis 分析结果
   */
  toModule(analysis: GarmentAnalysis): PromptModule {
    const lines = [
      '[Garment Analysis Result]',
      `Type: ${analysis.garment_type}`,
      analysis.prints_patterns ? `Prints/Patterns: ${analysis.prints_patterns}` : null,
      analysis.ip_character ? `IP Character: ${analysis.ip_character}` : null,
      analysis.theme ? `Theme: ${analysis.theme}` : null,
      `Colors: ${analysis.colors.join(', ')}`,
      analysis.fabric_texture ? `Fabric: ${analysis.fabric_texture}` : null,
      analysis.structural_details ? `Details: ${analysis.structural_details}` : null
    ].filter(Boolean)

    return {
      type: 'analysis',
      text: lines.join('\n'),
      priority: 85
    }
  },

  /**
   * 解析 AI 返回的 JSON 字符串为分析结果
   * @param jsonString AI 返回的 JSON 字符串
   */
  parseResult(jsonString: string): GarmentAnalysis | null {
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0])

      return {
        garment_type: parsed.garment_type || 'unknown',
        prints_patterns: parsed.prints_patterns,
        ip_character: parsed.ip_character,
        theme: parsed.theme,
        colors: Array.isArray(parsed.colors) ? parsed.colors : [],
        fabric_texture: parsed.fabric_texture,
        structural_details: parsed.structural_details,
        recommended_background: parsed.recommended_background,
        recommended_props: Array.isArray(parsed.recommended_props) ? parsed.recommended_props : undefined,
        recommended_lighting: parsed.recommended_lighting
      }
    } catch {
      return null
    }
  }
}
