/**
 * 多Agent协同图片生成 - 类型定义
 *
 * 定义协作群中各角色的类型和配置
 *
 * @module agents/collaboration/types
 */

import type { Model, Provider } from '@renderer/types'

import type { ImageRef } from '../../types/core'
import type { GarmentAnalysis, TaskPlan, TaskType } from '../index'

// ==================== Agent 角色定义 ====================

/**
 * 协作 Agent 角色
 */
export type CollaborationRole = 'analyst' | 'planner' | 'generator' | 'quality_checker' | 'coordinator'

/**
 * 协作 Agent 配置
 */
export interface CollaborationAgentConfig {
  /** 角色 */
  role: CollaborationRole
  /** 显示名称 */
  displayName: string
  /** 头像 emoji */
  avatar: string
  /** 使用的 Provider */
  provider: Provider
  /** 使用的模型 */
  model: Model
  /** 系统提示词 */
  systemPrompt: string
  /** 专长领域 */
  expertise: string[]
  /** 能力标签 */
  capabilities: ('vision' | 'text' | 'image_gen')[]
}

/**
 * 预设的协作角色配置
 */
export const COLLABORATION_ROLES: Record<CollaborationRole, Omit<CollaborationAgentConfig, 'provider' | 'model'>> = {
  analyst: {
    role: 'analyst',
    displayName: '分析师',
    avatar: '🔍',
    systemPrompt: `你是一位专业的服装图片分析师。你的职责是：
1. 分析用户上传的服装图片
2. 提取关键特征：类别、颜色、材质、图案、风格
3. 识别适合的拍摄角度和细节展示点
4. 输出结构化的分析报告

分析完成后，@规划师 让他制定生成计划。`,
    expertise: ['服装分析', '色彩识别', '材质判断', '风格分类'],
    capabilities: ['vision', 'text']
  },

  planner: {
    role: 'planner',
    displayName: '规划师',
    avatar: '📋',
    systemPrompt: `你是一位专业的电商图片规划师。你的职责是：
1. 根据分析师的报告制定图片生成计划
2. 规划需要生成的图片类型：主图、背面图、细节图
3. 为每张图片制定提示词策略
4. 确定生成顺序和参数配置

计划完成后，@生成师 开始执行生成任务。`,
    expertise: ['任务规划', '提示词策略', '电商图片'],
    capabilities: ['text']
  },

  generator: {
    role: 'generator',
    displayName: '生成师',
    avatar: '🎨',
    systemPrompt: `你是一位专业的 AI 图片生成师。你的职责是：
1. 根据规划师的计划执行图片生成
2. 使用适当的提示词和参数
3. 生成高质量的电商产品图
4. 报告生成进度和结果

每生成一张图片后，@质检师 进行质量检查。`,
    expertise: ['图片生成', 'Gemini', '电商摄影'],
    capabilities: ['image_gen', 'vision']
  },

  quality_checker: {
    role: 'quality_checker',
    displayName: '质检师',
    avatar: '✅',
    systemPrompt: `你是一位严格的图片质量检查师。你的职责是：
1. 检查生成图片的质量
2. 评估是否符合电商标准：清晰度、构图、背景、光线
3. 与原图对比检查一致性
4. 提供改进建议或确认通过

如果发现问题，@生成师 提供修改建议。
如果全部通过，输出最终结果。`,
    expertise: ['质量检查', '图片评估', '电商标准'],
    capabilities: ['vision', 'text']
  },

  coordinator: {
    role: 'coordinator',
    displayName: '协调员',
    avatar: '👨‍💼',
    systemPrompt: `你是协作群的协调员。你的职责是：
1. 监督整体进度
2. 处理异常情况
3. 协调各角色的工作
4. 汇总最终结果给用户`,
    expertise: ['项目管理', '协调沟通'],
    capabilities: ['text']
  }
}

// ==================== 协作消息类型 ====================

/**
 * 协作消息
 */
export interface CollaborationMessage {
  /** 消息 ID */
  id: string
  /** 发送者角色 */
  senderRole: CollaborationRole
  /** 发送者名称 */
  senderName: string
  /** 消息内容 */
  content: string
  /** 时间戳 */
  timestamp: Date
  /** 消息类型 */
  type: 'chat' | 'analysis' | 'plan' | 'image' | 'review' | 'system'
  /** @提及的角色 */
  mentions: CollaborationRole[]
  /** 附带的图片 */
  images?: ImageRef[]
  /** 附带的数据 */
  data?: {
    analysis?: GarmentAnalysis
    plan?: TaskPlan
    review?: QualityReview
  }
}

/**
 * 质量检查结果
 */
export interface QualityReview {
  /** 是否通过 */
  passed: boolean
  /** 评分 0-100 */
  score: number
  /** 检查项 */
  checks: {
    clarity: { passed: boolean; comment: string }
    composition: { passed: boolean; comment: string }
    background: { passed: boolean; comment: string }
    consistency: { passed: boolean; comment: string }
  }
  /** 改进建议 */
  suggestions?: string[]
  /** 需要重新生成的图片索引 */
  regenerateIndices?: number[]
}

// ==================== 协作会话 ====================

/**
 * 协作会话配置
 */
export interface CollaborationSessionConfig {
  /** 会话 ID */
  sessionId: string
  /** 任务类型 */
  taskType: TaskType
  /** 参与的 Agent 配置 */
  agents: CollaborationAgentConfig[]
  /** 最大重试次数 */
  maxRetries: number
  /** 自动流转（无需用户确认） */
  autoProgress: boolean
  /** 显示思考过程 */
  showThinking: boolean
  /** 超时时间（毫秒） */
  timeout: number
}

/**
 * 协作会话状态
 */
export interface CollaborationSessionState {
  /** 配置 */
  config: CollaborationSessionConfig
  /** 当前阶段 */
  currentPhase: 'analyzing' | 'planning' | 'generating' | 'reviewing' | 'completed' | 'error'
  /** 当前发言的 Agent */
  currentSpeaker: CollaborationRole | null
  /** 消息历史 */
  messages: CollaborationMessage[]
  /** 分析结果 */
  analysisResult?: GarmentAnalysis
  /** 执行计划 */
  executionPlan?: TaskPlan
  /** 生成的图片 */
  generatedImages: ImageRef[]
  /** 质检结果 */
  qualityReviews: QualityReview[]
  /** 重试次数 */
  retryCount: number
  /** 开始时间 */
  startTime: Date
  /** 错误信息 */
  error?: string
}

// ==================== 协作事件 ====================

/**
 * 协作事件
 */
export type CollaborationEvent =
  | { type: 'session:start'; config: CollaborationSessionConfig }
  | { type: 'session:end'; success: boolean; images: ImageRef[] }
  | { type: 'phase:change'; phase: CollaborationSessionState['currentPhase'] }
  | { type: 'agent:speak'; message: CollaborationMessage }
  | { type: 'agent:thinking'; role: CollaborationRole }
  | { type: 'image:generated'; image: ImageRef; index: number }
  | { type: 'review:complete'; review: QualityReview }
  | { type: 'retry:start'; reason: string }
  | { type: 'error'; error: string }

/**
 * 协作事件回调
 */
export type CollaborationEventCallback = (event: CollaborationEvent) => void
