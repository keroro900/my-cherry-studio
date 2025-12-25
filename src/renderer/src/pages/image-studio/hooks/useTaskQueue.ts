/**
 * 任务队列 Hook
 *
 * 封装任务队列操作和与服务的集成
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addTask,
  selectTaskQueue,
  selectIsPaused,
  selectActiveModule,
  selectModuleConfig,
  selectProviderConfig
} from '@renderer/store/imageStudio'
import type { ImageTask, TaskType } from '../types'
import { taskQueueService, type TaskExecutor } from '../services/TaskQueueService'
import { imageStudioService } from '../services/ImageStudioService'
import { v4 as uuid } from 'uuid'

/**
 * 创建任务执行器
 */
const createTaskExecutor = (): TaskExecutor => ({
  async execute(task, onProgress, abortSignal) {
    // 从 Redux store 获取当前配置
    // 注意：这里需要在调用时传入最新的状态
    // 实际实现中可能需要将配置存储在 task 中

    try {
      const result = await imageStudioService.generate(
        {
          module: 'ecom', // 从 task 中获取
          config: {} as any, // 从 task 中获取
          inputs: { images: [] },
          providerId: '',
          modelId: ''
        },
        onProgress,
        abortSignal
      )

      return {
        success: result.success,
        result: result.outputs,
        error: result.error
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error'
      }
    }
  }
})

export function useTaskQueue() {
  const dispatch = useAppDispatch()
  const taskQueue = useAppSelector(selectTaskQueue)
  const isPaused = useAppSelector(selectIsPaused)
  const activeModule = useAppSelector(selectActiveModule)
  const moduleConfig = useAppSelector(selectModuleConfig)
  const { providerId, modelId } = useAppSelector(selectProviderConfig)

  const storeRef = useRef<{ getState: () => any; dispatch: typeof dispatch } | null>(null)

  // 初始化执行器
  useEffect(() => {
    taskQueueService.setExecutor(createTaskExecutor())
  }, [])

  /**
   * 添加生成任务
   */
  const addGenerateTask = useCallback(
    (projectId: string, versionId: string, type: TaskType = 'generate') => {
      const task: ImageTask = {
        id: uuid(),
        projectId,
        versionId,
        type,
        status: 'queued',
        progress: { current: 0, total: 100, step: '' },
        createdAt: Date.now()
      }

      dispatch(addTask(task))

      // 确保队列正在处理
      // 注意：实际实现需要访问 Redux store
      // taskQueueService.startProcessing(store.getState, dispatch)
    },
    [dispatch]
  )

  /**
   * 暂停队列
   */
  const pauseQueue = useCallback(() => {
    taskQueueService.pauseQueue(dispatch)
  }, [dispatch])

  /**
   * 恢复队列
   */
  const resumeQueue = useCallback(() => {
    taskQueueService.resumeQueue(dispatch)
  }, [dispatch])

  /**
   * 取消任务
   */
  const cancelTask = useCallback(
    (taskId: string) => {
      taskQueueService.cancelTask(taskId, dispatch)
    },
    [dispatch]
  )

  /**
   * 重试任务
   */
  const retryTask = useCallback(
    (taskId: string) => {
      taskQueueService.retryTask(taskId, dispatch)
    },
    [dispatch]
  )

  /**
   * 获取队列统计信息
   */
  const getQueueStats = useCallback(() => {
    const running = taskQueue.filter((t) => t.status === 'running').length
    const queued = taskQueue.filter((t) => t.status === 'queued').length
    const completed = taskQueue.filter((t) => t.status === 'completed').length
    const failed = taskQueue.filter((t) => t.status === 'failed').length

    return { running, queued, completed, failed, total: taskQueue.length }
  }, [taskQueue])

  return {
    taskQueue,
    isPaused,
    addGenerateTask,
    pauseQueue,
    resumeQueue,
    cancelTask,
    retryTask,
    getQueueStats
  }
}

export default useTaskQueue
