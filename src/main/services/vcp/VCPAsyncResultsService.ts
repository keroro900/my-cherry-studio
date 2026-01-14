/**
 * VCP 异步结果服务
 *
 * 存储和检索异步插件执行结果
 * 支持 {{VCP_ASYNC_RESULT::PluginName::TaskID}} 占位符替换
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('VCPAsyncResultsService')

/**
 * 异步结果状态
 */
export type AsyncResultStatus = 'pending' | 'running' | 'completed' | 'failed' | 'expired'

/**
 * 异步结果条目
 */
export interface AsyncResultEntry {
  id: string
  pluginName: string
  taskId: string
  status: AsyncResultStatus
  result?: string
  error?: string
  createdAt: string
  updatedAt: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

/**
 * VCP 异步结果服务
 */
export class VCPAsyncResultsService {
  private resultsDir: string
  private cache: Map<string, AsyncResultEntry> = new Map()
  private defaultTTL: number = 24 * 60 * 60 * 1000 // 24 hours

  constructor() {
    // 使用应用数据目录存储异步结果
    this.resultsDir = path.join(app.getPath('userData'), 'VCPAsyncResults')
    this.ensureResultsDir()
    this.loadCache()
    logger.info('VCPAsyncResultsService initialized', { resultsDir: this.resultsDir })
  }

