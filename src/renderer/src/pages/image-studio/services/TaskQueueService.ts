/**
 * 任务队列服务
 *
 * 管理图片生成任务的队列执行、并发控制、暂停/恢复/取消等功能
 */

import type { AppDispatch, RootState } from '@renderer/store'
import {
  batchUpdateTaskStatus,
  cancelAllQueued,
  moveTaskToTop,
  pauseAllTasks,
  pauseTask,
  reorderTasks,
  resumeAllTasks,
  resumeTask,
  retryAllFailed,
  updateTaskProgress,
  updateTaskStatus
} from '@renderer/store/imageStudio'

import type { ImageTask, TaskStatus } from '../types'

export interface TaskExecutor {
  execute(
    task: ImageTask,
    onProgress: (progress: { current: number; total: number; step: string }) => void,
    abortSignal: AbortSignal
  ): Promise<{ success: boolean; result?: any; error?: string }>
}

/**
 * 队列统计信息
 */
export interface QueueStats {
  total: number
  queued: number
  running: number
  paused: number
  completed: number
  failed: number
  cancelled: number
}

/**
 * 任务事件类型
 */
export type TaskEvent =
  | { type: 'task_started'; taskId: string }
  | { type: 'task_completed'; taskId: string }
  | { type: 'task_failed'; taskId: string; error: string }
  | { type: 'task_cancelled'; taskId: string }
  | { type: 'queue_empty' }
  | { type: 'queue_paused' }
  | { type: 'queue_resumed' }

/**
 * 任务事件监听器
 */
export type TaskEventListener = (event: TaskEvent) => void

class TaskQueueService {
  private static instance: TaskQueueService
  private isProcessing = false
  private abortControllers: Map<string, AbortController> = new Map()
  private maxConcurrency = 2
  private executor: TaskExecutor | null = null
  private eventListeners: Set<TaskEventListener> = new Set()

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
  startProcessing(getState: () => RootState, dispatch: AppDispatch): void {
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
  private async processQueue(getState: () => RootState, dispatch: AppDispatch): Promise<void> {
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
          this.emitEvent({ type: 'queue_empty' })
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
  private async executeTask(task: ImageTask, _getState: () => RootState, dispatch: AppDispatch): Promise<void> {
    if (!this.executor) {
      console.error('[TaskQueueService] No executor set')
      dispatch(updateTaskStatus({ taskId: task.id, status: 'failed' }))
      this.emitEvent({ type: 'task_failed', taskId: task.id, error: 'No executor set' })
      return
    }

    // 创建 AbortController
    const abortController = new AbortController()
    this.abortControllers.set(task.id, abortController)

    // 更新状态为运行中
    dispatch(updateTaskStatus({ taskId: task.id, status: 'running' }))
    this.emitEvent({ type: 'task_started', taskId: task.id })

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
        this.emitEvent({ type: 'task_completed', taskId: task.id })
      } else {
        dispatch(updateTaskStatus({ taskId: task.id, status: 'failed', error: result.error }))
        this.emitEvent({ type: 'task_failed', taskId: task.id, error: result.error || 'Unknown error' })
      }
    } catch (error: any) {
      if (abortController.signal.aborted) {
        dispatch(updateTaskStatus({ taskId: task.id, status: 'cancelled' }))
        this.emitEvent({ type: 'task_cancelled', taskId: task.id })
      } else {
        console.error('[TaskQueueService] Task execution error:', error)
        dispatch(updateTaskStatus({ taskId: task.id, status: 'failed', error: error.message }))
        this.emitEvent({ type: 'task_failed', taskId: task.id, error: error.message || 'Unknown error' })
      }
    } finally {
      this.abortControllers.delete(task.id)
    }
  }

  /**
   * 暂停任务
   */
  pauseQueue(dispatch: AppDispatch): void {
    dispatch(pauseAllTasks())
    this.emitEvent({ type: 'queue_paused' })
  }

