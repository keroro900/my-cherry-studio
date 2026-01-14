/**
 * Unified Plugin Manager - 统一插件管理器
 *
 * 重要：此文件已迁移为重导出模块
 * 实际实现位于 src/main/services/UnifiedPluginManager.ts
 *
 * 该实现使用原生 VCPRuntime，不再依赖 VCPToolBox Bridge
 */

// 从 services/UnifiedPluginManager.ts 导入
import {
  getUnifiedPluginManager as getManager,
  initializeUnifiedPluginManager,
  UnifiedPluginManager
} from '../../services/UnifiedPluginManager'

// 重导出所有内容
// 确保整个应用使用单一的 UnifiedPluginManager 实例
export { UnifiedPluginManager, initializeUnifiedPluginManager }

// 重导出 getUnifiedPluginManager
export const getUnifiedPluginManager = getManager

export type {
  PluginSource,
  ToolExecutionRequest,
  ToolExecutionResult,
  UnifiedPlugin,
  UnifiedPluginType
} from '../../services/UnifiedPluginManager'

// 兼容旧版类型导出（映射到新类型）
export type PluginProtocol = 'vcp' | 'mcp' | 'hybrid'
export type UnifiedPluginInfo = {
  id: string
  name: string
  displayName: string
  description: string
  version: string
  protocol: PluginProtocol
  vcpType?: string
  source: 'vcp' | 'mcp' | 'distributed'
  enabled: boolean
  serverId?: string
}

export type ToolCallRequest = {
  name: string
  arguments: Record<string, unknown>
  protocolHint?: PluginProtocol
}

export type ToolCallResult = {
  success: boolean
  output?: string
  data?: unknown
  error?: string
  executionTimeMs?: number
  protocol: PluginProtocol
}

// 兼容旧版函数导出
export function createUnifiedPluginManager() {
  return getManager()
}
