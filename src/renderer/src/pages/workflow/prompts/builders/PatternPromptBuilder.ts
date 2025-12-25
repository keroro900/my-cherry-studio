/**
 * 图案提示词构建器
 * Pattern Prompt Builder
 *
 * 专门用于生成无缝图案、T恤大图、Mockup 贴图
 * 支持：有机散落布局、智能面料比例、风格预设
 */

import { HARD_RULES, RECREATION_CONCEPT } from '../core/concepts'
import { PATTERN_ANALYSIS_PROMPT, QualityModule } from '../modules'
import type { GarmentAnalysis } from '../modules/types'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

// ==================== 核心规则常量 ====================

/**
 * 有机散落布局规则
 * 避免网格感，创造自然随机的图案分布
 */
export const ORGANIC_LAYOUT_RULES = `[Organic Layout Rules]
- AVOID grid-like arrangements - elements should feel naturally scattered
- Use varied rotation angles (0°, 15°, 30°, 45°, 60°, 90°) for each element
- Vary element sizes within 80%-120% of base size
- Create visual flow with curved invisible paths
- Cluster 2-3 elements occasionally, then leave breathing space
- Overlap elements slightly (10-20%) for depth
- Balance density across the canvas - no empty corners or crowded centers`

/**
 * 智能面料比例规则
 * 确保图案在实际面料上的尺寸合适
 */
export const SMART_SCALING_RULES = `[Smart Fabric Scaling Rules]
- Main elements should be 5-8cm when printed on fabric
- Secondary elements should be 2-4cm
- Micro fillers should be 0.5-1.5cm
- Consider garment size: kids clothes need smaller patterns
- Pattern repeat unit should be 15-25cm for optimal tiling
- Leave 30-40% negative space for visual breathing room`

/**
 * 无缝图案要求
 * 确保水平和垂直方向完美无缝
 */
export const SEAMLESS_REQUIREMENTS = `[Seamless Pattern Requirements]
- Pattern MUST tile perfectly in both horizontal and vertical directions
- NO visible seams or breaks at edges
- Elements crossing edges must continue seamlessly on opposite side
- Test mentally: if repeated 3x3, should look like one continuous design
- Avoid placing large elements at exact center - offset for better tiling`

/**
 * T恤大图要求
 * 用于胸前/背后的单独图案
 */
export const GRAPHIC_REQUIREMENTS = `[Graphic/Placement Print Requirements]
- Design should be self-contained with clear boundaries
- Optimal size: 20-30cm width for chest prints
- Include visual hierarchy: main focal point + supporting elements
- Consider print placement: center chest, left chest, full back
- Leave transparent/clean edges for easy placement`

// ==================== 图案风格预设 ====================

/**
 * 图案风格预设数据
 */
