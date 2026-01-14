/**
 * VCP Agent 模块导出
 *
 * 包含:
 * - VCPAgentService: Agent 定义和管理
 * - ContextInjectorService: 上下文注入
 * - AgentCollaborationService: 多 Agent 协作
 * - GroupChatOrchestrator: 群聊编排
 * - UnifiedAgentAdapter: 统一 Agent 适配器
 * - AgentInvokeService: VCP 风格 Agent 调用
 */

export * from './AgentCollaborationService'
export * from './AgentInvokeService'
export * from './ContextInjectorService'
export * from './GroupChatOrchestrator'
export * from './UnifiedAgentAdapter'
export * from './VCPAgentService'
