/**
 * 工作流执行上下文管理器
 *
 * 负责管理工作流执行过程中的状态和数据
 */

import { loggerService } from '@logger'

import type { NodeExecutionResult, WorkflowExecutionContext } from '../types/core'

const logger = loggerService.withContext('ExecutionContext')

/**
 * WorkflowEngine 特定的执行上下文扩展
 */
export interface EngineExecutionContext extends Omit<WorkflowExecutionContext, 'status'> {
  // 执行状态（WorkflowEngine 特定的状态）
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  // 错误信息（向后兼容）
  error?: string
  // 取消信号（WorkflowEngine 特定）
  abortController?: AbortController
  // 批处理相关（向后兼容）
  currentBatchIndex?: number
  totalBatches?: number
}

/**
 * 执行上下文管理器
 */
export class ExecutionContextManager {
  /**
   * 创建新的执行上下文
   */
  static create(workflowId: string): EngineExecutionContext {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const context: EngineExecutionContext = {
      workflowId,
      executionId,
      startTime: Date.now(),
      status: 'idle',
      nodeOutputs: new Map(),
      nodeResults: new Map(),
      abortController: new AbortController()
    }

    logger.info('执行上下文已创建', {
      workflowId,
      executionId
    })

    return context
  }

  /**
   * 设置执行状态
   */
  static setStatus(context: EngineExecutionContext, status: EngineExecutionContext['status'], error?: string): void {
    const previousStatus = context.status
    context.status = status

    if (error) {
      context.error = error
    }

    logger.debug('执行状态已更新', {
      workflowId: context.workflowId,
      previousStatus,
      newStatus: status,
      error
    })
  }

  /**
   * 存储节点输出
   */
  static setNodeOutputs(context: EngineExecutionContext, nodeId: string, outputs: Record<string, any>): void {
    context.nodeOutputs.set(nodeId, outputs)

    logger.debug('节点输出已存储', {
      workflowId: context.workflowId,
      nodeId,
      outputKeys: Object.keys(outputs)
    })
  }

  /**
   * 获取节点输出
   */
  static getNodeOutputs(context: EngineExecutionContext, nodeId: string): Record<string, any> | undefined {
    return context.nodeOutputs.get(nodeId)
  }

  /**
   * 存储节点执行结果
   */
  static setNodeResult(context: EngineExecutionContext, result: NodeExecutionResult): void {
    if (result.nodeId) {
      context.nodeResults.set(result.nodeId, result)

      logger.debug('节点执行结果已存储', {
        workflowId: context.workflowId,
        nodeId: result.nodeId,
        status: result.status,
        duration: result.duration
      })
    }
  }

  /**
   * 获取节点执行结果
   */
  static getNodeResult(context: EngineExecutionContext, nodeId: string): NodeExecutionResult | undefined {
    return context.nodeResults.get(nodeId)
  }

  /**
   * 检查是否已取消
   */
  static isCancelled(context: EngineExecutionContext): boolean {
    return context.abortController?.signal.aborted || context.status === 'cancelled'
  }

  /**
   * 取消执行
   */
  static cancel(context: EngineExecutionContext, reason?: string): void {
    if (context.status === 'running') {
      this.setStatus(context, 'cancelled', reason || '用户取消')
      context.abortController?.abort()

      logger.info('工作流执行已取消', {
        workflowId: context.workflowId,
        reason
      })
    }
  }

  /**
   * 完成执行
   */
  static complete(context: EngineExecutionContext): void {
    if (context.status === 'running') {
      this.setStatus(context, 'completed')

      const duration = Date.now() - context.startTime
      const totalNodes = context.nodeResults.size
      const successNodes = Array.from(context.nodeResults.values()).filter(
        (result) => result.status === 'success'
      ).length

      logger.info('工作流执行已完成', {
        workflowId: context.workflowId,
        duration,
        totalNodes,
        successNodes
      })
    }
  }

  /**
   * 标记为失败
   */
  static fail(context: EngineExecutionContext, error: string): void {
    this.setStatus(context, 'failed', error)

    const duration = Date.now() - context.startTime

    logger.error('工作流执行失败', {
      workflowId: context.workflowId,
      duration,
      error
    })
  }

  /**
   * 开始执行
   */
  static start(context: EngineExecutionContext): void {
    this.setStatus(context, 'running')
    context.startTime = Date.now()

    logger.info('工作流执行已开始', {
      workflowId: context.workflowId,
      executionId: context.executionId
    })
  }

  /**
   * 获取执行统计信息
   */
  static getStats(context: EngineExecutionContext) {
    const duration = Date.now() - context.startTime
    const totalNodes = context.nodeResults.size
    const results = Array.from(context.nodeResults.values())

    const stats = {
      duration,
      totalNodes,
      successNodes: results.filter((r) => r.status === 'success').length,
      errorNodes: results.filter((r) => r.status === 'error').length,
      skippedNodes: results.filter((r) => r.status === 'skipped').length,
      avgNodeDuration: results.length > 0 ? results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length : 0
    }

    return stats
  }

  /**
   * 清理执行上下文
   */
  static cleanup(context: EngineExecutionContext): void {
    // 清理大的数据结构以释放内存
    context.nodeOutputs.clear()
    context.nodeResults.clear()

    logger.debug('执行上下文已清理', {
      workflowId: context.workflowId
    })
  }

  /**
   * 序列化执行上下文（用于存储到 Redux）
   * 将 Map 转换为普通对象以避免非序列化警告
   * 支持任何包含 Map 的执行上下文类型
   */
  static serialize(context: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(context)) {
      if (value instanceof Map) {
        // 将 Map 转换为普通对象
        result[key] = Object.fromEntries(value)
      } else if (value instanceof AbortController) {
        // 跳过 AbortController（不可序列化）
        continue
      } else if (typeof value === 'function') {
        // 跳过函数
        continue
      } else {
        result[key] = value
      }
    }

    return result
  }

  /**
   * 复制执行上下文（用于批处理等场景）
   */
  static clone(context: EngineExecutionContext, newWorkflowId?: string): EngineExecutionContext {
    const newContext = this.create(newWorkflowId || context.workflowId)

    // 复制配置相关的属性（不复制执行状态和结果）
    newContext.currentBatchIndex = context.currentBatchIndex
    newContext.totalBatches = context.totalBatches

    return newContext
  }
}
