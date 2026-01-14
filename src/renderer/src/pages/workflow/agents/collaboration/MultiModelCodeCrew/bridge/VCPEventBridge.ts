/**
 * VCPEventBridge - Crew 事件与 VCP 控制台桥接
 *
 * 实现 Crew 执行事件与 VCP 事件系统的双向同步：
 * - Crew 事件 → VCP 事件（工具调用、任务状态）
 * - VCP 事件 → Crew 响应（工具执行完成通知）
 */

import { loggerService } from '@logger'

import type { CrewEvent, CrewPhase, CrewRoleInfo, CrewStatus } from '../types'

const logger = loggerService.withContext('VCPEventBridge')

// ==================== 类型定义 ====================

/**
 * VCP 事件格式
 */
interface VCPEvent {
  type: string
  sessionId?: string
  timestamp: number
  data?: unknown
}

/**
 * 工具执行完成事件
 */
interface ToolExecutionCompleteEvent {
  toolName: string
  pluginName?: string
  result: unknown
  success: boolean
  error?: string
  duration?: number
}

/**
 * Agent 消息事件
 */
interface AgentMessageEvent {
  agentId: string
  agentName: string
  content: string
  type: 'thinking' | 'action' | 'observation' | 'result'
}

/**
 * 事件处理器集合
 */
interface VCPEventHandlers {
  onToolExecutionComplete?: (event: ToolExecutionCompleteEvent) => void
  onAgentMessage?: (event: AgentMessageEvent) => void
  onPluginEvent?: (event: VCPEvent) => void
  onAsyncTaskUpdate?: (taskId: string, status: string, result?: unknown) => void
}

/**
 * 桥接配置
 */
interface VCPEventBridgeConfig {
  /** 是否启用事件转发 */
  forwardEvents: boolean
  /** 是否启用事件接收 */
  receiveEvents: boolean
  /** 会话 ID */
  sessionId?: string
}

// ==================== 事件桥接器实现 ====================

class VCPEventBridgeImpl {
  private config: VCPEventBridgeConfig = {
    forwardEvents: true,
    receiveEvents: true
  }
  private vcpUnsubscribe: (() => void) | null = null
  private handlers: VCPEventHandlers = {}
  private eventBuffer: CrewEvent[] = []
  private maxBufferSize = 100

  /**
   * 初始化桥接器
   */
  initialize(config?: Partial<VCPEventBridgeConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // 订阅 VCP 事件
    if (this.config.receiveEvents) {
      this.subscribeVCPEvents()
    }

    logger.debug('Initialized', { config: this.config })
  }

  /**
   * 销毁桥接器
   */
  destroy(): void {
    if (this.vcpUnsubscribe) {
      this.vcpUnsubscribe()
      this.vcpUnsubscribe = null
    }
    this.handlers = {}
    this.eventBuffer = []
    logger.debug('Destroyed')
  }

  /**
   * 设置会话 ID
   */
  setSessionId(sessionId: string): void {
    this.config.sessionId = sessionId
  }

