/**
 * 首饰试戴提示词构建器
 * Jewelry Try-On Prompt Builder
 *
 * 虚拟首饰试戴效果生成
 * 支持：项链、耳环、手链、戒指、手表
 *
 * 技术要点：
 * - 准确的佩戴位置
 * - 自然的光影融合
 * - 肤色与首饰匹配
 * - 真实的佩戴效果
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 首饰试戴 promptJson 类型
 */
export interface JewelryTryonPromptJson extends BasePromptJson {
  /** 首饰类型 */
  jewelry_type?: string
  /** 佩戴位置 */
  position?: string
  /** 效果描述 */
  effect_description?: string
}

/**
 * 首饰试戴配置类型
 */
export interface JewelryTryonConfig {
  /** 首饰类型 */
  jewelryType: 'necklace' | 'earring' | 'bracelet' | 'ring' | 'watch'
  /** 佩戴位置 */
  position: 'auto' | 'centered' | 'left' | 'right'
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
 * 首饰试戴提示词构建器
 */
export class JewelryTryonPromptBuilder extends PromptBuilder<JewelryTryonConfig, JewelryTryonPromptJson> {
  constructor(options: PromptBuilderOptions<JewelryTryonPromptJson> & { config?: JewelryTryonConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { jewelryType, blendMode } = this.config

    const jewelryTips = this.getJewelryTips(jewelryType)
    const blendTips = this.getBlendTips(blendMode)

    return `[Role: Expert Virtual Try-On Specialist]
You are an expert digital artist specializing in virtual jewelry try-on technology, with extensive experience in luxury brand visualization.

Your expertise includes:
- Precise jewelry placement on human subjects
- Natural light reflection and shadow generation
- Skin tone and jewelry color harmony
- Realistic accessory integration

[Jewelry Type: ${this.getJewelryLabel(jewelryType)}]
${jewelryTips}

[Blend Mode: ${this.getBlendLabel(blendMode)}]
${blendTips}

[Technical Standards - CRITICAL]
1. **Placement Accuracy**:
   - Position jewelry at anatomically correct location
   - Match body pose and angle
   - Maintain natural proportions
   - Follow body contours

2. **Integration Quality**:
   - Match lighting with the model photo
   - Generate realistic shadows
   - Blend edges seamlessly
   - No floating or detached appearance

3. **Material Rendering**:
   - Accurate metal reflections
   - Proper gemstone sparkle
   - Natural surface interactions
   - Consistent with jewelry source

4. **Output Quality**:
   - High-resolution (${this.config.imageSize || '2K'})
   - No visible compositing artifacts
   - Professional commercial quality
   - Ready for e-commerce use

[Output Requirement]
Generate the jewelry try-on result image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { jewelryType, position, blendMode, extraDescription } = this.config

    const jewelryLabel = this.getJewelryLabel(jewelryType)
    const placementGuide = this.getPlacementGuide(jewelryType, position)

    return `[Jewelry Virtual Try-On]

**Task**: Apply the ${jewelryLabel} to the model photo with realistic try-on effect.

**Jewelry Type**: ${jewelryLabel}
**Blend Mode**: ${this.getBlendLabel(blendMode)}

**Placement Guide**:
${placementGuide}

**Integration Requirements**:
- Position jewelry naturally on the model
- Match lighting direction and intensity
- Add appropriate shadows and reflections
- Blend with skin/clothing seamlessly
- Maintain jewelry details and sparkle

**Quality Standards**:
- Sharp jewelry details
- Natural skin integration
- Realistic lighting effects
- Professional try-on appearance

**Negative Constraints**:
Floating jewelry, wrong placement, mismatched lighting, harsh edges,
unnatural reflections, distorted proportions, obvious compositing,
low quality, amateur look.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the jewelry try-on result now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.jewelry_type) parts.push(`Jewelry: ${json.jewelry_type}`)
    if (json.position) parts.push(`Position: ${json.position}`)
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
    return `Analyze the model and jewelry images:
1. Identify jewelry type
2. Detect optimal placement area on model
3. Analyze lighting conditions
4. Note skin tone for color matching
5. Suggest integration approach

Return as JSON with fields: jewelry_type, placement_area, lighting_direction, skin_tone, integration_notes`
  }

  // ==================== 辅助方法 ====================

  private getJewelryTips(type: string): string {
    const tips: Record<string, string> = {
      necklace:
        'Position around neck area. Follow neckline curve. Consider chain drape and pendant placement.',
      earring:
        'Position at earlobe or along ear edge. Match ear angle. Consider hair interaction.',
      bracelet:
        'Position on wrist area. Follow wrist curve. Consider hand pose and visibility.',
      ring: 'Position on finger. Match finger angle and size. Ensure natural fit appearance.',
      watch:
        'Position on wrist. Follow wrist curve. Consider strap integration and dial visibility.'
    }
    return tips[type] || tips.necklace
  }

  private getBlendTips(mode: string): string {
    const tips: Record<string, string> = {
      natural:
        'Seamless integration with natural lighting. Subtle shadows. Realistic appearance.',
      enhanced:
        'Slightly enhanced jewelry visibility. Boosted reflections. Eye-catching but natural.',
      subtle: 'Very subtle integration. Minimal shadows. Soft blending for delicate look.'
    }
    return tips[mode] || tips.natural
  }

  private getJewelryLabel(type: string): string {
    const labels: Record<string, string> = {
      necklace: 'necklace',
      earring: 'earring(s)',
      bracelet: 'bracelet',
      ring: 'ring',
      watch: 'watch'
    }
    return labels[type] || type
  }

  private getBlendLabel(mode: string): string {
    const labels: Record<string, string> = {
      natural: 'Natural',
      enhanced: 'Enhanced',
      subtle: 'Subtle'
    }
    return labels[mode] || mode
  }

  private getPlacementGuide(type: string, position: string): string {
    const typeGuides: Record<string, string> = {
      necklace: `- Place around the neck following the neckline
- Chain should drape naturally with gravity
- Pendant centered or as specified
- Consider clothing neckline interaction`,
      earring: `- Position at earlobe (studs) or dangling from ear
- Match the ear angle in the photo
- Consider hair coverage
- Ensure both earrings match if visible`,
      bracelet: `- Wrap around the wrist naturally
- Follow wrist curve and bone structure
- Consider hand position and gesture
- Clasp position based on viewing angle`,
      ring: `- Place on the appropriate finger
- Match finger size and angle
- Ensure natural fit appearance
- Consider hand pose and visibility`,
      watch: `- Position on wrist with proper orientation
- Strap should wrap naturally
- Dial visible and readable
- Consider wrist hair if applicable`
    }

    const positionNote =
      position === 'auto' ? 'Automatically determine best position.' : `Position preference: ${position}.`

    return `${typeGuides[type] || typeGuides.necklace}\n- ${positionNote}`
  }
}

export default JewelryTryonPromptBuilder
