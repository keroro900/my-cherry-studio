/**
 * 统一提示词服务
 * Unified Prompt Service
 *
 * 作为执行器和提示词构建器之间的桥梁
 * 提供简单的 API 供执行器调用，内部委托给具体的 PromptBuilder
 *
 * 设计原则：
 * - 执行器只需调用 PromptService，不需要知道具体的构建器实现
 * - 支持 promptJson、preset、auto 三种模式
 * - 与现有的 prompts/builders/ 架构完全集成
 *
 * @module prompts/PromptService
 */

import type {
  CosmeticsModuleConfig,
  EcomModuleConfig,
  EditModuleConfig,
  ElectronicsModuleConfig,
  FoodModuleConfig,
  FootwearModuleConfig,
  FurnitureModuleConfig,
  GenerateModuleConfig,
  ImageAssistantConfig,
  ImageAssistantType,
  JewelryModuleConfig,
  ModelModuleConfig,
  PatternModuleConfig,
  ProductModuleConfig
} from '@renderer/types'

import { EcomPromptBuilder, type EcomPromptJson } from './builders/EcomPromptBuilder'
import { ModelPromptBuilder, type ModelPromptJson } from './builders/ModelPromptBuilder'
import { PATTERN_STYLE_PRESETS, PatternPromptBuilder, type PatternPromptJson } from './builders/PatternPromptBuilder'
import type { BasePromptJson, PromptBuilderOptions } from './builders/PromptBuilder'

// ==================== 类型定义 ====================

/**
 * 提示词构建上下文
 * 执行器传递给 PromptService 的参数
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
  /** 提示词来源 */
  source: 'promptJson' | 'preset' | 'auto' | 'custom' | 'fallback'
  /** 分析结果（如果使用了 auto 模式） */
  analysisResult?: any
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
 * 支持的节点类型
 */
export type SupportedNodeType = 'gemini_pattern' | 'gemini_ecom' | 'gemini_generate_model' | 'gemini_model_from_clothes'

// ==================== 节点类型映射 ====================

/**
 * 节点类型到构建器的映射配置
 */
const NODE_TYPE_CONFIG: Record<
  SupportedNodeType,
  {
    builderClass: typeof PatternPromptBuilder | typeof EcomPromptBuilder | typeof ModelPromptBuilder
    defaultSystemPrompt: string
    description: string
  }
> = {
  gemini_pattern: {
    builderClass: PatternPromptBuilder,
    defaultSystemPrompt: `You are an expert textile designer specializing in commercial all-over prints for fabric.
Your task is to create seamless, print-ready patterns that work well on children's clothing.
Focus on organic layouts, appropriate scaling, and commercial viability.`,
    description: '图案生成专家：专门设计和生成各类图案、纹理、装饰元素。支持无缝图案、T恤图案和元素派生。'
  },
  gemini_ecom: {
    builderClass: EcomPromptBuilder,
    defaultSystemPrompt: `You are an expert e-commerce product photographer specializing in children's clothing.
Your task is to create professional product images that showcase garments effectively.
Focus on clean backgrounds, proper lighting, and commercial appeal.`,
    description: '电商图片专家：生成专业的电商产品图，支持平铺、挂拍、模特展示等多种模式。'
  },
  gemini_generate_model: {
    builderClass: ModelPromptBuilder,
    defaultSystemPrompt: `You are an expert fashion photographer specializing in children's clothing models.
Your task is to create lifestyle images with child models wearing the provided garments.
Focus on natural poses, appropriate settings, and commercial viability.`,
    description: '模特图专家：生成专业的童装模特图，支持多种年龄、人种、姿势预设。'
  },
  gemini_model_from_clothes: {
    builderClass: ModelPromptBuilder,
    defaultSystemPrompt: `You are an expert fashion photographer specializing in children's clothing models.
Your task is to create lifestyle images with child models wearing the provided garments.
Focus on natural poses, appropriate settings, and commercial viability.`,
    description: '服装模特图专家：根据服装图片生成穿着效果的模特图。'
  }
}

// ==================== 助手 imageType 映射 ====================

/**
 * 助手 imageType 到工作流 nodeType 的映射
 */
