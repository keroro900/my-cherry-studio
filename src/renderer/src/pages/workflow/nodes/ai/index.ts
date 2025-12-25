/**
 * AI 节点模块
 */

// 统一提示词节点（推荐使用）
export type { UnifiedPromptNodeConfig } from './UnifiedPromptNode'
export { UnifiedPromptExecutor, UnifiedPromptNode } from './UnifiedPromptNode'

// 视频提示词节点
export type { VideoPromptNodeConfig } from './VideoPromptNode'
export { VideoPromptExecutor, VideoPromptNode } from './VideoPromptNode'
