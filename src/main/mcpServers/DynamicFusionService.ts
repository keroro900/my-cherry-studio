/**
 * DynamicFusionService - 超动态递归融合服务
 *
 * 为思维链提供自适应融合策略：
 * 1. 共识融合 - 高置信度思维合并
 * 2. 辩论解决 - 冲突思维协调
 * 3. 递归扩展 - 深度挖掘
 * 4. 摘要压缩 - 长链精简
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('DynamicFusion')

// ==================== 类型定义 ====================

/**
 * 思维节点
 */
export interface Thought {
  id: string
  content: string
  confidence: number
  depth: number
  source?: string
  timestamp: number
  metadata?: Record<string, unknown>
  parentId?: string
  childIds?: string[]
  disagreesWith?: string[]
  agreesWith?: string[]
  tags?: string[]
}

/**
 * 思维上下文
 */
export interface ThinkingContext {
  thoughts: Thought[]
  depth: number
  maxDepth: number
  targetConfidence: number
  iteration: number
  maxIterations: number
  topic?: string
  constraints?: string[]
  fusionHistory: FusionRecord[]
}

/**
 * 融合记录
 */
export interface FusionRecord {
  strategyName: string
  inputThoughts: string[]
  outputThoughtId: string
  timestamp: number
  success: boolean
}

/**
 * 融合策略接口
 */
export interface FusionStrategy {
  name: string
  priority: number
  condition: (context: ThinkingContext) => boolean
  apply: (thoughts: Thought[], context: ThinkingContext) => Promise<Thought>
}

/**
 * 融合结果
 */
export interface FusionResult {
  thought: Thought
  strategyUsed: string
  confidence: number
  iterations: number
  fusionChain: FusionRecord[]
}

/**
 * 服务配置
 */
