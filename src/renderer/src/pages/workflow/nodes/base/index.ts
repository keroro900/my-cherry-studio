/**
 * 节点基础模块导出
 */

export { BaseNodeExecutor } from './BaseNodeExecutor'
export type { default as NodeRegistry } from './NodeRegistry'
export { nodeRegistry } from './NodeRegistry'

// 导出核心类型（统一版本）
export type {
  BatchExecutionContext,
  BatchItem,
  BatchResult,
  NodeExecutionContext,
  NodeExecutionResult,
  NodeExecutor,
  PreflightIssue,
  PreflightResult,
  WorkflowExecutionContext
} from '../../types/core'

// 导出工厂函数
export {
  createErrorResult,
  createSkippedResult,
  createSuccessResult,
  isErrorResult,
  isSkippedResult,
  isSuccessResult
} from '../../types/core'

// 导出仍需要的本地类型
export type {
  NodeCategory,
  NodeConfigField,
  NodeConfigSchema,
  NodeDefinition,
  NodeMetadata,
  NodePort,
  NodeRegistryEntry,
  PortDataType
} from './types'
