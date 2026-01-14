/**
 * 动态配置引擎
 *
 * 支持 VCPToolBox 风格的多级变量替换系统
 *
 * 变量类型:
 * - {{Agent*}} - Agent 属性变量
 * - {{Tar*}} - 目标变量
 * - {{Var*}} - 自定义变量
 * - {{Sar*}} - 系统变量
 * - {{角色日记本}} / [[角色日记本]] - 日记声明
 *
 * @module upl/DynamicConfigEngine
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('DynamicConfigEngine')

// ==================== 变量类型定义 ====================

/**
 * 变量类型
 */
export type VariableType = 'Agent' | 'Tar' | 'Var' | 'Sar' | 'Diary' | 'System' | 'Custom'

/**
 * 变量解析器函数
 */
export type VariableResolver = (name: string, context: VariableContext) => string | undefined

/**
 * 变量上下文
 */
export interface VariableContext {
  /** Agent 信息 */
  agent?: {
    id: string
    name: string
    systemPrompt?: string
    [key: string]: unknown
  }
  /** 目标信息 */
  target?: Record<string, unknown>
  /** 用户变量 */
  userVariables?: Record<string, string>
  /** 系统变量 */
  systemVariables?: Record<string, string>
  /** 当前消息 */
  currentMessage?: string
  /** 聊天历史 */
  chatHistory?: Array<{ role: string; content: string }>
  /** 时间信息 */
  time?: {
    now: Date
    timezone: string
  }
  /** 额外数据 */
  extra?: Record<string, unknown>
}

/**
 * 变量定义
 */
export interface VariableDefinition {
  /** 变量类型 */
  type: VariableType
  /** 变量名称 */
  name: string
  /** 描述 */
  description?: string
  /** 解析器 */
  resolver: VariableResolver
  /** 是否必需 */
  required?: boolean
  /** 默认值 */
  defaultValue?: string
}

// ==================== 日记声明类型 ====================

/**
 * 日记检索模式
 */
export type DiaryRetrievalMode = 'fulltext' | 'rag' | 'threshold_fulltext' | 'threshold_rag'

/**
 * 日记声明
 */
export interface DiaryDeclaration {
  /** 模式 */
  mode: DiaryRetrievalMode
  /** 知识库名称 */
  knowledgeBaseName: string
  /** 修饰符 */
  modifiers: DiaryModifier[]
  /** 原始文本 */
  rawText: string
}

/**
 * 日记修饰符
 */
export interface DiaryModifier {
  /** 修饰符类型 */
  type: 'Time' | 'Group' | 'TagMemo' | 'Rerank' | 'Custom'
  /** 参数值 (如 TagMemo0.65 中的 0.65) */
  value?: string
}

// ==================== 动态配置引擎 ====================

/**
 * 动态配置引擎
 */
export class DynamicConfigEngine {
  private resolvers: Map<string, VariableResolver> = new Map()
  private variableDefinitions: Map<string, VariableDefinition> = new Map()

  constructor() {
    this.registerBuiltinResolvers()
  }

  /**
   * 注册内置解析器
   */
  private registerBuiltinResolvers(): void {
    // Agent 变量解析器
    this.registerResolver('Agent', (name, context) => {
      if (!context.agent) return undefined
      const key = name.replace(/^Agent/, '')
      return String(context.agent[key] ?? context.agent[key.toLowerCase()] ?? '')
    })

    // 目标变量解析器
    this.registerResolver('Tar', (name, context) => {
      if (!context.target) return undefined
      const key = name.replace(/^Tar/, '')
      return String(context.target[key] ?? '')
    })

    // 用户变量解析器
    this.registerResolver('Var', (name, context) => {
      if (!context.userVariables) return undefined
      const key = name.replace(/^Var/, '')
      return context.userVariables[key]
    })

    // 系统变量解析器
    this.registerResolver('Sar', (name, context) => {
      if (!context.systemVariables) return undefined
      const key = name.replace(/^Sar/, '')
      return context.systemVariables[key]
    })

    // 时间变量解析器
    this.registerResolver('Time', (_name, context) => {
      const now = context.time?.now || new Date()
      return now.toISOString()
    })

    // 日期变量解析器
    this.registerResolver('Date', (_name, context) => {
      const now = context.time?.now || new Date()
      return now.toLocaleDateString()
    })
  }

  /**
   * 注册变量解析器
   */
  registerResolver(prefix: string, resolver: VariableResolver): void {
    this.resolvers.set(prefix, resolver)
    logger.debug('Resolver registered', { prefix })
  }

  /**
   * 注册变量定义
   */
  registerVariable(definition: VariableDefinition): void {
    this.variableDefinitions.set(`${definition.type}${definition.name}`, definition)
    logger.debug('Variable registered', { type: definition.type, name: definition.name })
  }

  /**
   * 解析模板中的变量
   *
   * 支持的格式:
   * - {{变量名}} - 简单变量
   * - {{Agent.name}} - 点分变量
   * - {{VarCustomKey}} - 类型前缀变量
   */
  resolve(template: string, context: VariableContext): string {
    if (!template) return template

    // 匹配 {{...}} 格式的变量
    const variablePattern = /\{\{([^}]+)\}\}/g

