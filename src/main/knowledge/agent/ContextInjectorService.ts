/**
 * VCPTavern 上下文注入服务
 *
 * 功能:
 * - 对话上下文动态注入
 * - 非侵入式"导演"控制
 * - 条件触发机制
 * - 预设管理
 */

import { loggerService } from '@logger'
import * as crypto from 'crypto'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const logger = loggerService.withContext('ContextInjectorService')

// ==================== 类型定义 ====================

/**
 * 注入位置
 */
export type InjectionPosition =
  | 'system_prefix' // 系统提示词开头
  | 'system_suffix' // 系统提示词结尾
  | 'context_prefix' // 上下文开头
  | 'context_suffix' // 上下文结尾
  | 'user_prefix' // 用户消息前
  | 'user_suffix' // 用户消息后
  | 'assistant_prefix' // 助手消息前
  | 'hidden' // 隐藏注入 (不显示给用户)

/**
 * 触发条件类型
 */
export type TriggerType =
  | 'always' // 始终触发
  | 'keyword' // 关键词触发
  | 'regex' // 正则匹配
  | 'turn_count' // 对话轮次
  | 'time_based' // 时间触发
  | 'random' // 随机触发
  | 'context_length' // 上下文长度
  | 'custom' // 自定义函数

/**
 * 触发条件
 */
export interface TriggerCondition {
  type: TriggerType
  value: string | number | boolean | Record<string, any>
  negate?: boolean // 是否取反
}

/**
 * 上下文注入规则
 */
export interface InjectionRule {
  id: string
  name: string
  description?: string
  position: InjectionPosition
  content: string // 注入内容 (支持变量)
  priority: number // 优先级 (数字越大越先执行)
  triggers: TriggerCondition[]
  triggerLogic: 'and' | 'or' // 多条件逻辑
  isActive: boolean
  cooldown?: number // 冷却时间 (秒)
  maxTriggers?: number // 最大触发次数
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

/**
 * VCPTavern 预设
 */
export interface VCPTavernPreset {
  id: string
  name: string
  description?: string
  rules: InjectionRule[]
  isActive: boolean
  targetAgents?: string[] // 目标 Agent ID
  createdAt: Date
  updatedAt: Date
}

/**
 * 注入上下文
 */
export interface InjectionContext {
  turnCount: number
  lastUserMessage: string
  lastAssistantMessage: string
  contextLength: number
  currentTime: Date
  agentId?: string
  customData?: Record<string, any>
}

/**
 * 注入结果
 */
export interface InjectionResult {
  position: InjectionPosition
  content: string
  ruleId: string
  ruleName: string
}

// ==================== ContextInjectorService ====================

export class ContextInjectorService {
  private rules: Map<string, InjectionRule> = new Map()
  private presets: Map<string, VCPTavernPreset> = new Map()
  private triggerHistory: Map<string, { count: number; lastTriggered: Date }> = new Map()
  private storagePath: string

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(app.getPath('userData'), 'Data', 'ContextInjector')
    this.ensureStorageDir()
    this.loadFromDisk()
  }

  // ==================== 规则管理 ====================

