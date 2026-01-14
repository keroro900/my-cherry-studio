/**
 * DynamicKCalculator - 动态 K 值自动计算器
 *
 * 根据查询复杂度、语料库规模和召回质量自动调整 top_k 值
 *
 * VCPToolBox 对标功能:
 * - 根据召回质量动态调整 K 值
 * - 查询复杂度分析
 * - 语料库规模适配
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('DynamicKCalculator')

// ==================== 类型定义 ====================

/**
 * 查询分析结果
 */
export interface QueryAnalysis {
  /** 查询文本 */
  query: string
  /** 复杂度分数 (0-1) */
  complexity: number
  /** 预估意图数 */
  intentCount: number
  /** 是否包含多个实体 */
  hasMultipleEntities: boolean
  /** 是否是问题型查询 */
  isQuestion: boolean
  /** 关键词数量 */
  keywordCount: number
}

/**
 * 召回质量评估
 */
export interface RetrievalQuality {
  /** 平均相关性分数 */
  averageRelevance: number
  /** 最高分数 */
  maxRelevance: number
  /** 最低分数 */
  minRelevance: number
  /** 分数方差 */
  scoreVariance: number
  /** 高质量结果比例 (relevance > 0.7) */
  highQualityRatio: number
}

/**
 * K 值计算配置
 */
export interface DynamicKConfig {
  /** 基础 K 值 (默认 5) */
  baseK: number
  /** 最小 K 值 (默认 3) */
  minK: number
  /** 最大 K 值 (默认 20) */
  maxK: number
  /** 复杂度阈值 (超过此值增加 K) */
  complexityThreshold: number
  /** 语料库规模阈值 (超过此值增加 K) */
  corpusSizeThreshold: number
  /** 低相关性阈值 (低于此值增加 K) */
  lowRelevanceThreshold: number
}

/**
 * K 值计算结果
 */
export interface DynamicKResult {
  /** 推荐的 K 值 */
  k: number
  /** 计算原因 */
  reasons: string[]
  /** 详细调整记录 */
  adjustments: Array<{ factor: string; delta: number }>
  /** 置信度 (0-1) */
  confidence: number
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: DynamicKConfig = {
  baseK: 5,
  minK: 3,
  maxK: 20,
  complexityThreshold: 0.7,
  corpusSizeThreshold: 10000,
  lowRelevanceThreshold: 0.5
}

// ==================== DynamicKCalculator 实现 ====================

export class DynamicKCalculator {
  private config: DynamicKConfig

  constructor(config: Partial<DynamicKConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.debug('DynamicKCalculator initialized', { config: this.config })
  }

  /**
   * 计算最优 K 值
   */
  calculateOptimalK(queryComplexity: number, corpusSize: number, averageRelevance: number): number {
    let k = this.config.baseK
    const reasons: string[] = []

    // 复杂查询增加 K
    if (queryComplexity > this.config.complexityThreshold) {
      const delta = Math.ceil((queryComplexity - this.config.complexityThreshold) * 5)
      k += delta
      reasons.push(`Complex query (+${delta})`)
    }

    // 大语料库增加 K
    if (corpusSize > this.config.corpusSizeThreshold) {
      const scaleFactor = Math.log10(corpusSize / this.config.corpusSizeThreshold)
      const delta = Math.ceil(scaleFactor * 2)
      k += delta
      reasons.push(`Large corpus (+${delta})`)
    }

    // 低相关性增加 K 扩大搜索范围
    if (averageRelevance < this.config.lowRelevanceThreshold) {
      const delta = Math.ceil((this.config.lowRelevanceThreshold - averageRelevance) * 6)
      k += delta
      reasons.push(`Low relevance (+${delta})`)
    }

    // 高相关性可以减少 K
    if (averageRelevance > 0.85) {
      const delta = Math.floor((averageRelevance - 0.85) * 3)
      k -= delta
      reasons.push(`High relevance (-${delta})`)
    }

    // 限制范围
    k = Math.max(this.config.minK, Math.min(k, this.config.maxK))

    logger.debug('Calculated optimal K', {
      k,
      queryComplexity,
      corpusSize,
      averageRelevance,
      reasons
    })

    return k
  }

