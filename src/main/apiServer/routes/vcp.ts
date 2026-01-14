/**
 * VCP API Routes
 *
 * VCP 专用 API 路由：
 * - POST /v1/vcp/interrupt: 应急中止请求
 * - POST /v1/vcp/tool: 人类直接工具调用
 */

import type { Request, Response } from 'express'
import express from 'express'

import { loggerService } from '../../services/LoggerService'
import { getVCPRuntime } from '../../services/vcp/VCPRuntime'

const logger = loggerService.withContext('ApiServerVCPRoutes')

const router = express.Router()

// ==================== 活跃请求追踪 ====================

interface ActiveRequestContext {
  requestId: string
  res: Response
  req: Request
  abortController: AbortController
  aborted: boolean
  createdAt: number
  isStream: boolean
}

// 活跃请求 Map
const activeRequests = new Map<string, ActiveRequestContext>()

// 清理过期请求的定时器（30分钟）
const REQUEST_TTL_MS = 30 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [id, context] of activeRequests) {
    if (now - context.createdAt > REQUEST_TTL_MS) {
      activeRequests.delete(id)
      logger.debug('Cleaned up expired request', { requestId: id })
    }
  }
}, 5 * 60 * 1000) // 每5分钟清理一次

/**
 * 注册活跃请求
 */
export function registerActiveRequest(
  requestId: string,
  req: Request,
  res: Response,
  abortController: AbortController
): void {
  const isStream = req.body?.stream === true
  activeRequests.set(requestId, {
    requestId,
    req,
    res,
    abortController,
    aborted: false,
    createdAt: Date.now(),
    isStream
  })
  logger.debug('Registered active request', { requestId, isStream })
}

/**
 * 移除活跃请求
 */
export function unregisterActiveRequest(requestId: string): void {
  activeRequests.delete(requestId)
  logger.debug('Unregistered active request', { requestId })
}

/**
 * 获取活跃请求
 */
export function getActiveRequest(requestId: string): ActiveRequestContext | undefined {
  return activeRequests.get(requestId)
}

// ==================== 路由定义 ====================

interface ErrorResponseBody {
  error: {
    message: string
    type: string
    code: string
  }
}

/**
 * @swagger
 * /v1/vcp/interrupt:
 *   post:
 *     summary: 中止活跃请求
 *     description: 应急中止正在进行的聊天请求
 *     tags: [VCP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: 要中止的请求ID
 *               messageId:
 *                 type: string
 *                 description: 要中止的消息ID（备选）
 *             oneOf:
 *               - required: [requestId]
 *               - required: [messageId]
 *     responses:
 *       200:
 *         description: 请求已中止
 *       400:
 *         description: 缺少 requestId 或 messageId
 *       404:
 *         description: 请求不存在或已完成
 */
