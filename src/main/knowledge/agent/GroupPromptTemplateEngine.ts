/**
 * GroupPromptTemplateEngine - 群聊提示词模板引擎
 *
 * 为群聊中的不同角色生成角色感知的系统提示词
 * 支持变量替换、条件渲染、角色特定指令
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('GroupPromptTemplateEngine')

/**
 * Agent 角色类型
 */
export type AgentRole = 'host' | 'participant' | 'observer' | 'expert' | 'moderator'

/**
 * 模板上下文
 */
export interface TemplateContext {
  /** Agent 信息 */
  agentName: string
  agentDisplayName: string
  agentRole: AgentRole
  expertise: string[]
  triggerKeywords: string[]

  /** 群聊信息 */
  sessionName?: string
  currentTopic?: string
  otherAgents: { name: string; role: AgentRole; expertise: string[] }[]
  participantCount: number

  /** 对话上下文 */
  recentMessages?: string
  userMessage?: string
  mentionedBy?: string

  /** 自定义变量 */
  customVars?: Record<string, string>
}

/**
 * 模板配置
 */
export interface TemplateConfig {
  /** 是否包含角色说明 */
  includeRoleDescription: boolean
  /** 是否包含其他参与者信息 */
  includeOtherAgents: boolean
  /** 是否包含协作指令 */
  includeCollaborationGuidelines: boolean
  /** 是否包含对话上下文 */
  includeConversationContext: boolean
  /** 最大上下文消息数 */
  maxContextMessages: number
  /** 语言 */
  language: 'zh' | 'en'
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TemplateConfig = {
  includeRoleDescription: true,
  includeOtherAgents: true,
  includeCollaborationGuidelines: true,
  includeConversationContext: true,
  maxContextMessages: 10,
  language: 'zh'
}

/**
 * 角色描述模板 (中文)
 */
const ROLE_DESCRIPTIONS_ZH: Record<AgentRole, string> = {
  host: '你是本次群聊的主持人，负责引导讨论、协调各方观点、确保对话有序进行。',
  moderator: '你是本次群聊的协调者，负责调解分歧、总结观点、推动共识形成。',
  expert: '你是本次群聊的专家顾问，在你的专业领域提供深入、专业的见解和建议。',
  participant: '你是本次群聊的积极参与者，分享你的观点和想法，与其他成员进行建设性对话。',
  observer: '你是本次群聊的观察者，主要聆听和学习，只在必要时发言。'
}

/**
 * 角色描述模板 (英文)
 */
const ROLE_DESCRIPTIONS_EN: Record<AgentRole, string> = {
  host: 'You are the host of this group chat, responsible for guiding discussions, coordinating viewpoints, and ensuring orderly conversation.',
  moderator:
    'You are the moderator of this group chat, responsible for mediating disagreements, summarizing viewpoints, and facilitating consensus.',
  expert:
    'You are the expert consultant in this group chat, providing deep, professional insights and suggestions in your area of expertise.',
  participant:
    'You are an active participant in this group chat, sharing your views and ideas, engaging in constructive dialogue with other members.',
  observer: 'You are an observer in this group chat, mainly listening and learning, speaking only when necessary.'
}

/**
 * 协作指南 (中文)
 */
const COLLABORATION_GUIDELINES_ZH = `
## 群聊协作指南
1. 尊重其他参与者的观点，即使你不同意
2. 当被 @ 提及时，请及时回应
3. 如果需要特定专家的意见，可以使用 @名字 来提及他们
4. 保持回复简洁有针对性，避免长篇大论
5. 如果发现错误或遗漏，礼貌地指出并提供修正建议
`

/**
 * 协作指南 (英文)
 */
const COLLABORATION_GUIDELINES_EN = `
## Group Chat Collaboration Guidelines
1. Respect other participants' viewpoints, even if you disagree
2. Respond promptly when mentioned with @
3. If you need a specific expert's opinion, use @name to mention them
4. Keep responses concise and focused, avoid lengthy monologues
5. If you notice errors or omissions, politely point them out and suggest corrections
`

/**
 * 群聊提示词模板引擎
 */
export class GroupPromptTemplateEngine {
  private config: TemplateConfig
  private customTemplates: Map<string, string> = new Map()

  constructor(config: Partial<TemplateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.info('GroupPromptTemplateEngine initialized', { config: this.config })
  }

  /**
   * 生成完整的系统提示词
   */
  generateSystemPrompt(context: TemplateContext, originalPrompt?: string): string {
    const parts: string[] = []

    // 1. 基础身份
    parts.push(this.generateIdentitySection(context))

    // 2. 角色描述
    if (this.config.includeRoleDescription) {
      parts.push(this.generateRoleSection(context))
    }

    // 3. 专业领域
    if (context.expertise.length > 0) {
      parts.push(this.generateExpertiseSection(context))
    }

    // 4. 其他参与者
    if (this.config.includeOtherAgents && context.otherAgents.length > 0) {
      parts.push(this.generateOtherAgentsSection(context))
    }

    // 5. 协作指南
    if (this.config.includeCollaborationGuidelines) {
      parts.push(this.getCollaborationGuidelines())
    }

    // 6. 原始提示词 (如果有)
    if (originalPrompt) {
      parts.push(this.generateOriginalPromptSection(originalPrompt))
    }

    // 7. 当前话题
    if (context.currentTopic) {
      parts.push(this.generateTopicSection(context))
    }

    return parts.filter((p) => p.trim()).join('\n\n')
  }

