/**
 * 任务队列服务
 *
 * 管理图片生成任务的队列执行、并发控制、暂停/恢复/取消等功能
 */

import type { AppDispatch, RootState } from '@renderer/store'
import {
  updateTaskProgress,
  updateTaskStatus,
  setQueuePaused
} from '@renderer/store/imageStudio'
import type { ImageTask } from '../types'

export interface TaskExecutor {
  execute(
    task: ImageTask,
    onProgress: (progress: { current: number; total: number; step: string }) => void,
    abortSignal: AbortSignal
  ): Promise<{ success: boolean; result?: any; error?: string }>
}

class TaskQueueService {
  private static instance: TaskQueueService
  private isProcessing = false
  private abortControllers: Map<string, AbortController> = new Map()
  private maxConcurrency = 2
  private executor: TaskExecutor | null = null

  private constructor() {}

  static getInstance(): TaskQueueService {
    if (!TaskQueueService.instance) {
      TaskQueueService.instance = new TaskQueueService()
    }
    return TaskQueueService.instance
  }

  /**
   * 设置任务执行器
   */
  setExecutor(executor: TaskExecutor): void {
    this.executor = executor
  }

  /**
   * 设置最大并发数
   */
  setMaxConcurrency(value: number): void {
    this.maxConcurrency = Math.max(1, Math.min(value, 5))
  }

  /**
   * 获取最大并发数
   */
  getMaxConcurrency(): number {
    return this.maxConcurrency
  }

  /**
   * 开始处理队列
   */
  startProcessing(
    getState: () => RootState,
    dispatch: AppDispatch
  ): void {
    if (this.isProcessing) return
    this.isProcessing = true
    this.processQueue(getState, dispatch)
  }

  /**
   * 停止处理队列
   */
  stopProcessing(): void {
    this.isProcessing = false
  }

  /**
   * 处理队列
   */
  private async processQueue(
    getState: () => RootState,
    dispatch: AppDispatch
  ): Promise<void> {
    while (this.isProcessing) {
      const state = getState()
      const { taskQueue, isPaused } = state.imageStudio

      // 如果暂停，等待
      if (isPaused) {
        await this.sleep(500)
        continue
      }

      // 获取正在运行的任务数
      const runningTasks = taskQueue.filter((t) => t.status === 'running')
      const availableSlots = this.maxConcurrency - runningTasks.length

      // 如果没有可用槽位，等待
      if (availableSlots <= 0) {
        await this.sleep(100)
        continue
      }

      // 获取等待中的任务
      const queuedTasks = taskQueue.filter((t) => t.status === 'queued')

      // 如果没有等待的任务，检查是否还有运行中的任务
      if (queuedTasks.length === 0) {
        if (runningTasks.length === 0) {
          // 所有任务完成，停止处理
          this.isProcessing = false
          break
        }
        await this.sleep(100)
        continue
      }

      // 启动新任务
      const tasksToStart = queuedTasks.slice(0, availableSlots)
      for (const task of tasksToStart) {
        this.executeTask(task, getState, dispatch)
      }

      await this.sleep(100)
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    task: ImageTask,
    getState: () => RootState,
    dispatch: AppDispatch
  ): Promise<void> {
    if (!this.executor) {
      console.error('[TaskQueueService] No executor set')
      dispatch(updateTaskStatus({ taskId: task.id, status: 'failed' }))
      return
    }

    // 创建 AbortController
    const abortController = new AbortController()
    this.abortControllers.set(task.id, abortController)

    // 更新状态为运行中
    dispatch(updateTaskStatus({ taskId: task.id, status: 'running' }))

    try {
      const result = await this.executor.execute(
        task,
        (progress) => {
          dispatch(updateTaskProgress({ taskId: task.id, progress }))
        },
        abortController.signal
      )

      if (result.success) {
        dispatch(updateTaskStatus({ taskId: task.id, status: 'completed' }))
      } else {
        dispatch(updateTaskStatus({ taskId: task.id, status: 'failed' }))
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        dispatch(updateTaskStatus({ taskId: task.id, status: 'cancelled' }))
      } else {
        console.error('[TaskQueueService] Task execution error:', error)
        dispatch(updateTaskStatus({ taskId: task.id, status: 'failed' }))
      }
    } finally {
      this.abortControllers.delete(task.id)
    }
  }

  /**
   * 暂停任务
   */
  pauseQueue(dispatch: AppDispatch): void {
    dispatch(setQueuePaused(true))
  }

  /**
   * 恢复任务
   */
  resumeQueue(dispatch: AppDispatch): void {
    dispatch(setQueuePaused(false))
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string, dispatch: AppDispatch): void {
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
    }
    dispatch(updateTaskStatus({ taskId, status: 'cancelled' }))
  }

  /**
   * 取消所有任务
   */
  cancelAllTasks(dispatch: AppDispatch, getState: () => RootState): void {
    const state = getState()
    const { taskQueue } = state.imageStudio

    // 取消所有运行中的任务
    for (const [taskId, controller] of this.abortControllers) {
      controller.abort()
    }

    // 更新所有未完成任务的状态
    taskQueue
      .filter((t) => t.status === 'queued' || t.status === 'running')
      .forEach((t) => {
        dispatch(updateTaskStatus({ taskId: t.id, status: 'cancelled' }))
      })

    this.stopProcessing()
  }

  /**
   * 重试任务
   */
  retryTask(taskId: string, dispatch: AppDispatch): void {
    dispatch(updateTaskStatus({ taskId, status: 'queued' }))
    dispatch(updateTaskProgress({
      taskId,
      progress: { current: 0, total: 100, step: '' }
    }))
  }

  /**
   * 辅助函数：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const taskQueueService = TaskQueueService.getInstance()
export default taskQueueService
