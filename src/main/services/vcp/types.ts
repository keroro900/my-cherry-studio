/**
 * VCP Native Runtime - Type Definitions
 *
 * 完全兼容 VCPToolBox plugin-manifest.json 格式
 */

// ==================== 插件类型 ====================

/**
 * 插件类型（兼容 VCPToolBox + MCP 桥接 + 内置服务）
 */
export type VCPPluginType =
  | 'static' // 只提供占位符值，不执行外部进程
  | 'synchronous' // stdio 执行，等待完整 JSON 输出
  | 'asynchronous' // stdio 执行，快速返回 taskId + 指引占位符
  | 'messagePreprocessor' // 接管消息数组，允许在发送模型前修改内容
  | 'service' // 提供可直接调用的 module API（无需 stdio）
  | 'hybridservice' // 混合服务（同时支持 stdio 和直接调用）
  | 'mcp_bridge' // MCP 工具桥接（自动将 MCP 工具封装为 VCP 插件）
  | 'builtin_service' // 内置服务（Cherry Studio 原生 TypeScript 实现）

/**
 * 通信协议
 */
export type CommunicationProtocol = 'stdio' | 'direct' | 'websocket'

// ==================== 清单格式（兼容 VCPToolBox） ====================

/**
 * 系统提示词占位符定义
 */
export interface SystemPromptPlaceholder {
  placeholder: string // 占位符名称，如 "VCPWeatherInfo"
  description?: string
  defaultValue?: string
}

/**
 * 工具参数属性定义
 */
export interface ToolParameterProperty {
  type: string
  description?: string
  enum?: string[]
  default?: unknown
}

/**
 * 工具函数定义
 */
export interface ToolFunctionDefinition {
  name: string
  description?: string
  parameters?: {
    type: 'object'
    properties: Record<string, ToolParameterProperty>
    required?: string[]
  }
}

/**
 * VCPToolBox 调用命令定义
 * 用于在系统提示词中生成工具调用说明
 */
export interface InvocationCommand {
  commandIdentifier?: string // 命令标识符
  description?: string // 工具描述（包含 VCP 协议调用格式）
  example?: string // 调用示例
  command?: string // 命令名称（可选）
  parameters?: Array<{ name: string; required?: boolean; type?: string; description?: string }> // 参数列表
}

/**
 * 插件能力声明
 */
export interface PluginCapabilities {
  systemPromptPlaceholders?: SystemPromptPlaceholder[]
  toolFunctions?: ToolFunctionDefinition[]
  invocationCommands?: InvocationCommand[] // VCPToolBox 原生格式
}

/**
 * 入口点配置
 */
export interface PluginEntryPoint {
  command: string // 执行命令，如 "python" 或 "node"
  args?: string[] // 命令参数，如 ["main.py"]
  cwd?: string // 工作目录（相对于插件根目录）
  env?: Record<string, string> // 环境变量
  timeout?: number // 执行超时（毫秒）
}

/**
 * 通信配置
 */
export interface PluginCommunication {
  protocol: CommunicationProtocol
  encoding?: 'utf-8' | 'base64'
  timeout?: number // 执行超时（毫秒）
}

/**
 * 异步配置
 */
export interface AsyncConfig {
  callbackRequired?: boolean
  pollInterval?: number // 轮询间隔（毫秒）
  maxWaitTime?: number // 最大等待时间（毫秒）
}

/**
 * 服务配置（用于 service/hybridservice 类型）
 */
export interface ServiceConfig {
  modulePath?: string // Node.js 模块路径
  className?: string // 导出的类名
  initMethod?: string // 初始化方法名
  shutdownMethod?: string // 关闭方法名
}

/**
 * JSON Schema 属性定义
 */
export interface JsonSchemaProperty {
  type: string
  description?: string
  default?: unknown
  enum?: string[]
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

/**
 * 插件配置 Schema 定义
 */
export interface PluginConfigSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
}

/**
 * 插件清单（兼容 VCPToolBox plugin-manifest.json）
 */
export interface VCPPluginManifest {
  // 基础信息
  name: string
  displayName?: string
  description?: string
  version?: string
  author?: string
  category?: string
  tags?: string[]

  // 插件类型
  pluginType: VCPPluginType

  // 入口点（stdio 类型必需）
  entryPoint?: PluginEntryPoint

  // 通信配置
  communication?: PluginCommunication

  // 能力声明
  capabilities?: PluginCapabilities

  // 异步配置（asynchronous 类型使用）
  asyncConfig?: AsyncConfig

  // 服务配置（service/hybridservice 类型使用）
  serviceConfig?: ServiceConfig

  // 依赖声明
  dependencies?: {
    python?: string
    node?: string
    packages?: string[]
  }

  // 配置模式 (支持简单格式和 JSON Schema 格式)
  configSchema?: PluginConfigSchema | Record<string, string>

