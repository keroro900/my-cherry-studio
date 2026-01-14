/**
 * 产品场景合成提示词构建器
 * Product Scene Composition Prompt Builder
 *
 * 将产品融入指定场景
 * 支持：摄影棚、户外、生活场景、极简、奢华
 *
 * 技术要点：
 * - 光影融合与匹配
 * - 透视与比例协调
 * - 风格一致性
 * - 自然场景融合
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 产品场景 promptJson 类型
 */
export interface ProductScenePromptJson extends BasePromptJson {
  /** 场景类型 */
  scene_type?: string
  /** 光影风格 */
  lighting_style?: string
  /** 氛围风格 */
  mood_style?: string
  /** 场景描述 */
  scene_description?: string
}

/**
 * 产品场景配置类型
 */
export interface ProductSceneConfig {
  /** 场景类型 */
  sceneType: 'studio' | 'outdoor' | 'lifestyle' | 'minimalist' | 'luxury'
  /** 光影风格 */
  lightingStyle: 'natural' | 'studio' | 'dramatic' | 'soft'
  /** 氛围风格 */
  moodStyle: 'professional' | 'warm' | 'cool' | 'vibrant'
  /** 产品类型 */
  productType?: 'general' | 'fashion' | 'electronics' | 'cosmetics' | 'home'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 产品场景合成提示词构建器
 */
export class ProductScenePromptBuilder extends PromptBuilder<ProductSceneConfig, ProductScenePromptJson> {
  constructor(options: PromptBuilderOptions<ProductScenePromptJson> & { config?: ProductSceneConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { sceneType, lightingStyle, moodStyle } = this.config

    const sceneTips = this.getSceneTips(sceneType)
    const lightingTips = this.getLightingTips(lightingStyle)
    const moodTips = this.getMoodTips(moodStyle)

    return `[Role: Master Product Photographer & Compositor]
You are an expert product photographer and digital compositor with 15+ years of experience creating commercial imagery for top brands.

Your expertise includes:
- Seamless product-scene integration
- Lighting matching and shadow generation
- Perspective and scale correction
- Professional post-production

[Scene Type: ${this.getSceneLabel(sceneType)}]
${sceneTips}

[Lighting Style: ${this.getLightingLabel(lightingStyle)}]
${lightingTips}

[Mood & Atmosphere: ${this.getMoodLabel(moodStyle)}]
${moodTips}

[Technical Standards - CRITICAL]
1. **Integration**:
   - Product must look naturally placed in scene
   - Matching lighting direction and color temperature
   - Realistic shadows and reflections
   - Correct perspective and scale

2. **Quality**:
   - High-resolution output (${this.config.imageSize || '2K'})
   - Sharp product focus
   - Natural scene blur/bokeh where appropriate
   - Professional commercial quality

3. **Consistency**:
   - Color harmony between product and scene
   - Style consistency throughout
   - No obvious compositing artifacts

4. **Composition**:
   - Product as clear hero element
   - Balanced visual weight
   - Appropriate negative space
   - Eye-catching but natural placement

[Output Requirement]
Generate high-resolution product scene image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { sceneType, lightingStyle, moodStyle, productType, extraDescription } = this.config

    const sceneLabel = this.getSceneLabel(sceneType)
    const sceneDescription = this.getSceneDescription(sceneType)
    const lightingLabel = this.getLightingLabel(lightingStyle)
    const moodLabel = this.getMoodLabel(moodStyle)

    return `[Product Scene Composition]

**Task**: Composite the product naturally into a ${sceneLabel} scene.

**Scene Environment**:
${sceneDescription}

**Lighting**: ${lightingLabel}
**Mood**: ${moodLabel}
${productType ? `**Product Category**: ${this.getProductTypeLabel(productType)}` : ''}

**Camera Settings**:
- Professional full-frame camera
- 35mm-85mm lens depending on scene
- Appropriate depth of field
- Eye-level or slightly elevated angle

**Integration Requirements**:
- Match lighting direction with scene
- Add appropriate shadows and reflections
- Ensure correct scale and perspective
- Blend colors harmoniously

**Quality Standards**:
- Sharp focus on product
- Natural scene integration
- Professional commercial look
- Ready for advertising use

**Negative Constraints**:
Obvious compositing, mismatched lighting, wrong perspective, floating product,
harsh edges, color mismatch, unnatural shadows, low quality, amateur look.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the product scene composite now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.scene_type) parts.push(`Scene: ${json.scene_type}`)
    if (json.lighting_style) parts.push(`Lighting: ${json.lighting_style}`)
    if (json.mood_style) parts.push(`Mood: ${json.mood_style}`)
    if (json.scene_description) parts.push(`Description: ${json.scene_description}`)

    return parts.join('\n')
  }

