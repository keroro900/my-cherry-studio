/**
 * 一致性参考系统类型定义
 * Consistency Reference System Type Definitions
 *
 * 用于多图生成时保持风格、产品、角色、场景的一致性
 */

// ============================================================================
// 一致性参考类型
// ============================================================================

/**
 * 一致性类型
 */
export type ConsistencyType =
  | 'product' // 产品一致性（同一产品多角度）
  | 'style' // 风格一致性（色调、氛围）
  | 'character' // 角色一致性（同一模特/人物）
  | 'scene' // 场景一致性（同一背景/环境）
  | 'brand' // 品牌一致性（品牌视觉语言）

/**
 * 一致性类型元数据
 */
export interface ConsistencyTypeMeta {
  id: ConsistencyType
  label: string
  labelEn: string
  icon: string
  description: string
}

/**
 * 一致性类型映射表
 */
export const CONSISTENCY_TYPES: Record<ConsistencyType, ConsistencyTypeMeta> = {
  product: {
    id: 'product',
    label: '产品一致性',
    labelEn: 'Product Consistency',
    icon: '📦',
    description: '确保同一产品在不同角度/场景下保持一致'
  },
  style: {
    id: 'style',
    label: '风格一致性',
    labelEn: 'Style Consistency',
    icon: '🎨',
    description: '保持色调、光影、氛围的统一风格'
  },
  character: {
    id: 'character',
    label: '角色一致性',
    labelEn: 'Character Consistency',
    icon: '👤',
    description: '确保同一模特/角色在不同图片中保持一致'
  },
  scene: {
    id: 'scene',
    label: '场景一致性',
    labelEn: 'Scene Consistency',
    icon: '🏠',
    description: '保持背景、环境、场景元素的一致'
  },
  brand: {
    id: 'brand',
    label: '品牌一致性',
    labelEn: 'Brand Consistency',
    icon: '🏷️',
    description: '遵循品牌视觉规范和设计语言'
  }
}

// ============================================================================
// 提取的特征
// ============================================================================

/**
 * 颜色特征
 */
export interface ColorFeatures {
  /** 主色调 (hex 格式) */
  primaryColors: string[]

  /** 辅助色 */
  secondaryColors: string[]

  /** 色彩饱和度等级 */
  saturationLevel: 'low' | 'medium' | 'high'

  /** 色温 */
  colorTemperature: 'cool' | 'neutral' | 'warm'

  /** 整体亮度 */
  brightness: 'dark' | 'medium' | 'bright'
}

/**
 * 风格特征
 */
export interface StyleFeatures {
  /** 风格描述（自然语言） */
  styleDescription: string

  /** 风格标签 */
  styleTags: string[]

  /** 摄影风格 */
  photographyStyle?: 'studio' | 'lifestyle' | 'editorial' | 'commercial' | 'artistic'

  /** 光影风格 */
  lightingStyle?: 'soft' | 'dramatic' | 'natural' | 'high_key' | 'low_key'

  /** 后期处理风格 */
  postProcessing?: string
}

/**
 * 角色特征
 */
export interface CharacterFeatures {
  /** 年龄描述 */
  ageDescription: string

  /** 性别 */
  gender: 'male' | 'female' | 'unknown'

  /** 外貌特征 */
  appearance: string

  /** 发型描述 */
  hairstyle?: string

  /** 表情特征 */
  expression?: string

  /** 体态特征 */
  bodyType?: string
}

/**
 * 产品特征
 */
export interface ProductFeatures {
  /** 产品类型 */
  productType: string

  /** 材质描述 */
  materials: string[]

  /** 关键设计元素 */
  designElements: string[]

  /** 质感描述 */
  texture?: string

  /** 特殊工艺 */
  craftDetails?: string
}

/**
 * 场景特征
 */
export interface SceneFeatures {
  /** 场景类型 */
  sceneType: 'indoor' | 'outdoor' | 'studio' | 'abstract'

  /** 场景描述 */
  sceneDescription: string

  /** 背景元素 */
  backgroundElements: string[]

  /** 道具 */
  props: string[]

  /** 氛围 */
  mood: string

  /** 时间/光线 */
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown'
}

/**
 * 综合提取特征
 */
export interface ExtractedFeatures {
  /** 颜色特征 */
  colors: ColorFeatures

  /** 风格特征 */
  style: StyleFeatures

  /** 角色特征（如有人物） */
  character?: CharacterFeatures

  /** 产品特征（如有产品） */
  product?: ProductFeatures