export const PATTERN_STYLE_PRESETS: Record<string, PatternStylePreset> = {
  kawaii: {
    id: 'kawaii',
    name: 'Kawaii',
    nameZh: '可爱风',
    description: 'Cute Japanese-inspired style with soft colors and adorable elements',
    keywords: ['cute', 'pastel', 'soft', 'round shapes', 'happy faces'],
    colorPalette: ['#FFB6C1', '#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C'],
    elements: ['stars', 'hearts', 'clouds', 'rainbows', 'cute animals', 'flowers']
  },
  sporty: {
    id: 'sporty',
    name: 'Sporty',
    nameZh: '运动风',
    description: 'Dynamic athletic style with bold colors and energetic elements',
    keywords: ['dynamic', 'bold', 'energetic', 'geometric', 'motion'],
    colorPalette: ['#FF4500', '#1E90FF', '#32CD32', '#FFD700', '#000000'],
    elements: ['lightning bolts', 'stripes', 'numbers', 'stars', 'abstract shapes']
  },
  preppy: {
    id: 'preppy',
    name: 'Preppy',
    nameZh: '学院风',
    description: 'Classic collegiate style with traditional patterns',
    keywords: ['classic', 'traditional', 'refined', 'structured'],
    colorPalette: ['#000080', '#8B0000', '#006400', '#F5F5DC', '#FFD700'],
    elements: ['stripes', 'anchors', 'crests', 'argyle', 'plaid']
  },
  sweet: {
    id: 'sweet',
    name: 'Sweet',
    nameZh: '甜美风',
    description: 'Soft romantic style with delicate florals and pastels',
    keywords: ['romantic', 'delicate', 'feminine', 'soft', 'dreamy'],
    colorPalette: ['#FFB6C1', '#FFC0CB', '#E6E6FA', '#F0FFF0', '#FFFACD'],
    elements: ['roses', 'ribbons', 'lace patterns', 'butterflies', 'pearls']
  },
  street: {
    id: 'street',
    name: 'Street',
    nameZh: '街头风',
    description: 'Urban street style with bold graphics and graffiti influence',
    keywords: ['urban', 'bold', 'edgy', 'graffiti', 'contemporary'],
    colorPalette: ['#000000', '#FFFFFF', '#FF0000', '#FFD700', '#00FF00'],
    elements: ['graffiti tags', 'skulls', 'flames', 'chains', 'abstract splashes']
  },
  geometric: {
    id: 'geometric',
    name: 'Geometric',
    nameZh: '几何风',
    description: 'Modern geometric patterns with clean lines',
    keywords: ['modern', 'clean', 'structured', 'minimalist', 'mathematical'],
    colorPalette: ['#2F4F4F', '#708090', '#B0C4DE', '#F5F5F5', '#FFD700'],
    elements: ['triangles', 'circles', 'hexagons', 'lines', 'dots']
  },
  nature: {
    id: 'nature',
    name: 'Nature',
    nameZh: '自然风',
    description: 'Organic nature-inspired patterns with botanical elements',
    keywords: ['organic', 'botanical', 'natural', 'earthy', 'fresh'],
    colorPalette: ['#228B22', '#8B4513', '#87CEEB', '#F5DEB3', '#90EE90'],
    elements: ['leaves', 'flowers', 'branches', 'birds', 'insects']
  },
  retro: {
    id: 'retro',
    name: 'Retro',
    nameZh: '复古风',
    description: 'Vintage-inspired patterns with nostalgic elements',
    keywords: ['vintage', 'nostalgic', '70s', '80s', 'groovy'],
    colorPalette: ['#FF6347', '#FFD700', '#40E0D0', '#FF69B4', '#9370DB'],
    elements: ['mushrooms', 'peace signs', 'vinyl records', 'retro shapes', 'disco balls']
  }
}

// ==================== 类型定义 ====================

/**
 * 图案风格预设类型
 */
export interface PatternStylePreset {
  id: string
  name: string
  nameZh: string
  description: string
  keywords: string[]
  colorPalette: string[]
  elements: string[]
}

/**
 * 图案 promptJson 类型
 */
export interface PatternPromptJson extends BasePromptJson {
  /** 图案风格 */
  pattern_style?: string
  /** 图案类型：seamless | placement | allover */
  pattern_type?: string
  /** 目标性别 */
  target_gender?: 'girl' | 'boy' | 'unisex'
  /** 目标年龄 */
  target_age?: string
  /** 主要元素 */
  main_elements?: string[]
  /** 次要元素 */
  secondary_elements?: string[]
  /** 微小填充元素 */
  micro_fillers?: string[]
  /** IP 角色 */
  ip_character?: string | null
  /** 色彩方案 */
  color_palette?: string[]
  /** 色彩情绪 */
  color_mood?: string
  /** 背景色 */
  background_color?: string
  /** 密度 */
  density?: 'sparse' | 'medium' | 'dense'
  /** 布局方式 */
  layout?: string
  /** 对称性 */
  symmetry?: string
  /** 尺度 */
  scale?: string
  /** 线条风格 */
  line_style?: string
  /** 风格提示词 */
  style_prompt?: string
  /** 元素提示词 */
  element_prompt?: string
  /** 布局提示词 */
  layout_prompt?: string
  /** 色彩提示词 */
  color_prompt?: string
  /** 技术提示词 */
  technical_prompt?: string
}

