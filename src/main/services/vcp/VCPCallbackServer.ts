/**
 * VCP 异步回调服务器
 *
 * 提供 HTTP 端点用于接收异步插件的回调结果
 * 参考 VCPToolBox 的 /plugin-callback/:pluginName/:taskId 实现
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { IpcChannel } from '@shared/IpcChannel'
import { BrowserWindow, ipcMain } from 'electron'

import { loggerService } from '../LoggerService'
import { getVCPAsyncResultsService } from './VCPAsyncResultsService'

const logger = loggerService.withContext('VCPCallbackServer')

/**
 * 回调数据结构
 */
export interface VCPCallbackData {
  status?: 'success' | 'error'
  result?: string
  error?: string
  message?: string
  url?: string
  data?: unknown
  metadata?: Record<string, unknown>
}

/**
 * 回调事件数据 (发送到渲染进程)
 */
export interface VCPCallbackEvent {
  pluginName: string
  taskId: string
  status: 'completed' | 'failed'
  result?: string
  error?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

/**
 * VCP 回调服务器
 *
 * 监听 HTTP 请求，接收异步插件的回调结果并转发给 VCPAsyncResultsService
 */
export class VCPCallbackServer {
  private server: Server | null = null
  private port: number
  private host: string
  private enabled: boolean = false
  private ipcRegistered: boolean = false

  // 默认端口与 VCPRuntime.config.callback.port 保持一致
  constructor(port: number = 19280, host: string = '127.0.0.1') {
    this.port = port
    this.host = host
  }

