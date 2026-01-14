/**
 * ToolCallTracer - 工具调用追踪服务
 *
 * 记录和追踪工具调用：
 * 1. 调用链追踪
 * 2. 输入/输出记录
 * 3. 性能统计
 * 4. 错误追踪
 *
 * 与 ShowVCP 面板集成显示调用日志
 *
 * @renamed 2026-01-06 从 VCPLogService 重命名为 ToolCallTracer
 * 避免与 BuiltinServices/VCPLogService（用户工具服务）命名冲突
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { BrowserWindow } from 'electron'

const logger = loggerService.withContext('ToolCallTracer')

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * 工具调用记录
 */
export interface ToolCallLog {
  id: string
  traceId: string // 调用链 ID
  parentCallId?: string // 父调用 ID (用于嵌套调用)
  toolName: string
  toolType: 'mcp' | 'builtin' | 'plugin' | 'workflow'
  startTime: Date
  endTime?: Date
  duration?: number // ms
  input: {
    params: Record<string, unknown>
    truncated?: boolean // 输入是否被截断
  }
  output?: {
    result: unknown
    truncated?: boolean // 输出是否被截断
  }
  error?: {
    message: string
    code?: string
    stack?: string
  }
  status: 'pending' | 'running' | 'success' | 'error'
  metadata?: {
    userId?: string
    sessionId?: string
    modelId?: string
    [key: string]: unknown
  }
}

/**
 * 调用链统计
 */
export interface TraceStats {
  traceId: string
  startTime: Date
  endTime?: Date
  totalDuration?: number
  callCount: number
  successCount: number
  errorCount: number
  toolBreakdown: Record<
    string,
    {
      count: number
      totalDuration: number
      avgDuration: number
    }
  >
}

/**
 * 日志条目
 */
export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  category: string
  message: string
  data?: Record<string, unknown>
  traceId?: string
  callId?: string
}

/**
 * 工具调用回调数据
 */
export interface ToolCallCallbackData {
  callId: string
  traceId: string
  toolName: string
  toolType: 'mcp' | 'builtin' | 'plugin' | 'workflow'
  pluginName?: string
  startTime: Date
  endTime?: Date
  duration?: number
  input?: Record<string, unknown>
  output?: unknown
  error?: string
  status: 'pending' | 'running' | 'success' | 'error'
}

/**
 * ToolCallTracer
 * 工具调用追踪器（原 VCPLogService）
 */
export class ToolCallTracer {
  private calls: Map<string, ToolCallLog> = new Map()
  private traces: Map<string, string[]> = new Map() // traceId -> callIds
  private logs: LogEntry[] = []
  private maxCalls: number = 500
  private maxLogs: number = 1000
  private maxInputOutputSize: number = 5000 // 字符
  private callStartListeners: Array<(call: ToolCallCallbackData) => void> = []
  private callEndListeners: Array<(call: ToolCallCallbackData) => void> = []

  constructor() {
    logger.info('VCPLogService initialized')
  }

  /**
   * 开始新的调用链
   */
  startTrace(metadata?: Record<string, unknown>): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    this.traces.set(traceId, [])

    this.log('info', 'Trace', `Trace started: ${traceId}`, { traceId, ...metadata }, traceId)

