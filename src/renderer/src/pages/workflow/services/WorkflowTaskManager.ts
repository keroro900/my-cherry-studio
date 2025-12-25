/**
 * 工作流任务管理器
 *
 * 将 TaskQueue 与 WorkflowEngine 集成
 * 提供统一的任务管理接口，支持并发执行、进度追踪和历史记录
 *
 * P0 优化：使用统一的 workflowExecutionService 执行工作流
 */

import { loggerService } from '@logger'
import type { Model, Provider } from '@renderer/types'

import type { Workflow } from '../types'
import { type Task, type TaskExecutor, type TaskPriority, taskQueue } from './TaskQueue'
import { taskStorage } from './TaskStorage'
import { workflowExecutionService } from './WorkflowExecutionService'

const logger = loggerService.withContext('WorkflowTaskManager')

/**
 * 任务执行回调
 */
export interface TaskExecutionCallbacks {
  onNodeStatusChange?: (nodeId: string, status: string, errorMessage?: string) => void
  onNodeOutput?: (nodeId: string, outputs: Record<string, any>) => void | Promise<void>
  onProgress?: (progress: number, message: string) => void
  onAutoExport?: (exportedFiles: { filePath: string; fileType: string }[]) => void
}

/**
 * 任务提交参数
 */
export interface SubmitTaskParams {
  workflow: Workflow
  providers: Provider[]
  models: Model[]
  callbacks?: TaskExecutionCallbacks
  priority?: TaskPriority
  maxRetries?: number
}

/**
 * 工作流任务管理器
 */
class WorkflowTaskManagerClass {
  private initialized = false
  // 存储每个任务的回调函数
  private taskCallbacks = new Map<string, TaskExecutionCallbacks>()
  // 存储每个任务的工作流数据
  private taskWorkflows = new Map<
    string,
    {
      workflow: Workflow
      providers: Provider[]
      models: Model[]
    }
  >()

  constructor() {
    this.initialize()
  }

  /**
   * 初始化管理器
   */
  private initialize(): void {
    if (this.initialized) return

    // 设置任务执行器
    taskQueue.setExecutor(this.createExecutor())

    // 监听任务事件，同步到存储
    taskQueue.on('task:started', (task: Task) => {
      taskStorage.saveTask(task)
    })

    taskQueue.on('task:progress', (task: Task) => {
      taskStorage.saveTask(task)
    })

    taskQueue.on('task:completed', (task: Task) => {
      taskStorage.saveTask(task)
      this.cleanupTask(task.id)
    })

    taskQueue.on('task:failed', (task: Task) => {
      taskStorage.saveTask(task)
      this.cleanupTask(task.id)
    })

    taskQueue.on('task:cancelled', (task: Task) => {
      taskStorage.saveTask(task)
      this.cleanupTask(task.id)
    })

    this.initialized = true
    logger.info('WorkflowTaskManager initialized')
  }

  /**
   * 清理任务相关数据
   */
  private cleanupTask(taskId: string): void {
    this.taskCallbacks.delete(taskId)
    this.taskWorkflows.delete(taskId)
  }

