/**
 * 智能任务分解类型定义
 * Smart Task Decomposition Type Definitions
 *
 * 用于将复杂任务自动拆分为可执行的子任务
 */

import type { StudioModule } from './index'

// ============================================================================
// 分解场景
// ============================================================================

/**
 * 分解场景类型
 */
export type DecompositionScenario =
  | 'ecom_complete_set' // 电商套图（主图+背面+细节）
  | 'multi_angle' // 多角度展示
  | 'color_variants' // 颜色变体
  | 'size_variants' // 尺寸变体
  | 'pattern_application' // 图案应用（图案+贴图效果）
  | 'model_poses' // 模特多姿态
  | 'scene_variants' // 场景变体
  | 'batch_products' // 批量产品
  | 'custom' // 自定义分解

/**
 * 分解场景元数据
 */
export interface DecompositionScenarioMeta {
  id: DecompositionScenario
  label: string
  labelEn: string
  icon: string
  description: string
  supportedModules: StudioModule[]
  defaultSubtasks: SubTaskTemplate[]
}

/**
 * 子任务模板
 */
export interface SubTaskTemplate {
  /** 模板 ID */
  templateId: string

  /** 子任务名称 */
  name: string

  /** 描述 */
  description: string

  /** 顺序 */
  order: number

  /** 配置修改器 */
  configModifier: Record<string, unknown>

  /** 提示词修改器 */
  promptModifier?: string

  /** 是否可选 */
  optional: boolean
}

/**
 * 分解场景映射表
 */
