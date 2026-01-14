/**
 * 酒馆-助手桥接服务
 *
 * 将 SillyTavern 角色卡转换为 UnifiedAssistant 格式
 * 实现角色扮演功能与助手系统的无缝集成
 *
 * 功能:
 * - CharacterCard → UnifiedAssistant 转换
 * - 自动生成系统提示词（融合人设/场景）
 * - WorldBook 条目转换为上下文注入规则
 * - 支持 first_mes（开场白）注入
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'
import * as crypto from 'crypto'

import type {
  CharacterCard,
  TavernCardV2Data,
  TavernCardV3Data,
  WorldBook
} from './types'

const logger = loggerService.withContext('TavernAssistantBridge')

// ==================== 类型定义 ====================

/**
 * 桥接后的助手类型 (与 UnifiedAssistant 兼容)
 */
export interface TavernAssistant {
  // 基础标识
  id: string
  name: string
  displayName: string
  avatar?: string
  description?: string
  tags?: string[]
  category: 'tavern' // 标记为酒馆导入

  // 核心配置
  systemPrompt: string
  modelId?: string
  isActive: boolean

  // 人格配置
  profile: {
    personality?: string
    background?: string
    greetingMessage?: string
    exampleDialogues?: Array<{ user: string; assistant: string }>
    tone?: 'formal' | 'casual' | 'playful' | 'professional'
    traits?: string[]
  }

  // 记忆配置
  memory: {
    enabled: boolean
    enableUnifiedSearch?: boolean
    tagBoost?: number
    useRRF?: boolean
  }

  // 上下文注入规则 (来自 WorldBook)
  contextInjections: ContextInjectionRule[]

  // 原始角色卡引用
  sourceCard: {
    id: string
    spec: 'chara_card_v2' | 'chara_card_v3'
  }

  // 元信息
  createdAt: string
  updatedAt: string
}

/**
 * 上下文注入规则 (从 WorldBook 转换)
 */
export interface ContextInjectionRule {
  id: string
  name: string
  enabled: boolean
  /** 触发关键词 */
  triggerKeywords: string[]
  /** 二级关键词 (需同时匹配) */
  secondaryKeywords: string[]
  /** 注入内容 */
  content: string
  /** 注入位置 */
  position: 'before_system' | 'after_system' | 'before_user' | 'after_user' | 'depth'
  /** 深度 (仅 depth 位置有效) */
  depth?: number
  /** 是否常驻 (始终注入) */
  constant: boolean
  /** 优先级 */
  priority: number
  /** 是否区分大小写 */
  caseSensitive: boolean
}

/**
 * 桥接选项
 */
export interface BridgeOptions {
  /** 是否生成增强型系统提示词 */
  enhancedPrompt?: boolean
  /** 是否启用记忆 */
  enableMemory?: boolean
  /** 是否导入 WorldBook */
  importWorldBook?: boolean
  /** 自定义 ID (不指定则自动生成) */
  customId?: string
  /** 关联的模型 ID */
  modelId?: string
}

// ==================== 桥接服务 ====================

/**
 * 酒馆-助手桥接服务
 */
export class TavernAssistantBridge {
  /**
   * 将角色卡转换为助手
   */
  convertToAssistant(card: CharacterCard, options: BridgeOptions = {}): TavernAssistant {
    const {
      enhancedPrompt = true,
      enableMemory = false,
      importWorldBook = true,
      customId,
      modelId
    } = options

    const data = card.data as TavernCardV2Data | TavernCardV3Data
    const now = new Date().toISOString()

    // 生成 ID
    const id = customId || `tavern_${crypto.randomBytes(8).toString('hex')}`

    // 解析示例对话
    const exampleDialogues = this.parseExampleDialogues(data.mes_example)

    // 生成系统提示词
    const systemPrompt = enhancedPrompt
      ? this.generateEnhancedSystemPrompt(data)
      : data.system_prompt || this.generateBasicSystemPrompt(data)

    // 转换 WorldBook 规则
    const contextInjections = importWorldBook && data.character_book
      ? this.convertWorldBook(data.character_book)
      : []

    // 提取性格特质标签
    const traits = this.extractTraits(data.personality)

    const assistant: TavernAssistant = {
      id,
      name: this.sanitizeName(data.name),
      displayName: data.name,
      avatar: card.avatar,
      description: data.description,
      tags: [...(data.tags || []), '酒馆', '角色扮演'],
      category: 'tavern',

      systemPrompt,
      modelId,
      isActive: true,

      profile: {
        personality: data.personality,
        background: data.description,
        greetingMessage: data.first_mes,
        exampleDialogues,
        tone: this.detectTone(data.personality),
        traits
      },

      memory: {
        enabled: enableMemory,
        enableUnifiedSearch: enableMemory,
        tagBoost: 1.5,
        useRRF: true
      },

      contextInjections,

      sourceCard: {
        id: card.id,
        spec: card.spec
      },

      createdAt: now,
      updatedAt: now
    }

    logger.info('Character card converted to assistant', {
      cardId: card.id,
      cardName: data.name,
      assistantId: id,
      worldBookEntries: contextInjections.length
    })

    return assistant
  }

