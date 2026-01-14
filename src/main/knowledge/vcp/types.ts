/**
 * VCP 插件系统类型定义
 *
 * 支持 VCPToolBox 的 6 种插件协议类型
 * 同时兼容 MCP 协议
 */

// VCPPluginType 从权威来源重导出，避免重复定义
export type { VCPPluginType } from '@main/services/vcp/types'

/**
 * VCP 协议标记
 * 用于解析 VCP 工具请求/响应格式
 */
export const VCP_MARKERS = {
  TOOL_REQUEST_START: '<<<[TOOL_REQUEST]>>>',
  TOOL_REQUEST_END: '<<<[END_TOOL_REQUEST]>>>',
  TOOL_RESULT: '<<<[TOOL_RESULT]>>>',
  TOOL_RESULT_END: '<<<[/TOOL_RESULT]>>>',
  TOOL_ERROR: '<<<[TOOL_ERROR]>>>',
  TOOL_ERROR_END: '<<<[/TOOL_ERROR]>>>',
  PARAM_START: '「始」',
  PARAM_END: '「末」'
} as const

// 导入 VCPPluginType 供本文件内部使用
import type { VCPPluginType } from '@main/services/vcp/types'

/**
 * 插件执行结果
 */
export interface PluginExecutionResult {
  /** 是否成功 */
  success: boolean
  /** 输出内容 */
  output?: string
  /** 结构化结果数据 */
  data?: unknown
  /** 错误信息 */
  error?: string
  /** 执行时间 (毫秒) */
  executionTimeMs?: number
  /** 异步任务 ID (仅 asynchronous 类型) */
  taskId?: string
  /** 流式响应 (用于支持 MCP streaming) */
  stream?: AsyncIterable<PluginStreamChunk>
}

/**
 * 插件流式响应块
 */
export interface PluginStreamChunk {
  /** 块类型 */
  type: 'text' | 'progress' | 'metadata' | 'done'
  /** 文本内容 (type: 'text') */
  text?: string
  /** 进度百分比 (type: 'progress', 0-100) */
  progress?: number
  /** 元数据 (type: 'metadata') */
  metadata?: Record<string, unknown>
}

/**
 * 插件参数定义
 */
export interface PluginParamDefinition {
  /** 参数名称 */
  name: string
  /** 参数描述 */
  description: string
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  /** 是否必需 */
  required: boolean
  /** 默认值 */
  default?: unknown
  /** 枚举值 (可选) */
  enum?: string[]
}

/**
 * 静态插件配置 (static)
 * 定时执行，更新占位符
 */
export interface StaticPluginConfig {
  /** 占位符名称 (如: {{current_time}}) */
  placeholder: string
  /** 更新间隔 (毫秒) */
  updateIntervalMs: number
  /** 初始值 */
  initialValue?: string
}

/**
 * 服务插件配置 (service/hybridservice)
 */
export interface ServicePluginConfig {
  /** HTTP 路由路径 */
  routePath: string
  /** HTTP 方法 */
  methods: ('GET' | 'POST' | 'PUT' | 'DELETE')[]
  /** 是否需要认证 */
  requireAuth?: boolean
}

/**
 * 消息预处理器配置 (messagePreprocessor)
 */
export interface MessagePreprocessorConfig {
  /** 处理优先级 (越小越先执行) */
  priority: number
  /** 是否应用于用户消息 */
  applyToUser: boolean
  /** 是否应用于助手消息 */
  applyToAssistant: boolean
  /** 是否应用于系统消息 */
  applyToSystem: boolean
}

/**
 * VCP 插件定义
 */
export interface VCPPluginDefinition {
  /** 插件唯一 ID */
  id: string
  /** 插件名称 (用于工具调用) */
  name: string
  /** 插件显示名称 */
  displayName: string
  /** 插件描述 */
  description: string
  /** 插件版本 */
  version: string
  /** 插件作者 */
  author?: string
  /** 插件类型 */
  type: VCPPluginType
  /** 参数定义 */
  params: PluginParamDefinition[]
  /** 返回值描述 */
  returns?: string
  /** 图标 */
  icon?: string
  /** 分类 */
  category?: string
  /** 标签 */
  tags?: string[]

