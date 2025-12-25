/**
 * 3C电子产品提示词构建器
 * Electronics Photo Prompt Builder
 *
 * 专业电子产品摄影生成
 * 支持：手机、电脑、耳机、智能设备、相机等
 *
 * 技术要点：
 * - 产品反光处理
 * - 屏幕内容展示
 * - 科技感营造
 * - 细节质感呈现
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 电子产品 promptJson 类型
 */
export interface ElectronicsPhotoPromptJson extends BasePromptJson {
  /** 产品类型 */
  electronics_type?: string
  /** 展示风格 */
  display_style?: string
  /** 效果描述 */
  effect_description?: string
}

/**
 * 电子产品配置类型
 */
export interface ElectronicsPhotoConfig {
  /** 产品类型 */
  electronicsType: 'smartphone' | 'laptop' | 'tablet' | 'headphones' | 'smartwatch' | 'camera' | 'speaker' | 'gaming'
  /** 展示风格 */
  displayStyle: 'minimal' | 'tech' | 'lifestyle' | 'studio' | 'floating' | 'contextual'
  /** 表面处理 */
  surfaceFinish: 'glossy' | 'matte' | 'metallic' | 'glass' | 'textured'
  /** 光效风格 */
  lightingStyle: 'soft' | 'dramatic' | 'neon' | 'natural' | 'gradient' | 'rim'
  /** 屏幕内容 */
  screenContent: 'blank' | 'ui_demo' | 'app_showcase' | 'wallpaper' | 'off'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 电子产品提示词构建器
 */
export class ElectronicsPhotoPromptBuilder extends PromptBuilder<ElectronicsPhotoConfig, ElectronicsPhotoPromptJson> {
  constructor(options: PromptBuilderOptions<ElectronicsPhotoPromptJson> & { config?: ElectronicsPhotoConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { electronicsType, surfaceFinish, lightingStyle } = this.config

    const electronicsTips = this.getElectronicsTips(electronicsType)
    const surfaceTips = this.getSurfaceTips(surfaceFinish)
    const lightingTips = this.getLightingTips(lightingStyle)

    return `[Role: Professional Electronics & Tech Product Photographer]
You are a world-class technology product photographer with extensive experience shooting for major tech brands and publications.

Your expertise includes:
- Capturing sleek product designs and premium materials
- Managing reflections on glossy and metallic surfaces
- Creating compelling screen content displays
- Building futuristic, high-tech visual atmospheres

[Product Type: ${this.getElectronicsLabel(electronicsType)}]
${electronicsTips}

[Surface Finish: ${this.getSurfaceLabel(surfaceFinish)}]
${surfaceTips}

[Lighting Style: ${this.getLightingLabel(lightingStyle)}]
${lightingTips}

[Technical Standards - CRITICAL]
1. **Product Presentation**:
   - Sharp focus on product details and edges
   - Clean, controlled reflections
   - Accurate color reproduction
   - Premium, high-end appearance

2. **Surface Quality**:
   - Appropriate highlight management
   - Show material quality authentically
   - Control specular reflections
   - No fingerprints or dust visible

3. **Tech Aesthetic**:
   - Modern, innovative feel
   - Clean composition
   - Appropriate use of negative space
   - Technology-forward atmosphere

4. **Output Quality**:
   - High-resolution (${this.config.imageSize || '2K'})
   - Marketing and advertising ready
   - Tech industry standard quality
   - No visible artifacts

[Output Requirement]
Generate the electronics product image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { electronicsType, displayStyle, surfaceFinish, lightingStyle, screenContent, extraDescription } = this.config

    const electronicsLabel = this.getElectronicsLabel(electronicsType)
    const styleLabel = this.getStyleLabel(displayStyle)
    const surfaceLabel = this.getSurfaceLabel(surfaceFinish)
    const screenLabel = this.getScreenLabel(screenContent)

    return `[Electronics Product Photography]

**Task**: Create a professional product photo of ${electronicsLabel} with ${surfaceLabel} finish in ${styleLabel} style.

**Product Type**: ${electronicsLabel}
**Surface Finish**: ${surfaceLabel}
**Display Style**: ${styleLabel}
**Lighting**: ${this.getLightingLabel(lightingStyle)}
**Screen Content**: ${screenLabel}

**Product Presentation**:
- Position product at optimal angle for design showcase
- Highlight premium materials and build quality
- Show key features and design elements
- Create visually compelling composition

**Surface & Reflection**:
- Manage ${surfaceLabel} surface reflections appropriately
- Show authentic material appearance
- Control highlights for clean look
- Pristine, flawless product presentation

**Tech Atmosphere**:
- ${this.getStyleDescription(displayStyle)}
- Modern, innovative aesthetic
- Clean, professional presentation
- Technology-forward feel

**Quality Standards**:
- Sharp details on edges and interfaces
- Accurate color reproduction
- Premium tech brand quality
- Ready for marketing campaigns

**Negative Constraints**:
Fingerprints, dust, scratches, harsh reflections, distorted screens,
amateur lighting, incorrect proportions, low quality,
unrealistic materials, visible artifacts.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the electronics product photo now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.electronics_type) parts.push(`Product: ${json.electronics_type}`)
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
    return `Analyze the electronics product image:
1. Identify product type and brand style
2. Detect surface material and finish
3. Analyze current lighting setup
4. Note screen content and state
5. Suggest optimal presentation approach

Return as JSON with fields: product_type, surface_finish, lighting_style, screen_state, presentation_notes`
  }

