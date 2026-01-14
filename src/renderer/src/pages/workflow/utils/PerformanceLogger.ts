/**
 * 性能日志工具
 *
 * 用于统一记录工作流执行过程中的性能指标
 * 支持阶段计时、嵌套操作和汇总报告
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('PerformanceLogger')

interface PerformancePhase {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

interface PerformanceEntry {
  operationId: string
  operation: string
  startTime: number
  endTime?: number
  totalDuration?: number
  phases: PerformancePhase[]
  metadata?: Record<string, any>
}

// 存储进行中的性能记录
const performanceEntries: Map<string, PerformanceEntry> = new Map()

// 是否启用详细日志
let verboseMode = true

/**
 * 性能日志工具类
 */
export class PerformanceLogger {
  private static generateId(): string {
    return Math.random().toString(36).substring(2, 10)
  }

  /**
   * 设置详细日志模式
   */
  static setVerbose(verbose: boolean): void {
    verboseMode = verbose
  }

  /**
   * 开始记录一个操作
   * @param operation 操作名称
   * @param metadata 附加元数据
   * @returns operationId 用于后续阶段记录和结束
   */
  static start(operation: string, metadata?: Record<string, any>): string {
    const operationId = this.generateId()
    const entry: PerformanceEntry = {
      operationId,
      operation,
      startTime: Date.now(),
      phases: [],
      metadata
    }
    performanceEntries.set(operationId, entry)

    if (verboseMode) {
      logger.debug(`[${operationId}] ===== 开始: ${operation} =====`, metadata || {})
    }

    return operationId
  }

  /**
   * 记录一个阶段
   * @param operationId 操作ID
   * @param phaseName 阶段名称
   * @param metadata 阶段元数据
   */
  static phase(operationId: string, phaseName: string, metadata?: Record<string, any>): void {
    const entry = performanceEntries.get(operationId)
    if (!entry) {
      logger.warn(`未找到操作: ${operationId}`)
      return
    }

    // 结束上一个阶段
    const lastPhase = entry.phases[entry.phases.length - 1]
    if (lastPhase && !lastPhase.endTime) {
      lastPhase.endTime = Date.now()
      lastPhase.duration = lastPhase.endTime - lastPhase.startTime
    }

    // 开始新阶段
    const phase: PerformancePhase = {
      name: phaseName,
      startTime: Date.now(),
      metadata
    }
    entry.phases.push(phase)

    if (verboseMode) {
      const elapsed = Date.now() - entry.startTime
      logger.debug(`[${operationId}] 阶段: ${phaseName} (+${elapsed}ms)`, metadata || {})
    }
  }

  /**
   * 结束操作并输出性能报告
   * @param operationId 操作ID
   * @param metadata 结束时的附加数据
   * @returns 性能汇总
   */
  static end(
    operationId: string,
    metadata?: Record<string, any>
  ): {
    totalDuration: number
    phases: { name: string; duration: number }[]
  } | null {
    const entry = performanceEntries.get(operationId)
    if (!entry) {
      logger.warn(`未找到操作: ${operationId}`)
      return null
    }

    entry.endTime = Date.now()
    entry.totalDuration = entry.endTime - entry.startTime

    // 结束最后一个阶段
    const lastPhase = entry.phases[entry.phases.length - 1]
    if (lastPhase && !lastPhase.endTime) {
      lastPhase.endTime = entry.endTime
      lastPhase.duration = lastPhase.endTime - lastPhase.startTime
    }

    // 合并元数据
    if (metadata) {
      entry.metadata = { ...entry.metadata, ...metadata }
    }

    // 生成阶段汇总
    const phaseSummary = entry.phases.map((p) => ({
      name: p.name,
      duration: p.duration || 0
    }))

    // 输出性能报告
    if (verboseMode) {
      logger.debug(`[${operationId}] ===== 完成: ${entry.operation} =====`)
      logger.debug(`[${operationId}] 总耗时: ${entry.totalDuration}ms`)
      if (phaseSummary.length > 0) {
        logger.debug(`[${operationId}] 阶段明细:`)
        phaseSummary.forEach((p) => {
          const percentage = ((p.duration / entry.totalDuration!) * 100).toFixed(1)
          logger.debug(`[${operationId}]   - ${p.name}: ${p.duration}ms (${percentage}%)`)
        })
      }
      if (entry.metadata) {
        logger.debug(`[${operationId}] 元数据:`, entry.metadata)
      }
    }

    // 清理
    performanceEntries.delete(operationId)

    return {
      totalDuration: entry.totalDuration,
      phases: phaseSummary
    }
  }

  /**
   * 包装异步函数，自动记录性能
   * @param operation 操作名称
   * @param fn 要执行的异步函数
   * @param metadata 附加元数据
   * @returns 函数执行结果
   */
  static async wrap<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const operationId = this.start(operation, metadata)
    try {
      const result = await fn()
      this.end(operationId, { success: true })
      return result
    } catch (error) {
      this.end(operationId, { success: false, error: (error as Error).message })
      throw error
    }
  }

  /**
   * 包装同步函数，自动记录性能
   */
  static wrapSync<T>(operation: string, fn: () => T, metadata?: Record<string, any>): T {
    const operationId = this.start(operation, metadata)
    try {
      const result = fn()
      this.end(operationId, { success: true })
      return result
    } catch (error) {
      this.end(operationId, { success: false, error: (error as Error).message })
      throw error
    }
  }

  /**
   * 创建一个带上下文的日志器
   * 方便在单个操作中多次调用
   */
  static createLogger(
    operation: string,
    metadata?: Record<string, any>
  ): {
    operationId: string
    phase: (name: string, phaseMeta?: Record<string, any>) => void
    end: (endMeta?: Record<string, any>) => ReturnType<typeof PerformanceLogger.end>
  } {
    const operationId = this.start(operation, metadata)
    return {
      operationId,
      phase: (name: string, phaseMeta?: Record<string, any>) => this.phase(operationId, name, phaseMeta),
      end: (endMeta?: Record<string, any>) => this.end(operationId, endMeta)
    }
  }

  /**
   * 计时装饰器工厂
   * 用于方法装饰
   */
  static timed(operation?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value
      const opName = operation || `${target.constructor.name}.${propertyKey}`

      descriptor.value = async function (...args: any[]) {
        return PerformanceLogger.wrap(opName, () => originalMethod.apply(this, args))
      }

      return descriptor
    }
  }
}

export default PerformanceLogger
