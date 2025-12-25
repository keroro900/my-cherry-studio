/**
 * 眼镜试戴提示词构建器
 * Eyewear Try-On Prompt Builder
 *
 * 虚拟眼镜试戴效果生成
 * 支持：眼镜、太阳镜、护目镜、运动眼镜
 *
 * 技术要点：
 * - 精准的面部位置检测
 * - 眼镜与脸型匹配
 * - 镜片反光与透明效果
 * - 自然的佩戴效果
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 眼镜试戴 promptJson 类型
 */
export interface EyewearTryonPromptJson extends BasePromptJson {
  /** 眼镜类型 */
  eyewear_type?: string
  /** 镜框风格 */
  frame_style?: string
  /** 效果描述 */
  effect_description?: string
}

/**
 * 眼镜试戴配置类型
 */
export interface EyewearTryonConfig {
  /** 眼镜类型 */
  eyewearType: 'glasses' | 'sunglasses' | 'goggles' | 'sports' | 'reading'
  /** 镜框风格 */
  frameStyle: 'round' | 'square' | 'aviator' | 'cat_eye' | 'oval' | 'rectangular' | 'rimless'
  /** 镜片效果 */
  lensEffect: 'clear' | 'tinted' | 'gradient' | 'mirror' | 'polarized'
  /** 融合模式 */
  blendMode: 'natural' | 'enhanced' | 'subtle'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 眼镜试戴提示词构建器
 */
export class EyewearTryonPromptBuilder extends PromptBuilder<EyewearTryonConfig, EyewearTryonPromptJson> {
  constructor(options: PromptBuilderOptions<EyewearTryonPromptJson> & { config?: EyewearTryonConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { eyewearType, frameStyle, blendMode } = this.config

    const eyewearTips = this.getEyewearTips(eyewearType)
    const frameTips = this.getFrameTips(frameStyle)
    const blendTips = this.getBlendTips(blendMode)

    return `[Role: Expert Virtual Eyewear Specialist]
You are an expert digital artist specializing in virtual eyewear try-on technology, with extensive experience in optical retail and fashion eyewear visualization.

Your expertise includes:
- Precise eyewear placement on human faces
- Natural face-eyewear proportion matching
- Lens reflection and transparency effects
- Frame-to-face harmony and fitting

[Eyewear Type: ${this.getEyewearLabel(eyewearType)}]
${eyewearTips}

[Frame Style: ${this.getFrameLabel(frameStyle)}]
${frameTips}

[Blend Mode: ${this.getBlendLabel(blendMode)}]
${blendTips}

[Technical Standards - CRITICAL]
1. **Placement Accuracy**:
   - Position eyewear at correct eye level
   - Match face angle and head tilt
   - Proper bridge-nose alignment
   - Temple arms follow ear line

2. **Integration Quality**:
   - Match lighting with the model photo
   - Generate realistic shadows on face
   - Blend edges seamlessly
   - No floating or misaligned appearance

3. **Lens Rendering**:
   - Appropriate lens transparency
   - Natural reflections if applicable
   - Correct tint gradients
   - Eye visibility through lenses (if clear)

4. **Output Quality**:
   - High-resolution (${this.config.imageSize || '2K'})
   - No visible compositing artifacts
   - Professional commercial quality
   - Ready for e-commerce use

[Output Requirement]
Generate the eyewear try-on result image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { eyewearType, frameStyle, lensEffect, blendMode, extraDescription } = this.config

    const eyewearLabel = this.getEyewearLabel(eyewearType)
    const frameLabel = this.getFrameLabel(frameStyle)
    const lensDescription = this.getLensDescription(lensEffect)

    return `[Eyewear Virtual Try-On]

**Task**: Apply the ${eyewearLabel} with ${frameLabel} frame to the model photo with realistic try-on effect.

**Eyewear Type**: ${eyewearLabel}
**Frame Style**: ${frameLabel}
**Lens Effect**: ${lensDescription}
**Blend Mode**: ${this.getBlendLabel(blendMode)}

**Placement Guide**:
- Position eyewear centered on the face
- Align bridge with nose bridge
- Temple arms should follow natural ear line
- Match head angle and tilt
- Maintain proper eye-to-frame distance

**Integration Requirements**:
- Position eyewear naturally on the face
- Match lighting direction and intensity
- Add appropriate shadows under frame
- Maintain lens properties (clarity, tint)
- Blend with facial features seamlessly

**Quality Standards**:
- Sharp frame details
- Natural face integration
- Realistic lens effects
- Professional try-on appearance

**Negative Constraints**:
Floating eyewear, wrong placement, mismatched size, crooked alignment,
unnatural reflections, distorted proportions, obvious compositing,
low quality, amateur look.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the eyewear try-on result now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.eyewear_type) parts.push(`Eyewear: ${json.eyewear_type}`)
    if (json.frame_style) parts.push(`Frame: ${json.frame_style}`)
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
    return `Analyze the model and eyewear images:
1. Identify eyewear type
2. Detect face position and angle
3. Analyze lighting conditions
4. Note skin tone for shadow matching
5. Suggest integration approach

Return as JSON with fields: eyewear_type, face_position, lighting_direction, skin_tone, integration_notes`
  }

