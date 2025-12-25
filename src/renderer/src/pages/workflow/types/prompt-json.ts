/**
 * 统一提示词 JSON Schema 类型定义
 *
 * 定义三种输出模式的 JSON 结构：
 * - ModelPromptJson: 模特提示词（用于 GeminiModelNode）
 * - PatternPromptJson: 图案提示词（用于 GeminiPatternNode）
 * - EcomPromptJson: 电商图提示词（用于 GeminiEcomNode）
 */

// ==================== 模特提示词 JSON ====================

/**
 * 模特提示词 JSON Schema
 * 用于生成模特穿着服装的图片
 */
export interface ModelPromptJson {
  // 基础信息
  type: 'model'
  version: '2.0'

  // 模特描述
  age_years: number
  gender: 'male' | 'female' | 'unisex'
  age_group: 'small_kid' | 'big_kid' | 'teen' | 'young_adult' | 'adult' | 'mature'
  ethnicity: string
  appearance: string

  // 服装描述
  subject: string
  garment_style: string
  garment_colors: string[]
  garment_patterns: string[]
  ip_character: string | null

  // 场景描述
  scene_preset: string
  foreground: string
  midground: string
  background: string
  pose: string
  expression: string

  // 技术参数
  composition: string
  visual_guidance: string
  color_tone: string
  lighting_mood: string
  camera_params: string

  // 附加信息
  has_hat: boolean
  has_mask: boolean
  ip_brand?: string | null
  ip_desc?: string | null
  hpsv3_score?: number

  // 输出提示词
  caption: string
  video_prompt: string
}

// ==================== 图案提示词 JSON ====================

/**
 * 图案风格类型
 */
export type PatternStyle = 'kawaii' | 'sporty' | 'preppy' | 'ip_theme' | 'sweet' | 'street' | 'geometric' | 'text'

/**
 * 图案类型
 */
export type PatternType = 'seamless' | 'placement' | 'allover'

/**
 * 色彩情绪
 */
export type ColorMood = 'pastel' | 'vibrant' | 'muted' | 'neon' | 'earth' | 'monochrome'

/**
 * 图案密度
 */
export type PatternDensity = 'sparse' | 'medium' | 'dense'

/**
 * 图案对称性
 */
export type PatternSymmetry = 'none' | 'horizontal' | 'vertical' | 'radial' | 'diagonal'

/**
 * 图案尺度
 */
export type PatternScale = 'small' | 'medium' | 'large'

/**
 * 图案提示词 JSON Schema
 * 用于生成服装图案/印花
 */
export interface PatternPromptJson {
  // 基础信息
  type: 'pattern'
  version: '2.0'

  // 图案风格
  pattern_style: PatternStyle
  pattern_type: PatternType
  target_gender: 'girl' | 'boy' | 'unisex'
  target_age: '1-3' | '4-7' | '8-12' | 'adult'

  // 元素描述
  main_elements: string[]
  secondary_elements: string[]
  micro_fillers: string[]
  ip_character: string | null
  ip_description: string | null

  // 色彩方案
  color_palette: string[]
  color_mood: ColorMood
  background_color: string

  // 布局参数
  density: PatternDensity
  layout: 'tossed' | 'clustered' | 'scattered' | 'flowing' | 'grid_broken'
  symmetry: PatternSymmetry
  scale: PatternScale
  line_style: 'clean_vector' | 'hand_drawn' | 'watercolor' | 'pixel' | '3d'

  // 技术要求
  seamless_required: boolean
  print_ready: boolean
  resolution_hint: '1024x1024' | '2048x2048' | '4096x4096'

  // 生成提示词
  style_prompt: string
  element_prompt: string
  layout_prompt: string
  color_prompt: string
  technical_prompt: string
  full_prompt: string
  hpsv3_score?: number
}

// ==================== 电商图提示词 JSON ====================

/**
 * 展示模式
 */
export type DisplayMode = 'flat_lay' | 'hanger' | 'scene' | 'model'

/**
 * 平台风格
 */
export type PlatformStyle = 'shein' | 'temu' | 'amazon' | 'taobao' | 'xiaohongshu'

/**
 * 背景类型
 */
export type BackgroundType =
  | 'white_fur'
  | 'wood_texture'
  | 'knit_fabric'
  | 'colored_wall'
  | 'gradient'
  | 'studio_white'
  | 'lifestyle_scene'
  | 'blanket'
  | 'bedding'

/**
 * 光线风格
 */
export type LightingStyle = 'natural_soft' | 'studio_even' | 'warm_ambient' | 'dramatic' | 'flat'

/**
 * 阴影风格
 */
export type ShadowStyle = 'minimal' | 'soft' | 'dramatic' | 'none'

