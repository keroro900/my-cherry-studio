/**
 * HallucinationSuppressor - 幻觉抑制模块
 *
 * 检测和抑制 AI 输出中的幻觉：
 * 1. 语义距离量化 - 检测输出与上下文的偏离程度
 * 2. 事实一致性检查 - 与知识库/上下文对比
 * 3. 自动修复 - 对困惑型幻觉进行修正
 * 4. 置信度评估 - 标记不确定的输出
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('HallucinationSuppressor')

/**
 * 幻觉类型
 */
export type HallucinationType =
  | 'factual' // 事实性幻觉 - 编造不存在的事实
  | 'contextual' // 上下文幻觉 - 与对话上下文矛盾
  | 'temporal' // 时间幻觉 - 时间/日期错误
  | 'attribution' // 归因幻觉 - 错误引用来源
  | 'logical' // 逻辑幻觉 - 推理错误
  | 'confabulation' // 困惑型幻觉 - 填补空白的编造

/**
 * 幻觉检测结果
 */
export interface HallucinationDetection {
  type: HallucinationType
  severity: 'low' | 'medium' | 'high' | 'critical'
  span: { start: number; end: number }
  text: string
  reason: string
  confidence: number
  suggestion?: string
}

/**
 * 抑制配置
 */
export interface SuppressorConfig {
  /** 启用检测 */
  enabled?: boolean
  /** 语义距离阈值 (0-1, 越高越严格) */
  semanticThreshold?: number
  /** 事实检查严格程度 */
  factCheckLevel?: 'relaxed' | 'normal' | 'strict'
  /** 自动修复 */
  autoFix?: boolean
  /** 标记不确定内容 */
  markUncertain?: boolean
  /** 不确定标记格式 */
  uncertainMarker?: string
  /** 知识库参考 (用于事实检查) */
  knowledgeBase?: KnowledgeReference[]
  /** 上下文窗口 */
  contextWindow?: string[]
  /** 禁用的检查类型 */
  disabledChecks?: HallucinationType[]
}

/**
 * 知识参考
 */
export interface KnowledgeReference {
  content: string
  source: string
  confidence: number
}

/**
 * 抑制结果
 */
export interface SuppressionResult {
  originalText: string
  processedText: string
  detections: HallucinationDetection[]
  overallConfidence: number
  wasModified: boolean
  modifications: {
    type: 'fix' | 'mark' | 'remove'
    original: string
    replacement: string
    reason: string
  }[]
}

/**
 * 幻觉抑制器
 */
export class HallucinationSuppressor {
  private config: Required<SuppressorConfig>

  // 常见幻觉模式
  private readonly hallucinationPatterns = {
    // 虚假确定性
    falseConfidence: [
      /众所周知[，,]/g,
      /毫无疑问[，,]/g,
      /显而易见[，,]/g,
      /毋庸置疑[，,]/g,
      /据我所知[，,]/g,
      /研究表明[，,](?!.*来源)/g,
      /专家指出[，,](?!.*\[)/g
    ],
    // 虚假引用
    falseAttribution: [
      /据.{2,10}报道[，,](?!.*http|www)/g,
      /根据.{2,15}的研究[，,](?!.*\d{4})/g,
      /\d{4}年.{2,20}发表[，,](?!.*DOI|ISBN)/g
    ],
    // 过度泛化
    overgeneralization: [/所有.{2,10}都/g, /从来没有.{2,10}过/g, /永远不会/g, /百分之百/g, /绝对不可能/g],
    // 时间模糊
    temporalAmbiguity: [/最近[，,](?!.*\d)/g, /近年来[，,](?!.*\d)/g, /不久前[，,](?!.*\d)/g]
  }

  // 不确定性表达
  private readonly uncertaintyMarkers = [
    '可能',
    '或许',
    '大概',
    '似乎',
    '据说',
    '我认为',
    '我觉得',
    '我推测',
    '我猜',
    '如果我没记错',
    '我不确定但',
    'maybe',
    'perhaps',
    'probably',
    'possibly',
    'I think',
    'I believe',
    'It seems'
  ]

  constructor(config: SuppressorConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      semanticThreshold: config.semanticThreshold ?? 0.7,
      factCheckLevel: config.factCheckLevel ?? 'normal',
      autoFix: config.autoFix ?? true,
      markUncertain: config.markUncertain ?? true,
      uncertainMarker: config.uncertainMarker ?? '⚠️',
      knowledgeBase: config.knowledgeBase ?? [],
      contextWindow: config.contextWindow ?? [],
      disabledChecks: config.disabledChecks ?? []
    }
  }