const IMAGE_TYPE_TO_NODE_TYPE: Partial<Record<ImageAssistantType, SupportedNodeType>> = {
  ecom: 'gemini_ecom',
  model: 'gemini_generate_model',
  pattern: 'gemini_pattern'
}

/**
 * 助手提示词构建上下文
 */
export interface AssistantPromptContext {
  /** 图片类型 */
  imageType: ImageAssistantType
  /** 模块配置 */
  moduleConfig: ImageAssistantConfig['moduleConfig']
  /** 用户输入的提示词 */
  userPrompt: string
  /** 系统提示词（可选） */
  systemPrompt?: string
}

/**
 * 通用模块配置字段映射表
 * 用于将配置字段转换为自然语言描述
 */
const CONFIG_FIELD_LABELS: Record<string, Record<string, string>> = {
  // 通用字段
  layout: {
    flat_lay: 'flat lay photography',
    model_shot: 'model wearing the product',
    hanging: 'hanging display',
    none: 'product only'
  },
  ageGroup: {
    small_kid: 'young child',
    big_kid: 'teenager',
    adult: 'adult'
  },
  gender: {
    female: 'female',
    male: 'male'
  },
  density: {
    sparse: 'sparse',
    medium: 'medium',
    dense: 'dense'
  },
  colorTone: {
    auto: '',
    bright: 'bright',
    soft: 'soft',
    dark: 'dark',
    high_contrast: 'high contrast'
  }
}

/**
 * 模块配置转描述的映射
 * 每个 imageType 对应一组字段提取规则
 */
const MODULE_DESCRIPTION_RULES: Record<
  string,
  Array<{ field: string; label: string; transform?: (v: unknown) => string }>
> = {
  ecom: [
    { field: 'layout', label: 'Layout' },
    { field: 'stylePreset', label: 'Style' },
    { field: 'garmentDescription', label: 'Product' }
  ],
  model: [
    { field: 'gender', label: 'Gender' },
    { field: 'ageGroup', label: 'Age' },
    { field: 'ethnicity', label: 'Ethnicity' },
    { field: 'scenePreset', label: 'Scene' },
    { field: 'poseStyle', label: 'Pose' },
    { field: 'styleDescription', label: 'Style' }
  ],
  pattern: [
    { field: 'patternType', label: 'Pattern type' },
    { field: 'density', label: 'Density' },
    { field: 'colorTone', label: 'Color tone' },
    { field: 'designPrompt', label: 'Design' },
    { field: 'colorPrompt', label: 'Colors' }
  ],
  edit: [
    { field: 'mode', label: 'Mode' },
    { field: 'gender', label: 'Gender' },
    { field: 'ageGroup', label: 'Age' },
    { field: 'scenePreset', label: 'Scene' },
    { field: 'posePreset', label: 'Pose' },
    { field: 'customPrompt', label: 'Custom editing' }
  ],
  generate: [
    { field: 'stylePreset', label: 'Style' },
    { field: 'prompt', label: 'Prompt' },
    { field: 'negativePrompt', label: 'Avoid' }
  ],
  cosmetics: [
    { field: 'cosmeticsType', label: 'Product' },
    { field: 'productTexture', label: 'Texture' },
    { field: 'displayStyle', label: 'Display' },
    { field: 'backgroundStyle', label: 'Background' },
    { field: 'lightingStyle', label: 'Lighting' }
  ],
  food: [
    { field: 'foodCategory', label: 'Category' },
    { field: 'stylePreset', label: 'Style' },
    { field: 'moodPreset', label: 'Mood' }
  ],
  electronics: [
    { field: 'productType', label: 'Product' },
    { field: 'displayStyle', label: 'Display' },
    { field: 'backgroundStyle', label: 'Background' },
    { field: 'lightingStyle', label: 'Lighting' }
  ],
  jewelry: [
    { field: 'jewelryType', label: 'Type' },
    { field: 'material', label: 'Material' },
    { field: 'displayStyle', label: 'Display' },
    { field: 'lightingStyle', label: 'Lighting' }
  ],
  furniture: [
    { field: 'furnitureType', label: 'Type' },
    { field: 'sceneStyle', label: 'Scene' },
    { field: 'displayStyle', label: 'Display' },
    { field: 'lightingStyle', label: 'Lighting' }
  ],
  footwear: [
    { field: 'footwearType', label: 'Type' },
    { field: 'displayStyle', label: 'Display' },
    { field: 'backgroundStyle', label: 'Background' },
    { field: 'lightingStyle', label: 'Lighting' }
  ],
  product: [
    { field: 'displayStyle', label: 'Display' },
    { field: 'backgroundStyle', label: 'Background' },
    { field: 'lightingStyle', label: 'Lighting' },
    { field: 'extraDescription', label: 'Details' }
  ]
}

