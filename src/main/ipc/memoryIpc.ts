/**
 * Memory IPC Handlers
 * 记忆相关的 IPC 处理器
 *
 * 包含: 记忆添加/搜索/删除、用户管理、TagMemo 测试等
 */

import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import { loggerService } from '@logger'
import { getTagMemoService } from '../knowledge/tagmemo'
import {
  isCooccurrenceMatrixAvailable,
  isSemanticGroupMatcherAvailable,
  isVexusNativeAvailable
} from '../knowledge/vector/VexusAdapter'
import MemoryService from '../services/memory/MemoryService'

const logger = loggerService.withContext('MemoryIpc')

export function registerMemoryIpcHandlers() {
  const memoryService = MemoryService.getInstance()

  // Basic memory operations
  ipcMain.handle(IpcChannel.Memory_Add, (_, messages, config) => memoryService.add(messages, config))
  ipcMain.handle(IpcChannel.Memory_Search, (_, query, config) => memoryService.search(query, config))
  ipcMain.handle(IpcChannel.Memory_List, (_, config) => memoryService.list(config))
  ipcMain.handle(IpcChannel.Memory_Delete, (_, id) => memoryService.delete(id))
  ipcMain.handle(IpcChannel.Memory_Update, (_, id, memory, metadata) => memoryService.update(id, memory, metadata))
  ipcMain.handle(IpcChannel.Memory_Get, (_, memoryId) => memoryService.get(memoryId))
  ipcMain.handle(IpcChannel.Memory_SetConfig, (_, config) => memoryService.setConfig(config))

  // User management
  ipcMain.handle(IpcChannel.Memory_DeleteUser, (_, userId) => memoryService.deleteUser(userId))
  ipcMain.handle(IpcChannel.Memory_DeleteAllMemoriesForUser, (_, userId) =>
    memoryService.deleteAllMemoriesForUser(userId)
  )
  ipcMain.handle(IpcChannel.Memory_GetUsersList, () => memoryService.getUsersList())
  ipcMain.handle(IpcChannel.Memory_MigrateMemoryDb, () => memoryService.migrateMemoryDb())

  // VCP Agent Memory Isolation (角色记忆隔离)
  ipcMain.handle(IpcChannel.Memory_DeleteAllMemoriesForAgent, (_, agentId, userId) =>
    memoryService.deleteAllMemoriesForAgent(agentId, userId)
  )
  ipcMain.handle(IpcChannel.Memory_GetAgentsList, (_, userId) =>
    memoryService.getAgentsList(userId)
  )
  ipcMain.handle(IpcChannel.Memory_SearchAllAgents, (_, query, options) =>
    memoryService.searchAllAgents(query, options)
  )

  // Memory Test & Stats
  ipcMain.handle(IpcChannel.Memory_TestFeatures, async () => {
    const tagMemoService = getTagMemoService()
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      features: {}
    }

    // 1. Test Vexus vector index
    results.features.vexusIndex = {
      available: isVexusNativeAvailable(),
      description: 'Rust 原生向量索引 (HNSW)'
    }

    // 2. Test co-occurrence matrix
    results.features.cooccurrenceMatrix = {
      available: isCooccurrenceMatrixAvailable(),
      description: 'PMI 标签共现矩阵'
    }

    // 3. Test semantic group matcher
    results.features.semanticGroupMatcher = {
      available: isSemanticGroupMatcherAvailable(),
      description: '语义关键词组匹配'
    }

    // 4. Test TagMemo service
    const tagMemoStats = tagMemoService.getStats()
    results.features.tagMemo = {
      available: true,
      mode: tagMemoStats.mode,
      useNative: tagMemoService.isNativeMode(),
      description: '三阶段检索增强 (Lens → Expansion → Focus)'
    }

    // 5. Run simple test
    try {
      const testDocs = [
        { id: 'test1', tags: ['红色', '连衣裙', '夏季'] },
        { id: 'test2', tags: ['蓝色', '连衣裙', '春季'] },
        { id: 'test3', tags: ['红色', '外套', '秋季'] },
        { id: 'test4', tags: ['红色', '裙子', '夏季'] }
      ]

      await tagMemoService.initialize(testDocs)

      const extractedTags = tagMemoService.extractTagsFromQuery('红色连衣裙')
      results.testResults = {
        initialized: true,
        extractedTags,
        tagCount: tagMemoService.getStats().tagCount
      }
    } catch (error) {
      results.testResults = {
        initialized: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return results
  })

  ipcMain.handle(IpcChannel.Memory_GetStats, () => {
    const tagMemoService = getTagMemoService()
    return {
      tagMemo: tagMemoService.getStats(),
      nativeModules: {
        vexusIndex: isVexusNativeAvailable(),
        cooccurrenceMatrix: isCooccurrenceMatrixAvailable(),
        semanticGroupMatcher: isSemanticGroupMatcherAvailable()
      }
    }
  })

  logger.info('Memory IPC handlers registered successfully')
}
