/**
 * VCPDetectorService - 通用变量替换系统 (Universal Variable Substitution System)
 *
 * VCP 核心组件之一，实现：
 * 1. DetectorX - 系统提示词转化 (System Prompt Transformation)
 *    - 修正不良指令（如限制性工具调用提示）
 *    - 引导 AI 行为焦点与风格
 *    - 动态管理指令模块
 *
 * 2. SuperDetectorX - 全局上下文转化 (Global Context Transformation)
 *    - 文本规范化与精炼（如 "……" → "…"）
 *    - 抑制 AI 输出的"口癖"式惯性
 *    - 修复高概率词权导致的上下文推理崩溃
 *    - 应用于对话历史、AI 中间思考等
 *
 * 3. 实时信息动态注入
 *    - 时间、日期、节日
 *    - 天气、地理位置
 *    - 克服 AI 的"时空幻觉"
 *
 * 配置格式（config.env）：
 * DetectorX=匹配文本
 * Detector_OutputX=替换文本
 * SuperDetectorX=匹配文本
 * SuperDetector_OutputX=替换文本
 *
 * @author Cherry Studio Team
 * @version 2.0.0
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

const logger = loggerService.withContext('VCP:DetectorService')

// ==================== 类型定义 ====================

/**
 * 检测器规则
 */