    return traceId
  }

  /**
   * 记录工具调用开始
   */
  startCall(params: {
    traceId: string
    toolName: string
    toolType: 'mcp' | 'builtin' | 'plugin' | 'workflow'
    params: Record<string, unknown>
    parentCallId?: string
    metadata?: Record<string, unknown>
  }): string {
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // 截断大型输入
    const { truncated: inputTruncated, value: truncatedParams } = this.truncateValue(params.params)

    const call: ToolCallLog = {
      id: callId,
      traceId: params.traceId,
      parentCallId: params.parentCallId,
      toolName: params.toolName,
      toolType: params.toolType,
      startTime: new Date(),
      input: {
        params: truncatedParams as Record<string, unknown>,
        truncated: inputTruncated
      },
      status: 'running',
      metadata: params.metadata
    }

    this.calls.set(callId, call)

    // 添加到调用链
    const trace = this.traces.get(params.traceId)
    if (trace) {
      trace.push(callId)
    }

    this.cleanupOldCalls()
    this.broadcastCallUpdate(call, 'start')
    this.notifyCallStart(call)

    this.log(
      'debug',
      'ToolCall',
      `Call started: ${params.toolName}`,
      {
        callId,
        toolName: params.toolName,
        toolType: params.toolType
      },
      params.traceId,
      callId
    )

    return callId
  }

  /**
   * 记录工具调用成功
   */
  endCallSuccess(callId: string, result: unknown): void {
    const call = this.calls.get(callId)
    if (!call) return

    call.endTime = new Date()
    call.duration = call.endTime.getTime() - call.startTime.getTime()
    call.status = 'success'

    // 截断大型输出
    const { truncated: outputTruncated, value: truncatedResult } = this.truncateValue(result)
    call.output = {
      result: truncatedResult,
      truncated: outputTruncated
    }

    this.broadcastCallUpdate(call, 'end')
    this.notifyCallEnd(call)

    this.log(
      'info',
      'ToolCall',
      `Call succeeded: ${call.toolName} (${call.duration}ms)`,
      {
        callId,
        duration: call.duration
      },
      call.traceId,
      callId
    )
  }

  /**
   * 记录工具调用失败
   */
  endCallError(callId: string, error: { message: string; code?: string; stack?: string }): void {
    const call = this.calls.get(callId)
    if (!call) return

    call.endTime = new Date()
    call.duration = call.endTime.getTime() - call.startTime.getTime()
    call.status = 'error'
    call.error = error

    this.broadcastCallUpdate(call, 'error')
    this.notifyCallEnd(call)

    this.log(
      'error',
      'ToolCall',
      `Call failed: ${call.toolName} - ${error.message}`,
      {
        callId,
        error: error.message,
        code: error.code,
        duration: call.duration
      },
      call.traceId,
      callId
    )
  }

  /**
   * 结束调用链
   */
  endTrace(traceId: string): TraceStats | undefined {
    const callIds = this.traces.get(traceId)
    if (!callIds) return undefined

    const calls = callIds.map((id) => this.calls.get(id)).filter((c): c is ToolCallLog => c !== undefined)

    if (calls.length === 0) return undefined

    const stats = this.calculateTraceStats(traceId, calls)

    this.log(
      'info',
      'Trace',
      `Trace ended: ${traceId}`,
      {
        traceId,
        callCount: stats.callCount,
        totalDuration: stats.totalDuration,
        successCount: stats.successCount,
        errorCount: stats.errorCount
      },
      traceId
    )

    return stats
  }

  /**
   * 计算调用链统计
   */
  private calculateTraceStats(traceId: string, calls: ToolCallLog[]): TraceStats {
    const startTime = calls.reduce((min, c) => (c.startTime < min ? c.startTime : min), calls[0].startTime)

    const endTime = calls.reduce(
      (max, c) => (c.endTime && c.endTime > max ? c.endTime : max),
      calls[0].endTime || new Date()
    )

    const toolBreakdown: TraceStats['toolBreakdown'] = {}

    for (const call of calls) {
      if (!toolBreakdown[call.toolName]) {
        toolBreakdown[call.toolName] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0
        }
      }

      const tool = toolBreakdown[call.toolName]
      tool.count++
      tool.totalDuration += call.duration || 0
      tool.avgDuration = tool.totalDuration / tool.count
    }

    return {
      traceId,
      startTime,
      endTime,
      totalDuration: endTime.getTime() - startTime.getTime(),
      callCount: calls.length,
      successCount: calls.filter((c) => c.status === 'success').length,
      errorCount: calls.filter((c) => c.status === 'error').length,
      toolBreakdown
    }
  }

  /**
   * 添加日志
   */
  log(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>,
    traceId?: string,
    callId?: string
  ): void {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      traceId,
      callId
    }

    this.logs.push(entry)
    this.cleanupOldLogs()

    // 广播日志
    this.broadcastLog(entry)
  }

  /**
   * 获取调用记录
   */
  getCall(callId: string): ToolCallLog | undefined {
    return this.calls.get(callId)
  }

  /**
   * 获取调用链中的所有调用
   */
  getTraceCalls(traceId: string): ToolCallLog[] {
    const callIds = this.traces.get(traceId)
    if (!callIds) return []

    return callIds.map((id) => this.calls.get(id)).filter((c): c is ToolCallLog => c !== undefined)
  }

  /**
   * 获取最近的调用
   */
  getRecentCalls(limit: number = 50): ToolCallLog[] {
    return Array.from(this.calls.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit)
  }

  /**
   * 获取最近的日志
   */
  getRecentLogs(limit: number = 100, level?: LogLevel): LogEntry[] {
    let logs = this.logs
    if (level) {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
      const minLevel = levels.indexOf(level)
      logs = logs.filter((l) => levels.indexOf(l.level) >= minLevel)
    }

    return logs.slice(-limit)
  }

  /**
   * 截断大型值
   */
  private truncateValue(value: unknown): { truncated: boolean; value: unknown } {
    try {
      const json = JSON.stringify(value)
      if (json.length <= this.maxInputOutputSize) {
        return { truncated: false, value }
      }

      // 尝试截断
      const truncated = JSON.parse(json.slice(0, this.maxInputOutputSize))
      return { truncated: true, value: truncated }
    } catch {
      // 无法序列化，返回描述
      return { truncated: true, value: `[Non-serializable: ${typeof value}]` }
    }
  }

  /**
   * 广播调用更新
   */
  private broadcastCallUpdate(call: ToolCallLog, eventType: 'start' | 'end' | 'error'): void {
    try {
      const serializedCall = JSON.parse(
        JSON.stringify(call, (_key, value) => {
          if (value instanceof Date) {
            return value.toISOString()
          }
          return value
        })
      )

      // 发送到所有窗口 - 同时发送到两个频道以确保所有 UI 组件都能接收
      // vcplog:callUpdate: WorkbenchPanel, useVCPInfo, VCPEventBridge 使用
      // ShowVCP_CallUpdate: VCPLogViewer, VCPDebugPanel 使用
      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) {
          // 原有的 vcplog 频道
          window.webContents.send('vcplog:callUpdate', {
            type: eventType,
            call: serializedCall
          })
          // 同时发送到 ShowVCP 频道，确保 VCPLogViewer 等组件能接收
          window.webContents.send(IpcChannel.ShowVCP_CallUpdate, {
            id: call.id,
            type: call.toolType === 'mcp' ? 'mcp_tool' : 'tool_call',
            name: call.toolName,
            params: call.input?.params || {},
            result: call.output?.result,
            error: call.error?.message,
            timestamp: serializedCall.startTime,
            endTime: serializedCall.endTime,
            status: call.status
          })
        }
      })
    } catch (error) {
      logger.error('Failed to broadcast call update', error as Error)
    }
  }

  /**
   * 广播日志
   */
  broadcastLog(entry: LogEntry): void {
    try {
      const serializedEntry = JSON.parse(
        JSON.stringify(entry, (_key, value) => {
          if (value instanceof Date) {
            return value.toISOString()
          }
          return value
        })
      )

      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) {
          window.webContents.send('vcplog:log', serializedEntry)
        }
      })
    } catch (error) {
      logger.error('Failed to broadcast log', error as Error)
    }
  }

  /**
   * 清理旧调用
   */
  private cleanupOldCalls(): void {
    if (this.calls.size <= this.maxCalls) return

    const calls = Array.from(this.calls.entries()).sort((a, b) => a[1].startTime.getTime() - b[1].startTime.getTime())

    const toRemove = calls.slice(0, calls.length - this.maxCalls)

    for (const [id] of toRemove) {
      const call = this.calls.get(id)
      if (call && call.status !== 'running') {
        this.calls.delete(id)
      }
    }
  }

  /**
   * 清理旧日志
   */
  private cleanupOldLogs(): void {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /**
   * 通知调用开始监听器
   */
  private notifyCallStart(call: ToolCallLog): void {
    const data: ToolCallCallbackData = {
      callId: call.id,
      traceId: call.traceId,
      toolName: call.toolName,
      toolType: call.toolType,
      startTime: call.startTime,
      input: call.input.params,
      status: call.status
    }

    for (const listener of this.callStartListeners) {
      try {
        listener(data)
      } catch (error) {
        logger.error('Call start listener error', error as Error)
      }
    }
  }

  /**
   * 通知调用结束监听器
   */
  private notifyCallEnd(call: ToolCallLog): void {
    const data: ToolCallCallbackData = {
      callId: call.id,
      traceId: call.traceId,
      toolName: call.toolName,
      toolType: call.toolType,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      input: call.input.params,
      output: call.output?.result,
      error: call.error?.message,
      status: call.status
    }

    for (const listener of this.callEndListeners) {
      try {
        listener(data)
      } catch (error) {
        logger.error('Call end listener error', error as Error)
      }
    }
  }

  /**
   * 注册调用开始回调
   */
  onCallStart(listener: (call: ToolCallCallbackData) => void): () => void {
    this.callStartListeners.push(listener)
    return () => {
      const index = this.callStartListeners.indexOf(listener)
      if (index !== -1) {
        this.callStartListeners.splice(index, 1)
      }
    }
  }

  /**
   * 注册调用结束回调
   */
  onCallEnd(listener: (call: ToolCallCallbackData) => void): () => void {
    this.callEndListeners.push(listener)
    return () => {
      const index = this.callEndListeners.indexOf(listener)
      if (index !== -1) {
        this.callEndListeners.splice(index, 1)
      }
    }
  }

  /**
   * 清空所有记录
   */
  clear(): void {
    this.calls.clear()
    this.traces.clear()
    this.logs = []
    logger.info('All logs cleared')
  }
}

// 单例
let _instance: ToolCallTracer | null = null

export function getToolCallTracer(): ToolCallTracer {
  if (!_instance) {
    _instance = new ToolCallTracer()
  }
  return _instance
}

export function createToolCallTracer(): ToolCallTracer {
  return new ToolCallTracer()
}

// 向后兼容别名（deprecated，将在下个版本移除）
/** @deprecated 使用 ToolCallTracer 代替 */
export type VCPLogService = ToolCallTracer
/** @deprecated 使用 getToolCallTracer 代替 */
export const getVCPLogService = getToolCallTracer
/** @deprecated 使用 createToolCallTracer 代替 */
export const createVCPLogService = createToolCallTracer
