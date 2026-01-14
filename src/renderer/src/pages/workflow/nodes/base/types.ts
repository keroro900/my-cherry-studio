/**
 * 节点模块化类型定义
 *
 * 定义节点的基础接口和类型，支持类似 ComfyUI 的模块化架构
 */

import type { Model } from '@renderer/types'

import type { NodeExecutor } from '../../types'

// 从核心类型重导出执行相关类型
export type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '../../types/core'

/**
 * 节点端口数据类型
 */
export type PortDataType = 'image' | 'images' | 'video' | 'text' | 'json' | 'any' | 'boolean' | 'number'

/**
 * 节点端口定义
 */
/**
 * 端口定义 (NodePort 的别名)
 */
export type PortDefinition = NodePort

export interface NodePort {
  id: string
  label: string
  dataType: PortDataType
  required?: boolean
  multiple?: boolean // 是否允许多个连接
  description?: string
}

/**
 * 节点分类
 */
export type NodeCategory =
  | 'input'
  | 'ai'
  | 'image'
  | 'video'
  | 'flow'
  | 'output'
  | 'external'
  | 'custom'
  | 'text'
  | 'quality'

/**
 * 节点元数据
 */
export interface NodeMetadata {
  type: string // 唯一标识符，如 'vision_prompt'
  label: string // 显示名称
  icon: string // 图标（emoji 或图标名）
  category: NodeCategory
  version: string
  author?: string
  description?: string
  tags?: string[]
}

/**
 * 节点配置 Schema
 * 用于生成配置表单
 */
export interface NodeConfigField {
  key: string
  label: string
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'select'
    | 'checkbox'
    | 'color'
    | 'code'
    | 'model-selector'
    | 'image-upload'
    | 'folder-selector'
    | 'preset-selector'
    | 'constraint-prompt'
    | 'image-input-ports'
  required?: boolean
  default?: any
  options?: Array<{ label: string; value: any }>
  multiple?: boolean
  placeholder?: string
  description?: string
  min?: number
  max?: number
  step?: number
  // 模型选择器过滤类型
  // 'image-generation' - 只显示图片生成模型（如 Gemini Imagen）
  // 'video-generation' - 只显示视频生成模型（如 Sora, Veo, Kling）
  modelFilter?: 'image-generation' | 'video-generation'
  // 条件显示
  showWhen?: {
    field: string
    value: any
  }
}

/**
 * 节点配置 Schema
 */
export interface NodeConfigSchema {
  fields: NodeConfigField[]
}

/**
 * 配置表单分组定义
 */
export interface ConfigSection {
  /** 分组唯一标识 */
  id: string
  /** 分组标题 */
  title: string
  /** 是否默认折叠 */
  collapsed?: boolean
  /** 分组内的字段 key 列表 */
  fields: string[]
  /** 分组图标 */
  icon?: string
  /** 分组说明 */
  description?: string
}

/**
 * 节点配置 UI 设置
 *
 * 用于控制 ConfigPanel 如何渲染节点配置表单
 */
export interface NodeConfigUI {
  /**
   * 自定义配置表单组件名称
   * 对应 ConfigFormRegistry 中注册的组件
   * 例如: 'PatternConfigForm', 'EcomConfigForm'
   */
  customFormComponent?: string

  /**
   * 配置表单分组
   * 用于将 configSchema.fields 组织成逻辑分组
   */
  sections?: ConfigSection[]

  /**
   * 是否隐藏模型选择器
   * 某些节点（如流程控制节点）不需要模型选择
   */
  hideModelSelector?: boolean

  /**
   * 是否显示提示词编辑器按钮
   * AI 节点通常需要此功能
   */
  showPromptEditor?: boolean

  /**
   * 配置表单布局
   * - 'default': 默认垂直布局
   * - 'compact': 紧凑布局，适合简单节点
   * - 'tabs': 选项卡布局，适合复杂节点
   */
  layout?: 'default' | 'compact' | 'tabs'
}

