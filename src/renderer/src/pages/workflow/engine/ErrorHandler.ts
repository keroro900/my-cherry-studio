/**
 * 错误处理器
 *
 * 负责统一处理工作流执行过程中的各种错误和异常
 */

import { loggerService } from '@logger'

import type { WorkflowNode } from '../types'
import type { NodeExecutionResult } from '../types/core'
import type { EngineExecutionContext } from './ExecutionContext'

const logger = loggerService.withContext('ErrorHandler')

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NODE_EXECUTION = 'node_execution',
  INPUT_VALIDATION = 'input_validation',
  OUTPUT_VALIDATION = 'output_validation',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  CANCELLATION_ERROR = 'cancellation_error',
  SYSTEM_ERROR = 'system_error'
}

/**
 * 工作流错误信息
 */
export interface WorkflowError {
  type: ErrorType
  code: string
  message: string
  nodeId?: string
  nodeType?: string
  details?: any
  timestamp: number
  stack?: string
}

/**
 * 错误恢复策略
 */
export interface ErrorRecoveryStrategy {
  shouldRetry: boolean
  retryCount?: number
  retryDelay?: number
  skipNode?: boolean
  fallbackValue?: any
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private static readonly MAX_RETRY_ATTEMPTS = 3
  private static readonly DEFAULT_RETRY_DELAY = 1000 // 毫秒

  /**
   * 处理节点执行错误
   */
  static async handleNodeError(
    error: Error | unknown,
    node: WorkflowNode,
    context: EngineExecutionContext,
    attempt: number = 1
  ): Promise<NodeExecutionResult> {
    void context
    const workflowError = this.createWorkflowError(error, node)

    logger.error('节点执行失败', {
      nodeId: node.id,
      nodeType: node.data.nodeType,
      attempt,
      errorType: workflowError.type,
      errorCode: workflowError.code,
      errorMessage: workflowError.message
    })

    // 获取恢复策略
    const recoveryStrategy = this.getRecoveryStrategy(workflowError, attempt)

    // 尝试恢复
    if (recoveryStrategy.shouldRetry && attempt < this.MAX_RETRY_ATTEMPTS) {
      logger.info('尝试重试节点执行', {
        nodeId: node.id,
        attempt: attempt + 1,
        retryDelay: recoveryStrategy.retryDelay
      })

      // 等待重试延迟
      if (recoveryStrategy.retryDelay) {
        await this.delay(recoveryStrategy.retryDelay)
      }

      // 这里应该由调用方重新执行节点
      return this.createErrorResult(node.id, workflowError, true)
    }

    // 如果需要跳过节点
    if (recoveryStrategy.skipNode) {
      return this.createSkippedResult(node.id, workflowError.message, recoveryStrategy.fallbackValue)
    }

    // 返回错误结果
    return this.createErrorResult(node.id, workflowError)
  }

  /**
   * 处理工作流级别的错误
   */
  static handleWorkflowError(error: Error | unknown, context: EngineExecutionContext): WorkflowError {
    const workflowError = this.createWorkflowError(error)

    logger.error('工作流执行失败', {
      workflowId: context.workflowId,
      errorType: workflowError.type,
      errorCode: workflowError.code,
      errorMessage: workflowError.message,
      executedNodes: context.nodeResults.size
    })

    return workflowError
  }

  /**
   * 创建工作流错误对象
   */
  private static createWorkflowError(error: Error | unknown, node?: WorkflowNode): WorkflowError {
    const timestamp = Date.now()

    if (error instanceof Error) {
      const errorType = this.classifyError(error, node)

      return {
        type: errorType,
        code: this.getErrorCode(error, errorType),
        message: error.message,
        nodeId: node?.id,
        nodeType: node?.data.nodeType,
        details: this.extractErrorDetails(error),
        timestamp,
        stack: error.stack
      }
    } else {
      // 非 Error 类型的异常
      const message = typeof error === 'string' ? error : String(error)

      return {
        type: ErrorType.SYSTEM_ERROR,
        code: 'UNKNOWN_ERROR',
        message,
        nodeId: node?.id,
        nodeType: node?.data.nodeType,
        timestamp
      }
    }
  }

  /**
   * 分类错误类型
   */
  private static classifyError(error: Error, node?: WorkflowNode): ErrorType {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    // 网络相关错误
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      stack.includes('fetch')
    ) {
      if (message.includes('timeout')) {
        return ErrorType.TIMEOUT_ERROR
      }
      return ErrorType.NETWORK_ERROR
    }

    // 取消错误
    if (message.includes('abort') || message.includes('cancel') || error.name === 'AbortError') {
      return ErrorType.CANCELLATION_ERROR
    }

    // 输入验证错误
    if (message.includes('input') || message.includes('parameter') || message.includes('required')) {
      return ErrorType.INPUT_VALIDATION
    }

    // 输出验证错误
    if (message.includes('output') || message.includes('result') || message.includes('format')) {
      return ErrorType.OUTPUT_VALIDATION
    }

    // 节点执行错误
    if (node) {
      return ErrorType.NODE_EXECUTION
    }

