/**
 * 工作流 IPC 桥接服务
 * Workflow IPC Bridge Service
 *
 * 处理 Main 进程 MCP Server 和 VCP 插件发来的请求
 * - 图片生成请求
 * - 节点执行请求（VCP 工具调用）
 *
 * @version 2.0.0
 * @created 2024-12-19
 * @updated 2025-01-02
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'

import { getNodeExecutor } from '../nodes'
import type { NodeExecutionContext, NodeExecutionResult } from '../nodes/base/types'

const logger = loggerService.withContext('WorkflowIpcBridge')

/**
 * 图片生成请求参数
 */
interface GenerateImageRequest {
  requestId: string
  mode: 'generate' | 'edit' | 'pattern' | 'ecom' | 'model'
  prompt: string
  systemPrompt?: string
  images?: Array<{ base64?: string; path?: string; url?: string }>
  aspectRatio?: string
  imageSize?: string
  negativePrompt?: string
  stylePreset?: string
}

/**
 * 图片生成响应
 */
interface GenerateImageResponse {
  success: boolean
  requestId: string
  image?: string
  images?: string[]
  error?: string
}

/**
 * 工作流 IPC 桥接类
 * 单例模式，在应用启动时初始化
 */
class WorkflowIpcBridgeService {
  private initialized = false

