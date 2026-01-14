/**
 * 精细化行为调控服务
 *
 * 实现 VCPToolBox 的行为调控功能:
 * - {{Sar*}} 模型适配: 为不同模型注入特定指令
 * - DetectorX: 检测并替换系统提示词中的模式
 * - SuperDetectorX: 检测并修正 AI 输出中的问题
 * - 口头禅抑制: 自动移除 AI 的重复语言模式
 */

import { loggerService } from '@logger'
import { v4 as uuid } from 'uuid'

const logger = loggerService.withContext('BehaviorControlService')

// ==================== 类型定义 ====================

/**
 * 模型适配规则
 */
export interface ModelAdaptationRule {
  id: string
  name: string
  modelPattern: string | RegExp // 匹配的模型 ID 模式
  instruction: string // 要注入的指令
  position: 'prefix' | 'suffix' | 'replace' // 注入位置
  priority: number // 优先级，数字越大越优先
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * DetectorX 规则 - 检测并替换系统提示词中的模式
 */
export interface DetectorXRule {
  id: string
  name: string
  description?: string
  pattern: string | RegExp // 要检测的模式
  replacement: string | ((match: string, ...groups: string[]) => string)
  flags?: string // 正则标志
  isActive: boolean
  priority: number
  statistics: {
    matchCount: number
    lastMatchAt?: Date
  }
  createdAt: Date
  updatedAt: Date
}

/**
 * SuperDetectorX 规则 - 检测并修正 AI 输出
 */
export interface SuperDetectorXRule {
  id: string
  name: string
  description?: string
  pattern: string | RegExp
  action: 'remove' | 'replace' | 'warn' | 'block'
  replacement?: string
  warningMessage?: string
  isActive: boolean
  priority: number
  statistics: {
    matchCount: number
    lastMatchAt?: Date
  }
  createdAt: Date
  updatedAt: Date
}

/**
 * 口头禅抑制规则
 */
export interface PhraseSuppressionRule {
  id: string
  phrase: string // 要抑制的短语
  alternatives?: string[] // 可替换的表达
  maxOccurrences: number // 允许的最大出现次数
  action: 'remove' | 'replace' | 'limit'
  isActive: boolean
  statistics: {
    suppressedCount: number
    lastSuppressedAt?: Date
  }
  createdAt: Date
}

/**
 * 行为调控配置
 */
export interface BehaviorControlConfig {
  enableModelAdaptation: boolean
  enableDetectorX: boolean
  enableSuperDetectorX: boolean
  enablePhraseSuppress: boolean
  defaultPhraseMaxOccurrences: number
}

// ==================== 预置规则 ====================

/**
 * 预置的模型适配规则
 */
const PRESET_MODEL_ADAPTATIONS: Omit<ModelAdaptationRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Claude 系列',
    modelPattern: 'claude',
    instruction: '请以专业、友好的方式回答，避免过度使用 "certainly" 和 "I\'d be happy to"。',
    position: 'suffix',
    priority: 10,
    isActive: true
  },
  {
    name: 'GPT-4 系列',
    modelPattern: 'gpt-4',
    instruction: '请给出详细且结构化的回答。',
    position: 'suffix',
    priority: 10,
    isActive: true
  },
  {
    name: 'Gemini 系列',
    modelPattern: 'gemini',
    instruction: '请注意回答的准确性，避免幻觉。',
    position: 'suffix',
    priority: 10,
    isActive: true
  },
  {
    name: 'DeepSeek 系列',
    modelPattern: 'deepseek',
    instruction: '请提供专业且实用的回答，必要时展示思考过程。',
    position: 'suffix',
    priority: 10,
    isActive: true
  }
]

/**
 * 预置的口头禅抑制规则
 */
