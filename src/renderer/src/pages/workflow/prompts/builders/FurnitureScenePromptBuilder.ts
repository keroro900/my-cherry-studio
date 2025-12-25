/**
 * 家具场景提示词构建器
 * Furniture Scene Prompt Builder
 *
 * 专业家具产品室内场景合成
 * 支持：沙发、桌椅、床具、柜类、灯具等
 *
 * 技术要点：
 * - 空间感和透视准确
 * - 光影与场景融合
 * - 风格与材质匹配
 * - 比例尺寸真实
 */

import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 家具场景 promptJson 类型
 */
export interface FurnitureScenePromptJson extends BasePromptJson {
  /** 家具类型 */
  furniture_type?: string
  /** 场景风格 */
  scene_style?: string
  /** 空间描述 */
  space_description?: string
}

/**
 * 家具场景配置类型
 */
export interface FurnitureSceneConfig {
  /** 家具类型 */
  furnitureType: 'sofa' | 'chair' | 'table' | 'bed' | 'cabinet' | 'lighting' | 'storage' | 'outdoor'
  /** 场景风格 */
  sceneStyle: 'modern' | 'minimalist' | 'scandinavian' | 'industrial' | 'traditional' | 'luxury' | 'bohemian'
  /** 房间类型 */
  roomType: 'living_room' | 'bedroom' | 'dining_room' | 'office' | 'outdoor' | 'studio'
  /** 光线氛围 */
  lightingMood: 'bright' | 'warm' | 'dramatic' | 'natural' | 'evening' | 'morning'
  /** 空间大小 */
  spaceSize: 'compact' | 'medium' | 'spacious' | 'open_plan'
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 额外描述 */
  extraDescription?: string
}

/**
 * 家具场景提示词构建器
 */
