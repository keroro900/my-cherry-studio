/**
 * ShowVCP 调试服务
 *
 * 实现 VCP 的透明化调试机制，让开发者和用户能够实时"透视" AI 与工具的交互细节。
 *
 * 功能:
 * - 实时显示: 流式输出 VCP 调用信息
 * - 完整回顾: 非流式模式下拼接所有调用信息
 * - 开关控制: 全局开关 + 单次请求开关
 * - 双写日志: 同时写入 ToolCallTracer，确保工作台面板也能显示
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { BrowserWindow } from 'electron'

import type { ToolCallTracer } from './ToolCallTracer';
import { getToolCallTracer } from './ToolCallTracer'

const logger = loggerService.withContext('ShowVCPService')

/**
 * VCP 类型到 ToolCallTracer 工具类型的映射
 */
function mapVCPTypeToToolType(vcpType: VCPCallInfo['type']): 'mcp' | 'builtin' | 'plugin' | 'workflow' {
  switch (vcpType) {
    case 'tool_call':
      return 'plugin'
    case 'diary_read':
    case 'diary_write':
    case 'context':
    case 'variable':
      return 'builtin'
    case 'injection':
      return 'builtin'
    default:
      return 'plugin'
  }
}

// ==================== 类型定义 ====================

/**
 * VCP 调用信息
 */
export interface VCPCallInfo {
  id: string
  timestamp: Date
  type: 'injection' | 'tool_call' | 'diary_read' | 'diary_write' | 'context' | 'variable'
  name: string
  status: 'pending' | 'success' | 'failed'
  args?: Record<string, unknown>
  result?: unknown
  error?: string
  duration?: number
  metadata?: Record<string, unknown>
}

/**
 * VCP 会话信息
 */
export interface VCPSession {
  id: string
  startTime: Date
  endTime?: Date
  agentId?: string
  agentName?: string
  calls: VCPCallInfo[]
  injections: string[]
  totalDuration?: number
}

/**
 * ShowVCP 配置
 */
export interface ShowVCPConfig {
  enabled: boolean
  showTimestamp: boolean
  showDuration: boolean
  showArgs: boolean
  showResult: boolean
  maxHistorySessions: number
  formatStyle: 'compact' | 'detailed' | 'markdown'
}

// ==================== 服务实现 ====================

class ShowVCPService {
  private isGlobalEnabled: boolean = true // 默认启用以支持工作台
  private config: ShowVCPConfig = {
    enabled: true, // 默认启用日志记录
    showTimestamp: true,
    showDuration: true,
    showArgs: true,
    showResult: false,
    maxHistorySessions: 10,
    formatStyle: 'detailed'
  }

  private currentSession: VCPSession | null = null
  private sessionHistory: VCPSession[] = []
  private listeners: Map<string, (info: VCPCallInfo) => void> = new Map()
  /** 追踪进行中的调用 (用于无 session 时也能正确记录) */
  private pendingCalls: Map<string, VCPCallInfo> = new Map()

  /** ToolCallTracer 实例 (用于双写到工作台) */
  private tracer: ToolCallTracer
  /** ShowVCP callId -> ToolCallTracer callId 映射 */
  private callIdMapping: Map<string, string> = new Map()
  /** 当前 ToolCallTracer traceId */
  private currentTraceId: string | null = null

  constructor() {
    this.tracer = getToolCallTracer()
  }

  // ==================== 开关控制 ====================

  /**
   * 设置全局开关
   */
  setGlobalEnabled(enabled: boolean): void {
    this.isGlobalEnabled = enabled
    logger.info('ShowVCP global enabled', { enabled })
  }

  /**
   * 获取全局开关状态
   */
  isEnabled(): boolean {
    return this.isGlobalEnabled
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ShowVCPConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.enabled !== undefined) {
      this.isGlobalEnabled = config.enabled
    }
    logger.debug('ShowVCP config updated', { value: this.config })