  // ==================== 辅助方法 ====================

  private getElectronicsTips(type: string): string {
    const tips: Record<string, string> = {
      smartphone: 'Smartphones and mobile devices. Focus on screen display, camera array, and slim profile.',
      laptop: 'Laptops and notebooks. Highlight screen quality, keyboard design, and build materials.',
      tablet: 'Tablets and e-readers. Emphasize screen size, thin profile, and versatility.',
      headphones: 'Headphones and earbuds. Show comfort design, material quality, and audio brand appeal.',
      smartwatch: 'Smartwatches and wearables. Display face design, band materials, and lifestyle integration.',
      camera: 'Cameras and photography equipment. Highlight lens quality, body design, and professional appeal.',
      speaker: 'Speakers and audio equipment. Show acoustic design, material finish, and lifestyle fit.',
      gaming: 'Gaming devices and accessories. Emphasize RGB lighting, aggressive design, and performance aesthetic.'
    }
    return tips[type] || tips.smartphone
  }

  private getSurfaceTips(finish: string): string {
    const tips: Record<string, string> = {
      glossy: 'Glossy finish with strong reflections. Requires careful highlight control for clean look.',
      matte: 'Matte finish with soft diffusion. Modern, fingerprint-resistant appearance.',
      metallic: 'Metallic finish with subtle shimmer. Premium, industrial quality feel.',
      glass: 'Glass surfaces with transparency effects. Show depth and layer quality.',
      textured: 'Textured surfaces with grip patterns. Show tactile quality and material detail.'
    }
    return tips[finish] || tips.glossy
  }

  private getLightingTips(style: string): string {
    const tips: Record<string, string> = {
      soft: 'Soft, even lighting with gentle gradients. Clean, professional product look.',
      dramatic: 'High contrast with strong shadows. Editorial, artistic presentation.',
      neon: 'Colored accent lighting with tech glow. Futuristic, gaming aesthetic.',
      natural: 'Natural daylight simulation. Lifestyle, everyday use context.',
      gradient: 'Gradient background with smooth transitions. Modern, app-store style.',
      rim: 'Rim lighting defining edges. Premium, high-end product feel.'
    }
    return tips[style] || tips.soft
  }

  private getElectronicsLabel(type: string): string {
    const labels: Record<string, string> = {
      smartphone: 'smartphone',
      laptop: 'laptop',
      tablet: 'tablet',
      headphones: 'headphones',
      smartwatch: 'smartwatch',
      camera: 'camera',
      speaker: 'speaker',
      gaming: 'gaming device'
    }
    return labels[type] || type
  }

  private getSurfaceLabel(finish: string): string {
    const labels: Record<string, string> = {
      glossy: 'glossy',
      matte: 'matte',
      metallic: 'metallic',
      glass: 'glass',
      textured: 'textured'
    }
    return labels[finish] || finish
  }

  private getLightingLabel(style: string): string {
    const labels: Record<string, string> = {
      soft: 'Soft',
      dramatic: 'Dramatic',
      neon: 'Neon/RGB',
      natural: 'Natural',
      gradient: 'Gradient',
      rim: 'Rim Light'
    }
    return labels[style] || style
  }

  private getStyleLabel(style: string): string {
    const labels: Record<string, string> = {
      minimal: 'minimal clean',
      tech: 'high-tech',
      lifestyle: 'lifestyle',
      studio: 'studio professional',
      floating: 'floating/levitating',
      contextual: 'contextual/in-use'
    }
    return labels[style] || style
  }

  private getScreenLabel(content: string): string {
    const labels: Record<string, string> = {
      blank: 'blank/clean screen',
      ui_demo: 'UI demonstration',
      app_showcase: 'app showcase',
      wallpaper: 'wallpaper display',
      off: 'screen off'
    }
    return labels[content] || content
  }

  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      minimal: 'Clean white or neutral background with focus on product',
      tech: 'Futuristic elements, digital patterns, technology atmosphere',
      lifestyle: 'Product in everyday use context with human touch',
      studio: 'Professional studio setup with controlled lighting',
      floating: 'Product floating with dynamic shadows and reflections',
      contextual: 'Product in realistic use scenario or environment'
    }
    return descriptions[style] || descriptions.minimal
  }
}

export default ElectronicsPhotoPromptBuilder
