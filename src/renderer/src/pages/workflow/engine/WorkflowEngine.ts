/**
 * 工作流执行引擎 - Cherry Studio 本土化版本
 *
 * 核心职责：
 * 1. 按拓扑顺序执行工作流节点
 * 2. 通过连线传递数据（不使用步骤 ID 引用）
 * 3. 使用 Cherry Studio 原生的 AI 调用机制
 * 4. 管理执行状态和错误处理
 */

import { loggerService } from '@logger'

import { getNodeExecutor, initializeNodeSystem } from '../nodes'
import type { Workflow, WorkflowEdge, WorkflowNode } from '../types'
import { buildExecutionLevels, buildExecutionOrder } from '../types'
// 从 core.ts 导入统一的类型定义（避免重复定义）
import type { NodeExecutionResult } from '../types/core'
// P2 优化：从 types/errors.ts 导入错误类型（而非 ErrorHandler.ts）
import { ErrorType } from '../types/errors'
import {
  type AutoExportConfig,
  DEFAULT_AUTO_EXPORT_CONFIG,
  executeAutoExport,
  findUnconnectedOutputs
} from '../utils/autoExport'
import { ConcurrencyLimiter } from '../utils/ConcurrencyLimiter'
import { DataFlowMapper } from './DataFlowMapper'
import { extractSingleImage, getFallbackValue, wrapAsImageArray } from './TypeFallbackConfig'

// 调试模式：开发环境启用详细日志，生产环境仅输出警告和错误
const DEBUG_MODE = process.env.NODE_ENV === 'development'

const baseLogger = loggerService.withContext('WorkflowEngine')

// 包装 logger，根据 DEBUG_MODE 控制 info/debug 级别日志
const logger = {
  debug: DEBUG_MODE
    ? baseLogger.debug.bind(baseLogger)
    : () => {
        /* 生产环境静默 */
      },
  info: DEBUG_MODE
    ? baseLogger.info.bind(baseLogger)
    : () => {
        /* 生产环境静默 */
      },
  warn: baseLogger.warn.bind(baseLogger),
  error: baseLogger.error.bind(baseLogger)
}

// ==================== 执行上下文 ====================

// 重新导出 NodeExecutionResult 以保持向后兼容
export type { NodeExecutionResult }

/**
 * 工作流执行上下文
 * 存储执行过程中的中间数据
 *
 * 注意：这个接口与 core.ts 中的 WorkflowExecutionContext 略有不同，
 * 包含一些引擎特定的字段（如 idle 状态、abortController 等）
 */
export interface WorkflowExecutionContext {
  workflowId: string
  startTime: number
  // 节点输出数据: nodeId -> handleId -> value
  nodeOutputs: Map<string, Record<string, any>>
  // 节点执行结果
  nodeResults: Map<string, NodeExecutionResult>
  // 执行状态（包含 idle 状态）
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  // 错误信息
  error?: string
  // 取消信号
  abortController?: AbortController
  // 当前批次索引（从 1 开始，用于批次分文件夹导出）
  currentBatchIndex?: number
  // 总批次数
  totalBatches?: number
  // 失败的节点 ID（用于重试）
  failedNodeId?: string
  // 重试计数
  retryCount?: number
  // 最大重试次数
  maxRetries?: number
}

// ==================== 工作流执行引擎 ====================

export class WorkflowEngine {
  private nodeSystemInitialized = false
  private providers: any[] = []
  private defaultModel: any = null

  constructor() {
    // 初始化节点系统（异步，不阻塞构造函数）
    this.initNodeSystem()

    logger.info('WorkflowEngine initialized')
  }

  /**
   * 设置 AI Providers
   */
  setProviders(providers: any[]) {
    this.providers = providers
    logger.debug('Providers updated', { count: providers.length })
  }

  /**
   * 获取 Providers
   */
  getProviders() {
    return this.providers
  }

  /**
   * 设置默认模型
   */
  setDefaultModel(model: any) {
    this.defaultModel = model
    logger.debug('Default model updated', { model })
  }

  /**
   * 获取默认模型
   */
  getDefaultModel() {
    return this.defaultModel
  }

  /**
   * 初始化节点系统
   */
  private async initNodeSystem() {
    if (this.nodeSystemInitialized) return
    try {
      await initializeNodeSystem()
      this.nodeSystemInitialized = true
      logger.info('Node system initialized')
    } catch (error) {
      logger.error('Failed to initialize node system', { error })
    }
  }

