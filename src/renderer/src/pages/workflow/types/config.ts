/**
 * 泛型节点配置类型定义
 * Generic Node Configuration Types
 *
 * 提供类型安全的节点配置，避免 Record<string, any> 的类型丢失问题
 *
 * @version 1.0.0
 * @created 2024-12-19
 *
 * **Feature: generic-config-types, Phase 5.2**
 */

import type { Model } from '@renderer/types'

// ==================== 基础配置类型 ====================

/**
 * 通用图片尺寸选项
 */
export type ImageSizeOption = '1K' | '2K' | '4K' | 'HD' | 'FHD'

/**
 * 通用宽高比选项
 */
export type AspectRatioOption = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '2:3' | '3:2'

/**
 * AI 节点基础配置
 * 所有需要调用 AI 模型的节点都应该继承此类型
 */
export interface BaseAIConfig {
  /** Provider ID */
  providerId?: string
  /** Model ID */
  modelId?: string
  /** 完整的模型对象（运行时使用） */
  model?: Model
  /** 温度参数 */
  temperature?: number
  /** 最大 Token 数 */
  maxTokens?: number
}

/**
 * 图片生成节点基础配置
 * 所有图片生成节点都应该继承此类型
 */
export interface BaseImageGenerationConfig extends BaseAIConfig {
  /** 图片尺寸 */
  imageSize?: ImageSizeOption | string
  /** 宽高比 */
  aspectRatio?: AspectRatioOption | string
  /** 负面提示词 */
  negativePrompt?: string
  /** 自定义提示词覆盖 */
  customPrompts?: {
    system?: string
    user?: string
  }
}

// ==================== 电商图配置 ====================

/**
 * 电商图布局类型
 */
export type EcomLayoutType = 'flat_lay' | 'hanging' | 'model_shot'

/**
 * 电商图填充模式
 */
export type EcomFillMode = 'filled' | 'flat'

/**
 * 电商图细节类型
 */
export type EcomDetailType = 'collar' | 'sleeve' | 'hem' | 'print' | 'waistband' | 'fabric' | 'ankle' | 'backneck'

/**
 * 电商图节点配置
 */
export interface EcomNodeConfig extends BaseImageGenerationConfig {
  /** 布局模式 */
  layout?: EcomLayoutType
  /** 填充模式 */
  fillMode?: EcomFillMode
  /** 风格预设 ID */
  stylePreset?: string
  /** 是否使用系统提示词 */
  useSystemPrompt?: boolean
  /** 服装描述 */
  garmentDescription?: string
  /** 额外指令 */
  extraNote?: string
  /** 风格约束 */
  styleConstraint?: string
  /** 输出类型 */
  outputType?: 'main' | 'main_with_details'
  /** 细节类型列表（当 outputType 为 main_with_details 时） */
  detailTypes?: EcomDetailType[]
}

// ==================== 模特图配置 ====================

/**
 * 年龄段类型
 */
export type AgeGroupType = 'small_kid' | 'big_kid' | 'adult'

/**
 * 性别类型
 */
export type GenderType = 'male' | 'female'

/**
 * 场景预设类型
 */
export type ScenePresetType = 'home' | 'outdoor' | 'studio' | 'playground' | 'nature'

/**
 * 人种预设类型
 */
export type EthnicityPresetType = 'asian' | 'caucasian' | 'african_american' | 'hispanic' | 'mixed'

/**
 * 姿态预设类型
 */
export type PosePresetType = 'natural' | 'sitting' | 'playing' | 'walking'

/**
 * 模特图节点配置
 */
export interface ModelNodeConfig extends BaseImageGenerationConfig {
  /** 年龄段 */
  ageGroup?: AgeGroupType
  /** 性别 */
  gender?: GenderType
  /** 场景预设 */
  scenePreset?: ScenePresetType
  /** 人种预设 */
  ethnicityPreset?: EthnicityPresetType
  /** 姿态预设 */
  posePreset?: PosePresetType
  /** 风格模式 */
  styleMode?: 'daily' | 'commercial'
  /** 自定义提示词 */
  customPrompt?: string
}

// ==================== 图案生成配置 ====================

/**
 * 图案生成模式
 */
export type PatternGenerationMode = 'mode_a' | 'mode_b' | 'mode_c'

/**
 * 图案输出类型
 */
export type PatternOutputType = 'pattern_only' | 'set'

/**
 * 图案密度
 */
export type PatternDensity = 'sparse' | 'medium' | 'dense'

/**
 * 图案节点配置
 */
export interface PatternNodeConfig extends BaseImageGenerationConfig {
  /** 输出类型 */
  outputType?: PatternOutputType
  /** 生成模式 */
  generationMode?: PatternGenerationMode
  /** 风格预设 ID */
  stylePresetId?: string
  /** 风格预设提示词 */
  stylePresetPrompt?: string
  /** 颜色色调 */
  colorTone?: 'auto' | 'warm' | 'cool' | 'neutral'
  /** 图案密度 */
  density?: PatternDensity
  /** 自定义元素描述 */
  customElements?: string
}

// ==================== 通用图片生成配置 ====================

/**
 * 通用图片生成节点配置
 */
export interface GeneralImageNodeConfig extends BaseImageGenerationConfig {
  /** 用户提示词 */
  prompt?: string
  /** 系统提示词 */
  systemPrompt?: string
}

// ==================== 视频生成配置 ====================

