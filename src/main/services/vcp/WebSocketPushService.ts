/**
 * WebSocketPushService - 实时消息推送服务
 *
 * 实现 WebSocket 服务端推送能力：
 * 1. 客户端连接管理
 * 2. 广播消息
 * 3. 定向推送
 * 4. 频道/房间订阅
 * 5. 心跳保活
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'
import { EventEmitter } from 'events'
import { createServer, type Server as HTTPServer } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'

const logger = loggerService.withContext('WebSocketPush')

// ==================== 类型定义 ====================

/**
 * 客户端连接信息
 */
export interface WebSocketClient {
  id: string
  socket: WebSocket
  connectedAt: number
  lastPing: number
  channels: Set<string>
  metadata: Record<string, unknown>
}

/**
 * 消息格式
 */
export interface PushMessage {
  event: string
  data: unknown
  timestamp: number
  sender?: string
}

/**
 * 服务配置
 */
export interface WebSocketPushConfig {
  /** 监听端口 (默认 8765) */
  port: number
  /** 心跳间隔 (毫秒, 默认 30000) */
  heartbeatInterval: number
  /** 心跳超时 (毫秒, 默认 60000) */
  heartbeatTimeout: number
  /** 最大连接数 (默认 1000) */
  maxConnections: number
  /** 消息大小限制 (字节, 默认 1MB) */
  maxMessageSize: number
  /** 认证回调 */
  authCallback?: (token: string) => Promise<boolean>
}

/**
 * 推送统计
 */
export interface PushStats {
  activeConnections: number
  totalConnections: number
  messagesSent: number
  messagesReceived: number
  bytesSent: number
  bytesReceived: number
  uptime: number
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: WebSocketPushConfig = {
  port: 8765,
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
  maxConnections: 1000,
  maxMessageSize: 1024 * 1024 // 1MB
}

// ==================== 事件类型 ====================

export type WebSocketPushEvents = {
  connection: (client: WebSocketClient) => void
  disconnection: (clientId: string, reason: string) => void
  message: (clientId: string, message: PushMessage) => void
  error: (clientId: string, error: Error) => void
  broadcast: (event: string, data: unknown) => void
}

// ==================== 主服务类 ====================

export class WebSocketPushService extends EventEmitter {
  private config: WebSocketPushConfig
  private httpServer: HTTPServer | null = null
  private wss: WebSocketServer | null = null
  private clients: Map<string, WebSocketClient> = new Map()
  private channels: Map<string, Set<string>> = new Map()
  private heartbeatTimer: NodeJS.Timeout | null = null
  private startTime: number = 0
  private stats = {
    totalConnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0
  }

  constructor(config: Partial<WebSocketPushConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.info('WebSocketPushService initialized', { config: this.config })
  }

  /**
   * 启动 WebSocket 服务器
   */
  async start(): Promise<void> {
    if (this.wss) {
      logger.warn('WebSocket server already running')
      return
    }

    return new Promise((resolve, reject) => {
      try {
        this.httpServer = createServer()
        this.wss = new WebSocketServer({
          server: this.httpServer,
          maxPayload: this.config.maxMessageSize
        })

        this.setupWebSocketHandlers()
        this.startHeartbeat()

        this.httpServer.listen(this.config.port, () => {
          this.startTime = Date.now()
          logger.info('WebSocket server started', { port: this.config.port })
          resolve()
        })

        this.httpServer.on('error', (error) => {
          logger.error('HTTP server error', { error })
          reject(error)
        })
      } catch (error) {
        logger.error('Failed to start WebSocket server', { error })
        reject(error)
      }
    })
  }

  /**
   * 停止 WebSocket 服务器
   */
  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // 关闭所有客户端连接
    for (const client of this.clients.values()) {
      client.socket.close(1000, 'Server shutting down')
    }
    this.clients.clear()
    this.channels.clear()

