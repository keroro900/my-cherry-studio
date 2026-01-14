/**
 * 任务存储服务
 *
 * 负责任务历史的持久化存储和读取
 * 使用 IndexedDB 支持大数据量存储
 *
 * 增强功能：
 * - IndexedDB 存储（支持更大数据量）
 * - 任务恢复功能
 * - 任务输出结果持久化
 * - 详细统计信息
 * - 数据压缩（可选）
 */

import { loggerService } from '@logger'

import type { Task, TaskPriority, TaskStatus } from './TaskQueue'

const logger = loggerService.withContext('TaskStorage')

// 存储键
const STORAGE_KEY = 'workflow-task-history'
const DB_NAME = 'workflow-task-db'
const DB_VERSION = 1
const STORE_NAME = 'task-history'

/**
 * 任务历史记录
 */
export interface TaskHistory {
  id: string
  workflowId: string
  workflowName: string
  status: TaskStatus
  priority: TaskPriority
  progress: number
  startTime: number
  endTime?: number
  duration?: number
  totalNodes: number
  completedNodes: number
  error?: string
  retryCount: number
  // 输出文件路径
  outputFiles?: string[]
  // 任务输出摘要（不包含大数据）
  outputSummary?: {
    hasImages: boolean
    hasVideos: boolean
    hasText: boolean
    imageCount: number
    videoCount: number
  }
  // 创建时间
  createdAt: number
  // 更新时间
  updatedAt: number
}

/**
 * 可恢复的任务数据
 */
export interface RecoverableTask {
  id: string
  workflowId: string
  workflowName: string
  priority: TaskPriority
  totalNodes: number
  // 工作流数据（用于恢复）
  workflowData?: string // JSON 字符串
  createdAt: number
}

/**
 * 存储配置
 */
interface StorageConfig {
  maxHistoryItems: number // 最大历史记录数
  autoSaveInterval: number // 自动保存间隔（毫秒）
  useIndexedDB: boolean // 是否使用 IndexedDB
  maxRecoverableTasks: number // 最大可恢复任务数
}

const DEFAULT_CONFIG: StorageConfig = {
  maxHistoryItems: 500,
  autoSaveInterval: 10000, // 10 秒
  useIndexedDB: true,
  maxRecoverableTasks: 10
}

/**
 * 任务存储服务
 */
