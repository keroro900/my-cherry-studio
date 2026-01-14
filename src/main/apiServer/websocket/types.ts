/**
 * WebSocket 通信类型定义
 *
 * 定义统一的 WebSocket 消息协议，支持:
 * - 客户端类型路由
 * - VCP 插件集成
 * - 双向实时通信
 */

/**
 * 客户端类型
 * 用于消息路由和权限控制
 */
export enum WebSocketClientType {
  /** VCP 主服务 */
  VCP_MAIN = 'vcp_main',
  /** VCP 插件客户端 */
  VCP_PLUGIN = 'vcp_plugin',
  /** MCP 客户端 */
  MCP_CLIENT = 'mcp_client',
  /** Web UI 客户端 */
  WEB_UI = 'web_ui',
  /** 外部集成客户端 */
  EXTERNAL = 'external',
  /** 未知类型 */
  UNKNOWN = 'unknown',

  // ==================== VCPToolBox 分布式架构扩展 ====================

  /** 分布式服务器 - 远程 VCP 节点 */
  DISTRIBUTED_SERVER = 'distributed_server',
  /** Chrome 控制客户端 - Puppeteer 浏览器控制 */
  CHROME_CONTROL = 'chrome_control',
  /** Chrome 观察者 - 页面状态监控 */
  CHROME_OBSERVER = 'chrome_observer',
  /** 管理面板 - Admin Panel */
  ADMIN_PANEL = 'admin_panel',
  /** Python Sidecar - 音频引擎等 */
  PYTHON_SIDECAR = 'python_sidecar',
  /** Canvas 协作客户端 */
  CANVAS_CLIENT = 'canvas_client'
}

/**
 * WebSocket 消息类型
 */
export enum WebSocketMessageType {
  // 连接管理
  AUTH = 'auth',
  AUTH_RESPONSE = 'auth_response',
  PING = 'ping',
  PONG = 'pong',

  // 日志推送
  LOG = 'log',
  LOG_BATCH = 'log_batch',

  // AI 消息
  AI_MESSAGE = 'ai_message',
  AI_MESSAGE_STREAM = 'ai_message_stream',
  AI_MESSAGE_COMPLETE = 'ai_message_complete',

  // 状态更新
  STATUS_UPDATE = 'status_update',
  PROGRESS_UPDATE = 'progress_update',

  // Agent 相关
  AGENT_INVOKE = 'agent_invoke',
  AGENT_INVOKE_RESULT = 'agent_invoke_result',
  AGENT_STATUS = 'agent_status',

  // VCP 工具请求
  VCP_TOOL_REQUEST = 'vcp_tool_request',
  VCP_TOOL_RESULT = 'vcp_tool_result',

  // VCP Info (类似 VCPToolBox 的 /vcpinfo/ 通道)
  VCP_INFO = 'vcp_info',
  VCP_INFO_BATCH = 'vcp_info_batch',

  // MCP 相关
  MCP_TOOL_CALL = 'mcp_tool_call',
  MCP_TOOL_RESULT = 'mcp_tool_result',

  // 系统消息
  SYSTEM = 'system',
  ERROR = 'error',

  // 订阅管理
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',

  // 自定义消息
  CUSTOM = 'custom',

  // ==================== VCPToolBox 分布式架构扩展 ====================

  // 分布式服务器消息
  DISTRIBUTED_REGISTER = 'distributed_register',
  DISTRIBUTED_UNREGISTER = 'distributed_unregister',
  DISTRIBUTED_TOOL_LIST = 'distributed_tool_list',
  DISTRIBUTED_TOOL_CALL = 'distributed_tool_call',
  DISTRIBUTED_TOOL_RESULT = 'distributed_tool_result',
  DISTRIBUTED_STATIC_PLACEHOLDERS = 'distributed_static_placeholders',
  DISTRIBUTED_HEARTBEAT = 'distributed_heartbeat',

  // Chrome 控制消息
  CHROME_COMMAND = 'chrome_command',
  CHROME_RESULT = 'chrome_result',
  CHROME_PAGE_INFO = 'chrome_page_info',
  CHROME_SCREENSHOT = 'chrome_screenshot',

  // Canvas 协作消息
  CANVAS_SYNC = 'canvas_sync',
  CANVAS_UPDATE = 'canvas_update',
  CANVAS_CURSOR = 'canvas_cursor',
  CANVAS_SELECTION = 'canvas_selection',

