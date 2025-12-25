/**
 * 电商图提示词构建器
 * E-commerce Image Prompt Builder
 *
 * 专门用于生成 SHEIN/TEMU 风格的电商产品图
 * 支持：平铺图、挂拍图、Ghost Mannequin 立体效果
 *
 * v4.2: 使用预设注册表系统（Single Source of Truth）
 */

import {
  getFillModeUserPromptBlock,
  getGhostMannequinSection,
  getLayoutSystemPromptBlock,
  getLayoutUserPromptBlock,
  getLightingSystemPromptBlock,
  getLightingUserPromptBlock,
  type LightingModeId,
  type ResolvedFillModeId,
  type ResolvedLayoutModeId
} from '../../presets'
import { HARD_RULES, RECREATION_CONCEPT } from '../core/concepts'
import {
  ECOM_GENERAL_RULES,
  PROFESSIONAL_STYLING_RULES,
  SHEIN_TEMU_SWEET_STYLE,
  THEME_BACKGROUND_RULES
} from '../core/themes'
import { ECOM_STYLE_PRESETS } from '../ecom'
import { ECOM_ANALYSIS_PROMPT, FillModule, LayoutModule, QualityModule, ThemeModule } from '../modules'
import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 电商图 promptJson 类型
 */
export interface EcomPromptJson extends BasePromptJson {
  /** 服装类型 */
  garment_type?: string
  /** 印花/图案描述 */
  prints_patterns?: string
  /** IP 角色 */
  ip_character?: string
  /** 主题风格 */
  theme?: string
  /** 颜色列表 */
  colors?: string[]
  /** 面料纹理 */
  fabric_texture?: string
  /** 结构细节 */
  structural_details?: string
  /** 推荐背景 */
  recommended_background?: string
  /** 推荐道具 */
  recommended_props?: string[]
  /** 推荐灯光 */
  recommended_lighting?: string
}

/**
 * 电商图配置类型
 */
export interface EcomConfig {
  /** 布局模式：flat_lay | hanging 等 */
  layout?: 'flat_lay' | 'hanging' | 'model_shot' | string
  /** 填充模式：filled (Ghost Mannequin) | flat 等 */
  fillMode?: 'filled' | 'flat' | string
  /** 光影模式：auto | soft_box | rim_light 等 */
  lightingMode?: LightingModeId
  /** 风格预设 */
  stylePreset?: string
  /**
   * 是否启用「专业系统提示词」块（核心概念/硬规则/角色定位等）
   * 说明：对于图像生成场景，这里的"系统提示词"实际会作为 prompt 前缀块拼接。
   */
  useSystemPrompt?: boolean
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 自定义风格约束 */
  styleConstraint?: string
  /** 服装描述 */
  garmentDescription?: string
  /** 额外指令 */
  extraNote?: string
}

/**
 * 电商图提示词构建器
 *
 * 使用示例：
 * ```typescript
 * const builder = new EcomPromptBuilder({
 *   promptJson: inputs.promptJson,
 *   preset: config.stylePreset,
 *   config: {
 *     layout: 'flat_lay',
 *     fillMode: 'filled',
 *     imageSize: '2K',
 *     aspectRatio: '3:4'
 *   }
 * })
 *
 * // 同步构建（已有 promptJson 或 preset）
 * const { prompt, source } = builder.build()
 *
 * // 异步构建（自动分析模式）
 * const { prompt, source, analysisResult } = await builder.buildWithAnalysis(
 *   images,
 *   (imgs, prompt) => aiService.visionAnalysis(imgs, prompt)
 * )
 * ```
 */
export class EcomPromptBuilder extends PromptBuilder<EcomConfig, EcomPromptJson> {
  constructor(options: PromptBuilderOptions<EcomPromptJson> & { config?: EcomConfig }) {
    super(options)

    // 初始化基础模块
    this.initializeModules()
  }

