/**
 * 节点类型和配置定义
 *
 * 从 definitions/index.ts 抽取的纯类型定义文件
 * 不包含任何运行时值（如 NODE_REGISTRY）
 */

import type { Model } from '@renderer/types'

// ==================== 数据类型定义 ====================

/**
 * 工作流中传递的数据类型
 */
export type WorkflowDataType = 'text' | 'image' | 'images' | 'video' | 'json' | 'any' | 'boolean' | 'number'

/**
 * 节点端口定义
 */
export interface NodeHandle {
  id: string
  label: string
  dataType: WorkflowDataType
  required?: boolean
  multiple?: boolean
  description?: string
}

// ==================== 节点类型枚举 ====================

/**
 * 工作流节点类型
 */
export enum WorkflowNodeType {
  // 输入节点
  IMAGE_INPUT = 'image_input',
  TEXT_INPUT = 'text_input',
  FILE_INPUT = 'file_input',

  // AI 节点
  UNIFIED_PROMPT = 'unified_prompt',
  VIDEO_PROMPT = 'video_prompt',

  // 电商内容节点
  PRODUCT_DESCRIPTION = 'product_description',
  PLATFORM_RESIZE = 'platform_resize',
  APLUS_CONTENT = 'aplus_content',

  // Gemini 图片处理
  GEMINI_EDIT = 'gemini_edit',
  GEMINI_EDIT_CUSTOM = 'gemini_edit_custom',
  GEMINI_GENERATE = 'gemini_generate',
  GEMINI_GENERATE_MODEL = 'gemini_generate_model',
  GEMINI_MODEL_FROM_CLOTHES = 'gemini_model_from_clothes',
  GEMINI_ECOM = 'gemini_ecom',
  GEMINI_PATTERN = 'gemini_pattern',

  // 图片操作
  COMPARE_IMAGE = 'compare_image',

  // 行业摄影节点
  JEWELRY_PHOTO = 'jewelry_photo',
  FOOD_PHOTO = 'food_photo',
  PRODUCT_SCENE = 'product_scene',
  JEWELRY_TRYON = 'jewelry_tryon',
  EYEWEAR_TRYON = 'eyewear_tryon',
  FOOTWEAR_DISPLAY = 'footwear_display',
  COSMETICS_PHOTO = 'cosmetics_photo',
  FURNITURE_SCENE = 'furniture_scene',
  ELECTRONICS_PHOTO = 'electronics_photo',

  // 视频
  KLING_IMAGE2VIDEO = 'kling_image2video',

  // 外部服务
  RUNNINGHUB_APP = 'runninghub_app',

  // 流程控制
  CONDITION = 'condition',
  SUBFLOW = 'subflow',

  // ===== 高级节点 (List/Pipe/Switch/Loop) =====
  // List 节点 - 批处理
  IMAGE_LIST = 'image_list',
  TEXT_LIST = 'text_list',
  LIST_MERGE = 'list_merge',
  LIST_FILTER = 'list_filter',

  // Pipe 节点 - 数据路由
  PIPE = 'pipe',
  PIPE_ROUTER = 'pipe_router',
  PIPE_MERGER = 'pipe_merger',

  // Switch 节点 - 条件分支
  SWITCH = 'switch',
  MULTI_SWITCH = 'multi_switch',

  // Loop 节点 - 循环执行
  LOOP = 'loop',
  LOOP_INDEX = 'loop_index',
  LOOP_LIST = 'loop_list',

  // 输出
  OUTPUT = 'output'
}

// ==================== 节点配置类型 ====================

export interface ImageGenerateConfig {
  providerId?: string
  model?: Model
  prompt?: string
  negativePrompt?: string
  imageSize?: string
  aspectRatio?: string
  batchSize?: number
  seed?: string
  numInferenceSteps?: number
  guidanceScale?: number
  promptEnhancement?: boolean
}

