/**
 * VCP Native Runtime - Module Exports
 *
 * 完全原生的 VCP 运行时，不依赖 external/VCPToolBox
 *
 * 彻底 VCP 化：MCP 工具自动桥接为 VCP 插件
 */

// ==================== IPC 处理器统一入口 ====================
// 统一模块 (推荐使用)
export { registerAllVCPIpcHandlers, getVCPIpcModuleInfo } from './VCPIpcModule'
export type { VCPIpcRegistrationResult } from './VCPIpcModule'

// 单独模块 (向后兼容)
export { registerVCPVariableIpcHandlers } from './VCPVariableIpcHandler'
export { registerVCPTemplateIpcHandlers } from './VCPTemplateIpcHandler'
export { registerVCPDetectorIpcHandlers } from './VCPDetectorIpcHandler'

// 核心运行时
export { getVCPRuntime, initializeVCPRuntime, normalizeVCPKey, VCPRuntime } from './VCPRuntime'

// 插件注册表（含 MCP 桥接）
export { createPluginRegistry, PluginRegistry } from './PluginRegistry'
export type { MCPServerInterface, MCPToolDefinition } from './PluginRegistry'

// 插件执行器
export { createPluginExecutor, PluginExecutor } from './PluginExecutor'

// 占位符引擎
export { createPlaceholderEngine, PlaceholderEngine } from './PlaceholderEngine'

// 类型导出
export type {
  // 插件类型
  VCPPluginType,
  CommunicationProtocol,
  // 清单格式
  SystemPromptPlaceholder,
  ToolFunctionDefinition,
  PluginCapabilities,
  PluginEntryPoint,
  PluginCommunication,
  AsyncConfig,
  ServiceConfig,
  VCPPluginManifest,
  // 运行时类型
  VCPPlugin,
  VCPToolRequest,
  VCPExecutionContext,
  VCPToolResult,
  // 异步任务
  AsyncTaskStatus,
  AsyncTask,
  // 占位符
  PlaceholderValue,
  PlaceholderContext,
  // 消息预处理
  ChatMessage,
  PreprocessorResult,
  // 配置
  VCPRuntimeConfig,
  // TOOL_REQUEST 解析
  ParsedToolRequest,
  ToolRequestParseResult,
  // 事件
  VCPRuntimeEvent,
  VCPRuntimeEventListener
} from './types'

// 默认配置
export { DEFAULT_VCP_RUNTIME_CONFIG } from './types'

// ==================== 新增服务 (VCPToolBox 对标) ====================

// 模型白名单透传服务
export { getModelWhitelistService } from './ModelWhitelistService'
export type {
  DiscoveredModel,
  ModelAvailabilityResult,
  ModelWhitelistService,
  WhitelistConfig,
  WhitelistEntry
} from './ModelWhitelistService'

// 外部插件管理器 (Phase 4.1)
export {
  getExternalPluginManager,
  initializeExternalPluginManager,
  ExternalPluginManager
} from './ExternalPluginManager'
export type {
  ExternalPluginManifest,
  ExternalPluginTool,
  PluginExecutionInput,
  PluginExecutionOutput,
  InstalledPlugin,
  PluginsConfig
} from './ExternalPluginManager'

// VCPSuper 净化器
export { getVCPSuperPurifier, purifyMessages, VCPSuperPurifier } from './VCPSuperPurifier'
export type { PurifierConfig, PurifierMessage, PurifierResult } from './VCPSuperPurifier'

// VCP 检测器服务 (DetectorX/SuperDetectorX)
export { vcpDetectorService } from './VCPDetectorService'
export type { DetectorRule, DetectorConfig, TransformResult } from './VCPDetectorService'

// WebSocket 推送服务
// @deprecated 请使用 apiServer 的统一 WebSocket 服务
// 迁移指南: import { apiServer } from '@main/apiServer'
//           const wsServer = apiServer.getWebSocketServer()
//           wsServer?.broadcast({ type: WebSocketMessageType.CUSTOM, data: {...} })
export {
  broadcast,
  createWebSocketPushService,
  getWebSocketPushService,
  push,
  WebSocketPushService
} from './WebSocketPushService'
export type { PushMessage, PushStats, WebSocketClient, WebSocketPushConfig } from './WebSocketPushService'