/**
 * 图案配置类型
 */
export interface PatternConfig {
  /** 图案类型：seamless | graphic | mockup */
  patternType?: 'seamless' | 'graphic' | 'mockup'
  /** 风格预设 ID */
  stylePreset?: string
  /** 自定义元素描述 */
  customElements?: string
  /** 色调 */
  colorTone?: string
  /** 密度 */
  density?: 'sparse' | 'medium' | 'dense'
  /** 是否启用智能面料比例 */
  enableSmartScaling?: boolean
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
  /** 目标性别 */
  targetGender?: 'girl' | 'boy' | 'unisex'
  /** 目标年龄 */
  targetAge?: string
  /** 自定义约束 */
  styleConstraint?: string
  /**
   * 生成模式
   * - mode_a: 元素重组（参考图 + 提示词）
   * - mode_b: 纯无缝化（仅参考图）
   * - mode_c: 设计大师（纯文本生成）
   */
  generationMode?: 'mode_a' | 'mode_b' | 'mode_c'
}

/**
 * 图案分析结果类型
 */
export interface PatternAnalysis extends GarmentAnalysis {
  pattern_type?: string
  style?: string
  repeat_type?: string
  suitable_for?: string[]
  mood?: string
}

// ==================== PatternPromptBuilder 类 ====================

/**
 * 图案提示词构建器
 *
 * 使用示例：
 * ```typescript
 * const builder = new PatternPromptBuilder({
 *   promptJson: inputs.promptJson,
 *   preset: config.stylePreset,
 *   config: {
 *     patternType: 'seamless',
 *     stylePreset: 'kawaii',
 *     density: 'medium',
 *     enableSmartScaling: true
 *   }
 * })
 *
 * // 同步构建
 * const { prompt, source } = builder.build()
 *
 * // 异步构建（自动分析模式）
 * const { prompt, source, analysisResult } = await builder.buildWithAnalysis(
 *   images,
 *   (imgs, prompt) => aiService.visionAnalysis(imgs, prompt)
 * )
 * ```
 */
export class PatternPromptBuilder extends PromptBuilder<PatternConfig, PatternPromptJson> {
  constructor(options: PromptBuilderOptions<PatternPromptJson> & { config?: PatternConfig }) {
    super(options)
    this.initializeModules()
  }

  /**
   * 初始化基础模块
   */
  private initializeModules(): void {
    const config = this.config

    // 添加角色定位
    this.withCustomBlock(
      'role',
      `[Role] Expert Textile Designer specializing in commercial all-over prints for fabric.`,
      95
    )

    // 添加核心规则
    this.withCore().withHardRules()

    // 根据图案类型添加特定规则
    const patternType = config.patternType || 'seamless'
    if (patternType === 'seamless') {
      this.withSeamlessRequirements()
    } else if (patternType === 'graphic') {
      this.withGraphicRequirements()
    }

    // 默认添加有机布局规则
    this.withOrganicLayout()

    // 如果启用智能面料比例
    if (config.enableSmartScaling !== false) {
      this.withSmartScaling()
    }

    // 添加质量模块
    this.withModule(QualityModule.get(config.imageSize || '2K', config.aspectRatio || '1:1'))

    // 添加用户自定义约束
    if (config.styleConstraint) {
      this.withConstraint(config.styleConstraint)
    }
  }

  // ==================== 图案特有方法 ====================

  /**
   * 添加无缝图案要求
   */
  withSeamlessRequirements(): this {
    this.withCustomBlock('seamless', SEAMLESS_REQUIREMENTS, 88)
    return this
  }

  /**
   * 添加有机散落布局规则
   */
  withOrganicLayout(): this {
    this.withCustomBlock('organic_layout', ORGANIC_LAYOUT_RULES, 85)
    return this
  }

  /**
   * 添加智能面料比例规则
   */
  withSmartScaling(): this {
    this.withCustomBlock('smart_scaling', SMART_SCALING_RULES, 82)
    return this
  }

