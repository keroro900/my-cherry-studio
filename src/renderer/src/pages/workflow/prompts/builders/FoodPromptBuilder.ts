/**
 * 食品摄影提示词构建器
 * Food Photography Prompt Builder
 *
 * 专门用于生成专业食品产品摄影图片
 * 支持：饮品、甜点、主菜、零食、原料
 *
 * 技术要点：
 * - 食品新鲜感与色彩饱和
 * - 蒸汽/水珠等动态效果
 * - 摆盘与构图技巧
 * - 食欲诱惑表现
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 食品摄影 promptJson 类型
 */
export interface FoodPromptJson extends BasePromptJson {
  /** 食品类别 */
  food_category?: string
  /** 风格预设 */
  style_preset?: string
  /** 氛围预设 */
  mood_preset?: string
  /** 效果描述 */
  effects_description?: string
}

/**
 * 食品摄影配置类型
 */
export interface FoodConfig {
  /** 食品类别 */
  foodCategory: 'beverage' | 'dessert' | 'main_dish' | 'snack' | 'ingredient'
  /** 风格预设 */
  stylePreset: 'minimalist' | 'rustic' | 'modern' | 'traditional'
  /** 氛围预设 */
  moodPreset: 'warm' | 'fresh' | 'cozy' | 'elegant'
  /** 启用蒸汽效果 */
  enableSteam?: boolean
  /** 启用水珠效果 */
  enableDroplets?: boolean
  /** 背景风格 */
  backgroundStyle: 'white' | 'wood' | 'marble' | 'dark' | 'colorful'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 食品摄影提示词构建器
 */
export class FoodPromptBuilder extends PromptBuilder<FoodConfig, FoodPromptJson> {
  constructor(options: PromptBuilderOptions<FoodPromptJson> & { config?: FoodConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { foodCategory, stylePreset, moodPreset } = this.config

    const categoryTips = this.getCategoryTips(foodCategory)
    const styleTips = this.getStyleTips(stylePreset)
    const moodTips = this.getMoodTips(moodPreset)

    return `[Role: Master Food Photographer & Stylist]
You are a world-class food photographer with 15+ years of experience shooting for Michelin-starred restaurants, food magazines, and premium brands.

Your expertise includes:
- Food styling and presentation
- Creating appetizing, mouth-watering imagery
- Lighting techniques for food photography
- Color enhancement and freshness portrayal

[Food Category Expertise: ${this.getCategoryLabel(foodCategory)}]
${categoryTips}

[Style Direction: ${this.getStyleLabel(stylePreset)}]
${styleTips}

[Mood & Atmosphere: ${this.getMoodLabel(moodPreset)}]
${moodTips}

[Technical Standards - CRITICAL]
1. **Freshness**:
   - Food must look fresh, appetizing, and ready to eat
   - Highlight natural textures and surfaces
   - No wilting, melting, or deterioration

2. **Color & Saturation**:
   - Enhance natural food colors
   - Avoid oversaturation that looks artificial
   - Maintain true-to-life appearance

3. **Composition**:
   - Rule of thirds or centered composition
   - Proper negative space
   - Thoughtful prop placement

4. **Quality**:
   - High-resolution output (${this.config.imageSize || '2K'})
   - Sharp focus on hero element
   - Professional commercial quality

[Output Requirement]
Generate high-resolution food product image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { foodCategory, stylePreset, moodPreset, backgroundStyle, enableSteam, enableDroplets, extraDescription } =
      this.config

    const categoryLabel = this.getCategoryLabel(foodCategory)
    const styleLabel = this.getStyleLabel(stylePreset)
    const moodLabel = this.getMoodLabel(moodPreset)
    const backgroundDescription = this.getBackgroundDescription(backgroundStyle)

    return `[Food Product Photography]

**Subject**: Professional product photo of ${categoryLabel}.

**Style**: ${styleLabel}
**Mood**: ${moodLabel}
**Background**: ${backgroundDescription}

**Camera Settings**:
- Canon EOS R5 or equivalent
- 50mm or 85mm lens
- f/4-f/5.6 for selective focus
- Tripod mounted

**Lighting Requirements**:
- Soft, natural-looking light
- Side lighting to emphasize texture
- Subtle fill to lift shadows
- Highlight glossy/wet surfaces appropriately

**Special Effects**:
${enableSteam ? '- Add subtle, realistic steam rising from hot food (if appropriate)' : '- No steam effect'}
${enableDroplets ? '- Add fresh water droplets/condensation on surface (if appropriate)' : '- No water droplets'}

**Focus Points**:
- Sharp focus on main subject
- Beautiful bokeh on background
- Highlight textures and details
- Make it look delicious and appetizing

**Enhancement Requirements**:
- Natural color vibrancy
- Appetizing presentation
- Professional food styling
- Commercial quality finish

**Negative Constraints**:
Artificial coloring, oversaturation, plastic appearance, stale food,
unappealing presentation, harsh shadows, overexposure, underexposure,
motion blur, soft focus, cluttered composition, low quality, amateur look.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the food product photo now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.food_category) parts.push(`Food category: ${json.food_category}`)
    if (json.style_preset) parts.push(`Style: ${json.style_preset}`)
    if (json.mood_preset) parts.push(`Mood: ${json.mood_preset}`)
    if (json.effects_description) parts.push(`Effects: ${json.effects_description}`)

    return parts.join('\n')
  }

