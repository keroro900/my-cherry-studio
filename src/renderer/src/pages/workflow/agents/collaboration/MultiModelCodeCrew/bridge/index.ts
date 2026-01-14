/**
 * Bridge 模块索引
 *
 * 导出所有 VCP 桥接组件
 */

export { VCPLogBridge } from './VCPLogBridge'
export { VCPEventBridge } from './VCPEventBridge'
export type {
  VCPEvent,
  VCPEventHandlers,
  ToolExecutionCompleteEvent,
  AgentMessageEvent
} from './VCPEventBridge'
export { VCPToolBridge } from './VCPToolBridge'
export type {
  ToolDefinition,
  ToolResult,
  AsyncTaskStatus
} from './VCPToolBridge'
