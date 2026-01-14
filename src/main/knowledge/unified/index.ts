/**
 * 统一知识库模块
 *
 * 提供跨多个数据源的统一搜索能力
 */

// 核心服务
export {
  UnifiedKnowledgeService,
  getUnifiedKnowledgeService,
  createUnifiedKnowledgeService,
  resetUnifiedKnowledgeService
} from './UnifiedKnowledgeService'

// 统一向量数据库 (embedjs 适配器)
export {
  UnifiedVectorDatabase,
  createUnifiedVectorDatabase
} from './UnifiedVectorDatabase'

// RRF 融合 - 已迁移到规范位置
// @deprecated 请从 '@main/memory/utils/RRFUtils' 导入
// 保留类型导出以保持向后兼容
export type { RRFFusionConfig, RRFFusionInput } from './types'

// 从规范位置重新导出 RRF 函数
export {
  weightedRRFFuse,
  rrfFuse,
  hybridFuse,
  calculateRRFScore,
  groupResultsBySource
} from '../../memory/utils/RRFUtils'

// 检索规划
export {
  RetrievalPlanner,
  getRetrievalPlanner,
  createRetrievalPlanner
} from './RetrievalPlanner'

// IPC 处理器
export { registerUnifiedKnowledgeIpcHandlers } from './UnifiedKnowledgeIpcHandler'

// 类型
export type {
  // 搜索相关
  UnifiedSearchOptions,
  UnifiedSearchResult,
  UnifiedResultMetadata,
  RetrievalMode,
  DataSourceType,
  // TagMemo 相关
  TagMemoBoostInfo,
  // 检索规划相关
  RetrievalPlan,
  QueryAnalysis,
  // 后端相关
  KnowledgeBackend,
  BackendStats,
  // 日记相关
  DiarySearchOptions,
  // 配置
  UnifiedKnowledgeConfig,
  // 事件
  SearchEvent,
  BackendEvent
} from './types'