  /**
   * 生成增强型系统提示词
   * 融合角色描述、人设、场景为一体
   */
  private generateEnhancedSystemPrompt(data: TavernCardV2Data | TavernCardV3Data): string {
    const parts: string[] = []

    // 基础系统提示词
    if (data.system_prompt) {
      parts.push(data.system_prompt)
    }

    // 角色基本信息
    parts.push(`# 角色设定\n\n你是 ${data.name}。`)

    // 外貌/背景描述
    if (data.description) {
      parts.push(`## 背景描述\n${data.description}`)
    }

    // 性格特征
    if (data.personality) {
      parts.push(`## 性格特征\n${data.personality}`)
    }

    // 场景设定
    if (data.scenario) {
      parts.push(`## 当前场景\n${data.scenario}`)
    }

    // 历史后指令
    if (data.post_history_instructions) {
      parts.push(`## 重要提示\n${data.post_history_instructions}`)
    }

    return parts.join('\n\n')
  }

  /**
   * 生成基础系统提示词 (仅角色名和描述)
   */
  private generateBasicSystemPrompt(data: TavernCardV2Data | TavernCardV3Data): string {
    let prompt = `你是 ${data.name}。`

    if (data.description) {
      prompt += `\n\n${data.description}`
    }

    if (data.personality) {
      prompt += `\n\n你的性格特点: ${data.personality}`
    }

    return prompt
  }

  /**
   * 解析示例对话
   */
  private parseExampleDialogues(mesExample: string): Array<{ user: string; assistant: string }> {
    if (!mesExample) return []

    const dialogues: Array<{ user: string; assistant: string }> = []

    // SillyTavern 示例对话格式:
    // <START>
    // {{user}}: 用户消息
    // {{char}}: 角色回复
    // <START>
    // ...

    const sections = mesExample.split(/<START>/i).filter((s) => s.trim())

    for (const section of sections) {
      const lines = section.split('\n').filter((l) => l.trim())
      let currentUser = ''
      let currentAssistant = ''

      for (const line of lines) {
        const trimmedLine = line.trim()

        // 匹配用户消息
        const userMatch = trimmedLine.match(/^\{\{user\}\}:\s*(.+)$/i)
        if (userMatch) {
          if (currentUser && currentAssistant) {
            dialogues.push({ user: currentUser, assistant: currentAssistant })
            currentAssistant = ''
          }
          currentUser = userMatch[1]
          continue
        }

        // 匹配角色消息
        const charMatch = trimmedLine.match(/^\{\{char\}\}:\s*(.+)$/i)
        if (charMatch) {
          currentAssistant = charMatch[1]
          continue
        }

        // 继续添加到当前消息
        if (currentAssistant) {
          currentAssistant += '\n' + trimmedLine
        } else if (currentUser) {
          currentUser += '\n' + trimmedLine
        }
      }

      // 添加最后一对对话
      if (currentUser && currentAssistant) {
        dialogues.push({ user: currentUser, assistant: currentAssistant })
      }
    }

    return dialogues.slice(0, 5) // 最多保留 5 对示例
  }

  /**
   * 转换 WorldBook 为上下文注入规则
   */
  private convertWorldBook(worldBook: WorldBook): ContextInjectionRule[] {
    const rules: ContextInjectionRule[] = []

    for (const entry of worldBook.entries) {
      if (!entry.enabled) continue

      const rule: ContextInjectionRule = {
        id: `wb_${entry.id}`,
        name: entry.comment || `WorldBook Entry ${entry.id}`,
        enabled: true,
        triggerKeywords: entry.keys,
        secondaryKeywords: entry.secondary_keys,
        content: entry.content,
        position: this.mapWorldBookPosition(entry.position),
        depth: entry.depth,
        constant: entry.constant,
        priority: entry.insertion_order,
        caseSensitive: entry.case_sensitive
      }

      rules.push(rule)
    }

    // 按优先级排序
    rules.sort((a, b) => a.priority - b.priority)

    return rules
  }

  /**
   * 映射 WorldBook 位置到注入位置
   */
  private mapWorldBookPosition(
    position: string
  ): 'before_system' | 'after_system' | 'before_user' | 'after_user' | 'depth' {
    switch (position) {
      case 'before_char':
      case 'before_system':
        return 'before_system'
      case 'after_char':
      case 'after_system':
        return 'after_system'
      case 'before_example':
        return 'before_user'
      case 'after_example':
        return 'after_user'
      case 'depth':
        return 'depth'
      default:
        return 'after_system'
    }
  }