  /**
   * 生成身份部分
   */
  private generateIdentitySection(context: TemplateContext): string {
    const isZh = this.config.language === 'zh'
    return isZh ? `你是 ${context.agentDisplayName}。` : `You are ${context.agentDisplayName}.`
  }

  /**
   * 生成角色部分
   */
  private generateRoleSection(context: TemplateContext): string {
    const descriptions = this.config.language === 'zh' ? ROLE_DESCRIPTIONS_ZH : ROLE_DESCRIPTIONS_EN
    return descriptions[context.agentRole] || descriptions.participant
  }

  /**
   * 生成专业领域部分
   */
  private generateExpertiseSection(context: TemplateContext): string {
    const isZh = this.config.language === 'zh'
    const expertiseList = context.expertise.join(isZh ? '、' : ', ')
    return isZh
      ? `你的专业领域包括：${expertiseList}。在这些领域，你可以提供深入的见解。`
      : `Your areas of expertise include: ${expertiseList}. You can provide deep insights in these areas.`
  }

  /**
   * 生成其他参与者部分
   */
  private generateOtherAgentsSection(context: TemplateContext): string {
    const isZh = this.config.language === 'zh'
    const header = isZh ? '## 其他参与者' : '## Other Participants'

    const agentLines = context.otherAgents.map((agent) => {
      const roleLabel = this.getRoleLabel(agent.role)
      const expertiseStr =
        agent.expertise.length > 0
          ? isZh
            ? `，专长: ${agent.expertise.join('、')}`
            : `, expertise: ${agent.expertise.join(', ')}`
          : ''
      return `- ${agent.name} (${roleLabel})${expertiseStr}`
    })

    return `${header}\n${agentLines.join('\n')}`
  }

  /**
   * 获取角色标签
   */
  private getRoleLabel(role: AgentRole): string {
    const isZh = this.config.language === 'zh'
    const labels: Record<AgentRole, { zh: string; en: string }> = {
      host: { zh: '主持人', en: 'Host' },
      moderator: { zh: '协调者', en: 'Moderator' },
      expert: { zh: '专家', en: 'Expert' },
      participant: { zh: '参与者', en: 'Participant' },
      observer: { zh: '观察者', en: 'Observer' }
    }
    return isZh ? labels[role].zh : labels[role].en
  }

  /**
   * 获取协作指南
   */
  private getCollaborationGuidelines(): string {
    return this.config.language === 'zh' ? COLLABORATION_GUIDELINES_ZH : COLLABORATION_GUIDELINES_EN
  }

  /**
   * 生成原始提示词部分
   */
  private generateOriginalPromptSection(originalPrompt: string): string {
    const isZh = this.config.language === 'zh'
    const header = isZh ? '## 你的核心指令' : '## Your Core Instructions'
    return `${header}\n${originalPrompt}`
  }

  /**
   * 生成话题部分
   */
  private generateTopicSection(context: TemplateContext): string {
    const isZh = this.config.language === 'zh'
    return isZh ? `当前讨论话题：${context.currentTopic}` : `Current discussion topic: ${context.currentTopic}`
  }

  /**
   * 生成带上下文的用户消息
   */
  generateUserMessageWithContext(context: TemplateContext, userMessage: string): string {
    if (!this.config.includeConversationContext || !context.recentMessages) {
      return userMessage
    }

    const isZh = this.config.language === 'zh'
    const contextHeader = isZh ? '对话历史:' : 'Conversation history:'
    const messageHeader = isZh ? '当前消息:' : 'Current message:'

    return `${contextHeader}\n${context.recentMessages}\n\n${messageHeader}\n${userMessage}`
  }

  /**
   * 注册自定义模板
   */
  registerTemplate(name: string, template: string): void {
    this.customTemplates.set(name, template)
    logger.debug('Custom template registered', { name })
  }

  /**
   * 使用自定义模板生成提示词
   */
  generateFromTemplate(templateName: string, context: TemplateContext): string | null {
    const template = this.customTemplates.get(templateName)
    if (!template) {
      logger.warn('Template not found', { templateName })
      return null
    }
    return this.interpolate(template, context)
  }

  /**
   * 模板变量插值
   */
  private interpolate(template: string, context: TemplateContext): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      // 检查自定义变量
      if (context.customVars && context.customVars[key]) {
        return context.customVars[key]
      }

      // 检查上下文属性
      switch (key) {
        case 'agentName':
          return context.agentName
        case 'agentDisplayName':
          return context.agentDisplayName
        case 'agentRole':
          return this.getRoleLabel(context.agentRole)
        case 'expertise':
          return context.expertise.join(', ')
        case 'currentTopic':
          return context.currentTopic || ''
        case 'participantCount':
          return String(context.participantCount)
        case 'sessionName':
          return context.sessionName || ''
        default:
          return `{{${key}}}`
      }
    })
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TemplateConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// 单例实例
let defaultEngine: GroupPromptTemplateEngine | null = null

/**
 * 获取默认模板引擎实例
 */
export function getGroupPromptTemplateEngine(config?: Partial<TemplateConfig>): GroupPromptTemplateEngine {
  if (!defaultEngine) {
    defaultEngine = new GroupPromptTemplateEngine(config)
  }
  return defaultEngine
}

/**
 * 创建新的模板引擎实例
 */
export function createGroupPromptTemplateEngine(config?: Partial<TemplateConfig>): GroupPromptTemplateEngine {
  return new GroupPromptTemplateEngine(config)
}
