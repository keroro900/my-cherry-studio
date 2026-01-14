/**
 * Memory Call Tracer - 记忆调用追踪服务
 *
 * 记录所有记忆系统调用，包括：
 * - 调用来源（caller）
 * - 调用方法（method）
 * - 后端类型（backend）
 * - 向量信息（dimension, count, location）
 * - 耗时（durationMs）
 *
 * 用于调试和可视化记忆系统调用链路
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('MemoryTracer')

// ==================== 类型定义 ====================

export interface MemoryCallRecord {
  id: string
  timestamp: string
  caller: string
  method: string
  params: Record<string, unknown>
  result?: {
    success: boolean
    count?: number
    error?: string
  }
  durationMs: number
  backend?: string
  vectorInfo?: {
    dimension?: number
    count?: number
    location?: string
    similarity?: number
  }
  metadata?: Record<string, unknown>
}

export interface MemoryTraceStats {
  totalCalls: number
  totalDurationMs: number
  callsByMethod: Record<string, number>
  callsByBackend: Record<string, number>
  averageDurationMs: number
  errorCount: number
}

// ==================== 追踪服务 ====================

class MemoryCallTracerImpl {
  private static instance: MemoryCallTracerImpl | null = null
  private records: MemoryCallRecord[] = []
  private maxRecords = 1000
  private enabled = true

  private constructor() {}

  static getInstance(): MemoryCallTracerImpl {
    if (!MemoryCallTracerImpl.instance) {
      MemoryCallTracerImpl.instance = new MemoryCallTracerImpl()
    }
    return MemoryCallTracerImpl.instance
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * 记录调用
   */
  record(
    caller: string,
    method: string,
    params: Record<string, unknown>,
    options?: {
      backend?: string
      vectorInfo?: MemoryCallRecord['vectorInfo']
      metadata?: Record<string, unknown>
    }
  ): string {
    const id = this.generateId()
    const record: MemoryCallRecord = {
      id,
      timestamp: new Date().toISOString(),
      caller,
      method,
      params,
      durationMs: 0,
      ...options
    }

    this.records.unshift(record)

    // 限制记录数量
    while (this.records.length > this.maxRecords) {
      this.records.pop()
    }

    // 输出日志
    if (this.enabled) {
      logger.info(`[TRACE] ${caller} -> ${method}`, {
        id,
        backend: options?.backend,
        params: this.summarizeParams(params)
      })
    }

    return id
  }

  /**
   * 完成调用记录
   */
  complete(
    id: string,
    result: MemoryCallRecord['result'],
    durationMs: number,
    vectorInfo?: MemoryCallRecord['vectorInfo']
  ): void {
    const record = this.records.find((r) => r.id === id)
    if (record) {
      record.result = result
      record.durationMs = durationMs
      if (vectorInfo) {
        record.vectorInfo = vectorInfo
      }

      // 输出完成日志
      if (this.enabled && result) {
        const status = result.success ? '✅' : '❌'
        logger.info(`[TRACE] ${status} ${record.method} completed`, {
          id,
          durationMs,
          resultCount: result.count,
          error: result.error
        })
      }
    }
  }

  /**
   * 简化参数用于日志
   */
  private summarizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const summary: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 100) {
        summary[key] = value.slice(0, 100) + '...'
      } else if (Array.isArray(value)) {
        summary[key] = `Array(${value.length})`
      } else {
        summary[key] = value
      }
    }
    return summary
  }

  /**
   * 获取所有记录
   */
  getRecords(limit?: number): MemoryCallRecord[] {
    return limit ? this.records.slice(0, limit) : [...this.records]
  }

  /**
   * 获取统计
   */
  getStats(): MemoryTraceStats {
    const callsByMethod: Record<string, number> = {}
    const callsByBackend: Record<string, number> = {}
    let totalDurationMs = 0
    let errorCount = 0

    for (const record of this.records) {
      // 按方法统计
      callsByMethod[record.method] = (callsByMethod[record.method] || 0) + 1

      // 按后端统计
      if (record.backend) {
        callsByBackend[record.backend] = (callsByBackend[record.backend] || 0) + 1
      }

      // 总耗时
      totalDurationMs += record.durationMs

      // 错误计数
      if (record.result && !record.result.success) {
        errorCount++
      }
    }

    return {
      totalCalls: this.records.length,
      totalDurationMs,
      callsByMethod,
      callsByBackend,
      averageDurationMs: this.records.length > 0 ? totalDurationMs / this.records.length : 0,
      errorCount
    }
  }

  /**
   * 获取调用链路图（树状结构）
   */
  getCallGraph(): Array<{
    timestamp: string
    caller: string
    method: string
    backend?: string
    durationMs: number
    success: boolean
    children?: unknown[]
  }> {
    return this.records.slice(0, 50).map((r) => ({
      timestamp: r.timestamp,
      caller: r.caller,
      method: r.method,
      backend: r.backend,
      durationMs: r.durationMs,
      success: r.result?.success ?? true
    }))
  }

  /**
   * 获取向量存储信息
   *
   * @deprecated 文档数统计不准确，使用 IntegratedMemoryCoordinator.getIntegratedStats() 获取真实数据。
   * NativeVCPIpcHandler 已合并两个数据源，保留此方法仅供存储位置和维度信息。
   *
   * 注意: 实际存储位置:
   * - diary/notes: Data/Notes/ (Markdown 文件 + 搜索索引)
   * - memory: Data/Memory/memories.db (SQLite + 向量)
   * - knowledge: Data/KnowledgeBase (向量索引)
   * - lightmemo: native-vcp/lightmemo-index (Native VCP 索引)
   * - deepmemo: tantivy-indices/ (Tantivy 全文索引)
   */
  getVectorStorageInfo(): Array<{
    backend: string
    location: string
    dimension: number
    documentCount: number
  }> {
    const userData = app.getPath('userData')

    // 辅助函数: 统计目录中的文件数 (递归)
    const countFiles = (dirPath: string, extensions?: string[]): number => {
      try {
        if (!fs.existsSync(dirPath)) return 0
        const stat = fs.statSync(dirPath)
        if (!stat.isDirectory()) {
          // 如果是单个文件
          if (extensions) {
            return extensions.some((ext) => dirPath.endsWith(ext)) ? 1 : 0
          }
          return 1
        }
        let count = 0
        const items = fs.readdirSync(dirPath)
        for (const item of items) {
          const itemPath = path.join(dirPath, item)
          try {
            const itemStat = fs.statSync(itemPath)
            if (itemStat.isDirectory()) {
              count += countFiles(itemPath, extensions)
            } else if (!extensions || extensions.some((ext) => item.endsWith(ext))) {
              count++
            }
          } catch {
            // 忽略无法访问的文件
          }
        }
        return count
      } catch (error) {
        logger.debug('Error counting files', { dirPath, error })
        return 0
      }
    }

    const notesPath = path.join(userData, 'Data', 'Notes')
    const memoryDbPath = path.join(userData, 'Data', 'Memory', 'memories.db')
    const knowledgePath = path.join(userData, 'Data', 'KnowledgeBase')
    const lightmemoPath = path.join(userData, 'native-vcp', 'lightmemo-index')
    const deepmemoPath = path.join(userData, 'tantivy-indices')

    return [
      {
        backend: 'notes',
        location: notesPath,
        dimension: 0, // Markdown 文件，无向量维度
        documentCount: countFiles(notesPath, ['.md', '.txt'])
      },
      {
        backend: 'memory',
        location: memoryDbPath,
        dimension: 1536,
        // SQLite 文件存在时算 1，否则需要实际查询数据库
        documentCount: fs.existsSync(memoryDbPath) ? 1 : 0
      },
      {
        backend: 'knowledge',
        location: knowledgePath,
        dimension: 1536,
        documentCount: countFiles(knowledgePath)
      },
      {
        backend: 'lightmemo',
        location: lightmemoPath,
        dimension: 768,
        documentCount: countFiles(lightmemoPath)
      },
      {
        backend: 'deepmemo',
        location: deepmemoPath,
        dimension: 0, // Tantivy 全文索引，无向量维度
        documentCount: countFiles(deepmemoPath)
      }
    ]
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.records = []
    logger.info('Memory call records cleared')
  }

  /**
   * 启用/禁用追踪
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    logger.info(`Memory tracing ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled
  }
}

// ==================== 导出 ====================

let tracerInstance: MemoryCallTracerImpl | null = null

export function getMemoryCallTracer(): MemoryCallTracerImpl {
  if (!tracerInstance) {
    tracerInstance = MemoryCallTracerImpl.getInstance()
  }
  return tracerInstance
}

export type MemoryCallTracer = MemoryCallTracerImpl

// ==================== 便捷函数 ====================

/**
 * 追踪包装器 - 用于包装异步函数并自动记录调用
 */
export function withTracing<T extends (...args: unknown[]) => Promise<unknown>>(
  caller: string,
  method: string,
  fn: T,
  options?: { backend?: string }
): T {
  return (async (...args: Parameters<T>) => {
    const tracer = getMemoryCallTracer()
    const startTime = Date.now()
    const traceId = tracer.record(caller, method, { args: args.slice(0, 2) }, options)

    try {
      const result = await fn(...args)
      tracer.complete(
        traceId,
        { success: true, count: Array.isArray(result) ? result.length : 1 },
        Date.now() - startTime
      )
      return result
    } catch (error) {
      tracer.complete(
        traceId,
        { success: false, error: error instanceof Error ? error.message : String(error) },
        Date.now() - startTime
      )
      throw error
    }
  }) as T
}
