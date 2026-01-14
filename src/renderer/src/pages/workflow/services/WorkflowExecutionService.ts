/**
 * 统一工作流执行服务
 *
 * 提供统一的工作流执行入口，解决执行入口分裂问题：
 * - 统一的回调接口
 * - 单例模式管理 WorkflowEngine 实例
 * - 统一的 Provider 同步机制
 *
 * @see P0: 工作流执行入口统一
 */

import { loggerService } from '@logger'
import type { Model, Provider } from '@renderer/types'

import { ExecutionContextManager } from '../engine/ExecutionContext'
import { WorkflowEngine } from '../engine/WorkflowEngine'
import type { Workflow, WorkflowEdge, WorkflowNode } from '../types'

const logger = loggerService.withContext('WorkflowExecutionService')

/**
 * 统一的执行回调接口
 */
export interface ExecutionCallbacks {
  /** 节点状态变更 */
  onNodeStatusChange?: (nodeId: string, status: string, errorMessage?: string) => void
  /** 节点输出 */
  onNodeOutput?: (nodeId: string, outputs: Record<string, any>) => Promise<void> | void
  /** 进度更新 */
  onProgress?: (progress: number, message: string) => void
  /** 自动导出 */
  onAutoExport?: (exportedFiles: { filePath: string; fileType: string }[]) => void
}

/**
 * 执行选项
 */
export interface ExecutionOptions {
  /** 从指定节点开始执行（用于重试） */
  startFromNodeId?: string
  /** 上一次执行的上下文（用于重试） */
  previousContext?: any
  /** 最大重试次数 */
  maxRetries?: number
  /** 是否并行执行 */
  parallelExecution?: boolean
  /** 最大并发数 */
  maxConcurrency?: number
  /** 取消信号 */
  abortSignal?: AbortSignal
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  workflowId: string
  status: 'completed' | 'failed' | 'cancelled'
  errors: string[]
  exportedFiles?: { filePath: string; fileType: string }[]
  context?: any
  /** 序列化后的上下文（用于 Redux） */
  serializedContext?: any
  /** 失败的节点 ID */
  failedNodeId?: string
}

/**
 * 统一工作流执行服务类
 */
class WorkflowExecutionServiceClass {
  /** 单例 WorkflowEngine 实例 */
  private engine: WorkflowEngine
  /** 当前配置的 Providers */
  private providers: Provider[] = []
  /** 当前默认模型 */
  private defaultModel?: Model

  constructor() {
    this.engine = new WorkflowEngine()
    logger.info('WorkflowExecutionService initialized')
  }

  /**
   * 设置 Providers
   */
  setProviders(providers: Provider[]): void {
    this.providers = providers
    this.engine.setProviders(providers)
    logger.debug('Providers updated', { count: providers.length })
  }

  /**
   * 设置默认模型
   */
  setDefaultModel(model: Model): void {
    this.defaultModel = model
    this.engine.setDefaultModel(model)
  }

  /**
   * 获取当前 Providers
   */
  getProviders(): Provider[] {
    return this.providers
  }

  /**
   * 构建工作流对象
   */
  buildWorkflow(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    metadata?: { id?: string; name?: string; createdAt?: number }
  ): Workflow {
    return {
      id: metadata?.id || `workflow-${Date.now()}`,
      name: metadata?.name || '临时工作流',
      nodes,
      edges,
      createdAt: metadata?.createdAt || Date.now(),
      updatedAt: Date.now()
    }
  }

  /**
   * 执行工作流 - 统一入口
   *
   * @param workflow 工作流对象
   * @param callbacks 回调函数
   * @param options 执行选项
   * @returns 执行结果
   */
  async execute(
    workflow: Workflow,
    callbacks?: ExecutionCallbacks,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    logger.info('Executing workflow', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      nodeCount: workflow.nodes.length,
      hasRetryNode: !!options?.startFromNodeId
    })

    // 确保 Providers 已设置
    this.engine.setProviders(this.providers)
    if (this.defaultModel) {
      this.engine.setDefaultModel(this.defaultModel)
    }

