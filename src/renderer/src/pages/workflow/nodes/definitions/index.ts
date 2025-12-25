/**
 * 节点定义注册表
 *
 * 从 types/index.ts 迁移，集中管理所有节点的定义
 * 包括：类型、端口、默认配置等
 *
 * @deprecated 此文件中的 NODE_REGISTRY 已废弃，请使用 NodeRegistry 或 NodeRegistryAdapter。
 * WorkflowNodeType 枚举仍然有效，可继续使用。
 *
 * 迁移指南：
 * - 获取节点定义：使用 NodeRegistryAdapter.getNodeDefinition(type)
 * - 获取分类节点：使用 NodeRegistryAdapter.getNodesByCategory(category)
 * - 注册新节点：使用 NodeRegistry.register(nodeDefinition, 'builtin')
 *
 * @see NodeRegistry - 现代节点注册系统
 * @see NodeRegistryAdapter - 兼容性适配器
 */

import type { Model } from '@renderer/types'

// ==================== 数据类型定义 ====================

/**
 * 工作流中传递的数据类型
 *
 * 基础类型：
 * - text: 文本字符串
 * - image: 单张图片（base64 或 URL）
 * - images: 多张图片数组
 * - video: 视频（URL 或 base64）
 * - json: JSON 对象
 * - any: 任意类型（可连接任何其他类型）
 *
 * 扩展类型：
 * - boolean: 布尔值（用于条件判断）
 * - number: 数字（用于计数、索引等）
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

  // 图片操作
  COMPARE_IMAGE = 'compare_image',

  // 视频
  KLING_IMAGE2VIDEO = 'kling_image2video',
  UNIFIED_VIDEO_GENERATION = 'unified_video_generation',

  // 外部服务
  RUNNINGHUB_APP = 'runninghub_app',
  HTTP_REQUEST = 'http_request',

  // 流程控制
  CONDITION = 'condition',
  CODE_EXECUTOR = 'code_executor',
  JSON_TRANSFORM = 'json_transform',
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

export interface VisionPromptConfig {
  providerId?: string
  model?: Model
  modelId?: string
  ageGroup: 'small_kid' | 'big_kid' | 'adult'
  gender: 'male' | 'female'
  scenePreset: 'home' | 'outdoor'
  ethnicityPreset?: 'caucasian' | 'african_american' | 'asian' | 'mixed'
  ipMode: 'auto' | 'force_ip' | 'no_ip'
  styleMode: 'daily' | 'commercial'
  poseConstraint?: 'standing' | 'sitting' | 'walking' | 'natural'
  expressionConstraint?: 'smiling' | 'natural' | 'happy' | 'serious' | 'gentle'
  actionConstraint?: 'static' | 'walking' | 'sitting' | 'natural'
  customConstraint?: string
}

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

// ==================== 节点定义 ====================

/**
 * 节点定义接口
 */
export interface NodeDefinition {
  type: WorkflowNodeType
  label: string
  icon: string
  category: 'input' | 'ai' | 'image' | 'video' | 'flow' | 'output' | 'external' | 'custom' | 'text'
  description: string
  defaultInputs: NodeHandle[]
  defaultOutputs: NodeHandle[]
  defaultConfig: Record<string, any>
  defaultParams?: Record<string, any>
  backendType?: string
}

// ==================== 节点注册表 ====================

/**
 * 节点定义注册表
 *
 * @deprecated 请使用 NodeRegistry 或 NodeRegistryAdapter 代替。
 * 此静态注册表将在未来版本中移除。
 *
 * 迁移示例：
 * ```typescript
 * // 旧方式
 * const def = NODE_REGISTRY[WorkflowNodeType.GEMINI_PATTERN]
 *
 * // 新方式
 * import { NodeRegistryAdapter } from '../base/NodeRegistryAdapter'
 * const def = await NodeRegistryAdapter.getNodeDefinition('gemini_pattern')
 * ```
 */