    return template.replace(variablePattern, (match, varName) => {
      const resolved = this.resolveVariable(varName.trim(), context)
      if (resolved !== undefined) {
        return resolved
      }
      // 未解析的变量保持原样
      logger.debug('Unresolved variable', { variable: varName })
      return match
    })
  }

  /**
   * 解析单个变量
   */
  private resolveVariable(varName: string, context: VariableContext): string | undefined {
    // 尝试按前缀匹配解析器
    for (const [prefix, resolver] of this.resolvers) {
      if (varName.startsWith(prefix)) {
        const result = resolver(varName, context)
        if (result !== undefined) {
          return result
        }
      }
    }

    // 尝试点分格式 (如 Agent.name)
    if (varName.includes('.')) {
      const [type, ...rest] = varName.split('.')
      const key = rest.join('.')
      const resolver = this.resolvers.get(type)
      if (resolver) {
        return resolver(`${type}${key}`, context)
      }
    }

    // 检查预定义变量
    const definition = this.variableDefinitions.get(varName)
    if (definition) {
      const result = definition.resolver(varName, context)
      return result ?? definition.defaultValue
    }

    return undefined
  }

  /**
   * 解析日记声明
   *
   * 支持的格式:
   * - {{知识库名}} - 全文注入
   * - [[知识库名]] - RAG 片段检索
   * - <<知识库名>> - 阈值全文
   * - 《《知识库名》》 - 阈值 RAG
   *
   * 修饰符:
   * - ::Time - 时间感知
   * - ::Group - 语义组增强
   * - ::TagMemo0.65 - TagMemo 阈值
   */
  parseDiaryDeclarations(text: string): {
    declarations: DiaryDeclaration[]
    cleanedText: string
  } {
    const declarations: DiaryDeclaration[] = []
    let cleanedText = text

    // 定义各种日记声明模式
    const patterns: Array<{
      pattern: RegExp
      mode: DiaryRetrievalMode
    }> = [
      // {{知识库名}} - 全文注入
      { pattern: /\{\{([^}:]+)((?:::[^}]+)*)\}\}/g, mode: 'fulltext' },
      // [[知识库名]] - RAG 片段检索
      { pattern: /\[\[([^\]:]+)((?:::[^\]]+)*)\]\]/g, mode: 'rag' },
      // <<知识库名>> - 阈值全文
      { pattern: /<<([^>:]+)((?:::[^>]+)*)>>/g, mode: 'threshold_fulltext' },
      // 《《知识库名》》 - 阈值 RAG
      { pattern: /《《([^》:]+)((?:::[^》]+)*)》》/g, mode: 'threshold_rag' }
    ]

    for (const { pattern, mode } of patterns) {
      let match: RegExpExecArray | null
      pattern.lastIndex = 0

      while ((match = pattern.exec(text)) !== null) {
        const knowledgeBaseName = match[1].trim()
        const modifiersStr = match[2] || ''

        // 跳过已知的变量模式 (如 {{Agent*}})
        if (this.isKnownVariable(knowledgeBaseName)) {
          continue
        }

        const modifiers = this.parseModifiers(modifiersStr)

        declarations.push({
          mode,
          knowledgeBaseName,
          modifiers,
          rawText: match[0]
        })

        // 从文本中移除该声明
        cleanedText = cleanedText.replace(match[0], '')
      }
    }

    return {
      declarations,
      cleanedText: cleanedText.trim()
    }
  }

  /**
   * 检查是否为已知变量模式
   */
  private isKnownVariable(name: string): boolean {
    const knownPrefixes = ['Agent', 'Tar', 'Var', 'Sar', 'Time', 'Date']
    return knownPrefixes.some((prefix) => name.startsWith(prefix))
  }

  /**
   * 解析修饰符
   */
  private parseModifiers(modifiersStr: string): DiaryModifier[] {
    if (!modifiersStr) return []

    const modifiers: DiaryModifier[] = []
    const parts = modifiersStr.split('::').filter(Boolean)

    for (const part of parts) {
      const trimmed = part.trim()

      if (trimmed === 'Time') {
        modifiers.push({ type: 'Time' })
      } else if (trimmed === 'Group') {
        modifiers.push({ type: 'Group' })
      } else if (trimmed.startsWith('TagMemo')) {
        const value = trimmed.replace('TagMemo', '')
        modifiers.push({ type: 'TagMemo', value: value || '0.5' })
      } else if (trimmed.startsWith('Rerank')) {
        const value = trimmed.replace('Rerank', '')
        modifiers.push({ type: 'Rerank', value: value || '10' })
      } else {
        modifiers.push({ type: 'Custom', value: trimmed })
      }
    }

    return modifiers
  }

  /**
   * 构建完整的上下文
   */
  buildContext(partial: Partial<VariableContext>): VariableContext {
    return {
      time: {
        now: new Date(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      userVariables: {},
      systemVariables: {
        APP_VERSION: '1.0.0',
        PLATFORM: process.platform
      },
      ...partial
    }
  }

  /**
   * 获取模板中使用的所有变量
   */
  extractVariables(template: string): string[] {
    const variables: string[] = []
    const pattern = /\{\{([^}]+)\}\}/g

    let match: RegExpExecArray | null
    while ((match = pattern.exec(template)) !== null) {
      variables.push(match[1].trim())
    }

    return [...new Set(variables)]
  }

  /**
   * 验证模板
   */
  validateTemplate(
    template: string,
    context: VariableContext
  ): {
    valid: boolean
    unresolved: string[]
    warnings: string[]
  } {
    const variables = this.extractVariables(template)
    const unresolved: string[] = []
    const warnings: string[] = []

    for (const variable of variables) {
      const resolved = this.resolveVariable(variable, context)
      if (resolved === undefined) {
        unresolved.push(variable)
      }
    }

    // 检查日记声明
    const { declarations } = this.parseDiaryDeclarations(template)
    for (const decl of declarations) {
      if (!decl.knowledgeBaseName) {
        warnings.push(`Empty knowledge base name in ${decl.rawText}`)
      }
    }

    return {
      valid: unresolved.length === 0 && warnings.length === 0,
      unresolved,
      warnings
    }
  }
}

// ==================== 导出 ====================

export const dynamicConfigEngine = new DynamicConfigEngine()