/**
 * 将模块配置转换为自然语言描述
 * 替代原 ImageGenerationMiddleware 中 265 行的 switch-case
 */
function buildModuleDescription(
  imageType: string,
  config:
    | EcomModuleConfig
    | ModelModuleConfig
    | PatternModuleConfig
    | EditModuleConfig
    | GenerateModuleConfig
    | CosmeticsModuleConfig
    | FoodModuleConfig
    | ElectronicsModuleConfig
    | JewelryModuleConfig
    | FurnitureModuleConfig
    | FootwearModuleConfig
    | ProductModuleConfig
    | undefined
): string {
  if (!config) return ''

  const rules = MODULE_DESCRIPTION_RULES[imageType]
  if (!rules) return ''

  const parts: string[] = []
  const configObj = config as Record<string, unknown>

  for (const rule of rules) {
    const value = configObj[rule.field]
    if (value === undefined || value === null || value === '' || value === 'auto' || value === 'none') {
      continue
    }

    let displayValue: string
    if (rule.transform) {
      displayValue = rule.transform(value)
    } else if (typeof value === 'string') {
      // 尝试从映射表获取友好名称
      displayValue = CONFIG_FIELD_LABELS[rule.field]?.[value] || value
    } else if (Array.isArray(value)) {
      displayValue = value.join(', ')
    } else {
      displayValue = String(value)
    }

    if (displayValue) {
      parts.push(`${rule.label}: ${displayValue}`)
    }
  }

  return parts.join('. ')
}

// ==================== PromptService 类 ====================

/**
 * 提示词服务类
 *
 * 单例模式，提供统一的提示词构建入口
 *
 * 使用示例：
 * ```typescript
 * // 在执行器中
 * const result = PromptService.build({
 *   nodeType: 'gemini_pattern',
 *   config: nodeConfig,
 *   inputs: nodeInputs,
 *   customPrompts: config.customPrompts
 * })
 *
 * // 使用结果
 * const prompt = result.fullPrompt
 * ```
 */
class PromptServiceImpl {
  /**
   * 构建提示词（同步版本）
   *
   * 适用于已有 promptJson 或 preset 的情况
   */
  build(context: PromptBuildContext): PromptResult {
    const { nodeType, config, inputs, customPrompts } = context

    // 检查是否有自定义覆盖
    if (customPrompts?.system || customPrompts?.user) {
      return this.buildWithCustomPrompts(context)
    }

    // 获取节点配置
    const nodeConfig = NODE_TYPE_CONFIG[nodeType as SupportedNodeType]
    if (!nodeConfig) {
      return this.buildFallback(context)
    }

    // 创建构建器
    const builder = this.createBuilder(nodeType as SupportedNodeType, config, inputs)
    if (!builder) {
      return this.buildFallback(context)
    }

    // 使用构建器构建
    const buildResult = builder.build()

    return {
      systemPrompt: builder.buildSystemPrompt(),
      userPrompt: buildResult.prompt,
      fullPrompt: buildResult.prompt,
      source: buildResult.source,
      analysisResult: buildResult.analysisResult
    }
  }