    // 关闭 WebSocket 服务器
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve())
      })
      this.wss = null
    }

    // 关闭 HTTP 服务器
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve())
      })
      this.httpServer = null
    }

    logger.info('WebSocket server stopped')
  }

  /**
   * 设置 WebSocket 事件处理器
   */
  private setupWebSocketHandlers(): void {
    if (!this.wss) return

    this.wss.on('connection', (socket, request) => {
      // 检查连接数限制
      if (this.clients.size >= this.config.maxConnections) {
        logger.warn('Max connections reached, rejecting new connection')
        socket.close(1013, 'Max connections reached')
        return
      }

      const clientId = this.generateClientId()
      const client: WebSocketClient = {
        id: clientId,
        socket,
        connectedAt: Date.now(),
        lastPing: Date.now(),
        channels: new Set(),
        metadata: {
          ip: request.socket.remoteAddress,
          userAgent: request.headers['user-agent']
        }
      }

      this.clients.set(clientId, client)
      this.stats.totalConnections++

      logger.info('Client connected', { clientId, ip: client.metadata.ip })
      this.emit('connection', client)

      // 发送连接确认
      this.sendToClient(clientId, {
        event: 'connected',
        data: { clientId },
        timestamp: Date.now()
      })

      // 消息处理
      socket.on('message', (data) => {
        this.handleMessage(clientId, data)
      })

      // 断开处理
      socket.on('close', (code, reason) => {
        this.handleDisconnect(clientId, `Code: ${code}, Reason: ${reason}`)
      })

      // 错误处理
      socket.on('error', (error) => {
        logger.error('WebSocket error', { clientId, error })
        this.emit('error', clientId, error)
      })

      // pong 处理 (心跳响应)
      socket.on('pong', () => {
        client.lastPing = Date.now()
      })
    })

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error })
    })
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(clientId: string, data: Buffer | ArrayBuffer | Buffer[]): void {
    const client = this.clients.get(clientId)
    if (!client) return

    try {
      const raw = data.toString()
      this.stats.bytesReceived += raw.length
      this.stats.messagesReceived++

      const message = JSON.parse(raw) as PushMessage

      logger.debug('Message received', { clientId, event: message.event })

      // 处理内置事件
      switch (message.event) {
        case 'ping':
          this.sendToClient(clientId, { event: 'pong', data: null, timestamp: Date.now() })
          break
        case 'subscribe':
          this.subscribeToChannel(clientId, message.data as string)
          break
        case 'unsubscribe':
          this.unsubscribeFromChannel(clientId, message.data as string)
          break
        default:
          this.emit('message', clientId, message)
      }
    } catch (error) {
      logger.error('Failed to parse message', { clientId, error })
    }
  }

  /**
   * 处理客户端断开
   */
  private handleDisconnect(clientId: string, reason: string): void {
    const client = this.clients.get(clientId)
    if (!client) return

    // 从所有频道移除
    for (const channel of client.channels) {
      const channelClients = this.channels.get(channel)
      if (channelClients) {
        channelClients.delete(clientId)
        if (channelClients.size === 0) {
          this.channels.delete(channel)
        }
      }
    }

    this.clients.delete(clientId)
    logger.info('Client disconnected', { clientId, reason })
    this.emit('disconnection', clientId, reason)
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()

      for (const [clientId, client] of this.clients) {
        // 检查心跳超时
        if (now - client.lastPing > this.config.heartbeatTimeout) {
          logger.warn('Client heartbeat timeout', { clientId })
          client.socket.terminate()
          this.handleDisconnect(clientId, 'Heartbeat timeout')
          continue
        }

        // 发送 ping
        if (client.socket.readyState === 1) {
          // OPEN
          client.socket.ping()
        }
      }
    }, this.config.heartbeatInterval)
  }

  // ==================== 推送方法 ====================

  /**
   * 广播消息给所有客户端
   */
  broadcast(event: string, data: unknown): void {
    const message: PushMessage = {
      event,
      data,
      timestamp: Date.now()
    }

    for (const client of this.clients.values()) {
      this.sendToSocket(client.socket, message)
    }

    logger.debug('Broadcast sent', { event, clientCount: this.clients.size })
    this.emit('broadcast', event, data)
  }

  /**
   * 推送消息给指定客户端
   */
  push(clientId: string, event: string, data: unknown): boolean {
    return this.sendToClient(clientId, {
      event,
      data,
      timestamp: Date.now()
    })
  }

  /**
   * 推送消息给频道内所有客户端
   */
  pushToChannel(channel: string, event: string, data: unknown): number {
    const channelClients = this.channels.get(channel)
    if (!channelClients) return 0

    const message: PushMessage = {
      event,
      data,
      timestamp: Date.now()
    }

    let sent = 0
    for (const clientId of channelClients) {
      if (this.sendToClient(clientId, message)) {
        sent++
      }
    }

    logger.debug('Channel push sent', { channel, event, sentCount: sent })
    return sent
  }

  /**
   * 推送消息给多个客户端
   */
  pushToMany(clientIds: string[], event: string, data: unknown): number {
    const message: PushMessage = {
      event,
      data,
      timestamp: Date.now()
    }

    let sent = 0
    for (const clientId of clientIds) {
      if (this.sendToClient(clientId, message)) {
        sent++
      }
    }

    return sent
  }

  // ==================== 频道管理 ====================

  /**
   * 订阅频道
   */
  subscribeToChannel(clientId: string, channel: string): boolean {
    const client = this.clients.get(clientId)
    if (!client) return false

    client.channels.add(channel)

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set())
    }
    this.channels.get(channel)!.add(clientId)

    logger.debug('Client subscribed to channel', { clientId, channel })
    return true
  }

  /**
   * 取消订阅频道
   */
  unsubscribeFromChannel(clientId: string, channel: string): boolean {
    const client = this.clients.get(clientId)
    if (!client) return false

    client.channels.delete(channel)

    const channelClients = this.channels.get(channel)
    if (channelClients) {
      channelClients.delete(clientId)
      if (channelClients.size === 0) {
        this.channels.delete(channel)
      }
    }

    logger.debug('Client unsubscribed from channel', { clientId, channel })
    return true
  }

  /**
   * 获取频道订阅者数量
   */
  getChannelSubscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0
  }

  /**
   * 获取所有频道列表
   */
  getChannels(): string[] {
    return Array.from(this.channels.keys())
  }

  // ==================== 客户端管理 ====================

  /**
   * 获取客户端信息
   */
  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId)
  }

  /**
   * 获取所有客户端 ID
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys())
  }

  /**
   * 断开客户端连接
   */
  disconnectClient(clientId: string, reason: string = 'Disconnected by server'): boolean {
    const client = this.clients.get(clientId)
    if (!client) return false

    client.socket.close(1000, reason)
    return true
  }

  /**
   * 更新客户端元数据
   */
  updateClientMetadata(clientId: string, metadata: Record<string, unknown>): boolean {
    const client = this.clients.get(clientId)
    if (!client) return false

    client.metadata = { ...client.metadata, ...metadata }
    return true
  }

  // ==================== 统计 ====================

  /**
   * 获取服务统计
   */
  getStats(): PushStats {
    return {
      activeConnections: this.clients.size,
      totalConnections: this.stats.totalConnections,
      messagesSent: this.stats.messagesSent,
      messagesReceived: this.stats.messagesReceived,
      bytesSent: this.stats.bytesSent,
      bytesReceived: this.stats.bytesReceived,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0
    }
  }

  /**
   * 服务是否运行中
   */
  isRunning(): boolean {
    return this.wss !== null
  }

  // ==================== 工具方法 ====================

  /**
   * 生成客户端 ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  }

  /**
   * 发送消息给客户端
   */
  private sendToClient(clientId: string, message: PushMessage): boolean {
    const client = this.clients.get(clientId)
    if (!client) return false

    return this.sendToSocket(client.socket, message)
  }

  /**
   * 发送消息到 Socket
   */
  private sendToSocket(socket: WebSocket, message: PushMessage): boolean {
    if (socket.readyState !== 1) {
      // 1 = OPEN
      return false
    }

    try {
      const payload = JSON.stringify(message)
      socket.send(payload)
      this.stats.messagesSent++
      this.stats.bytesSent += payload.length
      return true
    } catch (error) {
      logger.error('Failed to send message', { error })
      return false
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置 (部分配置需要重启生效)
   */
  updateConfig(config: Partial<WebSocketPushConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('Config updated', { config: this.config })
  }

  /**
   * 获取当前配置
   */
  getConfig(): WebSocketPushConfig {
    return { ...this.config }
  }
}

// ==================== 便捷函数 ====================

let defaultService: WebSocketPushService | null = null

export function getWebSocketPushService(): WebSocketPushService {
  if (!defaultService) {
    defaultService = new WebSocketPushService()
  }
  return defaultService
}

/**
 * 创建新的 WebSocket 推送服务实例
 */
export function createWebSocketPushService(config?: Partial<WebSocketPushConfig>): WebSocketPushService {
  return new WebSocketPushService(config)
}

/**
 * 快捷广播函数
 */
export function broadcast(event: string, data: unknown): void {
  getWebSocketPushService().broadcast(event, data)
}

/**
 * 快捷推送函数
 */
export function push(clientId: string, event: string, data: unknown): boolean {
  return getWebSocketPushService().push(clientId, event, data)
}