export interface DetectorRule {
  /** 规则 ID */
  id: string
  /** 规则名称 */
  name: string
  /** 匹配模式（字符串或正则表达式） */
  pattern: string
  /** 是否使用正则表达式 */
  isRegex: boolean
  /** 替换内容 */
  replacement: string
  /** 是否启用 */
  enabled: boolean
  /** 规则类型 */
  type: 'detector' | 'super_detector'
  /** 优先级（数字越小优先级越高） */
  priority: number
  /** 规则描述 */
  description?: string
  /** 适用模型（空数组表示所有模型） */
  modelFilter?: string[]
  /** 统计：触发次数 */
  hitCount: number
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 检测器配置
 */
export interface DetectorConfig {
  /** DetectorX 规则（系统提示词转化） */
  detectorRules: DetectorRule[]
  /** SuperDetectorX 规则（全局上下文转化） */
  superDetectorRules: DetectorRule[]
  /** 是否启用 DetectorX */
  enableDetector: boolean
  /** 是否启用 SuperDetectorX */
  enableSuperDetector: boolean
  /** 是否记录转化日志 */
  logTransformations: boolean
  /** 最大替换次数（防止无限循环） */
  maxReplacements: number
}

/**
 * 转化结果
 */
export interface TransformResult {
  /** 转化后的文本 */
  text: string
  /** 是否发生了转化 */
  transformed: boolean
  /** 触发的规则 */
  triggeredRules: Array<{
    id: string
    name: string
    pattern: string
    matchCount: number
  }>
  /** 转化耗时 (ms) */
  executionTimeMs: number
}

// ==================== 预设规则 ====================

/**
 * 预设 DetectorX 规则 - 系统提示词优化
 */
const PRESET_DETECTOR_RULES: Omit<DetectorRule, 'id' | 'hitCount' | 'createdAt' | 'updatedAt'>[] = [
  // 工具调用优化
  {
    name: '启用并行工具调用',
    pattern: 'You can use one tool per message',
    isRegex: false,
    replacement: 'You can use multiple tools per message in parallel',
    enabled: true,
    type: 'detector',
    priority: 10,
    description: '移除单工具限制，启用并行工具调用'
  },
  {
    name: '移除工具数量限制',
    pattern: 'use only one tool at a time',
    isRegex: false,
    replacement: 'use tools as needed, multiple tools can be called in parallel',
    enabled: true,
    type: 'detector',
    priority: 10,
    description: '移除工具调用数量限制'
  },
  // 行为引导优化
  {
    name: '专业化工具使用提示',
    pattern: 'Great job! Keep going!',
    isRegex: false,
    replacement: 'Continue with tool-assisted analysis when beneficial.',
    enabled: true,
    type: 'detector',
    priority: 20,
    description: '将激励性提示替换为专业工具使用引导'
  },
  // 输出格式优化
  {
    name: '移除强制 Markdown 限制',
    pattern: 'Always respond in markdown format',
    isRegex: false,
    replacement: 'Use markdown formatting when it improves readability',
    enabled: false,
    type: 'detector',
    priority: 30,
    description: '将强制 Markdown 改为条件性使用'
  }
]

/**
 * 预设 SuperDetectorX 规则 - 全局上下文优化
 */
const PRESET_SUPER_DETECTOR_RULES: Omit<DetectorRule, 'id' | 'hitCount' | 'createdAt' | 'updatedAt'>[] = [
  // 标点符号规范化
  {
    name: '省略号规范化',
    pattern: '……',
    isRegex: false,
    replacement: '…',
    enabled: true,
    type: 'super_detector',
    priority: 10,
    description: '将中文省略号规范化为单个省略号'
  },
  {
    name: '多点省略规范化',
    pattern: '\\.{4,}',
    isRegex: true,
    replacement: '...',
    enabled: true,
    type: 'super_detector',
    priority: 10,
    description: '将多个点号规范化为三个点'
  },
  // AI 口癖抑制 - 高频词权修复
  {
    name: '抑制"当然"口癖',
    pattern: '^当然[,，]?\\s*',
    isRegex: true,
    replacement: '',
    enabled: true,
    type: 'super_detector',
    priority: 20,
    description: '移除回复开头的"当然"（Gemini/Claude 高频词权）'
  },
  {
    name: '抑制"好的"口癖',
    pattern: '^好的[,，]?\\s*',
    isRegex: true,
    replacement: '',
    enabled: true,
    type: 'super_detector',
    priority: 20,
    description: '移除回复开头的"好的"（高频词权抑制）'
  },
  {
    name: '抑制"Sure"口癖',
    pattern: '^Sure[,!]?\\s*',
    isRegex: true,
    replacement: '',
    enabled: true,
    type: 'super_detector',
    priority: 20,
    description: '移除英文回复开头的"Sure"'
  },
  {
    name: '抑制"Certainly"口癖',
    pattern: '^Certainly[,!]?\\s*',
    isRegex: true,
    replacement: '',
    enabled: true,
    type: 'super_detector',
    priority: 20,
    description: '移除英文回复开头的"Certainly"'
  },
  {
    name: '抑制"Of course"口癖',
    pattern: '^Of course[,!]?\\s*',
    isRegex: true,
    replacement: '',
    enabled: true,
    type: 'super_detector',
    priority: 20,
    description: '移除英文回复开头的"Of course"'
  },
  // Grok 特有口癖修复
  {
    name: 'Grok 口癖修复 - "嗯"',
    pattern: '^嗯[,，]?\\s*',
    isRegex: true,
    replacement: '',
    enabled: true,
    type: 'super_detector',
    priority: 25,
    modelFilter: ['grok'],
    description: '移除 Grok 模型特有的"嗯"开头（高频词权修复）'
  },
  // 重复内容抑制
  {
    name: '抑制重复感叹号',
    pattern: '!{3,}',
    isRegex: true,
    replacement: '!',
    enabled: true,
    type: 'super_detector',
    priority: 30,
    description: '将多个感叹号规范化为单个'
  },
  {
    name: '抑制重复问号',
    pattern: '\\?{3,}',
    isRegex: true,
    replacement: '?',
    enabled: true,
    type: 'super_detector',
    priority: 30,
    description: '将多个问号规范化为单个'
  },
  // 空白字符规范化
  {
    name: '多空格规范化',
    pattern: ' {3,}',
    isRegex: true,
    replacement: ' ',
    enabled: true,
    type: 'super_detector',
    priority: 40,
    description: '将多个连续空格规范化为单个'
  },
  {
    name: '多换行规范化',
    pattern: '\\n{4,}',
    isRegex: true,
    replacement: '\n\n\n',
    enabled: true,
    type: 'super_detector',
    priority: 40,
    description: '将过多换行规范化为最多三个'
  }
]

// ==================== VCPDetectorService 实现 ====================

class VCPDetectorServiceImpl {
  private static instance: VCPDetectorServiceImpl | null = null
  private config: DetectorConfig
  private configPath: string
  private initialized: boolean = false

  private constructor() {
    const userData = app.getPath('userData')
    this.configPath = path.join(userData, 'vcp', 'detector-config.json')

    // 默认配置
    this.config = {
      detectorRules: [],
      superDetectorRules: [],
      enableDetector: true,
      enableSuperDetector: true,
      logTransformations: false,
      maxReplacements: 1000
    }
  }