    try {
      const result = await this.engine.executeWorkflow(
        workflow,
        {
          onNodeStatusChange: callbacks?.onNodeStatusChange,
          onNodeOutput: callbacks?.onNodeOutput,
          onProgress: callbacks?.onProgress,
          onAutoExport: callbacks?.onAutoExport
        },
        undefined, // autoExportConfig - 使用默认配置
        {
          startFromNodeId: options?.startFromNodeId,
          previousContext: options?.previousContext,
          maxRetries: options?.maxRetries,
          parallelExecution: options?.parallelExecution,
          maxConcurrency: options?.maxConcurrency,
          abortSignal: options?.abortSignal
        }
      )

      // 序列化上下文以避免 Redux 非序列化警告
      const serializedContext = result.context ? ExecutionContextManager.serialize(result.context) : undefined

      logger.info('Workflow execution completed', {
        workflowId: workflow.id,
        status: result.status,
        errorCount: result.errors.length
      })

      return {
        workflowId: result.workflowId,
        status: result.status,
        errors: result.errors,
        exportedFiles: result.exportedFiles,
        context: result.context,
        serializedContext,
        failedNodeId: result.context?.failedNodeId
      }
    } catch (error) {
      logger.error('Workflow execution error', {
        workflowId: workflow.id,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        workflowId: workflow.id,
        status: 'failed',
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  /**
   * 取消执行
   *
   * @param context 执行上下文
   */
  cancel(context: any): void {
    this.engine.cancel(context)
    logger.info('Execution cancelled')
  }

  /**
   * 执行单个节点
   * 用于调试或单步执行场景
   *
   * @param nodeId 要执行的节点 ID
   * @param nodes 所有节点
   * @param edges 所有边
   * @param existingOutputs 已有的上游节点输出
   * @param callbacks 回调函数
   * @returns 执行结果
   */
  async executeSingleNode(
    nodeId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    existingOutputs?: Map<string, Record<string, any>>,
    callbacks?: {
      onNodeStatusChange?: (nodeId: string, status: string, errorMessage?: string) => void
      onNodeOutput?: (nodeId: string, outputs: Record<string, any>) => Promise<void> | void
      onProgress?: (progress: number, message: string) => void
    }
  ): Promise<{
    nodeId: string
    status: 'success' | 'error' | 'skipped'
    outputs: Record<string, any>
    errorMessage?: string
    duration: number
  }> {
    logger.info('Executing single node', { nodeId })

    // 确保 Providers 已设置
    this.engine.setProviders(this.providers)
    if (this.defaultModel) {
      this.engine.setDefaultModel(this.defaultModel)
    }

    try {
      const result = await this.engine.executeSingleNode(nodeId, nodes, edges, existingOutputs, {
        onNodeStart: (id) => {
          callbacks?.onNodeStatusChange?.(id, 'running')
        },
        onNodeComplete: async (nodeResult) => {
          if (nodeResult.status === 'success') {
            callbacks?.onNodeStatusChange?.(nodeResult.nodeId!, 'completed')
            try {
              await callbacks?.onNodeOutput?.(nodeResult.nodeId!, nodeResult.outputs)
            } catch (callbackError) {
              logger.error('onNodeOutput callback error', {
                nodeId: nodeResult.nodeId,
                error: callbackError instanceof Error ? callbackError.message : String(callbackError)
              })
            }
          } else if (nodeResult.status === 'error') {
            callbacks?.onNodeStatusChange?.(nodeResult.nodeId!, 'error', nodeResult.errorMessage)
          }
        },
        onProgress: callbacks?.onProgress
      })

      logger.info('Single node execution completed', {
        nodeId,
        status: result.status,
        duration: result.duration
      })

      return {
        nodeId: result.nodeId!,
        status: result.status,
        outputs: result.outputs,
        errorMessage: result.errorMessage,
        duration: result.duration ?? 0
      }
    } catch (error) {
      logger.error('Single node execution error', {
        nodeId,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        nodeId,
        status: 'error',
        outputs: {},
        errorMessage: error instanceof Error ? error.message : String(error),
        duration: 0
      }
    }
  }

  /**
   * 获取引擎实例（仅用于兼容性，不推荐直接使用）
   * @deprecated 请使用 execute() 方法
   */
  getEngine(): WorkflowEngine {
    return this.engine
  }
}

/**
 * 导出单例实例
 */
export const workflowExecutionService = new WorkflowExecutionServiceClass()
