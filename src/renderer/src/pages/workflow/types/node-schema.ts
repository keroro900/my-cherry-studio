/**
 * 节点定义 Schema 系统
 *
 * 提供节点的元数据定义、验证和工厂功能
 * 支持扩展新节点类型
 *
 * 注意：此文件使用本地类型定义以避免循环依赖
 */

// ==================== 基础类型定义 ====================

/**
 * 工作流数据类型（本地定义，与 index.ts 中的 WorkflowDataType 相同）
 */
export type SchemaDataType = 'text' | 'image' | 'images' | 'video' | 'json' | 'any'

/**
 * 节点端口定义（本地定义，与 index.ts 中的 NodeHandle 兼容）
 */
export interface SchemaNodeHandle {
  id: string
  label: string
  dataType: SchemaDataType
  required?: boolean
  multiple?: boolean
}

// ==================== 节点分类 ====================

/**
 * 节点分类枚举
 * 与主类型文件中的 NodeDefinition.category 保持一致
 */
export type NodeCategory = 'input' | 'ai' | 'image' | 'video' | 'flow' | 'output'

/**
 * 扩展节点分类（用于未来扩展）
 */
export type ExtendedNodeCategory = NodeCategory | 'external' | 'utility'

/**
 * 节点分类元数据
 */
export const NODE_CATEGORIES: Record<ExtendedNodeCategory, { label: string; icon: string; order: number }> = {
  input: { label: '输入', icon: '📥', order: 1 },
  ai: { label: 'AI 处理', icon: '🤖', order: 2 },
  image: { label: '图像', icon: '🖼️', order: 3 },
  video: { label: '视频', icon: '🎬', order: 4 },
  flow: { label: '流程控制', icon: '🔀', order: 5 },
  external: { label: '外部服务', icon: '🔗', order: 6 },
  utility: { label: '工具', icon: '🔧', order: 7 },
  output: { label: '输出', icon: '📤', order: 8 }
}

// ==================== 配置字段 Schema ====================

/**
 * 配置字段类型
 */
export type ConfigFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'model'
  | 'provider'
  | 'image'
  | 'images'
  | 'folder'
  | 'textarea'
  | 'json'
  | 'color'
  | 'slider'

/**
 * 配置字段 Schema
 */
export interface ConfigFieldSchema {
  /** 字段名 */
  name: string
  /** 显示标签 */
  label: string
  /** 字段类型 */
  type: ConfigFieldType
  /** 是否必填 */
  required?: boolean
  /** 默认值 */
  default?: any
  /** 帮助文本 */
  help?: string
  /** 占位符 */
  placeholder?: string
  /** 分组标题 */
  group?: string

  // 数值类型专用
  min?: number
  max?: number
  step?: number

  // 选择类型专用
  options?: Array<{ value: string | number; label: string }>

  // 文本类型专用
  maxLength?: number
  rows?: number

  // 滑块类型专用
  marks?: Record<number, string>

  // 条件显示
  showWhen?: {
    field: string
    value: any
  }

  // 验证规则
  validate?: (value: any, config: Record<string, any>) => string | null
}

/**
 * 节点配置 Schema
 */
export interface NodeConfigSchema {
  /** 节点类型 */
  nodeType: string
  /** 配置字段列表 */
  fields: ConfigFieldSchema[]
  /** 分组顺序 */
  groups?: string[]
}

// ==================== 扩展节点定义 ====================

/**
 * 基础节点定义接口（本地定义，与主类型兼容）
 */
export interface BaseNodeDefinition {
  type: string
  label: string
  icon: string
  category: NodeCategory
  description: string
  defaultInputs: SchemaNodeHandle[]
  defaultOutputs: SchemaNodeHandle[]
  defaultConfig: Record<string, any>
}

/**
 * 扩展节点定义（包含更多元数据）
 */
