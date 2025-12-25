/**
 * 提示词构建器基类 (Extended)
 * Base Prompt Builder Class with promptJson/preset/auto support
 *
 * 核心决策逻辑：
 * 1. 如果有 promptJson?.full_prompt → 直接使用上游提示词
 * 2. 如果 preset !== 'auto' → 使用选定的预设
 * 3. 否则 → 内部自动分析生成
 */

import { loggerService } from '@logger'

import { HARD_RULES, RECREATION_CONCEPT } from '../core/concepts'
import { HARD_JSON_OUTPUT_CONSTRAINTS } from '../core/json-constraints'
import { PROFESSIONAL_STYLING_RULES, THEME_BACKGROUND_RULES } from '../core/themes'
import type { BuildResult, GarmentAnalysis, PromptModule } from '../modules/types'
import type { PromptBlock } from '../presets/types'
import { extractAndParseJson } from '../utils/jsonExtractor'

const logger = loggerService.withContext('PromptBuilder')

/**
 * promptJson 基础类型
 * 子类可以扩展此类型
 */
export interface BasePromptJson {
  /** 完整的生成提示词（来自上游分析） */
  full_prompt?: string
  /** 服装分析结果（可选） */
  garment_analysis?: GarmentAnalysis
  /** 其他字段由子类定义 */
  [key: string]: unknown
}

/**
 * PromptBuilder 配置选项
 */
export interface PromptBuilderOptions<TPromptJson extends BasePromptJson = BasePromptJson> {
  /** 上游传入的 promptJson（来自 UnifiedPromptNode 或其他分析节点） */
  promptJson?: TPromptJson
  /** 用户选择的预设（'auto' 表示自动分析） */
  preset?: string
  /** 节点配置 */
  config?: Record<string, unknown>
}

/**
 * 提示词构建器基类
 * 使用流式 API 组合提示词块
 *
 * 设计理念：
 * - 单节点独立运行时：自带"视觉创意总监"能力
 * - 有上游 promptJson 时：直接使用上游创意方案
 * - 预设作为快捷入口：用户可手动覆盖
 */
export abstract class PromptBuilder<
  TConfig = Record<string, unknown>,
  TPromptJson extends BasePromptJson = BasePromptJson