router.post('/interrupt', (req: Request, res: Response) => {
  const id = req.body.requestId || req.body.messageId
  if (!id) {
    return res.status(400).json({
      error: {
        message: 'requestId or messageId is required',
        type: 'invalid_request_error',
        code: 'missing_id'
      }
    } as ErrorResponseBody)
  }

  const context = activeRequests.get(id)
  if (!context) {
    logger.warn('Interrupt request for unknown ID', { id })
    return res.status(404).json({
      error: {
        message: `Request ${id} not found or already completed`,
        type: 'not_found_error',
        code: 'request_not_found'
      }
    } as ErrorResponseBody)
  }

  logger.info('Received interrupt signal', { requestId: id })

  // 1. 设置中止标志
  if (!context.aborted) {
    context.aborted = true

    // 2. 触发 abort 信号
    if (context.abortController && !context.abortController.signal.aborted) {
      context.abortController.abort()
      logger.debug('AbortController.abort() called', { requestId: id })
    }

    // 3. 使用 setImmediate 避免竞态条件
    setImmediate(() => {
      // 4. 安全地关闭响应流
      if (context.res && !context.res.writableEnded) {
        try {
          if (!context.res.headersSent) {
            if (context.isStream) {
              // 流式请求：发送 SSE 格式的中止信号
              context.res.status(200)
              context.res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
              context.res.setHeader('Cache-Control', 'no-cache')
              context.res.setHeader('Connection', 'keep-alive')

              const abortChunk = {
                id: `chatcmpl-interrupt-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: context.req?.body?.model || 'unknown',
                choices: [
                  {
                    index: 0,
                    delta: { content: '请求已被用户中止' },
                    finish_reason: 'stop'
                  }
                ]
              }
              context.res.write(`data: ${JSON.stringify(abortChunk)}\n\n`)
              context.res.write('data: [DONE]\n\n')
              context.res.end()
            } else {
              // 非流式请求：发送标准 JSON 响应
              context.res.status(200).json({
                id: `chatcmpl-interrupt-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: context.req?.body?.model || 'unknown',
                choices: [
                  {
                    index: 0,
                    message: { role: 'assistant', content: '请求已被用户中止' },
                    finish_reason: 'stop'
                  }
                ]
              })
            }
          } else if (context.res.getHeader('Content-Type')?.toString().includes('text/event-stream')) {
            // 已发送流式头，发送 [DONE] 信号
            context.res.write('data: [DONE]\n\n')
            context.res.end()
          } else {
            // 其他情况直接结束
            context.res.end()
          }
          logger.info('Request interrupted successfully', { requestId: id })
        } catch (e) {
          logger.error('Error closing response during interrupt', {
            requestId: id,
            error: e instanceof Error ? e : new Error(String(e))
          })
        }
      }

      // 清理
      activeRequests.delete(id)
    })
  }

  return res.json({
    status: 'ok',
    message: `Request ${id} interrupted`,
    requestId: id
  })
})

/**
 * @swagger
 * /v1/vcp/tool:
 *   post:
 *     summary: 人类直接工具调用
 *     description: 直接调用 VCP 工具，绕过 AI 响应流程
 *     tags: [VCP]
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *             description: VCP 格式的工具调用请求
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tool_name:
 *                 type: string
 *                 description: 工具名称
 *               arguments:
 *                 type: object
 *                 description: 工具参数
 *             required: [tool_name]
 *     responses:
 *       200:
 *         description: 工具执行结果
 *       400:
 *         description: 请求格式错误
 *       500:
 *         description: 工具执行失败
 */