  // 默认配置
  defaultConfig?: Record<string, unknown>

  // ==================== 新增字段 ====================

  /**
   * 静态插件刷新 Cron 表达式
   * 用于 static 类型插件定时更新占位符值
   * 格式: "秒 分 时 日 月 周" 或 "分 时 日 月 周"
   * 示例: "* /5 * * * *" 每5分钟, "0 0 * * *" 每天0点
   */
  refreshIntervalCron?: string

  /**
   * 启动时是否刷新静态插件
   * 默认: true
   */
  refreshOnStartup?: boolean

  /**
   * 预处理器优先级（数字越小越先执行）
   * 用于 messagePreprocessor 类型插件
   * 默认: 100
   */
  preprocessorPriority?: number
}

// ==================== 运行时类型 ====================

/**
 * VCP 服务模块接口
 * 用于 service/hybridservice/builtin_service 类型插件
 */
export interface VCPServiceModule {
  /** 初始化方法 */
  initialize?: () => Promise<void> | void
  /** 关闭方法 */
  shutdown?: () => Promise<void> | void
  /** 执行方法 */
  execute?: (params: Record<string, unknown>) => Promise<VCPToolResult>
  /** 其他动态方法 */
  [methodName: string]: unknown
}

/**
 * 加载后的插件实例
 */
export interface VCPPlugin {
  // 清单信息
  manifest: VCPPluginManifest

  // 运行时状态
  basePath: string // 插件根目录
  enabled: boolean
  loaded: boolean
  error?: string
  isBuiltin?: boolean // 是否为内置插件

  // 服务模块（service/hybridservice 类型）
  serviceModule?: VCPServiceModule

  // 用户配置覆盖
  userConfig?: Record<string, unknown>

  // 模型绑定配置
  modelConfig?: PluginModelConfig

  // MCP 桥接信息（mcp_bridge 类型）
  mcpBridge?: {
    serverId: string
    serverName: string
    toolName: string
    inputSchema: Record<string, unknown>
    handler: (args: Record<string, unknown>) => Promise<VCPToolResult>
  }

  // 外部插件信息（从 ExternalPluginManager 加载）
  externalPlugin?: {
    installedAt: string // ISO 时间戳
    permissions?: {
      fileSystem?: ('read' | 'write')[]
      network?: string[]
      shell?: boolean
    }
  }
}

/**
 * 工具执行请求
 */
export interface VCPToolRequest {
  toolName: string
  params: Record<string, any>
  requestId?: string
  context?: VCPExecutionContext
}

/**
 * 执行上下文
 */
export interface VCPExecutionContext {
  // 调用来源
  source?: 'chat' | 'workflow' | 'api'

  // 会话信息
  conversationId?: string
  messageId?: string

  // Agent 信息
  agentName?: string
  agentId?: string

  // 回调配置
  callbackUrl?: string
  callbackBaseUrl?: string

  // 追踪
  traceId?: string

  // 超时覆盖
  timeout?: number
}

/**
 * 工具执行结果
 *
 * VCP 规范兼容字段：
 * - success: 执行是否成功
 * - output: 输出内容（字符串或对象）
 * - data: 结构化数据
 * - error: 错误信息
 * - taskId: 异步任务 ID
 * - base64: Base64 编码的二进制数据
 * - mimeType: 内容类型
 */
export interface VCPToolResult {
  success: boolean
  output?: string | any
  data?: Record<string, any>
  error?: string
  taskId?: string // 异步任务 ID
  executionTimeMs?: number
  /** Base64 编码的二进制数据（图片等） */
  base64?: string
  /** 内容类型（如 image/png） */
  mimeType?: string
}

// ==================== 异步任务类型 ====================

/**
 * 异步任务状态
 */
export type AsyncTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout'

/**
 * 异步任务信息
 */
export interface AsyncTask {
  taskId: string
  pluginName: string
  status: AsyncTaskStatus
  createdAt: number
  updatedAt: number
  result?: VCPToolResult
  error?: string
  progress?: number // 0-100 进度百分比
  metadata?: Record<string, any>
}

// ==================== 占位符类型 ====================

/**
 * 占位符值
 */
export interface PlaceholderValue {
  placeholder: string
  value: string
  source: 'static' | 'async' | 'diary' | 'system' | 'tavern'
  updatedAt: number
}

/**
 * 占位符解析上下文
 */
export interface PlaceholderContext {
  agentName?: string
  conversationId?: string
  asyncResults?: Map<string, VCPToolResult>
  diaryContent?: Map<string, string>
  tavernRules?: Record<string, string>
  /** 当前模型 ID（用于 Sar 条件注入） */
  currentModelId?: string
  /** 角色类型（Tar/Var/Sar 仅在 system 角色生效） */
  role?: 'system' | 'user' | 'assistant'
  /** 环境变量覆盖 */
  envOverrides?: Record<string, string>
  /** 用户名称（SillyTavern {{user}} 变量） */
  userName?: string
  /** 用户人设描述（SillyTavern {{persona}} 变量） */
  userPersona?: string
}