  /** 场景特征 */
  scene?: SceneFeatures

  /** 置信度 (0-1) */
  confidence: number

  /** 原始分析文本 */
  rawAnalysis?: string
}

// ============================================================================
// 一致性配置
// ============================================================================

/**
 * 一致性参考配置
 */
export interface ConsistencyReference {
  /** 唯一标识 */
  id: string

  /** 名称 */
  name: string

  /** 一致性类型 */
  type: ConsistencyType

  /** 参考图片列表 (base64 或 URL) */
  referenceImages: string[]

  /** 提取的特征 */
  extractedFeatures: ExtractedFeatures

  /** 生成的约束提示词 */
  constraintPrompt: string

  /** 是否激活 */
  isActive: boolean

  /** 创建时间 */
  createdAt: number

  /** 更新时间 */
  updatedAt: number

  /** 使用次数 */
  usageCount: number
}

/**
 * 创建一致性参考的参数
 */
export interface CreateConsistencyParams {
  name: string
  type: ConsistencyType
  referenceImages: string[]
}

/**
 * 更新一致性参考的参数
 */
export interface UpdateConsistencyParams {
  id: string
  name?: string
  type?: ConsistencyType
  referenceImages?: string[]
  isActive?: boolean
}

// ============================================================================
// 特征提取
// ============================================================================

/**
 * 特征提取请求
 */
export interface FeatureExtractionRequest {
  /** 要分析的图片 */
  images: string[]

  /** 一致性类型（影响分析侧重点） */
  consistencyType: ConsistencyType

  /** 额外上下文描述 */
  contextDescription?: string
}

/**
 * 特征提取结果
 */
export interface FeatureExtractionResult {
  /** 是否成功 */
  success: boolean

  /** 提取的特征 */
  features?: ExtractedFeatures

  /** 生成的约束提示词 */
  constraintPrompt?: string

  /** 错误信息 */
  error?: string

  /** 处理时间 (ms) */
  processingTime?: number
}

/**
 * 特征提取进度
 */
export interface FeatureExtractionProgress {
  /** 当前步骤 */
  step: 'uploading' | 'analyzing' | 'extracting' | 'generating' | 'done'

  /** 步骤描述 */
  stepDescription: string

  /** 进度百分比 (0-100) */
  percentage: number
}

// ============================================================================
// 约束提示词生成
// ============================================================================

/**
 * 约束提示词生成参数
 */
export interface ConstraintPromptParams {
  /** 提取的特征 */
  features: ExtractedFeatures

  /** 一致性类型 */
  consistencyType: ConsistencyType

  /** 强度级别 */
  strengthLevel: 'weak' | 'medium' | 'strong'

  /** 是否包含负面约束 */
  includeNegative: boolean
}

/**
 * 约束提示词结果
 */
export interface ConstraintPromptResult {
  /** 正面约束 */
  positiveConstraints: string

  /** 负面约束 */
  negativeConstraints: string

  /** 组合后的完整约束 */
  fullConstraint: string

  /** 关键点提示 */
  keyPoints: string[]
}

// ============================================================================
// 一致性系统状态
// ============================================================================

/**
 * 一致性系统状态
 */
export interface ConsistencyState {
  /** 所有一致性参考 */
  references: ConsistencyReference[]

  /** 当前激活的参考 ID 列表 */
  activeReferenceIds: string[]

  /** 是否正在提取特征 */
  isExtracting: boolean

  /** 提取进度 */
  extractionProgress?: FeatureExtractionProgress

  /** 错误信息 */
  error?: string
}

/**
 * 一致性系统默认状态
 */
export const DEFAULT_CONSISTENCY_STATE: ConsistencyState = {
  references: [],
  activeReferenceIds: [],
  isExtracting: false
}

// ============================================================================
// 一致性应用
// ============================================================================

/**
 * 应用一致性约束的选项
 */
export interface ApplyConsistencyOptions {
  /** 要应用的参考 ID 列表 */
  referenceIds: string[]

  /** 约束强度 */
  strengthLevel: 'weak' | 'medium' | 'strong'

  /** 是否合并多个参考的约束 */
  mergeConstraints: boolean
}

/**
 * 一致性应用结果
 */
export interface ApplyConsistencyResult {
  /** 组合后的系统提示词补充 */
  systemPromptAddition: string

  /** 组合后的用户提示词补充 */
  userPromptAddition: string

  /** 负面提示词补充 */
  negativePromptAddition: string

  /** 应用的参考数量 */
  appliedCount: number
}
