/**
 * MeshMemo 模块导出
 *
 * 提供通用的"先过滤后召回"检索服务
 * 包含 Native (Rust) 和 TypeScript 两种实现
 */

export type {
  FilterCondition,
  GenericMetadata,
  MeshMemoChunk,
  MeshMemoConfig,
  MeshMemoFilter,
  MeshMemoSchema,
  MeshMemoSearchResult
} from './GenericMeshMemoService'
export {
  createGenericMeshMemoService,
  createMeshMemoService,
  GenericMeshMemoService
} from './GenericMeshMemoService'

// Native MeshMemo (使用 Rust VectorStore 和 TagMemo)
export type { NativeMeshMemoConfig } from './NativeMeshMemoService'
export {
  createNativeMeshMemoService,
  getNativeMeshMemoService,
  NativeMeshMemoService
} from './NativeMeshMemoService'

// 动态 K 值计算
export type {
  DynamicKConfig,
  DynamicKResult,
  QueryAnalysis,
  RetrievalQuality
} from './DynamicKCalculator'
export {
  calculateOptimalK,
  DynamicKCalculator,
  getDynamicKCalculator
} from './DynamicKCalculator'
