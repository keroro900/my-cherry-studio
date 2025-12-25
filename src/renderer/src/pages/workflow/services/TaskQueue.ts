/**
 * 任务队列服务
 *
 * 管理工作流任务的并发执行、进度追踪和状态管理
 * 支持任务暂停、取消、重试等操作
 *
 * 优化特性：
 * - 优先级队列（high > normal > low）
 * - 动态并发数调整
 * - 任务超时和自动重试
 * - 配置持久化
 */

import { loggerService } from '@logger'
import { EventEmitter } from 'events'

const logger = loggerService.withContext('TaskQueue')

// 配置存储键
const CONFIG_STORAGE_KEY = 'workflow-task-queue-config'

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'normal' | 'high'

/**
 * 优先级权重
 */
const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 3,
  normal: 2,
  low: 1
}

/**
 * 任务定义
 */
export interface Task {
  id: string
  workflowId: string
  workflowName: string
  status: TaskStatus
  priority: TaskPriority
  progress: number // 0-100
  currentNode?: string
  totalNodes: number
  completedNodes: number
  startTime?: number
  endTime?: number
  error?: string
  retryCount: number
  maxRetries: number
  // 任务输入
  inputs?: Record<string, any>
  // 任务输出
  outputs?: Record<string, any>
  // 节点执行结果
  nodeResults?: Array<{
    nodeId: string
    nodeName: string
    status: 'success' | 'error' | 'skipped'
    duration: number
    output?: any
    error?: string
  }>
  // 取消控制器
  abortController?: AbortController
  // 创建时间
  createdAt: number
}

/**
 * 队列配置
 */
export interface QueueConfig {
  maxConcurrency: number // 最大并发数
  defaultRetries: number // 默认重试次数
  retryDelay: number // 重试延迟（毫秒）
  taskTimeout: number // 任务超时（毫秒）
}

/**
 * 队列状态
 */
export interface QueueStatus {
  isRunning: boolean
  isPaused: boolean
  totalTasks: number
  pendingTasks: number
  runningTasks: number
  completedTasks: number
  failedTasks: number
  maxConcurrency: number
}

/**
 * 任务队列事件
 */
export interface TaskQueueEvents {
  'task:added': (task: Task) => void
  'task:started': (task: Task) => void
  'task:progress': (task: Task) => void
  'task:completed': (task: Task) => void
  'task:failed': (task: Task) => void
  'task:cancelled': (task: Task) => void
  'queue:empty': () => void
  'queue:paused': () => void
  'queue:resumed': () => void
  'config:changed': (config: QueueConfig) => void
}

/**
 * 任务执行函数类型
 */
export type TaskExecutor = (
  task: Task,
  onProgress: (progress: number, currentNode?: string) => void,
  signal: AbortSignal
) => Promise<Record<string, any>>

/**
 * 默认配置
 */
const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrency: 3,
  defaultRetries: 2,
  retryDelay: 3000,
  taskTimeout: 600000 // 10 分钟
}

/**
 * 任务队列服务
 */
class TaskQueueService extends EventEmitter {
  private tasks: Map<string, Task> = new Map()
  private pendingQueue: string[] = []
  private runningTasks: Set<string> = new Set()
  private config: QueueConfig
  private isPaused = false
  private executor?: TaskExecutor
  private processQueueDebounced: () => void

  constructor(config?: Partial<QueueConfig>) {
    super()

    // 加载持久化配置
    const savedConfig = this.loadConfig()
    this.config = {
      ...DEFAULT_CONFIG,
      ...savedConfig,
      ...config
    }

    // 防抖处理队列
    this.processQueueDebounced = this.debounce(() => this.processQueue(), 50)

    // 注意：此时 LoggerService 的 window source 可能还未初始化
    // 延迟日志输出以避免警告
    queueMicrotask(() => {
      logger.info('TaskQueue initialized', { config: this.config })
    })
  }

