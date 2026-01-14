/**
 * Agent 同步插件
 *
 * 通过 WebSocket 实时同步 Agent 调用状态和结果
 * 支持多客户端之间的 Agent 协作
 */

import { loggerService } from '@logger'

import type { VCPPlugin, VCPPluginWebSocketAPI, WebSocketMessage } from '../types'
import { WebSocketClientType, WebSocketMessageType } from '../types'

const logger = loggerService.withContext('AgentSyncPlugin')

/**
 * Agent 任务信息
 */
export interface AgentTask {
  id: string
  targetAgentId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  prompt: string
  response?: string
  error?: string
  startedAt: Date
  completedAt?: Date
  callerClientId?: string
}

/**
 * Agent 同步插件配置
 */
export interface AgentSyncPluginConfig {
  /** 是否广播任务创建事件 */
  broadcastTaskCreation?: boolean
  /** 是否广播任务完成事件 */
  broadcastTaskCompletion?: boolean
  /** 任务历史保留数量 */
  maxTaskHistory?: number
}

/**
 * Agent 同步插件
 */
export class AgentSyncPlugin implements VCPPlugin {
  readonly id = 'agent-sync'
  readonly name = 'Agent Sync Plugin'

  private api: VCPPluginWebSocketAPI | null = null
  private config: Required<AgentSyncPluginConfig>
  private tasks: Map<string, AgentTask> = new Map()
  private taskHistory: AgentTask[] = []

  constructor(config?: AgentSyncPluginConfig) {
    this.config = {
      broadcastTaskCreation: config?.broadcastTaskCreation ?? true,
      broadcastTaskCompletion: config?.broadcastTaskCompletion ?? true,
      maxTaskHistory: config?.maxTaskHistory ?? 100
    }
  }

  async initialize(api: VCPPluginWebSocketAPI): Promise<void> {
    this.api = api
    logger.info('Agent Sync Plugin initialized')
  }

  onMessage(message: WebSocketMessage): void {
    // 处理 Agent 调用请求
    if (message.type === WebSocketMessageType.AGENT_INVOKE) {
      this.handleAgentInvokeRequest(message)
    }
  }

  async cleanup(): Promise<void> {
    this.tasks.clear()
    this.taskHistory = []
    this.api = null
    logger.info('Agent Sync Plugin cleaned up')
  }

  /**
   * 处理 Agent 调用请求
   */
  private handleAgentInvokeRequest(message: WebSocketMessage): void {
    const data = message.data as {
      taskId: string
      targetAgentId: string
      prompt: string
    }

    // 记录任务
    const task: AgentTask = {
      id: data.taskId,
      targetAgentId: data.targetAgentId,
      status: 'pending',
      prompt: data.prompt,
      startedAt: new Date(),
      callerClientId: message.sourceClientId
    }

    this.tasks.set(task.id, task)

    // 广播任务创建事件
    if (this.config.broadcastTaskCreation && this.api) {
      this.api.broadcast({
        type: WebSocketMessageType.AGENT_STATUS,
        data: {
          event: 'task_created',
          task: this.serializeTask(task)
        }
      })
    }

    logger.debug('Agent task created', { taskId: task.id, targetAgentId: task.targetAgentId })
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: string, status: AgentTask['status'], result?: { response?: string; error?: string }): void {
    const task = this.tasks.get(taskId)
    if (!task) {
      logger.warn('Task not found for status update', { taskId })
      return
    }

    task.status = status
    if (result?.response) task.response = result.response
    if (result?.error) task.error = result.error

    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date()

      // 移到历史记录
      this.tasks.delete(taskId)
      this.taskHistory.unshift(task)

      // 限制历史记录大小
      if (this.taskHistory.length > this.config.maxTaskHistory) {
        this.taskHistory.pop()
      }
    }

    // 广播状态更新
    if (this.api) {
      const eventType = status === 'completed' || status === 'failed' ? 'task_completed' : 'task_status_changed'

      this.api.broadcast({
        type: WebSocketMessageType.AGENT_STATUS,
        data: {
          event: eventType,
          task: this.serializeTask(task)
        }
      })

      // 发送结果给调用者
      if ((status === 'completed' || status === 'failed') && task.callerClientId) {
        this.api.sendToClient(task.callerClientId, {
          type: WebSocketMessageType.AGENT_INVOKE_RESULT,
          data: {
            requestId: taskId,
            status: status === 'completed' ? 'success' : 'error',
            response: task.response,
            error: task.error,
            executionTimeMs: task.completedAt ? task.completedAt.getTime() - task.startedAt.getTime() : undefined
          }
        })
      }
    }

    logger.debug('Agent task status updated', { taskId, status })
  }

  /**
   * 通知 Agent 开始执行
   */
  notifyAgentStarted(taskId: string): void {
    this.updateTaskStatus(taskId, 'running')
  }

  /**
   * 通知 Agent 执行完成
   */
  notifyAgentCompleted(taskId: string, response: string): void {
    this.updateTaskStatus(taskId, 'completed', { response })
  }

  /**
   * 通知 Agent 执行失败
   */
  notifyAgentFailed(taskId: string, error: string): void {
    this.updateTaskStatus(taskId, 'failed', { error })
  }

  /**
   * 获取活跃任务列表
   */
  getActiveTasks(): AgentTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 获取任务历史
   */
  getTaskHistory(limit?: number): AgentTask[] {
    return this.taskHistory.slice(0, limit || this.config.maxTaskHistory)
  }

  /**
   * 获取特定任务
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId) || this.taskHistory.find((t) => t.id === taskId)
  }

  /**
   * 序列化任务 (用于网络传输)
   */
  private serializeTask(task: AgentTask): Record<string, unknown> {
    return {
      id: task.id,
      targetAgentId: task.targetAgentId,
      status: task.status,
      prompt: task.prompt,
      response: task.response,
      error: task.error,
      startedAt: task.startedAt.toISOString(),
      completedAt: task.completedAt?.toISOString()
    }
  }

  /**
   * 广播 Agent 列表更新
   */
  broadcastAgentListUpdate(agents: Array<{ id: string; name: string; isActive: boolean }>): void {
    if (!this.api) return

    this.api.sendToClientType(WebSocketClientType.VCP_PLUGIN, {
      type: WebSocketMessageType.AGENT_STATUS,
      data: {
        event: 'agent_list_updated',
        agents
      }
    })
  }
}

/**
 * 创建 Agent 同步插件实例
 */
export function createAgentSyncPlugin(config?: AgentSyncPluginConfig): AgentSyncPlugin {
  return new AgentSyncPlugin(config)
}