  /**
   * 详细计算 K 值 (返回完整分析)
   */
  calculateWithDetails(queryAnalysis: QueryAnalysis, corpusSize: number, quality?: RetrievalQuality): DynamicKResult {
    let k = this.config.baseK
    const adjustments: Array<{ factor: string; delta: number }> = []
    const reasons: string[] = []

    // === 查询复杂度因素 ===

    // 基础复杂度
    if (queryAnalysis.complexity > this.config.complexityThreshold) {
      const delta = Math.ceil((queryAnalysis.complexity - this.config.complexityThreshold) * 5)
      k += delta
      adjustments.push({ factor: 'complexity', delta })
      reasons.push(`Query complexity ${queryAnalysis.complexity.toFixed(2)} > threshold`)
    }

    // 多意图查询
    if (queryAnalysis.intentCount > 1) {
      const delta = queryAnalysis.intentCount - 1
      k += delta
      adjustments.push({ factor: 'multiIntent', delta })
      reasons.push(`Multiple intents detected (${queryAnalysis.intentCount})`)
    }

    // 多实体查询
    if (queryAnalysis.hasMultipleEntities) {
      k += 2
      adjustments.push({ factor: 'multipleEntities', delta: 2 })
      reasons.push('Multiple entities in query')
    }

    // 问题型查询 (通常需要更多召回)
    if (queryAnalysis.isQuestion) {
      k += 1
      adjustments.push({ factor: 'questionQuery', delta: 1 })
      reasons.push('Question-type query')
    }

    // === 语料库规模因素 ===

    if (corpusSize > this.config.corpusSizeThreshold) {
      const scaleFactor = Math.log10(corpusSize / this.config.corpusSizeThreshold)
      const delta = Math.ceil(scaleFactor * 2)
      k += delta
      adjustments.push({ factor: 'corpusSize', delta })
      reasons.push(`Corpus size ${corpusSize} > ${this.config.corpusSizeThreshold}`)
    } else if (corpusSize < 100) {
      // 小语料库可以减少 K
      const delta = -1
      k += delta
      adjustments.push({ factor: 'smallCorpus', delta })
      reasons.push('Small corpus size')
    }

    // === 召回质量因素 (如果有历史数据) ===

    if (quality) {
      // 低平均相关性
      if (quality.averageRelevance < this.config.lowRelevanceThreshold) {
        const delta = Math.ceil((this.config.lowRelevanceThreshold - quality.averageRelevance) * 6)
        k += delta
        adjustments.push({ factor: 'lowRelevance', delta })
        reasons.push(`Low average relevance ${quality.averageRelevance.toFixed(2)}`)
      }

      // 高相关性可以减少 K
      if (quality.averageRelevance > 0.85) {
        const delta = -Math.floor((quality.averageRelevance - 0.85) * 3)
        k += delta
        adjustments.push({ factor: 'highRelevance', delta })
        reasons.push(`High relevance allows smaller K`)
      }

      // 高方差 (结果质量不稳定，需要更多召回)
      if (quality.scoreVariance > 0.15) {
        const delta = Math.ceil(quality.scoreVariance * 4)
        k += delta
        adjustments.push({ factor: 'highVariance', delta })
        reasons.push(`High score variance ${quality.scoreVariance.toFixed(2)}`)
      }

      // 高质量比例低
      if (quality.highQualityRatio < 0.3) {
        const delta = Math.ceil((0.3 - quality.highQualityRatio) * 5)
        k += delta
        adjustments.push({ factor: 'lowQualityRatio', delta })
        reasons.push(`Low quality ratio ${(quality.highQualityRatio * 100).toFixed(0)}%`)
      }
    }

    // 限制范围
    const originalK = k
    k = Math.max(this.config.minK, Math.min(k, this.config.maxK))

    if (k !== originalK) {
      adjustments.push({ factor: 'clamp', delta: k - originalK })
      reasons.push(`Clamped to [${this.config.minK}, ${this.config.maxK}]`)
    }

    // 计算置信度
    const confidence = this.calculateConfidence(queryAnalysis, quality)

    logger.info('Dynamic K calculated', {
      k,
      confidence,
      adjustmentCount: adjustments.length
    })

    return {
      k,
      reasons,
      adjustments,
      confidence
    }
  }