  /**
   * 分析并抑制幻觉
   */
  async suppress(
    text: string,
    context?: {
      conversationHistory?: string[]
      knowledgeBase?: KnowledgeReference[]
      userQuery?: string
    }
  ): Promise<SuppressionResult> {
    if (!this.config.enabled) {
      return {
        originalText: text,
        processedText: text,
        detections: [],
        overallConfidence: 1.0,
        wasModified: false,
        modifications: []
      }
    }

    const detections: HallucinationDetection[] = []
    const modifications: SuppressionResult['modifications'] = []
    let processedText = text

    // 更新上下文
    if (context?.conversationHistory) {
      this.config.contextWindow = context.conversationHistory
    }
    if (context?.knowledgeBase) {
      this.config.knowledgeBase = context.knowledgeBase
    }

    logger.debug('Starting hallucination analysis', { textLength: text.length })

    // 1. 模式检测
    const patternDetections = this.detectPatterns(text)
    detections.push(...patternDetections)

    // 2. 上下文一致性检查
    if (!this.config.disabledChecks.includes('contextual')) {
      const contextDetections = this.checkContextConsistency(text)
      detections.push(...contextDetections)
    }

    // 3. 事实一致性检查
    if (!this.config.disabledChecks.includes('factual') && this.config.knowledgeBase.length > 0) {
      const factDetections = this.checkFactualConsistency(text)
      detections.push(...factDetections)
    }

    // 4. 置信度分析
    const uncertainSections = this.analyzeConfidence(text)

    // 5. 应用修复/标记
    if (this.config.autoFix || this.config.markUncertain) {
      const result = this.applyModifications(processedText, detections, uncertainSections)
      processedText = result.text
      modifications.push(...result.modifications)
    }

    // 计算整体置信度
    const overallConfidence = this.calculateOverallConfidence(detections)

    const result: SuppressionResult = {
      originalText: text,
      processedText,
      detections,
      overallConfidence,
      wasModified: processedText !== text,
      modifications
    }

    logger.info('Hallucination analysis complete', {
      detectionsCount: detections.length,
      overallConfidence,
      wasModified: result.wasModified
    })

    return result
  }