  static getInstance(): VCPDetectorServiceImpl {
    if (!VCPDetectorServiceImpl.instance) {
      VCPDetectorServiceImpl.instance = new VCPDetectorServiceImpl()
    }
    return VCPDetectorServiceImpl.instance
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 确保目录存在
      const dir = path.dirname(this.configPath)
      await fs.mkdir(dir, { recursive: true })

      // 加载配置
      await this.loadConfig()

      // 如果没有规则，添加预设规则
      if (this.config.detectorRules.length === 0) {
        await this.initializePresetRules()
      }

      this.initialized = true
      logger.info('VCPDetectorService initialized', {
        detectorRules: this.config.detectorRules.length,
        superDetectorRules: this.config.superDetectorRules.length
      })
    } catch (error) {
      logger.error('Failed to initialize VCPDetectorService', error as Error)
      throw error
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      const saved = JSON.parse(content) as Partial<DetectorConfig>
      this.config = { ...this.config, ...saved }
    } catch {
      logger.debug('No existing detector config, using defaults')
    }
  }

  /**
   * 保存配置
   */
  private async saveConfig(): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
      logger.debug('Detector config saved')
    } catch (error) {
      logger.error('Failed to save detector config', error as Error)
    }
  }

  /**
   * 初始化预设规则
   */
  private async initializePresetRules(): Promise<void> {
    const now = Date.now()

    // 添加 DetectorX 预设规则
    for (const preset of PRESET_DETECTOR_RULES) {
      this.config.detectorRules.push({
        ...preset,
        id: `detector_${this.config.detectorRules.length + 1}`,
        hitCount: 0,
        createdAt: now,
        updatedAt: now
      })
    }

    // 添加 SuperDetectorX 预设规则
    for (const preset of PRESET_SUPER_DETECTOR_RULES) {
      this.config.superDetectorRules.push({
        ...preset,
        id: `super_${this.config.superDetectorRules.length + 1}`,
        hitCount: 0,
        createdAt: now,
        updatedAt: now
      })
    }

    await this.saveConfig()
    logger.info('Preset detector rules initialized', {
      detector: this.config.detectorRules.length,
      superDetector: this.config.superDetectorRules.length
    })
  }

  // ==================== 核心转化方法 ====================

  /**
   * 应用 DetectorX 规则 - 系统提示词转化
   *
   * @param systemPrompt 原始系统提示词
   * @param modelId 当前模型 ID（用于模型过滤）
   * @returns 转化结果
   */
  applyDetectorX(systemPrompt: string, modelId?: string): TransformResult {
    if (!this.config.enableDetector) {
      return {
        text: systemPrompt,
        transformed: false,
        triggeredRules: [],
        executionTimeMs: 0
      }
    }

    return this.applyRules(systemPrompt, this.config.detectorRules, modelId)
  }

  /**
   * 应用 SuperDetectorX 规则 - 全局上下文转化
   *
   * @param text 原始文本（对话历史、AI 输出等）
   * @param modelId 当前模型 ID
   * @returns 转化结果
   */
  applySuperDetectorX(text: string, modelId?: string): TransformResult {
    if (!this.config.enableSuperDetector) {
      return {
        text,
        transformed: false,
        triggeredRules: [],
        executionTimeMs: 0
      }
    }

    return this.applyRules(text, this.config.superDetectorRules, modelId)
  }

  /**
   * 应用规则集
   */
  private applyRules(text: string, rules: DetectorRule[], modelId?: string): TransformResult {
    const startTime = Date.now()
    let result = text
    let totalReplacements = 0
    const triggeredRules: TransformResult['triggeredRules'] = []

    // 按优先级排序
    const sortedRules = [...rules]
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
      // 模型过滤
      if (rule.modelFilter && rule.modelFilter.length > 0 && modelId) {
        const modelLower = modelId.toLowerCase()
        const matches = rule.modelFilter.some((filter) =>
          modelLower.includes(filter.toLowerCase())
        )
        if (!matches) continue
      }

      // 执行替换
      try {
        const { newText, matchCount } = this.applyRule(result, rule)

        if (matchCount > 0) {
          result = newText
          totalReplacements += matchCount
          rule.hitCount += matchCount

          triggeredRules.push({
            id: rule.id,
            name: rule.name,
            pattern: rule.pattern,
            matchCount
          })

          if (this.config.logTransformations) {
            logger.debug('Detector rule triggered', {
              rule: rule.name,
              matchCount,
              type: rule.type
            })
          }
        }

        // 防止无限循环
        if (totalReplacements >= this.config.maxReplacements) {
          logger.warn('Max replacements reached', { max: this.config.maxReplacements })
          break
        }
      } catch (error) {
        logger.error('Rule application failed', {
          rule: rule.name,
          error: String(error)
        })
      }
    }

    return {
      text: result,
      transformed: triggeredRules.length > 0,
      triggeredRules,
      executionTimeMs: Date.now() - startTime
    }
  }

  /**
   * 应用单个规则
   */
  private applyRule(text: string, rule: DetectorRule): { newText: string; matchCount: number } {
    let matchCount = 0

    if (rule.isRegex) {
      const regex = new RegExp(rule.pattern, 'gm')
      const matches = text.match(regex)
      matchCount = matches?.length || 0
      const newText = text.replace(regex, rule.replacement)
      return { newText, matchCount }
    } else {
      // 字符串匹配
      const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'g')
      const matches = text.match(regex)
      matchCount = matches?.length || 0
      const newText = text.replace(regex, rule.replacement)
      return { newText, matchCount }
    }
  }

  // ==================== 规则管理方法 ====================

  /**
   * 获取所有规则
   */
  getAllRules(): { detector: DetectorRule[]; superDetector: DetectorRule[] } {
    return {
      detector: [...this.config.detectorRules],
      superDetector: [...this.config.superDetectorRules]
    }
  }

  /**
   * 添加规则
   */
  async addRule(rule: Omit<DetectorRule, 'id' | 'hitCount' | 'createdAt' | 'updatedAt'>): Promise<DetectorRule> {
    const now = Date.now()
    const rules = rule.type === 'detector' ? this.config.detectorRules : this.config.superDetectorRules
    const prefix = rule.type === 'detector' ? 'detector' : 'super'

    const newRule: DetectorRule = {
      ...rule,
      id: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      hitCount: 0,
      createdAt: now,
      updatedAt: now
    }

    rules.push(newRule)
    await this.saveConfig()

    logger.info('Rule added', { id: newRule.id, name: newRule.name, type: rule.type })
    return newRule
  }

  /**
   * 更新规则
   */
  async updateRule(id: string, updates: Partial<DetectorRule>): Promise<DetectorRule | null> {
    // 查找规则
    let rule = this.config.detectorRules.find((r) => r.id === id)
    let rules = this.config.detectorRules

    if (!rule) {
      rule = this.config.superDetectorRules.find((r) => r.id === id)
      rules = this.config.superDetectorRules
    }

    if (!rule) {
      return null
    }

    // 更新规则
    Object.assign(rule, updates, { updatedAt: Date.now() })
    await this.saveConfig()

    logger.info('Rule updated', { id, name: rule.name })
    return rule
  }

  /**
   * 删除规则
   */
  async deleteRule(id: string): Promise<boolean> {
    let index = this.config.detectorRules.findIndex((r) => r.id === id)
    if (index !== -1) {
      this.config.detectorRules.splice(index, 1)
      await this.saveConfig()
      logger.info('Detector rule deleted', { id })
      return true
    }

    index = this.config.superDetectorRules.findIndex((r) => r.id === id)
    if (index !== -1) {
      this.config.superDetectorRules.splice(index, 1)
      await this.saveConfig()
      logger.info('SuperDetector rule deleted', { id })
      return true
    }

    return false
  }

  /**
   * 启用/禁用规则
   */
  async toggleRule(id: string, enabled: boolean): Promise<boolean> {
    const rule = await this.updateRule(id, { enabled })
    return rule !== null
  }

  /**
   * 重置为预设规则
   */
  async resetToPresets(): Promise<void> {
    this.config.detectorRules = []
    this.config.superDetectorRules = []
    await this.initializePresetRules()
    logger.info('Rules reset to presets')
  }

  // ==================== 配置管理 ====================

  /**
   * 获取配置
   */
  getConfig(): DetectorConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  async updateConfig(updates: Partial<DetectorConfig>): Promise<void> {
    Object.assign(this.config, updates)
    await this.saveConfig()
    logger.info('Detector config updated', updates)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    detectorRules: { total: number; enabled: number; totalHits: number }
    superDetectorRules: { total: number; enabled: number; totalHits: number }
  } {
    const detectorEnabled = this.config.detectorRules.filter((r) => r.enabled)
    const superEnabled = this.config.superDetectorRules.filter((r) => r.enabled)

    return {
      detectorRules: {
        total: this.config.detectorRules.length,
        enabled: detectorEnabled.length,
        totalHits: this.config.detectorRules.reduce((sum, r) => sum + r.hitCount, 0)
      },
      superDetectorRules: {
        total: this.config.superDetectorRules.length,
        enabled: superEnabled.length,
        totalHits: this.config.superDetectorRules.reduce((sum, r) => sum + r.hitCount, 0)
      }
    }
  }

  // ==================== 从 config.env 导入规则 ====================

  /**
   * 从 config.env 格式导入规则
   *
   * 格式：
   * DetectorX=匹配文本
   * Detector_OutputX=替换文本
   * SuperDetectorX=匹配文本
   * SuperDetector_OutputX=替换文本
   */
  async importFromEnv(envContent: string): Promise<{
    imported: number
    errors: string[]
  }> {
    const lines = envContent.split('\n')
    const detectorPatterns: Map<number, string> = new Map()
    const detectorOutputs: Map<number, string> = new Map()
    const superPatterns: Map<number, string> = new Map()
    const superOutputs: Map<number, string> = new Map()

    const errors: string[] = []

    // 解析行
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      // DetectorX
      let match = trimmed.match(/^Detector(\d+)=(.+)$/)
      if (match) {
        detectorPatterns.set(parseInt(match[1]), match[2])
        continue
      }

      // Detector_OutputX
      match = trimmed.match(/^Detector_Output(\d+)=(.+)$/)
      if (match) {
        detectorOutputs.set(parseInt(match[1]), match[2])
        continue
      }

      // SuperDetectorX
      match = trimmed.match(/^SuperDetector(\d+)=(.+)$/)
      if (match) {
        superPatterns.set(parseInt(match[1]), match[2])
        continue
      }

      // SuperDetector_OutputX
      match = trimmed.match(/^SuperDetector_Output(\d+)=(.+)$/)
      if (match) {
        superOutputs.set(parseInt(match[1]), match[2])
        continue
      }
    }

    let imported = 0

    // 创建 Detector 规则
    for (const [index, pattern] of Array.from(detectorPatterns.entries())) {
      const output = detectorOutputs.get(index)
      if (output === undefined) {
        errors.push(`Detector${index} 缺少对应的 Detector_Output${index}`)
        continue
      }

      await this.addRule({
        name: `Detector${index} (导入)`,
        pattern,
        isRegex: false,
        replacement: output,
        enabled: true,
        type: 'detector',
        priority: 100 + index,
        description: `从 config.env 导入`
      })
      imported++
    }

    // 创建 SuperDetector 规则
    for (const [index, pattern] of Array.from(superPatterns.entries())) {
      const output = superOutputs.get(index)
      if (output === undefined) {
        errors.push(`SuperDetector${index} 缺少对应的 SuperDetector_Output${index}`)
        continue
      }

      await this.addRule({
        name: `SuperDetector${index} (导入)`,
        pattern,
        isRegex: false,
        replacement: output,
        enabled: true,
        type: 'super_detector',
        priority: 100 + index,
        description: `从 config.env 导入`
      })
      imported++
    }

    logger.info('Rules imported from env', { imported, errors: errors.length })
    return { imported, errors }
  }

  /**
   * 导出为 config.env 格式
   */
  exportToEnv(): string {
    const lines: string[] = [
      '# VCP Detector Rules',
      '# Generated by Cherry Studio',
      '',
      '# DetectorX - System Prompt Transformation',
      ''
    ]

    this.config.detectorRules.forEach((rule, index) => {
      lines.push(`# ${rule.name}`)
      if (rule.description) lines.push(`# ${rule.description}`)
      lines.push(`Detector${index + 1}=${rule.pattern}`)
      lines.push(`Detector_Output${index + 1}=${rule.replacement}`)
      lines.push('')
    })

    lines.push('# SuperDetectorX - Global Context Transformation')
    lines.push('')

    this.config.superDetectorRules.forEach((rule, index) => {
      lines.push(`# ${rule.name}`)
      if (rule.description) lines.push(`# ${rule.description}`)
      lines.push(`SuperDetector${index + 1}=${rule.pattern}`)
      lines.push(`SuperDetector_Output${index + 1}=${rule.replacement}`)
      lines.push('')
    })

    return lines.join('\n')
  }
}

// ==================== 导出 ====================

export const vcpDetectorService = VCPDetectorServiceImpl.getInstance()
export default vcpDetectorService

export type { VCPDetectorServiceImpl as VCPDetectorService }
