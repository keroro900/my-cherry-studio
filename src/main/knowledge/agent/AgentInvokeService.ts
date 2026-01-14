/**
 * Agent 调用服务
 *
 * 实现 VCP 风格的 Agent 间调用机制:
 * - AI 可通过 TOOL_REQUEST 调用其他 Agent
 * - 支持同步和异步调用模式
 * - 使用 Cherry Studio 的模型服务
 * - 与助手系统解耦但可集成
 *
 * 调用方式:
 * <<<[TOOL_REQUEST]>>>
 * tool_name:「始」invoke_agent「末」
 * agent_id:「始」target_agent_id「末」
 * prompt:「始」用户问题「末」
 * mode:「始」sync|async「末」
 * <<<[END_TOOL_REQUEST]>>>
 */

import { loggerService } from '@logger'
import { v4 as uuid } from 'uuid'

const logger = loggerService.withContext('AgentInvokeService')

// ==================== 类型定义 ====================

/**
 * Agent 调用请求
 */
export interface AgentInvokeRequest {
  /** 请求 ID */
  id: string
  /** 调用者 Agent ID (可选，系统调用时为空) */
  callerAgentId?: string
  /** 目标 Agent ID 或名称 */
  targetAgentId: string
  /** 调用提示词/问题 */
  prompt: string
  /** 调用模式: sync=同步等待, async=异步回调 */
  mode: 'sync' | 'async'
  /** 上下文数据 */
  context?: AgentInvokeContext
  /** 调用选项 */
  options?: AgentInvokeOptions
  /** 创建时间 */
  createdAt: Date
}

/**
 * Agent 调用上下文
 */
export interface AgentInvokeContext {
  /** 会话 ID */
  sessionId?: string
  /** 话题 ID */
  topicId?: string
  /** 历史消息 (最近 N 条) */
  recentMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  /** 自定义变量 */
  variables?: Record<string, string>
}

/**
 * Agent 调用选项
 */
export interface AgentInvokeOptions {
  /** 超时时间 (毫秒) */
  timeout?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 温度 */
  temperature?: number
  /** 是否使用目标 Agent 的默认模型 */
  useAgentModel?: boolean
  /** 强制使用的模型 ID */
  modelId?: string
  /** 是否包含系统提示词 */
  includeSystemPrompt?: boolean
}

/**
 * Agent 调用结果
 */
export interface AgentInvokeResult {
  /** 请求 ID */
  requestId: string
  /** 状态 */
  status: 'success' | 'error' | 'timeout' | 'pending'
  /** 响应内容 */
  response?: string
  /** 错误信息 */
  error?: string
  /** Token 使用量 */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** 执行时间 (毫秒) */
  executionTimeMs?: number
  /** 完成时间 */
  completedAt?: Date
}

/**
 * 异步任务状态
 */
export interface AgentAsyncTask {
  /** 任务 ID */
  id: string
  /** 请求 */
  request: AgentInvokeRequest
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 结果 (完成后) */
  result?: AgentInvokeResult
  /** 回调 URL (VCP 异步回调) */
  callbackUrl?: string
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

/**
 * Agent 信息 (简化版，用于调用)
 */
export interface InvokableAgent {
  id: string
  name: string
  displayName: string
  systemPrompt: string
  modelId?: string
  providerId?: string
  description?: string
  isActive: boolean
}

/**
 * Agent 调用执行器接口
 * 由 renderer 进程实现，通过 IPC 调用
 */
export interface AgentInvokeExecutor {
  /**
   * 执行 Agent 调用
   */
  execute(request: AgentInvokeRequest, agent: InvokableAgent): Promise<AgentInvokeResult>
}

// ==================== 服务实现 ====================

const DEFAULT_TIMEOUT = 60000 // 60秒
const MAX_ASYNC_TASKS = 100 // 最大异步任务数
const TASK_RETENTION_MS = 24 * 60 * 60 * 1000 // 24小时

class AgentInvokeService {
  /** 异步任务存储 */
  private asyncTasks: Map<string, AgentAsyncTask> = new Map()

  /** Agent 获取函数 (由外部注入) */
  private agentProvider: ((id: string) => InvokableAgent | null) | null = null

  /** 执行器 (由 renderer 进程通过 IPC 提供) */
  private executor: AgentInvokeExecutor | null = null