  /**
   * 添加 T恤大图要求
   */
  withGraphicRequirements(): this {
    // 移除无缝要求（如果有）
    this.removeBlock('seamless')
    this.withCustomBlock('graphic', GRAPHIC_REQUIREMENTS, 88)
    return this
  }

  /**
   * 设置图案风格预设
   */
  withStylePreset(presetId: string): this {
    const preset = PATTERN_STYLE_PRESETS[presetId]
    if (preset) {
      const styleBlock = this.buildStylePresetBlock(preset)
      this.withCustomBlock('style_preset', styleBlock, 80)
    }
    return this
  }

  /**
   * 设置密度
   */
  withDensity(density: 'sparse' | 'medium' | 'dense'): this {
    const densityDescriptions: Record<string, string> = {
      sparse: 'Sparse layout with 50-60% negative space, elements well-separated',
      medium: 'Medium density with 30-40% negative space, balanced distribution',
      dense: 'Dense layout with 15-25% negative space, elements close together'
    }
    this.withCustomBlock('density', `[Density]\n${densityDescriptions[density]}`, 75)
    return this
  }

  /**
   * 设置自定义元素
   */
  withCustomElements(elements: string): this {
    if (elements && elements.trim()) {
      this.withCustomBlock('custom_elements', `[Custom Elements]\n${elements.trim()}`, 78)
    }
    return this
  }

  /**
   * 设置色调
   */
  withColorTone(colorTone: string): this {
    if (colorTone && colorTone !== 'auto') {
      this.withCustomBlock('color_tone', `[Color Tone]\n${colorTone}`, 72)
    }
    return this
  }

  // ==================== 抽象方法实现 ====================

  /**
   * 从上游 promptJson 构建提示词
   */
  protected fromPromptJson(): string {
    const json = this.promptJson!

    // 如果有 full_prompt，直接使用
    if (json.full_prompt) {
      // 获取技术模块
      const techModules = this.modules.filter((m) => ['quality'].includes(m.type))

      // 组装：上游提示词 + 技术参数
      const parts = [json.full_prompt, ...techModules.map((m) => m.text), '[Output] Generate pattern directly.']

      return parts.join('\n\n')
    }

    // 否则从 JSON 字段构建
    return this.buildFromJsonFields(json)
  }

  /**
   * 从预设构建提示词
   */
  protected fromPreset(): string {
    const presetId = this.preset!
    const preset = PATTERN_STYLE_PRESETS[presetId]

    if (preset) {
      this.withStylePreset(presetId)
    }

    // 应用配置中的其他设置
    const config = this.config
    if (config.density) {
      this.withDensity(config.density)
    }
    if (config.customElements) {
      this.withCustomElements(config.customElements)
    }
    if (config.colorTone) {
      this.withColorTone(config.colorTone)
    }

    return this.assemble()
  }

  /**
   * 从分析结果构建提示词
   */
  protected fromAnalysis(analysis: PatternAnalysis): string {
    // 如果分析结果包含完整提示词，直接使用
    if (analysis.full_prompt) {
      return this.fromPromptJson.call({
        ...this,
        promptJson: { full_prompt: analysis.full_prompt }
      } as this)
    }

    // 根据分析结果构建提示词
    const parts: string[] = []

    // 图案类型
    if (analysis.pattern_type) {
      parts.push(`Pattern Type: ${analysis.pattern_type}`)
    }

    // 风格
    if (analysis.style || analysis.mood) {
      parts.push(`Style: ${analysis.style || analysis.mood}`)
    }

    // 颜色
    if (analysis.colors?.length) {
      parts.push(`Colors: ${analysis.colors.join(', ')}`)
    }

    // 适用场景
    if ((analysis as PatternAnalysis).suitable_for?.length) {
      parts.push(`Suitable for: ${(analysis as PatternAnalysis).suitable_for!.join(', ')}`)
    }

    if (parts.length > 0) {
      this.withCustomBlock('analysis_result', `[Pattern Analysis]\n${parts.join('\n')}`, 85)
    }

    return this.assemble()
  }

  /**
   * 获取分析提示词
   */
  protected getAnalysisPrompt(): string {
    return PATTERN_ANALYSIS_PROMPT
  }

