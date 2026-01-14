/**
 * WebSocket 插件导出
 */

export type { AgentSyncPluginConfig, AgentTask } from './AgentSyncPlugin'
export { AgentSyncPlugin, createAgentSyncPlugin } from './AgentSyncPlugin'
export type { DistributedPluginConfig, DistributedServer, RemoteTool, ToolCallResult } from './DistributedPlugin'
export { createDistributedPlugin, DistributedPlugin, getDistributedPlugin } from './DistributedPlugin'
export type { VCPLogPluginConfig } from './VCPLogPlugin'
export { createVCPLogPlugin, VCPLogPlugin } from './VCPLogPlugin'