  protected fromPreset(): string {
    return this.assemble()
  }

  protected fromAnalysis(_analysis: GarmentAnalysis): string {
    return this.assemble()
  }

  protected getAnalysisPrompt(): string {
    return `Analyze the product and suggest optimal scene placement:
1. Identify product type and category
2. Suggest best scene types
3. Recommend lighting approach
4. Note any special integration considerations
5. Suggest composition style

Return as JSON with fields: product_type, recommended_scenes, lighting_notes, integration_tips`
  }

  // ==================== 辅助方法 ====================

  private getSceneTips(scene: string): string {
    const tips: Record<string, string> = {
      studio: 'Clean, controlled environment. Seamless backgrounds. Perfect for highlighting product details.',
      outdoor: 'Natural environments. Consider weather, time of day, and natural elements. Lifestyle appeal.',
      lifestyle: 'Real-world context. Show product in use. Relatable and aspirational settings.',
      minimalist: 'Clean, simple backgrounds. Focus entirely on product. Modern aesthetic.',
      luxury: 'Premium materials and settings. High-end lifestyle. Exclusive feel.'
    }
    return tips[scene] || tips.studio
  }

  private getLightingTips(lighting: string): string {
    const tips: Record<string, string> = {
      natural: 'Soft, diffused daylight. Golden hour warmth. Window light with fill. Natural shadows.',
      studio: 'Controlled multi-light setup. Key, fill, and rim lights. Precise shadow control.',
      dramatic: 'Strong directional light. Deep shadows. High contrast. Bold and impactful.',
      soft: 'Heavily diffused light. Minimal shadows. Even illumination. Gentle gradients.'
    }
    return tips[lighting] || tips.natural
  }

  private getMoodTips(mood: string): string {
    const tips: Record<string, string> = {
      professional: 'Clean, corporate feel. Neutral tones. Business-appropriate. Trustworthy appearance.',
      warm: 'Inviting and cozy. Warm color temperature. Comfortable and approachable.',
      cool: 'Modern and sleek. Cool tones. Technology-forward. Clean and precise.',
      vibrant: 'Bold and energetic. Saturated colors. Dynamic and eye-catching.'
    }
    return tips[mood] || tips.professional
  }

  private getSceneLabel(scene: string): string {
    const labels: Record<string, string> = {
      studio: 'Studio',
      outdoor: 'Outdoor',
      lifestyle: 'Lifestyle',
      minimalist: 'Minimalist',
      luxury: 'Luxury'
    }
    return labels[scene] || scene
  }

  private getLightingLabel(lighting: string): string {
    const labels: Record<string, string> = {
      natural: 'Natural Light',
      studio: 'Studio Lighting',
      dramatic: 'Dramatic',
      soft: 'Soft & Diffused'
    }
    return labels[lighting] || lighting
  }

  private getMoodLabel(mood: string): string {
    const labels: Record<string, string> = {
      professional: 'Professional',
      warm: 'Warm & Inviting',
      cool: 'Cool & Modern',
      vibrant: 'Vibrant & Energetic'
    }
    return labels[mood] || mood
  }

  private getProductTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      general: 'General Product',
      fashion: 'Fashion/Apparel',
      electronics: 'Electronics/Tech',
      cosmetics: 'Cosmetics/Beauty',
      home: 'Home/Lifestyle'
    }
    return labels[type] || type
  }

  private getSceneDescription(scene: string): string {
    const descriptions: Record<string, string> = {
      studio: `- Clean seamless backdrop (white, gray, or colored)
- Professional lighting setup
- Controlled, distraction-free environment
- Focus entirely on product`,
      outdoor: `- Natural outdoor environment
- Real sunlight and natural elements
- Contextual placement (park, street, nature)
- Lifestyle appeal with environmental storytelling`,
      lifestyle: `- Real-world usage context
- Home, office, or everyday settings
- Product shown in use or natural placement
- Relatable and aspirational`,
      minimalist: `- Ultra-clean composition
- Single color or gradient background
- Maximum product focus
- Modern, design-forward aesthetic`,
      luxury: `- Premium materials (marble, velvet, gold accents)
- Sophisticated setting
- Exclusive, high-end atmosphere
- Aspirational lifestyle context`
    }
    return descriptions[scene] || descriptions.studio
  }
}

export default ProductScenePromptBuilder