export const DECOMPOSITION_SCENARIOS: Record<DecompositionScenario, DecompositionScenarioMeta> = {
  ecom_complete_set: {
    id: 'ecom_complete_set',
    label: '电商套图',
    labelEn: 'E-commerce Complete Set',
    icon: '📸',
    description: '生成主图、背面图、细节图的完整电商套图',
    supportedModules: ['ecom'],
    defaultSubtasks: [
      {
        templateId: 'main_front',
        name: '主图（正面）',
        description: '产品正面主图',
        order: 1,
        configModifier: { layout: 'flat_lay' },
        optional: false
      },
      {
        templateId: 'main_back',
        name: '背面图',
        description: '产品背面展示',
        order: 2,
        configModifier: { layout: 'flat_lay', enableBack: true },
        optional: true
      },
      {
        templateId: 'detail_collar',
        name: '细节图-领口',
        description: '领口细节特写',
        order: 3,
        configModifier: { enableDetail: true, detailTypes: ['collar'] },
        promptModifier: 'Focus on collar detail, close-up shot',
        optional: true
      },
      {
        templateId: 'detail_sleeve',
        name: '细节图-袖口',
        description: '袖口细节特写',
        order: 4,
        configModifier: { enableDetail: true, detailTypes: ['sleeve'] },
        promptModifier: 'Focus on sleeve detail, close-up shot',
        optional: true
      }
    ]
  },
  multi_angle: {
    id: 'multi_angle',
    label: '多角度展示',
    labelEn: 'Multi-Angle Views',
    icon: '🔄',
    description: '从多个角度展示产品',
    supportedModules: ['ecom', 'model'],
    defaultSubtasks: [
      {
        templateId: 'angle_front',
        name: '正面',
        description: '正面视角',
        order: 1,
        configModifier: {},
        promptModifier: 'Front view, facing camera directly',
        optional: false
      },
      {
        templateId: 'angle_side',
        name: '侧面',
        description: '侧面视角',
        order: 2,
        configModifier: {},
        promptModifier: 'Side view, 90 degree angle',
        optional: false
      },
      {
        templateId: 'angle_back',
        name: '背面',
        description: '背面视角',
        order: 3,
        configModifier: {},
        promptModifier: 'Back view, showing rear details',
        optional: false
      },
      {
        templateId: 'angle_45',
        name: '45度角',
        description: '45度斜角视角',
        order: 4,
        configModifier: {},
        promptModifier: '45 degree angle view, dynamic perspective',
        optional: true
      }
    ]
  },
  color_variants: {
    id: 'color_variants',
    label: '颜色变体',
    labelEn: 'Color Variants',
    icon: '🎨',
    description: '同款产品不同颜色的变体',
    supportedModules: ['ecom', 'pattern'],
    defaultSubtasks: [] // 动态生成
  },
  size_variants: {
    id: 'size_variants',
    label: '尺寸变体',
    labelEn: 'Size Variants',
    icon: '📐',
    description: '不同尺寸/比例的输出',
    supportedModules: ['ecom', 'model', 'pattern'],
    defaultSubtasks: [
      {
        templateId: 'size_1x1',
        name: '1:1 方形',
        description: '1:1 正方形输出',
        order: 1,
        configModifier: { aspectRatio: '1:1' },
        optional: false
      },
      {
        templateId: 'size_3x4',
        name: '3:4 竖版',
        description: '3:4 竖版输出',
        order: 2,
        configModifier: { aspectRatio: '3:4' },
        optional: false
      },
      {
        templateId: 'size_16x9',
        name: '16:9 横版',
        description: '16:9 横版输出',
        order: 3,
        configModifier: { aspectRatio: '16:9' },
        optional: true
      }
    ]
  },
  pattern_application: {
    id: 'pattern_application',
    label: '图案应用',
    labelEn: 'Pattern Application',
    icon: '👕',
    description: '生成图案并应用到服装效果图',
    supportedModules: ['pattern'],
    defaultSubtasks: [
      {
        templateId: 'pattern_seamless',
        name: '无缝图案',
        description: '生成无缝贴图图案',
        order: 1,
        configModifier: { outputType: 'pattern_only' },
        optional: false
      },
      {
        templateId: 'pattern_tshirt',
        name: 'T恤贴图',
        description: '图案应用到T恤效果',
        order: 2,
        configModifier: { outputType: 'set' },
        promptModifier: 'Apply pattern to t-shirt mockup',
        optional: true
      },
      {
        templateId: 'pattern_dress',
        name: '连衣裙贴图',
        description: '图案应用到连衣裙效果',
        order: 3,
        configModifier: { outputType: 'set' },
        promptModifier: 'Apply pattern to dress mockup',
        optional: true
      }
    ]
  },
  model_poses: {
    id: 'model_poses',
    label: '模特多姿态',
    labelEn: 'Model Poses',
    icon: '🧍',
    description: '同一模特不同姿态的展示',
    supportedModules: ['model'],
    defaultSubtasks: [
      {
        templateId: 'pose_standing',
        name: '站姿',
        description: '自然站立姿态',
        order: 1,
        configModifier: { poseStyle: 'natural' },
        optional: false
      },
      {
        templateId: 'pose_sitting',
        name: '坐姿',
        description: '坐姿展示',
        order: 2,
        configModifier: { poseStyle: 'sitting' },
        optional: true
      },
      {
        templateId: 'pose_walking',
        name: '走动',
        description: '走动姿态',
        order: 3,
        configModifier: { poseStyle: 'walking' },
        optional: true
      }
    ]
  },
  scene_variants: {
    id: 'scene_variants',
    label: '场景变体',
    labelEn: 'Scene Variants',
    icon: '🏞️',
    description: '同一产品在不同场景中展示',
    supportedModules: ['model', 'ecom'],
    defaultSubtasks: [
      {
        templateId: 'scene_studio',
        name: '影棚',
        description: '专业影棚背景',
        order: 1,
        configModifier: { scenePreset: 'studio' },
        optional: false
      },
      {
        templateId: 'scene_outdoor',
        name: '户外',
        description: '户外自然场景',
        order: 2,
        configModifier: { scenePreset: 'outdoor' },
        optional: true
      },
      {
        templateId: 'scene_home',
        name: '室内',
        description: '居家室内场景',
        order: 3,
        configModifier: { scenePreset: 'home' },
        optional: true
      }
    ]
  },
  batch_products: {
    id: 'batch_products',
    label: '批量产品',
    labelEn: 'Batch Products',
    icon: '📦',
    description: '多个产品使用相同配置批量生成',
    supportedModules: ['ecom', 'model'],
    defaultSubtasks: [] // 根据输入图片动态生成
  },
  custom: {
    id: 'custom',
    label: '自定义分解',
    labelEn: 'Custom Decomposition',
    icon: '⚙️',
    description: '用户自定义的任务分解',
    supportedModules: ['ecom', 'model', 'pattern'],
    defaultSubtasks: []
  }
}

// ============================================================================
// 组合任务
// ============================================================================

/**
 * 组合任务状态
 */
export type CompositeTaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

/**
 * 子任务
 */
export interface SubTask {
  /** 子任务 ID */
  id: string

  /** 子任务名称 */
  name: string

  /** 描述 */
  description?: string

  /** 执行顺序 */
  order: number

  /** 所属组合任务 ID */
  compositeTaskId: string

  /** 依赖的子任务 ID 列表 */
  dependsOn: string[]

  /** 模块配置 */
  config: Record<string, unknown>

  /** 输入图片 */
  inputImages: string[]

  /** 附加提示词 */
  additionalPrompt?: string

  /** 状态 */
  status: CompositeTaskStatus

  /** 输出结果 */
  outputs?: string[]

  /** 错误信息 */
  error?: string

  /** 开始时间 */
  startedAt?: number

  /** 完成时间 */
  completedAt?: number

  /** 重试次数 */
  retryCount: number
}

/**
 * 组合任务
 */
export interface CompositeTask {
  /** 组合任务 ID */
  id: string

  /** 任务名称 */
  name: string

  /** 任务描述 */
  description?: string

  /** 所属模块 */
  module: StudioModule

  /** 分解场景 */
  scenario: DecompositionScenario

  /** 子任务列表 */
  subtasks: SubTask[]

  /** 整体状态 */
  status: CompositeTaskStatus

