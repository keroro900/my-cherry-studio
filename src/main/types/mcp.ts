/**
 * MCP 服务主进程类型定义
 *
 * 提供完整的类型定义，避免 `as any` 使用
 *
 * @module main/types/mcp
 */

import type { Tool as SDKTool } from '@modelcontextprotocol/sdk/types.js'
import type { MCPCallToolResponse, MCPPrompt, MCPResource, MCPServer, MCPTool } from '@types'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'

// ==================== 传输层类型 ====================

/**
 * MCP 传输类型
 */
export type MCPTransportType = 'stdio' | 'sse' | 'streamableHttp' | 'inMemory'

/**
 * 传输层配置
 */
export interface MCPTransportConfig {
  type: MCPTransportType
  /** stdio 命令 */
  command?: string
  /** 命令参数 */
  args?: string[]
  /** 环境变量 */
  env?: Record<string, string>
  /** HTTP/SSE URL */
  baseUrl?: string
  /** HTTP 请求头 */
  headers?: Record<string, string>
}

// ==================== 客户端管理类型 ====================

/**
 * 客户端连接状态
 */
export type ClientConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * 客户端信息
 */
export interface ClientInfo {
  /** 客户端实例 */
  client: Client
  /** 连接状态 */
  state: ClientConnectionState
  /** 服务器配置快照 */
  serverSnapshot: MCPServer
  /** 连接时间 */
  connectedAt?: number
  /** 最后活动时间 */
  lastActiveAt?: number
  /** 错误信息 */
  lastError?: string
}

// ==================== 工具调用类型 ====================

/**
 * 工具调用参数
 */
export interface CallToolArgs {
  /** 目标服务器 */
  server: MCPServer
  /** 工具名称 */
  name: string
  /** 工具参数 */
  args: Record<string, unknown>
  /** 调用 ID (可选) */
  callId?: string
}

/**
 * 工具调用进度
 */
export interface ToolCallProgress {
  /** 调用 ID */
  callId: string
  /** 当前进度 */
  progress: number
  /** 总进度 */
  total?: number
  /** 状态消息 */
  message?: string
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  /** 是否成功 */
  success: boolean
  /** 响应内容 */
  response?: MCPCallToolResponse
  /** 错误信息 */
  error?: string
  /** 执行时长 (ms) */
  duration?: number
}

// ==================== 提示词类型 ====================

/**
 * 获取提示词参数
 */
export interface GetPromptArgs {
  /** 目标服务器 */
  server: MCPServer
  /** 提示词名称 */
  name: string
  /** 提示词参数 */
  args?: Record<string, unknown>
}

// ==================== 资源类型 ====================

/**
 * 获取资源参数
 */
export interface GetResourceArgs {
  /** 目标服务器 */
  server: MCPServer
  /** 资源 URI */
  uri: string
}

// ==================== 服务器管理类型 ====================

/**
 * 服务器健康检查结果
 */
export interface ServerHealthCheck {
  /** 是否健康 */
  healthy: boolean
  /** 响应时间 (ms) */
  latency?: number
  /** 服务器版本 */
  version?: string
  /** 可用工具数量 */
  toolCount?: number
  /** 错误信息 */
  error?: string
}

/**
 * 服务器安装信息
 */
export interface ServerInstallInfo {
  /** 安装目录 */
  dir: string
  /** uv 路径 */
  uvPath: string
  /** bun 路径 */
  bunPath: string
}

// ==================== SDK 类型适配 ====================

/**
 * SDK 工具定义转换为 MCPTool
 */
export function sdkToolToMCPTool(
  tool: SDKTool,
  server: MCPServer,
  buildToolId: (serverName: string, toolName: string, serverId: string) => string
): MCPTool {
  return {
    ...tool,
    id: buildToolId(server.name, tool.name, server.id),
    serverId: server.id,
    serverName: server.name,
    type: 'mcp',
    inputSchema: tool.inputSchema as MCPTool['inputSchema'],
    outputSchema: tool.outputSchema as MCPTool['outputSchema']
  }
}

/**
 * SDK 提示词转换为 MCPPrompt
 */
export function sdkPromptToMCPPrompt(
  prompt: { name: string; description?: string; arguments?: unknown[] },
  server: MCPServer,
  generateId: () => string
): MCPPrompt {
  return {
    ...prompt,
    id: generateId(),
    serverId: server.id,
    serverName: server.name
  } as MCPPrompt
}

/**
 * SDK 资源转换为 MCPResource
 */
export function sdkResourceToMCPResource(
  resource: { uri: string; name: string; description?: string; mimeType?: string },
  server: MCPServer,
  generateId: () => string
): MCPResource {
  return {
    ...resource,
    id: generateId(),
    serverId: server.id,
    serverName: server.name
  } as MCPResource
}

// ==================== 缓存类型 ====================

/**
 * 缓存键生成器
 */