  protected fromPreset(): string {
    return this.assemble()
  }

  protected fromAnalysis(_analysis: GarmentAnalysis): string {
    return this.assemble()
  }

  protected getAnalysisPrompt(): string {
    return `Analyze the food in the image:
1. Identify the food type (beverage, dessert, main dish, snack, ingredient)
2. Describe the presentation style
3. Note any special characteristics (texture, color, garnishes)
4. Identify the mood/atmosphere
5. Suggest optimal photography approach

Return as JSON with fields: food_category, style_preset, mood_preset, presentation_notes, photography_tips`
  }

  // ==================== 辅助方法 ====================

  private getCategoryTips(category: string): string {
    const tips: Record<string, string> = {
      beverage:
        'Capture liquid clarity, ice textures, condensation. Use backlight for transparent drinks. Show refreshing appeal.',
      dessert:
        'Highlight sweetness through color and texture. Capture frosting details, chocolate sheen, fruit freshness.',
      main_dish:
        'Show steam from hot dishes. Emphasize protein textures, sauce glossiness, vegetable colors.',
      snack: 'Capture crunch and texture. Show crispy edges, seasoning details, bite-sized appeal.',
      ingredient:
        'Showcase natural beauty and freshness. Highlight organic textures, color gradients, natural imperfections.'
    }
    return tips[category] || tips.main_dish
  }

  private getStyleTips(style: string): string {
    const tips: Record<string, string> = {
      minimalist:
        'Clean, simple composition. Minimal props. Focus on the food itself. White space is essential.',
      rustic:
        'Wooden surfaces, natural textures. Imperfect, artisanal feel. Earth tones and organic materials.',
      modern:
        'Sleek, contemporary aesthetic. Geometric compositions. Bold colors and clean lines.',
      traditional: 'Classic food photography. Rich, warm tones. Abundant, generous presentation.'
    }
    return tips[style] || tips.modern
  }

  private getMoodTips(mood: string): string {
    const tips: Record<string, string> = {
      warm: 'Golden lighting, cozy atmosphere. Comfort food feeling. Inviting and homey.',
      fresh:
        'Bright, airy lighting. Crisp colors. Clean and healthy vibe. Morning light quality.',
      cozy: 'Soft, intimate lighting. Comfort and nostalgia. Steam and warmth.',
      elegant: 'Sophisticated lighting. Refined presentation. Restaurant-quality plating.'
    }
    return tips[mood] || tips.warm
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      beverage: 'beverage/drink',
      dessert: 'dessert/sweet treat',
      main_dish: 'main dish/entrée',
      snack: 'snack/appetizer',
      ingredient: 'fresh ingredient/produce'
    }
    return labels[category] || category
  }

  private getStyleLabel(style: string): string {
    const labels: Record<string, string> = {
      minimalist: 'Minimalist',
      rustic: 'Rustic',
      modern: 'Modern',
      traditional: 'Traditional'
    }
    return labels[style] || style
  }

  private getMoodLabel(mood: string): string {
    const labels: Record<string, string> = {
      warm: 'Warm & Inviting',
      fresh: 'Fresh & Bright',
      cozy: 'Cozy & Comfortable',
      elegant: 'Elegant & Refined'
    }
    return labels[mood] || mood
  }

  private getBackgroundDescription(style: string): string {
    const descriptions: Record<string, string> = {
      white: 'Clean white surface, minimal and modern',
      wood: 'Natural wooden table or cutting board, rustic warmth',
      marble: 'Elegant marble surface, sophisticated and premium',
      dark: 'Dark moody background, dramatic contrast',
      colorful: 'Vibrant colored surface that complements the food'
    }
    return descriptions[style] || descriptions.white
  }
}

export default FoodPromptBuilder