/**
 * 构图方式
 */
export type CompositionStyle = '45_degree' | 'top_down' | 'front_straight' | 'angled'

/**
 * 道具放置方式
 */
export type PropPlacement = 'corners' | 'sides' | 'scattered' | 'minimal' | 'none'

/**
 * 填充模式（Ghost Mannequin 效果）
 */
export type FillMode = 'filled' | 'flat'

/**
 * 电商图提示词 JSON Schema
 * 用于生成电商产品展示图
 */
export interface EcomPromptJson {
  // 基础信息
  type: 'ecom'
  version: '2.0'

  // 展示模式
  layout_mode: 'flat_lay' | 'hanger'
  styling_notes: string
  display_mode?: DisplayMode
  platform_style: PlatformStyle

  // 服装信息（从图片分析）
  garment_type: 'set' | 'top' | 'bottom' | 'dress' | 'outerwear' | 'accessories'
  garment_style: string
  garment_colors: string[]
  garment_patterns: string[]
  has_print: boolean
  print_description: string | null
  ip_character: string | null
  ip_description: string | null

  // 背景设置
  background_type: BackgroundType
  background_color: string | null
  background_material: string | null

  // 道具推荐
  suggested_props: string[]
  prop_placement: PropPlacement
  prop_theme: string

  // 光线设置
  lighting_style: LightingStyle
  shadow_style: ShadowStyle

  // 构图参数
  composition: CompositionStyle
  garment_angle: number // 0-45 度
  fill_mode: FillMode

  // 生成提示词
  background_prompt: string
  props_prompt: string
  lighting_prompt: string
  composition_prompt: string
  full_prompt: string
  hpsv3_score?: number
}

// ==================== 联合类型 ====================

/**
 * 统一提示词 JSON 联合类型
 */
export type UnifiedPromptJson = ModelPromptJson | PatternPromptJson | EcomPromptJson

/**
 * 输出模式
 */
export type OutputMode = 'model' | 'pattern' | 'ecom' | 'all'

/**
 * 全部输出模式的 JSON 结构
 */
export interface AllModesPromptJson {
  type: 'all'
  version: '1.0'
  model: ModelPromptJson
  pattern: PatternPromptJson
  ecom: EcomPromptJson
}

// ==================== 工具函数 ====================

/**
 * 检查是否为模特提示词 JSON
 */
export function isModelPromptJson(json: any): json is ModelPromptJson {
  return json?.type === 'model'
}

/**
 * 检查是否为图案提示词 JSON
 */
export function isPatternPromptJson(json: any): json is PatternPromptJson {
  return json?.type === 'pattern'
}

/**
 * 检查是否为电商图提示词 JSON
 */
export function isEcomPromptJson(json: any): json is EcomPromptJson {
  return json?.type === 'ecom'
}

/**
 * 创建默认的模特提示词 JSON
 */
export function createDefaultModelPromptJson(): Partial<ModelPromptJson> {
  return {
    type: 'model',
    version: '2.0',
    age_group: 'small_kid',
    gender: 'female',
    scene_preset: 'home',
    has_hat: false,
    has_mask: false
  }
}

/**
 * 创建默认的图案提示词 JSON
 */
export function createDefaultPatternPromptJson(): Partial<PatternPromptJson> {
  return {
    type: 'pattern',
    version: '2.0',
    pattern_style: 'kawaii',
    pattern_type: 'seamless',
    target_gender: 'girl',
    target_age: '4-7',
    micro_fillers: [],
    main_elements: [],
    secondary_elements: [],
    color_palette: [],
    color_mood: 'pastel',
    background_color: '#FFFFFF',
    density: 'medium',
    symmetry: 'none',
    scale: 'medium',
    seamless_required: true,
    print_ready: true,
    resolution_hint: '1024x1024'
  }
}

/**
 * 创建默认的电商图提示词 JSON
 */
export function createDefaultEcomPromptJson(): Partial<EcomPromptJson> {
  return {
    type: 'ecom',
    version: '2.0',
    layout_mode: 'flat_lay',
    display_mode: 'flat_lay',
    platform_style: 'shein',
    garment_type: 'set',
    garment_colors: [],
    garment_patterns: [],
    has_print: false,
    background_type: 'white_fur',
    background_color: null,
    background_material: null,
    suggested_props: [],
    prop_placement: 'corners',
    prop_theme: '',
    lighting_style: 'natural_soft',
    shadow_style: 'soft',
    composition: '45_degree',
    garment_angle: 30,
    fill_mode: 'filled',
    print_description: null,
    ip_character: null,
    ip_description: null,
    styling_notes: ''
  }
}
