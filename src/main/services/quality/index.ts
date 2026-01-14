/**
 * QualityGuardian - 模块导出
 *
 * AI 自我优化系统的核心模块
 */

// 类型导出
export type {
  AutoFixAction,
  AutoFixChange,
  AutoFixType,
  ApprovalRequest,
  CodeQualityConfig,
  ImageQualityConfig,
  ImprovementTrend,
  IOptimizationEngine,
  IQualityChecker,
  IQualityCore,
  OptimizationRequest,
  OptimizationResult,
  PromptQualityConfig,
  QualityCheckItem,
  QualityCheckLevel,
  QualityContentType,
  QualityEvaluationRequest,
  QualityEvaluationResponse,
  QualityHistory,
  QualityMetrics,
  QualityPreferences,
  QualitySuggestion,
  RiskLevel,
  TextQualityConfig,
  WorkflowQualityConfig
} from './types'

// 核心类导出
export { getQualityCore, initializeQualityCore, QualityCore } from './QualityCore'

// 优化引擎导出
export { getOptimizationEngine, OptimizationEngine } from './OptimizationEngine'

// 记忆集成导出
export type {
  BestPractice,
  ExpertConsultResult,
  QualityLearningResult,
  QualityMemoryEntry,
  QualityPattern
} from './QualityMemoryIntegration'
export {
  getQualityMemoryIntegration,
  initializeQualityMemoryIntegration,
  QualityMemoryIntegration
} from './QualityMemoryIntegration'

// 检查器导出
export { CodeQualityChecker } from './checkers/CodeQualityChecker'
export { ImageQualityChecker } from './checkers/ImageQualityChecker'
export { PromptQualityChecker } from './checkers/PromptQualityChecker'
export { TextQualityChecker } from './checkers/TextQualityChecker'

// IPC 处理器导出
export { registerQualityIpcHandlers } from './QualityIpcHandler'