    return ErrorType.SYSTEM_ERROR
  }

  /**
   * 获取错误代码
   */
  private static getErrorCode(error: Error, errorType: ErrorType): string {
    // 如果错误对象有自定义代码
    if ((error as any).code) {
      return (error as any).code
    }

    // 根据错误类型生成代码
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return 'NETWORK_ERROR'
      case ErrorType.TIMEOUT_ERROR:
        return 'TIMEOUT_ERROR'
      case ErrorType.CANCELLATION_ERROR:
        return 'OPERATION_CANCELLED'
      case ErrorType.INPUT_VALIDATION:
        return 'INVALID_INPUT'
      case ErrorType.OUTPUT_VALIDATION:
        return 'INVALID_OUTPUT'
      case ErrorType.NODE_EXECUTION:
        return 'NODE_EXECUTION_FAILED'
      default:
        return 'UNKNOWN_ERROR'
    }
  }

  /**
   * 提取错误详细信息
   */
  private static extractErrorDetails(error: Error): any {
    const details: any = {}

    // HTTP 错误状态
    if ((error as any).status) {
      details.httpStatus = (error as any).status
    }

    // API 错误响应
    if ((error as any).response) {
      details.apiResponse = (error as any).response
    }

    // 其他自定义属性
    for (const key of ['code', 'statusCode', 'errno', 'syscall']) {
      if ((error as any)[key] !== undefined) {
        details[key] = (error as any)[key]
      }
    }

    return Object.keys(details).length > 0 ? details : undefined
  }

  /**
   * 获取错误恢复策略
   */
  private static getRecoveryStrategy(error: WorkflowError, attempt: number): ErrorRecoveryStrategy {
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        return {
          shouldRetry: true,
          retryCount: this.MAX_RETRY_ATTEMPTS,
          retryDelay: this.calculateBackoffDelay(attempt)
        }

      case ErrorType.TIMEOUT_ERROR:
        return {
          shouldRetry: true,
          retryCount: 2,
          retryDelay: this.calculateBackoffDelay(attempt)
        }

      case ErrorType.CANCELLATION_ERROR:
        return {
          shouldRetry: false,
          skipNode: false
        }

      case ErrorType.INPUT_VALIDATION:
        // 输入验证错误通常不应重试
        return {
          shouldRetry: false,
          skipNode: true,
          fallbackValue: {}
        }

      case ErrorType.OUTPUT_VALIDATION:
        // 输出验证错误可以尝试一次重试
        return {
          shouldRetry: attempt === 1,
          retryCount: 1,
          retryDelay: this.DEFAULT_RETRY_DELAY
        }

      case ErrorType.NODE_EXECUTION:
        // 节点执行错误，根据具体情况决定
        if (error.message.includes('API') || error.message.includes('服务')) {
          return {
            shouldRetry: true,
            retryCount: 2,
            retryDelay: this.calculateBackoffDelay(attempt)
          }
        }
        return {
          shouldRetry: false,
          skipNode: false
        }

      default:
        return {
          shouldRetry: false,
          skipNode: false
        }
    }
  }

  /**
   * 计算退避延迟时间
   */
  private static calculateBackoffDelay(attempt: number): number {
    // 指数退避：1s, 2s, 4s
    return this.DEFAULT_RETRY_DELAY * Math.pow(2, attempt - 1)
  }

  /**
   * 创建错误结果
   */
  private static createErrorResult(
    nodeId: string,
    error: WorkflowError,
    shouldRetry: boolean = false
  ): NodeExecutionResult {
    return {
      nodeId,
      status: 'error',
      outputs: {},
      errorMessage: error.message,
      metadata: {
        errorType: error.type,
        errorCode: error.code,
        shouldRetry,
        timestamp: error.timestamp,
        details: error.details
      }
    }
  }

  /**
   * 创建跳过结果
   */
  private static createSkippedResult(nodeId: string, reason: string, fallbackValue?: any): NodeExecutionResult {
    return {
      nodeId,
      status: 'skipped',
      outputs: fallbackValue || {},
      errorMessage: reason,
      metadata: {
        skipped: true,
        reason
      }
    }
  }

  /**
   * 延迟函数
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 格式化错误信息用于显示
   */
  static formatErrorForDisplay(error: WorkflowError): string {
    let message = `${error.message}`

    // 添加错误类型信息
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        message += ' (网络连接错误)'
        break
      case ErrorType.TIMEOUT_ERROR:
        message += ' (请求超时)'
        break
      case ErrorType.INPUT_VALIDATION:
        message += ' (输入参数错误)'
        break
      case ErrorType.OUTPUT_VALIDATION:
        message += ' (输出格式错误)'
        break
    }

    // 添加节点信息
    if (error.nodeType) {
      message += ` [节点: ${error.nodeType}]`
    }

    return message
  }

  /**
   * 获取错误统计信息
   */
  static getErrorStats(context: EngineExecutionContext): {
    totalErrors: number
    errorsByType: Record<string, number>
    errorsByNode: Record<string, number>
  } {
    const results = Array.from(context.nodeResults.values())
    const errors = results.filter((r) => r.status === 'error')

    const errorsByType: Record<string, number> = {}
    const errorsByNode: Record<string, number> = {}

    for (const error of errors) {
      const errorType = error.metadata?.errorType || 'unknown'
      const nodeType = error.metadata?.nodeType || 'unknown'

      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1
      errorsByNode[nodeType] = (errorsByNode[nodeType] || 0) + 1
    }

    return {
      totalErrors: errors.length,
      errorsByType,
      errorsByNode
    }
  }
}