  /**
   * 创建注入规则
   */
  async createRule(rule: Omit<InjectionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<InjectionRule> {
    const id = this.generateId()
    const now = new Date()

    const newRule: InjectionRule = {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now
    }

    this.rules.set(id, newRule)
    await this.saveIndex()

    logger.info('Rule created', { id, name: newRule.name })
    return newRule
  }

  /**
   * 更新规则
   */
  async updateRule(
    id: string,
    updates: Partial<Omit<InjectionRule, 'id' | 'createdAt'>>
  ): Promise<InjectionRule | null> {
    const rule = this.rules.get(id)
    if (!rule) return null

    Object.assign(rule, updates, { updatedAt: new Date() })
    await this.saveIndex()

    logger.info('Rule updated', { id })
    return rule
  }

  /**
   * 删除规则
   */
  async deleteRule(id: string): Promise<boolean> {
    const deleted = this.rules.delete(id)
    if (deleted) {
      await this.saveIndex()
      logger.info('Rule deleted', { id })
    }
    return deleted
  }

  /**
   * 获取所有规则
   */
  getAllRules(): InjectionRule[] {
    return [...this.rules.values()].sort((a, b) => b.priority - a.priority)
  }

  // ==================== 预设管理 ====================

  /**
   * 创建预设
   */
  async createPreset(preset: Omit<VCPTavernPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<VCPTavernPreset> {
    const id = this.generateId()
    const now = new Date()

    const newPreset: VCPTavernPreset = {
      ...preset,
      id,
      createdAt: now,
      updatedAt: now
    }

    this.presets.set(id, newPreset)
    await this.saveIndex()

    logger.info('Preset created', { id, name: newPreset.name })
    return newPreset
  }

  /**
   * 激活预设
   */
  async activatePreset(presetId: string): Promise<boolean> {
    const preset = this.presets.get(presetId)
    if (!preset) return false

    // 停用其他预设
    for (const p of this.presets.values()) {
      p.isActive = false
    }

    preset.isActive = true
    await this.saveIndex()

    logger.info('Preset activated', { id: presetId })
    return true
  }

  /**
   * 删除预设
   */
  async deletePreset(presetId: string): Promise<boolean> {
    const preset = this.presets.get(presetId)
    if (!preset) {
      logger.warn('Preset not found for deletion', { id: presetId })
      return false
    }

    const deleted = this.presets.delete(presetId)
    if (deleted) {
      await this.saveIndex()
      logger.info('Preset deleted', { id: presetId, name: preset.name })
    }
    return deleted
  }

  /**
   * 更新预设
   */
  async updatePreset(
    presetId: string,
    updates: Partial<Omit<VCPTavernPreset, 'id' | 'createdAt'>>
  ): Promise<VCPTavernPreset | null> {
    const preset = this.presets.get(presetId)
    if (!preset) {
      logger.warn('Preset not found for update', { id: presetId })
      return null
    }

    const updatedPreset: VCPTavernPreset = {
      ...preset,
      ...updates,
      updatedAt: new Date()
    }

    this.presets.set(presetId, updatedPreset)
    await this.saveIndex()

    logger.info('Preset updated', { id: presetId, name: updatedPreset.name })
    return updatedPreset
  }

  /**
   * 获取所有预设
   */
  getAllPresets(): VCPTavernPreset[] {
    return [...this.presets.values()]
  }

  /**
   * 获取活动预设
   */
  getActivePreset(): VCPTavernPreset | null {
    return [...this.presets.values()].find((p) => p.isActive) || null
  }

  // ==================== 注入执行 ====================

  /**
   * 执行注入
   *
   * @param context - 注入上下文（包含 agentId 用于过滤）
   * @returns 按位置分组的注入结果
   */
  executeInjection(context: InjectionContext): InjectionResult[] {
    const results: InjectionResult[] = []

    // 获取活动预设的规则
    const activePreset = this.getActivePreset()

    // 检查 targetAgents 过滤
    if (activePreset?.targetAgents && activePreset.targetAgents.length > 0) {
      if (!context.agentId || !activePreset.targetAgents.includes(context.agentId)) {
        logger.debug('Agent not in targetAgents, skipping preset', {
          agentId: context.agentId,
          targetAgents: activePreset.targetAgents,
          presetName: activePreset.name
        })
        return []
      }
    }

    const rulesToCheck = activePreset ? activePreset.rules : [...this.rules.values()]

    // 按优先级排序
    const sortedRules = rulesToCheck.filter((r) => r.isActive).sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      // 检查冷却
      if (!this.checkCooldown(rule)) continue

      // 检查最大触发次数
      if (!this.checkMaxTriggers(rule)) continue

      // 检查触发条件
      if (this.checkTriggers(rule, context)) {
        const content = this.resolveContent(rule.content, context)

        results.push({
          position: rule.position,
          content,
          ruleId: rule.id,
          ruleName: rule.name
        })

        // 记录触发
        this.recordTrigger(rule.id)

        logger.debug('Rule triggered', { ruleId: rule.id, position: rule.position })
      }
    }

    return results
  }

  /**
   * 检查触发条件
   */
  private checkTriggers(rule: InjectionRule, context: InjectionContext): boolean {
    if (rule.triggers.length === 0) return true

    const results = rule.triggers.map((trigger) => {
      let result = this.checkSingleTrigger(trigger, context)
      if (trigger.negate) result = !result
      return result
    })

    return rule.triggerLogic === 'and' ? results.every(Boolean) : results.some(Boolean)
  }

  /**
   * 检查单个触发条件
   */
  private checkSingleTrigger(trigger: TriggerCondition, context: InjectionContext): boolean {
    switch (trigger.type) {
      case 'always':
        return true

      case 'keyword': {
        const keywords = Array.isArray(trigger.value) ? trigger.value : [trigger.value]
        const text = context.lastUserMessage.toLowerCase()
        return keywords.some((kw) => text.includes(String(kw).toLowerCase()))
      }

      case 'regex': {
        const pattern = new RegExp(String(trigger.value), 'i')
        return pattern.test(context.lastUserMessage)
      }

      case 'turn_count': {
        const { min, max } = trigger.value as { min?: number; max?: number }
        if (min !== undefined && context.turnCount < min) return false
        if (max !== undefined && context.turnCount > max) return false
        return true
      }

      case 'time_based': {
        const config = trigger.value as { hours?: number[]; days?: number[] }
        const now = context.currentTime
        if (config.hours && !config.hours.includes(now.getHours())) return false
        if (config.days && !config.days.includes(now.getDay())) return false
        return true
      }

      case 'random': {
        const probability = Number(trigger.value) || 0.5
        return Math.random() < probability
      }

      case 'context_length': {
        const { min, max } = trigger.value as { min?: number; max?: number }
        if (min !== undefined && context.contextLength < min) return false
        if (max !== undefined && context.contextLength > max) return false
        return true
      }

      default:
        return false
    }
  }

  /**
   * 检查冷却时间
   */
  private checkCooldown(rule: InjectionRule): boolean {
    if (!rule.cooldown) return true

    const history = this.triggerHistory.get(rule.id)
    if (!history) return true

    const elapsed = (Date.now() - history.lastTriggered.getTime()) / 1000
    return elapsed >= rule.cooldown
  }

  /**
   * 检查最大触发次数
   */
  private checkMaxTriggers(rule: InjectionRule): boolean {
    if (!rule.maxTriggers) return true

    const history = this.triggerHistory.get(rule.id)
    if (!history) return true

    return history.count < rule.maxTriggers
  }

  /**
   * 记录触发
   */
  private recordTrigger(ruleId: string): void {
    const history = this.triggerHistory.get(ruleId) || { count: 0, lastTriggered: new Date() }
    history.count++
    history.lastTriggered = new Date()
    this.triggerHistory.set(ruleId, history)
  }

  /**
   * 重置触发历史
   */
  resetTriggerHistory(ruleId?: string): void {
    if (ruleId) {
      this.triggerHistory.delete(ruleId)
    } else {
      this.triggerHistory.clear()
    }
  }

  /**
   * 解析内容中的变量
   */
  private resolveContent(content: string, context: InjectionContext): string {
    let result = content

    // 内置变量
    result = result.replace(/\{\{turn_count\}\}/g, String(context.turnCount))
    result = result.replace(/\{\{current_time\}\}/g, context.currentTime.toLocaleTimeString())
    result = result.replace(/\{\{current_date\}\}/g, context.currentTime.toLocaleDateString())
    result = result.replace(/\{\{last_user_message\}\}/g, context.lastUserMessage)

    // 自定义数据
    if (context.customData) {
      for (const [key, value] of Object.entries(context.customData)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
      }
    }

    return result
  }

  // ==================== 预设模板 ====================

  /**
   * 创建"导演"模式预设
   */
  async createDirectorPreset(): Promise<VCPTavernPreset> {
    const rules: InjectionRule[] = [
      {
        id: this.generateId(),
        name: '场景描述提示',
        position: 'hidden',
        content: '[导演提示: 注意描绘场景细节，包括环境、氛围和角色表情]',
        priority: 10,
        triggers: [{ type: 'turn_count', value: { min: 3 } }],
        triggerLogic: 'and',
        isActive: true,
        tags: ['director'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: '情感深化提示',
        position: 'hidden',
        content: '[导演提示: 深入展现角色的内心情感，不只是表面反应]',
        priority: 8,
        triggers: [{ type: 'keyword', value: ['感觉', '觉得', '心情'] }],
        triggerLogic: 'or',
        isActive: true,
        tags: ['director'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: '对话节奏控制',
        position: 'hidden',
        content: '[导演提示: 保持对话节奏，适时加入停顿和思考]',
        priority: 5,
        triggers: [{ type: 'random', value: 0.3 }],
        triggerLogic: 'and',
        isActive: true,
        cooldown: 60,
        tags: ['director'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    return this.createPreset({
      name: '导演模式',
      description: 'VCPTavern 风格的非侵入式对话导演',
      rules,
      isActive: false
    })
  }

  /**
   * 创建角色扮演增强预设
   */
  async createRoleplayEnhancementPreset(): Promise<VCPTavernPreset> {
    const rules: InjectionRule[] = [
      {
        id: this.generateId(),
        name: '开场白增强',
        position: 'context_prefix',
        content: '[场景开始，角色进入状态...]',
        priority: 20,
        triggers: [{ type: 'turn_count', value: { max: 1 } }],
        triggerLogic: 'and',
        isActive: true,
        maxTriggers: 1,
        tags: ['roleplay'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: '动作描写提示',
        position: 'hidden',
        content: '[记得加入角色的动作和表情描写，使场景更生动]',
        priority: 15,
        triggers: [{ type: 'always', value: true }],
        triggerLogic: 'and',
        isActive: true,
        cooldown: 180,
        tags: ['roleplay'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    return this.createPreset({
      name: '角色扮演增强',
      description: '增强角色扮演体验的上下文注入',
      rules,
      isActive: false
    })
  }

  // ==================== 工具方法 ====================

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex')
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true })
    }
  }

  private async saveIndex(): Promise<void> {
    const data = {
      rules: Object.fromEntries(this.rules),
      presets: Object.fromEntries(this.presets)
    }
    const filePath = path.join(this.storagePath, 'index.json')
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  private loadFromDisk(): void {
    const filePath = path.join(this.storagePath, 'index.json')
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        if (data.rules) {
          for (const [key, value] of Object.entries(data.rules)) {
            this.rules.set(key, value as InjectionRule)
          }
        }
        if (data.presets) {
          for (const [key, value] of Object.entries(data.presets)) {
            this.presets.set(key, value as VCPTavernPreset)
          }
        }

        logger.info('Loaded context injector data', {
          rules: this.rules.size,
          presets: this.presets.size
        })
      } catch (error) {
        logger.error('Failed to load context injector data', { error: String(error) })
      }
    }
  }

  /**
   * 获取统计
   */
  getStats(): {
    ruleCount: number
    presetCount: number
    activePreset: string | null
  } {
    const activePreset = this.getActivePreset()
    return {
      ruleCount: this.rules.size,
      presetCount: this.presets.size,
      activePreset: activePreset?.name || null
    }
  }
}

// ==================== 导出 ====================

let serviceInstance: ContextInjectorService | null = null

export function getContextInjectorService(storagePath?: string): ContextInjectorService {
  if (!serviceInstance) {
    serviceInstance = new ContextInjectorService(storagePath)
  }
  return serviceInstance
}

export function createContextInjectorService(storagePath?: string): ContextInjectorService {
  return new ContextInjectorService(storagePath)
}