export interface ExtendedNodeDefinition extends BaseNodeDefinition {
  /** 版本号 */
  version?: string
  /** 作者 */
  author?: string
  /** 标签 */
  tags?: string[]
  /** 是否为实验性节点 */
  experimental?: boolean
  /** 是否已废弃 */
  deprecated?: boolean
  /** 废弃替代方案 */
  deprecatedReason?: string
  /** 配置 Schema */
  configSchema?: NodeConfigSchema
  /** 输入端口生成器 */
  inputsGenerator?: (config: Record<string, any>) => SchemaNodeHandle[]
  /** 输出端口生成器 */
  outputsGenerator?: (config: Record<string, any>) => SchemaNodeHandle[]
  /** 执行前验证 */
  validateBeforeExecute?: (config: Record<string, any>, inputs: Record<string, any>) => string | null
}

// ==================== 节点创建工厂 ====================

/**
 * 节点创建选项
 */
export interface CreateNodeOptions {
  /** 节点 ID */
  id?: string
  /** 节点位置 */
  position?: { x: number; y: number }
  /** 初始配置覆盖 */
  configOverrides?: Record<string, any>
  /** 初始标签 */
  label?: string
}

/**
 * 节点工厂函数类型
 */
export type NodeFactory = (
  type: string,
  options?: CreateNodeOptions
) => {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    nodeType: string
    inputs: SchemaNodeHandle[]
    outputs: SchemaNodeHandle[]
    config: Record<string, any>
    status: 'idle'
  }
}

// ==================== 节点执行器接口 ====================

/**
 * 节点执行上下文
 */
export interface NodeExecutionContext {
  /** 工作流 ID */
  workflowId: string
  /** 开始时间 */
  startTime: number
  /** 所有节点输出 */
  nodeOutputs: Map<string, Record<string, any>>
  /** 取消信号 */
  abortSignal?: AbortSignal
  /** 日志函数 */
  log?: (message: string, level?: 'info' | 'warn' | 'error') => void
  /** 进度回调 */
  onProgress?: (progress: number, message?: string) => void
}

/**
 * 节点执行结果（Schema 版本）
 */
export interface SchemaNodeExecutionResult {
  /** 是否成功 */
  success: boolean
  /** 输出数据 */
  outputs: Record<string, any>
  /** 错误信息 */
  error?: string
  /** 执行时长（毫秒） */
  duration?: number
  /** 元数据 */
  metadata?: Record<string, any>
}

/**
 * 节点执行器接口
 */
export interface NodeExecutor {
  /** 节点类型 */
  nodeType: string
  /** 执行方法 */
  execute: (
    config: Record<string, any>,
    inputs: Record<string, any>,
    context: NodeExecutionContext
  ) => Promise<SchemaNodeExecutionResult>
  /** 验证配置 */
  validateConfig?: (config: Record<string, any>) => string | null
  /** 验证输入 */
  validateInputs?: (inputs: Record<string, any>, config: Record<string, any>) => string | null
}

// ==================== 节点注册器 ====================

/**
 * 节点注册信息
 */
export interface NodeRegistration {
  definition: ExtendedNodeDefinition
  executor?: NodeExecutor
  configForm?: React.ComponentType<{
    config: Record<string, any>
    onChange: (config: Record<string, any>) => void
  }>
}

/**
 * 节点注册器类
 * 用于管理节点的注册、查询和创建
 */
export class NodeRegistry {
  private nodes: Map<string, NodeRegistration> = new Map()

  /**
   * 注册节点
   */
  register(registration: NodeRegistration): void {
    const type = registration.definition.type
    this.nodes.set(type, registration)
  }

  /**
   * 批量注册
   */
  registerMany(registrations: NodeRegistration[]): void {
    registrations.forEach((r) => this.register(r))
  }

  /**
   * 获取节点定义
   */
  getDefinition(type: string): ExtendedNodeDefinition | undefined {
    return this.nodes.get(type)?.definition
  }

  /**
   * 获取节点执行器
   */
  getExecutor(type: string): NodeExecutor | undefined {
    return this.nodes.get(type)?.executor
  }

  /**
   * 获取节点配置表单
   */
  getConfigForm(type: string): NodeRegistration['configForm'] | undefined {
    return this.nodes.get(type)?.configForm
  }

  /**
   * 获取所有节点类型
   */
  getAllTypes(): string[] {
    return Array.from(this.nodes.keys())
  }

