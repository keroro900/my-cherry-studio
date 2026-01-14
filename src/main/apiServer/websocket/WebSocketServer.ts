/**
 * 统一 WebSocket 通信服务
 *
 * 设计哲学:
 * 1. 提供集中的 WebSocket 服务，用于服务器与客户端之间的双向实时通信
 * 2. 支持插件集成，允许 VCPLog、同步插件等无需实现自己的 WebSocket 服务器
 * 3. 支持客户端类型路由，允许针对特定类型的客户端进行定向广播
 * 4. 作为 VCP 分布式网络的核心通信骨干
 *
 * 集成方式:
 * - 附加到现有的 HTTP Server (与 Express API Server 共享端口)
 * - 通过 /ws 路径提供 WebSocket 连接
 */

import type { IncomingMessage, Server as HttpServer } from 'node:http'

import { loggerService } from '@logger'
import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer as WSServer } from 'ws'

import { config } from '../config'
import type {
  AuthRequestData,
  AuthResponseData,
  ErrorData,
  LogLevel,
  LogMessageData,
  ProgressUpdateData,
  StatusUpdateData,
  VCPPlugin,
  VCPPluginWebSocketAPI,
  WebSocketClientInfo,
  WebSocketMessage,
  WebSocketServerConfig
} from './types'
import { WebSocketClientType, WebSocketMessageType } from './types'

const logger = loggerService.withContext('WebSocketServer')

/** 默认配置 */
const DEFAULT_CONFIG: Required<WebSocketServerConfig> = {
  heartbeatIntervalMs: 30000,
  heartbeatTimeoutMs: 60000,
  authTimeoutMs: 10000,
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  requireAuth: true
}

/**
 * 扩展 WebSocket 类型，添加客户端信息
 */
interface ExtendedWebSocket extends WebSocket {
  clientInfo?: WebSocketClientInfo
  isAlive?: boolean
  authTimer?: NodeJS.Timeout
}

/**
 * 统一 WebSocket 服务器
 */
export class UnifiedWebSocketServer {
  private wss: WSServer | null = null
  private clients: Map<string, ExtendedWebSocket> = new Map()
  private plugins: Map<string, VCPPlugin> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private config: Required<WebSocketServerConfig>
  private messageHandlers: Map<WebSocketMessageType, ((ws: ExtendedWebSocket, message: WebSocketMessage) => void)[]> =
    new Map()

  constructor(config?: WebSocketServerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 附加到现有 HTTP 服务器
   */
  attach(server: HttpServer): void {
    if (this.wss) {
      logger.warn('WebSocket server already attached')
      return
    }

    this.wss = new WSServer({
      server,
      path: '/ws',
      maxPayload: this.config.maxPayloadSize
    })

    this.setupEventHandlers()
    this.startHeartbeat()

    logger.info('WebSocket server attached to HTTP server', {
      path: '/ws',
      requireAuth: this.config.requireAuth
    })
  }

  /**
   * 创建独立的 WebSocket 服务器
   */
  async startStandalone(port: number, host: string = '0.0.0.0'): Promise<void> {
    if (this.wss) {
      logger.warn('WebSocket server already running')
      return
    }

    this.wss = new WSServer({
      port,
      host,
      maxPayload: this.config.maxPayloadSize
    })

    this.setupEventHandlers()
    this.startHeartbeat()

    logger.info('Standalone WebSocket server started', { host, port })
  }

  /**
   * 关闭 WebSocket 服务器
   */
  async close(): Promise<void> {
    // 停止心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // 清理插件
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.cleanup?.()
      } catch (error) {
        logger.error('Plugin cleanup failed', { pluginId: plugin.id, error: String(error) })
      }
    }
    this.plugins.clear()

    // 关闭所有连接
    for (const [, ws] of this.clients) {
      if (ws.authTimer) {
        clearTimeout(ws.authTimer)
      }
      ws.close(1000, 'Server shutting down')
    }
    this.clients.clear()