  /**
   * 确保结果目录存在
   */
  private ensureResultsDir(): void {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true })
      logger.info('Created VCPAsyncResults directory', { path: this.resultsDir })
    }
  }

  /**
   * 加载缓存
   */
  private loadCache(): void {
    try {
      const files = fs.readdirSync(this.resultsDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.resultsDir, file)
            const content = fs.readFileSync(filePath, 'utf-8')
            const entry = JSON.parse(content) as AsyncResultEntry
            this.cache.set(entry.id, entry)
          } catch (err) {
            logger.warn('Failed to load async result file', { file, error: err })
          }
        }
      }
      logger.debug('Loaded async results cache', { count: this.cache.size })
    } catch (err) {
      logger.error('Failed to load async results cache', err as Error)
    }
  }

  /**
   * 生成结果 ID
   */
  private generateId(pluginName: string, taskId: string): string {
    return `${pluginName}::${taskId}`
  }

  /**
   * 获取文件路径
   */
  private getFilePath(id: string): string {
    // 替换特殊字符以确保文件名有效
    const safeId = id.replace(/[:/\\*?"<>|]/g, '-')
    return path.join(this.resultsDir, `${safeId}.json`)
  }

  /**
   * 保存结果到文件
   */
  private saveToFile(entry: AsyncResultEntry): void {
    try {
      const filePath = this.getFilePath(entry.id)
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8')
    } catch (err) {
      logger.error('Failed to save async result', err as Error)
    }
  }

  /**
   * 从文件删除结果
   */
  private deleteFile(id: string): void {
    try {
      const filePath = this.getFilePath(id)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (err) {
      logger.warn('Failed to delete async result file', { id, error: err })
    }
  }

  /**
   * 创建新的异步任务
   */
  createTask(params: {
    pluginName: string
    taskId: string
    metadata?: Record<string, unknown>
    ttl?: number
  }): AsyncResultEntry {
    const { pluginName, taskId, metadata, ttl = this.defaultTTL } = params
    const id = this.generateId(pluginName, taskId)
    const now = new Date().toISOString()

    const entry: AsyncResultEntry = {
      id,
      pluginName,
      taskId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ttl).toISOString(),
      metadata
    }

    this.cache.set(id, entry)
    this.saveToFile(entry)

    logger.info('Async task created', { id, pluginName, taskId })
    return entry
  }

  /**
   * 更新任务状态
   */
  updateStatus(pluginName: string, taskId: string, status: AsyncResultStatus): AsyncResultEntry | null {
    const id = this.generateId(pluginName, taskId)
    const entry = this.cache.get(id)

    if (!entry) {
      logger.warn('Async task not found for status update', { id })
      return null
    }

    entry.status = status
    entry.updatedAt = new Date().toISOString()

    this.cache.set(id, entry)
    this.saveToFile(entry)

    logger.debug('Async task status updated', { id, status })
    return entry
  }

  /**
   * 存储任务结果
   */
  storeResult(params: {
    pluginName: string
    taskId: string
    result: string
    metadata?: Record<string, unknown>
  }): AsyncResultEntry {
    const { pluginName, taskId, result, metadata } = params
    const id = this.generateId(pluginName, taskId)
    const now = new Date().toISOString()

    let entry = this.cache.get(id)

    if (entry) {
      // 更新现有条目
      entry.status = 'completed'
      entry.result = result
      entry.updatedAt = now
      if (metadata) {
        entry.metadata = { ...entry.metadata, ...metadata }
      }
    } else {
      // 创建新条目
      entry = {
        id,
        pluginName,
        taskId,
        status: 'completed',
        result,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + this.defaultTTL).toISOString(),
        metadata
      }
    }

    this.cache.set(id, entry)
    this.saveToFile(entry)

    logger.info('Async result stored', { id, resultLength: result.length })
    return entry
  }

  /**
   * 存储任务错误
   */
  storeError(params: {
    pluginName: string
    taskId: string
    error: string
    metadata?: Record<string, unknown>
  }): AsyncResultEntry {
    const { pluginName, taskId, error, metadata } = params
    const id = this.generateId(pluginName, taskId)
    const now = new Date().toISOString()

    let entry = this.cache.get(id)

    if (entry) {
      entry.status = 'failed'
      entry.error = error
      entry.updatedAt = now
      if (metadata) {
        entry.metadata = { ...entry.metadata, ...metadata }
      }
    } else {
      entry = {
        id,
        pluginName,
        taskId,
        status: 'failed',
        error,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + this.defaultTTL).toISOString(),
        metadata
      }
    }

    this.cache.set(id, entry)
    this.saveToFile(entry)

    logger.info('Async error stored', { id, error })
    return entry
  }

  /**
   * 获取结果
   */
  getResult(pluginName: string, taskId: string): AsyncResultEntry | null {
    const id = this.generateId(pluginName, taskId)
    const entry = this.cache.get(id)

    if (!entry) {
      return null
    }

    // 检查是否过期
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      entry.status = 'expired'
      this.cache.set(id, entry)
      this.saveToFile(entry)
    }

    return entry
  }

  /**
   * 删除结果
   */
  deleteResult(pluginName: string, taskId: string): boolean {
    const id = this.generateId(pluginName, taskId)

    if (this.cache.has(id)) {
      this.cache.delete(id)
      this.deleteFile(id)
      logger.debug('Async result deleted', { id })
      return true
    }

    return false
  }

  /**
   * 替换文本中的异步结果占位符
   *
   * 格式: {{VCP_ASYNC_RESULT::PluginName::TaskID}}
   */
  replaceAsyncPlaceholders(text: string): string {
    const pattern = /\{\{VCP_ASYNC_RESULT::([^:]+)::([^}]+)\}\}/g

    return text.replace(pattern, (match, pluginName, taskId) => {
      const entry = this.getResult(pluginName, taskId)

      if (!entry) {
        return `[异步结果待更新: ${pluginName}::${taskId}]`
      }

      switch (entry.status) {
        case 'completed':
          return entry.result || '[结果为空]'
        case 'pending':
          return `[任务进行中: ${pluginName}::${taskId}]`
        case 'running':
          return `[任务执行中: ${pluginName}::${taskId}]`
        case 'failed':
          return `[任务失败: ${entry.error || '未知错误'}]`
        case 'expired':
          return `[结果已过期: ${pluginName}::${taskId}]`
        default:
          return match
      }
    })
  }

  /**
   * 检查文本是否包含异步占位符
   */
  hasAsyncPlaceholders(text: string): boolean {
    return /\{\{VCP_ASYNC_RESULT::[^:]+::[^}]+\}\}/.test(text)
  }

  /**
   * 提取所有异步占位符
   */
  extractAsyncPlaceholders(text: string): Array<{ pluginName: string; taskId: string }> {
    const pattern = /\{\{VCP_ASYNC_RESULT::([^:]+)::([^}]+)\}\}/g
    const placeholders: Array<{ pluginName: string; taskId: string }> = []

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      placeholders.push({
        pluginName: match[1],
        taskId: match[2]
      })
    }

    return placeholders
  }

  /**
   * 清理过期结果
   */
  cleanupExpired(): number {
    const now = new Date()
    let cleanedCount = 0

    for (const [id, entry] of this.cache) {
      if (entry.expiresAt && new Date(entry.expiresAt) < now) {
        this.cache.delete(id)
        this.deleteFile(id)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired async results', { count: cleanedCount })
    }

    return cleanedCount
  }

  /**
   * 获取所有结果
   */
  getAllResults(): AsyncResultEntry[] {
    return Array.from(this.cache.values())
  }

  /**
   * 获取插件的所有结果
   */
  getResultsByPlugin(pluginName: string): AsyncResultEntry[] {
    return Array.from(this.cache.values()).filter((entry) => entry.pluginName === pluginName)
  }

  /**
   * 清空所有结果
   */
  clear(): void {
    for (const id of this.cache.keys()) {
      this.deleteFile(id)
    }
    this.cache.clear()
    logger.info('All async results cleared')
  }
}

// 单例实例
let _instance: VCPAsyncResultsService | null = null

export function getVCPAsyncResultsService(): VCPAsyncResultsService {
  if (!_instance) {
    _instance = new VCPAsyncResultsService()
  }
  return _instance
}

export function createVCPAsyncResultsService(): VCPAsyncResultsService {
  return new VCPAsyncResultsService()
}
