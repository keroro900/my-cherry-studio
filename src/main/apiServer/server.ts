import { createServer } from 'node:http'

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'

import { windowService } from '../services/WindowService'
import { app } from './app'
import { config } from './config'
import type { UnifiedWebSocketServer } from './websocket'
import {
  createAgentSyncPlugin,
  createDistributedPlugin,
  createVCPLogPlugin,
  getWebSocketServer,
  LogLevel
} from './websocket'

const logger = loggerService.withContext('ApiServer')

const GLOBAL_REQUEST_TIMEOUT_MS = 5 * 60_000
const GLOBAL_HEADERS_TIMEOUT_MS = GLOBAL_REQUEST_TIMEOUT_MS + 5_000
const GLOBAL_KEEPALIVE_TIMEOUT_MS = 60_000

export class ApiServer {
  private server: ReturnType<typeof createServer> | null = null
  private wsServer: UnifiedWebSocketServer | null = null

  async start(): Promise<void> {
    if (this.server && this.server.listening) {
      logger.warn('Server already running')
      return
    }

    // Clean up any failed server instance
    if (this.server && !this.server.listening) {
      logger.warn('Cleaning up failed server instance')
      this.server = null
    }

    // Load config
    const { port, host } = await config.load()

    // Create server with Express app
    this.server = createServer(app)
    this.applyServerTimeouts(this.server)

    // Attach WebSocket server
    await this.attachWebSocket()

    // Start server
    return new Promise((resolve, reject) => {
      this.server!.listen(port, host, () => {
        logger.info('API server started', { host, port, websocket: '/ws' })

        // Notify renderer that API server is ready
        const mainWindow = windowService.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IpcChannel.ApiServer_Ready)
        }

        resolve()
      })

      this.server!.on('error', (error) => {
        // Clean up the server instance if listen fails
        this.server = null
        reject(error)
      })
    })
  }

  /**
   * 附加 WebSocket 服务器
   */
  private async attachWebSocket(): Promise<void> {
    if (!this.server) return

    this.wsServer = getWebSocketServer()
    this.wsServer.attach(this.server)

    // 注册内置插件
    try {
      // VCP 日志插件
      const logPlugin = createVCPLogPlugin({
        minLevel: LogLevel.INFO
      })
      await this.wsServer.registerPlugin(logPlugin)

      // Agent 同步插件
      const agentSyncPlugin = createAgentSyncPlugin()
      await this.wsServer.registerPlugin(agentSyncPlugin)

      // VCP 分布式服务插件
      const distributedPlugin = createDistributedPlugin({
        toolCallTimeoutMs: 60000,
        heartbeatTimeoutMs: 90000,
        broadcastServerChanges: true
      })
      await this.wsServer.registerPlugin(distributedPlugin)

      logger.info('WebSocket plugins registered', {
        plugins: ['VCPLogPlugin', 'AgentSyncPlugin', 'DistributedPlugin']
      })
    } catch (error) {
      logger.error('Failed to register WebSocket plugins', { error: String(error) })
    }
  }

  private applyServerTimeouts(server: ReturnType<typeof createServer>): void {
    server.requestTimeout = GLOBAL_REQUEST_TIMEOUT_MS
    server.headersTimeout = Math.max(GLOBAL_HEADERS_TIMEOUT_MS, server.requestTimeout + 1_000)
    server.keepAliveTimeout = GLOBAL_KEEPALIVE_TIMEOUT_MS
    server.setTimeout(0)
  }

  async stop(): Promise<void> {
    // 关闭 WebSocket 服务器
    if (this.wsServer) {
      await this.wsServer.close()
      this.wsServer = null
    }

    if (!this.server) return

    return new Promise((resolve) => {
      this.server!.close(() => {
        logger.info('API server stopped')
        this.server = null
        resolve()
      })
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await config.reload()
    await this.start()
  }

  isRunning(): boolean {
    const hasServer = this.server !== null
    const isListening = this.server?.listening || false
    const result = hasServer && isListening

    logger.debug('isRunning check', { hasServer, isListening, result })

    return result
  }

  /**
   * 获取 WebSocket 服务器实例
   */
  getWebSocketServer(): UnifiedWebSocketServer | null {
    return this.wsServer
  }
}

export const apiServer = new ApiServer()