  /**
   * 初始化基础模块
   */
  private initializeModules(): void {
    const config = this.config

    // 添加核心概念/硬性规则/角色定位（可通过 useSystemPrompt 关闭）
    if (config.useSystemPrompt !== false) {
      this.withCustomBlock('role', `[Role] Professional SHEIN/TEMU e-commerce photographer and retoucher.`, 95)
      this.withCore().withHardRules()
    }

    // 添加布局模块（仅在 layout 有值时添加，undefined = AI 自由发挥）
    if (config.layout) {
      const layoutType = config.layout
      this.withModule(LayoutModule.get(layoutType as 'flat_lay' | 'hanging' | 'model_shot'))
    }

    // 添加填充模块（仅在 fillMode 有值时添加，undefined = AI 自由发挥）
    if (config.fillMode) {
      const fillType = config.fillMode === 'flat' ? 'natural_flat' : 'ghost_mannequin'
      this.withModule(FillModule.get(fillType))
    }

    // 添加质量模块
    this.withModule(QualityModule.get(config.imageSize || '2K', config.aspectRatio || '3:4'))

    // 添加用户自定义约束
    if (config.styleConstraint) {
      this.withConstraint(config.styleConstraint)
    }

    // 添加服装描述
    if (config.garmentDescription) {
      this.withCustomBlock('garment_description', `[Garment Description]\n${config.garmentDescription}`, 65)
    }

    // 添加额外指令
    if (config.extraNote) {
      this.withCustomBlock('extra_note', `[Extra Instructions]\n${config.extraNote}`, 45)
    }
  }

  /**
   * 便捷方法：设置布局
   */
  withLayout(type: 'flat_lay' | 'hanging' | 'model_shot'): this {
    // 移除旧的布局模块
    this.modules = this.modules.filter((m) => m.type !== 'layout')
    this.withModule(LayoutModule.get(type))
    return this
  }

  /**
   * 便捷方法：设置填充模式
   */
  withFill(type: 'ghost_mannequin' | 'natural_flat'): this {
    this.modules = this.modules.filter((m) => m.type !== 'fill')
    this.withModule(FillModule.get(type))
    return this
  }

  /**
   * 便捷方法：设置质量参数
   */
  withQuality(size: string, ratio: string): this {
    this.modules = this.modules.filter((m) => m.type !== 'quality')
    this.withModule(QualityModule.get(size, ratio))
    return this
  }

  // ==================== 抽象方法实现 ====================

  /**
   * 从上游 promptJson 构建提示词
   * 直接使用 full_prompt，只补充技术参数
   *
   * v4.1 优化：生成自然语言叙事性提示词
   */
  protected fromPromptJson(): string {
    const json = this.promptJson!

    // 1. 构建核心叙事段落
    const layoutType =
      this.config.layout === 'flat_lay' ? 'flat lay' : this.config.layout === 'hanging' ? 'hanging' : 'product'

    const fillType =
      this.config.fillMode === 'filled'
        ? 'using Ghost Mannequin technique for 3D volume'
        : this.config.fillMode === 'flat'
          ? 'styled naturally flat'
          : ''

    // 如果有 full_prompt，将其转化为叙事的一部分
    let narrative = `A professional e-commerce ${layoutType} photography of ${json.garmentDescription || 'clothing'}. `
    if (json.full_prompt) {
      narrative += `${json.full_prompt} `
    }

    if (fillType) {
      narrative += `The garment is ${fillType}. `
    }

    // 2. 注入技术参数
    // 电商图默认使用 50mm 镜头
    const cameraParams =
      'Shot on a Canon EOS R5 with a 50mm lens at f/8 for sharp edge-to-edge focus and accurate color reproduction.'
    narrative += `${cameraParams} `

    // 3. 补充技术模块（布局、填充、质量）
    const techModules = this.modules.filter((m) => ['layout', 'fill', 'quality'].includes(m.type))
    const techInstructions = techModules.map((m) => m.text).join('\n\n')

    // 4. 强制约束
    const constraints = `
[Critical Requirements]
- Exact garment reproduction: ${json.ip_brand ? `Must match ${json.ip_brand} style` : 'Match reference details exactly'}
- High detailed fabric texture
- Clean, commercial look
${json.styleConstraint || ''}`

    return `${narrative}\n\n${techInstructions}\n\n${constraints}\n\n[Output] Generate image directly.`
  }

