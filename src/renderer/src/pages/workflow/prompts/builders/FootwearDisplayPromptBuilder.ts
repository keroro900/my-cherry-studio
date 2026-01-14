/**
 * 鞋类展示提示词构建器
 * Footwear Display Prompt Builder
 *
 * 专业鞋类产品展示图片生成
 * 支持：运动鞋、皮鞋、靴子、凉鞋、休闲鞋等
 *
 * 技术要点：
 * - 鞋子角度和透视控制
 * - 材质纹理和光泽表现
 * - 背景场景搭配
 * - 专业商拍品质
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 鞋类展示 promptJson 类型
 */
export interface FootwearDisplayPromptJson extends BasePromptJson {
  /** 鞋类类型 */
  footwear_type?: string
  /** 展示角度 */
  display_angle?: string
  /** 效果描述 */
  effect_description?: string
}

/**
 * 鞋类展示配置类型
 */
export interface FootwearDisplayConfig {
  /** 鞋类类型 */
  footwearType: 'sneakers' | 'leather' | 'boots' | 'sandals' | 'loafers' | 'heels' | 'flats' | 'athletic' | 'auto'
  /** 展示角度 */
  displayAngle: 'front' | 'side' | 'back' | 'top' | 'three_quarter' | 'pair' | 'worn'
  /** 展示模式 */
  displayMode?: 'worn' | 'model_wearing' | 'product' | 'lifestyle' | 'detail'
  /** 材质风格 */
  materialStyle: 'leather' | 'canvas' | 'suede' | 'mesh' | 'synthetic' | 'fabric' | 'auto'
  /** 场景背景 */
  sceneBackground: 'white' | 'gradient' | 'lifestyle' | 'outdoor' | 'studio' | 'minimalist'
  /** 光影效果 */
  lightingEffect: 'soft' | 'dramatic' | 'natural' | 'studio' | 'rim'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 鞋类展示提示词构建器
 */
export class FootwearDisplayPromptBuilder extends PromptBuilder<FootwearDisplayConfig, FootwearDisplayPromptJson> {
  constructor(options: PromptBuilderOptions<FootwearDisplayPromptJson> & { config?: FootwearDisplayConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { footwearType, materialStyle, lightingEffect, displayMode } = this.config

    // 处理自动检测模式
    const isAutoDetect = footwearType === 'auto' || materialStyle === 'auto'

    const footwearTips = footwearType === 'auto' ? this.getAutoDetectTips() : this.getFootwearTips(footwearType)
    const materialTips = materialStyle === 'auto' ? '' : this.getMaterialTips(materialStyle)
    const lightingTips = this.getLightingTips(lightingEffect)

    // 模特穿鞋模式的特殊提示
    const modelWearingSection =
      displayMode === 'model_wearing'
        ? `
[Model Wearing Mode - CRITICAL]
This is a virtual try-on task. You must:
1. Take the provided footwear product and seamlessly place it on the model's feet
2. Maintain the original footwear's exact design, color, and details
3. Match the lighting and perspective of the model photo
4. Ensure natural foot positioning and shoe fit
5. Preserve the model's pose and leg position
6. Create realistic shadows and reflections where shoes meet the ground/floor
`
        : ''

    return `[Role: Professional Footwear Photographer]
You are a world-class footwear product photographer with extensive experience in commercial shoe photography for luxury brands and e-commerce platforms.

Your expertise includes:
- Professional shoe positioning and angle composition
- Material texture and surface detail enhancement
- Lighting for different shoe materials (leather, suede, mesh)
- Commercial product photography standards
${displayMode === 'model_wearing' ? '- Virtual try-on and footwear compositing on models' : ''}

${
  isAutoDetect
    ? `[Auto-Detection Mode]
Analyze the provided footwear image to automatically detect:
- Shoe type and style
- Material and texture
- Color and finish
Then apply appropriate photography techniques.
`
    : `[Footwear Type: ${this.getFootwearLabel(footwearType)}]
${footwearTips}

[Material Style: ${this.getMaterialLabel(materialStyle)}]
${materialTips}`
}

[Lighting Effect: ${this.getLightingLabel(lightingEffect)}]
${lightingTips}
${modelWearingSection}
[Technical Standards - CRITICAL]
1. **Product Presentation**:
   - Sharp focus on key details (stitching, texture, logo)
   - Accurate color reproduction
   - Clean, professional composition
   - Consistent shoe positioning

2. **Material Rendering**:
   - Accurate surface texture representation
   - Appropriate shine and matte areas
   - Natural creasing and material behavior
   - Detail in stitching and construction

3. **Lighting Quality**:
   - Even illumination with controlled shadows
   - Highlight material properties appropriately
   - No harsh reflections or hot spots
   - Professional commercial quality

4. **Output Quality**:
   - High-resolution (${this.config.imageSize || '2K'})
   - No visible artifacts
   - E-commerce ready presentation
   - Premium brand quality standards

[Output Requirement]
Generate the footwear product image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const {
      footwearType,
      displayAngle,
      materialStyle,
      sceneBackground,
      lightingEffect,
      displayMode,
      extraDescription
    } = this.config

    // 自动检测模式
    const isAutoDetect = footwearType === 'auto' || materialStyle === 'auto'

    const footwearLabel = footwearType === 'auto' ? 'auto-detected footwear' : this.getFootwearLabel(footwearType)
    const angleLabel = this.getAngleLabel(displayAngle)
    const materialLabel = materialStyle === 'auto' ? 'auto-detected material' : this.getMaterialLabel(materialStyle)
    const backgroundLabel = this.getBackgroundLabel(sceneBackground)

    // 模特穿鞋模式的专用提示词
    if (displayMode === 'model_wearing') {
      return `[Model Wearing Footwear - Virtual Try-On]

**Task**: Take the provided footwear and place it on the model's feet, creating a realistic wearing effect.

**Input Images**:
- Image 1: The footwear product to be worn
- Image 2: The model photo (full body or leg/feet focus)
- Image 3: Optional style/scene reference

**Requirements**:
1. **Footwear Placement**:
   - Seamlessly fit the shoes on the model's feet
   - Match the size and perspective naturally
   - Preserve all original shoe details (color, design, laces, logos)

2. **Visual Integration**:
   - Match the lighting between shoes and model
   - Create natural shadows under the shoes
   - Blend the edges seamlessly
   - Maintain consistent color temperature

3. **Pose Preservation**:
   - Keep the model's original pose intact
   - Adjust shoe angle to match foot position
   - Ensure natural foot-in-shoe appearance

4. **Quality Standards**:
   - High-resolution output
   - No visible compositing artifacts
   - Professional e-commerce quality
   - Realistic and convincing result

${
  isAutoDetect
    ? `**Auto-Detection**: Analyze the footwear to determine type and material automatically.
`
    : `**Footwear**: ${footwearLabel} with ${materialLabel} material
`
}
**Lighting**: ${this.getLightingLabel(lightingEffect)}
**Background**: ${backgroundLabel}

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the model wearing the footwear now.`
    }

    // 标准产品展示模式
    return `[Footwear Product Photography]

**Task**: Create a professional product photo of ${footwearLabel} with ${angleLabel} angle and ${materialLabel} material appearance.

${
  isAutoDetect
    ? `**Auto-Detection Mode**: Analyze the provided footwear image to determine:
- Shoe type and category
- Material and texture
- Appropriate display approach
Then generate the optimized product photo.
`
    : `**Footwear Type**: ${footwearLabel}
**Display Angle**: ${angleLabel}
**Material**: ${materialLabel}`
}
**Background**: ${backgroundLabel}
**Lighting**: ${this.getLightingLabel(lightingEffect)}

**Composition Guide**:
- Position footwear at optimal ${angleLabel} viewing angle
- Show key design details and construction quality
- Maintain proper proportions and perspective
- Create visually balanced composition

**Material Requirements**:
- Highlight ${materialLabel} texture and finish
- Show authentic material properties
- Capture surface details accurately
- Appropriate shine/matte balance

**Quality Standards**:
- Sharp detail on stitching and texture
- Clean product presentation
- Professional commercial quality
- Ready for e-commerce listing

**Negative Constraints**:
Blurry images, incorrect proportions, unnatural colors, harsh shadows,
visible artifacts, amateur composition, poor lighting, distorted shape,
unrealistic textures, low quality.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the footwear product photo now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.footwear_type) parts.push(`Footwear: ${json.footwear_type}`)
    if (json.display_angle) parts.push(`Angle: ${json.display_angle}`)
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
    return `Analyze the footwear image:
1. Identify footwear type and style
2. Detect material and texture
3. Analyze current lighting conditions
4. Note color and finish details
5. Suggest optimal display approach

Return as JSON with fields: footwear_type, material_type, current_lighting, color_details, display_notes`
  }