class TaskStorageService {
  private history: TaskHistory[] = []
  private recoverableTasks: Map<string, RecoverableTask> = new Map()
  private config: StorageConfig
  private autoSaveTimer?: ReturnType<typeof setInterval>
  private isDirty = false
  private db: IDBDatabase | null = null
  private isInitialized = false
  private isDisposed = false
  private boundBeforeUnload: () => void

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    // 绑定 beforeunload 处理器
    this.boundBeforeUnload = this.handleBeforeUnload.bind(this)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.boundBeforeUnload)
    }
    this.initialize()
  }

  /**
   * 窗口关闭前处理
   */
  private handleBeforeUnload(): void {
    // 同步保存并清理资源
    this.dispose()
  }

  /**
   * 初始化存储
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      if (this.config.useIndexedDB && typeof indexedDB !== 'undefined') {
        await this.initIndexedDB()
      } else {
        await this.loadFromLocalStorage()
      }
      this.startAutoSave()
      this.isInitialized = true
      logger.info('TaskStorage initialized', {
        useIndexedDB: this.config.useIndexedDB,
        historyCount: this.history.length
      })
    } catch (error) {
      logger.error('Failed to initialize TaskStorage', { error })
      // 降级到 localStorage
      await this.loadFromLocalStorage()
      this.startAutoSave()
      this.isInitialized = true
    }
  }

  /**
   * 初始化 IndexedDB
   */
  private initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        logger.error('Failed to open IndexedDB', { error: request.error })
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.loadFromIndexedDB().then(resolve).catch(reject)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建任务历史存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('workflowId', 'workflowId', { unique: false })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // 创建可恢复任务存储
        if (!db.objectStoreNames.contains('recoverable-tasks')) {
          db.createObjectStore('recoverable-tasks', { keyPath: 'id' })
        }
      }
    })
  }

  /**
   * 从 IndexedDB 加载数据
   */
  private loadFromIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME, 'recoverable-tasks'], 'readonly')
      const historyStore = transaction.objectStore(STORE_NAME)
      const recoverableStore = transaction.objectStore('recoverable-tasks')

      const historyRequest = historyStore.getAll()
      const recoverableRequest = recoverableStore.getAll()

      historyRequest.onsuccess = () => {
        this.history = historyRequest.result || []
        logger.info('Loaded history from IndexedDB', { count: this.history.length })
      }

      recoverableRequest.onsuccess = () => {
        const tasks = recoverableRequest.result || []
        this.recoverableTasks.clear()
        tasks.forEach((task: RecoverableTask) => {
          this.recoverableTasks.set(task.id, task)
        })
        logger.info('Loaded recoverable tasks from IndexedDB', { count: this.recoverableTasks.size })
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * 保存到 IndexedDB
   */
  private saveToIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME, 'recoverable-tasks'], 'readwrite')
      const historyStore = transaction.objectStore(STORE_NAME)
      const recoverableStore = transaction.objectStore('recoverable-tasks')

      // 清空并重新写入历史记录
      historyStore.clear()
      this.history.forEach((item) => {
        historyStore.add(item)
      })

      // 清空并重新写入可恢复任务
      recoverableStore.clear()
      this.recoverableTasks.forEach((task) => {
        recoverableStore.add(task)
      })

      transaction.oncomplete = () => {
        this.isDirty = false
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * 从 localStorage 加载（降级方案）
   */
  private async loadFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.history = JSON.parse(stored)
        logger.info('Task history loaded from localStorage', { count: this.history.length })
      }

      const recoverableStored = localStorage.getItem(`${STORAGE_KEY}-recoverable`)
      if (recoverableStored) {
        const tasks = JSON.parse(recoverableStored) as RecoverableTask[]
        this.recoverableTasks.clear()
        tasks.forEach((task) => {
          this.recoverableTasks.set(task.id, task)
        })
      }
    } catch (error) {
      logger.error('Failed to load task history from localStorage', { error })
      this.history = []
    }
  }

  /**
   * 保存到 localStorage（降级方案）
   */
  private async saveToLocalStorage(): Promise<void> {
    try {
      // 限制历史记录数量
      if (this.history.length > this.config.maxHistoryItems) {
        this.history = this.history.slice(-this.config.maxHistoryItems)
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history))

      const recoverableTasks = Array.from(this.recoverableTasks.values())
      localStorage.setItem(`${STORAGE_KEY}-recoverable`, JSON.stringify(recoverableTasks))

      this.isDirty = false
      logger.debug('Task history saved to localStorage', { count: this.history.length })
    } catch (error) {
      logger.error('Failed to save task history to localStorage', { error })
    }
  }

  /**
   * 保存到存储
   */
  private async saveToStorage(): Promise<void> {
    if (!this.isDirty) return

    try {
      if (this.db) {
        await this.saveToIndexedDB()
      } else {
        await this.saveToLocalStorage()
      }
    } catch (error) {
      logger.error('Failed to save to storage', { error })
      // 尝试降级到 localStorage
      await this.saveToLocalStorage()
    }
  }

  /**
   * 启动自动保存
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.saveToStorage()
    }, this.config.autoSaveInterval)
  }

  /**
   * 停止自动保存
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = undefined
    }
  }

  /**
   * 释放资源
   */
  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    // 停止自动保存
    this.stopAutoSave()

    // 移除事件监听器
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.boundBeforeUnload)
    }

    // 关闭 IndexedDB 连接
    if (this.db) {
      this.db.close()
      this.db = null
    }

    logger.info('TaskStorage disposed')
  }

  /**
   * 从 Task 创建历史记录
   */
  private createHistoryFromTask(task: Task): TaskHistory {
    // 分析输出摘要
    let outputSummary: TaskHistory['outputSummary'] = undefined
    if (task.outputs) {
      const result = task.outputs.result || task.outputs
      outputSummary = {
        hasImages: !!(result?.image || result?.images),
        hasVideos: !!(result?.video || result?.videos),
        hasText: !!(result?.text || result?.content),
        imageCount: Array.isArray(result?.image) ? result.image.length : result?.image ? 1 : 0,
        videoCount: Array.isArray(result?.video) ? result.video.length : result?.video ? 1 : 0
      }
    }

    return {
      id: task.id,
      workflowId: task.workflowId,
      workflowName: task.workflowName,
      status: task.status,
      priority: task.priority,
      progress: task.progress,
      startTime: task.startTime || Date.now(),
      endTime: task.endTime,
      duration: task.endTime && task.startTime ? task.endTime - task.startTime : undefined,
      totalNodes: task.totalNodes,
      completedNodes: task.completedNodes,
      error: task.error,
      retryCount: task.retryCount,
      outputSummary,
      createdAt: task.createdAt || Date.now(),
      updatedAt: Date.now()
    }
  }

  /**
   * 添加或更新任务历史
   */
  saveTask(task: Task): void {
    const existingIndex = this.history.findIndex((h) => h.id === task.id)

    if (existingIndex >= 0) {
      // 更新现有记录
      const existing = this.history[existingIndex]
      this.history[existingIndex] = {
        ...existing,
        status: task.status,
        progress: task.progress,
        endTime: task.endTime,
        duration: task.endTime && task.startTime ? task.endTime - task.startTime : undefined,
        completedNodes: task.completedNodes,
        error: task.error,
        retryCount: task.retryCount,
        updatedAt: Date.now()
      }
    } else {
      // 添加新记录
      this.history.push(this.createHistoryFromTask(task))
    }

    // 如果任务完成或失败，从可恢复列表中移除
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      this.recoverableTasks.delete(task.id)
    }

    this.isDirty = true
  }

  /**
   * 保存可恢复任务
   */
  saveRecoverableTask(task: Task, workflowData?: any): void {
    if (this.recoverableTasks.size >= this.config.maxRecoverableTasks) {
      // 移除最旧的
      const oldest = Array.from(this.recoverableTasks.values()).sort((a, b) => a.createdAt - b.createdAt)[0]
      if (oldest) {
        this.recoverableTasks.delete(oldest.id)
      }
    }

    this.recoverableTasks.set(task.id, {
      id: task.id,
      workflowId: task.workflowId,
      workflowName: task.workflowName,
      priority: task.priority,
      totalNodes: task.totalNodes,
      workflowData: workflowData ? JSON.stringify(workflowData) : undefined,
      createdAt: task.createdAt || Date.now()
    })

    this.isDirty = true
  }

  /**
   * 获取可恢复的任务列表
   */
  getRecoverableTasks(): RecoverableTask[] {
    return Array.from(this.recoverableTasks.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * 移除可恢复任务
   */
  removeRecoverableTask(taskId: string): void {
    this.recoverableTasks.delete(taskId)
    this.isDirty = true
  }

  /**
   * 清除所有可恢复任务
   */
  clearRecoverableTasks(): void {
    this.recoverableTasks.clear()
    this.isDirty = true
  }

  /**
   * 获取任务历史
   */
  getHistory(options?: {
    workflowId?: string
    status?: TaskStatus
    priority?: TaskPriority
    limit?: number
    offset?: number
    startDate?: number
    endDate?: number
  }): TaskHistory[] {
    let result = [...this.history]

    // 按工作流过滤
    if (options?.workflowId) {
      result = result.filter((h) => h.workflowId === options.workflowId)
    }

    // 按状态过滤
    if (options?.status) {
      result = result.filter((h) => h.status === options.status)
    }

    // 按优先级过滤
    if (options?.priority) {
      result = result.filter((h) => h.priority === options.priority)
    }

    // 按日期范围过滤
    if (options?.startDate) {
      result = result.filter((h) => h.createdAt >= options.startDate!)
    }
    if (options?.endDate) {
      result = result.filter((h) => h.createdAt <= options.endDate!)
    }

    // 按时间倒序排列
    result.sort((a, b) => b.createdAt - a.createdAt)

    // 分页
    if (options?.offset !== undefined) {
      result = result.slice(options.offset)
    }
    if (options?.limit !== undefined) {
      result = result.slice(0, options.limit)
    }

    return result
  }

  /**
   * 获取单个任务历史
   */
  getTaskHistory(taskId: string): TaskHistory | undefined {
    return this.history.find((h) => h.id === taskId)
  }

  /**
   * 删除任务历史
   */
  deleteHistory(taskId: string): boolean {
    const index = this.history.findIndex((h) => h.id === taskId)
    if (index >= 0) {
      this.history.splice(index, 1)
      this.isDirty = true
      return true
    }
    return false
  }

  /**
   * 批量删除任务历史
   */
  deleteHistoryBatch(taskIds: string[]): number {
    const idsSet = new Set(taskIds)
    const originalLength = this.history.length
    this.history = this.history.filter((h) => !idsSet.has(h.id))
    const deletedCount = originalLength - this.history.length
    if (deletedCount > 0) {
      this.isDirty = true
    }
    return deletedCount
  }

  /**
   * 清除所有历史
   */
  clearHistory(): void {
    this.history = []
    this.isDirty = true
    this.saveToStorage()
  }

  /**
   * 清除指定状态的历史
   */
  clearByStatus(status: TaskStatus): number {
    const originalLength = this.history.length
    this.history = this.history.filter((h) => h.status !== status)
    const deletedCount = originalLength - this.history.length
    if (deletedCount > 0) {
      this.isDirty = true
    }
    return deletedCount
  }

  /**
   * 清除指定日期之前的历史
   */
  clearBeforeDate(date: number): number {
    const originalLength = this.history.length
    this.history = this.history.filter((h) => h.createdAt >= date)
    const deletedCount = originalLength - this.history.length
    if (deletedCount > 0) {
      this.isDirty = true
    }
    return deletedCount
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number
    completed: number
    failed: number
    cancelled: number
    running: number
    pending: number
    averageDuration: number
    successRate: number
    totalDuration: number
    byWorkflow: Record<string, { count: number; completed: number; failed: number }>
    byPriority: Record<TaskPriority, number>
    recentTrend: { date: string; completed: number; failed: number }[]
  } {
    const completed = this.history.filter((h) => h.status === 'completed')
    const failed = this.history.filter((h) => h.status === 'failed')
    const cancelled = this.history.filter((h) => h.status === 'cancelled')
    const running = this.history.filter((h) => h.status === 'running')
    const pending = this.history.filter((h) => h.status === 'pending')

    const durations = completed.filter((h) => h.duration).map((h) => h.duration!)
    const totalDuration = durations.reduce((a, b) => a + b, 0)
    const averageDuration = durations.length > 0 ? totalDuration / durations.length : 0

    const executed = completed.length + failed.length
    const successRate = executed > 0 ? (completed.length / executed) * 100 : 0

    // 按工作流统计
    const byWorkflow: Record<string, { count: number; completed: number; failed: number }> = {}
    this.history.forEach((h) => {
      if (!byWorkflow[h.workflowId]) {
        byWorkflow[h.workflowId] = { count: 0, completed: 0, failed: 0 }
      }
      byWorkflow[h.workflowId].count++
      if (h.status === 'completed') byWorkflow[h.workflowId].completed++
      if (h.status === 'failed') byWorkflow[h.workflowId].failed++
    })

    // 按优先级统计
    const byPriority: Record<TaskPriority, number> = { high: 0, normal: 0, low: 0 }
    this.history.forEach((h) => {
      byPriority[h.priority || 'normal']++
    })

    // 最近 7 天趋势
    const recentTrend: { date: string; completed: number; failed: number }[] = []
    const now = Date.now()
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 24 * 60 * 60 * 1000)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      const dayCompleted = this.history.filter(
        (h) => h.status === 'completed' && h.createdAt >= dayStart.getTime() && h.createdAt <= dayEnd.getTime()
      ).length
      const dayFailed = this.history.filter(
        (h) => h.status === 'failed' && h.createdAt >= dayStart.getTime() && h.createdAt <= dayEnd.getTime()
      ).length

      recentTrend.push({
        date: dayStart.toISOString().split('T')[0],
        completed: dayCompleted,
        failed: dayFailed
      })
    }

    return {
      total: this.history.length,
      completed: completed.length,
      failed: failed.length,
      cancelled: cancelled.length,
      running: running.length,
      pending: pending.length,
      averageDuration,
      successRate,
      totalDuration,
      byWorkflow,
      byPriority,
      recentTrend
    }
  }

  /**
   * 强制保存
   */
  async flush(): Promise<void> {
    this.isDirty = true
    await this.saveToStorage()
  }

  /**
   * 导出历史记录
   */
  exportHistory(options?: { format?: 'json' | 'csv' }): string {
    if (options?.format === 'csv') {
      const headers = ['ID', 'Workflow', 'Status', 'Priority', 'Duration', 'Created At']
      const rows = this.history.map((h) => [
        h.id,
        h.workflowName,
        h.status,
        h.priority || 'normal',
        h.duration ? `${(h.duration / 1000).toFixed(2)}s` : '',
        new Date(h.createdAt).toISOString()
      ])
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }
    return JSON.stringify(this.history, null, 2)
  }

  /**
   * 导入历史记录
   */
  importHistory(json: string, options?: { merge?: boolean }): { success: boolean; count: number; error?: string } {
    try {
      const imported = JSON.parse(json) as TaskHistory[]
      if (!Array.isArray(imported)) {
        return { success: false, count: 0, error: 'Invalid format: expected array' }
      }

      if (options?.merge) {
        // 合并模式：只添加不存在的记录
        const existingIds = new Set(this.history.map((h) => h.id))
        const newItems = imported.filter((item) => !existingIds.has(item.id))
        this.history = [...this.history, ...newItems]
        this.isDirty = true
        return { success: true, count: newItems.length }
      } else {
        // 替换模式
        this.history = imported
        this.isDirty = true
        return { success: true, count: imported.length }
      }
    } catch (error) {
      return { success: false, count: 0, error: error instanceof Error ? error.message : 'Parse error' }
    }
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): {
    historyCount: number
    recoverableCount: number
    estimatedSize: number
    storageType: 'indexeddb' | 'localstorage'
  } {
    const historyJson = JSON.stringify(this.history)
    const recoverableJson = JSON.stringify(Array.from(this.recoverableTasks.values()))

    return {
      historyCount: this.history.length,
      recoverableCount: this.recoverableTasks.size,
      estimatedSize: historyJson.length + recoverableJson.length,
      storageType: this.db ? 'indexeddb' : 'localstorage'
    }
  }
}

// 导出单例
export const taskStorage = new TaskStorageService()

export default TaskStorageService