export interface ImageEditConfig {
  providerId?: string
  model?: Model
  mode: 'preset' | 'custom'
  imageSize?: string
  aspectRatio?: string
  editMode?: 'single' | 'multi'
  ageGroup?: 'small_kid' | 'big_kid' | 'adult'
  gender?: 'male' | 'female'
  ethnicityPreset?: 'caucasian' | 'african_american' | 'asian' | 'mixed'
  scenePreset?: 'home' | 'outdoor'
  baseImageSource?: string
  customPrompt?: string
}

export interface ImageToVideoConfig {
  providerId?: string
  duration?: number
  fps?: number
  videoPrompt?: string
  useUpstreamPrompt?: boolean
}

export interface ConditionConfig {
  field: string
  operator:
    | 'equals'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'not_contains'
    | 'not_equals'
    | 'exists'
    | 'not_exists'
  value: string
}

export interface OutputConfig {
  outputType: 'file' | 'display' | 'download'
  fileNamePattern?: string
  outputDirectory?: string
}

export interface FolderPathItem {
  id: string
  path: string
  label: string
  imageCount?: number
  images?: ImageFileInfo[]
  status: 'pending' | 'valid' | 'invalid' | 'loading'
  errorMessage?: string
}

export interface ImageFileInfo {
  name: string
  path: string
  size?: number
  baseName: string
}

export type ImageMatchMode = 'byOrder' | 'byName' | 'hybrid'

export interface ImageInputConfig {
  folderPaths: FolderPathItem[]
  maxPaths?: number
  matchMode?: ImageMatchMode
  description?: string
  images?: string[]
  directory?: string
  maxImages?: number
}

export interface TextInputConfig {
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
  text?: string
}

// ==================== 高级节点配置类型 ====================

/**
 * List 节点配置
 */
export interface ListNodeConfig {
  listType: 'image' | 'text' | 'any'
  initialCapacity?: number
  maxCapacity?: number
  dynamicAdd?: boolean
  operation?: 'merge' | 'split' | 'filter' | 'map'
  filterCondition?: {
    field?: string
    operator?: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'not_contains'
    value?: string
  }
  mapOperation?: {
    type: 'resize' | 'format' | 'custom'
    params?: Record<string, any>
  }
}

/**
 * Pipe 节点配置
 */
export interface PipeNodeConfig {
  pipeName?: string
  dataType: WorkflowDataType
  bufferSize?: number
  routingRules?: Array<{
    condition: string
    targetPipe: string
  }>
  mergeStrategy?: 'concat' | 'override' | 'interleave'
}

/**
 * Switch 节点配置
 */
export interface SwitchNodeConfig {
  conditionType: 'value' | 'exists' | 'count' | 'custom'
  condition?: string
  defaultBranch?: 'true' | 'false' | 'none'
  cases?: Array<{
    value: string
    label: string
  }>
}

/**
 * Loop 节点配置
 */
export interface LoopNodeConfig {
  loopType: 'index' | 'list' | 'condition'
  indexRange?: {
    start: number
    end: number
    step?: number
  }
  condition?: string
  maxIterations?: number
  allowBreak?: boolean
  iterationDelay?: number
}

// ==================== 节点定义接口 ====================

/**
 * Legacy 节点定义接口（兼容旧系统）
 */
export interface LegacyNodeDefinition {
  type: WorkflowNodeType
  label: string
  icon: string
  category: 'input' | 'ai' | 'image' | 'video' | 'flow' | 'output' | 'external' | 'custom' | 'text' | 'fashion'
  description: string
  defaultInputs: NodeHandle[]
  defaultOutputs: NodeHandle[]
  defaultConfig: Record<string, any>
  defaultParams?: Record<string, any>
  backendType?: string
}

// 向后兼容别名
export type NodeDefinition = LegacyNodeDefinition

// ==================== 类型守卫 ====================

/**
 * 检查字符串是否为有效的 WorkflowNodeType
 */
export function isWorkflowNodeType(value: string): value is WorkflowNodeType {
  return Object.values(WorkflowNodeType).includes(value as WorkflowNodeType)
}
