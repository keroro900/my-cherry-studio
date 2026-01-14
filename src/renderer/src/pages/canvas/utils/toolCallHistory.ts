/**
 * 工具调用历史服务
 *
 * 存储和管理 Canvas 聊天中的工具调用记录
 * 使用 localStorage 进行持久化（数据量较小）
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('ToolCallHistory')

const STORAGE_KEY = 'canvas-tool-call-history'
const MAX_HISTORY_ITEMS = 100

/**
 * 工具调用历史记录
 */
export interface ToolCallRecord {
  id: string
  toolName: string
  arguments: Record<string, unknown>
  result?: string
  error?: string
  success: boolean
  duration: number // 毫秒
  timestamp: number
  sessionId?: string // 可选的会话 ID
}

/**
 * 工具调用统计
 */
export interface ToolCallStats {
  total: number
  successful: number
  failed: number
  successRate: number
  averageDuration: number
  byTool: Record<string, { count: number; successRate: number; avgDuration: number }>
}

class ToolCallHistoryService {
  private history: ToolCallRecord[] = []
  private isInitialized = false

  constructor() {
    this.load()
  }

  /**
   * 从 localStorage 加载历史
   */
  private load(): void {
    if (this.isInitialized) return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.history = JSON.parse(stored)
        logger.debug('Tool call history loaded', { count: this.history.length })
      }
    } catch (error) {
      logger.error('Failed to load tool call history', { error })
      this.history = []
    }

    this.isInitialized = true
  }

  /**
   * 保存到 localStorage
   */
  private save(): void {
    try {
      // 限制历史记录数量
      if (this.history.length > MAX_HISTORY_ITEMS) {
        this.history = this.history.slice(-MAX_HISTORY_ITEMS)
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history))
    } catch (error) {
      logger.error('Failed to save tool call history', { error })
    }
  }

  /**
   * 添加工具调用记录
   */
  addRecord(record: Omit<ToolCallRecord, 'id' | 'timestamp'>): ToolCallRecord {
    const fullRecord: ToolCallRecord = {
      ...record,
      id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now()
    }

    this.history.push(fullRecord)
    this.save()

    logger.debug('Tool call recorded', {
      toolName: record.toolName,
      success: record.success,
      duration: record.duration
    })

    return fullRecord
  }

  /**
   * 获取历史记录
   */
  getHistory(options?: {
    toolName?: string
    sessionId?: string
    successOnly?: boolean
    limit?: number
  }): ToolCallRecord[] {
    let result = [...this.history]

    if (options?.toolName) {
      result = result.filter((r) => r.toolName === options.toolName)
    }

    if (options?.sessionId) {
      result = result.filter((r) => r.sessionId === options.sessionId)
    }

    if (options?.successOnly) {
      result = result.filter((r) => r.success)
    }

    // 按时间倒序
    result.sort((a, b) => b.timestamp - a.timestamp)

    if (options?.limit) {
      result = result.slice(0, options.limit)
    }

    return result
  }

  /**
   * 获取最近的工具调用
   */
  getRecent(count: number = 10): ToolCallRecord[] {
    return this.getHistory({ limit: count })
  }

  /**
   * 获取统计信息
   */
  getStats(): ToolCallStats {
    const successful = this.history.filter((r) => r.success)
    const failed = this.history.filter((r) => !r.success)
    const durations = this.history.map((r) => r.duration)
    const totalDuration = durations.reduce((a, b) => a + b, 0)

    // 按工具统计
    const byTool: Record<string, { count: number; successRate: number; avgDuration: number }> = {}

    this.history.forEach((r) => {
      if (!byTool[r.toolName]) {
        byTool[r.toolName] = { count: 0, successRate: 0, avgDuration: 0 }
      }
      byTool[r.toolName].count++
    })

    Object.keys(byTool).forEach((toolName) => {
      const toolRecords = this.history.filter((r) => r.toolName === toolName)
      const toolSuccessful = toolRecords.filter((r) => r.success).length
      const toolDurations = toolRecords.map((r) => r.duration)

      byTool[toolName].successRate =
        toolRecords.length > 0 ? (toolSuccessful / toolRecords.length) * 100 : 0
      byTool[toolName].avgDuration =
        toolDurations.length > 0
          ? toolDurations.reduce((a, b) => a + b, 0) / toolDurations.length
          : 0
    })

    return {
      total: this.history.length,
      successful: successful.length,
      failed: failed.length,
      successRate: this.history.length > 0 ? (successful.length / this.history.length) * 100 : 0,
      averageDuration: this.history.length > 0 ? totalDuration / this.history.length : 0,
      byTool
    }
  }

  /**
   * 清除历史
   */
  clear(): void {
    this.history = []
    this.save()
    logger.info('Tool call history cleared')
  }

  /**
   * 清除指定会话的历史
   */
  clearSession(sessionId: string): number {
    const originalLength = this.history.length
    this.history = this.history.filter((r) => r.sessionId !== sessionId)
    const deletedCount = originalLength - this.history.length
    if (deletedCount > 0) {
      this.save()
    }
    return deletedCount
  }

  /**
   * 清除指定时间之前的历史
   */
  clearBefore(timestamp: number): number {
    const originalLength = this.history.length
    this.history = this.history.filter((r) => r.timestamp >= timestamp)
    const deletedCount = originalLength - this.history.length
    if (deletedCount > 0) {
      this.save()
    }
    return deletedCount
  }

  /**
   * 导出历史为 JSON
   */
  export(): string {
    return JSON.stringify(this.history, null, 2)
  }
}

// 导出单例
export const toolCallHistory = new ToolCallHistoryService()

export default ToolCallHistoryService