    // 关闭服务器
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          this.wss = null
          logger.info('WebSocket server closed')
          resolve()
        })
      })
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.wss) return

    this.wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req)
    })

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: String(error) })
    })

    // 注册内置消息处理器
    this.registerMessageHandler(
      WebSocketMessageType.AUTH,
      this.handleAuth.bind(this) as (ws: ExtendedWebSocket, message: WebSocketMessage) => void
    )
    this.registerMessageHandler(WebSocketMessageType.PING, this.handlePing.bind(this))
    this.registerMessageHandler(
      WebSocketMessageType.SUBSCRIBE,
      this.handleSubscribe.bind(this) as (ws: ExtendedWebSocket, message: WebSocketMessage) => void
    )
    this.registerMessageHandler(
      WebSocketMessageType.UNSUBSCRIBE,
      this.handleUnsubscribe.bind(this) as (ws: ExtendedWebSocket, message: WebSocketMessage) => void
    )
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: ExtendedWebSocket, req: IncomingMessage): void {
    const clientId = uuidv4()
    const clientIp = req.socket.remoteAddress || 'unknown'

    logger.info('New WebSocket connection', { clientId, clientIp })

    // 初始化客户端信息
    ws.clientInfo = {
      id: clientId,
      type: WebSocketClientType.UNKNOWN,
      connectedAt: new Date(),
      lastActiveAt: new Date(),
      isAuthenticated: !this.config.requireAuth, // 如果不需要认证，直接标记为已认证
      subscriptions: new Set()
    }
    ws.isAlive = true

    this.clients.set(clientId, ws)

    // 设置认证超时
    if (this.config.requireAuth) {
      ws.authTimer = setTimeout(() => {
        if (ws.clientInfo && !ws.clientInfo.isAuthenticated) {
          logger.warn('Client authentication timeout', { clientId })
          this.sendError(ws, 'AUTH_TIMEOUT', 'Authentication timeout')
          ws.close(4001, 'Authentication timeout')
        }
      }, this.config.authTimeoutMs)
    }

    // 消息处理
    ws.on('message', (data) => {
      this.handleMessage(ws, data)
    })

    // 关闭处理
    ws.on('close', (code, reason) => {
      this.handleClose(ws, code, reason.toString())
    })

    // 错误处理
    ws.on('error', (error) => {
      logger.error('WebSocket client error', { clientId, error: String(error) })
    })

    // Pong 处理 (心跳响应)
    ws.on('pong', () => {
      ws.isAlive = true
      if (ws.clientInfo) {
        ws.clientInfo.lastActiveAt = new Date()
      }
    })

    // 发送欢迎消息
    this.sendMessage(ws, {
      type: WebSocketMessageType.SYSTEM,
      data: {
        message: 'Connected to Cherry Studio WebSocket Server',
        clientId,
        requireAuth: this.config.requireAuth
      }
    })
  }

  /**
   * 处理消息
   */
  private handleMessage(ws: ExtendedWebSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage

      // 更新最后活动时间
      if (ws.clientInfo) {
        ws.clientInfo.lastActiveAt = new Date()
      }

      // 检查认证状态
      if (
        this.config.requireAuth &&
        !ws.clientInfo?.isAuthenticated &&
        message.type !== WebSocketMessageType.AUTH &&
        message.type !== WebSocketMessageType.PING
      ) {
        this.sendError(ws, 'NOT_AUTHENTICATED', 'Authentication required')
        return
      }

      // 调用消息处理器
      const handlers = this.messageHandlers.get(message.type)
      if (handlers) {
        for (const handler of handlers) {
          handler(ws, message)
        }
      }

      // 通知插件
      for (const plugin of this.plugins.values()) {
        try {
          plugin.onMessage?.(message)
        } catch (error) {
          logger.error('Plugin message handler error', { pluginId: plugin.id, error: String(error) })
        }
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', { error: String(error) })
      this.sendError(ws, 'INVALID_MESSAGE', 'Invalid message format')
    }
  }

  /**
   * 处理认证
   */
  private async handleAuth(ws: ExtendedWebSocket, message: WebSocketMessage<AuthRequestData>): Promise<void> {
    const { apiKey, clientType, clientName, clientVersion, subscriptions } = message.data

    // 清除认证超时
    if (ws.authTimer) {
      clearTimeout(ws.authTimer)
      ws.authTimer = undefined
    }

    // 验证 API Key
    const serverConfig = await config.load()
    const isValid = apiKey === serverConfig.apiKey

    if (!isValid) {
      logger.warn('Authentication failed', { clientId: ws.clientInfo?.id })
      const response: AuthResponseData = {
        success: false,
        error: 'Invalid API key'
      }
      this.sendMessage(ws, {
        type: WebSocketMessageType.AUTH_RESPONSE,
        data: response
      })
      ws.close(4003, 'Authentication failed')
      return
    }

    // 更新客户端信息
    if (ws.clientInfo) {
      ws.clientInfo.isAuthenticated = true
      ws.clientInfo.type = clientType || WebSocketClientType.EXTERNAL
      ws.clientInfo.name = clientName
      ws.clientInfo.version = clientVersion

      // 设置订阅
      if (subscriptions) {
        for (const sub of subscriptions) {
          ws.clientInfo.subscriptions.add(sub)
        }
      }
    }

    logger.info('Client authenticated', {
      clientId: ws.clientInfo?.id,
      clientType: ws.clientInfo?.type,
      clientName
    })

    const response: AuthResponseData = {
      success: true,
      clientId: ws.clientInfo?.id,
      serverVersion: process.env.npm_package_version || '1.0.0'
    }
    this.sendMessage(ws, {
      type: WebSocketMessageType.AUTH_RESPONSE,
      data: response
    })
  }

  /**
   * 处理 Ping
   */
  private handlePing(ws: ExtendedWebSocket, message: WebSocketMessage): void {
    this.sendMessage(ws, {
      type: WebSocketMessageType.PONG,
      data: { originalId: message.id }
    })
  }

  /**
   * 处理订阅
   */
  private handleSubscribe(
    ws: ExtendedWebSocket,
    message: WebSocketMessage<{ messageTypes: WebSocketMessageType[] }>
  ): void {
    if (ws.clientInfo && message.data.messageTypes) {
      for (const type of message.data.messageTypes) {
        ws.clientInfo.subscriptions.add(type)
      }
      logger.debug('Client subscribed', {
        clientId: ws.clientInfo.id,
        subscriptions: Array.from(ws.clientInfo.subscriptions)
      })
    }
  }

  /**
   * 处理取消订阅
   */
  private handleUnsubscribe(
    ws: ExtendedWebSocket,
    message: WebSocketMessage<{ messageTypes: WebSocketMessageType[] }>
  ): void {
    if (ws.clientInfo && message.data.messageTypes) {
      for (const type of message.data.messageTypes) {
        ws.clientInfo.subscriptions.delete(type)
      }
      logger.debug('Client unsubscribed', {
        clientId: ws.clientInfo.id,
        subscriptions: Array.from(ws.clientInfo.subscriptions)
      })
    }
  }

  /**
   * 处理关闭
   */
  private handleClose(ws: ExtendedWebSocket, code: number, reason: string): void {
    const clientId = ws.clientInfo?.id

    if (ws.authTimer) {
      clearTimeout(ws.authTimer)
    }

    if (clientId) {
      this.clients.delete(clientId)
      logger.info('WebSocket connection closed', { clientId, code, reason })
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, ws] of this.clients) {
        if (ws.isAlive === false) {
          logger.warn('Client heartbeat timeout', { clientId })
          ws.terminate()
          this.clients.delete(clientId)
          continue
        }

        ws.isAlive = false
        ws.ping()
      }
    }, this.config.heartbeatIntervalMs)
  }

  /**
   * 发送消息
   */
  private sendMessage(ws: ExtendedWebSocket, message: Omit<WebSocketMessage, 'timestamp'>): void {
    if (ws.readyState !== WebSocket.OPEN) return

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now()
    }

    ws.send(JSON.stringify(fullMessage))
  }

  /**
   * 发送错误
   */
  private sendError(ws: ExtendedWebSocket, code: string, message: string, details?: unknown): void {
    const errorData: ErrorData = { code, message, details }
    this.sendMessage(ws, {
      type: WebSocketMessageType.ERROR,
      data: errorData
    })
  }

  /**
   * 注册消息处理器
   */
  registerMessageHandler(
    type: WebSocketMessageType,
    handler: (ws: ExtendedWebSocket, message: WebSocketMessage) => void
  ): void {
    const handlers = this.messageHandlers.get(type) || []
    handlers.push(handler)
    this.messageHandlers.set(type, handlers)
  }

  /**
   * 注册 VCP 插件
   */
  async registerPlugin(plugin: VCPPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      logger.warn('Plugin already registered', { pluginId: plugin.id })
      return
    }

    const api = this.createPluginAPI(plugin.id)
    await plugin.initialize?.(api)
    this.plugins.set(plugin.id, plugin)

    logger.info('VCP plugin registered', { pluginId: plugin.id, pluginName: plugin.name })
  }

  /**
   * 注销 VCP 插件
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    await plugin.cleanup?.()
    this.plugins.delete(pluginId)

    logger.info('VCP plugin unregistered', { pluginId })
  }

  /**
   * 创建插件 API
   */
  private createPluginAPI(pluginId: string): VCPPluginWebSocketAPI {
    return {
      broadcast: (message) => {
        this.broadcast({ ...message, sourceClientId: `plugin:${pluginId}` })
      },

      sendToClientType: (clientType, message) => {
        this.sendToClientType(clientType, { ...message, sourceClientId: `plugin:${pluginId}` })
      },

      sendToClient: (clientId, message) => {
        this.sendToClient(clientId, { ...message, sourceClientId: `plugin:${pluginId}` })
      },

      pushLog: (level, logMessage, context, meta) => {
        const data: LogMessageData = { level, message: logMessage, context, meta }
        this.broadcast({
          type: WebSocketMessageType.LOG,
          data
        })
      },

      pushProgress: (taskId, progress, status, description) => {
        const data: ProgressUpdateData = { taskId, progress, status, description }
        this.broadcast({
          type: WebSocketMessageType.PROGRESS_UPDATE,
          data
        })
      },

      pushStatus: (statusType, value, description) => {
        const data: StatusUpdateData = { statusType, value, description }
        this.broadcast({
          type: WebSocketMessageType.STATUS_UPDATE,
          data
        })
      }
    }
  }

  // ============== 公共 API ==============

  /**
   * 广播消息到所有客户端
   */
  broadcast(message: Omit<WebSocketMessage, 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now()
    }
    const data = JSON.stringify(fullMessage)

    for (const [, ws] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue
      if (!ws.clientInfo?.isAuthenticated && this.config.requireAuth) continue

      // 检查订阅
      if (ws.clientInfo?.subscriptions.size && !ws.clientInfo.subscriptions.has(message.type)) {
        continue
      }

      // 检查目标客户端类型
      if (message.targetClientTypes?.length && ws.clientInfo) {
        if (!message.targetClientTypes.includes(ws.clientInfo.type)) {
          continue
        }
      }

      ws.send(data)
    }
  }

  /**
   * 发送消息到特定客户端类型
   */
  sendToClientType(clientType: WebSocketClientType, message: Omit<WebSocketMessage, 'timestamp'>): void {
    this.broadcast({
      ...message,
      targetClientTypes: [clientType]
    })
  }

  /**
   * 发送消息到特定客户端
   */
  sendToClient(clientId: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    const ws = this.clients.get(clientId)
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    this.sendMessage(ws, message)
  }

  /**
   * 获取所有已连接客户端信息
   */
  getConnectedClients(): WebSocketClientInfo[] {
    return Array.from(this.clients.values())
      .filter((ws) => ws.clientInfo)
      .map((ws) => ({
        ...ws.clientInfo!,
        subscriptions: new Set(ws.clientInfo!.subscriptions)
      }))
  }

  /**
   * 获取特定类型的客户端数量
   */
  getClientCountByType(type: WebSocketClientType): number {
    return Array.from(this.clients.values()).filter((ws) => ws.clientInfo?.type === type).length
  }

  /**
   * 获取已注册的插件列表
   */
  getRegisteredPlugins(): { id: string; name: string }[] {
    return Array.from(this.plugins.values()).map((p) => ({ id: p.id, name: p.name }))
  }

  /**
   * 推送日志 (便捷方法)
   */
  pushLog(level: LogLevel, message: string, context?: string, meta?: Record<string, unknown>): void {
    const data: LogMessageData = { level, message, context, meta }
    this.broadcast({
      type: WebSocketMessageType.LOG,
      data
    })
  }

  /**
   * 推送 AI 消息 (便捷方法)
   */
  pushAIMessage(
    sessionId: string,
    messageId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    options?: { isStreaming?: boolean; modelId?: string }
  ): void {
    this.broadcast({
      type: options?.isStreaming ? WebSocketMessageType.AI_MESSAGE_STREAM : WebSocketMessageType.AI_MESSAGE,
      data: {
        sessionId,
        messageId,
        role,
        content,
        isStreaming: options?.isStreaming,
        modelId: options?.modelId
      }
    })
  }

  /**
   * 推送 Agent 调用结果 (便捷方法)
   */
  pushAgentInvokeResult(result: {
    requestId: string
    status: 'success' | 'error' | 'pending' | 'running'
    response?: string
    error?: string
    executionTimeMs?: number
  }): void {
    this.broadcast({
      type: WebSocketMessageType.AGENT_INVOKE_RESULT,
      data: result
    })
  }

  /**
   * 推送 VCP 工具结果 (便捷方法)
   */
  pushVCPToolResult(requestId: string, success: boolean, result?: unknown, error?: string): void {
    this.broadcast({
      type: WebSocketMessageType.VCP_TOOL_RESULT,
      data: { requestId, success, result, error }
    })
  }
}

// 单例实例
let wsServerInstance: UnifiedWebSocketServer | null = null

/**
 * 获取 WebSocket 服务器实例
 */
export function getWebSocketServer(): UnifiedWebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new UnifiedWebSocketServer()
  }
  return wsServerInstance
}

/**
 * 创建新的 WebSocket 服务器实例
 */
export function createWebSocketServer(config?: WebSocketServerConfig): UnifiedWebSocketServer {
  wsServerInstance = new UnifiedWebSocketServer(config)
  return wsServerInstance
}
