/**
 * 统一存储模块
 *
 * 提供:
 * - UnifiedStorageCore: 统一存储核心 (单例)
 * - ServiceAdapter: 服务适配器基类
 *
 * @module storage
 */

// 核心导出
export {
  getUnifiedStorage,
  UnifiedStorageCore
} from './UnifiedStorageCore'

export type {
  ChunkData,
  ChunkResult,
  FileData,
  FileResult,
  SearchOptions,
  TagData,
  TagResult,
  UnifiedStorageConfig,
  UnifiedStorageDependencies
} from './UnifiedStorageCore'

// 服务适配器导出
export {
  createServiceAdapter,
  ServiceAdapter
} from './ServiceAdapter'

export type {
  ServiceInsertOptions,
  ServiceSearchOptions,
  ServiceSearchResult,
  SourceType
} from './ServiceAdapter'