  // ==================== 辅助方法 ====================

  /**
   * 构建风格预设块
   */
  private buildStylePresetBlock(preset: PatternStylePreset): string {
    const lines = [
      `[Style: ${preset.name} (${preset.nameZh})]`,
      `Description: ${preset.description}`,
      `Keywords: ${preset.keywords.join(', ')}`,
      `Color Palette: ${preset.colorPalette.join(', ')}`,
      `Suggested Elements: ${preset.elements.join(', ')}`
    ]
    return lines.join('\n')
  }

  /**
   * 从 JSON 字段构建提示词
   */
  private buildFromJsonFields(json: PatternPromptJson): string {
    const parts: string[] = []

    // 任务定位
    parts.push('[Task: Professional Pattern/Print Design for Textile]')

    // 图案风格
    if (json.pattern_style || json.pattern_type) {
      parts.push(`[Pattern Info]
Style: ${json.pattern_style || 'seamless'}
Type: ${json.pattern_type || 'allover'}
Target: ${json.target_gender || 'unisex'}, ${json.target_age || 'all ages'}`)
    }

    // 元素描述
    const elements: string[] = []
    if (json.main_elements?.length) {
      elements.push(`Main Elements: ${json.main_elements.join(', ')}`)
    }
    if (json.secondary_elements?.length) {
      elements.push(`Secondary Elements: ${json.secondary_elements.join(', ')}`)
    }
    if (json.micro_fillers?.length) {
      elements.push(`Micro Fillers: ${json.micro_fillers.join(', ')}`)
    }
    if (json.ip_character) {
      elements.push(`IP Character: ${json.ip_character}`)
    }
    if (elements.length > 0) {
      parts.push(`[Elements]\n${elements.join('\n')}`)
    }

    // 色彩方案
    if (json.color_palette?.length || json.color_mood || json.background_color) {
      const colorInfo: string[] = []
      if (json.color_palette?.length) {
        colorInfo.push(`Palette: ${json.color_palette.join(', ')}`)
      }
      if (json.color_mood) {
        colorInfo.push(`Mood: ${json.color_mood}`)
      }
      if (json.background_color) {
        colorInfo.push(`Background: ${json.background_color}`)
      }
      parts.push(`[Color Scheme]\n${colorInfo.join('\n')}`)
    }

    // 布局参数
    if (json.density || json.layout || json.scale) {
      const layoutInfo: string[] = []
      if (json.density) {
        layoutInfo.push(`Density: ${json.density}`)
      }
      if (json.layout) {
        layoutInfo.push(`Layout: ${json.layout}`)
      }
      if (json.scale) {
        layoutInfo.push(`Scale: ${json.scale}`)
      }
      if (json.symmetry) {
        layoutInfo.push(`Symmetry: ${json.symmetry}`)
      }
      parts.push(`[Layout]\n${layoutInfo.join('\n')}`)
    }

    // 线条风格
    if (json.line_style) {
      parts.push(`[Line Style]\n${json.line_style}`)
    }

    // 使用各个提示词字段
    if (json.style_prompt) {
      parts.push(`[Style Direction]\n${json.style_prompt}`)
    }
    if (json.element_prompt) {
      parts.push(`[Element Details]\n${json.element_prompt}`)
    }
    if (json.layout_prompt) {
      parts.push(`[Layout Direction]\n${json.layout_prompt}`)
    }
    if (json.color_prompt) {
      parts.push(`[Color Direction]\n${json.color_prompt}`)
    }
    if (json.technical_prompt) {
      parts.push(`[Technical Requirements]\n${json.technical_prompt}`)
    }

    // 输出指令
    parts.push('[Output] Generate pattern directly.')

    return parts.join('\n\n')
  }

  // ==================== System/User 提示词方法 ====================