/**
 * 提示词预设
 */
export interface PromptPreset {
  id: string
  name: string
  description?: string
  prompt: string
  tags?: string[]
}

/**
 * 提示词步骤定义（用于多步骤节点）
 */
export interface PromptStepDefinition {
  /** 步骤唯一标识 */
  id: string
  /** 步骤显示名称 */
  label: string
  /** 默认系统提示词 */
  defaultPrompt: string
  /** 步骤描述说明 */
  description?: string
}

/**
 * 节点提示词配置
 */
export interface NodePromptConfig {
  // 系统提示词（核心指令）- 单步骤节点使用
  systemPrompt?: string
  // 约束提示词模板（用户可自定义）
  constraintPromptTemplate?: string
  // 风格预设
  stylePresets?: PromptPreset[]
  // 场景预设
  scenePresets?: PromptPreset[]
  // 多步骤提示词定义（多步骤节点使用）
  steps?: PromptStepDefinition[]
}

/**
 * 完整的节点定义
 */
export interface NodeDefinition {
  // 元数据
  metadata: NodeMetadata

  // 端口定义
  inputs: NodePort[]
  outputs: NodePort[]

  // 配置 Schema
  configSchema: NodeConfigSchema

  // 配置 UI 设置（可选）
  // 用于指定自定义配置表单组件或布局
  configUI?: NodeConfigUI

  // 提示词配置（AI 节点）
  prompts?: NodePromptConfig

  // 默认配置
  defaultConfig?: Record<string, any>

  // 执行器
  executor: NodeExecutor
}

/**
 * 节点注册表项
 */
export interface NodeRegistryEntry {
  definition: NodeDefinition
  // 加载时间
  loadedAt: number
  // 来源（内置/自定义）
  source: 'builtin' | 'custom'
  // 文件路径（自定义节点）
  filePath?: string
}

/**
 * AI 节点通用配置
 */
export interface AINodeConfig {
  providerId?: string
  modelId?: string
  model?: Model
  temperature?: number
  maxTokens?: number
  // 约束提示词
  constraintPrompt?: string
}

/**
 * 图片生成节点配置
 */
export interface ImageGenerateNodeConfig extends AINodeConfig {
  prompt?: string
  negativePrompt?: string
  aspectRatio?: string
  imageSize?: string
  // 预设
  ageGroup?: 'small_kid' | 'big_kid' | 'adult'
  gender?: 'male' | 'female'
  scenePreset?: string
  stylePreset?: string
}

/**
 * 视觉提示词节点配置
 */
export interface VisionPromptNodeConfig extends AINodeConfig {
  styleMode?: string
  ageGroup?: 'small_kid' | 'big_kid' | 'adult'
  gender?: 'male' | 'female'
  scenePreset?: string
  ethnicityPreset?: string
}

/**
 * 图片输入节点配置
 */
export interface ImageInputNodeConfig {
  inputMode?: 'upload' | 'folder' | 'url'
  uploadedImages?: Array<{ name?: string; path: string; baseName?: string; size?: number }>
  folderPaths?: Array<{
    id?: string
    path: string
    label?: string
    imageCount?: number
    status?: 'pending' | 'valid' | 'invalid' | 'loading'
    errorMessage?: string
    images?: Array<{ path: string; name: string; baseName?: string; size?: number }>
  }>
  imageUrls?: string
  fileFilter?: string
  sortBy?: 'name' | 'natural' | 'modified' | 'size'
  sortOrder?: 'asc' | 'desc'
  maxImages?: number
  outputPorts?: number
  maxPaths?: number
  matchMode?: string
}

/**
 * 输出节点配置
 */
export interface OutputNodeConfig {
  outputType?: 'display' | 'file' | 'download' | 'both'
  outputDirectory?: string
  fileNamePattern?: string
  batchFolderMode?: boolean
  batchFolderPattern?: string
}