  /**
   * 初始化 IPC 监听器
   * 在 Renderer 进程启动时调用
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('WorkflowIpcBridge already initialized')
      return
    }

    logger.info('Initializing WorkflowIpcBridge')

    // 监听图片生成请求
    this.registerGenerateImageHandler()

    // 监听节点执行请求
    this.registerExecuteNodeHandler()

    this.initialized = true
    logger.info('WorkflowIpcBridge initialized successfully')
  }

  /**
   * 注册图片生成处理器
   */
  private registerGenerateImageHandler(): void {
    // 使用 window.api 访问 preload 暴露的 IPC 接口
    // 如果项目使用 contextBridge，需要通过 window.api 访问
    const { ipcRenderer } = window.require?.('electron') || {}

    if (!ipcRenderer) {
      logger.warn('ipcRenderer not available, IPC bridge disabled')
      return
    }

    ipcRenderer.on(IpcChannel.Workflow_GenerateImage, async (_event: unknown, request: GenerateImageRequest) => {
      logger.info('Received generate_image request', {
        requestId: request.requestId,
        mode: request.mode
      })

      try {
        // 执行图片生成
        const result = await this.handleGenerateImage(request)

        // 发送响应回 Main 进程
        const responseChannel = `${IpcChannel.Workflow_GenerateImage}:response:${request.requestId}`
        ipcRenderer.send(responseChannel, result)
      } catch (error) {
        logger.error('Failed to handle generate_image request', { error })

        const responseChannel = `${IpcChannel.Workflow_GenerateImage}:response:${request.requestId}`
        ipcRenderer.send(responseChannel, {
          success: false,
          requestId: request.requestId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })

    logger.debug('Registered Workflow_GenerateImage handler')
  }

  /**
   * 注册节点执行处理器
   * 处理来自 VCP WorkflowBridge 的节点执行请求
   */
  private registerExecuteNodeHandler(): void {
    const { ipcRenderer } = window.require?.('electron') || {}

    if (!ipcRenderer) {
      return
    }

    // 监听来自 VCP 的节点执行请求
    ipcRenderer.on(
      'workflow:execute-node',
      async (
        _event: unknown,
        request: {
          requestId: string
          nodeType: string
          inputs: Record<string, unknown>
          config: Record<string, unknown>
        }
      ) => {
        logger.info('Received VCP node execution request', {
          requestId: request.requestId,
          nodeType: request.nodeType
        })

        try {
          const result = await this.executeNode(request.nodeType, request.inputs, request.config)

          // 发送结果回 Main 进程
          ipcRenderer.invoke(`workflow:node-result:${request.requestId}`, result)
        } catch (error) {
          logger.error('Node execution failed', { error, nodeType: request.nodeType })
          ipcRenderer.invoke(`workflow:node-result:${request.requestId}`, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    )

    // 保持原有的 IPC Channel 处理
    ipcRenderer.on(
      IpcChannel.Workflow_ExecuteNode,
      async (_event: unknown, request: { requestId: string; nodeType: string; inputs: unknown; config: unknown }) => {
        logger.info('Received execute_node request', {
          requestId: request.requestId,
          nodeType: request.nodeType
        })

        try {
          const result = await this.executeNode(
            request.nodeType,
            request.inputs as Record<string, unknown>,
            request.config as Record<string, unknown>
          )

          const responseChannel = `${IpcChannel.Workflow_ExecuteNode}:response:${request.requestId}`
          ipcRenderer.send(responseChannel, {
            success: result.status === 'success',
            requestId: request.requestId,
            outputs: result.outputs,
            error: result.errorMessage
          })
        } catch (error) {
          const responseChannel = `${IpcChannel.Workflow_ExecuteNode}:response:${request.requestId}`
          ipcRenderer.send(responseChannel, {
            success: false,
            requestId: request.requestId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    )

    logger.debug('Registered Workflow node execution handlers')
  }

  /**
   * 执行指定类型的节点
   */
  private async executeNode(
    nodeType: string,
    inputs: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<NodeExecutionResult> {
    logger.debug('Executing node', { nodeType, inputs, config })

    // 获取节点执行器
    const executor = getNodeExecutor(nodeType)

    if (!executor) {
      logger.error('Node executor not found', { nodeType })
      return {
        status: 'error',
        outputs: {},
        errorMessage: `未找到节点执行器: ${nodeType}`
      }
    }

    // 创建执行上下文
    const context: NodeExecutionContext = {
      nodeId: `vcp-${Date.now()}`,
      workflowId: 'vcp-execution',
      log: (message: string, data?: Record<string, unknown>) => {
        logger.info(`[${nodeType}] ${message}`, data)
      },
      onProgress: () => {},
      abortSignal: undefined
    }

    try {
      // 执行节点
      const result = await executor.execute(inputs, config, context)

      logger.info('Node execution completed', {
        nodeType,
        status: result.status,
        duration: result.duration
      })

      return result
    } catch (error) {
      logger.error('Node execution error', { nodeType, error })
      return {
        status: 'error',
        outputs: {},
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 处理图片生成请求
   *
   * 注意：完整实现需要从 Redux store 获取当前配置的 Provider 和 Model
   * 目前返回待实现的提示
   */
  private async handleGenerateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const { requestId, prompt } = request

    try {
      // TODO: 完整实现需要：
      // 1. 从 Redux store 获取当前配置的 provider 和 model
      // 2. 调用 WorkflowAiService.generateImage(provider, model, params)
      //
      // 示例代码：
      // const state = store.getState()
      // const provider = state.settings.defaultProvider
      // const model = state.settings.defaultImageModel
      // const result = await WorkflowAiService.generateImage(provider, model, params)

      logger.info('handleGenerateImage called', {
        requestId,
        promptLength: prompt?.length
      })

      // 暂时返回待实现提示
      return {
        success: true,
        requestId,
        error: '图片生成 IPC 桥接尚未完全实现。需要配置 Provider 和 Model 后才能使用。'
      }
    } catch (error) {
      logger.error('handleGenerateImage failed', { error, requestId })
      return {
        success: false,
        requestId,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 准备图片数据（转换为 Base64）
   * @internal 保留供完整实现时使用
   */
  // @ts-expect-error - Reserved for future implementation
  private async prepareImages(images: Array<{ base64?: string; path?: string; url?: string }>): Promise<string[]> {
    const results: string[] = []

    for (const img of images) {
      try {
        if (img.base64) {
          // 已经是 Base64
          results.push(img.base64)
        } else if (img.path) {
          // 从本地文件读取
          const base64 = await this.readFileAsBase64(img.path)
          if (base64) {
            results.push(base64)
          }
        } else if (img.url) {
          // 从 URL 获取
          const base64 = await this.fetchUrlAsBase64(img.url)
          if (base64) {
            results.push(base64)
          }
        }
      } catch (error) {
        logger.warn('Failed to prepare image', { error, img })
      }
    }

    return results
  }

  /**
   * 读取本地文件为 Base64
   */
  private async readFileAsBase64(filePath: string): Promise<string | null> {
    try {
      // 使用 IPC 调用 Main 进程读取文件
      const result = await window.api?.file?.base64Image?.(filePath)
      if (typeof result === 'string') {
        return result
      }
      if (result && typeof result === 'object' && 'base64' in result) {
        return (result as { base64: string }).base64
      }
      return null
    } catch (error) {
      logger.error('Failed to read file as base64', { error, filePath })
      return null
    }
  }

  /**
   * 从 URL 获取图片为 Base64
   */
  private async fetchUrlAsBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          // 提取 Base64 部分
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      logger.error('Failed to fetch URL as base64', { error, url })
      return null
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (!this.initialized) return

    const { ipcRenderer } = window.require?.('electron') || {}
    if (ipcRenderer) {
      ipcRenderer.removeAllListeners(IpcChannel.Workflow_GenerateImage)
      ipcRenderer.removeAllListeners(IpcChannel.Workflow_ExecuteNode)
      ipcRenderer.removeAllListeners('workflow:execute-node')
    }

    this.initialized = false
    logger.info('WorkflowIpcBridge disposed')
  }
}

/**
 * 导出单例实例
 */
export const workflowIpcBridge = new WorkflowIpcBridgeService()

/**
 * 初始化函数，在应用启动时调用
 */
export function initializeWorkflowIpcBridge(): void {
  workflowIpcBridge.initialize()
}
