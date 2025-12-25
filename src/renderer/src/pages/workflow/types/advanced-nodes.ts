/**
 * ComfyUI-inspired Advanced Node Types
 * 本土化设计 - 适配 Cherry Studio 并发 API 架构
 *
 * 设计原则：
 * 1. 参考 ComfyUI Comfyroll CustomNodes 的节点设计理念
 * 2. 适配 Cherry Studio 的 React Flow + 并发 API 架构
 * 3. 支持批处理、数据路由、条件分支、循环执行
 */

import type { NodeDefinition, WorkflowDataType } from './index'

// ==================== 高级节点类型枚举 ====================

/**
 * 高级工作流节点类型
 * 灵感来自 ComfyUI Comfyroll，本土化适配
 */
export enum AdvancedNodeType {
  // ===== List 节点 (批处理) =====
  IMAGE_LIST = 'image_list', // 图片列表管理
  TEXT_LIST = 'text_list', // 文本列表管理
  ANY_LIST = 'any_list', // 通用列表管理
  LIST_MERGE = 'list_merge', // 合并多个列表
  LIST_SPLIT = 'list_split', // 拆分列表
  LIST_FILTER = 'list_filter', // 筛选列表元素
  LIST_MAP = 'list_map', // 映射处理列表元素

  // ===== Pipe 节点 (数据路由) =====
  PIPE = 'pipe', // 通用数据管道
  PIPE_ROUTER = 'pipe_router', // 数据路由器（多路分发）
  PIPE_MERGER = 'pipe_merger', // 数据合并器（多路合一）
  PIPE_BUFFER = 'pipe_buffer', // 数据缓冲器

  // ===== Switch 节点 (条件分支) =====
  SWITCH = 'switch', // 条件开关
  SWITCH_IMAGE = 'switch_image', // 图片条件开关
  SWITCH_TEXT = 'switch_text', // 文本条件开关
  MULTI_SWITCH = 'multi_switch', // 多路选择开关

  // ===== Loop 节点 (循环执行) =====
  LOOP = 'loop', // 通用循环
  LOOP_INDEX = 'loop_index', // 索引循环（for i in range）
  LOOP_LIST = 'loop_list', // 列表循环（for item in list）
  LOOP_CONDITION = 'loop_condition', // 条件循环（while）
  LOOP_BREAK = 'loop_break' // 循环中断
}

// ==================== 节点配置类型 ====================

/**
 * List 节点配置
 */
export interface ListNodeConfig {
  // 列表类型
  listType: 'image' | 'text' | 'any'
  // 初始容量
  initialCapacity?: number
  // 最大容量
  maxCapacity?: number
  // 是否允许动态添加
  dynamicAdd?: boolean
  // 操作模式（for list_merge/split/filter/map）
  operation?: 'merge' | 'split' | 'filter' | 'map'
  // 筛选条件（for list_filter）
  filterCondition?: {
    field?: string
    operator?: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'not_contains'
    value?: string
  }
  // 映射操作（for list_map）
  mapOperation?: {
    type: 'resize' | 'format' | 'custom'
    params?: Record<string, any>
  }
}

/**
 * Pipe 节点配置
 */
export interface PipeNodeConfig {
  // 管道名称（用于识别数据流）
  pipeName?: string
  // 数据类型
  dataType: WorkflowDataType
  // 缓冲区大小（for pipe_buffer）
  bufferSize?: number
  // 路由规则（for pipe_router）
  routingRules?: Array<{
    condition: string
    targetPipe: string
  }>
  // 合并策略（for pipe_merger）
  mergeStrategy?: 'concat' | 'override' | 'interleave'
}

/**
 * Switch 节点配置
 */
export interface SwitchNodeConfig {
  // 条件类型
  conditionType: 'value' | 'exists' | 'count' | 'custom'
  // 条件表达式
  condition?: string
  // 默认分支（当条件不满足时）
  defaultBranch?: 'true' | 'false' | 'none'
  // 多路选择值（for multi_switch）
  cases?: Array<{
    value: string
    label: string
  }>
}

/**
 * Loop 节点配置
 */