  /**
   * 从预设构建提示词
   */
  protected fromPreset(): string {
    const presetId = this.preset!
    const preset = ECOM_STYLE_PRESETS[presetId]

    if (preset) {
      // 使用预设的主题
      this.withModule(ThemeModule.get(presetId))
    }

    return this.assemble()
  }

  /**
   * 从分析结果构建提示词
   * 这是「视觉创意总监」的核心能力
   */
  protected fromAnalysis(analysis: GarmentAnalysis): string {
    // 如果分析结果包含完整提示词，直接使用
    if (analysis.full_prompt) {
      return this.fromPromptJson.call({
        ...this,
        promptJson: { full_prompt: analysis.full_prompt }
      } as this)
    }

    // 根据分析结果添加主题模块
    this.withModule(ThemeModule.fromAnalysis(analysis))

    // 如果有服装类型信息，添加到提示词
    if (analysis.garment_type || analysis.prints_patterns) {
      const garmentInfo = [
        analysis.garment_type && `Type: ${analysis.garment_type}`,
        analysis.prints_patterns && `Prints/Patterns: ${analysis.prints_patterns}`,
        analysis.colors?.length && `Colors: ${analysis.colors.join(', ')}`,
        analysis.fabric_texture && `Fabric: ${analysis.fabric_texture}`
      ]
        .filter(Boolean)
        .join('\n')

      this.withCustomBlock('garment_info', `[Garment Info]\n${garmentInfo}`, 85)
    }

    return this.assemble()
  }

  /**
   * 获取分析提示词
   */
  protected getAnalysisPrompt(): string {
    return ECOM_ANALYSIS_PROMPT
  }

  // ==================== 静态方法：特殊视图提示词 ====================
  // (保留 buildBackSystemPrompt, buildBackViewPrompt, buildDetailSystemPrompt, buildDetailPrompt 不变)