// ==================== 消息预处理类型 ====================

/**
 * 消息格式（兼容 OpenAI）
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
  name?: string
  tool_call_id?: string
}

/**
 * 预处理器结果
 */
export interface PreprocessorResult {
  messages: ChatMessage[]
  modified: boolean
  metadata?: Record<string, any>
}

// ==================== 预处理器链类型 ====================

/**
 * 预处理器链顺序配置
 * 持久化到 userData/vcp/preprocessor_order.json
 */
export interface PreprocessorChainOrder {
  /** 配置版本 */
  version: number
  /** 预处理器执行顺序（插件名称数组） */
  order: string[]
  /** 最后更新时间戳 */
  updatedAt: number
}

// ==================== 配置类型 ====================

/**
 * 插件模型绑定配置
 * 允许每个插件独立配置使用的 AI 模型
 */
export interface PluginModelConfig {
  /** 是否启用模型 */
  enabled: boolean

  /** 模型提供商 ID */
  providerId?: string

  /** 模型 ID */
  modelId?: string

  /** 温度参数 (0-2) */
  temperature?: number

  /** 最大 Token 数 */
  maxTokens?: number

  /** 是否启用流式输出 */
  streaming?: boolean

  /** 系统提示词（插件专用） */
  systemPrompt?: string

  /** 自定义参数 */
  customParams?: Record<string, unknown>
}

/**
 * VCP 运行时配置
 */
export interface VCPRuntimeConfig {
  // 插件目录
  pluginsDir: string

  // 内置插件目录
  builtinPluginsDir?: string

  // 仅原生模式：跳过所有 stdio 类型插件（synchronous/asynchronous）
  // 设置为 true 后，将只加载 builtin_service、service、mcp_bridge 等原生插件
  nativeOnly?: boolean

  // 调试模式
  debugMode: boolean

  // 默认超时（毫秒）
  defaultTimeout: number

  // 最大并发执行数
  maxConcurrent: number

  // 异步任务配置
  async: {
    resultStorePath: string
    maxWaitTime: number
    cleanupInterval: number
  }

  // 回调服务器配置
  callback: {
    enabled: boolean
    port: number
    host: string
  }

  // 日志配置
  logging: {
    enabled: boolean
    level: 'debug' | 'info' | 'warn' | 'error'
    maxEntries: number
  }
}

/**
 * 默认运行时配置
 */
export const DEFAULT_VCP_RUNTIME_CONFIG: VCPRuntimeConfig = {
  pluginsDir: '',
  builtinPluginsDir: '',
  nativeOnly: false, // 启用 stdio 插件支持（synchronous/asynchronous 类型）
  debugMode: false,
  defaultTimeout: 30000,
  maxConcurrent: 5,
  async: {
    resultStorePath: '',
    maxWaitTime: 300000, // 5 分钟
    cleanupInterval: 3600000 // 1 小时
  },
  callback: {
    enabled: true,
    port: 19280,
    host: '127.0.0.1'
  },
  logging: {
    enabled: true,
    level: 'info',
    maxEntries: 1000
  }
}

// ==================== TOOL_REQUEST 解析类型 ====================

/**
 * 解析后的 TOOL_REQUEST
 */
export interface ParsedToolRequest {
  pluginName: string
  params: Record<string, string>
  rawParams: Record<string, string> // 原始 key 保留
  rawText: string
  startIndex: number
  endIndex: number
}

/**
 * TOOL_REQUEST 解析结果
 */
export interface ToolRequestParseResult {
  requests: ParsedToolRequest[]
  hasError: boolean
  errors: string[]
}

// ==================== 事件类型 ====================

/**
 * VCP 运行时事件
 */
export type VCPRuntimeEvent =
  | { type: 'plugin:loaded'; plugin: VCPPlugin }
  | { type: 'plugin:unloaded'; pluginName: string }
  | { type: 'plugin:error'; pluginName: string; error: string }
  | { type: 'tool:start'; request: VCPToolRequest }
  | { type: 'tool:complete'; request: VCPToolRequest; result: VCPToolResult }
  | { type: 'tool:error'; request: VCPToolRequest; error: string }
  | { type: 'async:created'; task: AsyncTask }
  | { type: 'async:completed'; task: AsyncTask }
  | { type: 'async:timeout'; task: AsyncTask }
  | { type: 'placeholder:updated'; placeholder: PlaceholderValue }

/**
 * 事件监听器
 */
export type VCPRuntimeEventListener = (event: VCPRuntimeEvent) => void
