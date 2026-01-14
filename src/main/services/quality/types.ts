/**
 * QualityGuardian - Type Definitions
 *
 * AI 自我优化系统的核心类型定义
 * 支持多类型质量检查和自动优化
 */

/**
 * 内容类型
 */
export type QualityContentType = 'image' | 'code' | 'text' | 'workflow' | 'prompt'

/**
 * 检查级别
 */
export type QualityCheckLevel = 'basic' | 'standard' | 'thorough'

/**
 * 风险级别
 */
export type RiskLevel = 'low' | 'medium' | 'high'

/**
 * 改进趋势
 */
export type ImprovementTrend = 'improving' | 'stable' | 'declining'

/**
 * 自动修复类型
 */
export type AutoFixType =
  | 'prompt_optimization'
  | 'config_adjustment'
  | 'code_modification'
  | 'workflow_refactor'
  | 'enhance_clarity'
  | 'fix_format'
  | 'add_detail'
  | 'optimize_structure'
  | 'security_fix'
  | 'performance_optimize'

/**
 * 质量检查项
 */
export interface QualityCheckItem {
  id: string
  name: string
  nameEn?: string
  passed: boolean
  score: number // 0-100
  weight: number // 权重，用于计算总分
  details: string
  suggestions?: string[]
  category?: string
}

/**
 * 质量建议
 */
export interface QualitySuggestion {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  message: string
  fixDescription?: string
  estimatedImpact: number // 0-100 预估分数提升
}

/**
 * 自动修复变更
 */
export interface AutoFixChange {
  target: string // 文件路径或配置键
  type: 'insert' | 'replace' | 'delete' | 'modify'
  before?: string
  after?: string
  position?: {
    line?: number
    column?: number
  }
  description?: string
}

/**
 * 自动修复动作
 */
export interface AutoFixAction {
  id: string
  type: AutoFixType
  description: string
  changes: AutoFixChange[]
  requiresApproval: boolean
  riskLevel: RiskLevel
  estimatedImprovement?: number
}

/**
 * 统一质量指标接口
 */
export interface QualityMetrics {
  /** 内容类型 */
  contentType: QualityContentType

  /** 内容 ID（用于历史追踪） */
  contentId: string

  /** 评估时间戳 */
  timestamp: Date

  /** 是否通过（基于最低分数阈值） */
  passed: boolean

  /** 总体评分 0-100 */
  overallScore: number

  /** 检查项 */
  checks: {
    /** 通用检查项 */
    common: QualityCheckItem[]
    /** 类型特定检查项 */
    typeSpecific: QualityCheckItem[]
  }

  /** 改进建议 */
  suggestions: QualitySuggestion[]

  /** 是否可以自动修复 */
  canAutoFix: boolean

  /** 自动修复动作列表 */
  autoFixActions?: AutoFixAction[]

  /** 历史评分（用于趋势追踪） */
  previousScores?: number[]

  /** 改进趋势 */
  improvementTrend?: ImprovementTrend

  /** 评估时长（毫秒） */
  duration?: number

  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 用户质量偏好设置
 */
export interface QualityPreferences {
  /** 最低可接受分数 */
  minAcceptableScore: number

  /** 自动批准阈值（高于此分数的修复自动批准） */
  autoApproveThreshold: number

  /** 重点关注领域 */
  focusAreas?: string[]

  /** 排除的检查项 */
  excludeChecks?: string[]

  /** 是否启用趋势追踪 */
  enableTrendTracking?: boolean

  /** 历史记录保留数量 */
  historyLimit?: number
}

/**
 * 质量评估请求
 */
export interface QualityEvaluationRequest {
  /** 内容类型 */
  contentType: QualityContentType

  /** 内容（字符串、Buffer 或 JSON 对象） */
  content: string | Buffer | Record<string, unknown>

  /** 上下文信息 */
  context?: {
    /** 历史评估结果 */
    previousResults?: QualityMetrics[]
    /** 用户偏好 */
    userPreferences?: QualityPreferences
    /** 关联的工作流 ID */
    workflowId?: string
    /** 关联的节点 ID */
    nodeId?: string
    /** 原始提示词（用于图片/文本生成评估） */
    originalPrompt?: string
    /** 参考内容（用于对比） */
    referenceContent?: string | Buffer
  }

  /** 评估选项 */
  options?: {
    /** 检查级别 */
    checkLevel: QualityCheckLevel
    /** 是否启用自动修复 */
    enableAutoFix: boolean
    /** 自定义检查项 */
    customChecks?: string[]
    /** 超时时间（毫秒） */
    timeout?: number
    /** 使用的 AI 模型 */
    modelId?: string
    providerId?: string
  }
}

/**
 * 质量评估响应
 */
export interface QualityEvaluationResponse {
  success: boolean
  metrics?: QualityMetrics
  error?: string
  duration?: number
}

/**
 * 优化请求
 */
export interface OptimizationRequest {
  /** 目标类型 */
  targetType: 'prompt' | 'config' | 'code' | 'workflow'

  /** 目标内容 */
  target: string | Record<string, unknown>

  /** 质量指标（可选，如果没有会先执行评估） */
  metrics?: QualityMetrics

  /** 约束条件 */
  constraints?: {
    /** 最大迭代次数 */
    maxIterations: number
    /** 目标分数 */
    targetScore: number
    /** 是否保持语义一致 */
    preserveSemantics: boolean
    /** 最大修改范围 */
    maxChanges?: number
  }