const PRESET_PHRASE_SUPPRESSIONS: Omit<PhraseSuppressionRule, 'id' | 'createdAt' | 'statistics'>[] = [
  {
    phrase: '我是一个AI助手',
    alternatives: [],
    maxOccurrences: 0,
    action: 'remove',
    isActive: true
  },
  {
    phrase: '作为一个人工智能',
    alternatives: [],
    maxOccurrences: 0,
    action: 'remove',
    isActive: true
  },
  {
    phrase: 'certainly',
    alternatives: ['好的', '没问题', '当然可以'],
    maxOccurrences: 1,
    action: 'limit',
    isActive: true
  },
  {
    phrase: "I'd be happy to",
    alternatives: ['我来', '让我'],
    maxOccurrences: 1,
    action: 'limit',
    isActive: true
  },
  {
    phrase: '首先让我',
    alternatives: [],
    maxOccurrences: 1,
    action: 'limit',
    isActive: true
  }
]

// ==================== 服务实现 ====================

class BehaviorControlService {
  private config: BehaviorControlConfig = {
    enableModelAdaptation: true,
    enableDetectorX: true,
    enableSuperDetectorX: true,
    enablePhraseSuppress: true,
    defaultPhraseMaxOccurrences: 2
  }

  private modelAdaptations: Map<string, ModelAdaptationRule> = new Map()
  private detectorXRules: Map<string, DetectorXRule> = new Map()
  private superDetectorXRules: Map<string, SuperDetectorXRule> = new Map()
  private phraseSuppressions: Map<string, PhraseSuppressionRule> = new Map()

  constructor() {
    this.initPresetRules()
  }

