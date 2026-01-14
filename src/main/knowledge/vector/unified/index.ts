/**
 * 统一向量检索服务模块导出
 */

// 核心服务
export {
  getUnifiedVectorService,
  textSearch,
  UnifiedVectorService,
  vectorSearch
} from './UnifiedVectorService'
export type { InsertOptions, TextSearchOptions, UnifiedSearchOptions } from './UnifiedVectorService'

// 后端注册表
export {
  getVectorBackendRegistry,
  registerBackend,
  VectorBackendRegistry
} from './VectorBackendRegistry'
export type { BackendMeta, ExtendedVectorBackend } from './VectorBackendRegistry'

// 混合检索引擎
export { createHybridSearchEngine, HybridSearchEngine } from './HybridSearchEngine'
export type { HybridSearchOptions } from './HybridSearchEngine'

// 结果聚合器
export { createResultAggregator, ResultAggregator } from './ResultAggregator'
export type {
  AggregationOptions,
  BackendSearchResults,
  UnifiedSearchResult
} from './ResultAggregator'
