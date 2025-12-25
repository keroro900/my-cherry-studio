/**
 * Paintings 模块统一类型定义
 *
 * 设计原则：
 * 1. 统一的 PaintingRecord 类型，支持所有提供商
 * 2. 配置驱动的参数定义
 * 3. 完整的类型安全
 */

import type { FileMetadata } from '@renderer/types'

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 绘画记录状态
 */
export type PaintingStatus = 'pending' | 'generating' | 'success' | 'failed' | 'cancelled'

/**
 * 生成模式
 */
export type GenerationMode = 'generate' | 'edit' | 'remix' | 'upscale' | 'inpaint'

/**
 * 支持的提供商 ID
 */
export type PaintingProviderId =
  | 'zhipu'
  | 'siliconflow'
  | 'dmxapi'
  | 'tokenflux'
  | 'aihubmix'
  | 'openai'
  | 'ovms'
  | 'gemini'
  | 'flux'
  | 'stability'
  | 'midjourney'
  | string // 支持自定义提供商

// ============================================================================
// 统一的绘画记录类型
// ============================================================================

/**
 * 统一的绘画记录
 * 所有提供商的绘画都使用这个类型
 */
export interface PaintingRecord {
  // === 基础标识 ===
  id: string
  providerId: string
  modelId: string

  // === 提示词 ===
  prompt: string
  negativePrompt?: string

  // === 生成参数 ===
  config: PaintingConfig

  // === 结果 ===
  files: FileMetadata[]
  urls?: string[]

  // === 状态 ===
  status: PaintingStatus
  error?: string
  progress?: {
    current: number
    total: number
    message?: string
  }

  // === 元数据 ===
  mode: GenerationMode
  createdAt: number
  completedAt?: number
  duration?: number

  // === 参考图片（图生图/编辑/混合）===
  referenceImages?: string[]
  mask?: string // Base64 蒙版（用于 inpaint）

  // === 扩展字段（用于特定提供商的额外数据）===
  metadata?: Record<string, any>
}

/**
 * 绘画配置参数
 * 统一所有模型的配置参数
 */
export interface PaintingConfig {
  // === 尺寸参数 ===
  size?: string // "1024x1024"
  aspectRatio?: string // "16:9"
  width?: number
  height?: number

  // === 数量参数 ===
  n?: number // 生成数量

  // === 质量参数 ===
  quality?: string // "standard" | "hd"

  // === 高级参数 ===
  seed?: number
  steps?: number
  guidanceScale?: number
  promptStrength?: number

  // === 风格参数 ===
  style?: string
  styleType?: string
  stylePreset?: string

  // === 安全参数 ===
  moderation?: string
  safetyTolerance?: number
  personGeneration?: string

  // === 输出参数 ===
  outputFormat?: 'png' | 'jpg' | 'webp'
  outputQuality?: number
  responseFormat?: 'url' | 'b64_json'

  // === 开关选项 ===
  promptEnhance?: boolean
  goFast?: boolean

  // === Midjourney 特有 ===
  stylize?: number
  chaos?: number
  weird?: number

  // === 扩展参数 ===
  [key: string]: any
}

// ============================================================================
// 生成任务类型
// ============================================================================

/**
 * 生成任务状态
 */
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * 生成任务
 */
export interface GenerationTask {
  id: string
  params: GenerationParams
  status: TaskStatus
  progress?: {
    current: number
    total: number
    message?: string
  }
  result?: PaintingRecord
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

/**
 * 生成参数
 */
export interface GenerationParams {
  providerId: string
  modelId: string
  prompt: string
  negativePrompt?: string
  config: PaintingConfig
  mode: GenerationMode
  referenceImages?: string[]
  mask?: string
}

// ============================================================================
// 提示词相关类型
// ============================================================================

/**
 * 提示词模板分类
 */
export type PromptTemplateCategory = 'style' | 'subject' | 'lighting' | 'composition' | 'quality' | 'custom'

/**
 * 提示词模板
 */
export interface PromptTemplate {
  id: string
  name: string
  category: PromptTemplateCategory
  prompt: string
  negativePrompt?: string
  tags: string[]
  isBuiltIn?: boolean
  createdAt?: number
}

/**
 * 提示词历史记录
 */
export interface PromptHistoryItem {
  id: string
  prompt: string
  negativePrompt?: string
  modelId: string
  providerId: string
  timestamp: number
  resultCount: number
  favorite: boolean
}

// ============================================================================
// Store 状态类型
// ============================================================================

/**
 * 统一的 Paintings Store 状态
 */
export interface UnifiedPaintingsState {
  // === 绘画记录（统一存储）===
  paintings: PaintingRecord[]

  // === 当前会话状态 ===
  currentSession: {
    providerId: string
    modelId: string
    prompt: string
    negativePrompt: string
    config: PaintingConfig
    mode: GenerationMode
    referenceImages: string[]
  }

  // === 生成队列 ===
  queue: GenerationTask[]

  // === 提示词历史 ===
  promptHistory: PromptHistoryItem[]

  // === 提示词模板 ===
  promptTemplates: PromptTemplate[]

  // === UI 状态 ===
  ui: {
    isGenerating: boolean
    currentTaskId: string | null
    selectedPaintingId: string | null
    viewMode: 'grid' | 'single' | 'compare'
    sidebarCollapsed: boolean
    historyPanelCollapsed: boolean
  }

  // === 旧数据兼容（迁移期间保留）===
  legacy?: {
    siliconflow_paintings: any[]
    dmxapi_paintings: any[]
    tokenflux_paintings: any[]
    zhipu_paintings: any[]
    aihubmix_image_generate: any[]
    aihubmix_image_remix: any[]
    aihubmix_image_edit: any[]
    aihubmix_image_upscale: any[]
    openai_image_generate: any[]
    openai_image_edit: any[]
    ovms_paintings: any[]
  }
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 创建绘画记录的参数
 */
export type CreatePaintingParams = Omit<PaintingRecord, 'id' | 'createdAt' | 'status'> & {
  id?: string
  status?: PaintingStatus
}

/**
 * 更新绘画记录的参数
 */
export type UpdatePaintingParams = Partial<PaintingRecord> & {
  id: string
}

/**
 * 绘画记录过滤条件
 */
export interface PaintingFilter {
  providerId?: string
  modelId?: string
  status?: PaintingStatus
  mode?: GenerationMode
  startDate?: number
  endDate?: number
  searchText?: string
}

/**
 * 绘画记录排序选项
 */
export interface PaintingSort {
  field: 'createdAt' | 'completedAt' | 'prompt'
  order: 'asc' | 'desc'
}