  // 类型特定配置
  /** 静态插件配置 */
  staticConfig?: StaticPluginConfig
  /** 服务插件配置 */
  serviceConfig?: ServicePluginConfig
  /** 预处理器配置 */
  preprocessorConfig?: MessagePreprocessorConfig

  // 分布式支持
  /** 是否为分布式插件 */
  distributed?: boolean
  /** 远程服务器端点 */
  serverEndpoint?: string

  // 依赖关系
  /** 依赖的其他插件 */
  dependencies?: string[]
}

/**
 * VCP 插件执行器接口
 */
export interface VCPPluginExecutor {
  /** 执行插件 */
  execute(params: Record<string, string | number | boolean>): Promise<PluginExecutionResult>
  /** 验证参数 */
  validateParams?(params: Record<string, unknown>): { valid: boolean; errors?: string[] }
  /** 获取帮助信息 */
  getHelp?(): string
}

/**
 * 完整的 VCP 插件 (定义 + 执行器)
 */
export interface VCPFullPlugin extends VCPPluginDefinition {
  /** 执行器 */
  executor: VCPPluginExecutor
  /** 是否已启用 */
  enabled: boolean
  /** 加载时间 */
  loadedAt?: Date
  /** 最后执行时间 */
  lastExecutedAt?: Date
  /** 执行统计 */
  stats?: {
    totalCalls: number
    successCalls: number
    failedCalls: number
    avgExecutionTimeMs: number
  }
}

// ==================== 插件存储相关类型 ====================

/**
 * 插件来源
 */
export type PluginSource = 'builtin' | 'downloaded' | 'local' | 'remote'

/**
 * 插件注册表项
 */
export interface PluginRegistryEntry {
  /** 插件 ID */
  id: string
  /** 插件名称 */
  name: string
  /** 版本 */
  version: string
  /** 来源 */
  source: PluginSource
  /** 安装路径 */
  installPath?: string
  /** 远程端点 */
  remoteEndpoint?: string
  /** 安装时间 */
  installedAt: Date
  /** 是否启用 */
  enabled: boolean
  /** 配置 */
  config?: Record<string, unknown>
}

/**
 * 插件商店项
 */
export interface PluginStoreItem {
  /** 插件 ID */
  id: string
  /** 名称 */
  name: string
  /** 描述 */
  description: string
  /** 版本 */
  version: string
  /** 作者 */
  author: string
  /** 下载次数 */
  downloads: number
  /** 评分 */
  rating: number
  /** 分类 */
  category: string
  /** 标签 */
  tags: string[]
  /** 缩略图 URL */
  thumbnailUrl?: string
  /** 下载 URL */
  downloadUrl: string
  /** 依赖 */
  dependencies?: string[]
  /** 兼容的 Cherry Studio 版本 */
  compatibleVersions?: string[]
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

// ==================== 异步任务相关类型 ====================

/**
 * 异步插件任务状态
 */
export type AsyncTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * 异步插件任务
 */
export interface AsyncPluginTask {
  /** 任务 ID */
  taskId: string
  /** 插件 ID */
  pluginId: string
  /** 插件名称 */
  pluginName: string
  /** 状态 */
  status: AsyncTaskStatus
  /** 进度 (0-100) */
  progress: number
  /** 创建时间 */
  createdAt: Date
  /** 开始时间 */
  startedAt?: Date
  /** 完成时间 */
  completedAt?: Date
  /** 结果 */
  result?: PluginExecutionResult
  /** 错误信息 */
  error?: string
}

// ==================== 插件事件相关类型 ====================

/**
 * 插件事件类型
 */
export type PluginEventType =
  | 'plugin:registered'
  | 'plugin:unregistered'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:executed'
  | 'plugin:error'
  | 'task:created'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'

/**
 * 插件事件
 */
export interface PluginEvent {
  type: PluginEventType
  pluginId: string
  timestamp: Date
  data?: unknown
}

/**
 * 插件事件监听器
 */
export type PluginEventListener = (event: PluginEvent) => void

// ==================== MCP 兼容相关类型 ====================

/**
 * MCP 工具调用格式
 */
export interface MCPToolCall {
  name: string
  arguments: Record<string, unknown>
}

/**
 * MCP 工具结果格式
 */
export interface MCPToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
  isError?: boolean
}