  /**
   * 为图片助手构建增强提示词
   *
   * 统一入口：供 ImageGenerationMiddleware 调用
   * 替代原有的 buildEnhancedPrompt + getModuleConfigDescription 逻辑
   *
   * @param context 助手提示词上下文
   * @returns 构建结果
   */
  buildForAssistant(context: AssistantPromptContext): PromptResult {
    const { imageType, moduleConfig, userPrompt, systemPrompt } = context

    // 1. 尝试映射到工作流 nodeType 并使用专业构建器
    const nodeType = IMAGE_TYPE_TO_NODE_TYPE[imageType]
    if (nodeType && this.isSupported(nodeType)) {
      // 使用专业构建器
      const result = this.build({
        nodeType,
        config: moduleConfig || {},
        inputs: { prompt: userPrompt },
        customPrompts: systemPrompt ? { system: systemPrompt } : undefined
      })

      // 如果构建器成功返回，使用其结果
      if (result.source !== 'fallback') {
        return result
      }
    }

    // 2. 回退到通用描述模式
    const parts: string[] = []

    // 添加系统提示词
    if (systemPrompt) {
      parts.push(`[System Context]\n${systemPrompt}`)
    }

    // 添加模块配置描述
    if (moduleConfig && imageType) {
      const configDesc = buildModuleDescription(imageType, moduleConfig)
      if (configDesc) {
        parts.push(`[Generation Settings]\n${configDesc}`)
      }
    }

    // 添加用户请求
    if (userPrompt) {
      parts.push(`[User Request]\n${userPrompt}`)
    }

    const fullPrompt = parts.join('\n\n') || userPrompt

    return {
      systemPrompt: systemPrompt || '',
      userPrompt,
      fullPrompt,
      source: 'fallback'
    }
  }

  /**
   * 构建提示词（异步版本，支持自动分析）
   *
   * 适用于需要 AI 视觉分析的场景
   */
  async buildWithAnalysis(
    context: PromptBuildContext,
    images: string[],
    analyzeFunc: (images: string[], prompt: string) => Promise<string>
  ): Promise<PromptResult> {
    const { nodeType, config, inputs, customPrompts } = context

    // 检查是否有自定义覆盖
    if (customPrompts?.system || customPrompts?.user) {
      return this.buildWithCustomPrompts(context)
    }

    // 获取节点配置
    const nodeConfig = NODE_TYPE_CONFIG[nodeType as SupportedNodeType]
    if (!nodeConfig) {
      return this.buildFallback(context)
    }

    // 创建构建器
    const builder = this.createBuilder(nodeType as SupportedNodeType, config, inputs)
    if (!builder) {
      return this.buildFallback(context)
    }

    // 使用异步构建
    const buildResult = await builder.buildWithAnalysis(images, analyzeFunc)

    return {
      systemPrompt: builder.buildSystemPrompt(),
      userPrompt: buildResult.prompt,
      fullPrompt: buildResult.prompt,
      source: buildResult.source,
      analysisResult: buildResult.analysisResult
    }
  }

  /**
   * 获取默认提示词模板
   *
   * 用于 UI 编辑器显示默认值和重置功能
   */
  getDefaultPrompts(nodeType: string): PromptTemplates {
    const nodeConfig = NODE_TYPE_CONFIG[nodeType as SupportedNodeType]
    if (!nodeConfig) {
      return {
        system: '',
        user: '',
        description: '此节点类型没有注册提示词构建器'
      }
    }

    // 创建一个默认配置的构建器来获取默认提示词
    const builder = new nodeConfig.builderClass({
      config: {}
    })

    return {
      system: nodeConfig.defaultSystemPrompt,
      user: builder.buildUserPrompt(),
      description: nodeConfig.description
    }
  }

  /**
   * 获取节点类型的风格预设列表
   */
  getStylePresets(nodeType: string): Array<{ value: string; label: string; labelZh?: string }> {
    switch (nodeType) {
      case 'gemini_pattern':
        return Object.values(PATTERN_STYLE_PRESETS).map((preset) => ({
          value: preset.id,
          label: preset.name,
          labelZh: preset.nameZh
        }))
      // TODO: 添加其他节点类型的预设
      default:
        return []
    }
  }

  /**
   * 检查节点类型是否支持提示词服务
   */
  isSupported(nodeType: string): boolean {
    return nodeType in NODE_TYPE_CONFIG
  }

  /**
   * 获取所有支持的节点类型
   */
  getSupportedNodeTypes(): string[] {
    return Object.keys(NODE_TYPE_CONFIG)
  }

  // ==================== 私有方法 ====================