    // 广播配置变化到渲染进程
    this.broadcastConfigChange()
  }

  /**
   * 广播配置变化到所有渲染进程
   */
  private broadcastConfigChange(): void {
    try {
      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) {
          window.webContents.send(IpcChannel.ShowVCP_ConfigChanged, { enabled: this.isGlobalEnabled })
        }
      })
    } catch (error) {
      logger.error('Failed to broadcast ShowVCP config change:', error as Error)
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): ShowVCPConfig {
    return { ...this.config }
  }

  // ==================== 会话管理 ====================

  /**
   * 开始新会话
   */
  startSession(agentId?: string, agentName?: string): string {
    // 结束之前的会话
    if (this.currentSession) {
      this.endSession()
    }

    const sessionId = `vcp-session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      agentId,
      agentName,
      calls: [],
      injections: []
    }

    // 同时在 ToolCallTracer 中开始新的调用链
    this.currentTraceId = this.tracer.startTrace({ sessionId, agentId, agentName })

    logger.debug('ShowVCP session started', { value: sessionId, traceId: this.currentTraceId })
    return sessionId
  }

  /**
   * 结束当前会话
   */
  endSession(): VCPSession | null {
    if (!this.currentSession) {
      return null
    }

    const session = this.currentSession
    session.endTime = new Date()
    session.totalDuration = session.endTime.getTime() - session.startTime.getTime()

    // 添加到历史记录
    this.sessionHistory.unshift(session)

    // 限制历史记录数量
    if (this.sessionHistory.length > this.config.maxHistorySessions) {
      this.sessionHistory.pop()
    }

    // 同时结束 ToolCallTracer 中的调用链
    if (this.currentTraceId) {
      this.tracer.endTrace(this.currentTraceId)
      this.currentTraceId = null
    }

    // 清理 callId 映射
    this.callIdMapping.clear()

    this.currentSession = null
    logger.debug('ShowVCP session ended', { id: session.id, duration: session.totalDuration })

    return session
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): VCPSession | null {
    return this.currentSession
  }

  /**
   * 获取历史会话
   */
  getSessionHistory(): VCPSession[] {
    return [...this.sessionHistory]
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.sessionHistory = []
    logger.debug('ShowVCP history cleared')
  }

  // ==================== 调用记录 ====================

  /**
   * 记录 VCP 调用开始
   * 注意: 始终广播到渲染进程，不受 isGlobalEnabled 影响
   * 双写: 同时写入 ToolCallTracer，确保工作台面板也能显示
   */
  logCallStart(
    type: VCPCallInfo['type'],
    name: string,
    args?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): string {
    const callId = `vcp-call-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    const callInfo: VCPCallInfo = {
      id: callId,
      timestamp: new Date(),
      type,
      name,
      status: 'pending',
      args,
      metadata
    }

    // 保存到 pending 调用 (用于 logCallEnd 时恢复信息)
    this.pendingCalls.set(callId, callInfo)

    if (this.currentSession) {
      this.currentSession.calls.push(callInfo)
    }

    // 双写到 ToolCallTracer (确保工作台面板能显示)
    // 如果没有 traceId，创建一个临时的
    const traceId = this.currentTraceId || this.tracer.startTrace({ source: 'ShowVCPService' })
    if (!this.currentTraceId) {
      this.currentTraceId = traceId
    }

    const tracerCallId = this.tracer.startCall({
      traceId,
      toolName: name,
      toolType: mapVCPTypeToToolType(type),
      params: (args || {}) as Record<string, unknown>,
      metadata: { ...metadata, vcpType: type }
    })

    // 保存 callId 映射
    this.callIdMapping.set(callId, tracerCallId)

    // 通知监听器 (受 isGlobalEnabled 控制)
    this.notifyListeners(callInfo)

    // 始终广播到渲染进程 (用于 VCPDebugPanel)
    this.sendToRenderer(callInfo)

    logger.debug('VCP call started:', { type, name, callId, tracerCallId })

    return callId
  }

  /**
   * 记录 VCP 调用完成
   * 注意: 始终广播到渲染进程，不受 isGlobalEnabled 影响
   * 双写: 同时写入 ToolCallTracer，确保工作台面板也能显示
   */
  logCallEnd(callId: string, result?: unknown, error?: string): void {
    // 优先从 pendingCalls 获取调用记录
    let call = this.pendingCalls.get(callId)

    // 如果没有，尝试从 session 获取
    if (!call && this.currentSession) {
      call = this.currentSession.calls.find((c) => c.id === callId)
    }

    // 如果还是没找到，创建一个临时的 callInfo
    if (!call) {
      call = {
        id: callId,
        timestamp: new Date(),
        type: 'tool_call',
        name: 'unknown',
        status: error ? 'failed' : 'success',
        result,
        error,
        duration: 0
      }
    } else {
      call.status = error ? 'failed' : 'success'
      call.result = result
      call.error = error
      call.duration = Date.now() - call.timestamp.getTime()
    }

    // 从 pendingCalls 移除
    this.pendingCalls.delete(callId)

    // 双写到 ToolCallTracer (确保工作台面板能显示)
    const tracerCallId = this.callIdMapping.get(callId)
    if (tracerCallId) {
      if (error) {
        this.tracer.endCallError(tracerCallId, { message: error })
      } else {
        this.tracer.endCallSuccess(tracerCallId, result)
      }
      this.callIdMapping.delete(callId)
    }

    // 通知监听器 (受 isGlobalEnabled 控制)
    this.notifyListeners(call)

    // 始终广播到渲染进程 (用于 VCPDebugPanel)
    this.sendToRenderer(call)

    logger.debug('VCP call ended:', {
      id: callId,
      status: call.status,
      duration: call.duration,
      tracerCallId
    })
  }

  /**
   * 记录上下文注入
   * 双写: 同时写入 ToolCallTracer，确保工作台面板也能显示
   */
  logInjection(content: string, source?: string): void {
    if (!this.currentSession) return

    this.currentSession.injections.push(content)

    const callInfo: VCPCallInfo = {
      id: `injection-${Date.now()}`,
      timestamp: new Date(),
      type: 'injection',
      name: source || 'context_injection',
      status: 'success',
      metadata: { contentLength: content.length }
    }

    this.currentSession.calls.push(callInfo)

    // 双写到 ToolCallTracer (确保工作台面板能显示)
    if (this.currentTraceId) {
      const tracerCallId = this.tracer.startCall({
        traceId: this.currentTraceId,
        toolName: source || 'context_injection',
        toolType: 'builtin',
        params: { contentLength: content.length, preview: content.substring(0, 100) }
      })
      this.tracer.endCallSuccess(tracerCallId, { injected: true })
    }

    this.notifyListeners(callInfo)
  }

  // ==================== 监听器 ====================

  /**
   * 添加监听器
   */
  addListener(id: string, callback: (info: VCPCallInfo) => void): void {
    this.listeners.set(id, callback)
  }

  /**
   * 移除监听器
   */
  removeListener(id: string): void {
    this.listeners.delete(id)
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(info: VCPCallInfo): void {
    if (!this.isGlobalEnabled) return

    // 通知内部监听器
    this.listeners.forEach((callback) => {
      try {
        callback(info)
      } catch (error) {
        logger.error('ShowVCP listener error:', error as Error)
      }
    })

    // 发送 IPC 事件到渲染进程
    this.sendToRenderer(info)
  }

  /**
   * 发送调用信息到渲染进程
   */
  private sendToRenderer(info: VCPCallInfo): void {
    try {
      // 转换 Date 为 ISO 字符串以便序列化
      const serializedInfo = {
        ...info,
        timestamp: info.timestamp.toISOString()
      }

      // 发送到所有窗口 - 同时发送到两个频道以确保所有 UI 组件都能接收
      // ShowVCP_CallUpdate: VCPLogViewer, VCPDebugPanel 使用
      // vcplog:callUpdate: WorkbenchPanel, useVCPInfo, VCPEventBridge 使用
      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) {
          window.webContents.send(IpcChannel.ShowVCP_CallUpdate, serializedInfo)
          // 同时发送到 vcplog 频道，确保 WorkbenchPanel 等组件能接收
          window.webContents.send('vcplog:callUpdate', {
            type: info.type,
            call: serializedInfo
          })
        }
      })
    } catch (error) {
      logger.error('Failed to send ShowVCP update to renderer:', error as Error)
    }
  }

  // ==================== 格式化输出 ====================

  /**
   * 格式化当前会话输出
   */
  formatCurrentSession(): string {
    if (!this.currentSession) {
      return '[ShowVCP] 无活动会话'
    }

    return this.formatSession(this.currentSession)
  }

  /**
   * 格式化会话输出
   */
  formatSession(session: VCPSession): string {
    switch (this.config.formatStyle) {
      case 'compact':
        return this.formatCompact(session)
      case 'markdown':
        return this.formatMarkdown(session)
      case 'detailed':
      default:
        return this.formatDetailed(session)
    }
  }

  private formatCompact(session: VCPSession): string {
    const lines: string[] = []
    lines.push(`[VCP Session ${session.id.substring(0, 12)}]`)

    if (session.agentName) {
      lines.push(`Agent: ${session.agentName}`)
    }

    lines.push(`Calls: ${session.calls.length}`)
    lines.push(`Injections: ${session.injections.length}`)

    if (session.totalDuration) {
      lines.push(`Duration: ${session.totalDuration}ms`)
    }

    return lines.join(' | ')
  }

  private formatDetailed(session: VCPSession): string {
    const lines: string[] = []

    lines.push('╔══════════════════════════════════════════════════════════════╗')
    lines.push('║                     ShowVCP 调试信息                          ║')
    lines.push('╠══════════════════════════════════════════════════════════════╣')

    if (session.agentName) {
      lines.push(`║ Agent: ${session.agentName}`)
    }

    lines.push(`║ 会话 ID: ${session.id}`)
    lines.push(`║ 开始时间: ${session.startTime.toISOString()}`)

    if (session.endTime) {
      lines.push(`║ 结束时间: ${session.endTime.toISOString()}`)
      lines.push(`║ 总耗时: ${session.totalDuration}ms`)
    }

    lines.push('╠══════════════════════════════════════════════════════════════╣')
    lines.push(`║ 调用记录 (${session.calls.length} 次):`)
    lines.push('╟──────────────────────────────────────────────────────────────╢')

    session.calls.forEach((call, index) => {
      const statusIcon = call.status === 'success' ? '✓' : call.status === 'failed' ? '✗' : '⋯'
      const duration = call.duration ? `(${call.duration}ms)` : ''

      lines.push(`║ ${index + 1}. [${statusIcon}] ${call.type}::${call.name} ${duration}`)

      if (this.config.showArgs && call.args) {
        const argsStr = JSON.stringify(call.args).substring(0, 60)
        lines.push(`║    参数: ${argsStr}${argsStr.length >= 60 ? '...' : ''}`)
      }

      if (call.error) {
        lines.push(`║    错误: ${call.error}`)
      }
    })

    if (session.injections.length > 0) {
      lines.push('╠══════════════════════════════════════════════════════════════╣')
      lines.push(`║ 上下文注入 (${session.injections.length} 条):`)
      session.injections.forEach((inj, index) => {
        const preview = inj.substring(0, 50).replace(/\n/g, ' ')
        lines.push(`║ ${index + 1}. ${preview}${inj.length > 50 ? '...' : ''}`)
      })
    }

    lines.push('╚══════════════════════════════════════════════════════════════╝')

    return lines.join('\n')
  }

  private formatMarkdown(session: VCPSession): string {
    const lines: string[] = []

    lines.push('## ShowVCP 调试信息')
    lines.push('')

    if (session.agentName) {
      lines.push(`**Agent:** ${session.agentName}`)
    }

    lines.push(`**会话 ID:** \`${session.id}\``)
    lines.push(`**开始时间:** ${session.startTime.toISOString()}`)

    if (session.totalDuration) {
      lines.push(`**总耗时:** ${session.totalDuration}ms`)
    }

    lines.push('')
    lines.push(`### 调用记录 (${session.calls.length} 次)`)
    lines.push('')
    lines.push('| # | 状态 | 类型 | 名称 | 耗时 |')
    lines.push('|---|------|------|------|------|')

    session.calls.forEach((call, index) => {
      const status = call.status === 'success' ? '✅' : call.status === 'failed' ? '❌' : '⏳'
      const duration = call.duration ? `${call.duration}ms` : '-'
      lines.push(`| ${index + 1} | ${status} | ${call.type} | ${call.name} | ${duration} |`)
    })

    if (session.injections.length > 0) {
      lines.push('')
      lines.push(`### 上下文注入 (${session.injections.length} 条)`)
      lines.push('')
      session.injections.forEach((inj, index) => {
        lines.push(`${index + 1}. ${inj.substring(0, 100)}${inj.length > 100 ? '...' : ''}`)
      })
    }

    return lines.join('\n')
  }

  /**
   * 生成实时流式输出（用于流式响应）
   */
  *generateStreamOutput(): Generator<string> {
    if (!this.currentSession) {
      yield '[ShowVCP] 无活动会话\n'
      return
    }

    const session = this.currentSession

    yield '┌─── ShowVCP 实时调试 ───┐\n'

    if (session.agentName) {
      yield `│ Agent: ${session.agentName}\n`
    }

    for (const call of session.calls) {
      const statusIcon = call.status === 'success' ? '✓' : call.status === 'failed' ? '✗' : '⋯'
      yield `│ [${statusIcon}] ${call.type}::${call.name}\n`
    }

    yield '└────────────────────────┘\n'
  }
}

// ==================== 单例导出 ====================

let showVCPService: ShowVCPService | null = null

export function getShowVCPService(): ShowVCPService {
  if (!showVCPService) {
    showVCPService = new ShowVCPService()
  }
  return showVCPService
}

export default ShowVCPService
