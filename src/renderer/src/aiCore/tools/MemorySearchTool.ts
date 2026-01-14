import { getProviderByModel } from '@renderer/services/AssistantService'
import store from '@renderer/store'
import { selectCurrentUserId, selectGlobalMemoryEnabled, selectMemoryConfig } from '@renderer/store/memory'
import { type InferToolInput, type InferToolOutput, tool } from 'ai'
import * as z from 'zod'

import { MemoryProcessor } from '../../services/MemoryProcessor'

/**
 * 配置开关：是否使用 VCP 统一记忆层
 * 当为 true 时，搜索通过 VCPMemoryAdapter (Main process) 执行
 * 当为 false 时，搜索通过 MemoryProcessor (Renderer process) 执行
 *
 * @see Phase 1 of VCP 统一重构计划
 */
const USE_VCP_UNIFIED_PATH = true // 启用 VCP 统一路径

/**
 * 🧠 基础记忆搜索工具
 * AI 可以主动调用的简单记忆搜索
 */
export const memorySearchTool = () => {
  return tool({
    name: 'builtin_memory_search',
    description: 'Search through conversation memories and stored facts for relevant context',
    inputSchema: z.object({
      query: z.string().describe('Search query to find relevant memories'),
      limit: z.number().min(1).max(20).default(5).describe('Maximum number of memories to return')
    }),
    execute: async ({ query, limit = 5 }) => {
      const globalMemoryEnabled = selectGlobalMemoryEnabled(store.getState())
      if (!globalMemoryEnabled) {
        return []
      }

      const memoryConfig = selectMemoryConfig(store.getState())

      if (!memoryConfig.llmModel || !memoryConfig.embeddingModel) {
        return []
      }

      // ========== VCP 统一路径 ==========
      // 通过 VCPMemoryAdapter (Main process) 执行搜索
      // 这是 Phase 1 VCP 统一重构的核心改动
      if (USE_VCP_UNIFIED_PATH) {
        try {
          // 获取 embedding 配置
          let embeddingConfig: {
            providerId: string
            modelId: string
            apiKey?: string
            baseUrl?: string
          } | undefined

          if (memoryConfig.embeddingModel) {
            const embeddingProvider = getProviderByModel(memoryConfig.embeddingModel)
            embeddingConfig = {
              providerId: embeddingProvider.id,
              modelId: memoryConfig.embeddingModel.id,
              apiKey: embeddingProvider.apiKey,
              baseUrl: embeddingProvider.apiHost
            }
          }

          // 使用 VCP 统一记忆层进行搜索
          // IntegratedMemoryCoordinator 会自动应用:
          // - SelfLearning 学习权重
          // - TagBoost 标签增强
          // - RRF 多源融合
          const result = await window.api.vcpMemory.intelligentSearch({
            query,
            k: limit,
            backends: ['diary', 'memory', 'lightmemo', 'deepmemo'], // 搜索记忆+日记后端
            enableLearning: true,
            embeddingConfig
          })

          if (!result.success || !result.data) {
            console.warn('[MemorySearchTool] VCP search failed, falling back to legacy path', result.error)
            // 回退到旧路径
          } else {
            // 转换 VCP 结果格式
            return result.data.map((r) => ({
              id: r.id,
              content: r.content,
              score: r.score,
              backend: r.backend,
              createdAt: r.createdAt,
              metadata: r.metadata
            }))
          }
        } catch (error) {
          console.error('[MemorySearchTool] VCP unified path error:', error)
          // 回退到旧路径
        }
      }

      // ========== Legacy 路径 ==========
      // 直接通过 MemoryProcessor (Renderer process) 执行搜索

      const currentUserId = selectCurrentUserId(store.getState())
      const processorConfig = MemoryProcessor.getProcessorConfig(memoryConfig, 'default', currentUserId)

      const memoryProcessor = new MemoryProcessor()
      const relevantMemories = await memoryProcessor.searchRelevantMemories(query, processorConfig, limit)

      if (relevantMemories?.length > 0) {
        return relevantMemories
      }
      return []
    }
  })
}

export type MemorySearchToolInput = InferToolInput<ReturnType<typeof memorySearchTool>>
export type MemorySearchToolOutput = InferToolOutput<ReturnType<typeof memorySearchTool>>