  /**
   * 创建构建器实例
   */
  private createBuilder(
    nodeType: SupportedNodeType,
    config: Record<string, any>,
    inputs: Record<string, any>
  ): PatternPromptBuilder | EcomPromptBuilder | ModelPromptBuilder | null {
    const nodeConfig = NODE_TYPE_CONFIG[nodeType]
    if (!nodeConfig) return null

    // 提取 promptJson
    const promptJson = inputs.promptJson as BasePromptJson | undefined

    // 构建器选项
    const options: PromptBuilderOptions<any> = {
      promptJson,
      preset: config.stylePreset || config.preset,
      config: this.mapConfigToBuilderConfig(nodeType, config)
    }

    // 根据节点类型创建对应的构建器
    switch (nodeType) {
      case 'gemini_pattern':
        return new PatternPromptBuilder(options as PromptBuilderOptions<PatternPromptJson>)
      case 'gemini_ecom':
        return new EcomPromptBuilder(options as PromptBuilderOptions<EcomPromptJson>)
      case 'gemini_generate_model':
      case 'gemini_model_from_clothes':
        return new ModelPromptBuilder(options as PromptBuilderOptions<ModelPromptJson>)
      default:
        return null
    }
  }

  /**
   * 将节点配置映射为构建器配置
   */
  private mapConfigToBuilderConfig(nodeType: SupportedNodeType, config: Record<string, any>): Record<string, any> {
    // 通用映射
    const baseConfig = {
      imageSize: config.imageSize || '2K',
      aspectRatio: config.aspectRatio || '1:1'
    }

    switch (nodeType) {
      case 'gemini_pattern':
        return {
          ...baseConfig,
          patternType: config.outputType === 'set' ? 'graphic' : 'seamless',
          stylePreset: config.stylePresetPrompt,
          customElements: config.customPrompt,
          colorTone: config.colorTone,
          density: config.density,
          enableSmartScaling: config.enableSmartScaling,
          styleConstraint: config.styleConstraint
        }
      case 'gemini_ecom':
        return {
          ...baseConfig,
          detailType: config.detailType || 'flat_lay',
          fillType: config.fillType,
          layoutType: config.layoutType,
          platform: config.platform
        }
      case 'gemini_generate_model':
      case 'gemini_model_from_clothes':
        return {
          ...baseConfig,
          gender: config.gender || 'girl',
          age: config.age || 'child_4_6',
          ethnicity: config.ethnicity || 'asian',
          pose: config.pose || 'standing_front',
          scene: config.scene || 'studio_white'
        }
      default:
        return baseConfig
    }
  }

  /**
   * 使用自定义提示词构建
   */
  private buildWithCustomPrompts(context: PromptBuildContext): PromptResult {
    const { config, inputs, customPrompts } = context

    // 获取默认提示词作为基础
    const defaults = this.getDefaultPrompts(context.nodeType)

    // 合并自定义覆盖
    const systemPrompt = customPrompts?.system?.trim() || defaults.system
    const userPrompt = customPrompts?.user?.trim() || defaults.user || inputs.prompt || config.customPrompt || ''

    // 组合完整提示词
    const parts: string[] = []
    if (systemPrompt) parts.push(systemPrompt)
    if (userPrompt) parts.push(userPrompt)

    return {
      systemPrompt,
      userPrompt,
      fullPrompt: parts.join('\n\n'),
      source: 'custom'
    }
  }

  /**
   * 回退构建逻辑
   *
   * 当节点类型不支持时使用
   */
  private buildFallback(context: PromptBuildContext): PromptResult {
    const { config, inputs, customPrompts } = context

    // 尝试从配置中获取提示词
    const systemPrompt = customPrompts?.system || config.systemPrompt || ''
    let userPrompt = customPrompts?.user || config.prompt || config.userPrompt || ''

    // 尝试从输入中获取提示词
    if (!userPrompt && inputs.prompt) {
      userPrompt = String(inputs.prompt)
    }

    // 尝试从 promptJson 获取
    if (!userPrompt && inputs.promptJson?.full_prompt) {
      userPrompt = inputs.promptJson.full_prompt
    }

    return {
      systemPrompt,
      userPrompt,
      negativePrompt: config.negativePrompt || '',
      fullPrompt: [systemPrompt, userPrompt].filter(Boolean).join('\n\n'),
      source: 'fallback'
    }
  }
}

/**
 * 提示词服务单例
 */
export const PromptService = new PromptServiceImpl()

export default PromptService