  // ==================== 辅助方法 ====================

  private getEyewearTips(type: string): string {
    const tips: Record<string, string> = {
      glasses:
        'Standard prescription glasses. Focus on clear lenses, proper frame weight, and professional appearance.',
      sunglasses:
        'Fashion sunglasses with tinted lenses. Emphasize style, lens color, and fashionable appearance.',
      goggles: 'Protective goggles. Larger frame coverage, wrap-around design, safety-focused appearance.',
      sports:
        'Sports eyewear. Durable frame, secure fit appearance, athletic aesthetic with performance focus.',
      reading: 'Reading glasses. Smaller frame, positioned lower on nose, intellectual appearance.'
    }
    return tips[type] || tips.glasses
  }

  private getFrameTips(style: string): string {
    const tips: Record<string, string> = {
      round: 'Circular frames. Vintage, intellectual look. Best for angular faces.',
      square: 'Square or rectangular frames. Bold, professional appearance. Best for round faces.',
      aviator: 'Teardrop shaped frames. Classic, iconic style. Suits most face shapes.',
      cat_eye: 'Upswept outer edges. Retro, feminine style. Adds lift to face.',
      oval: 'Soft, curved frames. Versatile, flattering for most faces.',
      rectangular: 'Wide rectangular frames. Modern, professional look.',
      rimless: 'No visible frame. Minimalist, lightweight appearance. Focus on lenses only.'
    }
    return tips[style] || tips.round
  }

  private getBlendTips(mode: string): string {
    const tips: Record<string, string> = {
      natural: 'Seamless integration with natural lighting. Subtle shadows. Most realistic appearance.',
      enhanced: 'Slightly enhanced frame visibility. Boosted details. Eye-catching but natural.',
      subtle: 'Very subtle integration. Minimal shadows. Soft blending for delicate look.'
    }
    return tips[mode] || tips.natural
  }

  private getEyewearLabel(type: string): string {
    const labels: Record<string, string> = {
      glasses: 'prescription glasses',
      sunglasses: 'sunglasses',
      goggles: 'goggles',
      sports: 'sports eyewear',
      reading: 'reading glasses'
    }
    return labels[type] || type
  }

  private getFrameLabel(style: string): string {
    const labels: Record<string, string> = {
      round: 'round',
      square: 'square',
      aviator: 'aviator',
      cat_eye: 'cat-eye',
      oval: 'oval',
      rectangular: 'rectangular',
      rimless: 'rimless'
    }
    return labels[style] || style
  }

  private getBlendLabel(mode: string): string {
    const labels: Record<string, string> = {
      natural: 'Natural',
      enhanced: 'Enhanced',
      subtle: 'Subtle'
    }
    return labels[mode] || mode
  }

  private getLensDescription(effect: string): string {
    const descriptions: Record<string, string> = {
      clear: 'Clear transparent lenses',
      tinted: 'Uniformly tinted lenses',
      gradient: 'Gradient tinted lenses (darker at top)',
      mirror: 'Reflective mirror coating',
      polarized: 'Polarized lenses with subtle tint'
    }
    return descriptions[effect] || descriptions.clear
  }
}

export default EyewearTryonPromptBuilder