  /**
   * 获取分类下的所有节点
   */
  getByCategory(category: NodeCategory): ExtendedNodeDefinition[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.definition.category === category)
      .map((n) => n.definition)
  }

  /**
   * 搜索节点
   */
  search(query: string): ExtendedNodeDefinition[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.nodes.values())
      .filter(
        (n) =>
          n.definition.label.toLowerCase().includes(lowerQuery) ||
          n.definition.description?.toLowerCase().includes(lowerQuery) ||
          n.definition.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
      )
      .map((n) => n.definition)
  }

  /**
   * 检查节点是否已注册
   */
  has(type: string): boolean {
    return this.nodes.has(type)
  }

  /**
   * 获取节点数量
   */
  get size(): number {
    return this.nodes.size
  }
}

// ==================== 工具函数 ====================

/**
 * 生成节点 ID
 */
export function generateNodeId(prefix: string = 'node'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 验证端口连接兼容性
 */
export function isPortCompatible(sourceType: SchemaDataType, targetType: SchemaDataType): boolean {
  // any 类型可以连接任何类型
  if (sourceType === 'any' || targetType === 'any') return true
  // images 可以连接到 image
  if (sourceType === 'images' && targetType === 'image') return true
  // 相同类型可以连接
  return sourceType === targetType
}

/**
 * 创建默认端口
 */
export function createHandle(
  id: string,
  label: string,
  dataType: SchemaDataType,
  options?: Partial<SchemaNodeHandle>
): SchemaNodeHandle {
  return {
    id,
    label,
    dataType,
    required: false,
    multiple: false,
    ...options
  }
}

/**
 * 合并配置与默认值
 */
export function mergeConfigWithDefaults(config: Record<string, any>, schema: NodeConfigSchema): Record<string, any> {
  const result: Record<string, any> = { ...config }

  for (const field of schema.fields) {
    if (result[field.name] === undefined && field.default !== undefined) {
      result[field.name] = field.default
    }
  }

  return result
}

/**
 * 验证配置
 */
export function validateConfig(
  config: Record<string, any>,
  schema: NodeConfigSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const field of schema.fields) {
    const value = config[field.name]

    // 必填检查
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.label} 是必填项`)
      continue
    }

    // 自定义验证
    if (field.validate && value !== undefined) {
      const error = field.validate(value, config)
      if (error) {
        errors.push(error)
      }
    }

    // 数值范围检查
    if (field.type === 'number' || field.type === 'slider') {
      if (field.min !== undefined && value < field.min) {
        errors.push(`${field.label} 不能小于 ${field.min}`)
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`${field.label} 不能大于 ${field.max}`)
      }
    }

    // 字符串长度检查
    if ((field.type === 'string' || field.type === 'textarea') && field.maxLength) {
      if (typeof value === 'string' && value.length > field.maxLength) {
        errors.push(`${field.label} 长度不能超过 ${field.maxLength}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ==================== 预置端口定义 ====================

/**
 * 常用输入端口预设
 */
export const COMMON_INPUT_HANDLES = {
  image: createHandle('image', '图片', 'image', { required: true }),
  optionalImage: createHandle('image', '图片', 'image'),
  images: createHandle('images', '图片列表', 'images'),
  text: createHandle('text', '文本', 'text', { required: true }),
  optionalText: createHandle('text', '文本', 'text'),
  prompt: createHandle('prompt', '提示词', 'text', { required: true }),
  promptJson: createHandle('promptJson', '提示词JSON', 'json'),
  data: createHandle('data', '数据', 'any', { required: true }),
  optionalData: createHandle('data', '数据', 'any')
}

/**
 * 常用输出端口预设
 */
export const COMMON_OUTPUT_HANDLES = {
  image: createHandle('image', '图片', 'image'),
  images: createHandle('images', '图片列表', 'images'),
  text: createHandle('text', '文本', 'text'),
  json: createHandle('json', 'JSON数据', 'json'),
  result: createHandle('result', '结果', 'any'),
  video: createHandle('video', '视频', 'video')
}

// ==================== 导出单例注册器 ====================

/**
 * 全局节点注册器实例
 */
export const nodeRegistry = new NodeRegistry()