  // ==================== 辅助方法 ====================

  private getAutoDetectTips(): string {
    return `Automatically analyze the provided footwear image to detect:
- Shoe type (sneakers, boots, heels, sandals, etc.)
- Material (leather, suede, canvas, mesh, etc.)
- Style characteristics and design elements
- Appropriate photography approach based on the product`
  }

  private getFootwearTips(type: string): string {
    const tips: Record<string, string> = {
      sneakers: 'Athletic sneakers. Focus on dynamic design, cushioning technology, and sport-inspired aesthetics.',
      leather: 'Leather dress shoes. Emphasize premium leather finish, formal elegance, and craftsmanship.',
      boots: 'Boots of various styles. Highlight durability, construction quality, and rugged appeal.',
      sandals: 'Open footwear. Showcase comfort features, strap design, and casual style.',
      loafers: 'Slip-on loafers. Present refined comfort, versatile style, and subtle details.',
      heels: 'High heels and pumps. Emphasize elegant silhouette, heel design, and feminine appeal.',
      flats: 'Flat shoes and ballet flats. Highlight comfort, simplicity, and everyday elegance.',
      athletic: 'Performance athletic shoes. Focus on technology features, breathability, and sport function.',
      auto: 'Automatically detect shoe type from the provided image.'
    }
    return tips[type] || tips.sneakers
  }

