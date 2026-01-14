/**
 * MCP Bridge Service
 *
 * 提供 MCP Server 与 Cherry Studio 主程序之间的桥接能力
 * - 复用 Cherry 客户端的模型配置
 * - 通过 IPC 调用 Renderer 进程的 AI 服务
 * - 访问知识库和向量检索
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'

import { MCPError, PluginError, PluginErrorCode } from '../../errors'
import { windowService } from '../../services/WindowService'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronIpcMain: typeof import('electron').ipcMain | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronIpcMain = require('electron').ipcMain
} catch {
  // electron 未就绪
}

const logger = loggerService.withContext('MCPBridge')

// 请求超时时间（毫秒）
const DEFAULT_TIMEOUT = 120000 // 2 分钟
const LONG_TIMEOUT = 300000 // 5 分钟（用于图片生成等长时间操作）

// ==================== 类型定义 ====================

/**
 * 桥接请求配置
 */
interface BridgeRequestConfig {
  /** 超时时间 (ms) */
  timeout?: number
  /** 重试次数 */
  retries?: number
  /** 操作名称 (用于日志) */
  operation?: string
}

/**
 * 待处理请求
 */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  timeout: NodeJS.Timeout
  operation?: string
  startTime: number
}

/**
 * 桥接响应
 */
interface BridgeResponse<T = unknown> {
  requestId: string
  success: boolean
  data?: T
  error?: string
  errorCode?: number
}

/**
 * 生成唯一请求 ID
 */
