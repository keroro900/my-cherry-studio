/**
 * 工作流错误类型定义
 *
 * P2 优化：从 ErrorHandler.ts 提取，集中管理错误类型
 */

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
 * 工作流错误信息接口
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
 * 错误恢复策略接口
 */
export interface ErrorRecoveryStrategy {
  shouldRetry: boolean
  retryCount?: number
  retryDelay?: number
  skipNode?: boolean
  fallbackValue?: any
}

/**
 * 根据错误消息分类错误类型
 */
export function classifyError(error: Error): ErrorType {
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

  return ErrorType.SYSTEM_ERROR
}