  /**
   * 清理名称为合法标识符
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50)
  }

  /**
   * 从性格描述中提取特质标签
   */
  private extractTraits(personality: string): string[] {
    if (!personality) return []

    // 常见特质关键词
    const traitPatterns = [
      '友好', '温柔', '活泼', '冷静', '严肃', '幽默', '热情', '内向',
      '外向', '聪明', '勇敢', '谨慎', '善良', '傲慢', '谦虚', '神秘',
      '开朗', '沉稳', '可爱', '成熟', '天真', '狡猾', '正直', '叛逆',
      'friendly', 'kind', 'shy', 'bold', 'calm', 'cheerful', 'serious',
      'playful', 'intelligent', 'mysterious', 'mature', 'innocent'
    ]

    const traits: string[] = []
    const lowerPersonality = personality.toLowerCase()

    for (const trait of traitPatterns) {
      if (lowerPersonality.includes(trait.toLowerCase())) {
        traits.push(trait)
      }
    }

    return traits.slice(0, 10) // 最多 10 个特质
  }

  /**
   * 检测语气风格
   */
  private detectTone(personality: string): 'formal' | 'casual' | 'playful' | 'professional' {
    if (!personality) return 'casual'

    const lower = personality.toLowerCase()

    if (lower.includes('正式') || lower.includes('严肃') || lower.includes('formal') || lower.includes('serious')) {
      return 'formal'
    }

    if (lower.includes('活泼') || lower.includes('可爱') || lower.includes('playful') || lower.includes('cute')) {
      return 'playful'
    }

    if (lower.includes('专业') || lower.includes('professional') || lower.includes('expert')) {
      return 'professional'
    }

    return 'casual'
  }

  /**
   * 应用上下文注入规则到消息
   *
   * @param messages 当前消息列表
   * @param rules 注入规则
   * @param context 当前上下文文本 (用于关键词匹配)
   * @returns 注入后的消息
   */
  applyContextInjections(
    messages: Array<{ role: string; content: string }>,
    rules: ContextInjectionRule[],
    context: string
  ): Array<{ role: string; content: string }> {
    const result = [...messages]
    const contextLower = context.toLowerCase()

    // 收集需要注入的规则
    const toInject: Array<{ rule: ContextInjectionRule; index: number }> = []

    for (const rule of rules) {
      if (!rule.enabled) continue

      // 检查是否常驻
      if (rule.constant) {
        toInject.push({ rule, index: this.getInjectionIndex(result, rule) })
        continue
      }

      // 检查主关键词
      const primaryMatch = rule.triggerKeywords.some((kw) =>
        rule.caseSensitive
          ? context.includes(kw)
          : contextLower.includes(kw.toLowerCase())
      )

      if (!primaryMatch) continue

      // 检查二级关键词 (如果有)
      if (rule.secondaryKeywords.length > 0) {
        const secondaryMatch = rule.secondaryKeywords.some((kw) =>
          rule.caseSensitive
            ? context.includes(kw)
            : contextLower.includes(kw.toLowerCase())
        )

        if (!secondaryMatch) continue
      }

      toInject.push({ rule, index: this.getInjectionIndex(result, rule) })
    }

    // 按优先级排序后注入
    toInject.sort((a, b) => a.rule.priority - b.rule.priority)

    // 从后向前注入，避免索引偏移
    for (let i = toInject.length - 1; i >= 0; i--) {
      const { rule, index } = toInject[i]
      result.splice(index, 0, {
        role: 'system',
        content: rule.content
      })
    }

    return result
  }

  /**
   * 获取注入位置索引
   */
  private getInjectionIndex(
    messages: Array<{ role: string; content: string }>,
    rule: ContextInjectionRule
  ): number {
    switch (rule.position) {
      case 'before_system':
        return 0

      case 'after_system': {
        // 找到第一个非 system 消息的位置
        const firstNonSystem = messages.findIndex((m) => m.role !== 'system')
        return firstNonSystem === -1 ? messages.length : firstNonSystem
      }

      case 'before_user': {
        // 找到第一个 user 消息
        const firstUser = messages.findIndex((m) => m.role === 'user')
        return firstUser === -1 ? messages.length : firstUser
      }

      case 'after_user': {
        // 找到最后一个 user 消息之后
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            return i + 1
          }
        }
        return messages.length
      }

      case 'depth': {
        // 按深度从末尾向前计算
        const depth = rule.depth || 0
        return Math.max(0, messages.length - depth)
      }

      default:
        return messages.length
    }
  }
}

// ==================== 单例导出 ====================

let bridgeInstance: TavernAssistantBridge | null = null

export function getTavernAssistantBridge(): TavernAssistantBridge {
  if (!bridgeInstance) {
    bridgeInstance = new TavernAssistantBridge()
  }
  return bridgeInstance
}

export function createTavernAssistantBridge(): TavernAssistantBridge {
  return new TavernAssistantBridge()
}