export interface DynamicFusionConfig {
  /** 最大递归深度 (默认 5) */
  maxDepth: number
  /** 最大迭代次数 (默认 10) */
  maxIterations: number
  /** 目标置信度 (默认 0.8) */
  targetConfidence: number
  /** 共识阈值 (默认 0.8) */
  consensusThreshold: number
  /** 冲突检测阈值 (默认 0.3) */
  conflictThreshold: number
  /** 启用递归融合 */
  enableRecursion: boolean
  /** 自定义策略 */
  customStrategies?: FusionStrategy[]
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: DynamicFusionConfig = {
  maxDepth: 5,
  maxIterations: 10,
  targetConfidence: 0.8,
  consensusThreshold: 0.8,
  conflictThreshold: 0.3,
  enableRecursion: true
}

// ==================== 内置融合策略 ====================

/**
 * 共识融合策略 - 合并高置信度一致意见
 */
const consensusStrategy: FusionStrategy = {
  name: 'consensus',
  priority: 1,
  condition: (ctx: ThinkingContext) => {
    // 所有思维置信度都很高
    return ctx.thoughts.length > 1 && ctx.thoughts.every((t) => t.confidence >= ctx.targetConfidence * 0.9)
  },
  apply: async (thoughts: Thought[], _ctx: ThinkingContext) => {
    // 提取共同点，生成综合结论
    const contents = thoughts.map((t) => t.content)
    const avgConfidence = thoughts.reduce((sum, t) => sum + t.confidence, 0) / thoughts.length

    const mergedContent = `综合以下观点形成共识:\n${contents.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n共识结论: ${extractCommonThemes(contents)}`

    return {
      id: generateThoughtId(),
      content: mergedContent,
      confidence: Math.min(avgConfidence * 1.1, 1.0), // 共识提升置信度
      depth: Math.max(...thoughts.map((t) => t.depth)) + 1,
      timestamp: Date.now(),
      parentId: thoughts[0].id,
      agreesWith: thoughts.map((t) => t.id),
      tags: ['consensus', 'merged']
    }
  }
}

/**
 * 辩论解决策略 - 处理冲突观点
 */
const debateStrategy: FusionStrategy = {
  name: 'debate',
  priority: 2,
  condition: (ctx: ThinkingContext) => {
    // 存在分歧
    return ctx.thoughts.some((t) => t.disagreesWith && t.disagreesWith.length > 0)
  },
  apply: async (thoughts: Thought[], _ctx: ThinkingContext) => {
    // 找出冲突方
    const conflictingPairs: Array<[Thought, Thought]> = []

    for (const thought of thoughts) {
      if (thought.disagreesWith) {
        for (const disagreedId of thought.disagreesWith) {
          const disagreedThought = thoughts.find((t) => t.id === disagreedId)
          if (disagreedThought) {
            conflictingPairs.push([thought, disagreedThought])
          }
        }
      }
    }

    if (conflictingPairs.length === 0) {
      // 没有找到具体冲突，返回最高置信度的
      const best = thoughts.reduce((a, b) => (a.confidence > b.confidence ? a : b))
      return { ...best, id: generateThoughtId() }
    }

    // 辩论解决
    const resolutions: string[] = []
    for (const [t1, t2] of conflictingPairs) {
      resolutions.push(
        `观点A (置信度 ${t1.confidence.toFixed(2)}): ${t1.content}\n观点B (置信度 ${t2.confidence.toFixed(2)}): ${t2.content}\n解决: ${resolveConflict(t1, t2)}`
      )
    }

    const avgConfidence = thoughts.reduce((sum, t) => sum + t.confidence, 0) / thoughts.length

    return {
      id: generateThoughtId(),
      content: `辩论解决:\n${resolutions.join('\n\n')}`,
      confidence: avgConfidence * 0.9, // 辩论后信心略降
      depth: Math.max(...thoughts.map((t) => t.depth)) + 1,
      timestamp: Date.now(),
      parentId: thoughts[0].id,
      tags: ['debate', 'resolved']
    }
  }
}

/**
 * 递归扩展策略 - 深入探索
 */
const expansionStrategy: FusionStrategy = {
  name: 'expansion',
  priority: 3,
  condition: (ctx: ThinkingContext) => {
    // 深度未达上限且置信度不足
    return (
      ctx.depth < ctx.maxDepth &&
      ctx.thoughts.length > 0 &&
      ctx.thoughts.some((t) => t.confidence < ctx.targetConfidence)
    )
  },
  apply: async (thoughts: Thought[], ctx: ThinkingContext) => {
    // 找出最需要扩展的思维
    const lowConfidenceThoughts = thoughts.filter((t) => t.confidence < ctx.targetConfidence)
    const target = lowConfidenceThoughts.reduce((a, b) => (a.confidence < b.confidence ? a : b))

    const expandedContent = `深入分析: ${target.content}\n\n扩展探索:\n1. 核心论点分解\n2. 支撑证据检验\n3. 潜在反驳考虑\n4. 综合评估`

    return {
      id: generateThoughtId(),
      content: expandedContent,
      confidence: target.confidence * 1.2, // 扩展可提升置信度
      depth: target.depth + 1,
      timestamp: Date.now(),
      parentId: target.id,
      tags: ['expansion', 'deepened']
    }
  }
}

/**
 * 摘要压缩策略 - 精简长链
 */
const compressionStrategy: FusionStrategy = {
  name: 'compression',
  priority: 4,
  condition: (ctx: ThinkingContext) => {
    // 思维链过长
    return ctx.thoughts.length > 5
  },
  apply: async (thoughts: Thought[], _ctx: ThinkingContext) => {
    // 按置信度排序取前 N 个
    const topThoughts = [...thoughts].sort((a, b) => b.confidence - a.confidence).slice(0, 3)

    const summary = topThoughts
      .map((t) => `• ${t.content.substring(0, 100)}... (置信度: ${t.confidence.toFixed(2)})`)
      .join('\n')

    const avgConfidence = topThoughts.reduce((sum, t) => sum + t.confidence, 0) / topThoughts.length

    return {
      id: generateThoughtId(),
      content: `思维链摘要 (${thoughts.length} 条思维压缩为核心观点):\n\n${summary}`,
      confidence: avgConfidence,
      depth: Math.max(...thoughts.map((t) => t.depth)) + 1,
      timestamp: Date.now(),
      tags: ['compression', 'summary']
    }
  }
}

/**
 * 默认融合策略 - 加权平均
 */
const defaultStrategy: FusionStrategy = {
  name: 'default',
  priority: 100,
  condition: () => true, // 始终可用
  apply: async (thoughts: Thought[], _ctx: ThinkingContext) => {
    if (thoughts.length === 0) {
      return {
        id: generateThoughtId(),
        content: '无可用思维进行融合',
        confidence: 0,
        depth: 0,
        timestamp: Date.now()
      }
    }

    if (thoughts.length === 1) {
      return { ...thoughts[0], id: generateThoughtId() }
    }

    // 加权平均融合
    const totalWeight = thoughts.reduce((sum, t) => sum + t.confidence, 0)
    const weightedContents = thoughts.map(
      (t) => `[权重 ${((t.confidence / totalWeight) * 100).toFixed(0)}%] ${t.content}`
    )

    return {
      id: generateThoughtId(),
      content: `加权融合结果:\n${weightedContents.join('\n')}`,
      confidence: totalWeight / thoughts.length,
      depth: Math.max(...thoughts.map((t) => t.depth)) + 1,
      timestamp: Date.now(),
      tags: ['default', 'weighted']
    }
  }
}

// ==================== 工具函数 ====================

function generateThoughtId(): string {
  return `thought_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function extractCommonThemes(contents: string[]): string {
  // 简单实现：找出共同词汇
  const wordFreq = new Map<string, number>()

  for (const content of contents) {
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
    const uniqueWords = new Set(words)

    for (const word of uniqueWords) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }
  }

  // 找出出现在多个内容中的词
  const commonWords = Array.from(wordFreq.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)

  return commonWords.length > 0 ? `关键主题: ${commonWords.join(', ')}` : '综合各方观点形成统一认识'
}

function resolveConflict(t1: Thought, t2: Thought): string {
  // 简单实现：选择置信度高的，或尝试调和
  if (Math.abs(t1.confidence - t2.confidence) > 0.3) {
    return t1.confidence > t2.confidence ? `采纳观点A (更高置信度)` : `采纳观点B (更高置信度)`
  }
  return `两种观点均有道理，需要根据具体情境权衡`
}

// ==================== 主服务类 ====================

export class DynamicFusionService {
  private config: DynamicFusionConfig
  private strategies: FusionStrategy[]

  constructor(config: Partial<DynamicFusionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.strategies = this.buildStrategyList()
    logger.info('DynamicFusionService initialized', { config: this.config })
  }

  /**
   * 构建策略列表
   */
  private buildStrategyList(): FusionStrategy[] {
    const builtIn = [consensusStrategy, debateStrategy, expansionStrategy, compressionStrategy, defaultStrategy]

    const all = [...builtIn, ...(this.config.customStrategies || [])]

    // 按优先级排序
    return all.sort((a, b) => a.priority - b.priority)
  }

  /**
   * 执行动态融合
   */
  async fuse(thoughts: Thought[], options: Partial<ThinkingContext> = {}): Promise<FusionResult> {
    const context: ThinkingContext = {
      thoughts,
      depth: options.depth ?? 0,
      maxDepth: options.maxDepth ?? this.config.maxDepth,
      targetConfidence: options.targetConfidence ?? this.config.targetConfidence,
      iteration: options.iteration ?? 0,
      maxIterations: options.maxIterations ?? this.config.maxIterations,
      topic: options.topic,
      constraints: options.constraints,
      fusionHistory: options.fusionHistory ?? []
    }

    return this.recursiveFuse(context)
  }

  /**
   * 递归融合
   */
  private async recursiveFuse(context: ThinkingContext): Promise<FusionResult> {
    if (context.thoughts.length === 0) {
      return {
        thought: {
          id: generateThoughtId(),
          content: '无可用思维',
          confidence: 0,
          depth: 0,
          timestamp: Date.now()
        },
        strategyUsed: 'none',
        confidence: 0,
        iterations: context.iteration,
        fusionChain: context.fusionHistory
      }
    }

    // 检查是否达到目标
    const avgConfidence = context.thoughts.reduce((sum, t) => sum + t.confidence, 0) / context.thoughts.length

    if (avgConfidence >= context.targetConfidence && context.thoughts.length === 1) {
      return {
        thought: context.thoughts[0],
        strategyUsed: 'target_reached',
        confidence: avgConfidence,
        iterations: context.iteration,
        fusionChain: context.fusionHistory
      }
    }

    // 检查迭代限制
    if (context.iteration >= context.maxIterations) {
      logger.warn('Max iterations reached', { iterations: context.iteration })
      // 返回最高置信度的思维
      const best = context.thoughts.reduce((a, b) => (a.confidence > b.confidence ? a : b))
      return {
        thought: best,
        strategyUsed: 'max_iterations',
        confidence: best.confidence,
        iterations: context.iteration,
        fusionChain: context.fusionHistory
      }
    }

    // 选择策略
    const strategy = this.selectStrategy(context)
    logger.debug('Strategy selected', { strategy: strategy.name, iteration: context.iteration })

    // 应用策略
    try {
      const fusedThought = await strategy.apply(context.thoughts, context)

      // 记录融合
      const record: FusionRecord = {
        strategyName: strategy.name,
        inputThoughts: context.thoughts.map((t) => t.id),
        outputThoughtId: fusedThought.id,
        timestamp: Date.now(),
        success: true
      }
      context.fusionHistory.push(record)

      // 检查是否需要继续递归
      if (
        this.config.enableRecursion &&
        fusedThought.confidence < context.targetConfidence &&
        context.depth < context.maxDepth
      ) {
        // 继续递归
        return this.recursiveFuse({
          ...context,
          thoughts: [fusedThought],
          depth: context.depth + 1,
          iteration: context.iteration + 1
        })
      }

      return {
        thought: fusedThought,
        strategyUsed: strategy.name,
        confidence: fusedThought.confidence,
        iterations: context.iteration + 1,
        fusionChain: context.fusionHistory
      }
    } catch (error) {
      logger.error('Fusion failed', { strategy: strategy.name, error })

      // 降级到默认策略
      const fallback = await defaultStrategy.apply(context.thoughts, context)
      return {
        thought: fallback,
        strategyUsed: 'fallback',
        confidence: fallback.confidence,
        iterations: context.iteration + 1,
        fusionChain: context.fusionHistory
      }
    }
  }

  /**
   * 选择最佳策略
   */
  private selectStrategy(context: ThinkingContext): FusionStrategy {
    for (const strategy of this.strategies) {
      if (strategy.condition(context)) {
        return strategy
      }
    }
    return defaultStrategy
  }

  /**
   * 分析思维冲突
   */
  analyzeConflicts(thoughts: Thought[]): Array<{ thought1: string; thought2: string; severity: number }> {
    const conflicts: Array<{ thought1: string; thought2: string; severity: number }> = []

    for (const thought of thoughts) {
      if (thought.disagreesWith) {
        for (const disagreedId of thought.disagreesWith) {
          const disagreedThought = thoughts.find((t) => t.id === disagreedId)
          if (disagreedThought) {
            conflicts.push({
              thought1: thought.id,
              thought2: disagreedId,
              severity: Math.abs(thought.confidence - disagreedThought.confidence)
            })
          }
        }
      }
    }

    return conflicts.sort((a, b) => b.severity - a.severity)
  }

  /**
   * 评估思维链质量
   */
  evaluateChain(thoughts: Thought[]): {
    avgConfidence: number
    maxDepth: number
    conflictCount: number
    coherence: number
  } {
    if (thoughts.length === 0) {
      return { avgConfidence: 0, maxDepth: 0, conflictCount: 0, coherence: 0 }
    }

    const avgConfidence = thoughts.reduce((sum, t) => sum + t.confidence, 0) / thoughts.length
    const maxDepth = Math.max(...thoughts.map((t) => t.depth))
    const conflicts = this.analyzeConflicts(thoughts)

    // 计算连贯性 (相邻思维的关联度)
    let coherence = 1.0
    for (let i = 1; i < thoughts.length; i++) {
      if (thoughts[i].parentId !== thoughts[i - 1].id) {
        coherence *= 0.9 // 无直接关联降低连贯性
      }
    }

    return {
      avgConfidence,
      maxDepth,
      conflictCount: conflicts.length,
      coherence
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 添加自定义策略
   */
  addStrategy(strategy: FusionStrategy): void {
    this.strategies.push(strategy)
    this.strategies.sort((a, b) => a.priority - b.priority)
    logger.info('Custom strategy added', { name: strategy.name, priority: strategy.priority })
  }

  /**
   * 移除策略
   */
  removeStrategy(name: string): boolean {
    const index = this.strategies.findIndex((s) => s.name === name)
    if (index >= 0) {
      this.strategies.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * 获取所有策略名称
   */
  getStrategyNames(): string[] {
    return this.strategies.map((s) => s.name)
  }

  /**
   * 获取可用策略列表 (getStrategyNames 别名)
   */
  getAvailableStrategies(): string[] {
    return this.getStrategyNames()
  }

  /**
   * 根据名称获取策略
   */
  getStrategy(name: string): FusionStrategy | undefined {
    return this.strategies.find((s) => s.name === name)
  }

  /**
   * 用于字符串输入的便捷融合方法
   * 为 MCP 服务器等基于字符串的调用者提供
   */
  async fuseStrings(
    contents: string[],
    context: string,
    strategyName: string = 'consensus'
  ): Promise<{ result: string; confidence: number; iterations: number; metadata?: Record<string, unknown> }> {
    const strategy = this.getStrategy(strategyName)
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyName}`)
    }

    // 将字符串转换为 Thought 对象
    const thoughts: Thought[] = contents.map((content, index) => ({
      id: generateThoughtId(),
      content,
      confidence: 0.7,
      depth: 0,
      timestamp: Date.now(),
      source: `input_${index}`
    }))

    const thinkingContext: ThinkingContext = {
      thoughts,
      depth: 0,
      maxDepth: this.config.maxDepth,
      targetConfidence: this.config.targetConfidence,
      iteration: 0,
      maxIterations: this.config.maxIterations,
      topic: context,
      fusionHistory: []
    }

    // 直接使用指定策略
    const fusedThought = await strategy.apply(thoughts, thinkingContext)

    return {
      result: fusedThought.content,
      confidence: fusedThought.confidence,
      iterations: 1,
      metadata: fusedThought.metadata as Record<string, unknown>
    }
  }

  /**
   * 递归融合字符串版本
   * 为 MCP 服务器等基于字符串的调用者提供
   */
  async recursiveFuseStrings(
    contents: string[],
    context: string,
    options: {
      maxIterations?: number
      convergenceThreshold?: number
      strategy?: string
    } = {}
  ): Promise<{ result: string; confidence: number; iterations: number }> {
    // 将字符串转换为 Thought 对象
    const thoughts: Thought[] = contents.map((content, index) => ({
      id: generateThoughtId(),
      content,
      confidence: 0.7,
      depth: 0,
      timestamp: Date.now(),
      source: `input_${index}`
    }))

    const result = await this.fuse(thoughts, {
      topic: context,
      maxIterations: options.maxIterations ?? 3,
      targetConfidence: options.convergenceThreshold ?? 0.9
    })

    return {
      result: result.thought.content,
      confidence: result.confidence,
      iterations: result.iterations
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DynamicFusionConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.customStrategies) {
      this.strategies = this.buildStrategyList()
    }
    logger.info('Config updated', { config: this.config })
  }

  /**
   * 获取当前配置
   */
  getConfig(): DynamicFusionConfig {
    return { ...this.config }
  }
}

// ==================== 便捷函数 ====================

let defaultService: DynamicFusionService | null = null

export function getDynamicFusionService(): DynamicFusionService {
  if (!defaultService) {
    defaultService = new DynamicFusionService()
  }
  return defaultService
}

/**
 * 创建新的融合服务实例
 */
export function createDynamicFusionService(config?: Partial<DynamicFusionConfig>): DynamicFusionService {
  return new DynamicFusionService(config)
}

/**
 * 快捷融合函数
 */
export async function fuse(thoughts: Thought[], options?: Partial<ThinkingContext>): Promise<FusionResult> {
  return getDynamicFusionService().fuse(thoughts, options)
}

// ==================== 导出内置策略 ====================

export const BUILTIN_STRATEGIES = {
  consensus: consensusStrategy,
  debate: debateStrategy,
  expansion: expansionStrategy,
  compression: compressionStrategy,
  default: defaultStrategy
}