  /** 清理定时器 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.startCleanupTimer()
  }

  // ==================== 初始化 ====================

  /**
   * 设置 Agent 提供者
   */
  setAgentProvider(provider: (id: string) => InvokableAgent | null): void {
    this.agentProvider = provider
    logger.info('Agent provider set')
  }

  /**
   * 设置执行器
   */
  setExecutor(executor: AgentInvokeExecutor): void {
    this.executor = executor
    logger.info('Agent invoke executor set')
  }

  // ==================== 同步调用 ====================

  /**
   * 同步调用 Agent
   *
   * @param targetAgentId - 目标 Agent ID 或名称
   * @param prompt - 调用提示词
   * @param options - 调用选项
   * @returns 调用结果
   */
  async invokeSync(
    targetAgentId: string,
    prompt: string,
    options?: AgentInvokeOptions & { callerAgentId?: string; context?: AgentInvokeContext }
  ): Promise<AgentInvokeResult> {
    const requestId = uuid()
    const startTime = Date.now()

    const request: AgentInvokeRequest = {
      id: requestId,
      callerAgentId: options?.callerAgentId,
      targetAgentId,
      prompt,
      mode: 'sync',
      context: options?.context,
      options,
      createdAt: new Date()
    }

    logger.info('Sync agent invoke started', { requestId, targetAgentId })

    try {
      // 获取目标 Agent
      const agent = this.getAgent(targetAgentId)
      if (!agent) {
        return {
          requestId,
          status: 'error',
          error: `Agent not found: ${targetAgentId}`,
          executionTimeMs: Date.now() - startTime
        }
      }

      if (!agent.isActive) {
        return {
          requestId,
          status: 'error',
          error: `Agent is not active: ${targetAgentId}`,
          executionTimeMs: Date.now() - startTime
        }
      }

      // 检查执行器
      if (!this.executor) {
        return {
          requestId,
          status: 'error',
          error: 'Agent invoke executor not set',
          executionTimeMs: Date.now() - startTime
        }
      }

      // 执行调用 (带超时)
      const timeout = options?.timeout || DEFAULT_TIMEOUT
      const result = await Promise.race([
        this.executor.execute(request, agent),
        this.createTimeoutPromise(requestId, timeout)
      ])

      result.executionTimeMs = Date.now() - startTime
      result.completedAt = new Date()

      logger.info('Sync agent invoke completed', {
        requestId,
        status: result.status,
        executionTimeMs: result.executionTimeMs
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Sync agent invoke failed', { requestId, error: errorMessage })

      return {
        requestId,
        status: 'error',
        error: errorMessage,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 异步调用 ====================

  /**
   * 异步调用 Agent
   *
   * @param targetAgentId - 目标 Agent ID 或名称
   * @param prompt - 调用提示词
   * @param options - 调用选项
   * @returns 任务 ID
   */
  async invokeAsync(
    targetAgentId: string,
    prompt: string,
    options?: AgentInvokeOptions & {
      callerAgentId?: string
      context?: AgentInvokeContext
      callbackUrl?: string
    }
  ): Promise<string> {
    const taskId = uuid()

    const request: AgentInvokeRequest = {
      id: taskId,
      callerAgentId: options?.callerAgentId,
      targetAgentId,
      prompt,
      mode: 'async',
      context: options?.context,
      options,
      createdAt: new Date()
    }

    const task: AgentAsyncTask = {
      id: taskId,
      request,
      status: 'pending',
      callbackUrl: options?.callbackUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.asyncTasks.set(taskId, task)
    logger.info('Async agent invoke task created', { taskId, targetAgentId })

    // 异步执行
    this.executeAsyncTask(task).catch((error) => {
      logger.error('Async task execution failed', { taskId, error: String(error) })
    })

    return taskId
  }

  /**
   * 执行异步任务
   */
  private async executeAsyncTask(task: AgentAsyncTask): Promise<void> {
    task.status = 'running'
    task.updatedAt = new Date()

    try {
      const agent = this.getAgent(task.request.targetAgentId)
      if (!agent) {
        task.status = 'failed'
        task.result = {
          requestId: task.id,
          status: 'error',
          error: `Agent not found: ${task.request.targetAgentId}`
        }
        task.updatedAt = new Date()
        return
      }

      if (!this.executor) {
        task.status = 'failed'
        task.result = {
          requestId: task.id,
          status: 'error',
          error: 'Agent invoke executor not set'
        }
        task.updatedAt = new Date()
        return
      }

      const startTime = Date.now()
      const result = await this.executor.execute(task.request, agent)

      result.executionTimeMs = Date.now() - startTime
      result.completedAt = new Date()

      task.status = 'completed'
      task.result = result
      task.updatedAt = new Date()

      logger.info('Async task completed', { taskId: task.id, status: result.status })

      // 触发回调 (如果有)
      if (task.callbackUrl) {
        this.triggerCallback(task).catch((error) => {
          logger.error('Callback trigger failed', { taskId: task.id, error: String(error) })
        })
      }
    } catch (error) {
      task.status = 'failed'
      task.result = {
        requestId: task.id,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
      task.updatedAt = new Date()

      logger.error('Async task failed', { taskId: task.id, error: String(error) })
    }
  }

  /**
   * 触发异步回调
   */
  private async triggerCallback(task: AgentAsyncTask): Promise<void> {
    if (!task.callbackUrl || !task.result) return

    try {
      const response = await fetch(task.callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId: task.id,
          result: task.result
        })
      })

      if (!response.ok) {
        logger.warn('Callback response not ok', {
          taskId: task.id,
          status: response.status
        })
      }
    } catch (error) {
      logger.error('Callback request failed', { taskId: task.id, error: String(error) })
    }
  }

  /**
   * 获取异步任务状态
   */
  getTaskStatus(taskId: string): AgentAsyncTask | null {
    return this.asyncTasks.get(taskId) || null
  }

  /**
   * 获取任务结果
   */
  getTaskResult(taskId: string): AgentInvokeResult | null {
    const task = this.asyncTasks.get(taskId)
    return task?.result || null
  }

  /**
   * 列出所有异步任务
   */
  listTasks(status?: AgentAsyncTask['status']): AgentAsyncTask[] {
    const tasks = Array.from(this.asyncTasks.values())
    if (status) {
      return tasks.filter((t) => t.status === status)
    }
    return tasks
  }

  // ==================== Agent 管理 ====================

  /**
   * 获取 Agent
   */
  private getAgent(idOrName: string): InvokableAgent | null {
    if (!this.agentProvider) {
      logger.warn('Agent provider not set')
      return null
    }
    return this.agentProvider(idOrName)
  }

  /**
   * 列出可调用的 Agent
   */
  listAvailableAgents(): InvokableAgent[] {
    // 这个方法需要由外部实现
    // 这里返回空数组作为默认实现
    return []
  }

  // ==================== 工具方法 ====================

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(requestId: string, timeout: number): Promise<AgentInvokeResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject({
          requestId,
          status: 'timeout',
          error: `Agent invoke timeout after ${timeout}ms`
        })
      }, timeout)
    })
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    // 每小时清理一次
    this.cleanupTimer = setInterval(
      () => {
        this.cleanup()
      },
      60 * 60 * 1000
    )
  }