/**
 * 视频生成节点配置
 */
export interface VideoNodeConfig extends BaseAIConfig {
  /** 视频时长（秒） */
  duration?: number
  /** 帧率 */
  fps?: number
  /** 视频尺寸 */
  videoSize?: string
  /** 运动强度 */
  motionIntensity?: 'low' | 'medium' | 'high'
  /** 提示词 */
  prompt?: string
  /** 负面提示词 */
  negativePrompt?: string
}

// ==================== 输入节点配置 ====================

/**
 * 图片输入节点配置
 */
export interface ImageInputNodeConfig {
  /** 输入模式 */
  inputMode?: 'upload' | 'folder' | 'url'
  /** 已上传图片列表 */
  uploadedImages?: Array<{
    name?: string
    path: string
    baseName?: string
    size?: number
  }>
  /** 文件夹路径列表 */
  folderPaths?: Array<{
    id?: string
    path: string
    label?: string
    imageCount?: number
    status?: 'pending' | 'valid' | 'invalid' | 'loading'
    errorMessage?: string
    images?: Array<{ path: string; name: string; baseName?: string; size?: number }>
  }>
  /** 图片 URL 列表（换行分隔） */
  imageUrls?: string
  /** 文件过滤器 */
  fileFilter?: string
  /** 排序方式 */
  sortBy?: 'name' | 'natural' | 'modified' | 'size'
  /** 排序顺序 */
  sortOrder?: 'asc' | 'desc'
  /** 最大图片数量 */
  maxImages?: number
  /** 输出端口数量 */
  outputPorts?: number
  /** 最大路径数量 */
  maxPaths?: number
  /** 匹配模式 */
  matchMode?: string
}

/**
 * 文本输入节点配置
 */
export interface TextInputNodeConfig {
  /** 文本内容 */
  text?: string
  /** 是否多行 */
  multiline?: boolean
  /** 占位符 */
  placeholder?: string
}

// ==================== 输出节点配置 ====================

/**
 * 输出节点配置
 */
export interface OutputNodeConfig {
  /** 输出类型 */
  outputType?: 'display' | 'file' | 'download' | 'both'
  /** 输出目录 */
  outputDirectory?: string
  /** 文件名模式 */
  fileNamePattern?: string
  /** 批处理文件夹模式 */
  batchFolderMode?: boolean
  /** 批处理文件夹模式 */
  batchFolderPattern?: string
}

// ==================== 动态端口配置 ====================

/**
 * 动态图片输入端口配置
 */
export interface DynamicImagePort {
  /** 端口 ID */
  id: string
  /** 端口标签 */
  label: string
  /** 数据类型 */
  dataType: 'image' | 'images'
  /** 是否必需 */
  required?: boolean
  /** 是否允许多连接 */
  multiple?: boolean
  /** 端口描述 */
  description?: string
}

/**
 * 支持动态端口的节点配置混入
 */
export interface DynamicPortsMixin {
  /** 动态图片输入端口配置 */
  imageInputPorts?: DynamicImagePort[]
  /** 动态图片输入数量（简化模式） */
  imageInputCount?: number
}

// ==================== 类型守卫函数 ====================

/**
 * 检查配置是否包含 AI 模型设置
 */
export function hasAIConfig(config: unknown): config is BaseAIConfig {
  if (!config || typeof config !== 'object') return false
  const c = config as Record<string, unknown>
  return 'providerId' in c || 'modelId' in c || 'model' in c
}

/**
 * 检查配置是否为图片生成配置
 */
export function isImageGenerationConfig(config: unknown): config is BaseImageGenerationConfig {
  if (!hasAIConfig(config)) return false
  const c = config as Record<string, unknown>
  return 'imageSize' in c || 'aspectRatio' in c
}

/**
 * 检查配置是否包含动态端口
 */
export function hasDynamicPorts(config: unknown): config is DynamicPortsMixin {
  if (!config || typeof config !== 'object') return false
  const c = config as Record<string, unknown>
  return 'imageInputPorts' in c || 'imageInputCount' in c
}

// ==================== 类型映射 ====================

/**
 * 节点类型到配置类型的映射
 * 注意：使用独立的映射接口，不使用索引签名避免类型冲突
 */
export type NodeConfigMap = {
  gemini_ecom: EcomNodeConfig
  gemini_generate_model: ModelNodeConfig
  gemini_model_from_clothes: ModelNodeConfig
  gemini_pattern: PatternNodeConfig
  gemini_generate: GeneralImageNodeConfig
  gemini_edit: GeneralImageNodeConfig
  gemini_edit_custom: GeneralImageNodeConfig
  kling_image2video: VideoNodeConfig
  image_input: ImageInputNodeConfig
  text_input: TextInputNodeConfig
  output: OutputNodeConfig
}

/**
 * 已知的节点配置类型
 */
export type KnownNodeConfigType = keyof NodeConfigMap

/**
 * 获取类型安全的节点配置
 * @example
 * const config = getTypedConfig<'gemini_ecom'>(node.data.config)
 * config.layout // 类型安全
 */
export function getTypedConfig<T extends KnownNodeConfigType>(config: Record<string, unknown>): NodeConfigMap[T] {
  return config as NodeConfigMap[T]
}

/**
 * 获取任意节点配置（通用）
 */
export function getNodeConfig(config: Record<string, unknown>): Record<string, unknown> {
  return config
}
