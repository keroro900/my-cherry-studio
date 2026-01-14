/**
 * GroupChat 组件模块
 *
 * 多 Agent 协同对话的 UI 组件
 */

// 组件导出
export { GroupAgentSelector } from './GroupAgentSelector'
export { default as GroupAgentSelectorDefault } from './GroupAgentSelector'
export { GroupChatPanel } from './GroupChatPanel'
export { default as GroupChatPanelDefault } from './GroupChatPanel'
export { GroupChatPanelNew } from './GroupChatPanelNew'
export { default as GroupChatPanelNewDefault } from './GroupChatPanelNew'

// 常量导出
export { DEFAULT_GROUP_CHAT_CONFIG, ROLE_COLORS, ROLE_LABELS, SPEAKING_MODES, STATUS_COLORS } from './constants'

// Hooks 导出
export * from './hooks'

// 工具函数导出
export * from './utils'

// 类型导出
export type { AssistantItem, GroupAgentSelectorProps } from './GroupAgentSelector'
export type { GroupChatPanelProps } from './GroupChatPanel'
export type { GroupChatPanelNewProps } from './GroupChatPanelNew'
export type {
  AgentRole,
  GroupAgent,
  GroupChatConfig,
  GroupChatEvent,
  GroupMessage,
  SpeakingMode,
  UnifiedAgent
} from '@renderer/services/GroupChatService'

