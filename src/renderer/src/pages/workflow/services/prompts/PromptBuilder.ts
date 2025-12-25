/**
 * 提示词构建器接口
 *
 * 定义节点类型特定的提示词构建逻辑
 * 每种需要提示词的节点类型应该实现此接口
 *
 * @module services/prompts/PromptBuilder
 */

/**
 * 提示词构建结果
 */
export interface PromptResult {
  /** 系统提示词 */
  systemPrompt: string
  /** 用户提示词 */
  userPrompt: string
  /** 负面提示词（可选） */
  negativePrompt?: string
  /** 最终完整提示词（发送给 AI 的） */
  fullPrompt: string
}

/**
 * 默认提示词模板
 * 用于 UI 编辑器展示
 */
export interface PromptTemplates {
  /** 默认系统提示词 */
  system: string
  /** 默认用户提示词 */
  user: string
  /** 提示词描述（帮助用户理解用途） */
  description: string
}

/**
 * 提示词构建器接口
 *
 * 所有需要提示词功能的节点应该实现此接口
 */
export interface PromptBuilder {
  /** 节点类型标识符 */
  readonly nodeType: string

  /**
   * 构建系统提示词
   *
   * @param config - 节点配置
   * @returns 系统提示词字符串
   */
  buildSystemPrompt(config: Record<string, any>): string

  /**
   * 构建用户提示词
   *
   * @param config - 节点配置
   * @param inputs - 节点输入数据
   * @returns 用户提示词字符串
   */
  buildUserPrompt(config: Record<string, any>, inputs: Record<string, any>): string

  /**
   * 构建负面提示词（可选）
   *
   * @param config - 节点配置
   * @returns 负面提示词字符串
   */
  buildNegativePrompt?(config: Record<string, any>): string

  /**
   * 获取默认提示词模板
   * 用于 UI 编辑器初始化和重置
   *
   * @returns 默认提示词模板
   */
  getDefaultTemplates(): PromptTemplates
}

/**
 * 提示词构建上下文
 * 传递给 PromptService.build() 的参数
 */
export interface PromptBuildContext {
  /** 节点类型 */
  nodeType: string
  /** 节点配置 */
  config: Record<string, any>
  /** 节点输入数据 */
  inputs: Record<string, any>
  /** 用户自定义提示词覆盖 */
  customPrompts?: {
    system?: string
    user?: string
  }
}

/**
 * 基础提示词构建器
 *
 * 提供默认实现，可以被具体节点类型继承和覆盖
 */
export abstract class BasePromptBuilder implements PromptBuilder {
  abstract readonly nodeType: string

  abstract buildSystemPrompt(config: Record<string, any>): string
  abstract buildUserPrompt(config: Record<string, any>, inputs: Record<string, any>): string
  abstract getDefaultTemplates(): PromptTemplates

  /**
   * 默认负面提示词构建（返回空字符串）
   */
  buildNegativePrompt(_config: Record<string, any>): string {
    return ''
  }

  /**
   * 合并配置中的自定义提示词
   *
   * @param defaultPrompt - 默认提示词
   * @param customPrompt - 自定义提示词
   * @returns 合并后的提示词
   */
  protected mergeCustomPrompt(defaultPrompt: string, customPrompt?: string): string {
    if (!customPrompt || customPrompt.trim() === '') {
      return defaultPrompt
    }
    return customPrompt
  }

  /**
   * 从配置中提取提示词相关字段
   *
   * @param config - 节点配置
   * @returns 提示词相关配置
   */
  protected extractPromptConfig(config: Record<string, any>): {
    customPrompt?: string
    negativePrompt?: string
    useSystemPrompt?: boolean
    promptEnhancement?: boolean
  } {
    return {
      customPrompt: config.customPrompt,
      negativePrompt: config.negativePrompt,
      useSystemPrompt: config.useSystemPrompt ?? true,
      promptEnhancement: config.promptEnhancement ?? false
    }
  }
}
