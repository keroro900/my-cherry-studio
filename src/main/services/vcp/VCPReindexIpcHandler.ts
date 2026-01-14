/**
 * VCP 向量索引重建 IPC 处理器
 *
 * 提供前端触发索引重建的 IPC 端点:
 * - vcp:storage:check-dimension-mismatch - 检测维度不匹配
 * - vcp:storage:rebuild-indexes - 重建向量索引
 * - vcp:storage:get-index-stats - 获取索引统计
 * - vcp:storage:validate-index - 验证索引健康状态
 * - vcp:storage:recover-from-database - 从数据库恢复索引
 * - vcp:storage:list-diaries - 列出所有日记本
 * - vcp:storage:rebuild-diary-index - 重建日记本索引
 * - vcp:storage:rebuild-all-diary-indexes - 重建所有日记本索引
 * - vcp:storage:get-diary-stats - 获取日记本索引统计
 *
 * @module services/vcp/VCPReindexIpcHandler
 */

import { loggerService } from '@logger'
import { reduxService } from '@main/services/ReduxService'
import {
  getVectorIndexManager,
  type DiaryIndexStats,
  type DiaryRebuildResult,
  type DimensionMismatchResult,
  type RebuildResult
} from '@main/storage/VectorIndexManager'
import type { ApiClient, Provider } from '@types'
import { ipcMain, type IpcMainInvokeEvent } from 'electron'

const logger = loggerService.withContext('VCPReindexIpc')

// ==================== Provider Credentials Helper ====================

/**
 * 从 Redux store 获取 Provider 凭据
 */
async function getProviderCredentials(providerId: string): Promise<{
  apiKey: string
  apiHost: string
} | null> {
  try {
    const providers = await reduxService.select<Provider[]>('state.llm.providers')
    if (!providers || !Array.isArray(providers)) {
      logger.warn('No providers found in Redux store')
      return null
    }

    const provider = providers.find((p) => p.id === providerId)
    if (!provider) {
      logger.warn('Provider not found', { providerId })
      return null
    }

    return {
      apiKey: provider.apiKey || '',
      apiHost: provider.apiHost || ''
    }
  } catch (error) {
    logger.error('Failed to get provider credentials', { providerId, error: String(error) })
    return null
  }
}

/**
 * 构建完整的 ApiClient，自动从 Redux store 获取缺失的凭据
 */
async function buildApiClientWithCredentials(config: {
  model: string
  provider: string
  apiKey?: string
  baseURL?: string
}): Promise<ApiClient | null> {
  let apiKey = config.apiKey || ''
  let baseURL = config.baseURL || ''

  // 如果 apiKey 为空，从 Redux store 获取
  if (!apiKey || apiKey.trim() === '') {
    logger.debug('API key not provided, fetching from Redux store', { provider: config.provider })

    const credentials = await getProviderCredentials(config.provider)
    if (!credentials) {
      logger.error('Failed to get provider credentials', { provider: config.provider })
      return null
    }

    apiKey = credentials.apiKey
    if (!baseURL) {
      baseURL = credentials.apiHost
    }

    logger.debug('Got credentials from Redux store', {
      provider: config.provider,
      hasApiKey: !!apiKey,
      hasBaseURL: !!baseURL
    })
  }

  if (!apiKey || apiKey.trim() === '') {
    logger.error('API key is empty even after fetching from Redux store', { provider: config.provider })
    return null
  }

  return {
    model: config.model,
    provider: config.provider,
    apiKey: apiKey,
    baseURL: baseURL
  }
}

// ==================== 类型定义 ====================

/**
 * 重建索引参数
 */
interface RebuildIndexParams {
  /** Embedding API 配置 */
  embeddingConfig: {
    model: string
    provider: string
    apiKey: string
    baseURL: string
  }
}

/**
 * 检测维度不匹配参数
 */
interface CheckMismatchParams {
  /** Embedding API 配置 (可选) */
  embeddingConfig?: {
    model: string
    provider: string
    apiKey: string
    baseURL: string
  }
}

// ==================== IPC Handler 注册 ====================

let isRegistered = false

/**
 * 注册 VCP 索引重建 IPC 处理器
 */