export interface CacheKeyGenerator {
  /** 生成工具列表缓存键 */
  listTools: (server: MCPServer) => string
  /** 生成提示词列表缓存键 */
  listPrompts: (server: MCPServer) => string
  /** 生成资源列表缓存键 */
  listResources: (server: MCPServer) => string
  /** 生成单个提示词缓存键 */
  getPrompt: (server: MCPServer, name: string, args?: Record<string, unknown>) => string
  /** 生成单个资源缓存键 */
  getResource: (server: MCPServer, uri: string) => string
}

/**
 * 缓存 TTL 配置 (毫秒)
 */
export const CACHE_TTL = {
  /** 工具列表 - 5分钟 */
  LIST_TOOLS: 5 * 60 * 1000,
  /** 提示词列表 - 60分钟 */
  LIST_PROMPTS: 60 * 60 * 1000,
  /** 单个提示词 - 30分钟 */
  GET_PROMPT: 30 * 60 * 1000,
  /** 资源列表 - 60分钟 */
  LIST_RESOURCES: 60 * 60 * 1000,
  /** 单个资源 - 30分钟 */
  GET_RESOURCE: 30 * 60 * 1000
} as const

// ==================== 日志类型 ====================

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * 日志来源
 */
export type LogSource = 'client' | 'server' | 'transport' | 'connectivity' | 'tool'

/**
 * 基础服务器日志条目
 */
export interface MCPServerLogEntry {
  /** 服务器 ID */
  serverId: string
  /** 服务器名称 */
  serverName?: string
  /** 日志级别 */
  level: LogLevel
  /** 日志消息 */
  message: string
  /** 时间戳 */
  timestamp: number
}

/**
 * 扩展的服务器日志条目
 */
export interface ExtendedServerLogEntry extends MCPServerLogEntry {
  /** 日志来源 */
  source: LogSource
  /** 额外数据 */
  data?: Record<string, unknown>
}

// ==================== 事件类型 ====================

/**
 * MCP 服务事件类型
 */
export type MCPServiceEvent =
  | 'server:connected'
  | 'server:disconnected'
  | 'server:error'
  | 'tool:called'
  | 'tool:completed'
  | 'tool:error'
  | 'tool:progress'
  | 'cache:invalidated'

/**
 * MCP 服务事件数据
 */
export interface MCPServiceEventData {
  'server:connected': { server: MCPServer; version?: string }
  'server:disconnected': { server: MCPServer; reason?: string }
  'server:error': { server: MCPServer; error: Error }
  'tool:called': { server: MCPServer; toolName: string; callId: string }
  'tool:completed': { server: MCPServer; toolName: string; callId: string; duration: number }
  'tool:error': { server: MCPServer; toolName: string; callId: string; error: Error }
  'tool:progress': { server: MCPServer; toolName: string; callId: string; progress: number }
  'cache:invalidated': { server: MCPServer; keys: string[] }
}

// ==================== 配置类型 ====================

/**
 * MCP 服务配置
 */
export interface MCPServiceConfig {
  /** 默认超时时间 (ms) */
  defaultTimeout: number
  /** 长时运行任务超时 (ms) */
  longRunningTimeout: number
  /** OAuth 回调端口 */
  oauthCallbackPort: number
  /** 是否启用缓存 */
  enableCache: boolean
  /** 连接重试次数 */
  maxRetries: number
  /** 重试间隔 (ms) */
  retryInterval: number
}

/**
 * 默认 MCP 服务配置
 */
export const DEFAULT_MCP_SERVICE_CONFIG: MCPServiceConfig = {
  defaultTimeout: 60000,
  longRunningTimeout: 600000,
  oauthCallbackPort: 12346,
  enableCache: true,
  maxRetries: 3,
  retryInterval: 1000
}

// ==================== 验证类型 ====================

/**
 * 验证 MCP 服务器配置是否有效
 */
export function isValidServerConfig(server: MCPServer): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!server.id) {
    errors.push('Server ID is required')
  }

  if (!server.name) {
    errors.push('Server name is required')
  }

  const hasBaseUrl = !!server.baseUrl
  const hasCommand = !!server.command
  const isInMemory = server.type === 'inMemory'

  if (!hasBaseUrl && !hasCommand && !isInMemory) {
    errors.push('Either baseUrl or command must be provided (unless type is inMemory)')
  }

  if (hasBaseUrl && hasCommand) {
    errors.push('Cannot specify both baseUrl and command')
  }

  if (server.timeout !== undefined && (server.timeout < 0 || server.timeout > 3600)) {
    errors.push('Timeout must be between 0 and 3600 seconds')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ==================== 辅助类型 ====================

/**
 * 带服务器信息的回调类型
 */
export type WithServerCallback<T> = (server: MCPServer) => Promise<T>

/**
 * IPC 处理器类型
 */
export type IPCHandler<TArgs extends unknown[], TResult> = (
  event: Electron.IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TResult>

/**
 * 创建 IPC 处理器包装
 */
export function createIPCHandler<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>
): IPCHandler<TArgs, TResult> {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: TArgs) => {
    return handler(...args)
  }
}