  /**
   * 加载持久化配置
   */
  private loadConfig(): Partial<QueueConfig> {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      logger.warn('Failed to load queue config', { error })
    }
    return {}
  }

  /**
   * 保存配置到本地存储
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config))
    } catch (error) {
      logger.warn('Failed to save queue config', { error })
    }
  }

  /**
   * 防抖函数
   */
  private debounce(fn: () => void, delay: number): () => void {
    let timeoutId: NodeJS.Timeout | null = null
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        fn()
        timeoutId = null
      }, delay)
    }
  }

  /**
   * 设置任务执行器
   */
  setExecutor(executor: TaskExecutor): void {
    this.executor = executor
  }

  /**
   * 添加任务到队列
   */
  addTask(params: {
    workflowId: string
    workflowName: string
    inputs?: Record<string, any>
    priority?: TaskPriority
    maxRetries?: number
    totalNodes?: number
  }): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const task: Task = {
      id: taskId,
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      status: 'pending',
      priority: params.priority || 'normal',
      progress: 0,
      totalNodes: params.totalNodes || 0,
      completedNodes: 0,
      retryCount: 0,
      maxRetries: params.maxRetries ?? this.config.defaultRetries,
      inputs: params.inputs,
      nodeResults: [],
      createdAt: Date.now()
    }

    this.tasks.set(taskId, task)

    // 使用优先级队列插入
    this.insertByPriority(taskId, task.priority)

    logger.info('Task added', { taskId, workflowName: params.workflowName, priority: task.priority })
    this.emit('task:added', task)

    // 尝试处理队列
    this.processQueueDebounced()

    return taskId
  }

  /**
   * 按优先级插入队列
   */
  private insertByPriority(taskId: string, priority: TaskPriority): void {
    const weight = PRIORITY_WEIGHT[priority]

    // 找到合适的插入位置
    let insertIndex = this.pendingQueue.length
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const existingTask = this.tasks.get(this.pendingQueue[i])
      if (existingTask) {
        const existingWeight = PRIORITY_WEIGHT[existingTask.priority]
        if (weight > existingWeight) {
          insertIndex = i
          break
        }
      }
    }

    this.pendingQueue.splice(insertIndex, 0, taskId)
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) {
      logger.warn('Task not found', { taskId })
      return false
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      return false
    }

    // 如果任务正在运行，触发取消
    if (task.abortController) {
      task.abortController.abort()
    }

    task.status = 'cancelled'
    task.endTime = Date.now()

    // 从队列中移除
    const queueIndex = this.pendingQueue.indexOf(taskId)
    if (queueIndex > -1) {
      this.pendingQueue.splice(queueIndex, 1)
    }
    this.runningTasks.delete(taskId)

    logger.info('Task cancelled', { taskId })
    this.emit('task:cancelled', task)

    // 继续处理队列
    this.processQueueDebounced()

    return true
  }

  /**
   * 重试任务
   */
  retryTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) {
      return false
    }

    if (task.status !== 'failed' && task.status !== 'cancelled') {
      return false
    }

    // 重置任务状态
    task.status = 'pending'
    task.progress = 0
    task.completedNodes = 0
    task.error = undefined
    task.startTime = undefined
    task.endTime = undefined
    task.nodeResults = []
    task.retryCount++

    // 按优先级重新插入队列
    this.insertByPriority(taskId, task.priority)

    logger.info('Task retry scheduled', { taskId, retryCount: task.retryCount })

    this.processQueueDebounced()
    return true
  }

  /**
   * 更新任务优先级
   */
  updateTaskPriority(taskId: string, priority: TaskPriority): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'pending') {
      return false
    }

    // 从队列中移除
    const queueIndex = this.pendingQueue.indexOf(taskId)
    if (queueIndex > -1) {
      this.pendingQueue.splice(queueIndex, 1)
    }

    // 更新优先级并重新插入
    task.priority = priority
    this.insertByPriority(taskId, priority)

    logger.info('Task priority updated', { taskId, priority })
    return true
  }

  /**
   * 暂停队列
   */
  pause(): void {
    this.isPaused = true
    logger.info('Queue paused')
    this.emit('queue:paused')
  }

  /**
   * 恢复队列
   */
  resume(): void {
    this.isPaused = false
    logger.info('Queue resumed')
    this.emit('queue:resumed')
    this.processQueueDebounced()
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).sort((a, b) => {
      // 按状态排序：running > pending > completed/failed/cancelled
      const statusOrder: Record<TaskStatus, number> = {
        running: 0,
        pending: 1,
        paused: 2,
        completed: 3,
        failed: 4,
        cancelled: 5
      }
      const statusDiff = statusOrder[a.status] - statusOrder[b.status]
      if (statusDiff !== 0) return statusDiff

      // 同状态按优先级排序
      const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
      if (priorityDiff !== 0) return priorityDiff

      // 同优先级按创建时间排序
      return a.createdAt - b.createdAt
    })
  }

  /**
   * 获取队列状态
   */
  getStatus(): QueueStatus {
    const tasks = this.getAllTasks()
    return {
      isRunning: this.runningTasks.size > 0,
      isPaused: this.isPaused,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.status === 'pending').length,
      runningTasks: this.runningTasks.size,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      failedTasks: tasks.filter((t) => t.status === 'failed').length,
      maxConcurrency: this.config.maxConcurrency
    }
  }

  /**
   * 清除已完成的任务
   */
  clearCompleted(): void {
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        this.tasks.delete(taskId)
      }
    }
    logger.info('Completed tasks cleared')
  }

  /**
   * 清除失败的任务
   */
  clearFailed(): void {
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'failed') {
        this.tasks.delete(taskId)
      }
    }
    logger.info('Failed tasks cleared')
  }

  /**
   * 清除所有任务
   */
  clearAll(): void {
    // 取消所有运行中的任务
    for (const taskId of this.runningTasks) {
      this.cancelTask(taskId)
    }
    this.tasks.clear()
    this.pendingQueue = []
    this.runningTasks.clear()
    logger.info('All tasks cleared')
  }

  /**
   * 重试所有失败的任务
   */
  retryAllFailed(): number {
    let count = 0
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'failed') {
        if (this.retryTask(taskId)) {
          count++
        }
      }
    }
    logger.info('Retrying all failed tasks', { count })
    return count
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isPaused) {
      return
    }

    // 检查是否可以启动新任务
    while (this.runningTasks.size < this.config.maxConcurrency && this.pendingQueue.length > 0) {
      const taskId = this.pendingQueue.shift()
      if (taskId) {
        this.executeTask(taskId)
      }
    }

    // 检查队列是否为空
    if (this.pendingQueue.length === 0 && this.runningTasks.size === 0) {
      this.emit('queue:empty')
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task || !this.executor) {
      return
    }

    // 创建取消控制器
    const abortController = new AbortController()
    task.abortController = abortController

    // 更新任务状态
    task.status = 'running'
    task.startTime = Date.now()
    this.runningTasks.add(taskId)

    logger.info('Task started', { taskId, workflowName: task.workflowName })
    this.emit('task:started', task)

    try {
      // 设置超时
      const timeoutId = setTimeout(() => {
        logger.warn('Task timeout', { taskId, timeout: this.config.taskTimeout })
        abortController.abort()
      }, this.config.taskTimeout)

      // 执行任务
      const outputs = await this.executor(
        task,
        (progress, currentNode) => {
          task.progress = progress
          task.currentNode = currentNode
          // completedNodes 由 WorkflowTaskManager 管理，此处只广播进度
          this.emit('task:progress', task)
        },
        abortController.signal
      )

      clearTimeout(timeoutId)

      // 任务完成
      task.status = 'completed'
      task.progress = 100
      task.endTime = Date.now()
      task.outputs = outputs

      logger.info('Task completed', {
        taskId,
        duration: task.endTime - (task.startTime || 0)
      })
      this.emit('task:completed', task)
    } catch (error) {
      // 任务失败
      task.status = 'failed'
      task.endTime = Date.now()
      task.error = error instanceof Error ? error.message : String(error)

      logger.error('Task failed', { taskId, error: task.error })

      // 检查是否需要自动重试
      if (task.retryCount < task.maxRetries && !abortController.signal.aborted) {
        logger.info('Task will auto-retry', { taskId, retryCount: task.retryCount + 1 })
        setTimeout(() => {
          this.retryTask(taskId)
        }, this.config.retryDelay)
      } else {
        this.emit('task:failed', task)
      }
    } finally {
      this.runningTasks.delete(taskId)
      task.abortController = undefined

      // 继续处理队列
      this.processQueueDebounced()
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueueConfig>): void {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...config }

    // 保存到本地存储
    this.saveConfig()

    logger.info('Queue config updated', { oldConfig, newConfig: this.config })
    this.emit('config:changed', this.config)

    // 如果增加了并发数，尝试启动更多任务
    if (config.maxConcurrency && config.maxConcurrency > oldConfig.maxConcurrency) {
      this.processQueueDebounced()
    }
  }

  /**
   * 获取配置
   */
  getConfig(): QueueConfig {
    return { ...this.config }
  }

  /**
   * 获取队列统计信息
   */
  getStatistics(): {
    totalExecuted: number
    totalCompleted: number
    totalFailed: number
    averageDuration: number
    successRate: number
  } {
    const tasks = this.getAllTasks()
    const completed = tasks.filter((t) => t.status === 'completed')
    const failed = tasks.filter((t) => t.status === 'failed')
    const executed = [...completed, ...failed]

    const durations = completed.filter((t) => t.startTime && t.endTime).map((t) => t.endTime! - t.startTime!)

    const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

    const successRate = executed.length > 0 ? (completed.length / executed.length) * 100 : 0

    return {
      totalExecuted: executed.length,
      totalCompleted: completed.length,
      totalFailed: failed.length,
      averageDuration,
      successRate
    }
  }
}

// 导出单例
export const taskQueue = new TaskQueueService()

export default TaskQueueService