export function registerVCPReindexIpcHandlers(): void {
  if (isRegistered) {
    logger.debug('VCP Reindex IPC handlers already registered')
    return
  }

  logger.info('Registering VCP Reindex IPC handlers')

  // 检测维度不匹配
  ipcMain.handle(
    'vcp:storage:check-dimension-mismatch',
    async (_event: IpcMainInvokeEvent, params?: CheckMismatchParams): Promise<DimensionMismatchResult> => {
      logger.debug('Checking dimension mismatch', { hasConfig: !!params?.embeddingConfig })

      try {
        const manager = getVectorIndexManager()

        let embedApiClient: ApiClient | undefined
        if (params?.embeddingConfig) {
          // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
          embedApiClient = await buildApiClientWithCredentials(params.embeddingConfig) || undefined
        }

        return await manager.detectDimensionMismatch(embedApiClient)
      } catch (error) {
        logger.error('Failed to check dimension mismatch', error as Error)
        return {
          hasMismatch: false,
          indexDimension: 0,
          configDimension: 0,
          details: `检测失败: ${(error as Error).message}`
        }
      }
    }
  )

  // 重建向量索引
  ipcMain.handle(
    'vcp:storage:rebuild-indexes',
    async (_event: IpcMainInvokeEvent, params: RebuildIndexParams): Promise<RebuildResult> => {
      // 详细日志：记录传入的参数
      logger.info('Starting vector index rebuild', {
        model: params.embeddingConfig.model,
        provider: params.embeddingConfig.provider,
        hasApiKey: !!params.embeddingConfig.apiKey,
        apiKeyLength: params.embeddingConfig.apiKey?.length || 0,
        apiKeyPreview: params.embeddingConfig.apiKey ? params.embeddingConfig.apiKey.substring(0, 10) + '...' : '(empty)',
        hasBaseURL: !!params.embeddingConfig.baseURL,
        baseURL: params.embeddingConfig.baseURL || '(empty)'
      })

      try {
        const manager = getVectorIndexManager()

        // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
        const embedApiClient = await buildApiClientWithCredentials(params.embeddingConfig)
        if (!embedApiClient) {
          logger.error('Failed to build embedApiClient', {
            provider: params.embeddingConfig.provider
          })
          return {
            success: false,
            rebuiltCount: 0,
            errors: [`Cannot get API credentials for provider '${params.embeddingConfig.provider}'. Please check your provider configuration.`],
            durationMs: 0,
            newDimensions: 0
          }
        }

        logger.info('Built embedApiClient successfully', {
          provider: embedApiClient.provider,
          model: embedApiClient.model,
          hasApiKey: !!embedApiClient.apiKey,
          apiKeyLength: embedApiClient.apiKey?.length || 0,
          apiKeyPreview: embedApiClient.apiKey ? embedApiClient.apiKey.substring(0, 10) + '...' : '(empty)'
        })

        // 执行重建 (带进度日志)
        const result = await manager.rebuildAllIndexes(embedApiClient, (progress) => {
          logger.debug('Rebuild progress', progress)
          // TODO: 可以通过 webContents.send() 发送进度到前端
        })

        return result
      } catch (error) {
        logger.error('Failed to rebuild indexes', error as Error)
        return {
          success: false,
          rebuiltCount: 0,
          errors: [(error as Error).message],
          durationMs: 0,
          newDimensions: 0
        }
      }
    }
  )

  // 获取索引统计
  ipcMain.handle(
    'vcp:storage:get-index-stats',
    async (): Promise<{
      totalVectors: number
      dimensions: number
      isNative: boolean
    }> => {
      logger.debug('Getting index stats')

      try {
        const manager = getVectorIndexManager()
        return await manager.getIndexStats()
      } catch (error) {
        logger.error('Failed to get index stats', error as Error)
        return {
          totalVectors: 0,
          dimensions: 0,
          isNative: false
        }
      }
    }
  )

  // 验证索引健康状态
  ipcMain.handle(
    'vcp:storage:validate-index',
    async (): Promise<{
      isHealthy: boolean
      issues: string[]
    }> => {
      logger.debug('Validating index health')

      try {
        const manager = getVectorIndexManager()
        return await manager.validateIndexHealth()
      } catch (error) {
        logger.error('Failed to validate index', error as Error)
        return {
          isHealthy: false,
          issues: [(error as Error).message]
        }
      }
    }
  )

  // 从数据库恢复索引
  ipcMain.handle(
    'vcp:storage:recover-from-database',
    async (
      _event: IpcMainInvokeEvent,
      params?: { tableType?: 'chunks' | 'tags'; filterDiaryName?: string }
    ): Promise<{ success: boolean; recoveredCount: number; error?: string }> => {
      logger.info('Recovering index from database', params)

      try {
        const manager = getVectorIndexManager()
        const recoveredCount = await manager.recoverFromDatabase(
          params?.tableType || 'chunks',
          params?.filterDiaryName
        )

        return {
          success: true,
          recoveredCount
        }
      } catch (error) {
        logger.error('Failed to recover from database', error as Error)
        return {
          success: false,
          recoveredCount: 0,
          error: (error as Error).message
        }
      }
    }
  )

  // ==================== 日记本索引 IPC 处理器 ====================

  // 列出所有日记本
  ipcMain.handle('vcp:storage:list-diaries', async (): Promise<string[]> => {
    logger.debug('Listing diary names')

    try {
      const manager = getVectorIndexManager()
      return await manager.listDiaryNames()
    } catch (error) {
      logger.error('Failed to list diaries', error as Error)
      return []
    }
  })

  // 获取日记本索引统计
  ipcMain.handle(
    'vcp:storage:get-diary-stats',
    async (
      _event: IpcMainInvokeEvent,
      params?: { dimensions?: number }
    ): Promise<DiaryIndexStats[]> => {
      logger.debug('Getting diary index stats')

      try {
        const manager = getVectorIndexManager()
        return await manager.getDiaryIndexStats(params?.dimensions || 1536)
      } catch (error) {
        logger.error('Failed to get diary stats', error as Error)
        return []
      }
    }
  )

  // 重建单个日记本索引
  ipcMain.handle(
    'vcp:storage:rebuild-diary-index',
    async (
      _event: IpcMainInvokeEvent,
      params: {
        diaryName: string
        embeddingConfig: {
          model: string
          provider: string
          apiKey: string
          baseURL: string
        }
      }
    ): Promise<DiaryRebuildResult> => {
      logger.info('Rebuilding diary index', { diaryName: params.diaryName })

      try {
        const manager = getVectorIndexManager()

        // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
        const embedApiClient = await buildApiClientWithCredentials(params.embeddingConfig)
        if (!embedApiClient) {
          return {
            success: false,
            diaryName: params.diaryName,
            rebuiltCount: 0,
            error: `Cannot get API credentials for provider '${params.embeddingConfig.provider}'. Please check your provider configuration.`,
            durationMs: 0
          }
        }

        return await manager.rebuildDiaryIndex(params.diaryName, embedApiClient, (progress) => {
          logger.debug('Diary rebuild progress', progress)
        })
      } catch (error) {
        logger.error('Failed to rebuild diary index', error as Error)
        return {
          success: false,
          diaryName: params.diaryName,
          rebuiltCount: 0,
          error: (error as Error).message,
          durationMs: 0
        }
      }
    }
  )

  // 重建所有日记本索引
  ipcMain.handle(
    'vcp:storage:rebuild-all-diary-indexes',
    async (
      _event: IpcMainInvokeEvent,
      params: {
        embeddingConfig: {
          model: string
          provider: string
          apiKey: string
          baseURL: string
        }
      }
    ): Promise<{
      success: boolean
      results: DiaryRebuildResult[]
      totalRebuilt: number
      durationMs: number
    }> => {
      logger.info('Rebuilding all diary indexes')

      try {
        const manager = getVectorIndexManager()

        // 使用辅助函数构建 ApiClient，自动获取缺失的凭据
        const embedApiClient = await buildApiClientWithCredentials(params.embeddingConfig)
        if (!embedApiClient) {
          return {
            success: false,
            results: [],
            totalRebuilt: 0,
            durationMs: 0
          }
        }

        return await manager.rebuildAllDiaryIndexes(embedApiClient, (progress) => {
          logger.debug('All diary rebuild progress', progress)
        })
      } catch (error) {
        logger.error('Failed to rebuild all diary indexes', error as Error)
        return {
          success: false,
          results: [],
          totalRebuilt: 0,
          durationMs: 0
        }
      }
    }
  )

  // 从 SQLite 恢复日记本索引 (Rust 原生)
  ipcMain.handle(
    'vcp:storage:recover-diary-from-sqlite',
    async (
      _event: IpcMainInvokeEvent,
      params?: { diaryName?: string }
    ): Promise<{ success: boolean; recoveredCount: number; error?: string }> => {
      logger.info('Recovering diary from SQLite', params)

      try {
        const manager = getVectorIndexManager()
        return await manager.recoverDiaryFromSqlite(params?.diaryName)
      } catch (error) {
        logger.error('Failed to recover diary from SQLite', error as Error)
        return {
          success: false,
          recoveredCount: 0,
          error: (error as Error).message
        }
      }
    }
  )

  // 搜索日记本索引
  ipcMain.handle(
    'vcp:storage:search-diary-index',
    async (
      _event: IpcMainInvokeEvent,
      params: {
        diaryName: string
        queryVector: number[]
        topK: number
        dimensions?: number
      }
    ): Promise<Array<{ id: string; score: number }>> => {
      logger.debug('Searching diary index', { diaryName: params.diaryName, topK: params.topK })

      try {
        const manager = getVectorIndexManager()
        return await manager.searchDiaryIndex(
          params.diaryName,
          params.queryVector,
          params.topK,
          params.dimensions || 1536
        )
      } catch (error) {
        logger.error('Failed to search diary index', error as Error)
        return []
      }
    }
  )

  // 跨日记本搜索
  ipcMain.handle(
    'vcp:storage:search-across-diaries',
    async (
      _event: IpcMainInvokeEvent,
      params: {
        diaryNames: string[]
        queryVector: number[]
        topK: number
        dimensions?: number
      }
    ): Promise<Array<{ id: string; score: number; diaryName: string }>> => {
      logger.debug('Searching across diaries', { diaryNames: params.diaryNames, topK: params.topK })

      try {
        const manager = getVectorIndexManager()
        return await manager.searchAcrossDiaries(
          params.diaryNames,
          params.queryVector,
          params.topK,
          params.dimensions || 1536
        )
      } catch (error) {
        logger.error('Failed to search across diaries', error as Error)
        return []
      }
    }
  )

  // 彻底清理所有索引 (危险操作！)
  ipcMain.handle(
    'vcp:storage:purge-all',
    async (
      _event: IpcMainInvokeEvent,
      params?: { deleteDatabase?: boolean; deleteChunks?: boolean }
    ): Promise<{
      success: boolean
      deletedIndexFiles: number
      clearedEmbeddings: number
      deletedChunks: number
      error?: string
    }> => {
      logger.warn('PURGE ALL requested', params)

      try {
        const manager = getVectorIndexManager()
        return await manager.purgeAll(params)
      } catch (error) {
        logger.error('Failed to purge all', error as Error)
        return {
          success: false,
          deletedIndexFiles: 0,
          clearedEmbeddings: 0,
          deletedChunks: 0,
          error: (error as Error).message
        }
      }
    }
  )

  isRegistered = true
  logger.info('VCP Reindex IPC handlers registered successfully')
}