export class FurnitureScenePromptBuilder extends PromptBuilder<FurnitureSceneConfig, FurnitureScenePromptJson> {
  constructor(options: PromptBuilderOptions<FurnitureScenePromptJson> & { config?: FurnitureSceneConfig }) {
    super(options)
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(): string {
    const { furnitureType, sceneStyle, lightingMood } = this.config

    const furnitureTips = this.getFurnitureTips(furnitureType)
    const styleTips = this.getStyleTips(sceneStyle)
    const lightingTips = this.getLightingTips(lightingMood)

    return `[Role: Professional Interior & Furniture Photographer]
You are a world-class interior photographer and 3D visualization specialist with extensive experience in furniture catalog photography and interior design visualization.

Your expertise includes:
- Creating realistic room scenes with proper perspective
- Matching lighting to scene mood and time of day
- Ensuring furniture proportions appear natural in space
- Maintaining style consistency throughout the scene

[Furniture Type: ${this.getFurnitureLabel(furnitureType)}]
${furnitureTips}

[Scene Style: ${this.getStyleLabel(sceneStyle)}]
${styleTips}

[Lighting Mood: ${this.getLightingLabel(lightingMood)}]
${lightingTips}

[Technical Standards - CRITICAL]
1. **Spatial Accuracy**:
   - Correct perspective and vanishing points
   - Realistic furniture scale in room context
   - Natural placement and spacing
   - Proper floor and wall alignment

2. **Lighting Integration**:
   - Consistent light source direction
   - Appropriate shadows matching scene lighting
   - Realistic reflections on surfaces
   - Natural color temperature

3. **Style Coherence**:
   - All elements match the chosen style
   - Complementary props and accessories
   - Harmonious color palette
   - Appropriate textures and materials

4. **Output Quality**:
   - High-resolution (${this.config.imageSize || '2K'})
   - Catalog and marketing ready
   - Professional interior photography standard
   - No visible compositing artifacts

[Output Requirement]
Generate the furniture scene image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(): string {
    const { furnitureType, sceneStyle, roomType, lightingMood, spaceSize, extraDescription } = this.config

    const furnitureLabel = this.getFurnitureLabel(furnitureType)
    const styleLabel = this.getStyleLabel(sceneStyle)
    const roomLabel = this.getRoomLabel(roomType)
    const spaceLabel = this.getSpaceLabel(spaceSize)

    return `[Furniture Scene Photography]

**Task**: Create a professional interior scene featuring ${furnitureLabel} in a ${styleLabel} ${roomLabel}.

**Furniture Type**: ${furnitureLabel}
**Interior Style**: ${styleLabel}
**Room Type**: ${roomLabel}
**Space Size**: ${spaceLabel}
**Lighting**: ${this.getLightingLabel(lightingMood)}

**Scene Requirements**:
- Place furniture naturally in the room context
- Ensure correct scale and proportions
- Include appropriate complementary decor
- Create realistic spatial depth

**Lighting & Atmosphere**:
- ${this.getLightingDescription(lightingMood)}
- Consistent shadows and reflections
- Natural color temperature for the mood
- Ambient lighting matches time of day

**Style Elements**:
- ${this.getStyleDescription(sceneStyle)}
- Harmonious color palette
- Appropriate textures and finishes
- Style-consistent accessories

**Quality Standards**:
- Sharp focus on furniture details
- Realistic material rendering
- Professional interior photography quality
- Ready for catalog and marketing

**Negative Constraints**:
Distorted perspective, incorrect proportions, floating furniture,
inconsistent lighting, mismatched styles, artificial look,
low quality, visible artifacts, unrealistic shadows.

${extraDescription ? `**Additional Requirements**:\n${extraDescription}\n` : ''}
[Output] Generate the furniture scene photo now.`
  }

  // ==================== 抽象方法实现 ====================

  protected fromPromptJson(): string {
    const json = this.promptJson
    if (!json) return ''

    if (json.full_prompt) {
      return json.full_prompt
    }

    const parts: string[] = []
    if (json.furniture_type) parts.push(`Furniture: ${json.furniture_type}`)
    if (json.scene_style) parts.push(`Style: ${json.scene_style}`)
    if (json.space_description) parts.push(`Space: ${json.space_description}`)

    return parts.join('\n')
  }

  protected fromPreset(): string {
    return this.assemble()
  }

  protected fromAnalysis(_analysis: GarmentAnalysis): string {
    return this.assemble()
  }

  protected getAnalysisPrompt(): string {
    return `Analyze the furniture/interior image:
1. Identify furniture type and style
2. Detect room type and space characteristics
3. Analyze current lighting conditions
4. Note material and color details
5. Suggest optimal scene composition

Return as JSON with fields: furniture_type, room_type, style, lighting, material_notes, composition_notes`
  }

  // ==================== 辅助方法 ====================

  private getFurnitureTips(type: string): string {
    const tips: Record<string, string> = {
      sofa: 'Sofas and sectionals. Focus on fabric texture, cushion shape, and seating comfort appeal.',
      chair: 'Chairs and seating. Highlight design lines, material quality, and ergonomic features.',
      table: 'Tables (dining, coffee, side). Show surface finish, leg design, and proportions.',
      bed: 'Beds and headboards. Emphasize comfort, bedding styling, and bedroom atmosphere.',
      cabinet: 'Cabinets and storage. Display functionality, finish quality, and organization appeal.',
      lighting: 'Lighting fixtures. Capture light quality, fixture design, and ambiance creation.',
      storage: 'Storage solutions (shelves, wardrobes). Show organization and space efficiency.',
      outdoor: 'Outdoor furniture. Weather-resistant materials and outdoor lifestyle appeal.'
    }
    return tips[type] || tips.sofa
  }

  private getStyleTips(style: string): string {
    const tips: Record<string, string> = {
      modern: 'Clean lines, neutral colors with bold accents, minimal ornamentation, contemporary materials.',
      minimalist: 'Essential forms only, monochromatic palette, negative space, functional beauty.',
      scandinavian: 'Light woods, white walls, cozy textiles, natural light, hygge atmosphere.',
      industrial: 'Exposed elements, metal and wood, raw textures, urban aesthetic.',
      traditional: 'Classic details, rich woods, elegant fabrics, timeless sophistication.',
      luxury: 'Premium materials, refined details, statement pieces, opulent atmosphere.',
      bohemian: 'Eclectic mix, rich colors, global influences, layered textures, relaxed vibe.'
    }
    return tips[style] || tips.modern
  }

  private getLightingTips(mood: string): string {
    const tips: Record<string, string> = {
      bright: 'Bright, even illumination. Clean, fresh, energetic atmosphere.',
      warm: 'Warm color temperature. Cozy, inviting, comfortable feeling.',
      dramatic: 'Strong contrast, directional light. Sophisticated, editorial look.',
      natural: 'Simulated natural daylight. Authentic, lifestyle appearance.',
      evening: 'Golden hour/twilight ambiance. Romantic, relaxed atmosphere.',
      morning: 'Soft morning light. Fresh, peaceful, new day feeling.'
    }
    return tips[mood] || tips.natural
  }

  private getFurnitureLabel(type: string): string {
    const labels: Record<string, string> = {
      sofa: 'sofa/sectional',
      chair: 'chair',
      table: 'table',
      bed: 'bed',
      cabinet: 'cabinet',
      lighting: 'lighting fixture',
      storage: 'storage furniture',
      outdoor: 'outdoor furniture'
    }
    return labels[type] || type
  }

  private getStyleLabel(style: string): string {
    const labels: Record<string, string> = {
      modern: 'modern',
      minimalist: 'minimalist',
      scandinavian: 'Scandinavian',
      industrial: 'industrial',
      traditional: 'traditional',
      luxury: 'luxury',
      bohemian: 'bohemian'
    }
    return labels[style] || style
  }

  private getRoomLabel(room: string): string {
    const labels: Record<string, string> = {
      living_room: 'living room',
      bedroom: 'bedroom',
      dining_room: 'dining room',
      office: 'home office',
      outdoor: 'outdoor space',
      studio: 'studio apartment'
    }
    return labels[room] || room
  }

  private getSpaceLabel(size: string): string {
    const labels: Record<string, string> = {
      compact: 'compact space',
      medium: 'medium-sized room',
      spacious: 'spacious room',
      open_plan: 'open plan layout'
    }
    return labels[size] || size
  }

  private getLightingLabel(mood: string): string {
    const labels: Record<string, string> = {
      bright: 'Bright',
      warm: 'Warm',
      dramatic: 'Dramatic',
      natural: 'Natural',
      evening: 'Evening',
      morning: 'Morning'
    }
    return labels[mood] || mood
  }

  private getLightingDescription(mood: string): string {
    const descriptions: Record<string, string> = {
      bright: 'Even, bright illumination with minimal shadows',
      warm: 'Warm golden tones creating cozy atmosphere',
      dramatic: 'Strong directional light with defined shadows',
      natural: 'Soft natural daylight through windows',
      evening: 'Warm ambient lighting with soft glows',
      morning: 'Fresh morning light with gentle warmth'
    }
    return descriptions[mood] || descriptions.natural
  }

  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      modern: 'Contemporary furniture with clean geometric forms',
      minimalist: 'Essential pieces with maximum negative space',
      scandinavian: 'Light woods, white walls, cozy textiles',
      industrial: 'Raw materials, exposed elements, urban edge',
      traditional: 'Classic elegance with refined details',
      luxury: 'Premium materials and sophisticated styling',
      bohemian: 'Eclectic mix with rich colors and textures'
    }
    return descriptions[style] || descriptions.modern
  }
}

export default FurnitureScenePromptBuilder
