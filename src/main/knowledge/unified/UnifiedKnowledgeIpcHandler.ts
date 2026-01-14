/**
 * 统一知识库 IPC 处理器
 *
 * 注册统一知识库搜索、检索规划、RRF 融合的 IPC 通道
 */

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import { weightedRRFFuse, type WeightedSource } from '../../memory/utils/RRFUtils'
import { safeHandle } from '../../services/ipc/IpcHandlerFactory'
import { createRetrievalPlanner, getRetrievalPlanner } from './RetrievalPlanner'
import type { RRFFusionConfig, RRFFusionInput, UnifiedSearchOptions, UnifiedSearchResult } from './types'
import { getUnifiedKnowledgeService } from './UnifiedKnowledgeService'

const logger = loggerService.withContext('UnifiedKnowledgeIpcHandler')

/**
 * 注册统一知识库 IPC 处理器
 */
export function registerUnifiedKnowledgeIpcHandlers(): void {
  logger.info('Registering Unified Knowledge IPC handlers...')

  // ==================== Unified Search ====================

  ipcMain.handle(
    IpcChannel.Knowledge_Unified_Search,
    async (_, args: { query: string; options?: UnifiedSearchOptions }) => {
      return safeHandle('Knowledge_Unified_Search', async () => {
        const service = getUnifiedKnowledgeService()
        return service.search(args.query, args.options)
      })
    }
  )

  ipcMain.handle(IpcChannel.Knowledge_Unified_GetBackends, async () => {
    return safeHandle('Knowledge_Unified_GetBackends', async () => {
      const service = getUnifiedKnowledgeService()
      return service.getAvailableBackends()
    })
  })

  ipcMain.handle(IpcChannel.Knowledge_Unified_GetStats, async () => {
    return safeHandle('Knowledge_Unified_GetStats', async () => {
      const service = getUnifiedKnowledgeService()
      return service.getAllStats()
    })
  })

  ipcMain.handle(IpcChannel.Knowledge_Unified_Initialize, async () => {
    return safeHandle('Knowledge_Unified_Initialize', async () => {
      const service = getUnifiedKnowledgeService()
      await service.initialize()
      return { success: true }
    })
  })

  // ==================== Retrieval Planning ====================

  ipcMain.handle(
    IpcChannel.Knowledge_Unified_Plan,
    async (_, args: { query: string; options?: UnifiedSearchOptions }) => {
      return safeHandle('Knowledge_Unified_Plan', async () => {
        const planner = getRetrievalPlanner()
        return planner.plan(args.query, args.options)
      })
    }
  )

  ipcMain.handle(IpcChannel.Knowledge_Unified_AnalyzeQuery, async (_, args: { query: string }) => {
    return safeHandle('Knowledge_Unified_AnalyzeQuery', async () => {
      const planner = createRetrievalPlanner()
      return planner.analyzeQuery(args.query)
    })
  })

  // ==================== TagMemo Enhancement ====================

  ipcMain.handle(
    IpcChannel.Knowledge_TagMemo_Boost,
    async (_, args: { query: string; tags: string[]; results: any[] }) => {
      return safeHandle('Knowledge_TagMemo_Boost', async () => {
        const service = getUnifiedKnowledgeService()
        const tagMemo = service.getTagMemoService()
        if (!tagMemo) {
          return args.results // TagMemo 未启用，直接返回原结果
        }
        return tagMemo.applyTagBoost(args.query, args.tags, args.results)
      })
    }
  )

  ipcMain.handle(IpcChannel.Knowledge_TagMemo_GetRelatedTags, async (_, args: { tag: string; limit?: number }) => {
    return safeHandle('Knowledge_TagMemo_GetRelatedTags', async () => {
      const service = getUnifiedKnowledgeService()
      const tagMemo = service.getTagMemoService()
      if (!tagMemo) {
        return []
      }
      // 使用 CooccurrenceMatrix 的 getRelatedTags 方法
      const matrix = tagMemo.getCooccurrenceMatrix()
      return matrix.getRelatedTags(args.tag, args.limit ?? 10)
    })
  })

  // ==================== RRF Fusion ====================

  ipcMain.handle(
    IpcChannel.Knowledge_RRF_Merge,
    async (_, args: { inputs: RRFFusionInput[]; topK?: number; config?: RRFFusionConfig }) => {
      return safeHandle('Knowledge_RRF_Merge', async () => {
        // 转换为 WeightedSource 格式
        const weightedSources: WeightedSource<UnifiedSearchResult>[] = args.inputs.map((input) => ({
          name: input.source,
          results: input.results,
          weight: args.config?.sourceWeights?.[input.source] ?? 1.0
        }))
        // 使用规范的 weightedRRFFuse 函数
        return weightedRRFFuse(weightedSources, {
          k: args.config?.k ?? 60,
          maxResults: args.topK,
          deduplicate: args.config?.deduplicate ?? true,
          deduplicateBy: args.config?.deduplicateField === 'uniqueId' ? 'id' : 'content'
        })
      })
    }
  )

  ipcMain.handle(IpcChannel.Knowledge_RRF_UpdateConfig, async (_, args: { config: Partial<RRFFusionConfig> }) => {
    return safeHandle('Knowledge_RRF_UpdateConfig', async () => {
      const service = getUnifiedKnowledgeService()
      service.updateRRFConfig(args.config)
      return { success: true }
    })
  })

  logger.info('Unified Knowledge IPC handlers registered successfully')
}
