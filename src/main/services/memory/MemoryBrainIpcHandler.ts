/**
 * MemoryBrainIpcHandler - MemoryBrain IPC 处理器
 *
 * 提供渲染进程访问 MemoryBrain 的 IPC 接口
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import {
  getMemoryBrain,
  type MemoryBrainConfig,
  type SearchTaskParams
} from './MemoryBrain'
import type { RerankModelConfig } from '../native/NeuralRerankService'
import type { CreateMemoryParams, MemoryBackendType } from './IntegratedMemoryCoordinator'
import { safeHandle } from '../ipc'

const logger = loggerService.withContext('MemoryBrainIpcHandler')

/**
 * 注册 MemoryBrain IPC handlers
 */
export function registerMemoryBrainIpcHandlers(): void {
  logger.info('Registering MemoryBrain IPC handlers...')

  const brain = getMemoryBrain()

  // ==================== 搜索 ====================

  ipcMain.handle(
    IpcChannel.MemoryBrain_Search,
    async (_event, params: { query: string; options?: SearchTaskParams }) => {
      return safeHandle('memory-brain:search', async () => {
        const result = await brain.search(params.query, params.options)
        return { success: true, ...result }
      })
    }
  )

  ipcMain.handle(
    IpcChannel.MemoryBrain_QuickSearch,
    async (
      _event,
      params: { query: string; options?: { backends?: MemoryBackendType[]; topK?: number } }
    ) => {
      return safeHandle('memory-brain:quick-search', async () => {
        const results = await brain.quickSearch(params.query, params.options)
        return { success: true, results, count: results.length }
      })
    }
  )

  ipcMain.handle(
    IpcChannel.MemoryBrain_DeepSearch,
    async (
      _event,
      params: {
        query: string
        options?: {
          backends?: MemoryBackendType[]
          topK?: number
          modelId?: string
          providerId?: string
        }
      }
    ) => {
      return safeHandle('memory-brain:deep-search', async () => {
        const result = await brain.deepSearch(params.query, params.options)
        return { success: true, ...result }
      })
    }
  )

  ipcMain.handle(
    IpcChannel.MemoryBrain_WaveRAGSearch,
    async (
      _event,
      params: {
        query: string
        options?: {
          backends?: MemoryBackendType[]
          topK?: number
          expansionDepth?: number
          focusScoreThreshold?: number
        }
      }
    ) => {
      return safeHandle('memory-brain:waverag-search', async () => {
        const result = await brain.waveRAGSearch(params.query, params.options)
        return { success: true, ...result }
      })
    }
  )

  // ==================== 创建 ====================

  ipcMain.handle(
    IpcChannel.MemoryBrain_CreateMemory,
    async (_event, params: CreateMemoryParams) => {
      return safeHandle('memory-brain:create-memory', async () => {
        const entry = await brain.createMemory(params)
        return { success: true, entry }
      })
    }
  )

  // ==================== 状态和配置 ====================

  ipcMain.handle(IpcChannel.MemoryBrain_GetStatus, async () => {
    return safeHandle('memory-brain:get-status', async () => {
      const status = await brain.getStatus()
      return { success: true, ...status }
    })
  })

  ipcMain.handle(IpcChannel.MemoryBrain_GetConfig, async () => {
    return safeHandle('memory-brain:get-config', async () => {
      const config = brain.getConfig()
      return { success: true, config }
    })
  })

  ipcMain.handle(
    IpcChannel.MemoryBrain_UpdateConfig,
    async (_event, params: { config: Partial<MemoryBrainConfig> }) => {
      return safeHandle('memory-brain:update-config', async () => {
        brain.updateConfig(params.config)
        return { success: true }
      })
    }
  )

  ipcMain.handle(
    IpcChannel.MemoryBrain_ConfigureNeuralRerank,
    async (_event, params: { model: RerankModelConfig }) => {
      return safeHandle('memory-brain:configure-neural-rerank', async () => {
        brain.configureNeuralRerank(params.model)
        return { success: true }
      })
    }
  )

  // ==================== 反馈 ====================

  ipcMain.handle(
    IpcChannel.MemoryBrain_RecordPositiveFeedback,
    async (_event, params: { searchId: string; selectedResultId: string; query: string }) => {
      return safeHandle('memory-brain:record-positive-feedback', async () => {
        await brain.recordPositiveFeedback(params.searchId, params.selectedResultId, params.query)
        return { success: true }
      })
    }
  )

  ipcMain.handle(
    IpcChannel.MemoryBrain_RecordNegativeFeedback,
    async (_event, params: { searchId: string; ignoredResultId: string; query: string }) => {
      return safeHandle('memory-brain:record-negative-feedback', async () => {
        await brain.recordNegativeFeedback(params.searchId, params.ignoredResultId, params.query)
        return { success: true }
      })
    }
  )

  // ==================== 追踪 ====================

  ipcMain.handle(IpcChannel.MemoryBrain_GetTraceStats, async () => {
    return safeHandle('memory-brain:get-trace-stats', async () => {
      const stats = brain.getTraceStats()
      return { success: true, stats }
    })
  })

  ipcMain.handle(
    IpcChannel.MemoryBrain_GetTraceRecords,
    async (_event, params?: { limit?: number }) => {
      return safeHandle('memory-brain:get-trace-records', async () => {
        const records = brain.getTraceRecords(params?.limit)
        return { success: true, records, count: records.length }
      })
    }
  )

  ipcMain.handle(IpcChannel.MemoryBrain_GetCallGraph, async () => {
    return safeHandle('memory-brain:get-call-graph', async () => {
      const graph = brain.getCallGraph()
      return { success: true, graph }
    })
  })

  ipcMain.handle(IpcChannel.MemoryBrain_GetVectorStorageInfo, async () => {
    return safeHandle('memory-brain:get-vector-storage-info', async () => {
      const info = brain.getVectorStorageInfo()
      return { success: true, info }
    })
  })

  logger.info('MemoryBrain IPC handlers registered')
}
