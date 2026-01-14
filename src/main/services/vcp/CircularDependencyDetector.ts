/**
 * CircularDependencyDetector - 循环依赖检测器
 *
 * 用于检测变量解析过程中的循环引用，防止无限递归。
 * 参考 VCPToolBox 的 messageProcessor.js 实现模式。
 *
 * 工作原理：
 * - 使用 Set 追踪当前调用栈中正在解析的变量
 * - 进入变量解析前调用 enter()，检测是否已在栈中
 * - 解析完成后调用 exit()，从栈中移除
 * - 如果检测到循环，返回错误消息而不是抛出异常
 *
 * @example
 * ```typescript
 * const detector = new CircularDependencyDetector()
 *
 * const error = detector.enter('VarA')
 * if (error) {
 *   // 检测到循环引用，使用 error 消息替换变量
 *   return text.replace('{{VarA}}', error)
 * }
 *
 * try {
 *   // 解析变量...
 *   const value = await resolveVariable('VarA')
 *   return value
 * } finally {
 *   detector.exit('VarA')
 * }
 * ```
 */

import { loggerService } from '@main/services/LoggerService'

const logger = loggerService.withContext('CircularDependencyDetector')

/**
 * 循环依赖检测结果
 */
export interface CircularDetectionResult {
  /** 是否检测到循环 */
  isCircular: boolean
  /** 错误消息（如果检测到循环） */
  errorMessage?: string
  /** 调用栈追踪（用于调试） */
  stackTrace?: string[]
}

/**
 * 循环依赖检测器
 */
export class CircularDependencyDetector {
  /** 当前调用栈 */
  private stack: Set<string> = new Set()

  /** 最大递归深度 */
  private readonly maxDepth: number

  /**
   * 创建循环依赖检测器
   * @param maxDepth 最大递归深度，默认 10
   */
  constructor(maxDepth: number = 10) {
    this.maxDepth = maxDepth
  }

  /**
   * 尝试进入变量解析
   *
   * @param variableName 变量名
   * @returns 错误消息（如果检测到循环或超过最大深度）或 undefined（可以继续）
   *
   * @example
   * ```typescript
   * const error = detector.enter('VarA')
   * if (error) {
   *   result = result.replace('{{VarA}}', error)
   *   continue
   * }
   * ```
   */
  enter(variableName: string): string | undefined {
    // 检测循环引用
    if (this.stack.has(variableName)) {
      const stackTrace = this.getStackTrace()
      logger.error(`Circular dependency detected! Stack: [${stackTrace.join(' -> ')} -> ${variableName}]`)
      return `[循环引用错误: ${variableName}]`
    }

    // 检测最大深度
    if (this.stack.size >= this.maxDepth) {
      logger.warn(`Max recursion depth (${this.maxDepth}) reached for variable: ${variableName}`)
      return `[递归深度超限: ${variableName}]`
    }

    // 添加到调用栈
    this.stack.add(variableName)
    return undefined
  }

  /**
   * 退出变量解析
   *
   * @param variableName 变量名
   *
   * @example
   * ```typescript
   * try {
   *   // 解析变量...
   * } finally {
   *   detector.exit('VarA')
   * }
   * ```
   */
  exit(variableName: string): void {
    this.stack.delete(variableName)
  }

  /**
   * 检测变量是否会导致循环引用（不修改栈）
   *
   * @param variableName 变量名
   * @returns 检测结果
   */
  check(variableName: string): CircularDetectionResult {
    if (this.stack.has(variableName)) {
      return {
        isCircular: true,
        errorMessage: `[循环引用错误: ${variableName}]`,
        stackTrace: [...this.getStackTrace(), variableName]
      }
    }

    if (this.stack.size >= this.maxDepth) {
      return {
        isCircular: false, // 不是循环，但超过深度限制
        errorMessage: `[递归深度超限: ${variableName}]`,
        stackTrace: this.getStackTrace()
      }
    }

    return { isCircular: false }
  }

  /**
   * 获取当前调用栈追踪
   *
   * @returns 变量名数组，按进入顺序排列
   */
  getStackTrace(): string[] {
    return [...this.stack]
  }

  /**
   * 获取当前递归深度
   *
   * @returns 当前栈大小
   */
  getDepth(): number {
    return this.stack.size
  }

  /**
   * 获取最大递归深度
   *
   * @returns 最大深度限制
   */
  getMaxDepth(): number {
    return this.maxDepth
  }

  /**
   * 检查栈是否为空
   *
   * @returns 是否为空
   */
  isEmpty(): boolean {
    return this.stack.size === 0
  }

  /**
   * 清空调用栈（通常用于错误恢复）
   */
  clear(): void {
    if (this.stack.size > 0) {
      logger.warn(`Clearing non-empty stack with ${this.stack.size} entries: [${this.getStackTrace().join(', ')}]`)
    }
    this.stack.clear()
  }

  /**
   * 创建子检测器（共享同一个栈）
   * 用于在不同的解析上下文中传递检测器
   *
   * @returns 当前检测器实例（不创建新实例，共享栈）
   */
  fork(): CircularDependencyDetector {
    // 返回自身，共享栈
    // 如果需要隔离栈，可以创建新实例并复制当前栈
    return this
  }

  /**
   * 使用检测器执行函数（自动管理 enter/exit）
   *
   * @param variableName 变量名
   * @param fn 要执行的异步函数
   * @returns 函数返回值或错误消息
   *
   * @example
   * ```typescript
   * const result = await detector.withVariable('VarA', async () => {
   *   return await resolveVariable('VarA')
   * })
   * ```
   */
  async withVariable<T>(variableName: string, fn: () => Promise<T>): Promise<T | string> {
    const error = this.enter(variableName)
    if (error) {
      return error
    }

    try {
      return await fn()
    } finally {
      this.exit(variableName)
    }
  }

  /**
   * 同步版本的 withVariable
   *
   * @param variableName 变量名
   * @param fn 要执行的同步函数
   * @returns 函数返回值或错误消息
   */
  withVariableSync<T>(variableName: string, fn: () => T): T | string {
    const error = this.enter(variableName)
    if (error) {
      return error
    }

    try {
      return fn()
    } finally {
      this.exit(variableName)
    }
  }
}

/**
 * 创建一个新的循环依赖检测器
 *
 * @param maxDepth 最大递归深度，默认 10
 * @returns 新的检测器实例
 */
export function createCircularDetector(maxDepth: number = 10): CircularDependencyDetector {
  return new CircularDependencyDetector(maxDepth)
}

export default CircularDependencyDetector
