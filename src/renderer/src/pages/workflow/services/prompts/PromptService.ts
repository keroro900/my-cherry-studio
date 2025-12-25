/**
 * 统一提示词服务
 *
 * 作为提示词构建的统一入口，解耦 UI 层和执行层的提示词逻辑
 *
 * 使用方法：
 * ```typescript
 * // 在执行器中构建提示词
 * const promptResult = PromptService.build({
 *   nodeType: config.nodeType,
 *   config,
 *   inputs,
 *   customPrompts: config.customPrompts
 * })
 *
 * // 在 UI 中获取默认模板
 * const templates = PromptService.getDefaultPrompts('gemini_pattern')
 * ```
 *
 * @module services/prompts/PromptService
 */

import type { PromptBuildContext, PromptBuilder, PromptResult, PromptTemplates } from './PromptBuilder'

/**
 * 提示词服务类
 *
 * 单例模式，管理所有提示词构建器并提供统一的构建入口
 */
class PromptServiceImpl {
  /** 构建器注册表 */
  private builders: Map<string, PromptBuilder> = new Map()

  /** 默认模板缓存 */
  private templateCache: Map<string, PromptTemplates> = new Map()

  /**
   * 注册提示词构建器
   *
   * @param builder - 提示词构建器实例
   */
  registerBuilder(builder: PromptBuilder): void {
    this.builders.set(builder.nodeType, builder)
    // 清除缓存
    this.templateCache.delete(builder.nodeType)
  }

  /**
   * 注销提示词构建器
   *
   * @param nodeType - 节点类型
   */
  unregisterBuilder(nodeType: string): void {
    this.builders.delete(nodeType)
    this.templateCache.delete(nodeType)
  }

  /**
   * 检查是否已注册指定节点类型的构建器
   *
   * @param nodeType - 节点类型
   */
  hasBuilder(nodeType: string): boolean {
    return this.builders.has(nodeType)
  }

  /**
   * 获取构建器
   *
   * @param nodeType - 节点类型
   * @returns 构建器实例或 undefined
   */
  getBuilder(nodeType: string): PromptBuilder | undefined {
    return this.builders.get(nodeType)
  }

  /**
   * 构建提示词
   *
   * 这是执行器调用的主要方法，负责：
   * 1. 查找对应的构建器
   * 2. 构建系统提示词和用户提示词
   * 3. 合并用户自定义覆盖
   * 4. 返回完整的提示词结果
   *
   * @param context - 构建上下文
   * @returns 提示词结果
   */
  build(context: PromptBuildContext): PromptResult {
    const { nodeType, config, inputs, customPrompts } = context
    const builder = this.builders.get(nodeType)

    if (!builder) {
      // 没有注册构建器时的回退逻辑
      return this.buildFallback(context)
    }

    // 构建默认提示词
    let systemPrompt = builder.buildSystemPrompt(config)
    let userPrompt = builder.buildUserPrompt(config, inputs)
    const negativePrompt = builder.buildNegativePrompt?.(config) || ''

    // 合并用户自定义覆盖
    if (customPrompts?.system && customPrompts.system.trim()) {
      systemPrompt = customPrompts.system
    }
    if (customPrompts?.user && customPrompts.user.trim()) {
      userPrompt = customPrompts.user
    }

    // 构建完整提示词
    const fullPrompt = this.combinePrompts(systemPrompt, userPrompt)

    return {
      systemPrompt,
      userPrompt,
      negativePrompt,
      fullPrompt
    }
  }

  /**
   * 获取默认提示词模板
   *
   * 用于 UI 编辑器显示默认值和重置功能
   *
   * @param nodeType - 节点类型
   * @returns 默认模板或空模板
   */
  getDefaultPrompts(nodeType: string): PromptTemplates {
    // 检查缓存
    const cached = this.templateCache.get(nodeType)
    if (cached) {
      return cached
    }

    const builder = this.builders.get(nodeType)
    if (!builder) {
      return {
        system: '',
        user: '',
        description: '此节点类型没有注册提示词构建器'
      }
    }

    const templates = builder.getDefaultTemplates()
    this.templateCache.set(nodeType, templates)
    return templates
  }

  /**
   * 合并用户自定义提示词与默认提示词
   *
   * @param defaults - 默认提示词
   * @param customPrompts - 用户自定义
   * @returns 合并后的提示词
   */
  mergeCustomPrompts(
    defaults: { system: string; user: string },
    customPrompts?: { system?: string; user?: string }
  ): { system: string; user: string } {
    return {
      system: customPrompts?.system?.trim() || defaults.system,
      user: customPrompts?.user?.trim() || defaults.user
    }
  }

  /**
   * 获取所有已注册的节点类型
   */
  getRegisteredNodeTypes(): string[] {
    return Array.from(this.builders.keys())
  }

  /**
   * 清除所有注册（主要用于测试）
   */
  clear(): void {
    this.builders.clear()
    this.templateCache.clear()
  }

  /**
   * 组合系统提示词和用户提示词
   */
  private combinePrompts(systemPrompt: string, userPrompt: string): string {
    const parts: string[] = []

    if (systemPrompt.trim()) {
      parts.push(systemPrompt.trim())
    }

    if (userPrompt.trim()) {
      parts.push(userPrompt.trim())
    }

    return parts.join('\n\n')
  }

  /**
   * 回退构建逻辑
   *
   * 当没有注册构建器时使用
   */
  private buildFallback(context: PromptBuildContext): PromptResult {
    const { config, inputs, customPrompts } = context

    // 尝试从配置中获取提示词
    let systemPrompt = config.systemPrompt || ''
    let userPrompt = config.prompt || config.userPrompt || ''

    // 尝试从输入中获取提示词
    if (!userPrompt && inputs.prompt) {
      userPrompt = String(inputs.prompt)
    }

    // 合并自定义覆盖
    if (customPrompts?.system) {
      systemPrompt = customPrompts.system
    }
    if (customPrompts?.user) {
      userPrompt = customPrompts.user
    }

    return {
      systemPrompt,
      userPrompt,
      negativePrompt: config.negativePrompt || '',
      fullPrompt: this.combinePrompts(systemPrompt, userPrompt)
    }
  }
}

/**
 * 提示词服务单例
 */
export const PromptService = new PromptServiceImpl()

export default PromptService
