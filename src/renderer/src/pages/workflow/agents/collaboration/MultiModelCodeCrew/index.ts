/**
 * MultiModelCodeCrew - 多模型协同编码系统
 *
 * VCP 风格的 Vibe Coding 加强版
 * 支持多个 AI 模型专业化分工协作
 */

// 类型导出
export * from './types'

// 协调器导出
export { CodeCrewOrchestrator } from './CodeCrewOrchestrator'

// 配置管理器导出
export {
  getCrewConfigManager,
  CrewConfigManager,
  type RoleCustomConfig,
  type CrewFullConfig,
  type CrewGlobalConfig
} from './CrewConfigManager'

// 协作协议导出
export {
  getCollaborationProtocol,
  CollaborationProtocol,
  type TaskAnalysis,
  type RoleMatchScore,
  type ProtocolMessage,
  type CollaborationState
} from './CollaborationProtocol'

// VCP 插件导出
export {
  createMultiModelCodeCrewService,
  multiModelCodeCrewService,
  executeVCPTool,
  startCrew,
  getProgress,
  getSession,
  getResult,
  stopSession,
  applyResults,
  cleanupSession,
  listActiveSessions,
  VCP_TOOLS_DESCRIPTION
} from './vcpPlugin'

export type {
  StartCrewParams,
  CrewExecutionResult,
  ApplyResultParams,
  ApplyResult,
  IMultiModelCodeCrewService
} from './vcpPlugin'

// Hooks 导出
export {
  useCrewEvents,
  type UseCrewEventsReturn,
  type RoleActivity,
  type CrewLogEntry as HookCrewLogEntry,
  type CrewSnapshot,
  type CrewStatistics
} from './hooks'

// 组件导出
export {
  CrewVisualizationPanel,
  WorkspaceSelector,
  PermissionModeSelector,
  ProLogViewer
} from './components'

// Sandbox 导出
export {
  SandboxManager,
  PermissionManager,
  type WorkspaceInfo,
  type PermissionMode,
  type PermissionConfig,
  type PermissionRequest
} from './sandbox'

// Tools 导出
export {
  FileSystemTools,
  TerminalTools,
  type FileEdit,
  type FileEntry,
  type GrepResult,
  type FileInfo,
  type ExecutionResult,
  type TaskStatus,
  type ExecuteOptions
} from './tools'

// Bridge 导出
export {
  VCPLogBridge,
  VCPEventBridge,
  VCPToolBridge,
  type VCPEvent,
  type VCPEventHandlers,
  type ToolDefinition,
  type ToolResult,
  type AsyncTaskStatus
} from './bridge'

// 默认导出
export { default } from './CodeCrewOrchestrator'
