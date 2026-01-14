/**
 * IntegratedMemoryIpcHandler - 统一记忆协调器 IPC 处理器
 *
 * 提供渲染进程访问 IntegratedMemoryCoordinator 的 IPC 接口
 *
 * @deprecated 此模块已弃用，请使用新的 MemoryGateway 系统。
 *
 * 迁移指南:
 * - 旧: IpcChannel.IntegratedMemory_Create
 * - 新: MemoryIpcChannels.Add (via @main/memory/gateway/MemoryGatewayIpcHandler)
 *
 * - 旧: IpcChannel.IntegratedMemory_IntelligentSearch
 * - 新: MemoryIpcChannels.DeepSearch
 *
 * - 旧: IpcChannel.IntegratedMemory_RecordPositiveFeedback
 * - 新: MemoryIpcChannels.RecordFeedback
 *
 * 新系统提供:
 * - 统一的 CRUD 接口
 * - RRF 融合检索
 * - 语义组分类
 *
 * @see src/main/memory/gateway/MemoryGateway.ts
 * @see src/main/memory/gateway/MemoryGatewayIpcHandler.ts
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import {
  type CreateMemoryParams,
  getIntegratedMemoryCoordinator,
  type IntegratedMemoryConfig,
  type IntelligentSearchOptions,
  type OrganizeOptions
} from './IntegratedMemoryCoordinator'
import { safeHandle } from '../ipc'

const logger = loggerService.withContext('IntegratedMemoryIpcHandler')

/**
 * 延迟获取 coordinator 实例
 * 在每次调用时获取，而不是注册时获取，确保 handlers 能被注册
 */
function getCoordinator() {
  return getIntegratedMemoryCoordinator()
}

/**
 * 安全注册 IPC 处理器
 * 如果处理器已存在，先移除再注册
 */
