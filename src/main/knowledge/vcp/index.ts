/**
 * VCP 模块导出
 *
 * 核心架构:
 * - VCPRuntime: 原生 VCP 插件运行时（完全不依赖 external）
 * - UnifiedPluginManager: 统一插件管理（MCP + VCP）
 *
 * 知识库:
 * - NativeKnowledgeService: 原生知识库服务
 * - UnifiedKnowledgeAdapter: 原生适配器（已移除 VCPToolBox 依赖）
 *
 * 注意: 以下模块已完全原生化，不再依赖 external/VCPToolBox:
 * - VCPSearchService -> 使用 NativeKnowledgeService
 * - PluginManager -> 已废弃，使用 VCPRuntime
 * - tagmemo/ -> 使用原生 TagMemoService
 */

// ==================== 核心模块 ====================

// RRF 融合算法 - 已移到 @main/memory/utils/RRFUtils
// @deprecated 请从 '@main/memory/utils/RRFUtils' 导入
// export * from './RRFUtils'

// VCP 搜索服务 (适配器，委托给原生服务)
export * from './VCPSearchService'

// VCP 类型定义
export * from './types'

// 内置插件注册表
export type { BuiltinPluginMeta } from './BuiltinPluginRegistry'
export {
  BUILTIN_PLUGINS,
  getAllBuiltinPlugins,
  getBuiltinPluginsByCategory,
  getBuiltinPluginsByType,
  getBuiltinPluginStats,
  searchBuiltinPlugins
} from './BuiltinPluginRegistry'

// Model Proxy Adapter (类型和工厂函数)
export type {
  CherryProvider,
  ModelProxyAdapter,
  ModelProxyConfig,
  ModelSelectionStrategy
} from '../../services/ModelProxyAdapter'
export { createMockModelProxyAdapter, createModelProxyAdapter } from '../../services/ModelProxyAdapter'

// ==================== 内部模块 (供组件间引用) ====================

// 协议桥接
export { VCPAdapter } from './VCPAdapter'
export { UnifiedPluginManager } from './UnifiedPluginManager'

// ==================== 类型导出 ====================

export type { PluginProtocol, ToolCallRequest, ToolCallResult, UnifiedPluginInfo } from './UnifiedPluginManager'
export type { AdaptedMCPTool, MCPToolHandler } from './VCPAdapter'
