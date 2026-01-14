/**
 * TemplateResolver - Crew 模板变量解析器
 *
 * 为 MultiModelCodeCrew 提供模板变量解析能力：
 * - {{placeholder}} 变量解析
 * - 递归 Agent 嵌套展开
 * - 内置变量支持
 * - VCP PlaceholderEngine 集成
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('TemplateResolver')

// ==================== 类型定义 ====================

/**
 * 解析上下文
 */
interface ResolveContext {
  /** 当前会话 ID */
  sessionId?: string
  /** 当前成员 ID */
  memberId?: string
  /** 当前项目信息 */
  project?: {
    id: string
    name: string
    path?: string
  }
  /** 自定义变量 */
  variables?: Record<string, string | number | boolean>
  /** 已解析的 Agent 栈（防止循环引用） */
  resolvedAgents?: Set<string>
}

/**
 * 内置变量
 */
interface BuiltinVariables {
  /** 当前日期 */
  date: string
  /** 当前时间 */
  time: string
  /** 当前日期时间 */
  datetime: string
  /** 当前时间戳 */
  timestamp: number
  /** 平台 */
  platform: string
  /** 用户名 */
  username?: string
}

/**
 * 解析结果
 */
interface ResolveResult {
  success: boolean
  text: string
  resolvedVariables: string[]
  unresolvedVariables: string[]
  errors?: string[]
}

// ==================== 模板解析器实现 ====================