  private initPresetRules(): void {
    // 初始化预置模型适配规则
    PRESET_MODEL_ADAPTATIONS.forEach((rule) => {
      const fullRule: ModelAdaptationRule = {
        ...rule,
        id: uuid(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
      this.modelAdaptations.set(fullRule.id, fullRule)
    })

    // 初始化预置口头禅抑制规则
    PRESET_PHRASE_SUPPRESSIONS.forEach((rule) => {
      const fullRule: PhraseSuppressionRule = {
        ...rule,
        id: uuid(),
        createdAt: new Date(),
        statistics: { suppressedCount: 0 }
      }
      this.phraseSuppressions.set(fullRule.id, fullRule)
    })

    logger.info('Behavior control preset rules initialized')
  }

  // ==================== 配置管理 ====================

  updateConfig(config: Partial<BehaviorControlConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('Behavior control config updated:', this.config)
  }

  getConfig(): BehaviorControlConfig {
    return { ...this.config }
  }

  // ==================== 模型适配 ====================

  /**
   * 添加模型适配规则
   */
  addModelAdaptation(rule: Omit<ModelAdaptationRule, 'id' | 'createdAt' | 'updatedAt'>): ModelAdaptationRule {
    const fullRule: ModelAdaptationRule = {
      ...rule,
      id: uuid(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
    this.modelAdaptations.set(fullRule.id, fullRule)
    return fullRule
  }

  /**
   * 更新模型适配规则
   */
  updateModelAdaptation(id: string, updates: Partial<ModelAdaptationRule>): ModelAdaptationRule | null {
    const rule = this.modelAdaptations.get(id)
    if (!rule) return null

    Object.assign(rule, updates, { updatedAt: new Date() })
    return rule
  }

  /**
   * 删除模型适配规则
   */
  deleteModelAdaptation(id: string): boolean {
    return this.modelAdaptations.delete(id)
  }

  /**
   * 获取所有模型适配规则
   */
  getAllModelAdaptations(): ModelAdaptationRule[] {
    return Array.from(this.modelAdaptations.values())
  }

  /**
   * 应用模型适配
   */
  applyModelAdaptation(systemPrompt: string, modelId: string): string {
    if (!this.config.enableModelAdaptation) return systemPrompt

    const applicableRules = Array.from(this.modelAdaptations.values())
      .filter((rule) => {
        if (!rule.isActive) return false

        const pattern = typeof rule.modelPattern === 'string' ? new RegExp(rule.modelPattern, 'i') : rule.modelPattern

        return pattern.test(modelId)
      })
      .sort((a, b) => b.priority - a.priority)

    let result = systemPrompt

    applicableRules.forEach((rule) => {
      switch (rule.position) {
        case 'prefix':
          result = `${rule.instruction}\n\n${result}`
          break
        case 'suffix':
          result = `${result}\n\n${rule.instruction}`
          break
        case 'replace':
          result = rule.instruction
          break
      }
    })

    if (applicableRules.length > 0) {
      logger.debug('Model adaptation applied:', { modelId, rulesApplied: applicableRules.length })
    }

    return result
  }

  // ==================== DetectorX ====================

  /**
   * 添加 DetectorX 规则
   */
  addDetectorXRule(rule: Omit<DetectorXRule, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>): DetectorXRule {
    const fullRule: DetectorXRule = {
      ...rule,
      id: uuid(),
      statistics: { matchCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    this.detectorXRules.set(fullRule.id, fullRule)
    return fullRule
  }

  /**
   * 删除 DetectorX 规则
   */
  deleteDetectorXRule(id: string): boolean {
    return this.detectorXRules.delete(id)
  }

  /**
   * 获取所有 DetectorX 规则
   */
  getAllDetectorXRules(): DetectorXRule[] {
    return Array.from(this.detectorXRules.values())
  }

  /**
   * 应用 DetectorX 规则到系统提示词
   */
  applyDetectorX(text: string): { result: string; matchedRules: string[] } {
    if (!this.config.enableDetectorX) return { result: text, matchedRules: [] }

    let result = text
    const matchedRules: string[] = []

    const rules = Array.from(this.detectorXRules.values())
      .filter((r) => r.isActive)
      .sort((a, b) => b.priority - a.priority)

    rules.forEach((rule) => {
      const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, rule.flags || 'g') : rule.pattern

      if (pattern.test(result)) {
        matchedRules.push(rule.name)
        rule.statistics.matchCount++
        rule.statistics.lastMatchAt = new Date()

        if (typeof rule.replacement === 'string') {
          result = result.replace(pattern, rule.replacement)
        } else {
          result = result.replace(pattern, rule.replacement)
        }
      }
    })

    if (matchedRules.length > 0) {
      logger.debug('DetectorX applied:', { matchedRules })
    }

    return { result, matchedRules }
  }

  // ==================== SuperDetectorX ====================

  /**
   * 添加 SuperDetectorX 规则
   */
  addSuperDetectorXRule(
    rule: Omit<SuperDetectorXRule, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>
  ): SuperDetectorXRule {
    const fullRule: SuperDetectorXRule = {
      ...rule,
      id: uuid(),
      statistics: { matchCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    this.superDetectorXRules.set(fullRule.id, fullRule)
    return fullRule
  }

  /**
   * 获取所有 SuperDetectorX 规则
   */
  getAllSuperDetectorXRules(): SuperDetectorXRule[] {
    return Array.from(this.superDetectorXRules.values())
  }

  /**
   * 应用 SuperDetectorX 规则到 AI 输出
   */
  applySuperDetectorX(output: string): {
    result: string
    matchedRules: string[]
    warnings: string[]
    blocked: boolean
  } {
    if (!this.config.enableSuperDetectorX) {
      return { result: output, matchedRules: [], warnings: [], blocked: false }
    }

    let result = output
    const matchedRules: string[] = []
    const warnings: string[] = []
    let blocked = false

    const rules = Array.from(this.superDetectorXRules.values())
      .filter((r) => r.isActive)
      .sort((a, b) => b.priority - a.priority)

    for (const rule of rules) {
      const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'gi') : rule.pattern

      if (pattern.test(result)) {
        matchedRules.push(rule.name)
        rule.statistics.matchCount++
        rule.statistics.lastMatchAt = new Date()

        switch (rule.action) {
          case 'remove':
            result = result.replace(pattern, '')
            break
          case 'replace':
            result = result.replace(pattern, rule.replacement || '')
            break
          case 'warn':
            warnings.push(rule.warningMessage || `检测到: ${rule.name}`)
            break
          case 'block':
            blocked = true
            logger.warn('SuperDetectorX blocked output:', { ruleName: rule.name })
            return { result: '', matchedRules, warnings, blocked: true }
        }
      }
    }

    if (matchedRules.length > 0) {
      logger.debug('SuperDetectorX applied:', { matchedRules, warnings })
    }

    return { result, matchedRules, warnings, blocked }
  }

  // ==================== 口头禅抑制 ====================

  /**
   * 添加口头禅抑制规则
   */
  addPhraseSuppression(rule: Omit<PhraseSuppressionRule, 'id' | 'createdAt' | 'statistics'>): PhraseSuppressionRule {
    const fullRule: PhraseSuppressionRule = {
      ...rule,
      id: uuid(),
      createdAt: new Date(),
      statistics: { suppressedCount: 0 }
    }
    this.phraseSuppressions.set(fullRule.id, fullRule)
    return fullRule
  }

  /**
   * 获取所有口头禅抑制规则
   */
  getAllPhraseSuppressions(): PhraseSuppressionRule[] {
    return Array.from(this.phraseSuppressions.values())
  }

  /**
   * 应用口头禅抑制
   */
  applyPhraseSuppression(text: string): { result: string; suppressedPhrases: string[] } {
    if (!this.config.enablePhraseSuppress) return { result: text, suppressedPhrases: [] }

    let result = text
    const suppressedPhrases: string[] = []

    const rules = Array.from(this.phraseSuppressions.values()).filter((r) => r.isActive)

    rules.forEach((rule) => {
      const pattern = new RegExp(rule.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matches = result.match(pattern)

      if (matches && matches.length > 0) {
        switch (rule.action) {
          case 'remove':
            result = result.replace(pattern, '')
            suppressedPhrases.push(rule.phrase)
            rule.statistics.suppressedCount += matches.length
            break

          case 'replace':
            if (rule.alternatives && rule.alternatives.length > 0) {
              let matchIndex = 0
              result = result.replace(pattern, () => {
                const replacement = rule.alternatives![matchIndex % rule.alternatives!.length]
                matchIndex++
                return replacement
              })
              suppressedPhrases.push(rule.phrase)
              rule.statistics.suppressedCount += matches.length
            }
            break

          case 'limit':
            if (matches.length > rule.maxOccurrences) {
              let count = 0
              result = result.replace(pattern, (match) => {
                count++
                if (count > rule.maxOccurrences) {
                  rule.statistics.suppressedCount++
                  return rule.alternatives && rule.alternatives.length > 0
                    ? rule.alternatives[Math.floor(Math.random() * rule.alternatives.length)]
                    : ''
                }
                return match
              })
              suppressedPhrases.push(rule.phrase)
            }
            break
        }

        if (suppressedPhrases.includes(rule.phrase)) {
          rule.statistics.lastSuppressedAt = new Date()
        }
      }
    })

    if (suppressedPhrases.length > 0) {
      logger.debug('Phrase suppression applied:', { suppressedPhrases })
    }

    return { result, suppressedPhrases }
  }

  // ==================== 综合处理 ====================

  /**
   * 处理系统提示词
   */
  processSystemPrompt(
    systemPrompt: string,
    modelId: string
  ): {
    result: string
    adaptationsApplied: boolean
    detectionsApplied: string[]
  } {
    // 1. 应用 DetectorX
    const { result: detectedResult, matchedRules } = this.applyDetectorX(systemPrompt)

    // 2. 应用模型适配
    const result = this.applyModelAdaptation(detectedResult, modelId)

    return {
      result,
      adaptationsApplied: result !== detectedResult,
      detectionsApplied: matchedRules
    }
  }

  /**
   * 处理 AI 输出
   */
  processAIOutput(output: string): {
    result: string
    superDetections: string[]
    phraseSuppressed: string[]
    warnings: string[]
    blocked: boolean
  } {
    // 1. 应用 SuperDetectorX
    const { result: superResult, matchedRules, warnings, blocked } = this.applySuperDetectorX(output)

    if (blocked) {
      return {
        result: '',
        superDetections: matchedRules,
        phraseSuppressed: [],
        warnings,
        blocked: true
      }
    }

    // 2. 应用口头禅抑制
    const { result, suppressedPhrases } = this.applyPhraseSuppression(superResult)

    return {
      result,
      superDetections: matchedRules,
      phraseSuppressed: suppressedPhrases,
      warnings,
      blocked: false
    }
  }
}

// ==================== 单例导出 ====================

let behaviorControlService: BehaviorControlService | null = null

export function getBehaviorControlService(): BehaviorControlService {
  if (!behaviorControlService) {
    behaviorControlService = new BehaviorControlService()
  }
  return behaviorControlService
}

export default BehaviorControlService
