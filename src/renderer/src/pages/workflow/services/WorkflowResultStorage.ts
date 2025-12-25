/**
 * 工作流结果存储服务
 * 使用 IndexedDB 存储大型数据（图片、视频等）
 * Redux 只存储引用 ID，避免 localStorage 配额超限
 */

import { loggerService } from '@logger'

import { getDefaultExportPath, joinPath } from '../utils/pathUtils'

const logger = loggerService.withContext('WorkflowResultStorage')

const DB_NAME = 'cherry-workflow-results'
const DB_VERSION = 1
const STORE_NAME = 'results'

interface StoredResult {
  id: string
  nodeId: string
  workflowId?: string
  timestamp: number
  type: 'image' | 'video' | 'text' | 'any'
  data: string // base64 或 URL
  metadata?: Record<string, any>
}

class WorkflowResultStorageService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * 初始化 IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        logger.error('Failed to open IndexedDB', { error: request.error })
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        logger.info('IndexedDB initialized successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建结果存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('nodeId', 'nodeId', { unique: false })
          store.createIndex('workflowId', 'workflowId', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          logger.info('IndexedDB store created')
        }
      }
    })

    return this.initPromise
  }

  /**
   * 保存结果到 IndexedDB
   * @returns 存储的 ID
   */
  async saveResult(params: {
    nodeId: string
    workflowId?: string
    type: 'image' | 'video' | 'text' | 'any'
    data: string
    metadata?: Record<string, any>
  }): Promise<string> {
    await this.init()

    const id = `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const storedResult: StoredResult = {
      id,
      nodeId: params.nodeId,
      workflowId: params.workflowId,
      timestamp: Date.now(),
      type: params.type,
      data: params.data,
      metadata: params.metadata
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(storedResult)

      request.onsuccess = () => {
        logger.debug('Result saved to IndexedDB', { id, nodeId: params.nodeId, type: params.type })
        resolve(id)
      }

      request.onerror = () => {
        logger.error('Failed to save result to IndexedDB', { error: request.error })
        reject(request.error)
      }
    })
  }

  /**
   * 从 IndexedDB 获取结果
   */
  async getResult(id: string): Promise<StoredResult | null> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        logger.error('Failed to get result from IndexedDB', { error: request.error })
        reject(request.error)
      }
    })
  }

  /**
   * 获取节点的所有结果
   */
  async getResultsByNodeId(nodeId: string): Promise<StoredResult[]> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('nodeId')
      const request = index.getAll(nodeId)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        logger.error('Failed to get results by nodeId', { error: request.error })
        reject(request.error)
      }
    })
  }

  /**
   * 删除结果
   */
  async deleteResult(id: string): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => {
        logger.debug('Result deleted from IndexedDB', { id })
        resolve()
      }

      request.onerror = () => {
        logger.error('Failed to delete result from IndexedDB', { error: request.error })
        reject(request.error)
      }
    })
  }

  /**
   * 删除节点的所有结果
   */
  async deleteResultsByNodeId(nodeId: string): Promise<void> {
    const results = await this.getResultsByNodeId(nodeId)
    for (const result of results) {
      await this.deleteResult(result.id)
    }
  }

  /**
   * 清理过期数据（超过 7 天）
   */
  async cleanupOldResults(maxAgeDays: number = 7): Promise<number> {
    await this.init()

    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    let deletedCount = 0

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const range = IDBKeyRange.upperBound(cutoffTime)
      const request = index.openCursor(range)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          logger.info('Cleanup completed', { deletedCount })
          resolve(deletedCount)
        }
      }

      request.onerror = () => {
        logger.error('Failed to cleanup old results', { error: request.error })
        reject(request.error)
      }
    })
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<{ count: number; oldestTimestamp: number | null }> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const countRequest = store.count()

      countRequest.onsuccess = () => {
        const count = countRequest.result

        // 获取最旧的记录
        const index = store.index('timestamp')
        const oldestRequest = index.openCursor()

        oldestRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          resolve({
            count,
            oldestTimestamp: cursor ? cursor.value.timestamp : null
          })
        }

        oldestRequest.onerror = () => {
          resolve({ count, oldestTimestamp: null })
        }
      }

      countRequest.onerror = () => {
        reject(countRequest.error)
      }
    })
  }
}

// 单例导出
export const workflowResultStorage = new WorkflowResultStorageService()

/**
 * 处理节点输出结果
 * 将大数据存入 IndexedDB，返回轻量引用
 */
export async function processNodeResult(
  nodeId: string,
  outputs: any,
  workflowId?: string
): Promise<{
  cleanedResult: any
  storedIds: string[]
}> {
  const storedIds: string[] = []

  // 解析嵌套的 result 结构
  let result = outputs
  if (result && typeof result === 'object' && 'result' in result) {
    result = result.result
  }

  if (!result) {
    return { cleanedResult: outputs, storedIds }
  }

  const cleanedResult = { ...outputs }
  if (cleanedResult.result && typeof cleanedResult.result === 'object') {
    cleanedResult.result = { ...cleanedResult.result }
  }
  const targetResult = cleanedResult.result || cleanedResult

  // 处理图片
  if (targetResult.image && typeof targetResult.image === 'string' && targetResult.image.length > 1000) {
    try {
      const id = await workflowResultStorage.saveResult({
        nodeId,
        workflowId,
        type: 'image',
        data: targetResult.image
      })
      storedIds.push(id)
      targetResult.image = `indexeddb://${id}`
      targetResult._imageStorageId = id
    } catch (error) {
      logger.error('Failed to store image in IndexedDB', { error })
      targetResult.image = '[IMAGE_STORAGE_FAILED]'
    }
  }

  // 处理视频
  if (targetResult.video && typeof targetResult.video === 'string' && targetResult.video.length > 1000) {
    try {
      const id = await workflowResultStorage.saveResult({
        nodeId,
        workflowId,
        type: 'video',
        data: targetResult.video
      })
      storedIds.push(id)
      targetResult.video = `indexeddb://${id}`
      targetResult._videoStorageId = id
    } catch (error) {
      logger.error('Failed to store video in IndexedDB', { error })
      targetResult.video = '[VIDEO_STORAGE_FAILED]'
    }
  }

  return { cleanedResult, storedIds }
}