  /**
   * 执行工作流
   * @param workflow 工作流定义
   * @param onNodeStart 节点开始回调
   * @param onNodeComplete 节点完成回调
   * @param onProgress 进度回调
   * @param options 执行选项
   */
  async execute(
    workflow: Workflow,
    onNodeStart?: (nodeId: string) => void,
    onNodeComplete?: (result: NodeExecutionResult) => void | Promise<void>,
    onProgress?: (progress: number, message: string) => void,
    options?: {
      startFromNodeId?: string // 从指定节点开始执行（用于重试）
      previousContext?: WorkflowExecutionContext // 之前的执行上下文（用于恢复已完成节点的输出）
      maxRetries?: number // 最大重试次数
      abortSignal?: AbortSignal // 外部取消信号
      parallelExecution?: boolean // 是否启用并行执行（默认 true）
      maxConcurrency?: number // 最大并发数（默认 3）
    }
  ): Promise<WorkflowExecutionContext> {
    const parallelExecution = options?.parallelExecution ?? true
    const maxConcurrency = options?.maxConcurrency ?? 3

    const context: WorkflowExecutionContext = {
      workflowId: workflow.id,
      startTime: Date.now(),
      nodeOutputs: options?.previousContext?.nodeOutputs || new Map(),
      nodeResults: options?.previousContext?.nodeResults || new Map(),
      status: 'running',
      abortController: new AbortController(),
      maxRetries: options?.maxRetries ?? 3,
      retryCount: options?.previousContext?.retryCount ?? 0
    }

    // 连接外部取消信号到内部 AbortController
    // 这样当 TaskQueue 取消任务时，引擎内部的取消链路也会被触发
    if (options?.abortSignal) {
      options.abortSignal.addEventListener(
        'abort',
        () => {
          context.abortController?.abort()
          logger.info('External abort signal received, cancelling workflow', {
            workflowId: workflow.id
          })
        },
        { once: true }
      )

      // 如果外部信号已经被取消，立即取消内部 controller
      if (options.abortSignal.aborted) {
        context.abortController?.abort()
        context.status = 'cancelled'
        logger.info('Workflow cancelled immediately (external signal already aborted)', {
          workflowId: workflow.id
        })
        return context
      }
    }

    logger.info('Starting workflow execution', {
      workflowId: workflow.id,
      nodeCount: workflow.nodes.length,
      startFromNodeId: options?.startFromNodeId,
      isRetry: !!options?.startFromNodeId
    })

    // 打印所有边信息用于调试
    logger.debug('[execute] All edges', {
      edgeCount: workflow.edges.length,
      edges: workflow.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle
      }))
    })

    // 打印所有节点的输入/输出端口定义
    logger.debug('[execute] All nodes with ports', {
      nodes: workflow.nodes.map((n) => ({
        id: n.id,
        label: n.data.label,
        nodeType: n.data.nodeType,
        inputPorts: n.data.inputs?.map((h) => h.id) || [],
        outputPorts: n.data.outputs?.map((h) => h.id) || []
      }))
    })

    try {
      // 预编译边映射，优化 collectInputs 性能
      const dataFlowMapper = new DataFlowMapper(workflow.edges)
      logger.debug('[execute] DataFlowMapper compiled', dataFlowMapper.getStats())

      // 根据执行模式选择执行策略
      if (parallelExecution && !options?.startFromNodeId) {
        // 并行执行模式：按层级并行执行
        await this.executeParallel(
          workflow,
          context,
          dataFlowMapper,
          maxConcurrency,
          onNodeStart,
          onNodeComplete,
          onProgress
        )
      } else {
        // 串行执行模式：按拓扑顺序逐个执行
        // 当需要从特定节点重试时，使用串行模式以保证正确的恢复顺序
        await this.executeSequential(
          workflow,
          context,
          dataFlowMapper,
          options?.startFromNodeId,
          onNodeStart,
          onNodeComplete,
          onProgress
        )
      }

      // 设置最终状态
      if (context.status === 'running') {
        context.status = 'completed'
      }

      onProgress?.(100, '工作流执行完成')
      logger.info('Workflow execution completed', {
        workflowId: workflow.id,
        status: context.status,
        duration: Date.now() - context.startTime,
        mode: parallelExecution ? 'parallel' : 'sequential'
      })
    } catch (error) {
      context.status = 'failed'
      context.error = error instanceof Error ? error.message : String(error)
      logger.error('Workflow execution error', { workflowId: workflow.id, error: context.error })
    }

    return context
  }

  /**
   * 串行执行工作流（原有逻辑）
   */
  private async executeSequential(
    workflow: Workflow,
    context: WorkflowExecutionContext,
    dataFlowMapper: DataFlowMapper,
    startFromNodeId?: string,
    onNodeStart?: (nodeId: string) => void,
    onNodeComplete?: (result: NodeExecutionResult) => void | Promise<void>,
    onProgress?: (progress: number, message: string) => void
  ): Promise<void> {
    // 构建执行顺序（拓扑排序）
    const executionOrder = buildExecutionOrder(workflow.nodes, workflow.edges)
    const totalNodes = executionOrder.length

    // 如果指定了从某个节点开始，找到该节点的索引
    let startIndex = 0
    if (startFromNodeId) {
      const foundIndex = executionOrder.findIndex((n) => n.id === startFromNodeId)
      if (foundIndex >= 0) {
        startIndex = foundIndex
        logger.info('Resuming from node', {
          nodeId: startFromNodeId,
          nodeIndex: startIndex,
          totalNodes
        })
      } else {
        logger.warn('Start node not found in execution order, starting from beginning', {
          startFromNodeId
        })
      }
    }

    // 按顺序执行节点（从 startIndex 开始）
    for (let i = startIndex; i < executionOrder.length; i++) {
      const node = executionOrder[i]

      // 检查是否取消
      if (context.abortController?.signal.aborted) {
        context.status = 'cancelled'
        logger.info('Workflow cancelled', { workflowId: workflow.id })
        break
      }

      // 通知节点开始
      onNodeStart?.(node.id)
      onProgress?.(((i - startIndex) / (totalNodes - startIndex)) * 100, `执行节点: ${node.data.label}`)

      // 执行节点
      const result = await this.executeNode(node, workflow.nodes, workflow.edges, context, dataFlowMapper)

      // 存储结果
      context.nodeResults.set(node.id, result)

      // 通知节点完成 - 使用 await + try/catch 处理回调
      try {
        await onNodeComplete?.(result)
      } catch (callbackError) {
        logger.error('onNodeComplete callback error', {
          nodeId: node.id,
          error: callbackError instanceof Error ? callbackError.message : String(callbackError)
        })
      }

      // 如果节点执行失败，记录失败节点并停止工作流
      if (result.status === 'error') {
        context.status = 'failed'
        context.error = result.errorMessage
        context.failedNodeId = node.id
        context.retryCount = (context.retryCount || 0) + 1
        logger.error('Node execution failed', {
          nodeId: node.id,
          error: result.errorMessage,
          retryCount: context.retryCount,
          maxRetries: context.maxRetries
        })
        break
      }
    }
  }

  /**
   * 并行执行工作流
   * 按层级执行：同一层级的节点并行执行，不同层级按顺序执行
   */
  private async executeParallel(
    workflow: Workflow,
    context: WorkflowExecutionContext,
    dataFlowMapper: DataFlowMapper,
    maxConcurrency: number,
    onNodeStart?: (nodeId: string) => void,
    onNodeComplete?: (result: NodeExecutionResult) => void | Promise<void>,
    onProgress?: (progress: number, message: string) => void
  ): Promise<void> {
    // 构建执行层级
    const executionLevels = buildExecutionLevels(workflow.nodes, workflow.edges)
    const totalNodes = workflow.nodes.length
    let completedNodes = 0

    // 创建并发限制器
    const limiter = new ConcurrencyLimiter(maxConcurrency)

    logger.info('[executeParallel] Starting parallel execution', {
      workflowId: workflow.id,
      totalLevels: executionLevels.length,
      maxConcurrency,
      levelBreakdown: executionLevels.map((l) => ({
        level: l.level,
        nodeCount: l.nodes.length,
        nodes: l.nodes.map((n) => n.data.label)
      }))
    })

    // 按层级执行
    for (const level of executionLevels) {
      // 检查是否取消
      if (context.abortController?.signal.aborted) {
        context.status = 'cancelled'
        logger.info('Workflow cancelled', { workflowId: workflow.id, level: level.level })
        break
      }

      logger.info(`[executeParallel] Executing level ${level.level}`, {
        nodeCount: level.nodes.length,
        nodes: level.nodes.map((n) => n.data.label)
      })

      // 层级内的节点并行执行
      if (level.nodes.length === 1) {
        // 只有一个节点，直接执行（避免并发控制开销）
        const node = level.nodes[0]

        onNodeStart?.(node.id)
        onProgress?.((completedNodes / totalNodes) * 100, `执行节点: ${node.data.label}`)

        const result = await this.executeNode(node, workflow.nodes, workflow.edges, context, dataFlowMapper)
        context.nodeResults.set(node.id, result)
        completedNodes++

        try {
          await onNodeComplete?.(result)
        } catch (callbackError) {
          logger.error('onNodeComplete callback error', {
            nodeId: node.id,
            error: callbackError instanceof Error ? callbackError.message : String(callbackError)
          })
        }

        if (result.status === 'error') {
          context.status = 'failed'
          context.error = result.errorMessage
          context.failedNodeId = node.id
          context.retryCount = (context.retryCount || 0) + 1
          logger.error('Node execution failed', {
            nodeId: node.id,
            error: result.errorMessage,
            level: level.level
          })
          break
        }
      } else {
        // 多个节点，使用并发限制器并行执行
        const levelStartTime = Date.now()

        // 通知所有节点开始
        level.nodes.forEach((node) => onNodeStart?.(node.id))

        onProgress?.(
          (completedNodes / totalNodes) * 100,
          `并行执行层级 ${level.level}: ${level.nodes.map((n) => n.data.label).join(', ')}`
        )

        // 创建执行任务
        const tasks = level.nodes.map((node) => async () => {
          // 检查取消
          if (context.abortController?.signal.aborted) {
            throw new Error('执行已取消')
          }

          const result = await this.executeNode(node, workflow.nodes, workflow.edges, context, dataFlowMapper)
          context.nodeResults.set(node.id, result)

          // 立即通知节点完成
          try {
            await onNodeComplete?.(result)
          } catch (callbackError) {
            logger.error('onNodeComplete callback error', {
              nodeId: node.id,
              error: callbackError instanceof Error ? callbackError.message : String(callbackError)
            })
          }

          return { node, result }
        })

        // 使用 allSettled 确保所有任务都完成（即使部分失败）
        const results = await limiter.allSettled(tasks, {
          signal: context.abortController?.signal
        })

        completedNodes += level.nodes.length

        // 检查是否有失败的节点
        let hasFailure = false
        for (const settledResult of results) {
          if (settledResult.status === 'rejected') {
            const error = settledResult.reason
            if (error?.message === '执行已取消') {
              context.status = 'cancelled'
              logger.info('Workflow cancelled during parallel execution', {
                workflowId: workflow.id,
                level: level.level
              })
              break
            }
            // 其他错误由节点内部处理
          } else {
            const { node, result } = settledResult.value
            if (result.status === 'error') {
              hasFailure = true
              context.status = 'failed'
              context.error = result.errorMessage
              context.failedNodeId = node.id
              context.retryCount = (context.retryCount || 0) + 1
              logger.error('Node execution failed in parallel level', {
                nodeId: node.id,
                error: result.errorMessage,
                level: level.level
              })
              // 继续处理其他结果，但标记失败
            }
          }
        }

        logger.info(`[executeParallel] Level ${level.level} completed`, {
          duration: `${Date.now() - levelStartTime}ms`,
          nodeCount: level.nodes.length,
          hasFailure
        })

        // 如果有失败，停止执行后续层级
        if (hasFailure || context.status === 'cancelled') {
          break
        }
      }
    }
  }

  /**
   * 取消工作流执行
   */
  cancel(context: WorkflowExecutionContext) {
    context.abortController?.abort()
    context.status = 'cancelled'
    logger.info('Workflow cancelled', { workflowId: context.workflowId })
  }

  /**
   * 执行单个节点
   * 用于调试或单步执行场景
   *
   * @param nodeId 要执行的节点 ID
   * @param nodes 所有节点
   * @param edges 所有边
   * @param existingOutputs 已有的上游节点输出（可选，用于获取输入数据）
   * @param callbacks 回调函数
   * @returns 执行结果
   */
  async executeSingleNode(
    nodeId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    existingOutputs?: Map<string, Record<string, any>>,
    callbacks?: {
      onNodeStart?: (nodeId: string) => void
      onNodeComplete?: (result: NodeExecutionResult) => void | Promise<void>
      onProgress?: (progress: number, message: string) => void
    }
  ): Promise<NodeExecutionResult> {
    // 查找目标节点
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) {
      logger.error('Node not found', { nodeId })
      return {
        nodeId,
        status: 'error',
        outputs: {},
        errorMessage: `节点不存在: ${nodeId}`,
        duration: 0
      }
    }

    logger.info('Executing single node', {
      nodeId,
      nodeLabel: node.data.label,
      nodeType: node.data.nodeType
    })

    // 创建临时执行上下文
    const context: WorkflowExecutionContext = {
      workflowId: `single-node-${Date.now()}`,
      startTime: Date.now(),
      nodeOutputs: existingOutputs || new Map(),
      nodeResults: new Map(),
      status: 'running',
      abortController: new AbortController(),
      maxRetries: 3
    }

    // 预编译边映射
    const dataFlowMapper = new DataFlowMapper(edges)

    // 通知开始执行
    callbacks?.onNodeStart?.(nodeId)
    callbacks?.onProgress?.(0, `执行节点: ${node.data.label}`)

    try {
      // 执行节点
      const result = await this.executeNode(node, nodes, edges, context, dataFlowMapper)

      // 存储结果
      context.nodeResults.set(nodeId, result)

      // 通知完成
      try {
        await callbacks?.onNodeComplete?.(result)
      } catch (callbackError) {
        logger.error('onNodeComplete callback error', {
          nodeId,
          error: callbackError instanceof Error ? callbackError.message : String(callbackError)
        })
      }

      callbacks?.onProgress?.(100, result.status === 'success' ? '节点执行成功' : '节点执行失败')

      logger.info('Single node execution completed', {
        nodeId,
        nodeLabel: node.data.label,
        status: result.status,
        duration: result.duration
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const duration = Date.now() - context.startTime

      logger.error('Single node execution error', {
        nodeId,
        nodeLabel: node.data.label,
        error: errorMessage
      })

      const result: NodeExecutionResult = {
        nodeId,
        status: 'error',
        outputs: {},
        errorMessage,
        duration
      }

      // 通知完成（带错误）
      try {
        await callbacks?.onNodeComplete?.(result)
      } catch (callbackError) {
        logger.error('onNodeComplete callback error', {
          nodeId,
          error: callbackError instanceof Error ? callbackError.message : String(callbackError)
        })
      }

      callbacks?.onProgress?.(100, '节点执行失败')

      return result
    }
  }

  /**
   * 执行工作流（带回调接口）
   * 为 WorkflowToolbar 等组件提供更友好的接口
   */
  async executeWorkflow(
    workflow: Workflow,
    callbacks?: {
      onNodeStatusChange?: (nodeId: string, status: string, errorMessage?: string) => void
      onNodeOutput?: (nodeId: string, outputs: Record<string, any>) => void | Promise<void>
      onProgress?: (progress: number, message: string) => void
      onAutoExport?: (exportedFiles: { filePath: string; fileType: string }[]) => void
    },
    autoExportConfig?: AutoExportConfig,
    retryOptions?: {
      startFromNodeId?: string // 从指定节点开始执行（用于重试）
      previousContext?: WorkflowExecutionContext // 之前的执行上下文
      maxRetries?: number // 最大重试次数
      abortSignal?: AbortSignal // 外部取消信号（用于连接 TaskQueue 的取消链路）
      parallelExecution?: boolean // 是否启用并行执行（默认 true）
      maxConcurrency?: number // 最大并发数（默认 3，对应工作流中的 maxWorkers）
    }
  ): Promise<{
    workflowId: string
    status: 'completed' | 'failed' | 'cancelled'
    errors: string[]
    exportedFiles?: { filePath: string; fileType: string }[]
    context?: WorkflowExecutionContext // 返回上下文用于重试
  }> {
    // 使用工作流配置的 maxWorkers 作为默认并发数
    const maxConcurrency = retryOptions?.maxConcurrency ?? workflow.maxWorkers ?? 3
    const errors: string[] = []

    const context = await this.execute(
      workflow,
      (nodeId) => {
        callbacks?.onNodeStatusChange?.(nodeId, 'running')
      },
      async (result) => {
        // nodeId 由 executeNode 总是设置，这里使用非空断言
        const nodeId = result.nodeId!
        if (result.status === 'success') {
          callbacks?.onNodeStatusChange?.(nodeId, 'completed')
          // 使用 await + try/catch 处理 onNodeOutput 回调，避免未处理的 Promise 拒绝
          try {
            await callbacks?.onNodeOutput?.(nodeId, result.outputs)
          } catch (callbackError) {
            logger.error('onNodeOutput callback error', {
              nodeId,
              error: callbackError instanceof Error ? callbackError.message : String(callbackError)
            })
          }
        } else if (result.status === 'error') {
          callbacks?.onNodeStatusChange?.(nodeId, 'error', result.errorMessage)
          if (result.errorMessage) {
            errors.push(result.errorMessage)
          }
        }
      },
      callbacks?.onProgress,
      {
        ...retryOptions,
        maxConcurrency,
        parallelExecution: retryOptions?.parallelExecution
      }
    )

    // 自动导出未连接的输出
    let exportedFiles: { filePath: string; fileType: string }[] = []
    const exportConfig = autoExportConfig || DEFAULT_AUTO_EXPORT_CONFIG

    if (context.status === 'completed' && exportConfig.enabled) {
      try {
        callbacks?.onProgress?.(95, '正在自动导出未连接的输出...')

        // 查找未连接的输出端口
        const unconnectedOutputs = findUnconnectedOutputs(workflow.nodes, workflow.edges, context.nodeOutputs)

        if (unconnectedOutputs.length > 0) {
          logger.info('Found unconnected outputs', { count: unconnectedOutputs.length })

          // 执行自动导出
          const exportResult = await executeAutoExport(unconnectedOutputs, exportConfig, workflow.name)

          exportedFiles = exportResult.exportedFiles.map((f) => ({
            filePath: f.filePath,
            fileType: f.fileType
          }))

          if (exportResult.errors.length > 0) {
            errors.push(...exportResult.errors)
          }

          // 通知导出完成
          if (exportedFiles.length > 0) {
            callbacks?.onAutoExport?.(exportedFiles)
            logger.info('Auto-export completed', { fileCount: exportedFiles.length })
          }
        }

        callbacks?.onProgress?.(100, '工作流执行完成')
      } catch (error) {
        logger.error('Auto-export failed', { error })
        errors.push(`自动导出失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      workflowId: context.workflowId,
      status: context.status as 'completed' | 'failed' | 'cancelled',
      errors,
      exportedFiles: exportedFiles.length > 0 ? exportedFiles : undefined,
      context // 返回上下文用于重试
    }
  }

  /**
   * 执行单个节点（带自动重试）
   */
  private async executeNode(
    node: WorkflowNode,
    _allNodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: WorkflowExecutionContext,
    dataFlowMapper?: DataFlowMapper
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const maxRetries = context.maxRetries ?? 3
    let lastError: Error | undefined

    // 重试循环
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.executeNodeOnce(node, edges, context, dataFlowMapper, attempt)

      // 成功则直接返回
      if (result.status === 'success' || result.status === 'skipped') {
        return result
      }

      // 检查是否应该重试
      const error = new Error(result.errorMessage || '节点执行失败')
      lastError = error

      // 使用 ErrorHandler 分析错误类型
      const errorType = this.classifyError(error)

      // 检查是否被取消
      if (errorType === ErrorType.CANCELLATION_ERROR || context.abortController?.signal.aborted) {
        logger.info(`[Node] 节点被取消，不重试: ${node.data.label}`)
        return result
      }

      // 检查是否是可重试的错误类型
      const retryableErrors = [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR]
      const shouldRetry = retryableErrors.includes(errorType) && attempt < maxRetries

      if (!shouldRetry) {
        logger.error(`[Node] 错误类型不可重试或已达最大重试次数: ${node.data.label}`, {
          errorType,
          attempt,
          maxRetries
        })
        return result
      }

      // 计算退避延迟（指数退避：1s, 2s, 4s）
      const retryDelay = 1000 * Math.pow(2, attempt - 1)
      logger.warn(`[Node] 节点执行失败，${retryDelay}ms 后重试 (${attempt}/${maxRetries}): ${node.data.label}`, {
        errorType,
        errorMessage: result.errorMessage,
        retryDelay
      })

      // 等待重试延迟
      await this.delay(retryDelay)
    }

    // 所有重试都失败
    const duration = Date.now() - startTime
    return {
      nodeId: node.id,
      status: 'error',
      outputs: {},
      errorMessage: lastError?.message || '节点执行失败（已重试）',
      duration
    }
  }

  /**
   * 分类错误类型（用于决定是否重试）
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    // 网络相关错误（包括 ERR_CONNECTION_CLOSED）
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('err_connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('socket') ||
      stack.includes('fetch')
    ) {
      if (message.includes('timeout')) {
        return ErrorType.TIMEOUT_ERROR
      }
      return ErrorType.NETWORK_ERROR
    }

    // 超时错误
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT_ERROR
    }

    // 取消错误
    if (message.includes('abort') || message.includes('cancel') || error.name === 'AbortError') {
      return ErrorType.CANCELLATION_ERROR
    }

    return ErrorType.NODE_EXECUTION
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 执行单个节点一次（不含重试逻辑）
   */
  private async executeNodeOnce(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    context: WorkflowExecutionContext,
    dataFlowMapper?: DataFlowMapper,
    attempt: number = 1
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const nodeData = node.data

    logger.info(`[Node] ========== 开始执行节点: ${nodeData.label} (${nodeData.nodeType}) ==========`, {
      attempt,
      maxRetries: context.maxRetries
    })

    try {
      // 收集输入数据（从上游节点通过连线传递）
      const inputs = this.collectInputs(node, edges, context, dataFlowMapper)
      logger.info(`[Node] 收集到输入数据`, {
        nodeLabel: nodeData.label,
        inputKeys: Object.keys(inputs),
        inputCount: Object.keys(inputs).length
      })

      // 根据节点类型执行
      let outputs: Record<string, any> = {}

      // 使用 NodeRegistry 中的执行器（所有节点都已迁移到现代架构）
      const registeredExecutor = getNodeExecutor(nodeData.nodeType)
      if (registeredExecutor) {
        logger.info(`[Node] 使用 NodeRegistry 执行器: ${nodeData.nodeType}`)
        const executionContext = {
          workflowId: context.workflowId || 'unknown',
          nodeId: node.id,
          batchIndex: context.currentBatchIndex,
          totalBatches: context.totalBatches,
          abortSignal: context.abortController?.signal,
          log: (message: string, data?: Record<string, any>) => {
            logger.info(`[${nodeData.nodeType}] ${message}`, data)
          }
        }
        const result = await registeredExecutor.execute(
          inputs,
          {
            ...nodeData.config,
            nodeType: nodeData.nodeType,
            // 传递顶层的 providerId 和 modelId（用于模型选择）
            providerId: nodeData.providerId,
            modelId: nodeData.modelId
          },
          executionContext
        )
        if (result.status === 'error') {
          throw new Error(result.errorMessage || '节点执行失败')
        }
        outputs = result.outputs
      } else {
        // 未知节点类型，透传输入
        logger.warn('Unknown node type, no executor found', { type: nodeData.nodeType })
        outputs = inputs
      }

      // 存储节点输出
      context.nodeOutputs.set(node.id, outputs)
      const duration = Date.now() - startTime

      logger.info(`[Node] ✓ 节点执行成功: ${nodeData.label}`, {
        nodeType: nodeData.nodeType,
        outputKeys: Object.keys(outputs),
        outputValues: Object.fromEntries(
          Object.entries(outputs).map(([k, v]) => [
            k,
            typeof v === 'string' ? v.substring(0, 80) : Array.isArray(v) ? `Array(${v.length})` : typeof v
          ])
        ),
        duration: `${duration}ms`,
        attempt
      })

      return {
        nodeId: node.id,
        status: 'success',
        outputs,
        duration
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const duration = Date.now() - startTime
      const errorType = this.classifyError(error instanceof Error ? error : new Error(errorMessage))

      logger.error(`[Node] ❌ 节点执行失败: ${nodeData.label}`, {
        nodeType: nodeData.nodeType,
        error: errorMessage,
        errorType,
        duration: `${duration}ms`,
        attempt,
        // 增强的错误日志：记录更多网络错误信息
        isNetworkError: errorType === ErrorType.NETWORK_ERROR,
        isTimeoutError: errorType === ErrorType.TIMEOUT_ERROR,
        errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
      })

      return {
        nodeId: node.id,
        status: 'error',
        outputs: {},
        errorMessage: `${errorMessage}${attempt > 1 ? ` (尝试 ${attempt}/${context.maxRetries})` : ''}`,
        duration,
        metadata: {
          errorType,
          attempt,
          maxRetries: context.maxRetries
        }
      }
    }
  }

  /**
   * 收集节点的输入数据
   * 通过连线从上游节点获取
   *
   * 优化：使用 DataFlowMapper 预编译边映射，将查询复杂度从 O(E×N) 降至 O(1)
   */
  private collectInputs(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    context: WorkflowExecutionContext,
    dataFlowMapper?: DataFlowMapper
  ): Record<string, any> {
    const inputs: Record<string, any> = {}
    // 支持动态端口节点：优先使用 config.imageInputPorts（标准格式），然后是 config.inputPorts，最后是 data.inputs
    const nodeInputs =
      (node.data.config?.imageInputPorts as typeof node.data.inputs) ||
      (node.data.config?.inputPorts as typeof node.data.inputs) ||
      node.data.inputs ||
      []

    logger.info('[collectInputs] ========== 开始收集输入 ==========', {
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.data.nodeType,
      inputPorts: nodeInputs.map((h) => h.id),
      totalEdges: edges.length,
      useOptimizedMapper: !!dataFlowMapper
    })

    // 使用 DataFlowMapper 或回退到传统方式获取连接到此节点的边
    const incomingEdges = dataFlowMapper
      ? dataFlowMapper.getIncomingEdges(node.id)
      : edges.filter((e) => e.target === node.id)

    logger.info('[collectInputs] 连接到此节点的边', {
      nodeId: node.id,
      incomingEdgeCount: incomingEdges.length,
      incomingEdges: incomingEdges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle
      }))
    })

    // 预计算没有 targetHandle 的边（用于兼容旧版边数据）
    const noHandleEdges = dataFlowMapper
      ? dataFlowMapper.getNoHandleEdges(node.id)
      : incomingEdges.filter((e) => !e.targetHandle)

    // 遍历节点的所有输入端口
    for (const inputHandle of nodeInputs) {
      // 使用 DataFlowMapper 或回退到传统方式找到连接到这个输入端口的边
      let connectedEdges: WorkflowEdge[]

      if (dataFlowMapper) {
        // 优化路径：O(1) 查询
        connectedEdges = dataFlowMapper.getEdgesForHandle(node.id, inputHandle.id)

        // 如果没有精确匹配的边，检查没有 targetHandle 的边（兼容旧版）
        if (connectedEdges.length === 0 && noHandleEdges.length > 0) {
          if (nodeInputs.length === 1) {
            // 只有一个输入端口，所有无 targetHandle 的边都连接到它
            connectedEdges = noHandleEdges
          } else {
            // 多个输入端口，按顺序匹配
            const inputIndex = nodeInputs.findIndex((h) => h.id === inputHandle.id)
            if (inputIndex < noHandleEdges.length) {
              connectedEdges = [noHandleEdges[inputIndex]]
            }
          }
        }
      } else {
        // 回退路径：传统 filter 方式
        connectedEdges = edges.filter((e) => {
          if (e.target !== node.id) return false
          if (e.targetHandle === inputHandle.id) return true
          if (!e.targetHandle && nodeInputs.length === 1) return true
          if (!e.targetHandle && nodeInputs.length > 1) {
            const inputIndex = nodeInputs.findIndex((h) => h.id === inputHandle.id)
            const edgesWithoutTargetHandle = edges.filter((edge) => edge.target === node.id && !edge.targetHandle)
            const edgeIndex = edgesWithoutTargetHandle.findIndex((edge) => edge.id === e.id)
            return inputIndex === edgeIndex
          }
          return false
        })
      }

      logger.info('[collectInputs] Checking input handle', {
        handleId: inputHandle.id,
        connectedEdgesCount: connectedEdges.length,
        edges: connectedEdges.map((e) => ({
          source: e.source,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle
        }))
      })

      for (const edge of connectedEdges) {
        // 获取上游节点的输出
        const upstreamOutputs = context.nodeOutputs.get(edge.source)

        logger.info('[collectInputs] Upstream outputs', {
          edgeSource: edge.source,
          sourceHandle: edge.sourceHandle,
          hasUpstreamOutputs: !!upstreamOutputs,
          upstreamOutputKeys: upstreamOutputs ? Object.keys(upstreamOutputs) : []
        })

        if (upstreamOutputs) {
          let value: any = undefined

          // 1. 先尝试用 sourceHandle 精确匹配
          if (edge.sourceHandle && upstreamOutputs[edge.sourceHandle] !== undefined) {
            value = upstreamOutputs[edge.sourceHandle]
            logger.debug('[collectInputs] Value found by sourceHandle', {
              sourceHandle: edge.sourceHandle,
              valueType: typeof value
            })
          }

          // 2. 如果精确匹配失败，使用 TypeFallbackConfig 进行智能回退
          if (value === undefined) {
            const targetDataType = inputHandle.dataType
            value = getFallbackValue(upstreamOutputs, targetDataType, inputHandle.id)

            // 特殊处理：images -> image 类型转换
            if (value === undefined && targetDataType === 'image') {
              const imagesValue = upstreamOutputs.images
              if (imagesValue) {
                value = extractSingleImage(imagesValue)
                if (value !== undefined) {
                  logger.debug('[collectInputs] Extracted first image from images array')
                }
              }
            }

            // 特殊处理：image -> images 类型转换
            if (value === undefined && targetDataType === 'images') {
              const singleImage = getFallbackValue(upstreamOutputs, 'image', inputHandle.id)
              if (singleImage) {
                value = wrapAsImageArray(singleImage)
                logger.debug('[collectInputs] Wrapped single image as array')
              }
            }

            if (value !== undefined) {
              logger.debug('[collectInputs] Value found by fallback', {
                targetDataType,
                valueType: typeof value
              })
            }
          }

          logger.debug('[collectInputs] Retrieved value', {
            sourceHandle: edge.sourceHandle,
            hasValue: value !== undefined,
            valueType: typeof value,
            valuePreview: typeof value === 'string' ? value.substring(0, 100) : undefined
          })

          if (value !== undefined) {
            // 如果输入端口允许多个连接，收集为数组
            if (inputHandle.multiple) {
              if (!inputs[inputHandle.id]) {
                inputs[inputHandle.id] = []
              }
              inputs[inputHandle.id].push(value)
            } else {
              inputs[inputHandle.id] = value
            }
          }
        }
      }
    }

    logger.info('[collectInputs] ========== 最终收集到的输入 ==========', {
      nodeId: node.id,
      inputKeys: Object.keys(inputs),
      hasData: Object.keys(inputs).length > 0,
      inputValues: Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [
          k,
          typeof v === 'string' ? v.substring(0, 80) : Array.isArray(v) ? `Array(${v.length})` : typeof v
        ])
      )
    })

    // P1 优化：必填输入校验
    // 检查所有 required 端口是否都有值
    const validationErrors: string[] = []
    for (const inputHandle of nodeInputs) {
      if (inputHandle.required) {
        const value = inputs[inputHandle.id]
        if (value === undefined || value === null || value === '') {
          validationErrors.push(`缺少必填输入: ${inputHandle.label || inputHandle.id}`)
        }
      }
    }

    if (validationErrors.length > 0) {
      const errorMessage = `输入校验失败: ${validationErrors.join('; ')}`
      logger.error('[collectInputs] 必填输入校验失败', {
        nodeId: node.id,
        nodeLabel: node.data.label,
        errors: validationErrors
      })
      throw new Error(errorMessage)
    }

    return inputs
  }
}

// 单例导出
export const workflowEngine = new WorkflowEngine()