  /**
   * 恢复任务
   */
  resumeQueue(dispatch: AppDispatch): void {
    dispatch(resumeAllTasks())
    this.emitEvent({ type: 'queue_resumed' })
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
    for (const [_taskId, controller] of this.abortControllers) {
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
    dispatch(
      updateTaskProgress({
        taskId,
        progress: { current: 0, total: 100, step: '' }
      })
    )
  }

  // ============================================================================
  // 增强的任务管理方法
  // ============================================================================

  /**
   * 暂停单个任务（仅等待中的任务可暂停）
   */
  pauseSingleTask(taskId: string, dispatch: AppDispatch): void {
    dispatch(pauseTask(taskId))
  }

  /**
   * 恢复单个任务
   */
  resumeSingleTask(taskId: string, dispatch: AppDispatch): void {
    dispatch(resumeTask(taskId))
  }

  /**
   * 重排任务顺序
   */
  reorderTaskQueue(fromIndex: number, toIndex: number, dispatch: AppDispatch): void {
    dispatch(reorderTasks({ fromIndex, toIndex }))
  }

  /**
   * 将任务移动到队列顶部（优先执行）
   */
  prioritizeTask(taskId: string, dispatch: AppDispatch): void {
    dispatch(moveTaskToTop(taskId))
  }

  /**
   * 重试所有失败的任务
   */
  retryAllFailedTasks(dispatch: AppDispatch): void {
    dispatch(retryAllFailed())
  }

  /**
   * 取消所有等待中的任务
   */
  cancelAllQueuedTasks(dispatch: AppDispatch): void {
    dispatch(cancelAllQueued())
  }

  /**
   * 批量更新任务状态
   */
  batchSetStatus(taskIds: string[], status: TaskStatus, dispatch: AppDispatch): void {
    dispatch(batchUpdateTaskStatus({ taskIds, status }))
  }

  /**
   * 获取队列统计信息
   */
  getQueueStats(getState: () => RootState): QueueStats {
    const { taskQueue } = getState().imageStudio
    return {
      total: taskQueue.length,
      queued: taskQueue.filter((t) => t.status === 'queued').length,
      running: taskQueue.filter((t) => t.status === 'running').length,
      paused: taskQueue.filter((t) => t.status === 'paused').length,
      completed: taskQueue.filter((t) => t.status === 'completed').length,
      failed: taskQueue.filter((t) => t.status === 'failed').length,
      cancelled: taskQueue.filter((t) => t.status === 'cancelled').length
    }
  }

  /**
   * 估算剩余完成时间（毫秒）
   */
  getEstimatedCompletionTime(getState: () => RootState): number {
    const { taskQueue, maxConcurrency } = getState().imageStudio

    // 计算已完成任务的平均耗时
    const completedTasks = taskQueue.filter((t) => t.status === 'completed' && t.startedAt && t.completedAt)

    const avgTime =
      completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + (t.completedAt! - t.startedAt!), 0) / completedTasks.length
        : 30000 // 默认 30 秒

    const pendingCount = taskQueue.filter((t) => t.status === 'queued').length
    const runningCount = taskQueue.filter((t) => t.status === 'running').length

    // 考虑并发
    const batchesRemaining = Math.ceil((pendingCount + runningCount) / maxConcurrency)
    return batchesRemaining * avgTime
  }

  /**
   * 检查是否有正在处理的任务
   */
  isQueueActive(): boolean {
    return this.isProcessing
  }

  /**
   * 获取正在运行的任务数量
   */
  getRunningTaskCount(getState: () => RootState): number {
    return getState().imageStudio.taskQueue.filter((t) => t.status === 'running').length
  }

  // ============================================================================
  // 事件监听
  // ============================================================================

  /**
   * 添加事件监听器
   */
  addEventListener(listener: TaskEventListener): void {
    this.eventListeners.add(listener)
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: TaskEventListener): void {
    this.eventListeners.delete(listener)
  }

  /**
   * 触发事件
   */
  private emitEvent(event: TaskEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('[TaskQueueService] Event listener error:', error)
      }
    })
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
