/**
 * 多Agent协同模块
 *
 * @module agents/collaboration
 */

// 类型定义
export type {
  CollaborationAgentConfig,
  CollaborationEvent,
  CollaborationEventCallback,
  CollaborationMessage,
  CollaborationRole,
  CollaborationSessionConfig,
  CollaborationSessionState,
  QualityReview
} from './types'
export { COLLABORATION_ROLES } from './types'

// 协同 Agent
export type { AgentFunctions, CollaborationRequest, CollaborationResult } from './ImageCollaborationAgent'
export { ImageCollaborationAgent, imageCollaborationAgent } from './ImageCollaborationAgent'

// 质量守护 Agent
export type {
  AutoFixAction,
  QualityAgentFunctions,
  QualityCheckItem,
  QualityContentType,
  QualityEvaluationRequest,
  QualityGuardianEvent,
  QualityGuardianEventCallback,
  QualityGuardianRequest,
  QualityGuardianResult,
  QualityGuardianRole,
  QualityMetrics,
  QualitySuggestion
} from './QualityGuardianAgent'
export {
  QUALITY_GUARDIAN_ROLES,
  QualityGuardianAgent,
  qualityGuardianAgent
} from './QualityGuardianAgent'