  /**
   * 清理过期任务
   */
  private cleanup(): void {
    const now = Date.now()
    const toRemove: string[] = []

    this.asyncTasks.forEach((task, id) => {
      const age = now - task.createdAt.getTime()
      if (age > TASK_RETENTION_MS) {
        toRemove.push(id)
      }
    })

    // 限制任务数量
    if (this.asyncTasks.size > MAX_ASYNC_TASKS) {
      const sorted = Array.from(this.asyncTasks.entries())
        .filter(([_, t]) => t.status === 'completed' || t.status === 'failed')
        .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime())

      const excess = this.asyncTasks.size - MAX_ASYNC_TASKS
      for (let i = 0; i < excess && i < sorted.length; i++) {
        toRemove.push(sorted[i][0])
      }
    }

    toRemove.forEach((id) => this.asyncTasks.delete(id))

    if (toRemove.length > 0) {
      logger.debug('Cleaned up async tasks', { count: toRemove.length })
    }
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.asyncTasks.clear()
    logger.info('AgentInvokeService disposed')
  }
}

// ==================== 单例导出 ====================

let invokeService: AgentInvokeService | null = null

export function getAgentInvokeService(): AgentInvokeService {
  if (!invokeService) {
    invokeService = new AgentInvokeService()
  }
  return invokeService
}

export function createAgentInvokeService(): AgentInvokeService {
  return new AgentInvokeService()
}

export default AgentInvokeService
