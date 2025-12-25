/**
 * 提示词服务模块
 *
 * 统一的提示词构建服务，解耦 UI 层和执行层
 *
 * @module services/prompts
 */

export type {
  PromptBuildContext,
  PromptBuilder,
  PromptResult,
  PromptTemplates
} from './PromptBuilder'
export { BasePromptBuilder } from './PromptBuilder'
export { default, PromptService } from './PromptService'

// 导出具体的构建器
export { PatternPromptBuilder } from './PatternPromptBuilder'

// 导入构建器用于初始化
import { PatternPromptBuilder } from './PatternPromptBuilder'
import { PromptService } from './PromptService'

/**
 * 初始化提示词服务
 * 注册所有内置的提示词构建器
 */
export function initializePromptService(): void {
  // 注册图案生成构建器
  PromptService.registerBuilder(new PatternPromptBuilder())

  // TODO: 注册其他构建器
  // PromptService.registerBuilder(new EcomPromptBuilder())
  // PromptService.registerBuilder(new ModelPromptBuilder())
}