  /** 进度 */
  progress: {
    completed: number
    total: number
    failed: number
  }

  /** 创建时间 */
  createdAt: number

  /** 开始时间 */
  startedAt?: number

  /** 完成时间 */
  completedAt?: number

  /** 最终合并输出 */
  mergedOutputs?: Record<string, string[]>

  /** 优先级 (1-10, 越大越优先) */
  priority: number
}

// ============================================================================
// 任务分解请求
// ============================================================================

/**
 * 任务分解请求参数
 */
export interface DecompositionRequest {
  /** 用户输入描述 */
  userDescription: string

  /** 目标模块 */
  module: StudioModule

  /** 输入图片 */
  inputImages: string[]

  /** 基础配置 */
  baseConfig: Record<string, unknown>

  /** 指定分解场景（可选，不指定则自动推断） */
  scenario?: DecompositionScenario

  /** 自定义子任务模板（用于自定义场景） */
  customSubtasks?: SubTaskTemplate[]
}

/**
 * 任务分解结果
 */
export interface DecompositionResult {
  /** 是否成功 */
  success: boolean

  /** 推断的分解场景 */
  inferredScenario?: DecompositionScenario

  /** 推断置信度 */
  confidence?: number

  /** 生成的组合任务 */
  compositeTask?: CompositeTask

  /** 错误信息 */
  error?: string

  /** 建议（如有多个可选场景） */
  suggestions?: Array<{
    scenario: DecompositionScenario
    reason: string
  }>
}

/**
 * 分解进度
 */
export interface DecompositionProgress {
  step: 'analyzing' | 'planning' | 'creating' | 'done'
  stepDescription: string
  percentage: number
}

// ============================================================================
// 任务执行
// ============================================================================

/**
 * 组合任务执行选项
 */
export interface CompositeTaskExecutionOptions {
  /** 是否并行执行（忽略依赖） */
  parallel: boolean

  /** 最大并发数 */
  maxConcurrency: number

  /** 失败时是否继续 */
  continueOnFailure: boolean

  /** 自动重试次数 */
  autoRetryCount: number

  /** 是否合并输出 */
  mergeOutputs: boolean
}

/**
 * 默认执行选项
 */
export const DEFAULT_EXECUTION_OPTIONS: CompositeTaskExecutionOptions = {
  parallel: false,
  maxConcurrency: 2,
  continueOnFailure: true,
  autoRetryCount: 1,
  mergeOutputs: true
}

/**
 * 执行事件类型
 */
export type CompositeTaskEvent =
  | { type: 'task_started'; compositeTaskId: string }
  | { type: 'subtask_started'; compositeTaskId: string; subtaskId: string }
  | { type: 'subtask_completed'; compositeTaskId: string; subtaskId: string; outputs: string[] }
  | { type: 'subtask_failed'; compositeTaskId: string; subtaskId: string; error: string }
  | { type: 'task_completed'; compositeTaskId: string; mergedOutputs: Record<string, string[]> }
  | { type: 'task_failed'; compositeTaskId: string; error: string }
  | { type: 'task_paused'; compositeTaskId: string }
  | { type: 'task_resumed'; compositeTaskId: string }

/**
 * 执行事件监听器
 */
export type CompositeTaskEventListener = (event: CompositeTaskEvent) => void

// ============================================================================
// 任务分解状态
// ============================================================================

/**
 * 任务分解系统状态
 */
export interface TaskDecompositionState {
  /** 组合任务列表 */
  compositeTasks: CompositeTask[]

  /** 当前正在分解中 */
  isDecomposing: boolean

  /** 分解进度 */
  decompositionProgress?: DecompositionProgress

  /** 当前选中的组合任务 */
  selectedCompositeTaskId?: string

  /** 错误信息 */
  error?: string
}

/**
 * 任务分解默认状态
 */
export const DEFAULT_TASK_DECOMPOSITION_STATE: TaskDecompositionState = {
  compositeTasks: [],
  isDecomposing: false
}

// ============================================================================
// 分解规则（用于服务层）
// ============================================================================

/**
 * 分解规则
 */
export interface DecompositionRule {
  /** 规则 ID */
  id: string

  /** 规则名称 */
  name: string

  /** 规则描述 */
  description: string

  /** 适用模块 */
  module: StudioModule

  /** 触发条件 */

  triggerCondition: (config: any) => boolean

  /** 分解函数 */

  decompose: (config: any) => Array<{
    name: string
    order: number

    config: any
    description?: string
    inputImages?: string[]
    dependsOn?: string[]
  }>
}

/**
 * 分解模板
 */
export interface DecompositionTemplate {
  /** 模板 ID */
  id: string

  /** 模板名称 */
  name: string

  /** 模板描述 */
  description: string

  /** 适用模块 */
  module: StudioModule

  /** 子任务配置列表 */
  subtaskConfigs: Array<{
    name: string
    configOverrides: Record<string, unknown>
  }>
}