  /**
   * 注册 IPC 处理器 (仅在首次调用时注册)
   */
  registerIpcHandlers(): void {
    if (this.ipcRegistered) {
      logger.debug('IPC handlers already registered, skipping')
      return
    }

    // 获取回调服务器状态
    ipcMain.handle(IpcChannel.VCP_Callback_GetStatus, () => {
      return {
        enabled: this.enabled,
        running: this.isRunning(),
        port: this.port,
        host: this.host,
        callbackBaseUrl: this.getCallbackBaseUrl()
      }
    })

    // 启动回调服务器
    ipcMain.handle(IpcChannel.VCP_Callback_Start, async () => {
      try {
        const port = await this.start()
        return { success: true, port }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    // 停止回调服务器
    ipcMain.handle(IpcChannel.VCP_Callback_Stop, async () => {
      try {
        await this.stop()
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    // 获取回调 URL
    ipcMain.handle(IpcChannel.VCP_Callback_GetUrl, () => {
      return this.getCallbackBaseUrl()
    })

    this.ipcRegistered = true
    logger.debug('IPC handlers registered')
  }

  /**
   * 启动服务器
   */
  async start(port?: number): Promise<number> {
    if (this.server && this.server.listening) {
      logger.warn('VCPCallbackServer already running', { port: this.port })
      return this.port
    }

    const targetPort = port || this.port

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res))

      this.server.listen(targetPort, this.host, () => {
        this.port = targetPort
        this.enabled = true
        logger.info('VCPCallbackServer started', { host: this.host, port: targetPort })
        resolve(targetPort)
      })

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          // 端口被占用，尝试下一个端口
          logger.warn('Port in use, trying next port', { port: targetPort })
          this.server = null
          this.start(targetPort + 1)
            .then(resolve)
            .catch(reject)
        } else {
          logger.error('VCPCallbackServer error', error)
          reject(error)
        }
      })
    })
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null
        this.enabled = false
        logger.info('VCPCallbackServer stopped')
        resolve()
      })
    })
  }

  /**
   * 检查服务器是否运行中
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening
  }

  /**
   * 获取回调基础 URL
   */
  getCallbackBaseUrl(): string {
    if (!this.isRunning()) {
      return ''
    }
    return `http://${this.host}:${this.port}/plugin-callback`
  }

  /**
   * 获取当前端口
   */
  getPort(): number {
    return this.port
  }

  /**
   * 处理 HTTP 请求
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // 健康检查
    if (req.method === 'GET' && req.url === '/health') {
      this.sendJson(res, 200, { status: 'ok', service: 'VCPCallbackServer' })
      return
    }

    // 解析路由: /plugin-callback/:pluginName/:taskId
    const match = req.url?.match(/^\/plugin-callback\/([^/]+)\/([^/?]+)/)
    if (!match) {
      this.sendJson(res, 404, { error: 'Not Found', message: 'Invalid callback URL' })
      return
    }

    const pluginName = decodeURIComponent(match[1])
    const taskId = decodeURIComponent(match[2])

    if (req.method !== 'POST') {
      this.sendJson(res, 405, { error: 'Method Not Allowed' })
      return
    }

    // 读取请求体
    this.parseBody(req)
      .then((body) => {
        this.processCallback(pluginName, taskId, body, res)
      })
      .catch((error) => {
        logger.error('Failed to parse callback body', error as Error)
        this.sendJson(res, 400, { error: 'Bad Request', message: 'Invalid JSON body' })
      })
  }

  /**
   * 解析请求体
   */
  private parseBody(req: IncomingMessage): Promise<VCPCallbackData> {
    return new Promise((resolve, reject) => {
      let body = ''

      req.on('data', (chunk) => {
        body += chunk.toString()
        // 限制请求体大小 (10MB)
        if (body.length > 10 * 1024 * 1024) {
          reject(new Error('Request body too large'))
        }
      })

      req.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {}
          resolve(data)
        } catch {
          reject(new Error('Invalid JSON'))
        }
      })

      req.on('error', reject)
    })
  }

  /**
   * 处理回调
   */
  private processCallback(pluginName: string, taskId: string, data: VCPCallbackData, res: ServerResponse): void {
    try {
      const asyncService = getVCPAsyncResultsService()
      const isError = data.status === 'error' || !!data.error

      let event: VCPCallbackEvent

      if (isError) {
        // 存储错误结果
        asyncService.storeError({
          pluginName,
          taskId,
          error: data.error || data.message || 'Unknown error',
          metadata: data.metadata || (data.data as Record<string, unknown>)
        })

        event = {
          pluginName,
          taskId,
          status: 'failed',
          error: data.error || data.message,
          timestamp: new Date().toISOString(),
          metadata: data.metadata
        }

        logger.info('Async callback error received', { pluginName, taskId, error: data.error })
      } else {
        // 存储成功结果
        const resultText =
          typeof data.result === 'string'
            ? data.result
            : data.url
              ? data.url
              : data.message
                ? data.message
                : JSON.stringify(data)

        asyncService.storeResult({
          pluginName,
          taskId,
          result: resultText,
          metadata: data.metadata || (data.data as Record<string, unknown>)
        })

        event = {
          pluginName,
          taskId,
          status: 'completed',
          result: resultText,
          timestamp: new Date().toISOString(),
          metadata: data.metadata
        }

        logger.info('Async callback success received', { pluginName, taskId, resultLength: resultText.length })
      }

      // 通知渲染进程
      this.notifyRenderer(event)

      this.sendJson(res, 200, {
        status: 'success',
        message: 'Callback received and processed',
        id: `${pluginName}::${taskId}`
      })
    } catch (error) {
      logger.error('Failed to process callback', error as Error)
      this.sendJson(res, 500, {
        error: 'Internal Server Error',
        message: String(error)
      })
    }
  }

  /**
   * 通知渲染进程
   */
  private notifyRenderer(event: VCPCallbackEvent): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannel.VCP_Async_Callback, event)
      }
    }
    logger.debug('Callback event sent to renderer', { pluginName: event.pluginName, taskId: event.taskId })
  }

  /**
   * 发送 JSON 响应
   */
  private sendJson(res: ServerResponse, statusCode: number, data: object): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
}

// 单例实例
let _instance: VCPCallbackServer | null = null

/**
 * 获取 VCPCallbackServer 单例
 */
export function getVCPCallbackServer(): VCPCallbackServer {
  if (!_instance) {
    _instance = new VCPCallbackServer()
  }
  return _instance
}

/**
 * 创建新的 VCPCallbackServer 实例 (用于测试)
 */
export function createVCPCallbackServer(port?: number, host?: string): VCPCallbackServer {
  return new VCPCallbackServer(port, host)
}
