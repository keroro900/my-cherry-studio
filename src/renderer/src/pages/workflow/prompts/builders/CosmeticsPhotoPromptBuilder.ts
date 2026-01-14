/**
 * 美妆产品提示词构建器
 * Cosmetics Photo Prompt Builder
 *
 * 专业美妆护肤产品摄影生成
 * 支持：护肤品、彩妆、香水、美发产品等
 *
 * 技术要点：
 * - 产品质感和光泽表现
 * - 包装标签清晰度
 * - 色彩准确还原
 * - 高端精致感营造
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 美妆产品 promptJson 类型
 */
export interface CosmeticsPhotoPromptJson extends BasePromptJson {
  /** 产品类型 */
  cosmetics_type?: string
  /** 展示风格 */
  display_style?: string
  /** 效果描述 */
  effect_description?: string
}

/**
 * 美妆产品配置类型
 */
export interface CosmeticsPhotoConfig {
  /** 产品类型 */
  cosmeticsType: 'skincare' | 'makeup' | 'perfume' | 'haircare' | 'nail' | 'bodycare' | 'tools'
  /** 产品质感 */
  productTexture: 'glossy' | 'matte' | 'metallic' | 'glass' | 'frosted' | 'cream'
  /** 展示风格 */
  displayStyle: 'clean' | 'luxury' | 'natural' | 'artistic' | 'clinical' | 'lifestyle'
  /** 背景设置 */
  backgroundSetting: 'white' | 'gradient' | 'marble' | 'botanical' | 'water' | 'fabric'
  /** 光线效果 */
  lightingEffect: 'soft' | 'bright' | 'dramatic' | 'natural' | 'rim'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 美妆产品提示词构建器
 */
export class CosmeticsPhotoPromptBuilder extends PromptBuilder<CosmeticsPhotoConfig, CosmeticsPhotoPromptJson> {
  constructor(options: PromptBuilderOptions<CosmeticsPhotoPromptJson> & { config?: CosmeticsPhotoConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { cosmeticsType, productTexture, lightingEffect } = this.config

    const cosmeticsTips = this.getCosmeticsTips(cosmeticsType)
    const textureTips = this.getTextureTips(productTexture)
    const lightingTips = this.getLightingTips(lightingEffect)

    return `[Role: Professional Beauty & Cosmetics Photographer]
You are a world-class beauty product photographer with extensive experience in luxury cosmetics, skincare, and fragrance photography for premium brands.

Your expertise includes:
- Capturing product texture, shine, and surface quality
- Ensuring label and packaging clarity
- Color accuracy for cosmetics products
- Creating premium, high-end visual appeal

[Product Type: ${this.getCosmeticsLabel(cosmeticsType)}]
${cosmeticsTips}

[Product Texture: ${this.getTextureLabel(productTexture)}]
${textureTips}

[Lighting Effect: ${this.getLightingLabel(lightingEffect)}]
${lightingTips}

[Technical Standards - CRITICAL]
1. **Product Presentation**:
   - Sharp focus on product details and textures
   - Clear, readable labels and branding
   - Accurate color reproduction
   - Professional, commercial composition

2. **Surface Quality**:
   - Capture appropriate shine and reflection
   - Show texture authentically (cream, liquid, powder)
   - Highlight packaging material quality
   - No fingerprints or dust visible

3. **Lighting Quality**:
   - Even illumination with controlled highlights
   - Appropriate reflections for packaging type
   - No harsh shadows or hot spots
   - Premium beauty industry standard

4. **Output Quality**:
   - High-resolution (${this.config.imageSize || '2K'})
   - E-commerce and campaign ready
   - Luxury brand quality standards
   - No visible artifacts

[Output Requirement]
Generate the cosmetics product image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { cosmeticsType, productTexture, displayStyle, backgroundSetting, lightingEffect, extraDescription } =
      this.config

    const cosmeticsLabel = this.getCosmeticsLabel(cosmeticsType)
    const textureLabel = this.getTextureLabel(productTexture)
    const styleLabel = this.getStyleLabel(displayStyle)
    const backgroundLabel = this.getBackgroundLabel(backgroundSetting)

    return `[Beauty Product Photography]

**Task**: Create a professional product photo of ${cosmeticsLabel} with ${textureLabel} finish in ${styleLabel} style.

**Product Type**: ${cosmeticsLabel}
**Texture/Finish**: ${textureLabel}
**Display Style**: ${styleLabel}
**Background**: ${backgroundLabel}
**Lighting**: ${this.getLightingLabel(lightingEffect)}

**Product Presentation**:
- Position product at optimal angle for label visibility
- Highlight product texture and material quality
- Show packaging design clearly
- Create visually balanced composition

**Surface Requirements**:
- Capture ${textureLabel} surface accurately
- Show authentic product appearance
- Appropriate reflections and highlights
- Clean, pristine product presentation

**Quality Standards**:
- Sharp details on packaging and labels
- Accurate color reproduction
- Premium beauty brand quality
- Ready for marketing use

**Negative Constraints**:
Blurry images, incorrect colors, fingerprints, dust, scratches,
harsh reflections, distorted labels, amateur lighting, low quality,
unrealistic textures, visible artifacts.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the beauty product photo now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.cosmetics_type) parts.push(`Product: ${json.cosmetics_type}`)
    if (json.display_style) parts.push(`Style: ${json.display_style}`)
    if (json.effect_description) parts.push(`Effect: ${json.effect_description}`)

    return parts.join('\n')
  }