  // 插件管理消息
  PLUGIN_REGISTERED = 'plugin_registered',
  PLUGIN_UNREGISTERED = 'plugin_unregistered',
  PLUGIN_ENABLED = 'plugin_enabled',
  PLUGIN_DISABLED = 'plugin_disabled',
  PLUGINS_RELOADED = 'plugins_reloaded',

  // Admin Panel 消息
  ADMIN_NOTIFICATION = 'admin_notification',
  ADMIN_COMMAND = 'admin_command',
  ADMIN_RESPONSE = 'admin_response'
}

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * 基础 WebSocket 消息
 */
export interface WebSocketMessage<T = unknown> {
  /** 消息类型 */
  type: WebSocketMessageType
  /** 消息 ID */
  id?: string
  /** 消息时间戳 */
  timestamp: number
  /** 消息数据 */
  data: T
  /** 目标客户端类型 (用于定向广播) */
  targetClientTypes?: WebSocketClientType[]
  /** 来源客户端 ID */
  sourceClientId?: string
}

/**
 * 认证请求数据
 */
export interface AuthRequestData {
  /** API Key */
  apiKey: string
  /** 客户端类型 */
  clientType: WebSocketClientType
  /** 客户端名称 */
  clientName?: string
  /** 客户端版本 */
  clientVersion?: string
  /** 订阅的消息类型 */
  subscriptions?: WebSocketMessageType[]
}

/**
 * 认证响应数据
 */
export interface AuthResponseData {
  /** 是否成功 */
  success: boolean
  /** 分配的客户端 ID */
  clientId?: string
  /** 错误信息 */
  error?: string
  /** 服务器版本 */
  serverVersion?: string
}

/**
 * 日志消息数据
 */
export interface LogMessageData {
  /** 日志级别 */
  level: LogLevel
  /** 日志消息 */
  message: string
  /** 上下文 */
  context?: string
  /** 额外数据 */
  meta?: Record<string, unknown>
}

/**
 * AI 消息数据
 */
