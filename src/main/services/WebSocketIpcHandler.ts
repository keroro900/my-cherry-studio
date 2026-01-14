/**
 * WebSocket IPC Handler
 *
 * 注册 WebSocket 相关的 IPC 处理器，允许 Renderer 进程与 WebSocket 服务交互
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { apiServer } from '../apiServer/server'
import type { LogLevel, WebSocketClientInfo, WebSocketMessage, WebSocketMessageType } from '../apiServer/websocket'

const logger = loggerService.withContext('WebSocketIpcHandler')

/**
 * 注册 WebSocket IPC 处理器
 */
export function registerWebSocketIpcHandlers(): void {
  // 获取 WebSocket 服务状态
  ipcMain.handle(IpcChannel.WebSocket_GetStatus, async () => {
    try {
      const wsServer = apiServer.getWebSocketServer()
      if (!wsServer) {
        return {
          success: true,
          status: {
            running: false,
            clientCount: 0,
            pluginCount: 0
          }
        }
      }

      const clients = wsServer.getConnectedClients()
      const plugins = wsServer.getRegisteredPlugins()

      return {
        success: true,
        status: {
          running: true,
          clientCount: clients.length,
          pluginCount: plugins.length
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get WebSocket status', { error: errorMessage })
      return { success: false, error: errorMessage }
    }
  })

  // 获取已连接客户端列表
  ipcMain.handle(IpcChannel.WebSocket_GetClients, async () => {
    try {
      const wsServer = apiServer.getWebSocketServer()
      if (!wsServer) {
        return { success: true, clients: [] }
      }

      const clients = wsServer.getConnectedClients()

      // 序列化客户端信息 (Set 不能直接 JSON 序列化)
      const serializedClients = clients.map((client: WebSocketClientInfo) => ({
        ...client,
        subscriptions: Array.from(client.subscriptions)
      }))

      return { success: true, clients: serializedClients }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get WebSocket clients', { error: errorMessage })
      return { success: false, error: errorMessage }
    }
  })

  // 获取已注册插件列表
  ipcMain.handle(IpcChannel.WebSocket_GetPlugins, async () => {
    try {
      const wsServer = apiServer.getWebSocketServer()
      if (!wsServer) {
        return { success: true, plugins: [] }
      }

      const plugins = wsServer.getRegisteredPlugins()
      return { success: true, plugins }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get WebSocket plugins', { error: errorMessage })
      return { success: false, error: errorMessage }
    }
  })

  // 广播消息
  ipcMain.handle(
    IpcChannel.WebSocket_Broadcast,
    async (
      _,
      args: {
        type: WebSocketMessageType
        data: unknown
        targetClientTypes?: string[]
      }
    ) => {
      try {
        const wsServer = apiServer.getWebSocketServer()
        if (!wsServer) {
          return { success: false, error: 'WebSocket server not running' }
        }

        const message: Omit<WebSocketMessage, 'timestamp'> = {
          type: args.type,
          data: args.data,
          targetClientTypes: args.targetClientTypes as WebSocketMessage['targetClientTypes']
        }

        wsServer.broadcast(message)
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to broadcast message', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // 发送消息到特定客户端
  ipcMain.handle(
    IpcChannel.WebSocket_SendToClient,
    async (
      _,
      args: {
        clientId: string
        type: WebSocketMessageType
        data: unknown
      }
    ) => {
      try {
        const wsServer = apiServer.getWebSocketServer()
        if (!wsServer) {
          return { success: false, error: 'WebSocket server not running' }
        }

        wsServer.sendToClient(args.clientId, {
          type: args.type,
          data: args.data
        })
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to send message to client', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // 推送日志
  ipcMain.handle(
    IpcChannel.WebSocket_PushLog,
    async (
      _,
      args: {
        level: LogLevel
        message: string
        context?: string
        meta?: Record<string, unknown>
      }
    ) => {
      try {
        const wsServer = apiServer.getWebSocketServer()
        if (!wsServer) {
          return { success: false, error: 'WebSocket server not running' }
        }

        wsServer.pushLog(args.level, args.message, args.context, args.meta)
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to push log', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // 推送 AI 消息
  ipcMain.handle(
    IpcChannel.WebSocket_PushAIMessage,
    async (
      _,
      args: {
        sessionId: string
        messageId: string
        role: 'user' | 'assistant' | 'system'
        content: string
        isStreaming?: boolean
        modelId?: string
      }
    ) => {
      try {
        const wsServer = apiServer.getWebSocketServer()
        if (!wsServer) {
          return { success: false, error: 'WebSocket server not running' }
        }

        wsServer.pushAIMessage(args.sessionId, args.messageId, args.role, args.content, {
          isStreaming: args.isStreaming,
          modelId: args.modelId
        })
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to push AI message', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // 推送 Agent 调用结果
  ipcMain.handle(
    IpcChannel.WebSocket_PushAgentResult,
    async (
      _,
      args: {
        requestId: string
        status: 'success' | 'error' | 'pending' | 'running'
        response?: string
        error?: string
        executionTimeMs?: number
      }
    ) => {
      try {
        const wsServer = apiServer.getWebSocketServer()
        if (!wsServer) {
          return { success: false, error: 'WebSocket server not running' }
        }

        wsServer.pushAgentInvokeResult(args)
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to push agent result', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  logger.info('WebSocket IPC handlers registered')
}
