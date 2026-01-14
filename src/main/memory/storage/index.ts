/**
 * 存储模块导出
 *
 * @module memory/storage
 */

export type { BatchOperationResult, SQLiteStoreConfig } from './SQLiteStore'
export { createSQLiteStore, SQLiteStore } from './SQLiteStore'
export type {
  ClusterResult,
  SimilarityAlgorithm,
  VectorEntry,
  VectorIndexConfig,
  VectorSearchOptions,
  VectorSpaceStats
} from './VectorIndexService'
export { createVectorIndex, VectorIndexService } from './VectorIndexService'