> {
  protected blocks: PromptBlock[] = []
  protected modules: PromptModule[] = []
  protected config: TConfig
  protected promptJson?: TPromptJson
  protected preset?: string

  constructor(options: PromptBuilderOptions<TPromptJson> & { config?: TConfig }) {
    this.promptJson = options.promptJson
    this.preset = options.preset
    this.config = (options.config || {}) as TConfig
  }

  // ==================== 核心概念块 ====================

  /**
   * 添加核心 RE-CREATION 概念
   */
  withCore(): this {
    this.blocks.push({
      name: 'core',
      content: RECREATION_CONCEPT,
      priority: 100
    })
    return this
  }

  /**
   * 添加硬性规则
   */
  withHardRules(): this {
    this.blocks.push({
      name: 'hard_rules',
      content: HARD_RULES,
      priority: 90
    })
    return this
  }

  /**
   * 添加主题背景规则
   */
  withThemeRules(): this {
    this.blocks.push({
      name: 'theme_rules',
      content: THEME_BACKGROUND_RULES,
      priority: 70
    })
    return this
  }

  /**
   * 添加专业造型规则
   */
  withStylingRules(): this {
    this.blocks.push({
      name: 'styling_rules',
      content: PROFESSIONAL_STYLING_RULES,
      priority: 60
    })
    return this
  }

  /**
   * 添加 JSON 输出约束
   */
  withJsonConstraints(): this {
    this.blocks.push({
      name: 'json_constraints',
      content: HARD_JSON_OUTPUT_CONSTRAINTS,
      priority: 10
    })
    return this
  }

  // ==================== 模块化添加 ====================

  /**
   * 添加提示词模块
   */
  withModule(module: PromptModule): this {
    this.modules.push(module)
    return this
  }

  /**
   * 批量添加模块
   */
  withModules(modules: PromptModule[]): this {
    this.modules.push(...modules)
    return this
  }

  /**
   * 添加自定义提示词块
   */
  withCustomBlock(name: string, content: string, priority = 50): this {
    if (content && content.trim()) {
      this.blocks.push({ name, content, priority })
    }
    return this
  }

  /**
   * 添加自定义约束（用户输入的额外指令）
   */
  withConstraint(text: string): this {
    if (text && text.trim()) {
      this.blocks.push({
        name: 'constraint',
        content: `[User Constraint]\n${text.trim()}`,
        priority: 55
      })
    }
    return this
  }

  /**
   * 添加视觉锚点（强制保留的特征）
   */
  withVisualAnchors(text: string): this {
    if (text && text.trim()) {
      this.blocks.push({
        name: 'visual_anchors',
        content: `[Visual Anchors - STRICTLY PRESERVE]\n${text.trim()}`,
        priority: 98 // Very high priority, just below core concepts
      })
    }
    return this
  }

  /**
   * 条件性添加块
   */
  withConditional(condition: boolean, blockFn: () => { name: string; content: string; priority?: number }): this {
    if (condition) {
      const block = blockFn()
      if (block.content && block.content.trim()) {
        this.blocks.push({
          name: block.name,
          content: block.content,
          priority: block.priority ?? 50
        })
      }
    }
    return this
  }

  // ==================== 块操作 ====================

  /**
   * 移除指定名称的块
   */
  removeBlock(name: string): this {
    this.blocks = this.blocks.filter((b) => b.name !== name)
    return this
  }

  /**
   * 替换指定名称的块
   */
  replaceBlock(name: string, content: string): this {
    const block = this.blocks.find((b) => b.name === name)
    if (block) {
      block.content = content
    }
    return this
  }

  /**
   * 在指定块之后插入
   */
  insertAfter(targetName: string, name: string, content: string): this {
    const targetIndex = this.blocks.findIndex((b) => b.name === targetName)
    if (targetIndex !== -1) {
      const targetPriority = this.blocks[targetIndex].priority ?? 50
      this.blocks.splice(targetIndex + 1, 0, {
        name,
        content,
        priority: targetPriority - 1
      })
    }
    return this
  }

  /**
   * 在指定块之前插入
   */
  insertBefore(targetName: string, name: string, content: string): this {
    const targetIndex = this.blocks.findIndex((b) => b.name === targetName)
    if (targetIndex !== -1) {
      const targetPriority = this.blocks[targetIndex].priority ?? 50
      this.blocks.splice(targetIndex, 0, {
        name,
        content,
        priority: targetPriority + 1
      })
    }
    return this
  }

  /**
   * 清空所有块
   */
  clear(): this {
    this.blocks = []
    this.modules = []
    return this
  }

  /**
   * 处理提示词模板变量替换
   * 支持 {{variable}} 格式的变量替换
   *
   * @param template 提示词模板
   * @param variables 变量字典
   * @returns 替换后的提示词
   */
  static processTemplate(template: string, variables: Record<string, string | undefined>): string {
    if (!template) return ''

    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = variables[key.trim()]
      // 如果变量存在，替换之；否则保留原样（或者可以选替换为空字符串，视需求而定）
      // 这里保留原样有助于调试，或者避免意外删除未定义的插值
      return value !== undefined ? value : match
    })
  }

  // ==================== 核心构建方法 ====================

  /**
   * 同步构建（适用于已有 promptJson 或 preset 的情况）
   *
   * 决策逻辑：
   * 1. promptJson?.full_prompt → fromPromptJson()
   * 2. preset !== 'auto' → fromPreset()
   * 3. 否则 → 使用默认模块组装
   */
  build(): BuildResult {
    // 1. 优先使用上游 promptJson
    if (this.promptJson?.full_prompt) {
      return {
        prompt: this.fromPromptJson(),
        source: 'promptJson'
      }
    }

    // 2. 使用用户选择的预设
    if (this.preset && this.preset !== 'auto') {
      return {
        prompt: this.fromPreset(),
        source: 'preset'
      }
    }

    // 3. 使用默认模块组装
    return {
      prompt: this.assemble(),
      source: 'preset'
    }
  }

  /**
   * 异步构建（包含自动分析能力 - 视觉创意总监模式）
   *
   * @param images 服装图片 Base64 数组
   * @param analyzeFunc 分析函数（通常是 AI 视觉分析）
   *
   * 决策逻辑：
   * 1. promptJson?.full_prompt → 直接使用
   * 2. preset !== 'auto' → 使用预设
   * 3. 否则 → 调用 AI 分析，然后根据结果生成
   */
  async buildWithAnalysis(
    images: string[],
    analyzeFunc: (images: string[], prompt: string) => Promise<string>
  ): Promise<BuildResult> {
    // 1. 优先使用上游 promptJson
    if (this.promptJson?.full_prompt) {
      return {
        prompt: this.fromPromptJson(),
        source: 'promptJson'
      }
    }

    // 2. 使用用户选择的预设
    if (this.preset && this.preset !== 'auto') {
      return {
        prompt: this.fromPreset(),
        source: 'preset'
      }
    }

    // 3. 自动分析模式（视觉创意总监）
    try {
      const analysisPrompt = this.getAnalysisPrompt()
      const analysisResult = await analyzeFunc(images, analysisPrompt)
      const analysis = this.parseAnalysisResult(analysisResult)

      if (analysis) {
        return {
          prompt: this.fromAnalysis(analysis),
          source: 'auto',
          analysisResult: analysis
        }
      }
    } catch (error) {
      logger.warn('Auto analysis failed, falling back to default:', error as Error)
    }

    // 分析失败时回退到默认组装
    return {
      prompt: this.assemble(),
      source: 'preset'
    }
  }

  // ==================== 内部组装方法 ====================

  /**
   * 组装所有块和模块为最终提示词
   */
  protected assemble(): string {
    // 合并 blocks 和 modules
    const allBlocks: PromptBlock[] = [
      ...this.blocks,
      ...this.modules.map((m) => ({
        name: m.type,
        content: m.text,
        priority: m.priority
      }))
    ]

    // 按优先级降序排序
    const sortedBlocks = allBlocks.sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50))

    // 组装最终提示词
    const parts = sortedBlocks.filter((b) => b.content && b.content.trim()).map((b) => b.content.trim())

    // 添加输出指令
    parts.push('[Output] Generate image directly.')

    return parts.join('\n\n')
  }

  /**
   * 获取当前块列表（用于调试）
   */
  getBlocks(): PromptBlock[] {
    return [...this.blocks]
  }

  /**
   * 获取当前模块列表（用于调试）
   */
  getModules(): PromptModule[] {
    return [...this.modules]
  }

  // ==================== 抽象方法（子类必须实现） ====================

  /**
   * 从上游 promptJson 构建提示词
   * 子类实现如何使用 full_prompt 并补充技术参数
   */
  protected abstract fromPromptJson(): string

  /**
   * 从预设构建提示词
   * 子类实现如何应用预设的风格、背景、道具等
   */
  protected abstract fromPreset(): string

  /**
   * 从分析结果构建提示词
   * 子类实现如何将 AI 分析结果转换为创意方案
   */
  protected abstract fromAnalysis(analysis: GarmentAnalysis): string

  /**
   * 获取分析提示词
   * 子类提供特定类型的分析 prompt（电商图、模特图等）
   */
  protected abstract getAnalysisPrompt(): string

  /**
   * 解析分析结果
   * 子类可以覆盖此方法提供特定的解析逻辑
   */
  protected parseAnalysisResult(result: string): GarmentAnalysis | null {
    // 使用改进的 JSON 提取器，支持 fenced code block 和平衡括号匹配
    const parsed = extractAndParseJson<Record<string, unknown>>(result)
    if (!parsed) {
      logger.warn('Failed to extract JSON from analysis result', {
        resultPreview: result.substring(0, 200)
      })
      return null
    }

    return {
      garment_type: (parsed.garment_type as string) || 'unknown',
      prints_patterns: parsed.prints_patterns as string | undefined,
      ip_character: parsed.ip_character as string | undefined,
      theme: parsed.theme as string | undefined,
      colors: Array.isArray(parsed.colors) ? (parsed.colors as string[]) : [],
      fabric_texture: parsed.fabric_texture as string | undefined,
      structural_details: parsed.structural_details as string | undefined,
      recommended_background: parsed.recommended_background as string | undefined,
      recommended_props: Array.isArray(parsed.recommended_props)
        ? (parsed.recommended_props as string[])
        : undefined,
      recommended_lighting: parsed.recommended_lighting as string | undefined,
      full_prompt: parsed.full_prompt as string | undefined
    }
  }

  // ==================== 遗留方法（保持兼容） ====================

  /**
   * 构建最终提示词（遗留方法，保持向后兼容）
   * @deprecated 使用 build() 或 buildWithAnalysis() 代替
   */
  buildLegacy(): string {
    return this.assemble()
  }

  /**
   * 抽象方法：构建系统提示词（遗留，子类可选实现）
   */
  abstract buildSystemPrompt(): string

  /**
   * 抽象方法：构建用户提示词（遗留，子类可选实现）
   */
  abstract buildUserPrompt(): string
}

// 导出类型
export type { BuildResult, GarmentAnalysis, PromptModule }