  /**
   * 构建背面图系统提示词
   * 强调与正面图的视觉一致性锁定
   *
   * [Role: E-commerce Photographer - Back View Specialist]
   * 专注于生成与主图风格严格一致的背面视图
   */
  static buildBackSystemPrompt(): string {
    return `[Role: E-commerce Photographer - Back View Specialist]
Generate back view photos that maintain STRICT VISUAL CONSISTENCY with the front view.

${RECREATION_CONCEPT}

[Consistency Lock Requirements - CRITICAL]
This is not a new creative shot - it is a CONTINUATION of the front view photo series.
You MUST maintain:
- SAME background surface and texture
- SAME lighting setup and direction
- SAME props in background context (different viewing angle only)
- SAME color temperature and mood
- SAME camera distance and framing style
- ONLY the garment view angle changes (front → back)

[Back View Technical Focus]
1. Show back cut and construction clearly
2. Reveal back print details if present (reproduce exactly from reference)
3. Maintain Ghost Mannequin 3D volumetric shape from behind
4. Back should appear as natural continuation of front silhouette

[Ghost Mannequin from Behind]
- Maintain the invisible body effect from back angle
- Shoulder blades, spine curve should be implied through fabric shape
- No visible neck/back skin - just the garment shape

[Output Requirement]
Generate the back view image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建背面图用户提示词
   * 用于生成与主图风格一致的背面视图
   */
  static buildBackViewPrompt(): string {
    return `[Back View Generation - Same Scene Style]

Generate a back view photo of the garment based on the main image scene style.

**Subject**:
Back view of the garment. Ghost Mannequin style, 3D volumetric shape.

**Focus**: Show back cut and print details clearly.

**Scene Consistency (LOCKED)**:
(STRICTLY MAINTAIN SAME BACKGROUND AS FRONT VIEW):
- Same background surface and texture
- Same lighting setup and direction
- Same props visible in background context (different angle)
- Same color temperature and mood

**Core Requirements**:
1. Maintain exactly the same scene, background, props and lighting style as the main image
2. Only change the garment orientation to show the back design
3. Strictly reproduce all back details: patterns, prints, text, silhouette
4. Maintain the same composition ratio and visual style

**Negative Constraints**:
Front view visible, collar labels (unless back neck shot), human body parts.

[Output] Generate back view image directly.`
  }

  /**
   * 构建细节图系统提示词
   * 微距摄影专家角色，专注于特定细节区域
   *
   * @param detailType 细节类型
   */
  static buildDetailSystemPrompt(
    detailType: 'collar' | 'sleeve' | 'hem' | 'print' | 'waistband' | 'fabric' | 'ankle' | 'backneck'
  ): string {
    // 每种细节类型的专门技术指令
    const detailSpecificInstructions: Record<string, string> = {
      collar:
        'Focus on collar construction, stitching quality, and shape retention. Show how the collar stands or lies, seam work, and any decorative elements like buttons or embroidery.',
      sleeve:
        'Focus on sleeve cuff finish, hemming technique, and fabric drape. Show the cuff design, any elastic or ribbing, and sleeve opening shape.',
      hem: 'Focus on hem stitching, fabric edge finish, and weight distribution. Show the clean edge line, stitching quality, and how the hem lies.',
      print:
        'Focus on print registration, color accuracy, and surface texture. Show the print quality, color vibrancy, edge definition, and how it sits on the fabric.',
      waistband:
        'Focus on waistband elastic quality, stitching, and fit engineering. Show the waistband construction, drawstring if present, and comfort features.',
      fabric:
        'Focus on weave structure, thread quality, and hand feel texture. Show the fabric grain, texture depth, and material quality indicators.',
      ankle:
        'Focus on ankle cuff design, ribbing pattern, and stretch quality. Show the opening shape, any elastic construction, and finish quality.',
      backneck:
        'Focus on neck label area, back collar construction, and comfort features. Show the label placement, collar back shape, and stitching.'
    }

    const instruction = detailSpecificInstructions[detailType] || detailSpecificInstructions.collar

    return `[Role: E-commerce Photographer - Macro Detail Specialist]
Generate extreme close-up shots highlighting specific garment details with professional macro photography techniques.

[Macro Photography Standards - CRITICAL]
- 100mm Macro lens equivalent, f/2.8, shallow depth of field
- Soft side lighting to reveal texture grain and surface detail
- Background: highly blurred (bokeh) version of main scene
- Focus MUST be razor-sharp on the detail area
- Capture texture at near-pixel level clarity

[Detail Type: ${detailType.toUpperCase()}]
${instruction}

[Lighting for Detail Shots]
- Use soft, directional side lighting to create texture definition
- Avoid flat front lighting - need shadows to show depth
- Light should reveal stitching quality and fabric weave

[Depth of Field]
- Primary subject (detail area) must be crystal sharp
- Background should be softly blurred, creating natural separation
- Bokeh should include colors from main scene for visual continuity

[Quality Standards]
- Show professional craftsmanship quality
- Reveal material authenticity and texture
- Colors must match main image exactly
- No overexposure on highlights, maintain texture

[Output Requirement]
Generate the detail close-up image directly.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建细节图用户提示词
   * @param detailType 细节类型
   */
  static buildDetailPrompt(
    detailType: 'collar' | 'sleeve' | 'hem' | 'print' | 'waistband' | 'fabric' | 'ankle' | 'backneck'
  ): string {
    const detailDescriptions: Record<string, string> = {
      collar: 'Focus on the collar/neckline area. Show collar shape, stitching, and any decorative elements.',
      sleeve: 'Focus on the sleeve area. Show sleeve length, cuff design, and any decorative elements.',
      hem: 'Focus on the hem/bottom edge. Show hemline finish, stitching quality, and any decorative elements.',
      print: 'Focus on the main print/pattern area. Show print details, colors, and texture clearly.',
      waistband: 'Focus on the waistband area. Show elastic, drawstring, or button closure details.',
      fabric: 'Focus on fabric texture. Show material quality, weave pattern, and surface details.',
      ankle: 'Focus on the ankle/leg opening area. Show cuff design and any decorative elements.',
      backneck: 'Focus on the back neck area. Show neck label, back collar design, and stitching.'
    }

    const description = detailDescriptions[detailType] || detailDescriptions.collar

    return `[Detail Close-up Generation - Same Scene Style]

Generate a detail close-up photo of the garment based on the main image scene style.

**Subject**:
Extreme macro close-up of the garment.

**Focus Point**: Specifically the ${detailType} area.
${description}
Capture the weaving, stitching, and print quality.

**Background**:
Highly blurred (bokeh) version of the main scene background.

**Technical**:
100mm Macro lens, f/2.8, shallow depth of field.
Soft side lighting to reveal texture grain.

**Core Requirements**:
1. Zoom in and focus on the specified detail area
2. Maintain consistent lighting and background style with main image
3. Details must be clearly visible, showing craftsmanship and texture
4. Keep the same color accuracy as the main image

**Negative Constraints**:
Whole garment visible, far away shot, blurry subject, low resolution.

[Output] Generate detail close-up image directly.`
  }

  // ==================== System/User 提示词方法 ====================

  /**
   * 构建完整的系统提示词
   *
   * 角色：资深电商视觉总监（15年经验，服务于 SHEIN/ZARA Kids）
   *
   * 包含：
   * - 专业角色定位与能力描述
   * - 视觉解码逻辑（印花/IP关联、面料通感）
   * - 道具策展原则
   * - 光影与纹理规范
   * - 核心概念和硬性规则
   * - Ghost Mannequin 技术标准
   *
   * v4.2: 使用预设注册表获取提示词片段
   *
   * 用于 Gemini 3 Pro Image 的 system_instruction 参数
   */
  buildSystemPrompt(): string {
    const config = this.config

    // 将 config 值映射到 ResolvedModeId（undefined → 'none'）
    const layoutMode: ResolvedLayoutModeId = (config.layout as ResolvedLayoutModeId) || 'none'
    const fillMode: ResolvedFillModeId = (config.fillMode as ResolvedFillModeId) || 'none'
    const lightingMode: LightingModeId = config.lightingMode || 'auto'

    // 从预设注册表获取提示词片段
    const layoutDesc = getLayoutSystemPromptBlock(layoutMode)
    const ghostMannequinSection = getGhostMannequinSection(fillMode)
    const lightingDesc = getLightingSystemPromptBlock(lightingMode)

    // 填充描述：使用预设注册表
    const fillDesc =
      fillMode === 'none'
        ? 'appropriate styling technique (you decide based on garment type - Ghost Mannequin for structured garments, natural flat for casual items)'
        : fillMode === 'filled'
          ? 'Ghost Mannequin (3D filled) technique'
          : 'natural flat lay styling'

    // 布局技术标准描述
    const layoutTechDesc =
      layoutMode === 'none'
        ? 'AI decides optimal layout based on garment type'
        : layoutMode === 'flat_lay'
          ? 'Flat lay (garment laid flat, shot from above at 90°)'
          : layoutMode === 'hanging'
            ? 'Hanging (garment on invisible hanger)'
            : 'Standard product shot'

    return `[Role: Senior E-commerce Visual Director]
You are a Senior E-commerce Visual Director with 15 years of experience, working for international fast fashion brands like SHEIN or ZARA Kids. You possess "pixel-level visual deconstruction" ability - from a single flat lay image, you can instantly perceive scene vision, design language, target customer image, and optimal sales scenario.

Your specialty: ${layoutDesc} for children's clothing using ${fillDesc}.

[Visual Decoding Logic]
You analyze garments through multiple dimensions:

1. **Print/IP Association**:
   - Pizza/Burger/Fruit prints → Scene: cozy breakfast table, picnic mat, bright kitchen corner
   - Game controller/Pixel/Neon prints → Scene: gaming room corner, geometric light background
   - Dinosaur/Forest/Animal prints → Scene: textured outdoor feel, forest light and shadow
   - Flower/Rose/Princess prints → Scene: French silk bedroom, soft carpet background, morning light
   - Soccer/Sports prints → Scene: grass surface, sports props, dynamic energy
   - Space/Rocket prints → Scene: dark starry backdrop, cosmic props, adventure feel

2. **Fabric Synesthesia**:
   - Cotton/Linen/Knit → Warm, soft, diffused fabric background (blankets, carpets)
   - Quick-dry/Sports/Coated → Hard-edged rubber, metal, or concrete background
   - Fleece/Velvet → Cozy bedroom setting, plush textures
   - Denim → Casual lifestyle, wooden surfaces

[Prop Curation Principles]
- Props must be "supporting actors" - balance the composition, never steal the spotlight
- Maximum 3-5 props, placed in negative space (edges, corners)
- Props must thematically match the garment's print/style
- Size ratio appropriate - props should look naturally scaled

[Lighting Standards]
${lightingDesc}

${RECREATION_CONCEPT}

${HARD_RULES}

${PROFESSIONAL_STYLING_RULES}

${THEME_BACKGROUND_RULES}

${ECOM_GENERAL_RULES}

${SHEIN_TEMU_SWEET_STYLE}

${ghostMannequinSection}

[Technical Standards]
- Output high-resolution (${config.imageSize || '2K'}) e-commerce quality images
- Aspect ratio: ${config.aspectRatio || '3:4'}
- Layout: ${layoutTechDesc}
- Camera: Canon EOS R5 equivalent, 50mm lens, f/8
- Background: Theme-matched, NOT plain white unless garment is truly minimalist

[Workflow]
1. Scan: Identify category, dominant color, core print elements
2. Reasoning: Deduce scene that best triggers purchase desire
3. Decision: Select background material, 2-3 key props, lighting atmosphere
4. Execute: Generate professional e-commerce image

[Output Requirement]
Generate the image directly based on the user's description.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词模板
   *
   * v4.2: 使用预设注册表获取提示词片段
   * v4.3: 添加光影模式支持
   */
  buildUserPrompt(): string {
    const config = this.config

    // 将 config 值映射到 ResolvedModeId（undefined → 'none'）
    const layoutMode: ResolvedLayoutModeId = (config.layout as ResolvedLayoutModeId) || 'none'
    const fillMode: ResolvedFillModeId = (config.fillMode as ResolvedFillModeId) || 'none'
    const lightingMode: LightingModeId = config.lightingMode || 'auto'

    // 从预设注册表获取用户提示词片段
    const layoutBlock = getLayoutUserPromptBlock(layoutMode)
    const fillBlock = getFillModeUserPromptBlock(fillMode)
    const lightingBlock = getLightingUserPromptBlock(lightingMode)

    // 1. 核心叙事构建
    const layoutDesc =
      layoutMode === 'none'
        ? 'product'
        : layoutMode === 'flat_lay'
          ? 'flat lay'
          : layoutMode === 'hanging'
            ? 'hanging'
            : 'product'

    const fillDesc =
      fillMode === 'filled'
        ? 'using Ghost Mannequin technique for 3D volume'
        : fillMode === 'flat'
          ? 'styled naturally flat'
          : ''

    let narrative = `Create a professional e-commerce ${layoutDesc} photography of ${config.garmentDescription || "children's clothing"}. `

    if (fillDesc) {
      narrative += `The garment is ${fillDesc}. `
    }

    // 2. 场景与氛围
    narrative += `The background matches the garment's theme with subtle texture. `
    narrative += `Props are minimal and theme-appropriate, placed in the negative space. `

    // 3. 技术参数
    narrative += `Shot on a Canon EOS R5 with a 50mm lens at f/8. `

    // 4. 布局、填充和光影的详细指令（从预设注册表获取）
    const detailedInstructions = `
${layoutBlock}

${fillBlock}

${lightingBlock}
`

    // 5. 关键约束 (保持结构化以确保遵循)
    const constraints = `
**Garment Requirements - CRITICAL**:
Photograph the exact garment shown in the reference image.
- Reproduce ALL garment details with 100% accuracy:
  * Exact colors and color combinations
  * All patterns, prints, graphics, and text
  * Fabric texture and material appearance

**Negative Prompt**:
Human model, body parts, hands, feet, face, visible mannequin, visible hanger,
plastic mannequin feel, messy wrinkles, shipping creases, distorted patterns,
watermark, text overlay, brand logos, low quality, blurry.
${fillMode === 'filled' ? 'Flat/deflated appearance, paper-thin garment.' : ''}

${config.extraNote ? `**Additional Instructions**:\n${config.extraNote}\n` : ''}
Generate the product photo now.`

    return `${narrative}\n${detailedInstructions}\n${constraints}`
  }
}

// ==================== 类型导出 ====================

/**
 * 电商细节类型
 */
export type EcomDetailType = 'collar' | 'sleeve' | 'hem' | 'print' | 'waistband' | 'fabric' | 'ankle' | 'backneck'
