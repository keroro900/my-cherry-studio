/**
 * VCP 分布式服务插件
 *
 * 处理 VCPToolBox 分布式架构中的远程节点连接：
 * - 远程节点注册/注销
 * - 工具列表同步
 * - 远程工具调用路由
 * - 静态占位符同步
 * - 心跳检测
 *
 * 与 VCPToolBox 的 VCPDistributedServer 完全兼容
 */

import { loggerService } from '@logger'
import { v4 as uuidv4 } from 'uuid'

import type { VCPPlugin, VCPPluginWebSocketAPI, WebSocketMessage } from '../types'
import { WebSocketMessageType } from '../types'

const logger = loggerService.withContext('DistributedPlugin')

// ==================== 类型定义 ====================

/**
 * 远程工具定义
 */
export interface RemoteTool {
  name: string
  displayName?: string
  description: string
  parameters?: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
  pluginType?: 'static' | 'dynamic' | 'async' | 'service'
  serverId: string
  serverName?: string
}

/**
 * 分布式服务器信息
 */
export interface DistributedServer {
  id: string
  name: string
  endpoint?: string
  clientId: string
  tools: RemoteTool[]
  staticPlaceholders: Record<string, string>
  registeredAt: Date
  lastHeartbeat: Date
  status: 'online' | 'offline' | 'connecting'
  metadata?: Record<string, unknown>
}

/**
 * 待处理的工具调用
 */
interface PendingToolCall {
  requestId: string
  toolName: string
  serverId: string
  params: Record<string, unknown>
  createdAt: Date
  timeout: NodeJS.Timeout
  resolve: (result: ToolCallResult) => void
  reject: (error: Error) => void
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  success: boolean
  output?: string
  data?: unknown
  error?: string
  executionTimeMs?: number
}

/**
 * 插件配置
 */
export interface DistributedPluginConfig {
  /** 工具调用超时 (毫秒, 默认 60000) */
  toolCallTimeoutMs?: number
  /** 心跳超时 (毫秒, 默认 90000) */
  heartbeatTimeoutMs?: number
  /** 是否广播服务器状态变化 */
  broadcastServerChanges?: boolean
}

// ==================== 主插件类 ====================

/**
 * VCP 分布式服务插件
 */
export class DistributedPlugin implements VCPPlugin {
  readonly id = 'vcp-distributed'
  readonly name = 'VCP Distributed Service Plugin'

  private api: VCPPluginWebSocketAPI | null = null
  private config: Required<DistributedPluginConfig>
  private servers: Map<string, DistributedServer> = new Map()
  private toolIndex: Map<string, string> = new Map() // toolName -> serverId
  private pendingCalls: Map<string, PendingToolCall> = new Map()
  private heartbeatCheckInterval: NodeJS.Timeout | null = null

  constructor(config?: DistributedPluginConfig) {
    this.config = {
      toolCallTimeoutMs: config?.toolCallTimeoutMs ?? 60000,
      heartbeatTimeoutMs: config?.heartbeatTimeoutMs ?? 90000,
      broadcastServerChanges: config?.broadcastServerChanges ?? true
    }
  }

  async initialize(api: VCPPluginWebSocketAPI): Promise<void> {
    this.api = api
    this.startHeartbeatCheck()
    logger.info('VCP Distributed Plugin initialized', {
      toolCallTimeoutMs: this.config.toolCallTimeoutMs,
      heartbeatTimeoutMs: this.config.heartbeatTimeoutMs
    })
  }

  onMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WebSocketMessageType.DISTRIBUTED_REGISTER:
        this.handleRegister(message)
        break
      case WebSocketMessageType.DISTRIBUTED_UNREGISTER:
        this.handleUnregister(message)
        break
      case WebSocketMessageType.DISTRIBUTED_TOOL_LIST:
        this.handleToolListUpdate(message)
        break
      case WebSocketMessageType.DISTRIBUTED_TOOL_RESULT:
        this.handleToolResult(message)
        break
      case WebSocketMessageType.DISTRIBUTED_STATIC_PLACEHOLDERS:
        this.handleStaticPlaceholders(message)
        break
      case WebSocketMessageType.DISTRIBUTED_HEARTBEAT:
        this.handleHeartbeat(message)
        break
    }
  }

  async cleanup(): Promise<void> {
    // 清理心跳检测
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval)
      this.heartbeatCheckInterval = null
    }

    // 清理待处理的调用
    for (const [, pending] of this.pendingCalls) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Plugin shutting down'))
    }
    this.pendingCalls.clear()

    this.servers.clear()
    this.toolIndex.clear()
    this.api = null

    logger.info('VCP Distributed Plugin cleaned up')
  }

  // ==================== 消息处理 ====================

  /**
   * 处理服务器注册
   */
  private handleRegister(message: WebSocketMessage): void {
    const data = message.data as {
      serverId: string
      serverName?: string
      endpoint?: string
      tools?: RemoteTool[]
      metadata?: Record<string, unknown>
    }

    const clientId = message.sourceClientId || 'unknown'
    const serverId = data.serverId || `server_${Date.now()}`

    // 创建或更新服务器记录
    const existing = this.servers.get(serverId)
    const server: DistributedServer = {
      id: serverId,
      name: data.serverName || serverId,
      endpoint: data.endpoint,
      clientId,
      tools: data.tools || [],
      staticPlaceholders: existing?.staticPlaceholders || {},
      registeredAt: existing?.registeredAt || new Date(),
      lastHeartbeat: new Date(),
      status: 'online',
      metadata: data.metadata
    }

    this.servers.set(serverId, server)

    // 更新工具索引
    for (const tool of server.tools) {
      tool.serverId = serverId
      tool.serverName = server.name
      this.toolIndex.set(tool.name, serverId)
    }

    logger.info('Distributed server registered', {
      serverId,
      serverName: server.name,
      toolCount: server.tools.length,
      clientId
    })

    // 发送注册确认
    if (this.api) {
      this.api.sendToClient(clientId, {
        type: WebSocketMessageType.DISTRIBUTED_REGISTER,
        data: {
          success: true,
          serverId,
          message: 'Server registered successfully'
        }
      })
    }

    // 广播服务器上线事件
    this.broadcastServerChange('server_online', server)
  }

  /**
   * 处理服务器注销
   */
  private handleUnregister(message: WebSocketMessage): void {
    const data = message.data as { serverId: string }
    const server = this.servers.get(data.serverId)

    if (!server) {
      logger.warn('Unregister request for unknown server', { serverId: data.serverId })
      return
    }

    // 移除工具索引
    for (const tool of server.tools) {
      this.toolIndex.delete(tool.name)
    }

    this.servers.delete(data.serverId)

    logger.info('Distributed server unregistered', {
      serverId: data.serverId,
      serverName: server.name
    })

    // 广播服务器下线事件
    this.broadcastServerChange('server_offline', server)
  }

  /**
   * 处理工具列表更新
   */
  private handleToolListUpdate(message: WebSocketMessage): void {
    const data = message.data as {
      serverId: string
      tools: RemoteTool[]
    }

    const server = this.servers.get(data.serverId)
    if (!server) {
      logger.warn('Tool list update for unknown server', { serverId: data.serverId })
      return
    }

    // 移除旧工具索引
    for (const tool of server.tools) {
      this.toolIndex.delete(tool.name)
    }

    // 更新工具列表
    server.tools = data.tools || []
    for (const tool of server.tools) {
      tool.serverId = data.serverId
      tool.serverName = server.name
      this.toolIndex.set(tool.name, data.serverId)
    }

    logger.info('Tool list updated', {
      serverId: data.serverId,
      toolCount: server.tools.length
    })

    // 广播工具列表更新
    this.broadcastServerChange('tools_updated', server)
  }

  /**
   * 处理工具执行结果
   */
  private handleToolResult(message: WebSocketMessage): void {
    const data = message.data as {
      requestId: string
      success: boolean
      output?: string
      data?: unknown
      error?: string
      executionTimeMs?: number
    }

    const pending = this.pendingCalls.get(data.requestId)
    if (!pending) {
      logger.warn('Tool result for unknown request', { requestId: data.requestId })
      return
    }

    // 清理超时定时器
    clearTimeout(pending.timeout)
    this.pendingCalls.delete(data.requestId)

    // 返回结果
    pending.resolve({
      success: data.success,
      output: data.output,
      data: data.data,
      error: data.error,
      executionTimeMs: data.executionTimeMs
    })

    logger.debug('Tool result received', {
      requestId: data.requestId,
      toolName: pending.toolName,
      success: data.success
    })
  }

  /**
   * 处理静态占位符更新
   */
  private handleStaticPlaceholders(message: WebSocketMessage): void {
    const data = message.data as {
      serverId: string
      placeholders: Record<string, string>
    }

    const server = this.servers.get(data.serverId)
    if (!server) {
      logger.warn('Static placeholders for unknown server', { serverId: data.serverId })
      return
    }

    server.staticPlaceholders = data.placeholders || {}

    logger.debug('Static placeholders updated', {
      serverId: data.serverId,
      placeholderCount: Object.keys(server.staticPlaceholders).length
    })
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(message: WebSocketMessage): void {
    const data = message.data as { serverId: string }
    const server = this.servers.get(data.serverId)

    if (server) {
      server.lastHeartbeat = new Date()
      server.status = 'online'
    }
  }

  // ==================== 公共 API ====================

  /**
   * 调用远程工具
   */
  async callRemoteTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const serverId = this.toolIndex.get(toolName)
    if (!serverId) {
      return {
        success: false,
        error: `Tool '${toolName}' not found on any distributed server`
      }
    }

    const server = this.servers.get(serverId)
    if (!server || server.status !== 'online') {
      return {
        success: false,
        error: `Server '${serverId}' is not available`
      }
    }

    if (!this.api) {
      return {
        success: false,
        error: 'WebSocket API not available'
      }
    }

    const requestId = uuidv4()

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(requestId)
        resolve({
          success: false,
          error: `Tool call timeout after ${this.config.toolCallTimeoutMs}ms`
        })
      }, this.config.toolCallTimeoutMs)

      // 记录待处理调用
      this.pendingCalls.set(requestId, {
        requestId,
        toolName,
        serverId,
        params,
        createdAt: new Date(),
        timeout,
        resolve,
        reject
      })

      // 发送工具调用请求到目标服务器
      this.api!.sendToClient(server.clientId, {
        type: WebSocketMessageType.DISTRIBUTED_TOOL_CALL,
        data: {
          requestId,
          toolName,
          params
        }
      })

      logger.debug('Remote tool call sent', {
        requestId,
        toolName,
        serverId,
        serverName: server.name
      })
    })
  }

  /**
   * 检查工具是否为远程工具
   */
  isRemoteTool(toolName: string): boolean {
    return this.toolIndex.has(toolName)
  }

  /**
   * 获取远程工具所在的服务器 ID
   */
  getToolServerId(toolName: string): string | undefined {
    return this.toolIndex.get(toolName)
  }

  /**
   * 获取所有远程工具
   */
  getAllRemoteTools(): RemoteTool[] {
    const tools: RemoteTool[] = []
    for (const server of this.servers.values()) {
      if (server.status === 'online') {
        tools.push(...server.tools)
      }
    }
    return tools
  }

  /**
   * 获取所有分布式服务器
   */
  getAllServers(): DistributedServer[] {
    return Array.from(this.servers.values())
  }

  /**
   * 获取服务器信息
   */
  getServer(serverId: string): DistributedServer | undefined {
    return this.servers.get(serverId)
  }

  /**
   * 获取所有静态占位符 (合并所有服务器)
   */
  getAllStaticPlaceholders(): Record<string, string> {
    const placeholders: Record<string, string> = {}
    for (const server of this.servers.values()) {
      if (server.status === 'online') {
        Object.assign(placeholders, server.staticPlaceholders)
      }
    }
    return placeholders
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    serverCount: number
    onlineServerCount: number
    totalToolCount: number
    pendingCallCount: number
  } {
    const onlineServers = Array.from(this.servers.values()).filter((s) => s.status === 'online')
    return {
      serverCount: this.servers.size,
      onlineServerCount: onlineServers.length,
      totalToolCount: this.toolIndex.size,
      pendingCallCount: this.pendingCalls.size
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 启动心跳检测
   */
  private startHeartbeatCheck(): void {
    this.heartbeatCheckInterval = setInterval(() => {
      const now = Date.now()

      for (const [serverId, server] of this.servers) {
        const timeSinceHeartbeat = now - server.lastHeartbeat.getTime()

        if (timeSinceHeartbeat > this.config.heartbeatTimeoutMs) {
          if (server.status === 'online') {
            server.status = 'offline'
            logger.warn('Distributed server heartbeat timeout', {
              serverId,
              serverName: server.name,
              lastHeartbeat: server.lastHeartbeat.toISOString()
            })
            this.broadcastServerChange('server_timeout', server)
          }
        }
      }
    }, 30000) // 每 30 秒检查一次
  }

  /**
   * 广播服务器状态变化
   */
  private broadcastServerChange(
    event: 'server_online' | 'server_offline' | 'server_timeout' | 'tools_updated',
    server: DistributedServer
  ): void {
    if (!this.config.broadcastServerChanges || !this.api) return

    this.api.broadcast({
      type: WebSocketMessageType.STATUS_UPDATE,
      data: {
        statusType: 'distributed_server',
        value: {
          event,
          serverId: server.id,
          serverName: server.name,
          status: server.status,
          toolCount: server.tools.length
        }
      }
    })
  }
}

// ==================== 便捷函数 ====================

let distributedPluginInstance: DistributedPlugin | null = null

/**
 * 创建分布式服务插件实例
 */
export function createDistributedPlugin(config?: DistributedPluginConfig): DistributedPlugin {
  distributedPluginInstance = new DistributedPlugin(config)
  return distributedPluginInstance
}

/**
 * 获取分布式服务插件实例
 */
export function getDistributedPlugin(): DistributedPlugin | null {
  return distributedPluginInstance
}