export interface LoopNodeConfig {
  // 循环类型
  loopType: 'index' | 'list' | 'condition'
  // 循环范围（for loop_index）
  indexRange?: {
    start: number
    end: number
    step?: number
  }
  // 循环条件（for loop_condition）
  condition?: string
  // 最大迭代次数（防止死循环）
  maxIterations?: number
  // 是否允许中断
  allowBreak?: boolean
  // 迭代间隔（毫秒，用于并发控制）
  iterationDelay?: number
}

// ==================== 节点定义注册表 ====================

/**
 * 高级节点定义注册表
 * 参考 ComfyUI Comfyroll，本土化实现
 */
export const ADVANCED_NODE_REGISTRY: Record<string, NodeDefinition> = {
  // ===== Image List 节点 =====
  [AdvancedNodeType.IMAGE_LIST]: {
    type: AdvancedNodeType.IMAGE_LIST as any,
    label: '图片列表',
    icon: '📋🖼️',
    category: 'flow',
    description: '管理图片列表，支持批量处理',
    defaultInputs: [
      { id: 'image_1', label: '图片 1', dataType: 'image' },
      { id: 'image_2', label: '图片 2', dataType: 'image' },
      { id: 'image_3', label: '图片 3', dataType: 'image' },
      { id: 'image_4', label: '图片 4', dataType: 'image' },
      { id: 'image_5', label: '图片 5', dataType: 'image' },
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

  // ===== Text List 节点 =====
  [AdvancedNodeType.TEXT_LIST]: {
    type: AdvancedNodeType.TEXT_LIST as any,
    label: '文本列表',
    icon: '📋📝',
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

  // ===== List Merge 节点 =====
  [AdvancedNodeType.LIST_MERGE]: {
    type: AdvancedNodeType.LIST_MERGE as any,
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

  // ===== List Filter 节点 =====
  [AdvancedNodeType.LIST_FILTER]: {
    type: AdvancedNodeType.LIST_FILTER as any,
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

  // ===== Pipe 节点 =====
  [AdvancedNodeType.PIPE]: {
    type: AdvancedNodeType.PIPE as any,
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

  // ===== Pipe Router 节点 =====
  [AdvancedNodeType.PIPE_ROUTER]: {
    type: AdvancedNodeType.PIPE_ROUTER as any,
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

  // ===== Switch 节点 =====
  [AdvancedNodeType.SWITCH]: {
    type: AdvancedNodeType.SWITCH as any,
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

  // ===== Multi Switch 节点 =====
  [AdvancedNodeType.MULTI_SWITCH]: {
    type: AdvancedNodeType.MULTI_SWITCH as any,
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

  // ===== Loop 节点 =====
  [AdvancedNodeType.LOOP]: {
    type: AdvancedNodeType.LOOP as any,
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

  // ===== Loop Index 节点 =====
  [AdvancedNodeType.LOOP_INDEX]: {
    type: AdvancedNodeType.LOOP_INDEX as any,
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

  // ===== Loop List 节点 =====
  [AdvancedNodeType.LOOP_LIST]: {
    type: AdvancedNodeType.LOOP_LIST as any,
    label: '列表循环',
    icon: '📋🔁',
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
  }
}

// ==================== 辅助函数 ====================

/**
 * 检查是否为高级节点类型
 */
export function isAdvancedNode(type: string): boolean {
  return Object.values(AdvancedNodeType).includes(type as AdvancedNodeType)
}

/**
 * 获取高级节点定义
 */
export function getAdvancedNodeDefinition(type: AdvancedNodeType): NodeDefinition | undefined {
  return ADVANCED_NODE_REGISTRY[type]
}

/**
 * 获取所有高级节点定义
 */
export function getAllAdvancedNodes(): NodeDefinition[] {
  return Object.values(ADVANCED_NODE_REGISTRY)
}

/**
 * 获取指定分类的高级节点
 */
export function getAdvancedNodesByCategory(category: NodeDefinition['category']): NodeDefinition[] {
  return getAllAdvancedNodes().filter((def) => def.category === category)
}