/**
 * 从 IndexedDB 引用加载实际数据
 */
export async function loadResultData(reference: string): Promise<string | null> {
  if (!reference.startsWith('indexeddb://')) {
    return reference
  }

  const id = reference.replace('indexeddb://', '')
  try {
    const result = await workflowResultStorage.getResult(id)
    return result?.data || null
  } catch (error) {
    logger.error('Failed to load result from IndexedDB', { id, error })
    return null
  }
}

/**
 * Base64 字符串转 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * 确保目录存在
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await window.api?.file?.mkdir?.(dirPath)
  } catch (error) {
    // 目录可能已存在，忽略错误
    logger.debug('mkdir error (may already exist)', { error })
  }
}

/**
 * 检查是否在 Electron 环境中
 */
function isElectronEnvironment(): boolean {
  return !!window.api?.file?.write
}

/**
 * 保存文件到本地（通过 Electron main process）
 * 使用 file.write API（支持 Uint8Array）
 *
 * 降级策略：
 * - Electron 环境：使用 file.write API 保存到本地
 * - 非 Electron 环境：返回 null，调用方应降级到浏览器下载
 */
export async function saveResultToFile(
  data: string,
  filename: string,
  type: 'image' | 'video'
): Promise<string | null> {
  // 检查是否在 Electron 环境
  if (!isElectronEnvironment()) {
    logger.warn('saveResultToFile: Not in Electron environment, cannot save to local filesystem', {
      filename,
      type,
      hint: '请使用浏览器下载功能或在 Electron 环境中运行'
    })
    return null
  }

  try {
    // 获取导出目录
    const exportPath = await getDefaultExportPath()
    if (!exportPath) {
      logger.error('saveResultToFile: Failed to get default export path', {
        filename,
        type,
        hint: '无法获取默认导出路径，请检查系统权限'
      })
      return null
    }

    // 确保目录存在
    try {
      await ensureDirectory(exportPath)
    } catch (dirError) {
      logger.error('saveResultToFile: Failed to create export directory', {
        exportPath,
        error: dirError instanceof Error ? dirError.message : String(dirError),
        hint: '无法创建导出目录，请检查磁盘空间和权限'
      })
      return null
    }

    const filePath = joinPath(exportPath, filename)

    // 使用 Cherry Studio 的 file.write API 保存
    if (data.startsWith('data:')) {
      // Base64 数据 - 转换为 Uint8Array 后写入
      const base64Data = data.split(',')[1]
      if (!base64Data) {
        logger.error('saveResultToFile: Invalid base64 data format', { filename })
        return null
      }
      const uint8Array = base64ToUint8Array(base64Data)
      await window.api?.file?.write?.(filePath, uint8Array)
      logger.info('saveResultToFile: File saved successfully', {
        filename,
        filePath,
        type,
        size: uint8Array.length
      })
      return filePath
    } else if (data.startsWith('http://') || data.startsWith('https://')) {
      // URL - 下载后保存
      try {
        logger.debug('saveResultToFile: Downloading from URL', { url: data.substring(0, 100) })
        const response = await fetch(data)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        await window.api?.file?.write?.(filePath, uint8Array)
        logger.info('saveResultToFile: File downloaded and saved', {
          filename,
          filePath,
          type,
          size: uint8Array.length
        })
        return filePath
      } catch (fetchError) {
        logger.error('saveResultToFile: Failed to fetch URL for download', {
          url: data.substring(0, 100),
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          hint: '网络请求失败，请检查网络连接'
        })
        return null
      }
    } else {
      logger.warn('saveResultToFile: Unsupported data format', {
        filename,
        dataPreview: data.substring(0, 50),
        hint: '仅支持 base64 data URL 或 HTTP/HTTPS URL'
      })
      return null
    }
  } catch (error) {
    logger.error('saveResultToFile: Unexpected error', {
      filename,
      type,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return null
  }
}
