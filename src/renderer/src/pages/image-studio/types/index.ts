/**
 * Image Studio 类型定义
 */

// ============================================================================
// 模块类型
// ============================================================================

export type StudioModule = 'ecom' | 'model' | 'pattern'

// ============================================================================
// 项目和版本
// ============================================================================

export interface ImageProject {
  id: string
  name: string
  module: StudioModule
  createdAt: number
  updatedAt: number

  // 版本列表
  versions: ImageVersion[]
  currentVersionId: string | null

  // 原始输入（用于重新生成）
  originalInputs: {
    images: string[]
    config: Record<string, any>
    prompt?: string
  }
}

export interface ImageVersion {
  id: string
  projectId: string
  versionNumber: number
  parentVersionId: string | null

  // 生成输出
  outputs: ImageOutputs

  // 生成配置
  config: Record<string, any>
  prompt?: string

  // 局部编辑
  mask?: string // base64 蒙版
  editRegion?: { x: number; y: number; width: number; height: number }

  createdAt: number
  status: 'pending' | 'generating' | 'success' | 'error'
  error?: string
}

export interface ImageOutputs {
  // 通用
  image?: string
  images?: string[]

  // 电商模块
  mainImage?: string
  backImage?: string
  detailImages?: string[]

  // 模特换装
  modelImage?: string

  // 图案设计
  patternImage?: string
  graphicImage?: string
}

// ============================================================================
// 任务队列
// ============================================================================

export type TaskType = 'generate' | 'regenerate' | 'local_edit'
export type TaskStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface ImageTask {
  id: string
  projectId: string
  versionId: string
  type: TaskType

  status: TaskStatus
  progress: TaskProgress

  createdAt: number
  startedAt?: number
  completedAt?: number
  error?: string
}

export interface TaskProgress {
  current: number
  total: number
  step: string
}

// ============================================================================
// 模块配置
// ============================================================================

export interface EcomModuleConfig {
  // 布局
  layout: 'flat_lay' | 'model_shot' | 'hanging' | 'none'
  fillMode: 'filled' | 'flat' | 'none'

  // 风格
  stylePreset: 'auto' | 'shein' | 'temu' | 'minimal' | 'premium'

  // 图片设置
  imageSize: '1K' | '2K' | '4K'
  aspectRatio: string

  // 输出选项
  enableBack: boolean
  enableDetail: boolean
  detailTypes: string[]

  // 服装描述
  garmentDescription?: string

  // 高级选项
  useSystemPrompt?: boolean
  professionalRetouch?: boolean
}

export interface ModelModuleConfig {
  // 模特设置
  ageGroup: 'small_kid' | 'big_kid' | 'adult'
  gender: 'female' | 'male'
  ethnicityPreset?: string

  // 场景和姿态
  scenePreset: string
  poseStyle: string
  styleMode?: 'daily' | 'commercial'

  // 图片设置
  imageSize: '1K' | '2K' | '4K'
  aspectRatio: string
}

export interface PatternModuleConfig {
  // 生成模式
  generationMode: 'mode_a' | 'mode_b' | 'mode_c'

  // 输出类型
  outputType: 'pattern_only' | 'set'

  // 图案设置
  patternType: string
  density: 'sparse' | 'medium' | 'dense'
  colorTone: 'auto' | 'bright' | 'soft' | 'dark' | 'high_contrast'

  // 风格预设
  stylePresetId?: string
  stylePresetPrompt?: string

  // 图片设置
  imageSize: '1K' | '2K' | '4K'
  aspectRatio: string

  // 批量
  batchSize: number
}

// ============================================================================
// 生成相关
// ============================================================================

export interface GenerateInputs {
  images: string[]
  promptJson?: Record<string, any>
  additionalPrompt?: string
}

export interface EcomInputs extends GenerateInputs {
  topImage?: string
  bottomImage?: string
  extraRef?: string
  topBackImage?: string
  bottomBackImage?: string
}

export interface ModelInputs extends GenerateInputs {
  clothesImage?: string
}

export interface PatternInputs extends GenerateInputs {
  reference1?: string
  reference2?: string
  reference3?: string
  prompt?: string
}

export interface GenerateResult {
  success: boolean
  outputs: ImageOutputs
  error?: string
}

export interface GenerateOptions {
  abortSignal?: AbortSignal
  onProgress?: (progress: TaskProgress) => void
  onLog?: (message: string, data?: any) => void
}

// ============================================================================
// 状态
// ============================================================================

export interface ImageStudioState {
  // 当前模块
  activeModule: StudioModule

  // 项目管理
  projects: ImageProject[]
  currentProjectId: string | null

  // 任务队列
  taskQueue: ImageTask[]
  isPaused: boolean
  maxConcurrency: number

  // 模块配置（切换时保持）
  ecomConfig: EcomModuleConfig
  modelConfig: ModelModuleConfig
  patternConfig: PatternModuleConfig

  // Provider
  providerId: string
  modelId: string

  // UI 状态
  showLocalEditor: boolean
  selectedImageId: string | null
  localEditorBaseImage: string | null
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_ECOM_CONFIG: EcomModuleConfig = {
  layout: 'model_shot',
  fillMode: 'filled',
  stylePreset: 'auto',
  imageSize: '2K',
  aspectRatio: '3:4',
  enableBack: false,
  enableDetail: false,
  detailTypes: [],
  useSystemPrompt: true,
  professionalRetouch: true
}

export const DEFAULT_MODEL_CONFIG: ModelModuleConfig = {
  ageGroup: 'adult',
  gender: 'female',
  scenePreset: 'indoor',
  poseStyle: 'natural',
  imageSize: '2K',
  aspectRatio: '3:4'
}

export const DEFAULT_PATTERN_CONFIG: PatternModuleConfig = {
  generationMode: 'mode_a',
  outputType: 'set',
  patternType: 'seamless',
  density: 'medium',
  colorTone: 'auto',
  imageSize: '2K',
  aspectRatio: '1:1',
  batchSize: 1
}