  /**
   * 模式检测
   */
  private detectPatterns(text: string): HallucinationDetection[] {
    const detections: HallucinationDetection[] = []

    // 检测虚假确定性
    for (const pattern of this.hallucinationPatterns.falseConfidence) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match.index !== undefined) {
          detections.push({
            type: 'confabulation',
            severity: 'low',
            span: { start: match.index, end: match.index + match[0].length },
            text: match[0],
            reason: '使用了过于确定的表述，缺乏来源支持',
            confidence: 0.7,
            suggestion: '添加适当的不确定性表达或引用来源'
          })
        }
      }
    }

    // 检测虚假引用
    for (const pattern of this.hallucinationPatterns.falseAttribution) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match.index !== undefined) {
          detections.push({
            type: 'attribution',
            severity: 'medium',
            span: { start: match.index, end: match.index + match[0].length },
            text: match[0],
            reason: '引用缺乏具体来源或验证信息',
            confidence: 0.8,
            suggestion: '提供具体的来源链接或移除引用声明'
          })
        }
      }
    }

    // 检测过度泛化
    for (const pattern of this.hallucinationPatterns.overgeneralization) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match.index !== undefined) {
          detections.push({
            type: 'logical',
            severity: 'low',
            span: { start: match.index, end: match.index + match[0].length },
            text: match[0],
            reason: '使用了绝对化表述，可能过度泛化',
            confidence: 0.6,
            suggestion: '使用更精确的量化表述'
          })
        }
      }
    }

    return detections
  }

  /**
   * 上下文一致性检查
   */
  private checkContextConsistency(text: string): HallucinationDetection[] {
    const detections: HallucinationDetection[] = []

    if (this.config.contextWindow.length === 0) {
      return detections
    }

    // 提取关键实体和事实
    const contextFacts = this.extractFacts(this.config.contextWindow.join('\n'))
    const outputFacts = this.extractFacts(text)

    // 检查矛盾
    for (const outputFact of outputFacts) {
      for (const contextFact of contextFacts) {
        if (this.isContradictory(outputFact, contextFact)) {
          detections.push({
            type: 'contextual',
            severity: 'high',
            span: { start: 0, end: outputFact.text.length },
            text: outputFact.text,
            reason: `与上下文中的 "${contextFact.text}" 可能存在矛盾`,
            confidence: 0.85,
            suggestion: '检查与之前对话内容的一致性'
          })
        }
      }
    }

    return detections
  }

  /**
   * 事实一致性检查
   */
  private checkFactualConsistency(text: string): HallucinationDetection[] {
    const detections: HallucinationDetection[] = []

    // 提取输出中的事实性陈述
    const claims = this.extractClaims(text)

    for (const claim of claims) {
      // 与知识库对比
      const verification = this.verifyAgainstKnowledge(claim)

      if (verification.isContradicted) {
        detections.push({
          type: 'factual',
          severity: 'critical',
          span: claim.span,
          text: claim.text,
          reason: `与知识库内容矛盾: ${verification.contradictingSource}`,
          confidence: verification.confidence,
          suggestion: verification.suggestion
        })
      } else if (verification.isUnsupported) {
        detections.push({
          type: 'factual',
          severity: 'medium',
          span: claim.span,
          text: claim.text,
          reason: '在知识库中找不到支持此陈述的内容',
          confidence: verification.confidence,
          suggestion: '标记为不确定或移除此声明'
        })
      }
    }

    return detections
  }

  /**
   * 分析置信度
   */
  private analyzeConfidence(text: string): { start: number; end: number; confidence: number }[] {
    const sections: { start: number; end: number; confidence: number }[] = []

    // 按句子分割
    const sentences = text.split(/[。.!?！？]/).filter((s) => s.trim())
    let position = 0

    for (const sentence of sentences) {
      const start = text.indexOf(sentence, position)
      const end = start + sentence.length

      // 检查不确定性标记
      let confidence = 0.9 // 基础置信度

      for (const marker of this.uncertaintyMarkers) {
        if (sentence.includes(marker)) {
          confidence = 0.6 // 已有不确定标记，降低置信度
          break
        }
      }

      // 检查是否包含幻觉模式
      for (const patterns of Object.values(this.hallucinationPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(sentence)) {
            confidence *= 0.8
            break
          }
        }
      }

      sections.push({ start, end, confidence })
      position = end
    }

    return sections
  }

  /**
   * 应用修改
   */
  private applyModifications(
    text: string,
    detections: HallucinationDetection[],
    _uncertainSections: { start: number; end: number; confidence: number }[]
  ): { text: string; modifications: SuppressionResult['modifications'] } {
    const modifications: SuppressionResult['modifications'] = []
    let result = text

    // 按位置排序 (从后向前修改，避免位置偏移)
    const sortedDetections = [...detections].sort((a, b) => b.span.start - a.span.start)

    for (const detection of sortedDetections) {
      if (detection.severity === 'critical' && this.config.autoFix && detection.suggestion) {
        // 严重问题: 尝试修复
        const original = result.slice(detection.span.start, detection.span.end)
        const replacement = this.generateFix(detection)

        result = result.slice(0, detection.span.start) + replacement + result.slice(detection.span.end)
        modifications.push({
          type: 'fix',
          original,
          replacement,
          reason: detection.reason
        })
      } else if (detection.severity === 'high' && this.config.markUncertain) {
        // 高严重性: 标记
        const original = result.slice(detection.span.start, detection.span.end)
        const replacement = `${this.config.uncertainMarker} ${original}`

        result = result.slice(0, detection.span.start) + replacement + result.slice(detection.span.end)
        modifications.push({
          type: 'mark',
          original,
          replacement,
          reason: detection.reason
        })
      }
    }

    return { text: result, modifications }
  }

  /**
   * 生成修复建议
   */
  private generateFix(detection: HallucinationDetection): string {
    switch (detection.type) {
      case 'attribution':
        // 移除无来源的引用声明
        return detection.text.replace(/据.*报道[，,]|根据.*研究[，,]/g, '')

      case 'confabulation':
        // 添加不确定性表达
        return detection.text.replace(/众所周知|毫无疑问|显而易见/g, '可能')

      case 'factual':
        // 标记为不确定
        return `(待验证) ${detection.text}`

      default:
        return detection.text
    }
  }

  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(detections: HallucinationDetection[]): number {
    if (detections.length === 0) return 1.0

    // 基于检测的严重性和数量计算
    let penalty = 0
    for (const detection of detections) {
      switch (detection.severity) {
        case 'critical':
          penalty += 0.3
          break
        case 'high':
          penalty += 0.15
          break
        case 'medium':
          penalty += 0.08
          break
        case 'low':
          penalty += 0.03
          break
      }
    }

    return Math.max(0, 1 - penalty)
  }

  /**
   * 提取事实
   */
  private extractFacts(text: string): { text: string; type: string }[] {
    const facts: { text: string; type: string }[] = []

    // 简单的事实提取 (可以用更复杂的 NLP)
    const sentences = text.split(/[。.!?！？]/).filter((s) => s.trim())

    for (const sentence of sentences) {
      // 包含数字的陈述
      if (/\d+/.test(sentence)) {
        facts.push({ text: sentence.trim(), type: 'numeric' })
      }
      // 包含专有名词的陈述
      if (/[A-Z][a-z]+|[\u4e00-\u9fff]{2,}/.test(sentence)) {
        facts.push({ text: sentence.trim(), type: 'entity' })
      }
    }

    return facts
  }

  /**
   * 提取声明
   */
  private extractClaims(text: string): { text: string; span: { start: number; end: number } }[] {
    const claims: { text: string; span: { start: number; end: number } }[] = []
    const sentences = text.split(/[。.!?！？]/)

    let position = 0
    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (trimmed.length > 10) {
        const start = text.indexOf(trimmed, position)
        claims.push({
          text: trimmed,
          span: { start, end: start + trimmed.length }
        })
      }
      position += sentence.length + 1
    }

    return claims
  }

  /**
   * 检查矛盾
   */
  private isContradictory(a: { text: string }, b: { text: string }): boolean {
    // 简单的矛盾检测 (否定词)
    const negations = ['不', '没', '无', '非', '未', 'not', "don't", "doesn't", "isn't"]

    for (const neg of negations) {
      if (a.text.includes(neg) !== b.text.includes(neg)) {
        // 计算去除否定词后的相似度
        const aNorm = a.text.replace(new RegExp(neg, 'g'), '')
        const bNorm = b.text.replace(new RegExp(neg, 'g'), '')

        if (this.calculateSimilarity(aNorm, bNorm) > 0.6) {
          return true
        }
      }
    }

    return false
  }

  /**
   * 验证知识
   */
  private verifyAgainstKnowledge(claim: { text: string }): {
    isContradicted: boolean
    isUnsupported: boolean
    confidence: number
    contradictingSource?: string
    suggestion?: string
  } {
    if (this.config.knowledgeBase.length === 0) {
      return { isContradicted: false, isUnsupported: false, confidence: 0.5 }
    }

    let bestMatch: KnowledgeReference | null = null
    let bestSimilarity = 0
    let isContradicted = false

    for (const ref of this.config.knowledgeBase) {
      const similarity = this.calculateSimilarity(claim.text, ref.content)

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = ref
      }

      // 检查矛盾
      if (this.isContradictory({ text: claim.text }, { text: ref.content })) {
        isContradicted = true
      }
    }

    return {
      isContradicted,
      isUnsupported: bestSimilarity < 0.3,
      confidence: bestSimilarity,
      contradictingSource: isContradicted && bestMatch ? bestMatch.source : undefined,
      suggestion: isContradicted ? `参考正确信息: ${bestMatch?.content.slice(0, 100)}...` : undefined
    }
  }

  /**
   * 计算相似度
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/))
    const wordsB = new Set(b.toLowerCase().split(/\s+/))

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)))
    const union = new Set([...wordsA, ...wordsB])

    return intersection.size / union.size
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SuppressorConfig>): void {
    Object.assign(this.config, config)
  }

  /**
   * 获取配置
   */
  getConfig(): Required<SuppressorConfig> {
    return { ...this.config }
  }
}

// 单例
let _instance: HallucinationSuppressor | null = null

export function getHallucinationSuppressor(): HallucinationSuppressor {
  if (!_instance) {
    _instance = new HallucinationSuppressor()
  }
  return _instance
}

export function createHallucinationSuppressor(config?: SuppressorConfig): HallucinationSuppressor {
  return new HallucinationSuppressor(config)
}
