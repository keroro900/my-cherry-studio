import type { PluginModelConfig } from '../types'

/**
 * 内置服务执行结果
 */
export interface BuiltinServiceResult {
  success: boolean
  output?: string
  data?: unknown
  error?: string
  executionTimeMs?: number
}

/**
 * 模型调用请求
 */
export interface ModelCallRequest {
  /** 用户消息 */
  userMessage: string
  /** 系统提示词（可选，会与服务默认 systemPrompt 合并） */
  systemPrompt?: string
  /** 历史消息（可选） */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  /** 温度（可选，覆盖 modelConfig） */
  temperature?: number
  /** 最大 Token（可选，覆盖 modelConfig） */
  maxTokens?: number
}

/**
 * 模型调用结果
 */
export interface ModelCallResult {
  success: boolean
  content?: string
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * 工具定义
 */
export interface BuiltinToolDefinition {
  /** 命令标识符 */
  commandIdentifier: string
  /** 描述 */
  description: string
  /** 参数定义 */
  parameters?: Array<{
    name: string
    description: string
    required: boolean
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    default?: unknown
  }>
  /** 示例 */
  example?: string
}

/**
 * 内置服务接口
 * 所有内置服务必须实现此接口
 */
export interface IBuiltinService {
  /** 服务名称（对应 VCP plugin name） */
  name: string

  /** 显示名称 */
  displayName: string

  /** 描述 */
  description: string

  /** 版本 */
  version: string

  /** 服务类型 */
  type: 'builtin_service'

  /** 作者 */
  author?: string

  /** 分类 */
  category?: string

  /** 详细文档 (Markdown 格式) */
  documentation?: string

  /** 系统提示词模板 */
  systemPrompt?: string

  /** 配置 Schema */
  configSchema?: Record<string, unknown>

  /** 是否支持模型绑定 */
  supportsModel?: boolean

  /** 模型配置（运行时设置） */
  modelConfig?: PluginModelConfig

  /** 工具定义（VCP invocationCommands 格式） */
  toolDefinitions: BuiltinToolDefinition[]

  /**
   * 初始化服务
   * @param config 用户配置
   */
  initialize?(config?: Record<string, unknown>): Promise<void>

  /**
   * 设置用户配置
   * @param config 用户配置
   */
  setConfig?(config: Record<string, unknown>): void

  /**
   * 设置模型配置
   * @param modelConfig 模型绑定配置
   */
  setModelConfig?(modelConfig: PluginModelConfig): void

  /**
   * 调用绑定的模型
   * @param request 模型调用请求
   */
  callModel?(request: ModelCallRequest): Promise<ModelCallResult>

  /**
   * 执行工具调用
   * @param command 命令标识符
   * @param params 参数
   */
  execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult>

  /**
   * 关闭服务
   */
  shutdown?(): Promise<void>
}
