/**
 * 任务队列 Hook
 *
 * 封装任务队列操作和与服务的集成
 * 使用 ImageGenerationService，参数传递方式与工作流保持一致
 */

import store from '@renderer/store'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { addTask, selectIsPaused, selectTaskQueue } from '@renderer/store/imageStudio'
import { useCallback, useEffect } from 'react'
import { v4 as uuid } from 'uuid'

import { imageStudioService } from '../services/ImageStudioService'
import { type TaskExecutor, taskQueueService } from '../services/TaskQueueService'
import type { EcomModuleConfig, ImageTask, ModelModuleConfig, PatternModuleConfig, TaskType } from '../types'

/**
 * 从 store 获取任务相关的配置
 */
function getTaskConfig(task: { projectId: string; versionId: string }) {
  const state = store.getState()
  const { imageStudio } = state

  // 获取项目和版本
  const project = imageStudio.projects.find((p) => p.id === task.projectId)
  const version = project?.versions.find((v) => v.id === task.versionId)

  // 获取当前模块配置（包含 imageSize 和 aspectRatio）
  const activeModule = imageStudio.activeModule
  let moduleConfig: EcomModuleConfig | ModelModuleConfig | PatternModuleConfig
  let imageSize: '1K' | '2K' | '4K' = '2K'
  let aspectRatio = '3:4'

  switch (activeModule) {
    case 'ecom':
      moduleConfig = imageStudio.ecomConfig
      imageSize = imageStudio.ecomConfig.imageSize || '2K'
      aspectRatio = imageStudio.ecomConfig.aspectRatio || '3:4'
      break
    case 'model':
      moduleConfig = imageStudio.modelConfig
      imageSize = imageStudio.modelConfig.imageSize || '2K'
      aspectRatio = imageStudio.modelConfig.aspectRatio || '3:4'
      break
    case 'pattern':
      moduleConfig = imageStudio.patternConfig
      imageSize = imageStudio.patternConfig.imageSize || '2K'
      aspectRatio = imageStudio.patternConfig.aspectRatio || '1:1'
      break
    default:
      moduleConfig = imageStudio.ecomConfig
  }

  return {
    module: activeModule,
    config: version?.config || moduleConfig,
    inputs: project?.originalInputs || { images: [] },
    providerId: imageStudio.providerId,
    modelId: imageStudio.modelId,
    // 关键：传递 imageSize 和 aspectRatio（与工作流保持一致）
    imageSize,
    aspectRatio
  }
}

/**
 * 创建任务执行器
 */
const createTaskExecutor = (): TaskExecutor => ({
  async execute(task, onProgress, abortSignal) {
    try {
      // 从 store 获取任务配置
      const taskConfig = getTaskConfig(task)

      if (!taskConfig.providerId || !taskConfig.modelId) {
        return {
          success: false,
          error: '请先选择服务提供商和模型'
        }
      }

      // 调用 ImageStudioService，传递所有参数（与工作流保持一致）
      const result = await imageStudioService.generate(
        {
          module: taskConfig.module,
          config: taskConfig.config as any,
          inputs: taskConfig.inputs,
          providerId: taskConfig.providerId,
          modelId: taskConfig.modelId,
          // 关键：传递 imageSize 和 aspectRatio
          imageSize: taskConfig.imageSize,
          aspectRatio: taskConfig.aspectRatio
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
      taskQueueService.startProcessing(store.getState, dispatch)
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