export const NODE_REGISTRY: Record<WorkflowNodeType, NodeDefinition> = {
  // ===== 输入节点 =====
  [WorkflowNodeType.IMAGE_INPUT]: {
    type: WorkflowNodeType.IMAGE_INPUT,
    label: '图片输入',
    icon: '🖼️',
    category: 'input',
    description: '文件夹路径输入，每个路径对应一个输出端口',
    defaultInputs: [],
    defaultOutputs: [{ id: 'all_images', label: '全部图片', dataType: 'images' }],
    defaultConfig: { folderPaths: [], maxPaths: 10 } as ImageInputConfig
  },

  [WorkflowNodeType.TEXT_INPUT]: {
    type: WorkflowNodeType.TEXT_INPUT,
    label: '文本输入',
    icon: '📝',
    category: 'input',
    description: '输入文本内容',
    defaultInputs: [],
    defaultOutputs: [{ id: 'text', label: '文本', dataType: 'text' }],
    defaultConfig: { multiline: true } as TextInputConfig
  },

  [WorkflowNodeType.FILE_INPUT]: {
    type: WorkflowNodeType.FILE_INPUT,
    label: '文件输入',
    icon: '📁',
    category: 'input',
    description: '支持视频、音频、文档等多种文件类型输入',
    defaultInputs: [],
    defaultOutputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    defaultConfig: { allowedTypes: ['video', 'audio', 'document'], files: [] }
  },

  // ===== AI 提示词节点 =====
  [WorkflowNodeType.UNIFIED_PROMPT]: {
    type: WorkflowNodeType.UNIFIED_PROMPT,
    label: '智能提示词',
    icon: '🧠',
    category: 'ai',
    description: '使用视觉模型分析图片生成结构化提示词（支持模特/图案/电商多种输出模式）',
    defaultInputs: [
      { id: 'image_1', label: '图一 (主服装)', dataType: 'image', required: true },
      { id: 'image_2', label: '图二 (下装)', dataType: 'image' },
      { id: 'image_3', label: '图三 (配饰)', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'promptJson', label: '提示词 JSON', dataType: 'json' }],
    defaultConfig: {
      ageGroup: 'big_kid',
      gender: 'female',
      scenePreset: 'home',
      ipMode: 'auto',
      styleMode: 'daily',
      outputMode: 'model'
    } as VisionPromptConfig
  },

  [WorkflowNodeType.VIDEO_PROMPT]: {
    type: WorkflowNodeType.VIDEO_PROMPT,
    label: '视频提示词',
    icon: '🎬',
    category: 'ai',
    description: '使用视觉模型分析图片生成视频提示词',
    defaultInputs: [
      { id: 'image_1', label: '图一 (主服装)', dataType: 'image', required: true },
      { id: 'image_2', label: '图二 (下装)', dataType: 'image' },
      { id: 'image_3', label: '图三 (配饰)', dataType: 'image' }
    ],
    defaultOutputs: [
      { id: 'videoPrompt', label: '视频提示词', dataType: 'text' },
      { id: 'promptJson', label: '提示词JSON', dataType: 'json' }
    ],
    defaultConfig: {
      ageGroup: 'big_kid',
      gender: 'female',
      scenePreset: 'home',
      ipMode: 'auto',
      styleMode: 'daily'
    } as VisionPromptConfig
  },

  // ===== 电商内容节点 =====
  [WorkflowNodeType.PRODUCT_DESCRIPTION]: {
    type: WorkflowNodeType.PRODUCT_DESCRIPTION,
    label: '产品描述生成',
    icon: '📝',
    category: 'text',
    description: 'AI生成多语言产品描述、卖点列表和SEO关键词',
    defaultInputs: [
      { id: 'productInfo', label: '产品信息', dataType: 'text', required: true },
      { id: 'features', label: '特点描述', dataType: 'text' },
      { id: 'image', label: '产品图片', dataType: 'image' }
    ],
    defaultOutputs: [
      { id: 'title', label: '产品标题', dataType: 'text' },
      { id: 'description', label: '产品描述', dataType: 'text' },
      { id: 'bullets', label: '卖点列表', dataType: 'json' },
      { id: 'seoKeywords', label: 'SEO关键词', dataType: 'json' },
      { id: 'json', label: '完整JSON', dataType: 'json' }
    ],
    defaultConfig: {
      platform: 'general',
      language: 'zh-CN',
      toneStyle: 'professional',
      outputFormat: 'full_listing',
      includeSEO: true,
      bulletCount: 5,
      maxTitleLength: 150,
      maxDescriptionLength: 2000,
      temperature: 0.7
    }
  },

  [WorkflowNodeType.PLATFORM_RESIZE]: {
    type: WorkflowNodeType.PLATFORM_RESIZE,
    label: '平台尺寸适配',
    icon: '📐',
    category: 'image',
    description: '将产品图片一键适配到各电商平台的规格尺寸',
    defaultInputs: [{ id: 'image', label: '输入图片', dataType: 'image', required: true }],
    defaultOutputs: [
      { id: 'image', label: '输出图片', dataType: 'image' },
      { id: 'images', label: '批量输出', dataType: 'images' }
    ],
    defaultConfig: {
      targetPlatform: 'amazon_main',
      scaleMode: 'fit',
      backgroundFill: 'white',
      outputFormat: 'jpg',
      quality: 90,
      maintainAspectRatio: true,
      batchMode: false
    }
  },

  [WorkflowNodeType.APLUS_CONTENT]: {
    type: WorkflowNodeType.APLUS_CONTENT,
    label: 'A+ 内容生成',
    icon: '📄',
    category: 'text',
    description: '生成亚马逊 A+ 页面图文内容，支持多种模块类型',
    defaultInputs: [
      { id: 'productInfo', label: '产品信息', dataType: 'text' },
      { id: 'image', label: '产品图片', dataType: 'image' }
    ],
    defaultOutputs: [
      { id: 'modules', label: '模块内容', dataType: 'json' },
      { id: 'pageSummary', label: '页面摘要', dataType: 'text' },
      { id: 'fullContent', label: '完整文本', dataType: 'text' },
      { id: 'rawJson', label: '原始JSON', dataType: 'json' }
    ],
    defaultConfig: {
      moduleTypes: ['standard_header', 'standard_image_text', 'standard_four_image'],
      contentStyle: 'professional',
      language: 'en-US',
      temperature: 0.7
    }
  },

  // ===== Gemini 图片处理节点 =====
  [WorkflowNodeType.GEMINI_EDIT]: {
    type: WorkflowNodeType.GEMINI_EDIT,
    label: 'Gemini 编辑',
    icon: '✂️',
    category: 'image',
    description: '使用 Gemini 编辑图片（预设模式）',
    defaultInputs: [
      { id: 'baseImage', label: '基础图片', dataType: 'image', required: true },
      { id: 'clothesImage', label: '服装图片', dataType: 'image' },
      { id: 'promptJson', label: '提示词JSON', dataType: 'json' }
    ],
    defaultOutputs: [{ id: 'editedImage', label: '编辑后图片', dataType: 'image' }],
    defaultConfig: {
      mode: 'preset',
      editMode: 'single',
      imageSize: '2K',
      aspectRatio: '3:4'
    } as ImageEditConfig
  },

  [WorkflowNodeType.GEMINI_EDIT_CUSTOM]: {
    type: WorkflowNodeType.GEMINI_EDIT_CUSTOM,
    label: 'Gemini 自定义编辑',
    icon: '🎨',
    category: 'image',
    description: '使用 Gemini 编辑图片（自定义提示词）',
    defaultInputs: [
      { id: 'baseImage', label: '基础图片', dataType: 'image', required: true },
      { id: 'customPrompt', label: '自定义提示词', dataType: 'text', required: true }
    ],
    defaultOutputs: [{ id: 'editedImage', label: '编辑后图片', dataType: 'image' }],
    defaultConfig: {
      mode: 'custom',
      imageSize: '2K',
      aspectRatio: '3:4'
    } as ImageEditConfig
  },

  [WorkflowNodeType.GEMINI_GENERATE]: {
    type: WorkflowNodeType.GEMINI_GENERATE,
    label: 'Gemini 生成',
    icon: '✨',
    category: 'image',
    description: '使用 Gemini 生成图片',
    defaultInputs: [
      { id: 'prompt', label: '提示词', dataType: 'text', required: true },
      { id: 'promptJson', label: '提示词JSON', dataType: 'json' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchSize: 1
    } as ImageGenerateConfig
  },

  [WorkflowNodeType.GEMINI_GENERATE_MODEL]: {
    type: WorkflowNodeType.GEMINI_GENERATE_MODEL,
    label: '模特生成',
    icon: '👤',
    category: 'image',
    description: '使用 Gemini 生成模特图片',
    defaultInputs: [
      { id: 'clothesImage', label: '服装图片', dataType: 'image', required: true },
      { id: 'promptJson', label: '提示词JSON', dataType: 'json' }
    ],
    defaultOutputs: [{ id: 'modelImage', label: '模特图片', dataType: 'image' }],
    defaultConfig: {
      imageSize: '2K',
      aspectRatio: '3:4'
    } as ImageGenerateConfig
  },

  [WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES]: {
    type: WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES,
    label: '衣服生成模特',
    icon: '👚',
    category: 'image',
    description: '从衣服图片生成穿着模特',
    defaultInputs: [
      { id: 'clothesImage', label: '服装图片', dataType: 'image', required: true },
      { id: 'promptJson', label: '提示词JSON', dataType: 'json' }
    ],
    defaultOutputs: [{ id: 'modelImage', label: '模特图片', dataType: 'image' }],
    defaultConfig: {
      imageSize: '2K',
      aspectRatio: '3:4'
    } as ImageGenerateConfig
  },

  [WorkflowNodeType.GEMINI_ECOM]: {
    type: WorkflowNodeType.GEMINI_ECOM,
    label: '电商实拍图',
    icon: '🛍️',
    category: 'image',
    description: 'SHEIN/TEMU 风格电商主图生成，支持 2K/4K 高清',
    defaultInputs: [
      { id: 'top_garment', label: '上装图片', dataType: 'image', required: true },
      { id: 'bottom_garment', label: '下装图片', dataType: 'image', required: true },
      { id: 'extra_refs', label: '额外参考图', dataType: 'images' }
    ],
    defaultOutputs: [
      { id: 'mainImage', label: '主图', dataType: 'image' },
      { id: 'backImage', label: '背面图', dataType: 'image' },
      { id: 'detailImages', label: '细节图', dataType: 'images' }
    ],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '3:4',
      layout: 'flat_lay',
      fillMode: 'filled',
      stylePreset: 'auto',
      styleConstraint: '',
      enableBack: false,
      enableDetail: false,
      detailTypes: ['collar', 'print', 'fabric'],
      garmentDescription: '',
      extraNote: '',
      useSystemPrompt: true,
      professionalRetouch: true,
      retryCount: 2,
      timeout: 180,
      imageInputCount: 2
    }
  },

  [WorkflowNodeType.GEMINI_PATTERN]: {
    type: WorkflowNodeType.GEMINI_PATTERN,
    label: '图案生成',
    icon: '🎨',
    category: 'image',
    description: '专业图案生成：无缝图案/T恤图案/元素派生',
    defaultInputs: [
      { id: 'reference_1', label: '参考图 1', dataType: 'image' },
      { id: 'reference_2', label: '参考图 2', dataType: 'image' },
      { id: 'reference_3', label: '参考图 3', dataType: 'image' }
    ],
    defaultOutputs: [
      { id: 'patternImage', label: '无缝图案', dataType: 'image' },
      { id: 'graphicImage', label: 'T恤大图', dataType: 'image' }
    ],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '1:1',
      generationMode: 'mode_a',
      outputType: 'pattern_only',
      patternType: 'seamless',
      imageInputCount: 1,
      stylePresetId: '',
      stylePresetName: '',
      stylePresetPrompt: '',
      customPrompt: '',
      negativePrompt: '',
      density: 'medium',
      colorTone: 'auto',
      useSystemPrompt: true,
      promptEnhancement: false,
      retryCount: 1,
      batchSize: 1
    }
  },

  // ===== 珠宝摄影节点 =====
  [WorkflowNodeType.JEWELRY_PHOTO]: {
    type: WorkflowNodeType.JEWELRY_PHOTO,
    label: '珠宝摄影',
    icon: '💎',
    category: 'image',
    description: '专业珠宝产品摄影，支持金属与宝石光线控制',
    defaultInputs: [
      { id: 'product', label: '珠宝图片', dataType: 'image', required: true },
      { id: 'reference', label: '风格参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '1:1',
      jewelryType: 'ring',
      metalType: 'gold',
      stoneType: 'diamond',
      lightingSetup: 'soft_box',
      backgroundStyle: 'white',
      imageInputCount: 1
    }
  },

  // ===== 食品摄影节点 =====
  [WorkflowNodeType.FOOD_PHOTO]: {
    type: WorkflowNodeType.FOOD_PHOTO,
    label: '食品摄影',
    icon: '🍽️',
    category: 'image',
    description: '专业食品产品摄影，支持新鲜感与动态效果控制',
    defaultInputs: [
      { id: 'product', label: '食品图片', dataType: 'image', required: true },
      { id: 'reference', label: '风格参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '1:1',
      foodCategory: 'main_dish',
      stylePreset: 'modern',
      moodPreset: 'warm',
      backgroundStyle: 'white',
      enableSteam: false,
      enableDroplets: false,
      imageInputCount: 1
    }
  },

  // ===== 产品场景节点 =====
  [WorkflowNodeType.PRODUCT_SCENE]: {
    type: WorkflowNodeType.PRODUCT_SCENE,
    label: '产品场景',
    icon: '🏞️',
    category: 'image',
    description: '将产品融入指定场景，支持光影匹配与自然融合',
    defaultInputs: [
      { id: 'product', label: '产品图', dataType: 'image', required: true },
      { id: 'scene', label: '场景参考', dataType: 'image' },
      { id: 'style', label: '风格参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '1:1',
      sceneType: 'studio',
      lightingStyle: 'natural',
      moodStyle: 'professional',
      productType: 'general',
      imageInputCount: 1
    }
  },

  // ===== 首饰试戴节点 =====
  [WorkflowNodeType.JEWELRY_TRYON]: {
    type: WorkflowNodeType.JEWELRY_TRYON,
    label: '首饰试戴',
    icon: '💍',
    category: 'image',
    description: '虚拟首饰试戴，支持项链、耳环、手链等',
    defaultInputs: [
      { id: 'model', label: '模特照片', dataType: 'image', required: true },
      { id: 'jewelry', label: '首饰图片', dataType: 'image', required: true },
      { id: 'reference', label: '效果参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '3:4',
      jewelryType: 'necklace',
      position: 'auto',
      blendMode: 'natural',
      imageInputCount: 2
    }
  },

  // ===== 眼镜试戴节点 =====
  [WorkflowNodeType.EYEWEAR_TRYON]: {
    type: WorkflowNodeType.EYEWEAR_TRYON,
    label: '眼镜试戴',
    icon: '👓',
    category: 'image',
    description: '虚拟眼镜试戴，支持眼镜、太阳镜、护目镜等',
    defaultInputs: [
      { id: 'model', label: '模特照片', dataType: 'image', required: true },
      { id: 'eyewear', label: '眼镜图片', dataType: 'image', required: true },
      { id: 'reference', label: '效果参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '3:4',
      eyewearType: 'glasses',
      frameStyle: 'round',
      lensEffect: 'clear',
      blendMode: 'natural',
      imageInputCount: 2
    }
  },

  // ===== 鞋类展示节点 =====
  [WorkflowNodeType.FOOTWEAR_DISPLAY]: {
    type: WorkflowNodeType.FOOTWEAR_DISPLAY,
    label: '鞋类展示',
    icon: '👟',
    category: 'image',
    description: '专业鞋类产品展示图片生成，支持运动鞋、皮鞋、靴子等',
    defaultInputs: [
      { id: 'product', label: '鞋类图片', dataType: 'image', required: true },
      { id: 'reference', label: '风格参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '4:3',
      footwearType: 'sneakers',
      displayAngle: 'three_quarter',
      materialStyle: 'leather',
      sceneBackground: 'white',
      lightingEffect: 'soft',
      imageInputCount: 2
    }
  },

  // ===== 美妆产品节点 =====
  [WorkflowNodeType.COSMETICS_PHOTO]: {
    type: WorkflowNodeType.COSMETICS_PHOTO,
    label: '美妆摄影',
    icon: '💄',
    category: 'image',
    description: '专业美妆护肤产品摄影生成，支持护肤品、彩妆、香水等',
    defaultInputs: [
      { id: 'product', label: '产品图片', dataType: 'image', required: true },
      { id: 'reference', label: '风格参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '4:3',
      cosmeticsType: 'skincare',
      productTexture: 'glossy',
      displayStyle: 'luxury',
      backgroundSetting: 'white',
      lightingEffect: 'soft',
      imageInputCount: 2
    }
  },

  // ===== 家具场景节点 =====
  [WorkflowNodeType.FURNITURE_SCENE]: {
    type: WorkflowNodeType.FURNITURE_SCENE,
    label: '家具场景',
    icon: '🛋️',
    category: 'image',
    description: '家具产品室内场景合成，支持沙发、桌椅、床品等',
    defaultInputs: [
      { id: 'furniture', label: '家具图片', dataType: 'image', required: true },
      { id: 'room', label: '房间参考', dataType: 'image' },
      { id: 'style', label: '风格参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '16:9',
      furnitureType: 'sofa',
      roomType: 'living_room',
      interiorStyle: 'modern',
      lightingMood: 'natural',
      imageInputCount: 3
    }
  },

  // ===== 3C电子产品节点 =====
  [WorkflowNodeType.ELECTRONICS_PHOTO]: {
    type: WorkflowNodeType.ELECTRONICS_PHOTO,
    label: '3C产品摄影',
    icon: '📱',
    category: 'image',
    description: '专业3C电子产品摄影生成，支持手机、电脑、耳机等',
    defaultInputs: [
      { id: 'product', label: '产品图片', dataType: 'image', required: true },
      { id: 'reference', label: '风格参考', dataType: 'image' }
    ],
    defaultOutputs: [{ id: 'image', label: '生成图片', dataType: 'image' }],
    defaultConfig: {
      model: 'gemini-3-pro-image-preview',
      imageSize: '2K',
      aspectRatio: '4:3',
      electronicsType: 'smartphone',
      displayAngle: 'three_quarter',
      surfaceFinish: 'glossy',
      backgroundStyle: 'gradient',
      lightingStyle: 'studio',
      imageInputCount: 2
    }
  },

  // ===== 图片对比节点 =====
  [WorkflowNodeType.COMPARE_IMAGE]: {
    type: WorkflowNodeType.COMPARE_IMAGE,
    label: '图片对比',
    icon: '⚖️',
    category: 'image',
    description: '将原图和新图拼接对比',
    defaultInputs: [
      { id: 'originalImage', label: '原图', dataType: 'image', required: true },
      { id: 'newImage', label: '新图', dataType: 'image', required: true }
    ],
    defaultOutputs: [{ id: 'comparedImage', label: '对比图', dataType: 'image' }],
    defaultConfig: {}
  },

  // ===== 视频节点 =====
  [WorkflowNodeType.KLING_IMAGE2VIDEO]: {
    type: WorkflowNodeType.KLING_IMAGE2VIDEO,
    label: 'Kling 图生视频',
    icon: '🎬',
    category: 'video',
    description: '使用 Kling AI 将图片转换为视频',
    defaultInputs: [
      { id: 'image', label: '输入图片', dataType: 'image', required: true },
      { id: 'videoPrompt', label: '视频提示词', dataType: 'text' }
    ],
    defaultOutputs: [{ id: 'video', label: '生成视频', dataType: 'video' }],
    defaultConfig: {
      duration: 5,
      useUpstreamPrompt: true
    } as ImageToVideoConfig
  },

  [WorkflowNodeType.UNIFIED_VIDEO_GENERATION]: {
    type: WorkflowNodeType.UNIFIED_VIDEO_GENERATION,
    label: '视频生成',
    icon: '🎬',
    category: 'video',
    description: '通用视频生成节点，支持文生视频和图生视频，适配多种视频模型 API',
    defaultInputs: [
      { id: 'prompt', label: '提示词', dataType: 'text', required: true },
      { id: 'image', label: '首帧图片', dataType: 'image' },
      { id: 'imageEnd', label: '尾帧图片', dataType: 'image' },
      { id: 'negativePrompt', label: '负面提示词', dataType: 'text' },
      { id: 'promptJson', label: '提示词 JSON', dataType: 'json' }
    ],
    defaultOutputs: [
      { id: 'video', label: '生成视频', dataType: 'video' },
      { id: 'metadata', label: '元数据', dataType: 'json' }
    ],
    defaultConfig: {
      mode: 'text2video',
      duration: 5,
      aspectRatio: '16:9',
      size: '1280x720'
    }
  },

  // ===== 外部服务节点 =====
  [WorkflowNodeType.RUNNINGHUB_APP]: {
    type: WorkflowNodeType.RUNNINGHUB_APP,
    label: 'RunningHub 换装',
    icon: '👗',
    category: 'image',
    description: 'RunningHub 换装应用',
    defaultInputs: [
      { id: 'image', label: '输入图片', dataType: 'image', required: true },
      { id: 'promptJson', label: '提示词JSON', dataType: 'json' }
    ],
    defaultOutputs: [{ id: 'image', label: '输出图片', dataType: 'image' }],
    defaultConfig: {
      webappId: '',
      autoBinding: true
    }
  },

  // ===== 流程控制节点 =====
  [WorkflowNodeType.CONDITION]: {
    type: WorkflowNodeType.CONDITION,
    label: '条件分支',
    icon: '🔀',
    category: 'flow',
    description: '根据条件判断执行不同分支',
    defaultInputs: [{ id: 'data', label: '输入数据', dataType: 'json', required: true }],
    defaultOutputs: [
      { id: 'true', label: '满足条件', dataType: 'any' },
      { id: 'false', label: '不满足', dataType: 'any' }
    ],
    defaultConfig: {
      field: '',
      operator: 'equals',
      value: ''
    } as ConditionConfig
  },

  [WorkflowNodeType.SUBFLOW]: {
    type: WorkflowNodeType.SUBFLOW,
    label: '子工作流',
    icon: '📦',
    category: 'flow',
    description: '嵌套执行另一个工作流',
    defaultInputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    defaultOutputs: [{ id: 'output', label: '输出', dataType: 'any' }],
    defaultConfig: {}
  },

  // ===== HTTP 请求节点 =====
  [WorkflowNodeType.HTTP_REQUEST]: {
    type: WorkflowNodeType.HTTP_REQUEST,
    label: 'HTTP 请求',
    icon: '🌐',
    category: 'external',
    description: '调用外部 HTTP API，支持 RESTful 接口和 Webhook',
    defaultInputs: [
      { id: 'url', label: 'URL', dataType: 'text' },
      { id: 'body', label: '请求体', dataType: 'json' },
      { id: 'headers', label: 'Headers', dataType: 'json' },
      { id: 'variables', label: '变量', dataType: 'json' }
    ],
    defaultOutputs: [
      { id: 'response', label: '响应体', dataType: 'json' },
      { id: 'data', label: '响应数据', dataType: 'json' },
      { id: 'text', label: '响应文本', dataType: 'text' },
      { id: 'status', label: '状态码', dataType: 'number' },
      { id: 'headers', label: '响应头', dataType: 'json' },
      { id: 'success', label: '是否成功', dataType: 'boolean' }
    ],
    defaultConfig: {
      method: 'GET',
      bodyType: 'json',
      authType: 'none',
      responseType: 'json',
      timeout: 30,
      retryCount: 0
    }
  },

  // ===== 代码执行节点 =====
  [WorkflowNodeType.CODE_EXECUTOR]: {
    type: WorkflowNodeType.CODE_EXECUTOR,
    label: '代码执行',
    icon: '💻',
    category: 'flow',
    description: '运行自定义 JavaScript 代码处理数据',
    defaultInputs: [
      { id: 'input1', label: '输入 1', dataType: 'any' },
      { id: 'input2', label: '输入 2', dataType: 'any' },
      { id: 'input3', label: '输入 3', dataType: 'any' }
    ],
    defaultOutputs: [
      { id: 'output', label: '输出', dataType: 'any' },
      { id: 'output1', label: '输出 1', dataType: 'any' },
      { id: 'output2', label: '输出 2', dataType: 'any' },
      { id: 'logs', label: '日志', dataType: 'json' }
    ],
    defaultConfig: {
      code: '// 处理输入数据\nconst data = inputs.input1;\nreturn data;',
      async: false,
      timeout: 30,
      errorHandling: 'throw'
    }
  },

  // ===== JSON 转换节点 =====
  [WorkflowNodeType.JSON_TRANSFORM]: {
    type: WorkflowNodeType.JSON_TRANSFORM,
    label: 'JSON 转换',
    icon: '🔄',
    category: 'flow',
    description: '对 JSON 数据进行转换、提取和映射',
    defaultInputs: [
      { id: 'input', label: '输入数据', dataType: 'json', required: true },
      { id: 'template', label: '模板', dataType: 'json' }
    ],
    defaultOutputs: [
      { id: 'output', label: '输出', dataType: 'json' },
      { id: 'count', label: '数量', dataType: 'number' },
      { id: 'keys', label: '键列表', dataType: 'json' }
    ],
    defaultConfig: {
      operation: 'extract',
      sortOrder: 'asc',
      flattenDepth: 1,
      convertTo: 'string'
    }
  },

  // ===== 高级节点 - List 批处理 =====
  [WorkflowNodeType.IMAGE_LIST]: {
    type: WorkflowNodeType.IMAGE_LIST,
    label: '图片列表',
    icon: '📋',
    category: 'flow',
    description: '管理图片列表，支持批量处理',
    defaultInputs: [
      { id: 'image1', label: '图片1', dataType: 'image' },
      { id: 'image2', label: '图片2', dataType: 'image' },
      { id: 'image3', label: '图片3', dataType: 'image' },
      { id: 'image4', label: '图片4', dataType: 'image' },
      { id: 'image5', label: '图片5', dataType: 'image' },
      { id: 'images_input', label: '图片列表输入', dataType: 'images' }
    ],
    defaultOutputs: [
      { id: 'images', label: '图片列表', dataType: 'images' },
      { id: 'count', label: '数量', dataType: 'text' },
      { id: 'image_at_0', label: '第1张', dataType: 'image' },
      { id: 'image_at_1', label: '第2张', dataType: 'image' },
      { id: 'image_at_2', label: '第3张', dataType: 'image' }
    ],
    defaultConfig: {
      listType: 'image',
      maxCapacity: 100,
      dynamicAdd: true
    } as ListNodeConfig
  },

  [WorkflowNodeType.TEXT_LIST]: {
    type: WorkflowNodeType.TEXT_LIST,
    label: '文本列表',
    icon: '📝',
    category: 'flow',
    description: '管理文本列表，支持批量prompt',
    defaultInputs: [
      { id: 'text1', label: '文本1', dataType: 'text' },
      { id: 'text2', label: '文本2', dataType: 'text' },
      { id: 'text3', label: '文本3', dataType: 'text' },
      { id: 'text4', label: '文本4', dataType: 'text' },
      { id: 'text5', label: '文本5', dataType: 'text' }
    ],
    defaultOutputs: [
      { id: 'texts', label: '文本列表', dataType: 'any' },
      { id: 'count', label: '数量', dataType: 'text' },
      { id: 'joined', label: '合并文本', dataType: 'text' }
    ],
    defaultConfig: {
      listType: 'text',
      maxCapacity: 100
    } as ListNodeConfig
  },

  [WorkflowNodeType.LIST_MERGE]: {
    type: WorkflowNodeType.LIST_MERGE,
    label: '列表合并',
    icon: '🔀',
    category: 'flow',
    description: '合并多个列表',
    defaultInputs: [
      { id: 'list1', label: '列表1', dataType: 'any', required: true },
      { id: 'list2', label: '列表2', dataType: 'any', required: true },
      { id: 'list3', label: '列表3', dataType: 'any' },
      { id: 'list4', label: '列表4', dataType: 'any' }
    ],
    defaultOutputs: [
      { id: 'merged', label: '合并列表', dataType: 'any' },
      { id: 'count', label: '总数量', dataType: 'text' }
    ],
    defaultConfig: {
      operation: 'merge'
    } as ListNodeConfig
  },

  [WorkflowNodeType.LIST_FILTER]: {
    type: WorkflowNodeType.LIST_FILTER,
    label: '列表筛选',
    icon: '🔍',
    category: 'flow',
    description: '根据条件筛选列表元素',
    defaultInputs: [{ id: 'list', label: '输入列表', dataType: 'any', required: true }],
    defaultOutputs: [
      { id: 'filtered', label: '筛选结果', dataType: 'any' },
      { id: 'count', label: '结果数量', dataType: 'text' }
    ],
    defaultConfig: {
      operation: 'filter',
      filterCondition: {
        operator: 'contains',
        value: ''
      }
    } as ListNodeConfig
  },

  // ===== 高级节点 - Pipe 数据路由 =====
  [WorkflowNodeType.PIPE]: {
    type: WorkflowNodeType.PIPE,
    label: '数据管道',
    icon: '🚰',
    category: 'flow',
    description: '通用数据管道，支持命名传输',
    defaultInputs: [{ id: 'data', label: '输入数据', dataType: 'any', required: true }],
    defaultOutputs: [{ id: 'data', label: '输出数据', dataType: 'any' }],
    defaultConfig: {
      pipeName: 'default_pipe',
      dataType: 'any'
    } as PipeNodeConfig
  },

  [WorkflowNodeType.PIPE_ROUTER]: {
    type: WorkflowNodeType.PIPE_ROUTER,
    label: '数据路由器',
    icon: '🔀',
    category: 'flow',
    description: '根据规则将数据路由到不同管道',
    defaultInputs: [{ id: 'data', label: '输入数据', dataType: 'any', required: true }],
    defaultOutputs: [
      { id: 'out1', label: '输出1', dataType: 'any' },
      { id: 'out2', label: '输出2', dataType: 'any' },
      { id: 'out3', label: '输出3', dataType: 'any' },
      { id: 'default', label: '默认输出', dataType: 'any' }
    ],
    defaultConfig: {
      dataType: 'any',
      routingRules: []
    } as PipeNodeConfig
  },

  [WorkflowNodeType.PIPE_MERGER]: {
    type: WorkflowNodeType.PIPE_MERGER,
    label: '数据合并器',
    icon: '🔗',
    category: 'flow',
    description: '合并多个数据管道',
    defaultInputs: [
      { id: 'in1', label: '输入1', dataType: 'any' },
      { id: 'in2', label: '输入2', dataType: 'any' },
      { id: 'in3', label: '输入3', dataType: 'any' },
      { id: 'in4', label: '输入4', dataType: 'any' }
    ],
    defaultOutputs: [{ id: 'data', label: '合并数据', dataType: 'any' }],
    defaultConfig: {
      dataType: 'any',
      mergeStrategy: 'concat'
    } as PipeNodeConfig
  },

  // ===== 高级节点 - Switch 条件分支 =====
  [WorkflowNodeType.SWITCH]: {
    type: WorkflowNodeType.SWITCH,
    label: '条件开关',
    icon: '🔀',
    category: 'flow',
    description: '根据条件选择分支',
    defaultInputs: [
      { id: 'data', label: '输入数据', dataType: 'any', required: true },
      { id: 'condition', label: '条件值', dataType: 'text' }
    ],
    defaultOutputs: [
      { id: 'true', label: '满足条件', dataType: 'any' },
      { id: 'false', label: '不满足', dataType: 'any' }
    ],
    defaultConfig: {
      conditionType: 'exists',
      defaultBranch: 'false'
    } as SwitchNodeConfig
  },

  [WorkflowNodeType.MULTI_SWITCH]: {
    type: WorkflowNodeType.MULTI_SWITCH,
    label: '多路选择',
    icon: '🎚️',
    category: 'flow',
    description: '多个分支选择（类似 switch-case）',
    defaultInputs: [
      { id: 'data', label: '输入数据', dataType: 'any', required: true },
      { id: 'selector', label: '选择器', dataType: 'text', required: true }
    ],
    defaultOutputs: [
      { id: 'case1', label: '分支1', dataType: 'any' },
      { id: 'case2', label: '分支2', dataType: 'any' },
      { id: 'case3', label: '分支3', dataType: 'any' },
      { id: 'default', label: '默认分支', dataType: 'any' }
    ],
    defaultConfig: {
      conditionType: 'value',
      cases: [
        { value: 'case1', label: '分支1' },
        { value: 'case2', label: '分支2' },
        { value: 'case3', label: '分支3' }
      ]
    } as SwitchNodeConfig
  },

  // ===== 高级节点 - Loop 循环执行 =====
  [WorkflowNodeType.LOOP]: {
    type: WorkflowNodeType.LOOP,
    label: '循环执行',
    icon: '🔁',
    category: 'flow',
    description: '循环执行工作流片段',
    defaultInputs: [
      { id: 'data', label: '输入数据', dataType: 'any', required: true },
      { id: 'condition', label: '循环条件', dataType: 'text' }
    ],
    defaultOutputs: [
      { id: 'result', label: '循环结果', dataType: 'any' },
      { id: 'iterations', label: '迭代次数', dataType: 'text' }
    ],
    defaultConfig: {
      loopType: 'condition',
      maxIterations: 100,
      allowBreak: true,
      iterationDelay: 0
    } as LoopNodeConfig
  },

  [WorkflowNodeType.LOOP_INDEX]: {
    type: WorkflowNodeType.LOOP_INDEX,
    label: '索引循环',
    icon: '🔢',
    category: 'flow',
    description: '按索引循环（for i in range）',
    defaultInputs: [{ id: 'data', label: '输入数据', dataType: 'any', required: true }],
    defaultOutputs: [
      { id: 'current', label: '当前项', dataType: 'any' },
      { id: 'index', label: '当前索引', dataType: 'text' },
      { id: 'result', label: '循环结果', dataType: 'any' }
    ],
    defaultConfig: {
      loopType: 'index',
      indexRange: {
        start: 0,
        end: 10,
        step: 1
      },
      maxIterations: 1000
    } as LoopNodeConfig
  },

  [WorkflowNodeType.LOOP_LIST]: {
    type: WorkflowNodeType.LOOP_LIST,
    label: '列表循环',
    icon: '📋',
    category: 'flow',
    description: '遍历列表元素（for item in list）',
    defaultInputs: [{ id: 'list', label: '输入列表', dataType: 'any', required: true }],
    defaultOutputs: [
      { id: 'current', label: '当前项', dataType: 'any' },
      { id: 'index', label: '当前索引', dataType: 'text' },
      { id: 'result', label: '处理结果', dataType: 'any' }
    ],
    defaultConfig: {
      loopType: 'list',
      maxIterations: 1000,
      iterationDelay: 0
    } as LoopNodeConfig
  },

  // ===== 输出节点 =====
  [WorkflowNodeType.OUTPUT]: {
    type: WorkflowNodeType.OUTPUT,
    label: '输出',
    icon: '📤',
    category: 'output',
    description: '保存或展示工作流结果',
    defaultInputs: [
      { id: 'image', label: '图片', dataType: 'image' },
      { id: 'video', label: '视频', dataType: 'video' },
      { id: 'text', label: '文本', dataType: 'text' },
      { id: 'any', label: '任意数据', dataType: 'any' }
    ],
    defaultOutputs: [],
    defaultConfig: {
      outputType: 'display'
    } as OutputConfig
  }
}

// ==================== 辅助函数 ====================

// 导入适配器（延迟导入避免循环依赖）
let nodeRegistryAdapter: any = null
async function getAdapter() {
  if (!nodeRegistryAdapter) {
    const { NodeRegistryAdapter } = await import('../base/NodeRegistryAdapter')
    await NodeRegistryAdapter.initialize()
    nodeRegistryAdapter = NodeRegistryAdapter
  }
  return nodeRegistryAdapter
}

/**
 * 获取节点定义
 * @deprecated 推荐使用 NodeRegistryAdapter.getNodeDefinition()
 */
export function getNodeDefinition(type: WorkflowNodeType): NodeDefinition {
  // 向后兼容：直接从 NODE_REGISTRY 获取
  return NODE_REGISTRY[type]
}

/**
 * 获取分类下的所有节点 (异步版本，支持新系统)
 */
export async function getNodesByCategoryAsync(category: NodeDefinition['category']): Promise<NodeDefinition[]> {
  try {
    const adapter = await getAdapter()
    return adapter.getNodesByCategory(category)
  } catch (error) {
    // 回退到旧系统
    return Object.values(NODE_REGISTRY).filter((def) => def.category === category)
  }
}

/**
 * 获取分类下的所有节点 (同步版本，仅支持旧系统)
 * @deprecated 推荐使用 getNodesByCategoryAsync()
 */
export function getNodesByCategory(category: NodeDefinition['category']): NodeDefinition[] {
  return Object.values(NODE_REGISTRY).filter((def) => def.category === category)
}

/**
 * 获取所有节点类型 (异步版本，支持新系统)
 */
export async function getAllNodeTypesAsync(): Promise<WorkflowNodeType[]> {
  try {
    const adapter = await getAdapter()
    return adapter.getAllNodeTypes()
  } catch (error) {
    // 回退到旧系统
    return Object.keys(NODE_REGISTRY) as WorkflowNodeType[]
  }
}

/**
 * 获取所有节点类型 (同步版本，仅支持旧系统)
 * @deprecated 推荐使用 getAllNodeTypesAsync()
 */
export function getAllNodeTypes(): WorkflowNodeType[] {
  return Object.keys(NODE_REGISTRY) as WorkflowNodeType[]
}

/**
 * 检查节点类型是否存在 (异步版本，支持新系统)
 */
export async function isValidNodeTypeAsync(type: string): Promise<boolean> {
  try {
    const adapter = await getAdapter()
    return adapter.hasNode(type as WorkflowNodeType)
  } catch (error) {
    // 回退到旧系统
    return type in NODE_REGISTRY
  }
}

/**
 * 检查节点类型是否存在 (同步版本，仅支持旧系统)
 * @deprecated 推荐使用 isValidNodeTypeAsync()
 */
export function isValidNodeType(type: string): type is WorkflowNodeType {
  return type in NODE_REGISTRY
}