  protected fromPreset(): string {
    return this.assemble()
  }

  protected fromAnalysis(_analysis: GarmentAnalysis): string {
    return this.assemble()
  }

  protected getAnalysisPrompt(): string {
    return `Analyze the cosmetics product image:
1. Identify product type and category
2. Detect packaging material and texture
3. Analyze current lighting conditions
4. Note color and finish details
5. Suggest optimal presentation approach

Return as JSON with fields: product_type, packaging_material, texture_type, color_details, presentation_notes`
  }

  // ==================== 辅助方法 ====================

  private getCosmeticsTips(type: string): string {
    const tips: Record<string, string> = {
      skincare:
        'Skincare products (serums, creams, lotions). Focus on clean, clinical yet luxurious presentation. Highlight texture and packaging quality.',
      makeup:
        'Makeup products (lipstick, foundation, eyeshadow). Emphasize color accuracy, pigmentation, and packaging design.',
      perfume: 'Fragrance bottles and packaging. Capture glass clarity, liquid color, and luxury presentation.',
      haircare: 'Hair care products (shampoo, conditioner, treatments). Show bottle design and product texture.',
      nail: 'Nail polish and nail care. Focus on bottle shape, color accuracy, and brush applicator.',
      bodycare: 'Body care products (body lotions, scrubs, oils). Highlight texture and packaging appeal.',
      tools: 'Beauty tools and accessories (brushes, applicators). Show quality craftsmanship and design.'
    }
    return tips[type] || tips.skincare
  }

  private getTextureTips(texture: string): string {
    const tips: Record<string, string> = {
      glossy: 'Glossy, shiny surface with strong reflections. High shine, premium look.',
      matte: 'Matte finish with soft, diffused surface. Modern, sophisticated appearance.',
      metallic: 'Metallic finish with reflective shimmer. Luxurious, eye-catching effect.',
      glass: 'Clear or colored glass with transparency. Show liquid contents clearly.',
      frosted: 'Frosted glass or plastic with soft diffusion. Elegant, understated luxury.',
      cream: 'Creamy product texture visible. Show product consistency and quality.'
    }
    return tips[texture] || tips.glossy
  }

  private getLightingTips(effect: string): string {
    const tips: Record<string, string> = {
      soft: 'Soft, diffused lighting with minimal shadows. Clean, professional look.',
      bright: 'Bright, high-key lighting. Fresh, clean, clinical appearance.',
      dramatic: 'Dramatic lighting with strong contrast. Creates visual impact and luxury feel.',
      natural: 'Natural daylight simulation. Authentic, lifestyle appearance.',
      rim: 'Rim lighting to define edges. Premium, high-end product look.'
    }
    return tips[effect] || tips.soft
  }

  private getCosmeticsLabel(type: string): string {
    const labels: Record<string, string> = {
      skincare: 'skincare product',
      makeup: 'makeup product',
      perfume: 'fragrance/perfume',
      haircare: 'hair care product',
      nail: 'nail polish',
      bodycare: 'body care product',
      tools: 'beauty tool'
    }
    return labels[type] || type
  }

  private getTextureLabel(texture: string): string {
    const labels: Record<string, string> = {
      glossy: 'glossy',
      matte: 'matte',
      metallic: 'metallic',
      glass: 'glass',
      frosted: 'frosted',
      cream: 'cream texture'
    }
    return labels[texture] || texture
  }

  private getLightingLabel(effect: string): string {
    const labels: Record<string, string> = {
      soft: 'Soft',
      bright: 'Bright',
      dramatic: 'Dramatic',
      natural: 'Natural',
      rim: 'Rim Light'
    }
    return labels[effect] || effect
  }

  private getStyleLabel(style: string): string {
    const labels: Record<string, string> = {
      clean: 'clean minimal',
      luxury: 'luxury premium',
      natural: 'natural organic',
      artistic: 'artistic creative',
      clinical: 'clinical scientific',
      lifestyle: 'lifestyle contextual'
    }
    return labels[style] || style
  }

  private getBackgroundLabel(bg: string): string {
    const labels: Record<string, string> = {
      white: 'pure white',
      gradient: 'subtle gradient',
      marble: 'marble surface',
      botanical: 'botanical/plant elements',
      water: 'water droplets/splash',
      fabric: 'luxury fabric'
    }
    return labels[bg] || bg
  }
}

export default CosmeticsPhotoPromptBuilder