function safeRegisterHandler(channel: string, handler: Parameters<typeof ipcMain.handle>[1]) {
  try {
    // 先尝试移除可能存在的旧处理器
    try {
      ipcMain.removeHandler(channel)
    } catch {
      // 忽略 - 处理器可能不存在
    }
    ipcMain.handle(channel, handler)
    logger.debug(`Handler registered: ${channel}`)
  } catch (error) {
    logger.error(`Failed to register handler: ${channel}`, {
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * 注册 Integrated Memory IPC handlers
 */
export function registerIntegratedMemoryIpcHandlers(): void {
  logger.info('Registering Integrated Memory IPC handlers...')

  let registeredCount = 0
  const errors: string[] = []

  // ==================== 创建 ====================

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_Create, async (_event, params: CreateMemoryParams) => {
      return safeHandle('integrated-memory:create', async () => {
        const coordinator = getCoordinator()
        const entry = await coordinator.createMemory(params)
        return { success: true, entry }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_Create: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_BatchCreate,
      async (
        _event,
        params: {
          entries: Array<{ content: string; title?: string; tags?: string[] }>
          options?: { autoTag?: boolean; backend?: 'diary' | 'memory' | 'notes'; modelId?: string; providerId?: string }
        }
      ) => {
        return safeHandle('integrated-memory:batch-create', async () => {
          const coordinator = getCoordinator()
          const entries = await coordinator.batchCreateMemories(params.entries, params.options)
          return { success: true, entries, count: entries.length }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_BatchCreate: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ==================== 搜索 ====================

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_IntelligentSearch,
      async (_event, params: { query: string; options?: IntelligentSearchOptions }) => {
        return safeHandle('integrated-memory:intelligent-search', async () => {
          const coordinator = getCoordinator()
          const results = await coordinator.intelligentSearch(params.query, params.options)
          return { success: true, results, count: results.length }
        })
      }
    )
    registeredCount++
    logger.info('IntegratedMemory_IntelligentSearch handler registered successfully')
  } catch (e) {
    errors.push(`IntegratedMemory_IntelligentSearch: ${e instanceof Error ? e.message : String(e)}`)
    logger.error('Failed to register IntegratedMemory_IntelligentSearch handler', {
      error: e instanceof Error ? e.message : String(e)
    })
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_GetSuggestions,
      async (_event, params: { partialQuery: string; limit?: number }) => {
        return safeHandle('integrated-memory:get-suggestions', async () => {
          const coordinator = getCoordinator()
          const suggestions = await coordinator.getSearchSuggestions(params.partialQuery, params.limit)
          return { success: true, suggestions }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_GetSuggestions: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ==================== 反馈 ====================

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_RecordPositiveFeedback,
      async (_event, params: { searchId: string; selectedResultId: string; query: string }) => {
        return safeHandle('integrated-memory:record-positive-feedback', async () => {
          const coordinator = getCoordinator()
          await coordinator.recordPositiveFeedback(params.searchId, params.selectedResultId, params.query)
          return { success: true }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_RecordPositiveFeedback: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_RecordNegativeFeedback,
      async (_event, params: { searchId: string; ignoredResultId: string; query: string }) => {
        return safeHandle('integrated-memory:record-negative-feedback', async () => {
          const coordinator = getCoordinator()
          await coordinator.recordNegativeFeedback(params.searchId, params.ignoredResultId, params.query)
          return { success: true }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_RecordNegativeFeedback: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ==================== 整理 ====================

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_Organize, async (_event, options: OrganizeOptions) => {
      return safeHandle('integrated-memory:organize', async () => {
        const coordinator = getCoordinator()
        const result = await coordinator.organizeMemories(options)
        return { success: true, result }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_Organize: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_DiscoverAssociations, async () => {
      return safeHandle('integrated-memory:discover-associations', async () => {
        const coordinator = getCoordinator()
        const result = await coordinator.discoverAndApplyAssociations()
        return { success: true, ...result }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_DiscoverAssociations: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ==================== 统计 ====================

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_GetStats, async () => {
      return safeHandle('integrated-memory:get-stats', async () => {
        const coordinator = getCoordinator()
        const stats = await coordinator.getIntegratedStats()
        return { success: true, stats }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_GetStats: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_GetLearningProgress, async () => {
      return safeHandle('integrated-memory:get-learning-progress', () => {
        const coordinator = getCoordinator()
        const progress = coordinator.getLearningProgress()
        return { success: true, progress }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_GetLearningProgress: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ==================== 配置 ====================

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_GetConfig, async () => {
      return safeHandle('integrated-memory:get-config', () => {
        const coordinator = getCoordinator()
        const config = coordinator.getConfig()
        return { success: true, config }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_GetConfig: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_UpdateConfig,
      async (_event, updates: Partial<IntegratedMemoryConfig>) => {
        return safeHandle('integrated-memory:update-config', () => {
          const coordinator = getCoordinator()
          coordinator.updateConfig(updates)
          const config = coordinator.getConfig()
          return { success: true, config }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_UpdateConfig: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ==================== 新增方法 (替代废弃API) ====================

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_GetTagStats, async (_event, params: { tag: string }) => {
      return safeHandle('integrated-memory:get-tag-stats', () => {
        const coordinator = getCoordinator()
        const stats = coordinator.getTagStats(params.tag)
        return { success: true, stats }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_GetTagStats: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_ConfirmSuggestion,
      async (_event, params: { sourceTag: string; suggestedTag: string }) => {
        return safeHandle('integrated-memory:confirm-suggestion', () => {
          const coordinator = getCoordinator()
          const result = coordinator.confirmSuggestion(params.sourceTag, params.suggestedTag)
          return { success: true, confirmed: result }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_ConfirmSuggestion: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(IpcChannel.IntegratedMemory_GetPendingSuggestions, async () => {
      return safeHandle('integrated-memory:get-pending-suggestions', () => {
        const coordinator = getCoordinator()
        const suggestions = coordinator.getPendingSuggestions()
        return { success: true, suggestions }
      })
    })
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_GetPendingSuggestions: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_ClearBackend,
      async (_event, params: { backend: 'lightmemo' | 'deepmemo' | 'meshmemo' | 'diary' | 'notes' }) => {
        return safeHandle('integrated-memory:clear-backend', async () => {
          const coordinator = getCoordinator()
          await coordinator.clearBackend(params.backend)
          return { success: true }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_ClearBackend: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_AddDocument,
      async (
        _event,
        params: {
          backend: 'lightmemo' | 'deepmemo' | 'meshmemo'
          document: { id: string; content: string; embedding?: number[]; metadata?: Record<string, unknown> }
        }
      ) => {
        return safeHandle('integrated-memory-add-document', async () => {
          const coordinator = getCoordinator()
          await coordinator.addDocument(params.backend, params.document)
          return { success: true }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_AddDocument: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    safeRegisterHandler(
      IpcChannel.IntegratedMemory_GetDocumentCount,
      async (_event, params: { backend: 'lightmemo' | 'deepmemo' | 'meshmemo' }) => {
        return safeHandle('integrated-memory:get-document-count', () => {
          const coordinator = getCoordinator()
          const count = coordinator.getDocumentCount(params.backend)
          return { success: true, count }
        })
      }
    )
    registeredCount++
  } catch (e) {
    errors.push(`IntegratedMemory_GetDocumentCount: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 汇总注册结果
  if (errors.length > 0) {
    logger.error('Some Integrated Memory IPC handlers failed to register', {
      registeredCount,
      errors
    })
  } else {
    logger.info('All Integrated Memory IPC handlers registered successfully', {
      registeredCount
    })
  }
}