  /** 优化选项 */
  options?: {
    /** 优化风格 */
    style?: 'conservative' | 'moderate' | 'aggressive'
    /** 使用的 AI 模型 */
    modelId?: string
    providerId?: string
  }
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  success: boolean
  /** 优化后的内容 */
  optimizedContent: string | Record<string, unknown>
  /** 改进详情 */
  improvements: {
    before: QualityMetrics
    after: QualityMetrics
    scoreImprovement: number
  }
  /** 变更列表 */
  changes: AutoFixChange[]
  /** 是否需要用户批准 */
  requiresUserApproval: boolean
  /** 批准请求 */
  approvalRequest?: ApprovalRequest
  /** 迭代次数 */
  iterations?: number
  /** 错误信息 */
  error?: string
}

/**
 * 批准请求（用于危险操作）
 */
export interface ApprovalRequest {
  requestId: string
  operation: string
  description: string
  changes: AutoFixChange[]
  riskLevel: RiskLevel
  expiresAt: number
  metadata?: Record<string, unknown>
}

/**
 * 质量历史记录
 */
export interface QualityHistory {
  contentId: string
  evaluations: QualityMetrics[]
  optimizations: OptimizationResult[]
  trend: {
    direction: ImprovementTrend
    averageScore: number
    bestScore: number
    worstScore: number
    scoreChanges: number[]
  }
  createdAt: Date
  updatedAt: Date
}

// ==================== 类型特定接口 ====================

/**
 * 图片质量检查配置
 */
export interface ImageQualityConfig {
  /** 检查清晰度 */
  checkClarity: boolean
  /** 检查构图 */
  checkComposition: boolean
  /** 检查背景 */
  checkBackground: boolean
  /** 检查一致性（与参考图对比） */
  checkConsistency: boolean
  /** 检查风格 */
  checkStyle: boolean
  /** 最小分辨率要求 */
  minResolution?: { width: number; height: number }
}

/**
 * 代码质量检查配置
 */
export interface CodeQualityConfig {
  /** 检查语法 */
  checkSyntax: boolean
  /** 检查风格 */
  checkStyle: boolean
  /** 检查复杂度 */
  checkComplexity: boolean
  /** 检查安全性 */
  checkSecurity: boolean
  /** 检查最佳实践 */
  checkBestPractices: boolean
  /** 编程语言 */
  language?: string
}

/**
 * 文本质量检查配置
 */
export interface TextQualityConfig {
  /** 检查流畅度 */
  checkFluency: boolean
  /** 检查连贯性 */
  checkCoherence: boolean
  /** 检查语法 */
  checkGrammar: boolean
  /** 检查风格一致性 */
  checkStyleConsistency: boolean
  /** 检查关键词覆盖 */
  checkKeywordCoverage: boolean
  /** 目标语言 */
  language?: string
}

/**
 * 提示词质量检查配置
 */
export interface PromptQualityConfig {
  /** 检查清晰度 */
  checkClarity: boolean
  /** 检查具体性 */
  checkSpecificity: boolean
  /** 检查结构 */
  checkStructure: boolean
  /** 检查与目标的相关性 */
  checkRelevance: boolean
  /** 目标用途 */
  targetUse?: 'image_generation' | 'text_generation' | 'code_generation' | 'chat'
}

/**
 * 工作流质量检查配置
 */
export interface WorkflowQualityConfig {
  /** 检查节点连接 */
  checkConnections: boolean
  /** 检查数据流 */
  checkDataFlow: boolean
  /** 检查错误处理 */
  checkErrorHandling: boolean
  /** 检查性能 */
  checkPerformance: boolean
  /** 检查冗余 */
  checkRedundancy: boolean
}

// ==================== 质量检查器接口 ====================

/**
 * 质量检查器基础接口
 */
export interface IQualityChecker {
  /** 检查器类型 */
  readonly contentType: QualityContentType

  /** 检查器名称 */
  readonly name: string

  /** 执行质量检查 */
  check(request: QualityEvaluationRequest): Promise<QualityMetrics>

  /** 获取支持的检查项 */
  getSupportedChecks(): string[]

  /** 生成自动修复动作 */
  generateAutoFix?(metrics: QualityMetrics): Promise<AutoFixAction[]>
}

// ==================== 服务接口 ====================

/**
 * QualityCore 服务接口
 */
export interface IQualityCore {
  /** 评估内容质量 */
  evaluate(request: QualityEvaluationRequest): Promise<QualityMetrics>

  /** 获取质量历史 */
  getHistory(contentId: string): Promise<QualityHistory | null>

  /** 记录评估结果 */
  recordMetrics(metrics: QualityMetrics): Promise<void>

  /** 注册检查器 */
  registerChecker(checker: IQualityChecker): void

  /** 获取检查器 */
  getChecker(contentType: QualityContentType): IQualityChecker | undefined
}

/**
 * OptimizationEngine 服务接口
 */
export interface IOptimizationEngine {
  /** 执行优化 */
  optimize(request: OptimizationRequest): Promise<OptimizationResult>

  /** 优化提示词 */
  optimizePrompt(
    prompt: string,
    targetType: 'image_generation' | 'text_generation' | 'code_generation',
    context?: Record<string, unknown>
  ): Promise<string>

  /** 请求用户批准 */
  requestApproval(request: ApprovalRequest): Promise<boolean>
}
