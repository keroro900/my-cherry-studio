/**
 * 自主图片生成 Agent 模块
 *
 * 提供 AI 自主决策、任务规划、多步骤执行的能力
 *
 * @module agents
 */

// 核心类型（从 types/core.ts 重新导出）
export { createBase64Ref, createImageRef, type ImageRef, isImageRef } from '../types/core'

// 意图分析器
export type { ExtractedParams, GarmentAnalysis, IntentResult, TaskType } from './IntentAnalyzer'
export { IntentAnalyzer, intentAnalyzer } from './IntentAnalyzer'

// 任务规划器
export type { StepType, TaskPlan, TaskStep } from './TaskPlanner'
export { TaskPlanner, taskPlanner } from './TaskPlanner'

// 自主 Agent
export type {
  AnalyzeImageFunc,
  AutonomousRequest,
  AutonomousResult,
  GenerateImageFunc,
  ProgressCallback,
  StepResult
} from './AutonomousImageAgent'
export { AutonomousImageAgent, autonomousImageAgent } from './AutonomousImageAgent'

// 多Agent协同模块
export * from './collaboration'