  /**
   * 注册事件处理器
   */
  registerHandlers(handlers: VCPEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers }
  }

  /**
   * 取消注册事件处理器
   */
  unregisterHandlers(): void {
    this.handlers = {}
  }

  // ==================== Crew → VCP 事件转发 ====================

  /**
   * 转发 Crew 事件到 VCP
   */
  forwardCrewEvent(event: CrewEvent): void {
    if (!this.config.forwardEvents) return

    // 添加到缓冲
    this.addToBuffer(event)

    // 转换并发送
    const vcpEvent: VCPEvent = {
      type: `crew:${event.type}`,
      sessionId: event.sessionId || this.config.sessionId,
      timestamp: event.timestamp.getTime(),
      data: event.data
    }

    this.sendToVCP(vcpEvent)
  }

  /**
   * 发布任务开始事件
   */
  emitTaskStart(sessionId: string, taskTitle: string, phase: CrewPhase): void {
    this.forwardCrewEvent({
      type: 'task_start',
      sessionId,
      timestamp: new Date(),
      data: { taskTitle, phase }
    })
  }

  /**
   * 发布任务完成事件
   */
  emitTaskComplete(sessionId: string, taskTitle: string, result: unknown): void {
    this.forwardCrewEvent({
      type: 'task_complete',
      sessionId,
      timestamp: new Date(),
      data: { taskTitle, result }
    })
  }

  /**
   * 发布角色开始工作事件
   */
  emitRoleStart(sessionId: string, role: CrewRoleInfo, task: string): void {
    this.forwardCrewEvent({
      type: 'role_start',
      sessionId,
      timestamp: new Date(),
      data: { roleId: role.id, roleName: role.name, task }
    })
  }

  /**
   * 发布角色完成工作事件
   */
  emitRoleComplete(sessionId: string, role: CrewRoleInfo, output: string): void {
    this.forwardCrewEvent({
      type: 'role_complete',
      sessionId,
      timestamp: new Date(),
      data: { roleId: role.id, roleName: role.name, output: output.slice(0, 500) }
    })
  }

  /**
   * 发布工具调用事件
   */
  emitToolCall(sessionId: string, toolName: string, params: Record<string, unknown>, source: string): void {
    this.forwardCrewEvent({
      type: 'tool_call',
      sessionId,
      timestamp: new Date(),
      data: { toolName, params, source }
    })
  }

  /**
   * 发布工具结果事件
   */
  emitToolResult(sessionId: string, toolName: string, success: boolean, result: unknown, duration?: number): void {
    this.forwardCrewEvent({
      type: 'tool_result',
      sessionId,
      timestamp: new Date(),
      data: { toolName, success, result, duration }
    })
  }

  /**
   * 发布阶段变更事件
   */
  emitPhaseChange(sessionId: string, fromPhase: CrewPhase | null, toPhase: CrewPhase): void {
    this.forwardCrewEvent({
      type: 'phase_change',
      sessionId,
      timestamp: new Date(),
      data: { fromPhase, toPhase }
    })
  }

  /**
   * 发布状态变更事件
   */
  emitStatusChange(sessionId: string, status: CrewStatus, details?: unknown): void {
    this.forwardCrewEvent({
      type: 'status_change',
      sessionId,
      timestamp: new Date(),
      data: { status, details }
    })
  }

  /**
   * 发布错误事件
   */
  emitError(sessionId: string, error: Error | string, context?: unknown): void {
    this.forwardCrewEvent({
      type: 'error',
      sessionId,
      timestamp: new Date(),
      data: {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        context
      }
    })
  }

  // ==================== VCP → Crew 事件接收 ====================

  private subscribeVCPEvents(): void {
    // 订阅工具调用事件
    if (window.api?.vcpLog?.onCallUpdate) {
      const unsubCall = window.api.vcpLog.onCallUpdate((data) => {
        this.handleToolCallUpdate(data)
      })
      this.vcpUnsubscribe = () => {
        unsubCall?.()
      }
    }

    // 订阅 vcpInfo 事件
    if (window.api?.vcpInfo?.subscribe) {
      const unsubInfo = window.api.vcpInfo.subscribe((event) => {
        this.handleVCPInfoEvent(event as VCPEvent)
      })
      const prevUnsub = this.vcpUnsubscribe
      this.vcpUnsubscribe = () => {
        prevUnsub?.()
        unsubInfo?.()
      }
    }
  }

  private handleToolCallUpdate(data: { type: string; call: unknown }): void {
    if (data.type === 'complete' && data.call) {
      const call = data.call as {
        toolName?: string
        pluginName?: string
        result?: unknown
        error?: string
        duration?: number
      }

      const event: ToolExecutionCompleteEvent = {
        toolName: call.toolName || 'unknown',
        pluginName: call.pluginName,
        result: call.result,
        success: !call.error,
        error: call.error,
        duration: call.duration
      }

      this.handlers.onToolExecutionComplete?.(event)
    }
  }

  private handleVCPInfoEvent(event: VCPEvent): void {
    // Agent 消息事件
    if (event.type === 'agent:message') {
      const data = event.data as {
        agentId?: string
        agentName?: string
        content?: string
        messageType?: string
      }

      if (data) {
        const agentEvent: AgentMessageEvent = {
          agentId: data.agentId || 'unknown',
          agentName: data.agentName || 'Unknown Agent',
          content: data.content || '',
          type: (data.messageType as AgentMessageEvent['type']) || 'observation'
        }
        this.handlers.onAgentMessage?.(agentEvent)
      }
    }

    // 异步任务更新
    if (event.type === 'async:task_update') {
      const data = event.data as {
        taskId?: string
        status?: string
        result?: unknown
      }

      if (data?.taskId) {
        this.handlers.onAsyncTaskUpdate?.(data.taskId, data.status || 'unknown', data.result)
      }
    }

    // 通用插件事件
    this.handlers.onPluginEvent?.(event)
  }

  // ==================== 工具方法 ====================

  private sendToVCP(event: VCPEvent): void {
    try {
      if (window.api?.vcpInfo?.publishEvent) {
        window.api.vcpInfo.publishEvent(event)
      }
    } catch (error) {
      console.debug('[VCPEventBridge] Failed to forward event:', error)
    }
  }

  private addToBuffer(event: CrewEvent): void {
    this.eventBuffer.push(event)
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift()
    }
  }

  /**
   * 获取事件缓冲
   */
  getEventBuffer(): CrewEvent[] {
    return [...this.eventBuffer]
  }

  /**
   * 清空事件缓冲
   */
  clearBuffer(): void {
    this.eventBuffer = []
  }
}

// ==================== 导出 ====================

export const VCPEventBridge = new VCPEventBridgeImpl()

export type { VCPEvent, VCPEventHandlers, VCPEventBridgeConfig, ToolExecutionCompleteEvent, AgentMessageEvent }

export default VCPEventBridge
