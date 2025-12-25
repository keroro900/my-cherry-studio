/**
 * 珠宝摄影提示词构建器
 * Jewelry Photography Prompt Builder
 *
 * 专门用于生成专业珠宝产品摄影图片
 * 支持：戒指、项链、耳环、手链、手表
 *
 * 技术要点：
 * - 金属表面光线控制
 * - 宝石折射与火彩捕捉
 * - 微距摄影技术
 * - 商业级后期处理
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 珠宝摄影 promptJson 类型
 */
export interface JewelryPromptJson extends BasePromptJson {
  /** 珠宝类型 */
  jewelry_type?: string
  /** 金属类型 */
  metal_type?: string
  /** 宝石类型 */
  stone_type?: string
  /** 风格描述 */
  style_description?: string
}

/**
 * 珠宝摄影配置类型
 */
export interface JewelryConfig {
  /** 珠宝类型 */
  jewelryType: 'ring' | 'necklace' | 'earring' | 'bracelet' | 'watch'
  /** 金属类型 */
  metalType: 'gold' | 'silver' | 'platinum' | 'rose_gold'
  /** 宝石类型 */
  stoneType: 'diamond' | 'ruby' | 'sapphire' | 'emerald' | 'pearl' | 'none'
  /** 光线设置 */
  lightingSetup: 'soft_box' | 'ring_light' | 'natural' | 'dramatic'
  /** 背景风格 */
  backgroundStyle: 'white' | 'black' | 'gradient' | 'lifestyle'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 珠宝摄影提示词构建器
 */
export class JewelryPromptBuilder extends PromptBuilder<JewelryConfig, JewelryPromptJson> {
  constructor(options: PromptBuilderOptions<JewelryPromptJson> & { config?: JewelryConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { lightingSetup, metalType, stoneType } = this.config

    const metalLightingTips = this.getMetalLightingTips(metalType)
    const stoneTips = stoneType !== 'none' ? this.getStoneTips(stoneType) : 'No gemstone, focus on metalwork craftsmanship'
    const lightingDescription = this.getLightingDescription(lightingSetup)

    return `[Role: Master Jewelry Photographer]
You are a world-class jewelry photographer with 20+ years of experience shooting for luxury brands like Cartier, Tiffany & Co., and Bulgari.

Your expertise includes:
- Macro photography for capturing microscopic details
- Metal surface lighting mastery: ${metalLightingTips}
- Gemstone photography: ${stoneTips}
- Clean, commercial product presentation that sells

[Lighting Setup: ${this.getLightingLabel(lightingSetup)}]
${lightingDescription}

[Technical Standards - CRITICAL]
1. **Focus**: Razor-sharp focus on key details
   - Gemstone facets must be crystal clear
   - Metal finishing and texture visible
   - No motion blur or softness

2. **Color Accuracy**:
   - True-to-life metal colors
   - Accurate gemstone hue and saturation
   - No color cast from environment

3. **Composition**:
   - Clean, distraction-free framing
   - Proper negative space
   - Professional product placement

4. **Quality**:
   - High-resolution output (${this.config.imageSize || '2K'})
   - Professional retouching standard
   - Ready for e-commerce use

[Output Requirement]
Generate high-resolution jewelry product image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { jewelryType, metalType, stoneType, backgroundStyle, extraDescription } = this.config

    const jewelryLabel = this.getJewelryLabel(jewelryType)
    const metalLabel = this.getMetalLabel(metalType)
    const stoneLabel = stoneType !== 'none' ? this.getStoneLabel(stoneType) : ''
    const backgroundDescription = this.getBackgroundDescription(backgroundStyle)

    return `[Jewelry Product Photography]

**Subject**: Professional product photo of a ${metalLabel} ${jewelryLabel}${stoneLabel ? ` with ${stoneLabel}` : ''}.

**Background**: ${backgroundDescription}

**Camera Settings**:
- Canon EOS R5 or equivalent
- 100mm Macro lens
- f/11 for maximum sharpness
- Tripod mounted for stability

**Lighting Requirements**:
- Soft, even illumination
- Controlled reflections on metal surface
- ${stoneType !== 'none' ? 'Highlight gemstone brilliance and fire' : 'Emphasize metalwork details'}

**Focus Points**:
- Sharp detail on ${stoneType !== 'none' ? 'gemstone brilliance and ' : ''}metal surface
- Clean reflections showing material quality
- Professional commercial quality
- No visible fingerprints or dust

**Negative Constraints**:
Fingerprints, dust particles, scratches, color cast, overexposure, underexposure,
motion blur, soft focus, distracting reflections, cluttered background,
low quality, amateur look.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the jewelry product photo now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    // 从 promptJson 构建提示词
    const parts: string[] = []
    if (json.jewelry_type) parts.push(`Jewelry type: ${json.jewelry_type}`)
    if (json.metal_type) parts.push(`Metal: ${json.metal_type}`)
    if (json.stone_type) parts.push(`Stone: ${json.stone_type}`)
    if (json.style_description) parts.push(`Style: ${json.style_description}`)

    return parts.join('\n')
  }

  protected fromPreset(): string {
    return this.assemble()
  }

  protected fromAnalysis(_analysis: GarmentAnalysis): string {
    return this.assemble()
  }

  protected getAnalysisPrompt(): string {
    return `Analyze the jewelry in the image:
1. Identify the jewelry type (ring, necklace, earring, bracelet, watch)
2. Identify the metal type (gold, silver, platinum, rose gold)
3. Identify any gemstones and their characteristics
4. Note any special design features
5. Suggest optimal photography approach

Return as JSON with fields: jewelry_type, metal_type, stone_type, design_features, photography_notes`
  }

  // ==================== 辅助方法 ====================

  private getMetalLightingTips(metal: string): string {
    const tips: Record<string, string> = {
      gold: 'Warm reflections, avoid harsh highlights that wash out the rich yellow tone',
      silver: 'Cool, clean reflections. Watch for fingerprints and tarnish. Use polarizer if needed',
      platinum: 'Subtle, sophisticated reflections. Emphasize the premium metallic sheen',
      rose_gold: 'Warm pink undertones. Soft lighting to capture the romantic quality'
    }
    return tips[metal] || tips.gold
  }

  private getStoneTips(stone: string): string {
    const tips: Record<string, string> = {
      diamond: 'Capture brilliance (white light return), fire (spectral colors), and scintillation (sparkle). Use multiple light sources',
      ruby: 'Deep red saturation, internal glow. Avoid washing out the color with too much light',
      sapphire: 'Rich blue depth. Show color zoning if present. Capture velvety appearance',
      emerald: 'Lush green color. Jardín (inclusions) are acceptable and add character',
      pearl: 'Soft, lustrous surface. Capture the orient (iridescence) with side lighting'
    }
    return tips[stone] || 'Capture the natural beauty and brilliance of the gemstone'
  }

  private getLightingDescription(setup: string): string {
    const descriptions: Record<string, string> = {
      soft_box: `Large soft boxes on both sides at 45° angles.
Key light slightly higher, fill light lower to reduce shadows.
Use diffusion panels to eliminate harsh reflections.
Add small accent light from above for gemstone sparkle.`,
      ring_light: `Ring light centered for even, shadowless illumination.
Ideal for symmetrical pieces like rings and circular pendants.
Creates distinctive circular catchlights in reflective surfaces.
Add secondary lights for depth if needed.`,
      natural: `Window light with diffusion panel.
Position jewelry to catch natural reflections.
Use white reflector cards to fill shadows.
Best during golden hour for warm tones.`,
      dramatic: `Strong key light from one side creating bold shadows.
Use black cards to control reflections.
Emphasize form and texture through contrast.
Add small fill to preserve shadow detail.`
    }
    return descriptions[setup] || descriptions.soft_box
  }

  private getLightingLabel(setup: string): string {
    const labels: Record<string, string> = {
      soft_box: 'Soft Box Studio',
      ring_light: 'Ring Light',
      natural: 'Natural Window Light',
      dramatic: 'Dramatic Single Source'
    }
    return labels[setup] || setup
  }

  private getJewelryLabel(type: string): string {
    const labels: Record<string, string> = {
      ring: 'ring',
      necklace: 'necklace',
      earring: 'earring(s)',
      bracelet: 'bracelet',
      watch: 'luxury watch'
    }
    return labels[type] || type
  }

  private getMetalLabel(metal: string): string {
    const labels: Record<string, string> = {
      gold: 'yellow gold',
      silver: 'sterling silver',
      platinum: 'platinum',
      rose_gold: 'rose gold'
    }
    return labels[metal] || metal
  }

  private getStoneLabel(stone: string): string {
    const labels: Record<string, string> = {
      diamond: 'brilliant-cut diamond',
      ruby: 'natural ruby',
      sapphire: 'blue sapphire',
      emerald: 'natural emerald',
      pearl: 'lustrous pearl'
    }
    return labels[stone] || stone
  }

  private getBackgroundDescription(style: string): string {
    const descriptions: Record<string, string> = {
      white: 'Pure white seamless background, clean and minimal for e-commerce',
      black: 'Deep black velvet or gradient background, dramatic and luxurious',
      gradient: 'Subtle gray-to-white gradient, sophisticated and modern',
      lifestyle: 'Elegant lifestyle setting with complementary props (fabric, petals, etc.)'
    }
    return descriptions[style] || descriptions.white
  }
}

export default JewelryPromptBuilder