export interface AIMessageData {
  /** 会话 ID */
  sessionId: string
  /** 消息 ID */
  messageId: string
  /** 角色 */
  role: 'user' | 'assistant' | 'system'
  /** 内容 */
  content: string
  /** 是否为流式片段 */
  isStreaming?: boolean
  /** 模型 ID */
  modelId?: string
  /** Token 使用 */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/**
 * 状态更新数据
 */
export interface StatusUpdateData {
  /** 状态类型 */
  statusType: string
  /** 状态值 */
  value: unknown
  /** 描述 */
  description?: string
}

/**
 * 进度更新数据
 */
export interface ProgressUpdateData {
  /** 任务 ID */
  taskId: string
  /** 当前进度 (0-100) */
  progress: number
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 描述 */
  description?: string
  /** 预计剩余时间 (毫秒) */
  estimatedTimeMs?: number
}

/**
 * Agent 调用请求数据
 */
export interface AgentInvokeRequestData {
  /** 目标 Agent ID */
  targetAgentId: string
  /** 提示词 */
  prompt: string
  /** 调用模式 */
  mode: 'sync' | 'async'
  /** 调用者 Agent ID */
  callerAgentId?: string
  /** 会话 ID */
  sessionId?: string
  /** 超时时间 */
  timeout?: number
  /** 是否包含系统提示词 */
  includeSystemPrompt?: boolean
}

/**
 * Agent 调用结果数据
 */
export interface AgentInvokeResultData {
  /** 请求 ID */
  requestId: string
  /** 状态 */
  status: 'success' | 'error' | 'pending' | 'running'
  /** 响应内容 */
  response?: string
  /** 错误信息 */
  error?: string
  /** 执行时间 */
  executionTimeMs?: number
  /** Token 使用 */
  usage?: {
    promptTokens?: number
    completionTokens?: number
  }
}

/**
 * VCP 工具请求数据
 */
export interface VCPToolRequestData {
  /** 工具名称 */
  toolName: string
  /** 参数 */
  params: Record<string, string>
  /** 请求 ID */
  requestId: string
}

/**
 * VCP 工具结果数据
 */
export interface VCPToolResultData {
  /** 请求 ID */
  requestId: string
  /** 是否成功 */
  success: boolean
  /** 结果 */
  result?: unknown
  /** 错误 */
  error?: string
}

/**
 * 订阅请求数据
 */
export interface SubscribeRequestData {
  /** 要订阅的消息类型 */
  messageTypes: WebSocketMessageType[]
}

/**
 * 错误数据
 */
export interface ErrorData {
  /** 错误码 */
  code: string
  /** 错误信息 */
  message: string
  /** 详细信息 */
  details?: unknown
}

/**
 * WebSocket 客户端信息
 */
export interface WebSocketClientInfo {
  /** 客户端 ID */
  id: string
  /** 客户端类型 */
  type: WebSocketClientType
  /** 客户端名称 */
  name?: string
  /** 客户端版本 */
  version?: string
  /** 连接时间 */
  connectedAt: Date
  /** 最后活动时间 */
  lastActiveAt: Date
  /** 是否已认证 */
  isAuthenticated: boolean
  /** 订阅的消息类型 */
  subscriptions: Set<WebSocketMessageType>
}

/**
 * WebSocket 服务配置
 */
export interface WebSocketServerConfig {
  /** 心跳间隔 (毫秒) */
  heartbeatIntervalMs?: number
  /** 心跳超时 (毫秒) */
  heartbeatTimeoutMs?: number
  /** 认证超时 (毫秒) */
  authTimeoutMs?: number
  /** 最大消息大小 (字节) */
  maxPayloadSize?: number
  /** 是否需要认证 */
  requireAuth?: boolean
}

/**
 * VCP 插件接口
 * 插件可以通过此接口与 WebSocket 服务集成
 */
export interface VCPPlugin {
  /** 插件 ID */
  id: string
  /** 插件名称 */
  name: string
  /** 初始化 */
  initialize?(ws: VCPPluginWebSocketAPI): Promise<void>
  /** 处理消息 */
  onMessage?(message: WebSocketMessage): void
  /** 清理 */
  cleanup?(): Promise<void>
}

/**
 * 提供给 VCP 插件的 WebSocket API
 */
export interface VCPPluginWebSocketAPI {
  /** 广播消息到所有客户端 */
  broadcast(message: Omit<WebSocketMessage, 'timestamp'>): void
  /** 发送消息到特定客户端类型 */
  sendToClientType(clientType: WebSocketClientType, message: Omit<WebSocketMessage, 'timestamp'>): void
  /** 发送消息到特定客户端 */
  sendToClient(clientId: string, message: Omit<WebSocketMessage, 'timestamp'>): void
  /** 推送日志 */
  pushLog(level: LogLevel, message: string, context?: string, meta?: Record<string, unknown>): void
  /** 推送进度更新 */
  pushProgress(taskId: string, progress: number, status: ProgressUpdateData['status'], description?: string): void
  /** 推送状态更新 */
  pushStatus(statusType: string, value: unknown, description?: string): void
}

/**
 * Canvas 同步数据
 */
export interface CanvasSyncData {
  /** 文件路径 */
  filePath: string
  /** 文件内容 */
  content: string
  /** 内容哈希 */
  hash: string
  /** 版本号 */
  version: number
}

/**
 * Canvas 更新数据 (增量)
 */
export interface CanvasUpdateData {
  /** 文件路径 */
  filePath: string
  /** 变更操作 */
  changes: CanvasChangeOperation[]
  /** 版本号 */
  fromVersion: number
  /** 目标版本号 */
  toVersion: number
  /** 客户端 ID */
  clientId: string
}

/**
 * Canvas 变更操作
 */
export interface CanvasChangeOperation {
  /** 操作类型 */
  type: 'insert' | 'delete' | 'replace'
  /** 起始位置 */
  from: number
  /** 结束位置 */
  to?: number
  /** 插入的文本 */
  text?: string
}

/**
 * Canvas 光标数据
 */
export interface CanvasCursorData {
  /** 文件路径 */
  filePath: string
  /** 客户端 ID */
  clientId: string
  /** 客户端名称 */
  clientName?: string
  /** 光标位置 */
  position: number
  /** 光标颜色 */
  color?: string
}

/**
 * Canvas 选区数据
 */
export interface CanvasSelectionData {
  /** 文件路径 */
  filePath: string
  /** 客户端 ID */
  clientId: string
  /** 选区起始 */
  anchor: number
  /** 选区结束 */
  head: number
}