  /**
   * 构建完整的系统提示词
   *
   * 包含：
   * - 角色定位：专业纺织图案设计师
   * - RE-CREATION 核心概念（适用于参考图转图案）
   * - 硬性规则
   * - 有机布局规则
   * - 智能面料比例规则
   * - 无缝图案/大图要求
   *
   * 用于 Gemini 3 Pro Image 的 system_instruction 参数
   */
  buildSystemPrompt(): string {
    const config = this.config
    const generationMode = config.generationMode || 'mode_a'

    const patternTypeDesc =
      config.patternType === 'seamless'
        ? 'seamless tileable patterns'
        : config.patternType === 'graphic'
          ? 'placement graphics (chest prints, back prints)'
          : config.patternType === 'mockup'
            ? 'mockup visualizations'
            : 'textile patterns'

    const targetDesc = config.targetGender === 'girl' ? 'girls' : config.targetGender === 'boy' ? 'boys' : 'children'

    const patternRequirements = config.patternType === 'seamless' ? SEAMLESS_REQUIREMENTS : GRAPHIC_REQUIREMENTS

    // 根据 generationMode 生成不同的模式说明
    const modeDescription =
      generationMode === 'mode_a'
        ? `[Generation Mode: Element Recombination]
Extract elements from reference images and recombine them into a new pattern design.
- Carefully analyze the reference images to identify key visual elements
- Maintain the core visual elements while creating fresh, creative arrangements
- Combine elements with new layouts, rotations, and scales
- Reference images guide the style, but output should be a new creative composition`
        : generationMode === 'mode_b'
          ? `[Generation Mode: Pure Seamless Conversion]
Convert the reference image into a seamless tileable pattern.
- Focus primarily on making the pattern perfectly repeatable without visible seams
- Preserve the original visual style and color palette as much as possible
- Adjust element positions to ensure seamless tiling in all directions
- Minimal creative interpretation - stay faithful to the source image`
          : `[Generation Mode: Design Master - Text-Driven Creation]
Pure text-driven design - create an original pattern based solely on the text description.
- No reference images needed - rely entirely on the text prompt
- Be creative and innovative in element design and arrangement
- Generate unique, original visual elements from imagination
- Full creative freedom within the style guidelines`

    return `[Role: Expert Textile Designer]
You are an expert textile designer specializing in ${patternTypeDesc} for ${targetDesc}'s clothing.
Your patterns are used on commercial e-commerce platforms like SHEIN and TEMU.

${modeDescription}

${RECREATION_CONCEPT}

${HARD_RULES}

${ORGANIC_LAYOUT_RULES}

${SMART_SCALING_RULES}

${patternRequirements}

[Technical Standards]
- Output high-resolution (${config.imageSize || '2K'}) pattern images
- Aspect ratio: ${config.aspectRatio || '1:1'}
- Pattern type: ${config.patternType === 'seamless' ? 'Seamless tile (must tile perfectly in all directions)' : 'Self-contained graphic with clear boundaries'}
- Density: ${config.density || 'medium'} (${config.density === 'sparse' ? '50-60% negative space' : config.density === 'dense' ? '15-25% negative space' : '30-40% negative space'})
- Color accuracy: Vibrant, print-ready colors
- Edge handling: ${config.patternType === 'seamless' ? 'Elements crossing edges must continue seamlessly' : 'Clean transparent/white edges for placement'}

[Output Requirement]
Generate the pattern image directly based on the user's description.
Do not output any text, JSON, or explanations - only generate the pattern.`
  }