/**
 * MCP 工具定义格式
 */
export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * MCP 资源定义格式
 *
 * 资源是 MCP 协议中用于暴露数据的机制
 * 类似于 REST API 中的 GET 端点
 */
export interface MCPResource {
  /** 资源 URI (唯一标识符) */
  uri: string
  /** 资源名称 */
  name: string
  /** 资源描述 */
  description?: string
  /** MIME 类型 */
  mimeType?: string
}

/**
 * MCP 资源内容
 */
export interface MCPResourceContent {
  /** 资源 URI */
  uri: string
  /** MIME 类型 */
  mimeType?: string
  /** 文本内容 (text/* 类型) */
  text?: string
  /** 二进制内容 (base64 编码) */
  blob?: string
}

// ==================== 工具函数 ====================

/**
 * 将 VCP 插件定义转换为 MCP 工具定义
 */
export function vcpToMCPToolDefinition(plugin: VCPPluginDefinition): MCPToolDefinition {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const param of plugin.params) {
    properties[param.name] = {
      type: param.type === 'object' ? 'object' : param.type === 'array' ? 'array' : param.type,
      description: param.description
    }

    if (param.enum) {
      ;(properties[param.name] as Record<string, unknown>).enum = param.enum
    }

    if (param.default !== undefined) {
      ;(properties[param.name] as Record<string, unknown>).default = param.default
    }

    if (param.required) {
      required.push(param.name)
    }
  }

  return {
    name: plugin.name,
    description: plugin.description,
    inputSchema: {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    }
  }
}

/**
 * 将 VCP 执行结果转换为 MCP 工具结果
 */
export function vcpToMCPResult(result: PluginExecutionResult): MCPToolResult {
  if (result.success) {
    return {
      content: [{ type: 'text', text: result.output || JSON.stringify(result.data) || 'Success' }],
      isError: false
    }
  } else {
    return {
      content: [{ type: 'text', text: result.error || 'Unknown error' }],
      isError: true
    }
  }
}

/**
 * 将 MCP 工具调用转换为 VCP 参数
 */
export function mcpToVCPParams(args: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {}

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      params[key] = value
    } else if (value !== null && value !== undefined) {
      params[key] = JSON.stringify(value)
    }
  }

  return params
}

// ==================== 错误处理工具 ====================

/**
 * 错误上下文信息
 *
 * 用于在日志中保留完整的错误信息，包括堆栈跟踪
 */
export interface ErrorContext {
  /** 错误消息 */
  message: string
  /** 错误名称 (如 TypeError, RangeError) */
  name?: string
  /** 堆栈跟踪 */
  stack?: string
  /** 错误码 */
  code?: string | number
  /** 原始错误对象的额外属性 */
  details?: Record<string, unknown>
}

/**
 * 将任意错误转换为结构化的错误上下文
 *
 * 保留完整的错误信息，避免 String(error) 丢失堆栈跟踪
 *
 * @param error 错误对象
 * @returns 结构化的错误上下文
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation()
 * } catch (error) {
 *   logger.error('Operation failed', toErrorContext(error))
 * }
 * ```
 */
export function toErrorContext(error: unknown): ErrorContext {
  if (error instanceof Error) {
    const context: ErrorContext = {
      message: error.message,
      name: error.name,
      stack: error.stack
    }

    // 保留额外属性 (如 errno, syscall 等)
    const extraKeys = Object.keys(error).filter((k) => !['message', 'name', 'stack'].includes(k))
    if (extraKeys.length > 0) {
      context.details = {}
      for (const key of extraKeys) {
        context.details[key] = (error as unknown as Record<string, unknown>)[key]
      }
    }

    // 处理常见的错误码属性
    if ('code' in error) {
      context.code = (error as { code?: string | number }).code
    }

    return context
  }

  // 非 Error 对象，尽可能提取信息
  if (typeof error === 'string') {
    return { message: error }
  }

  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    return {
      message: obj.message ? String(obj.message) : JSON.stringify(error),
      details: obj
    }
  }

  return { message: String(error) }
}