class TemplateResolverImpl {
  private customVariables: Map<string, string> = new Map()
  private variablePattern = /\{\{([^}]+)\}\}/g
  private agentPattern = /\{\{agent:([^}]+)\}\}/g

  /**
   * 注册自定义变量
   */
  registerVariable(name: string, value: string): void {
    this.customVariables.set(name, value)
    logger.debug('Variable registered', { name })
  }

  /**
   * 注册多个自定义变量
   */
  registerVariables(variables: Record<string, string>): void {
    for (const [name, value] of Object.entries(variables)) {
      this.customVariables.set(name, value)
    }
    logger.debug('Variables registered', { count: Object.keys(variables).length })
  }

  /**
   * 清除自定义变量
   */
  clearVariables(): void {
    this.customVariables.clear()
  }

  /**
   * 获取自定义变量
   */
  getVariable(name: string): string | undefined {
    return this.customVariables.get(name)
  }

  // ==================== 核心解析 ====================

  /**
   * 解析模板文本
   */
  async resolve(text: string, context?: ResolveContext): Promise<string> {
    if (!text || !text.includes('{{')) {
      return text
    }

    const result = await this.resolveWithDetails(text, context)
    return result.text
  }

  /**
   * 解析模板文本（带详细结果）
   */
  async resolveWithDetails(text: string, context?: ResolveContext): Promise<ResolveResult> {
    const resolvedVariables: string[] = []
    const unresolvedVariables: string[] = []
    const errors: string[] = []

    let resolvedText = text

    // 1. 解析 Agent 嵌套
    resolvedText = await this.resolveAgentPlaceholders(resolvedText, context, errors)

    // 2. 解析内置变量
    const builtins = this.getBuiltinVariables()
    for (const [name, value] of Object.entries(builtins)) {
      const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g')
      if (pattern.test(resolvedText)) {
        resolvedText = resolvedText.replace(pattern, String(value))
        resolvedVariables.push(name)
      }
    }

    // 3. 解析上下文变量
    if (context?.variables) {
      for (const [name, value] of Object.entries(context.variables)) {
        const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g')
        if (pattern.test(resolvedText)) {
          resolvedText = resolvedText.replace(pattern, String(value))
          resolvedVariables.push(name)
        }
      }
    }

    // 4. 解析自定义变量
    for (const [name, value] of this.customVariables) {
      const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g')
      if (pattern.test(resolvedText)) {
        resolvedText = resolvedText.replace(pattern, value)
        resolvedVariables.push(name)
      }
    }

    // 5. 尝试使用 VCP PlaceholderEngine 解析剩余变量
    if (resolvedText.includes('{{')) {
      resolvedText = await this.resolveWithVCP(resolvedText, context, errors)
    }

    // 6. 收集未解析的变量
    const remaining = resolvedText.match(this.variablePattern)
    if (remaining) {
      for (const match of remaining) {
        const varName = match.replace(/\{\{|\}\}/g, '')
        if (!unresolvedVariables.includes(varName)) {
          unresolvedVariables.push(varName)
        }
      }
    }

    return {
      success: unresolvedVariables.length === 0 && errors.length === 0,
      text: resolvedText,
      resolvedVariables,
      unresolvedVariables,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * 解析 Agent 嵌套占位符
   * 例如: {{agent:architect}} 会展开为架构师 Agent 的 prompt
   */
  async resolveAgentPlaceholders(text: string, context?: ResolveContext, errors?: string[]): Promise<string> {
    const stack = context?.resolvedAgents || new Set<string>()
    let result = text

    // 查找所有 Agent 占位符
    const matches = text.matchAll(this.agentPattern)

    for (const match of matches) {
      const agentName = match[1].trim()

      // 检查循环引用
      if (stack.has(agentName)) {
        const errorMsg = `Circular reference detected for agent: ${agentName}`
        logger.warn(errorMsg)
        errors?.push(errorMsg)
        continue
      }

      // 获取 Agent prompt
      try {
        stack.add(agentName)
        const agentPrompt = await this.getAgentPrompt(agentName)

        if (agentPrompt) {
          // 递归解析 Agent prompt 中的变量
          const resolvedPrompt = await this.resolve(agentPrompt, {
            ...context,
            resolvedAgents: stack
          })
          result = result.replace(match[0], resolvedPrompt)
        } else {
          const errorMsg = `Agent not found: ${agentName}`
          logger.warn(errorMsg)
          errors?.push(errorMsg)
        }
      } catch (error) {
        const errorMsg = `Error resolving agent ${agentName}: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg)
        errors?.push(errorMsg)
      }
    }

    return result
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取内置变量
   */
  private getBuiltinVariables(): BuiltinVariables {
    const now = new Date()

    return {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      datetime: now.toISOString(),
      timestamp: now.getTime(),
      platform: typeof process !== 'undefined' ? process.platform : 'browser'
    }
  }

  /**
   * 获取 Agent prompt
   */
  private async getAgentPrompt(agentName: string): Promise<string | null> {
    // 尝试通过 VCP Agent 服务获取
    if (window.api?.vcpAgent?.get) {
      try {
        const result = await window.api.vcpAgent.get({ id: agentName })
        if (result?.success && result.agent) {
          return result.agent.systemPrompt || null
        }
      } catch (error) {
        logger.debug(`VCP Agent service failed for ${agentName}:`, error as Error)
      }
    }

    // 尝试通过 Redux store 获取
    // 这需要在渲染进程中访问 store
    try {
      // 动态导入以避免循环依赖
      const storeModule = await import('@renderer/store')
      const store = storeModule.default
      const assistants = store.getState().assistants?.assistants || []
      const agent = assistants.find(
        (a: { name?: string; id?: string }) => a.name?.toLowerCase() === agentName.toLowerCase() || a.id === agentName
      )
      if (agent?.prompt) {
        return agent.prompt
      }
    } catch (error) {
      logger.debug(`Redux store access failed for ${agentName}:`, error as Error)
    }

    return null
  }

  /**
   * 使用 VCP PlaceholderEngine 解析
   */
  private async resolveWithVCP(text: string, _context?: ResolveContext, errors?: string[]): Promise<string> {
    if (!window.api?.vcpPlaceholder?.resolve) {
      return text
    }

    try {
      const result = await window.api.vcpPlaceholder.resolve(text)

      if (result?.success && result.result) {
        return result.result
      }
    } catch (error) {
      const errorMsg = `VCP PlaceholderEngine error: ${error instanceof Error ? error.message : String(error)}`
      logger.warn(errorMsg)
      errors?.push(errorMsg)
    }

    return text
  }

  /**
   * 检查文本是否包含模板变量
   */
  hasVariables(text: string): boolean {
    return this.variablePattern.test(text)
  }

  /**
   * 提取所有变量名
   */
  extractVariableNames(text: string): string[] {
    const names: string[] = []
    const matches = text.matchAll(this.variablePattern)

    for (const match of matches) {
      const name = match[1].trim()
      if (!names.includes(name)) {
        names.push(name)
      }
    }

    return names
  }

  /**
   * 简单字符串替换（同步）
   */
  replaceSimple(text: string, variables: Record<string, string>): string {
    let result = text

    for (const [name, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g')
      result = result.replace(pattern, value)
    }

    return result
  }
}

// ==================== 导出 ====================

export const TemplateResolver = new TemplateResolverImpl()

export type { ResolveContext, BuiltinVariables, ResolveResult }

export default TemplateResolver