/**
 * 注销 VCP 索引重建 IPC 处理器
 */
export function unregisterVCPReindexIpcHandlers(): void {
  if (!isRegistered) {
    return
  }

  // 基础索引操作
  ipcMain.removeHandler('vcp:storage:check-dimension-mismatch')
  ipcMain.removeHandler('vcp:storage:rebuild-indexes')
  ipcMain.removeHandler('vcp:storage:get-index-stats')
  ipcMain.removeHandler('vcp:storage:validate-index')
  ipcMain.removeHandler('vcp:storage:recover-from-database')

  // 日记本索引操作
  ipcMain.removeHandler('vcp:storage:list-diaries')
  ipcMain.removeHandler('vcp:storage:get-diary-stats')
  ipcMain.removeHandler('vcp:storage:rebuild-diary-index')
  ipcMain.removeHandler('vcp:storage:rebuild-all-diary-indexes')
  ipcMain.removeHandler('vcp:storage:recover-diary-from-sqlite')
  ipcMain.removeHandler('vcp:storage:search-diary-index')
  ipcMain.removeHandler('vcp:storage:search-across-diaries')
  ipcMain.removeHandler('vcp:storage:purge-all')

  isRegistered = false
  logger.info('VCP Reindex IPC handlers unregistered')
}

export default {
  register: registerVCPReindexIpcHandlers,
  unregister: unregisterVCPReindexIpcHandlers
}