  private getMaterialTips(material: string): string {
    const tips: Record<string, string> = {
      leather: 'Genuine leather with rich texture, natural grain, and premium finish.',
      canvas: 'Canvas fabric with visible weave, casual texture, and breathable appearance.',
      suede: 'Suede finish with soft nap, matte surface, and luxurious feel.',
      mesh: 'Breathable mesh with visible structure, athletic look, and lightweight feel.',
      synthetic: 'Synthetic materials with uniform finish, modern look, and durability.',
      fabric: 'Textile fabric with soft appearance, comfortable look, and casual style.',
      auto: 'Automatically detect material type from the provided image.'
    }
    return tips[material] || tips.leather
  }

  private getLightingTips(effect: string): string {
    const tips: Record<string, string> = {
      soft: 'Soft, even lighting with minimal shadows. Clean and professional appearance.',
      dramatic: 'Dramatic lighting with strong shadows. Creates depth and visual interest.',
      natural: 'Natural daylight simulation. Authentic and realistic presentation.',
      studio: 'Professional studio lighting setup. Commercial quality with controlled highlights.',
      rim: 'Rim lighting to define edges. Creates premium, high-end product look.'
    }
    return tips[effect] || tips.soft
  }

  private getFootwearLabel(type: string): string {
    const labels: Record<string, string> = {
      sneakers: 'sneakers',
      leather: 'leather shoes',
      boots: 'boots',
      sandals: 'sandals',
      loafers: 'loafers',
      heels: 'high heels',
      flats: 'flat shoes',
      athletic: 'athletic shoes'
    }
    return labels[type] || type
  }

  private getMaterialLabel(material: string): string {
    const labels: Record<string, string> = {
      leather: 'leather',
      canvas: 'canvas',
      suede: 'suede',
      mesh: 'mesh',
      synthetic: 'synthetic',
      fabric: 'fabric'
    }
    return labels[material] || material
  }

  private getLightingLabel(effect: string): string {
    const labels: Record<string, string> = {
      soft: 'Soft',
      dramatic: 'Dramatic',
      natural: 'Natural',
      studio: 'Studio',
      rim: 'Rim Light'
    }
    return labels[effect] || effect
  }

  private getAngleLabel(angle: string): string {
    const labels: Record<string, string> = {
      front: 'front view',
      side: 'side profile',
      back: 'back view',
      top: 'top-down',
      three_quarter: 'three-quarter',
      pair: 'pair display',
      worn: 'worn/lifestyle'
    }
    return labels[angle] || angle
  }

  private getBackgroundLabel(bg: string): string {
    const labels: Record<string, string> = {
      white: 'pure white',
      gradient: 'subtle gradient',
      lifestyle: 'lifestyle scene',
      outdoor: 'outdoor environment',
      studio: 'studio backdrop',
      minimalist: 'minimalist'
    }
    return labels[bg] || bg
  }
}

export default FootwearDisplayPromptBuilder