router.post('/tool', async (req: Request, res: Response) => {
  try {
    let toolName: string | null = null
    let toolArgs: Record<string, any> = {}

    // 支持两种请求格式
    if (typeof req.body === 'string' || (req.body && req.headers['content-type']?.includes('text/plain'))) {
      // VCP 格式（纯文本）
      const requestBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

      const toolRequestStartMarker = '<<<[TOOL_REQUEST]>>>'
      const toolRequestEndMarker = '<<<[END_TOOL_REQUEST]>>>'

      const startIndex = requestBody.indexOf(toolRequestStartMarker)
      const endIndex = requestBody.indexOf(toolRequestEndMarker, startIndex)

      if (startIndex === -1 || endIndex === -1) {
        return res.status(400).json({
          error: {
            message: 'Malformed request: Missing TOOL_REQUEST markers',
            type: 'invalid_request_error',
            code: 'missing_markers'
          }
        } as ErrorResponseBody)
      }

      const requestBlockContent = requestBody
        .substring(startIndex + toolRequestStartMarker.length, endIndex)
        .trim()

      // 解析 VCP 格式参数: key: 「始」value「末」
      const paramRegex = /([\w_]+)\s*:\s*「始」([\s\S]*?)「末」\s*(?:,)?/g
      let regexMatch

      while ((regexMatch = paramRegex.exec(requestBlockContent)) !== null) {
        const key = regexMatch[1]
        const value = regexMatch[2].trim()
        if (key === 'tool_name') {
          toolName = value
        } else {
          toolArgs[key] = value
        }
      }
    } else if (typeof req.body === 'object') {
      // JSON 格式
      toolName = req.body.tool_name || req.body.toolName
      toolArgs = req.body.arguments || req.body.args || {}

      // 支持 PluginName:CommandName 格式
      if (req.body.command) {
        toolArgs.command = req.body.command
      }
    }

    if (!toolName) {
      return res.status(400).json({
        error: {
          message: 'tool_name is required',
          type: 'invalid_request_error',
          code: 'missing_tool_name'
        }
      } as ErrorResponseBody)
    }

    logger.info('Human tool call received', { toolName, args: Object.keys(toolArgs) })

    // 调用 VCP 运行时执行工具
    const runtime = getVCPRuntime()
    const result = await runtime.executeTool(toolName, toolArgs)

    logger.info('Human tool call completed', {
      toolName,
      success: result.success,
      executionTimeMs: result.executionTimeMs
    })

    return res.json({
      success: result.success,
      output: result.output,
      data: result.data,
      error: result.error,
      executionTimeMs: result.executionTimeMs
    })
  } catch (error) {
    logger.error('Human tool call error', {
      error: error instanceof Error ? error : new Error(String(error))
    })

    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
        code: 'tool_execution_failed'
      }
    } as ErrorResponseBody)
  }
})

/**
 * @swagger
 * /v1/vcp/status:
 *   get:
 *     summary: VCP 运行时状态
 *     description: 获取 VCP 运行时状态和统计信息
 *     tags: [VCP]
 *     responses:
 *       200:
 *         description: VCP 状态信息
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const runtime = getVCPRuntime()
    const { apiServer } = await import('../server')
    const wsServer = apiServer.getWebSocketServer()

    // 获取分布式插件统计
    let distributedStats: {
      serverCount: number
      onlineServerCount: number
      totalToolCount: number
      pendingCallCount: number
    } | null = null
    if (wsServer) {
      const { getDistributedPlugin } = await import('../websocket/plugins/DistributedPlugin')
      const distributedPlugin = getDistributedPlugin()
      if (distributedPlugin) {
        distributedStats = distributedPlugin.getStats()
      }
    }

    return res.json({
      status: 'ok',
      initialized: runtime.isInitialized(),
      activeRequests: activeRequests.size,
      plugins: runtime.listPlugins().length,
      websocket: {
        running: !!wsServer,
        clients: wsServer?.getConnectedClients().length || 0
      },
      distributed: distributedStats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
        code: 'status_check_failed'
      }
    } as ErrorResponseBody)
  }
})

/**
 * @swagger
 * /v1/vcp/distributed/servers:
 *   get:
 *     summary: 获取分布式服务器列表
 *     description: 获取所有已连接的分布式服务器
 *     tags: [VCP]
 *     responses:
 *       200:
 *         description: 分布式服务器列表
 */
router.get('/distributed/servers', async (_req: Request, res: Response) => {
  try {
    const { getDistributedPlugin } = await import('../websocket/plugins/DistributedPlugin')
    const distributedPlugin = getDistributedPlugin()

    if (!distributedPlugin) {
      return res.json({
        success: true,
        servers: [],
        message: 'Distributed plugin not initialized'
      })
    }

    const servers = distributedPlugin.getAllServers().map((server) => ({
      id: server.id,
      name: server.name,
      status: server.status,
      toolCount: server.tools.length,
      registeredAt: server.registeredAt.toISOString(),
      lastHeartbeat: server.lastHeartbeat.toISOString()
    }))

    return res.json({
      success: true,
      servers,
      total: servers.length
    })
  } catch (error) {
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
        code: 'distributed_servers_failed'
      }
    } as ErrorResponseBody)
  }
})