  /**
   * 创建任务执行器
   * P0 优化：使用统一的 workflowExecutionService 执行工作流
   */
  private createExecutor(): TaskExecutor {
    return async (task, onProgress, signal) => {
      logger.info('Executing workflow task', {
        taskId: task.id,
        workflowId: task.workflowId,
        workflowName: task.workflowName
      })

      // 获取工作流数据
      const workflowData = this.taskWorkflows.get(task.id)
      if (!workflowData) {
        throw new Error(`任务数据不存在: ${task.id}`)
      }

      const { workflow, providers } = workflowData

      // 获取回调
      const callbacks = this.taskCallbacks.get(task.id)

      // 检查取消信号
      if (signal.aborted) {
        throw new Error('任务已取消')
      }

      // 使用统一服务执行（设置 Providers）
      workflowExecutionService.setProviders(providers)

      // 执行工作流，传递外部取消信号以贯通取消链路
      const result = await workflowExecutionService.execute(
        workflow,
        {
          onNodeStatusChange: (nodeId, status, errorMessage) => {
            callbacks?.onNodeStatusChange?.(nodeId, status, errorMessage)

            // P1 修复：任何节点完成状态都更新进度（completed/error/skipped）
            if (status === 'completed' || status === 'error' || status === 'skipped') {
              task.completedNodes++
              const progress = Math.round((task.completedNodes / task.totalNodes) * 100)
              const statusText = status === 'error' ? '失败' : status === 'skipped' ? '跳过' : '完成'
              onProgress(progress, `${statusText}: ${nodeId}`)
            }
          },
          onNodeOutput: async (nodeId, outputs) => {
            // 调用回调（不再在这里更新进度，已移到 onNodeStatusChange）
            try {
              await callbacks?.onNodeOutput?.(nodeId, outputs)
            } catch (error) {
              logger.error('onNodeOutput callback error', {
                taskId: task.id,
                nodeId,
                error: error instanceof Error ? error.message : String(error)
              })
            }
          },
          onProgress: (progress, message) => {
            onProgress(progress, message)
            callbacks?.onProgress?.(progress, message)
          },
          onAutoExport: (exportedFiles) => {
            callbacks?.onAutoExport?.(exportedFiles)
          }
        },
        {
          abortSignal: signal // 传递外部取消信号，贯通 TaskQueue → Engine 的取消链路
        }
      )

      // 检查执行结果
      if (result.status === 'failed') {
        throw new Error(result.errors.join('; ') || '工作流执行失败')
      }

      if (result.status === 'cancelled') {
        throw new Error('工作流已取消')
      }

      return {
        status: result.status,
        errors: result.errors,
        exportedFiles: result.exportedFiles
      }
    }
  }

  /**
   * 提交任务
   */
  submitTask(params: SubmitTaskParams): string {
    const { workflow, providers, models, callbacks, priority, maxRetries } = params

    // 计算节点数量
    const totalNodes = workflow.nodes.length

    // 添加任务到队列
    const taskId = taskQueue.addTask({
      workflowId: workflow.id,
      workflowName: workflow.name,
      priority,
      maxRetries,
      totalNodes
    })

    // 保存工作流数据
    this.taskWorkflows.set(taskId, { workflow, providers, models })

    // 保存回调
    if (callbacks) {
      this.taskCallbacks.set(taskId, callbacks)
    }

    logger.info('Task submitted', {
      taskId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      totalNodes
    })

    return taskId
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    return taskQueue.cancelTask(taskId)
  }

  /**
   * 重试任务
   */
  retryTask(taskId: string): boolean {
    return taskQueue.retryTask(taskId)
  }

  /**
   * 暂停队列
   */
  pauseQueue(): void {
    taskQueue.pause()
  }

  /**
   * 恢复队列
   */
  resumeQueue(): void {
    taskQueue.resume()
  }

  /**
   * 获取任务
   */
  getTask(taskId: string) {
    return taskQueue.getTask(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks() {
    return taskQueue.getAllTasks()
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return taskQueue.getStatus()
  }

  /**
   * 获取任务历史
   */
  getTaskHistory(options?: {
    workflowId?: string
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
    limit?: number
    offset?: number
  }) {
    return taskStorage.getHistory(options)
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return taskStorage.getStats()
  }

  /**
   * 清除已完成任务
   */
  clearCompletedTasks(): void {
    taskQueue.clearCompleted()
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    taskStorage.clearHistory()
  }

  /**
   * 更新队列配置
   */
  updateQueueConfig(config: {
    maxConcurrency?: number
    defaultRetries?: number
    retryDelay?: number
    taskTimeout?: number
  }): void {
    taskQueue.updateConfig(config)
  }

  /**
   * 获取队列配置
   */
  getQueueConfig() {
    return taskQueue.getConfig()
  }

  /**
   * 监听任务事件
   */
  on(event: string, handler: (...args: any[]) => void): void {
    taskQueue.on(event, handler)
  }

  /**
   * 移除事件监听
   */
  off(event: string, handler: (...args: any[]) => void): void {
    taskQueue.off(event, handler)
  }
}

// 导出单例
export const workflowTaskManager = new WorkflowTaskManagerClass()

export default WorkflowTaskManagerClass
