/**
 * 增强记忆系统 - 模块入口
 *
 * 提供统一的记忆管理能力：
 * - 多源存储（LibSQL + 知识图谱）
 * - 多策略检索（WaveRAG, DeepMemo, TagMemo, TimeAware）
 * - 语义组自动分类
 * - 对话信息提取
 *
 * @module memory
 */

// ==================== 类型导出 ====================
export * from './types'

// ==================== 核心服务 ====================
export { unifiedMemory, UnifiedMemoryService } from './core/UnifiedMemoryService'

// ==================== 存储服务 ====================
export type { BatchOperationResult, SQLiteStoreConfig } from './storage/SQLiteStore'
export { createSQLiteStore, SQLiteStore } from './storage/SQLiteStore'
export type {
  ClusterResult,
  SimilarityAlgorithm,
  VectorIndexConfig,
  VectorSearchOptions,
  VectorSpaceStats
} from './storage/VectorIndexService'
export { createVectorIndex, VectorIndexService } from './storage/VectorIndexService'

// ==================== 检索服务 ====================
export { DeepMemoRetriever } from './retrieval/DeepMemoRetriever'
export { BUILTIN_SEMANTIC_GROUPS, GROUP_RELATIONS, SemanticGroupRetriever } from './retrieval/SemanticGroupRetriever'

// ==================== 网关服务 ====================
// TODO: 这些模块待实现
// export { getMemoryGateway, MemoryGateway, rrfFuse } from './gateway/MemoryGateway'
// export type { GatewaySearchOptions, GatewaySearchResult, GatewayStats, MemoryBackendType, SearchStrategy } from './gateway/MemoryGateway'
// export { MemoryIpcChannels, registerMemoryGatewayIpcHandlers } from './gateway/MemoryGatewayIpcHandler'

// ==================== VCP 适配器 ====================
// TODO: VCP 适配器待实现
// export { getVCPMemoryAdapter, VCP_MEMORY_TOOLS, VCPMemoryAdapter } from './adapters/VCPMemoryAdapter'
// export type { VCPMemoryItem, VCPSearchParams, VCPToolResult } from './adapters/VCPMemoryAdapter'

// ==================== 工具函数 ====================
export * from './utils'

// ==================== 便捷方法 ====================
import { unifiedMemory } from './core/UnifiedMemoryService'

/**
 * 添加记忆
 */
export const addMemory = unifiedMemory.add.bind(unifiedMemory)

/**
 * 检索记忆
 */
export const retrieveMemory = unifiedMemory.retrieve.bind(unifiedMemory)

/**
 * 获取相关上下文
 */
export const getRelevantContext = unifiedMemory.getRelevantContext.bind(unifiedMemory)

/**
 * 从对话中提取记忆
 */
export const extractFromConversation = unifiedMemory.extractFromConversation.bind(unifiedMemory)

/**
 * 按语义组搜索
 */
export const searchBySemanticGroup = unifiedMemory.searchBySemanticGroup.bind(unifiedMemory)

// ==================== 默认导出 ====================
export default unifiedMemory