  /**
   * 分析查询复杂度
   */
  analyzeQuery(query: string): QueryAnalysis {
    const normalized = query.toLowerCase().trim()

    // 关键词数量
    const words = normalized.split(/\s+/).filter((w) => w.length > 1)
    const keywordCount = words.length

    // 检测问题类型
    const questionPatterns = /^(what|who|where|when|why|how|which|是什么|为什么|怎么|如何|哪里|谁|什么时候)/i
    const isQuestion = questionPatterns.test(normalized) || normalized.includes('?') || normalized.includes('？')

    // 检测多实体 (简单启发式)
    const entityPatterns = /[A-Z][a-z]+|"[^"]+"|'[^']+'|「[^」]+」|《[^》]+》/g
    const entities = normalized.match(entityPatterns) || []
    const hasMultipleEntities = entities.length > 1

    // 估算意图数 (基于连接词)
    const intentConnectors = /\s(and|or|以及|或者|还有|同时|另外)\s/gi
    const connectorMatches = normalized.match(intentConnectors) || []
    const intentCount = Math.min(connectorMatches.length + 1, 5)

    // 计算复杂度分数
    let complexity = 0

    // 长度因素
    complexity += Math.min(keywordCount / 15, 0.3)

    // 问题因素
    if (isQuestion) complexity += 0.1

    // 多实体因素
    if (hasMultipleEntities) complexity += 0.15

    // 多意图因素
    complexity += (intentCount - 1) * 0.1

    // 特殊字符因素 (技术查询)
    if (/[<>{}()[\]]/.test(query)) complexity += 0.1

    // 数字因素 (具体查询)
    if (/\d{4,}/.test(query)) complexity += 0.05

    complexity = Math.min(complexity, 1.0)

    return {
      query,
      complexity,
      intentCount,
      hasMultipleEntities,
      isQuestion,
      keywordCount
    }
  }

  /**
   * 评估召回质量
   */
  evaluateQuality(scores: number[]): RetrievalQuality {
    if (scores.length === 0) {
      return {
        averageRelevance: 0,
        maxRelevance: 0,
        minRelevance: 0,
        scoreVariance: 0,
        highQualityRatio: 0
      }
    }

    const sorted = [...scores].sort((a, b) => b - a)
    const sum = scores.reduce((a, b) => a + b, 0)
    const average = sum / scores.length

    // 计算方差
    const squaredDiffs = scores.map((s) => Math.pow(s - average, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / scores.length

    // 高质量比例
    const highQualityCount = scores.filter((s) => s > 0.7).length

    return {
      averageRelevance: average,
      maxRelevance: sorted[0],
      minRelevance: sorted[sorted.length - 1],
      scoreVariance: variance,
      highQualityRatio: highQualityCount / scores.length
    }
  }

  /**
   * 自适应 K 值 (基于上一轮结果)
   */
  adaptK(previousK: number, previousScores: number[], targetQuality: number = 0.7): number {
    const quality = this.evaluateQuality(previousScores)

    // 如果质量已经很好，可以减少 K
    if (quality.averageRelevance >= targetQuality && quality.highQualityRatio >= 0.5) {
      return Math.max(this.config.minK, previousK - 1)
    }

    // 如果质量不足，增加 K
    if (quality.averageRelevance < targetQuality * 0.8) {
      return Math.min(this.config.maxK, previousK + 2)
    }

    // 保持不变
    return previousK
  }

  /**
   * 获取配置
   */
  getConfig(): DynamicKConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DynamicKConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('DynamicKCalculator config updated', { config: this.config })
  }

  // ==================== 私有方法 ====================

  private calculateConfidence(analysis: QueryAnalysis, quality?: RetrievalQuality): number {
    let confidence = 0.7 // 基础置信度

    // 查询越清晰，置信度越高
    if (analysis.complexity < 0.3) confidence += 0.1
    if (analysis.intentCount === 1) confidence += 0.1

    // 有历史质量数据，置信度更高
    if (quality) {
      confidence += 0.1
      // 质量稳定，置信度更高
      if (quality.scoreVariance < 0.1) confidence += 0.05
    }

    return Math.min(confidence, 1.0)
  }
}

// ==================== 便捷函数 ====================

let defaultCalculator: DynamicKCalculator | null = null

export function getDynamicKCalculator(): DynamicKCalculator {
  if (!defaultCalculator) {
    defaultCalculator = new DynamicKCalculator()
  }
  return defaultCalculator
}

/**
 * 快捷计算 K 值
 */
export function calculateOptimalK(queryComplexity: number, corpusSize: number, averageRelevance: number): number {
  return getDynamicKCalculator().calculateOptimalK(queryComplexity, corpusSize, averageRelevance)
}