/**
 * @swagger
 * /v1/vcp/distributed/tools:
 *   get:
 *     summary: 获取远程工具列表
 *     description: 获取所有可用的远程工具
 *     tags: [VCP]
 *     responses:
 *       200:
 *         description: 远程工具列表
 */
router.get('/distributed/tools', async (_req: Request, res: Response) => {
  try {
    const { getDistributedPlugin } = await import('../websocket/plugins/DistributedPlugin')
    const distributedPlugin = getDistributedPlugin()

    if (!distributedPlugin) {
      return res.json({
        success: true,
        tools: [],
        message: 'Distributed plugin not initialized'
      })
    }

    const tools = distributedPlugin.getAllRemoteTools()

    return res.json({
      success: true,
      tools,
      total: tools.length
    })
  } catch (error) {
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
        code: 'distributed_tools_failed'
      }
    } as ErrorResponseBody)
  }
})

/**
 * @swagger
 * /v1/vcp/distributed/call:
 *   post:
 *     summary: 调用远程工具
 *     description: 通过分布式节点调用远程工具
 *     tags: [VCP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toolName:
 *                 type: string
 *               params:
 *                 type: object
 *             required: [toolName]
 *     responses:
 *       200:
 *         description: 工具执行结果
 */
router.post('/distributed/call', async (req: Request, res: Response) => {
  try {
    const { toolName, params } = req.body

    if (!toolName) {
      return res.status(400).json({
        error: {
          message: 'toolName is required',
          type: 'invalid_request_error',
          code: 'missing_tool_name'
        }
      } as ErrorResponseBody)
    }

    const { getDistributedPlugin } = await import('../websocket/plugins/DistributedPlugin')
    const distributedPlugin = getDistributedPlugin()

    if (!distributedPlugin) {
      return res.status(503).json({
        error: {
          message: 'Distributed plugin not initialized',
          type: 'service_unavailable',
          code: 'plugin_not_ready'
        }
      } as ErrorResponseBody)
    }

    if (!distributedPlugin.isRemoteTool(toolName)) {
      return res.status(404).json({
        error: {
          message: `Tool '${toolName}' not found on any distributed server`,
          type: 'not_found_error',
          code: 'tool_not_found'
        }
      } as ErrorResponseBody)
    }

    logger.info('Distributed tool call', { toolName, params: Object.keys(params || {}) })

    const result = await distributedPlugin.callRemoteTool(toolName, params || {})

    return res.json({
      success: result.success,
      output: result.output,
      data: result.data,
      error: result.error,
      executionTimeMs: result.executionTimeMs
    })
  } catch (error) {
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
        code: 'distributed_call_failed'
      }
    } as ErrorResponseBody)
  }
})

/**
 * @swagger
 * /v1/vcp/websocket/clients:
 *   get:
 *     summary: 获取 WebSocket 客户端列表
 *     description: 获取所有已连接的 WebSocket 客户端
 *     tags: [VCP]
 *     responses:
 *       200:
 *         description: WebSocket 客户端列表
 */
router.get('/websocket/clients', async (_req: Request, res: Response) => {
  try {
    const { apiServer } = await import('../server')
    const wsServer = apiServer.getWebSocketServer()

    if (!wsServer) {
      return res.json({
        success: true,
        clients: [],
        message: 'WebSocket server not running'
      })
    }

    const clients = wsServer.getConnectedClients().map((client) => ({
      id: client.id,
      type: client.type,
      name: client.name,
      connectedAt: client.connectedAt.toISOString(),
      lastActiveAt: client.lastActiveAt.toISOString(),
      isAuthenticated: client.isAuthenticated,
      subscriptions: Array.from(client.subscriptions)
    }))

    return res.json({
      success: true,
      clients,
      total: clients.length
    })
  } catch (error) {
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
        code: 'websocket_clients_failed'
      }
    } as ErrorResponseBody)
  }
})

export { router as vcpRoutes }