function generateRequestId(prefix: string = 'req'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * MCP 桥接服务
 * 统一处理 MCP Server 与 Renderer 进程的通信
 */
export class MCPBridge {
  private static instance: MCPBridge
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private isShuttingDown = false

  private constructor() {
    this.setupIPCListeners()
  }

  static getInstance(): MCPBridge {
    if (!MCPBridge.instance) {
      MCPBridge.instance = new MCPBridge()
    }
    return MCPBridge.instance
  }

  /**
   * 设置 IPC 监听器
   */
  private setupIPCListeners(): void {
    if (!electronIpcMain) {
      logger.warn('electronIpcMain not available, skipping IPC listeners setup')
      return
    }

    // 监听来自 Renderer 的响应
    electronIpcMain.on(IpcChannel.MCP_Bridge_Response, (_event, response: BridgeResponse) => {
      const { requestId, success, data, error, errorCode } = response
      const pending = this.pendingRequests.get(requestId)

      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(requestId)

        const duration = Date.now() - pending.startTime

        if (success) {
          logger.debug('Bridge request completed', {
            requestId,
            operation: pending.operation,
            duration
          })
          pending.resolve(data)
        } else {
          logger.warn('Bridge request failed', {
            requestId,
            operation: pending.operation,
            error,
            errorCode,
            duration
          })
          // 使用统一错误类型
          const pluginError = new PluginError(errorCode || PluginErrorCode.Internal, error || 'Unknown bridge error', {
            context: {
              operation: pending.operation,
              metadata: { requestId, duration }
            },
            userMessage: {
              title: 'Bridge Error',
              description: error || 'Request to renderer failed',
              retryable: true
            }
          })
          pending.reject(pluginError)
        }
      } else {
        logger.warn('Received response for unknown request', { requestId })
      }
    })

    logger.info('MCPBridge IPC listeners initialized')
  }

  /**
   * 发送请求到 Renderer 进程并等待响应
   */
  private async sendRequest<T>(
    channel: string,
    payload: Record<string, unknown>,
    config: BridgeRequestConfig = {}
  ): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, operation = 'unknown' } = config

    // 检查是否正在关闭
    if (this.isShuttingDown) {
      throw new PluginError(PluginErrorCode.Cancelled, 'Bridge is shutting down', {
        context: { operation }
      })
    }

    const mainWindow = windowService.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new MCPError(PluginErrorCode.MCPConnectionFailed, 'Main window not available', {
        userMessage: {
          title: 'Window Not Available',
          description: 'The main application window is not ready',
          suggestion: 'Please wait for the application to fully load',
          retryable: true
        }
      })
    }

    const requestId = generateRequestId()
    const startTime = Date.now()

    return new Promise<T>((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        const timeoutError = new PluginError(PluginErrorCode.Timeout, `Request timeout after ${timeout}ms`, {
          context: {
            operation,
            metadata: { requestId, timeout }
          },
          userMessage: {
            title: 'Request Timeout',
            description: `The ${operation} operation took too long`,
            suggestion: 'Try again or check your connection',
            retryable: true
          }
        })
        logger.warn('Bridge request timeout', {
          requestId,
          operation,
          timeout
        })
        reject(timeoutError)
      }, timeout)

      // 保存待处理请求
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject: reject as (reason?: unknown) => void,
        timeout: timeoutId,
        operation,
        startTime
      })

      // 发送请求到 Renderer
      logger.debug('Sending bridge request', {
        requestId,
        channel,
        operation
      })

      mainWindow.webContents.send(channel, {
        requestId,
        ...payload
      })
    })
  }

  // ==================== AI 服务调用 ====================

  /**
   * 视觉分析（分析图片）
   */
  async visionAnalysis(params: {
    images: Array<{ base64?: string; path?: string; url?: string }>
    systemPrompt?: string
    userPrompt: string
    providerId?: string
    modelId?: string
  }): Promise<string> {
    logger.debug('MCPBridge.visionAnalysis', { imageCount: params.images.length })

    return this.sendRequest<string>(
      IpcChannel.MCP_Bridge_VisionAnalysis,
      {
        images: params.images,
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
        providerId: params.providerId,
        modelId: params.modelId
      },
      { timeout: LONG_TIMEOUT, operation: 'visionAnalysis' }
    )
  }

  /**
   * 文本生成
   */
  async generateText(params: {
    systemPrompt?: string
    userPrompt: string
    providerId?: string
    modelId?: string
  }): Promise<string> {
    logger.debug('MCPBridge.generateText', { promptLength: params.userPrompt.length })

    return this.sendRequest<string>(IpcChannel.MCP_Bridge_GenerateText, params, {
      timeout: DEFAULT_TIMEOUT,
      operation: 'generateText'
    })
  }

  /**
   * 图片生成
   */
  async generateImage(params: {
    mode: 'generate' | 'edit' | 'pattern' | 'ecom' | 'model'
    prompt: string
    systemPrompt?: string
    images?: Array<{ base64?: string; path?: string; url?: string }>
    aspectRatio?: string
    imageSize?: string
    negativePrompt?: string
    stylePreset?: string
  }): Promise<{ success: boolean; images?: string[]; error?: string }> {
    logger.debug('MCPBridge.generateImage', { mode: params.mode })

    return this.sendRequest(IpcChannel.MCP_Bridge_GenerateImage, params, {
      timeout: LONG_TIMEOUT,
      operation: 'generateImage'
    })
  }

  /**
   * 自主图片生成
   * 分析用户意图和图片，自动规划并执行多步骤生成
   */
  async autonomousGenerate(params: {
    userMessage: string
    images?: Array<{ base64?: string; path?: string; url?: string }>
    taskType?: 'ecom' | 'model' | 'pattern' | 'video' | 'auto'
    enableBack?: boolean
    enableDetail?: boolean
    aspectRatio?: string
    imageSize?: string
  }): Promise<{
    success: boolean
    taskType?: string
    images?: {
      main?: string[]
      back?: string[]
      detail?: string[]
    }
    plan?: {
      steps: Array<{ stepId: string; description: string }>
      estimatedTime: number
    }
    error?: string
  }> {
    logger.debug('MCPBridge.autonomousGenerate', {
      message: params.userMessage.substring(0, 50),
      taskType: params.taskType,
      imageCount: params.images?.length
    })

    return this.sendRequest(IpcChannel.MCP_Bridge_AutonomousGenerate, params, {
      timeout: LONG_TIMEOUT * 2,
      operation: 'autonomousGenerate'
    })
  }

  /**
   * 多Agent协同图片生成
   */
  async collaborativeGenerate(params: {
    userMessage: string
    images?: Array<{ base64?: string; path?: string; url?: string }>
    template?: 'gemini_all' | 'multi_model' | 'premium'
    taskType?: 'ecom' | 'model' | 'pattern' | 'video' | 'auto'
    maxRetries?: number
    showThinking?: boolean
  }): Promise<{
    success: boolean
    taskType?: string
    images?: {
      main?: string[]
      back?: string[]
      detail?: string[]
    }
    messages?: Array<{
      senderRole: string
      senderName: string
      content: string
      type: string
    }>
    qualityReviews?: Array<{
      passed: boolean
      score: number
      suggestions?: string[]
    }>
    stats?: {
      totalTime: number
      phases: Record<string, number>
    }
    error?: string
  }> {
    logger.debug('MCPBridge.collaborativeGenerate', {
      message: params.userMessage.substring(0, 50),
      template: params.template,
      taskType: params.taskType,
      imageCount: params.images?.length
    })

    return this.sendRequest(IpcChannel.MCP_Bridge_CollaborativeGenerate, params, {
      timeout: LONG_TIMEOUT * 3,
      operation: 'collaborativeGenerate'
    })
  }

  // ==================== 知识库服务 ====================

  /**
   * 搜索知识库
   */
  async searchKnowledge(params: {
    knowledgeBaseId: string
    query: string
    topK?: number
    threshold?: number
  }): Promise<{
    results: Array<{
      content: string
      score: number
      metadata?: Record<string, any>
    }>
  }> {
    logger.debug('MCPBridge.searchKnowledge', { kbId: params.knowledgeBaseId, query: params.query.substring(0, 50) })

    return this.sendRequest(IpcChannel.MCP_Bridge_SearchKnowledge, params, {
      timeout: DEFAULT_TIMEOUT,
      operation: 'searchKnowledge'
    })
  }

  /**
   * 获取知识库列表
   */
  async listKnowledgeBases(): Promise<
    Array<{
      id: string
      name: string
      description?: string
      documentCount?: number
    }>
  > {
    return this.sendRequest(
      IpcChannel.MCP_Bridge_ListKnowledgeBases,
      {},
      {
        timeout: DEFAULT_TIMEOUT,
        operation: 'listKnowledgeBases'
      }
    )
  }

  // ==================== 工作流服务 ====================

  /**
   * 执行工作流
   */
  async executeWorkflow(params: { workflowId: string; inputs?: Record<string, any> }): Promise<{
    success: boolean
    outputs?: Record<string, any>
    error?: string
  }> {
    logger.debug('MCPBridge.executeWorkflow', { workflowId: params.workflowId })

    return this.sendRequest(IpcChannel.MCP_Bridge_ExecuteWorkflow, params, {
      timeout: LONG_TIMEOUT,
      operation: 'executeWorkflow'
    })
  }

  /**
   * 获取工作流列表
   */
  async listWorkflows(): Promise<
    Array<{
      id: string
      name: string
      description?: string
      tags?: string[]
    }>
  > {
    return this.sendRequest(
      IpcChannel.MCP_Bridge_ListWorkflows,
      {},
      {
        timeout: DEFAULT_TIMEOUT,
        operation: 'listWorkflows'
      }
    )
  }

  /**
   * 网络搜索
   */
  async webSearch(params: { query: string; providerId?: string; maxResults?: number }): Promise<{
    results: Array<{
      title: string
      url: string
      content: string
      score?: number
    }>
  }> {
    logger.debug('MCPBridge.webSearch', { query: params.query.substring(0, 50) })

    return this.sendRequest(IpcChannel.MCP_Bridge_WebSearch, params, {
      timeout: DEFAULT_TIMEOUT,
      operation: 'webSearch'
    })
  }

  // ==================== 工具方法 ====================

  /**
   * 清理所有待处理请求
   */
  cleanup(): void {
    for (const [_requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('MCPBridge cleanup'))
    }
    this.pendingRequests.clear()
  }
}

// 导出单例
export const mcpBridge = MCPBridge.getInstance()