  /**
   * 构建用户提示词模板
   *
   * 包含：
   * - 图案风格描述
   * - 元素列表
   * - 色彩方案
   * - 布局指导
   *
   * 这是发送给 AI 的实际任务描述
   * 根据 generationMode 动态调整提示词内容
   */
  buildUserPrompt(): string {
    const config = this.config
    const generationMode = config.generationMode || 'mode_a'

    // 获取风格预设信息
    const preset = config.stylePreset ? PATTERN_STYLE_PRESETS[config.stylePreset] : null

    const styleSection = preset
      ? `[Style: ${preset.name} (${preset.nameZh})]
- Description: ${preset.description}
- Keywords: ${preset.keywords.join(', ')}
- Color palette: ${preset.colorPalette.join(', ')}
- Suggested elements: ${preset.elements.join(', ')}`
      : `[Style]
- Create a ${config.patternType === 'seamless' ? 'seamless all-over pattern' : 'standalone graphic design'}
- Target audience: ${config.targetGender === 'girl' ? 'Girls' : config.targetGender === 'boy' ? 'Boys' : 'Children'} (${config.targetAge || 'all ages'})`

    const densitySection = `[Density: ${(config.density || 'medium').toUpperCase()}]
${
  config.density === 'sparse'
    ? '- Sparse layout with 50-60% negative space\n- Elements well-separated with breathing room'
    : config.density === 'dense'
      ? '- Dense layout with 15-25% negative space\n- Elements close together, creating rich visual texture'
      : '- Medium density with 30-40% negative space\n- Balanced distribution of elements'
}`

    const colorSection =
      config.colorTone && config.colorTone !== 'auto'
        ? `[Color Tone]
${config.colorTone}`
        : ''

    const elementsSection = config.customElements
      ? `[Custom Elements]
${config.customElements}`
      : ''

    // 根据 generationMode 生成不同的任务指令
    const taskInstruction =
      generationMode === 'mode_a'
        ? `Generate a professional ${config.patternType === 'seamless' ? 'seamless tileable pattern' : 'placement graphic'} by extracting and recombining elements from the reference images:`
        : generationMode === 'mode_b'
          ? `Convert the reference image into a ${config.patternType === 'seamless' ? 'seamless tileable pattern' : 'placement graphic'}. Preserve the original visual style while ensuring perfect tiling:`
          : `Create an original ${config.patternType === 'seamless' ? 'seamless tileable pattern' : 'placement graphic'} from your imagination based on the following specifications:`

    // Mode C 不需要参考图说明
    const referenceNote =
      generationMode === 'mode_c'
        ? ''
        : generationMode === 'mode_b'
          ? `\n[Reference Image Handling]
- Preserve the original visual elements and color palette
- Focus on making edges seamless for perfect tiling
- Minimal creative modification - stay faithful to the source\n`
          : `\n[Reference Image Handling]
- Extract key visual elements from reference images
- Recombine elements with creative new arrangements
- Use reference as style guide, but create fresh compositions\n`

    return `${taskInstruction}

${styleSection}
${referenceNote}
${densitySection}

${colorSection}

${elementsSection}

[Layout Requirements]
- Use organic, non-grid layout - elements should feel naturally scattered
- Vary rotation angles (0°, 15°, 30°, 45°, 60°, 90°) for visual interest
- Vary element sizes within 80%-120% of base size
- Create visual flow with curved invisible paths
${config.patternType === 'seamless' ? '- Ensure perfect seamless tiling in all directions\n- Elements crossing edges must continue on opposite side' : '- Design should be self-contained with clear visual hierarchy\n- Main focal point + supporting elements'}

[Scaling for Fabric]
- Main elements: 5-8cm when printed on fabric
- Secondary elements: 2-4cm
- Micro fillers: 0.5-1.5cm
- Pattern repeat unit: 15-25cm for optimal tiling

[Strict Prohibitions]
- NO grid-like arrangements
- NO text, watermarks, or logos
- NO inappropriate content
- NO empty corners or crowded centers
${config.patternType === 'seamless' ? '- NO visible seams or breaks at edges' : ''}

${config.styleConstraint ? `[Additional Constraints]\n${config.styleConstraint}\n` : ''}
Generate the ${config.patternType === 'seamless' ? 'seamless pattern' : 'graphic design'} now.`
  }
}

// ==================== 工具函数 ====================

/**
 * 获取图案风格预设
 */
export function getPatternStylePreset(presetId: string): PatternStylePreset | undefined {
  return PATTERN_STYLE_PRESETS[presetId]
}

/**
 * 获取所有图案风格预设选项
 */
export function getPatternStyleOptions(): Array<{ value: string; label: string; labelZh: string }> {
  return Object.values(PATTERN_STYLE_PRESETS).map((preset) => ({
    value: preset.id,
    label: preset.name,
    labelZh: preset.nameZh
  }))
}
