/**
 * 节点提示词步骤定义 v2.0
 * Node Prompt Step Definitions v2.0
 *
 * 直接复用底层 prompts 模块的构建函数，避免重复定义
 * 用于 PromptEditorModal 组件
 *
 * 架构说明：
 * - 每个节点的 prompts.ts 是提示词的单一来源 (Single Source of Truth)
 * - nodePromptSteps.ts 只负责将这些函数组织成步骤结构供 UI 编辑
 * - 用户修改后保存到 config.customPrompts，执行器检查并优先使用
 */

// 导入各节点的提示词构建函数
import {
  buildEcomSystemPrompt,
  buildEcomUserPrompt,
  buildModelSystemPrompt,
  buildModelUserPrompt,
  buildPatternSystemPrompt,
  buildPatternUserPrompt
} from '../../nodes/ai/UnifiedPromptNode/prompts'
import { buildVideoSystemPrompt, buildVideoUserPrompt } from '../../nodes/ai/VideoPromptNode/prompts'
// GeminiEcomNode 提示词现在统一使用 EcomPromptBuilder（与执行器一致）
// 废弃的导入已移除：buildMainPrompt, buildBackPrompt, buildDetailPrompt, buildMobilePrompt
import { buildPresetPrompt, getNegativePrompt } from '../../nodes/image/GeminiEditNode/prompts'
// 导入 GeminiPatternNode 提示词构建函数
import {
  buildPatternPrompt as buildGeminiPatternPromptBase,
  buildSetMockupPrompt as buildGeminiPatternSetMockupPromptBase,
  buildSingleMockupPrompt as buildGeminiPatternSingleMockupPromptBase
} from '../../nodes/image/GeminiPatternNode/prompts'

// ==================== 类型定义 ====================

/**
 * 提示词步骤类型
 */
export interface PromptStep {
  /** 步骤唯一标识 */
  id: string
  /** 步骤显示名称 */
  label: string
  /** 当前提示词内容 */
  prompt: string
  /** 默认提示词（用于恢复） */
  defaultPrompt: string
  /** 提示词描述说明 */
  description?: string
  /** 是否可编辑（某些提示词可能是动态生成的） */
  editable?: boolean
}

/**
 * 节点提示词配置
 */
export interface NodePromptConfig {
  /** 节点类型 */
  nodeType: string
  /** 节点配置（用于生成默认提示词） */
  config: Record<string, any>
  /** 用户自定义提示词覆盖 */
  customPrompts?: Record<string, string>
}

export interface PromptVariable {
  key: string
  label: string
  description?: string
}

/**
 * 获取节点支持的提示词变量
 *
 * 注意：只有执行器中实现了 PromptBuilder.processTemplate() 变量替换的节点才应该返回变量列表
 * 其他节点的提示词是由 Builder 动态生成的，配置值已经嵌入，不需要变量替换
 */
export function getPromptVariables(nodeType: string): PromptVariable[] {
  switch (nodeType) {
    // unified_prompt 支持变量替换（executor.ts 中有 processTemplate 调用）
    case 'unified_prompt':
      return [
        { key: 'visualAnchors', label: '视觉锚点 {{visualAnchors}}', description: '插入配置中的视觉锚点' },
        { key: 'constraintPrompt', label: '额外约束 {{constraintPrompt}}', description: '插入配置中的额外约束' }
      ]
    // gemini_ecom, gemini_pattern 等节点的提示词由 Builder 动态生成
    // 配置值已经嵌入到最终提示词中，用户编辑的是最终提示词而非模板
    // 因此不提供变量插入功能，避免误导用户
    default:
      return []
  }
}

// ==================== 统一提示词节点（模特/图案/电商）====================

/**
 * 获取统一提示词节点 - 模特模式的提示词步骤
 */
export function getUnifiedModelPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  // 直接调用底层函数生成默认提示词
  const defaultSystemPrompt = buildModelSystemPrompt(config as any)
  const defaultUserPrompt = buildModelUserPrompt(config as any)

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '模特图生成的系统角色定位和核心规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的用户指令，包含 JSON 输出格式',
      editable: true
    }
  ]
}

/**
 * 获取统一提示词节点 - 图案模式的提示词步骤
 */
export function getUnifiedPatternPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const defaultSystemPrompt = buildPatternSystemPrompt(config as any)
  const defaultUserPrompt = buildPatternUserPrompt(config as any)

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '图案设计的系统角色定位和布局规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的用户指令，包含 JSON 输出格式',
      editable: true
    }
  ]
}

/**
 * 获取统一提示词节点 - 电商模式的提示词步骤
 */
export function getUnifiedEcomPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const defaultSystemPrompt = buildEcomSystemPrompt(config as any)
  const defaultUserPrompt = buildEcomUserPrompt(config as any)

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '电商图生成的系统角色定位和专业规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的用户指令，包含 JSON 输出格式',
      editable: true
    }
  ]
}

// ==================== 视频提示词节点 ====================

/**
 * 获取视频提示词节点的提示词步骤
 */
export function getVideoPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const defaultSystemPrompt = buildVideoSystemPrompt(config as any)
  const defaultUserPrompt = buildVideoUserPrompt(config as any)

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '视频提示词生成的系统规则，包含禁止转身等安全约束',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的用户指令，包含 JSON 输出格式',
      editable: true
    }
  ]
}

// ==================== Gemini 图片生成节点 ====================

// 导入 PromptBuilder 用于生成与执行器一致的提示词
// 导入电商预设用于布局/填充/光影提示词步骤
import {
  FILL_MODE_PRESETS,
  LAYOUT_PRESETS,
  LIGHTING_PRESETS,
  type LightingModeId,
  type ResolvedFillModeId,
  type ResolvedLayoutModeId
} from '../../presets'
import type { CosmeticsPhotoConfig, EcomConfig, EcomDetailType, ElectronicsPhotoConfig, EyewearTryonConfig, FoodConfig, FootwearDisplayConfig, FurnitureSceneConfig, JewelryConfig, JewelryTryonConfig, ModelConfig, PatternConfig, ProductSceneConfig } from '../../prompts/builders'
import { CosmeticsPhotoPromptBuilder, EcomPromptBuilder, ElectronicsPhotoPromptBuilder, EyewearTryonPromptBuilder, FoodPromptBuilder, FootwearDisplayPromptBuilder, FurnitureScenePromptBuilder, JewelryPromptBuilder, JewelryTryonPromptBuilder, ModelPromptBuilder, PatternPromptBuilder, ProductScenePromptBuilder } from '../../prompts/builders'

/**
 * 获取 Gemini 图片生成节点的提示词步骤
 *
 * 重要：此函数根据 nodeType 返回与执行器一致的提示词
 * - gemini_model_from_clothes / gemini_generate_model → ModelPromptBuilder
 * - gemini_ecom → EcomPromptBuilder
 * - gemini_pattern → PatternPromptBuilder
 * - gemini_generate → 通用提示词
 *
 * 用于 PromptEditorModal 组件，确保用户编辑的提示词与执行器实际使用的一致
 */
export function getGeminiGeneratePromptSteps(params: NodePromptConfig): PromptStep[] {
  const { nodeType, config, customPrompts } = params

  // 根据 nodeType 分发到对应的构建器
  switch (nodeType) {
    case 'gemini_model_from_clothes':
    case 'gemini_generate_model':
      return getModelPromptSteps(config, customPrompts)

    case 'gemini_ecom':
      return getEcomPromptStepsForGenerate(config, customPrompts)

    case 'gemini_pattern':
      return getPatternPromptStepsForGenerate(config, customPrompts)

    case 'gemini_generate':
    default:
      return getGenericGeneratePromptSteps(config, customPrompts)
  }
}

/**
 * 获取模特图生成的提示词步骤（与 GeminiGenerateExecutor 一致）
 */
function getModelPromptSteps(config: Record<string, any>, customPrompts?: Record<string, string>): PromptStep[] {
  // 使用展开运算符创建一个同时满足 ModelConfig 和 Record<string, unknown> 的对象
  const modelConfig: ModelConfig & Record<string, unknown> = {
    ageGroup: config.ageGroup || 'big_kid',
    gender: config.gender || 'female',
    scenePreset: config.scenePreset || 'home',
    posePreset: config.posePreset || 'natural',
    ethnicityPreset: config.ethnicityPreset || 'asian',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '3:4'
  }

  const builder = new ModelPromptBuilder({
    preset: 'daily',
    config: modelConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '模特图生成的系统角色定位，包含专业摄影师角色和核心规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含模特描述、服装要求、场景设置等',
      editable: true
    }
  ]
}

/**
 * 获取电商图生成的提示词步骤（与 GeminiGenerateExecutor 一致）
 */
function getEcomPromptStepsForGenerate(
  config: Record<string, any>,
  customPrompts?: Record<string, string>
): PromptStep[] {
  const layoutMap: Record<string, EcomConfig['layout']> = {
    flat_lay: 'flat_lay',
    flatlay: 'flat_lay',
    hanging: 'hanging'
  }
  const fillMap: Record<string, EcomConfig['fillMode']> = {
    filled: 'filled',
    flat: 'flat'
  }

  // 使用展开运算符创建一个同时满足 EcomConfig 和 Record<string, unknown> 的对象
  const ecomConfig: EcomConfig & Record<string, unknown> = {
    layout: layoutMap[config.layout] || 'flat_lay',
    fillMode: fillMap[config.fillMode] || 'filled',
    garmentDescription: config.garmentDescription || config.garmentDesc || '',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '3:4'
  }

  const builder = new EcomPromptBuilder({
    config: ecomConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '电商图生成的系统角色定位，包含 SHEIN/TEMU 风格专业摄影师角色',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含布局、填充模式、服装描述等',
      editable: true
    }
  ]
}

/**
 * 获取图案生成的提示词步骤（与 GeminiGenerateExecutor 一致）
 */
function getPatternPromptStepsForGenerate(
  config: Record<string, any>,
  customPrompts?: Record<string, string>
): PromptStep[] {
  // 使用展开运算符创建一个同时满足 PatternConfig 和 Record<string, unknown> 的对象
  // 注意：必须传递 generationMode 以确保 UI 和执行器使用相同的提示词
  const patternConfig: PatternConfig & Record<string, unknown> = {
    patternType: config.outputType === 'set' ? 'graphic' : 'seamless',
    stylePreset: config.stylePreset || config.stylePresetId,
    customElements: config.stylePresetPrompt || config.customPrompt,
    density: config.density || 'medium',
    colorTone: config.colorTone || 'auto',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '1:1',
    // 关键：传递 generationMode 以支持三种模式的提示词切换
    generationMode: config.generationMode || 'mode_a'
  }

  const builder = new PatternPromptBuilder({
    preset: config.stylePreset || config.stylePresetId,
    config: patternConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  // 根据 generationMode 调整描述
  const modeDescription =
    config.generationMode === 'mode_b'
      ? '（纯无缝化模式）'
      : config.generationMode === 'mode_c'
        ? '（设计大师模式）'
        : '（元素重组模式）'

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: `图案生成的系统角色定位${modeDescription}，包含纺织设计专家角色和无缝图案规则`,
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: `发送给 AI 的完整提示词${modeDescription}，包含图案风格、密度、色调等`,
      editable: true
    }
  ]
}

/**
 * 获取通用图片生成的提示词步骤
 */
function getGenericGeneratePromptSteps(
  config: Record<string, any>,
  customPrompts?: Record<string, string>
): PromptStep[] {
  const defaultSystemPrompt = `You are a professional image generation assistant. Your task is to generate high-quality images based on user descriptions.

**Core Principles:**
1. Follow the user's description precisely
2. Maintain high image quality and resolution
3. Ensure proper composition and lighting
4. Avoid generating inappropriate or harmful content

**Output Requirements:**
- Generate images that match the specified aspect ratio
- Maintain consistency with any reference images provided
- Apply appropriate artistic style based on the prompt${config.constraintPrompt ? `\n\n**Additional Constraints:**\n${config.constraintPrompt}` : ''}`

  const defaultUserPrompt = config.prompt || 'Generate a high-quality image based on the provided description.'

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '图片生成的系统角色定位和核心规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的用户指令，描述要生成的图片',
      editable: true
    }
  ]
}

// ==================== Gemini 编辑节点（模特换装）====================

/**
 * 获取 Gemini 编辑节点的提示词步骤
 */
export function getGeminiEditPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const defaultMainPrompt = buildPresetPrompt(config as any)
  const defaultNegativePrompt = getNegativePrompt()

  return [
    {
      id: 'main',
      label: '主提示词',
      prompt: customPrompts?.main || defaultMainPrompt,
      defaultPrompt: defaultMainPrompt,
      description: '模特换装的主要提示词，包含模特描述、服装要求、场景设置',
      editable: true
    },
    {
      id: 'negative',
      label: '负面提示词',
      prompt: customPrompts?.negative || defaultNegativePrompt,
      defaultPrompt: defaultNegativePrompt,
      description: '告诉 AI 不要生成的元素',
      editable: true
    }
  ]
}

// ==================== 电商图生成节点 ====================

/** 电商细节图类型定义 */
const ECOM_DETAIL_TYPES = [
  { id: 'collar', label: '领口细节', description: '领口/领子部位特写' },
  { id: 'sleeve', label: '袖口细节', description: '袖口/袖子部位特写' },
  { id: 'hem', label: '下摆细节', description: '下摆部位特写' },
  { id: 'print', label: '印花细节', description: '印花/图案部位特写' },
  { id: 'waistband', label: '腰带细节', description: '腰带/腰部特写' },
  { id: 'fabric', label: '面料细节', description: '面料纹理特写' },
  { id: 'ankle', label: '裤脚细节', description: '裤脚/脚踝部位特写' },
  { id: 'backneck', label: '后领细节', description: '后领/领标部位特写' }
] as const

/**
 * 获取电商图生成节点的提示词步骤
 *
 * 重要：此函数使用 EcomPromptBuilder 生成提示词，与执行器保持一致
 * 执行器使用 EcomPromptBuilder.buildSystemPrompt() 和 buildUserPrompt()
 * UI 层也必须使用相同的来源，确保用户编辑的提示词与实际执行的一致
 *
 * 增强：添加布局/填充/光影提示词步骤，支持用户自定义
 */
export function getEcomNodePromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  // 映射布局和填充模式，与执行器逻辑一致
  const layoutMap: Record<string, EcomConfig['layout']> = {
    flat_lay: 'flat_lay',
    flatlay: 'flat_lay',
    hanging: 'hanging'
  }
  const fillMap: Record<string, EcomConfig['fillMode']> = {
    filled: 'filled',
    flat: 'flat'
  }

  // 使用 EcomPromptBuilder 生成提示词（与执行器一致）
  const ecomConfig: EcomConfig & Record<string, unknown> = {
    layout: layoutMap[config.layout] || 'flat_lay',
    fillMode: fillMap[config.fillMode] || 'filled',
    garmentDescription: config.garmentDescription || config.garmentDesc || '',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '3:4',
    stylePreset: config.stylePreset,
    styleConstraint: config.styleConstraint,
    extraNote: config.extraNote,
    useSystemPrompt: config.useSystemPrompt
  }

  const builder = new EcomPromptBuilder({
    config: ecomConfig
  })

  // 使用 EcomPromptBuilder 生成系统和用户提示词
  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  // 背面图和细节图使用静态方法（与执行器一致）
  const defaultBackPrompt = EcomPromptBuilder.buildBackViewPrompt()

  // 获取当前布局/填充/光影模式的提示词
  const layoutMode = (config.layout || 'flat_lay') as ResolvedLayoutModeId
  const fillMode = (config.fillMode || 'filled') as ResolvedFillModeId
  const lightingMode = (config.lightingMode || 'auto') as LightingModeId

  const layoutPreset = LAYOUT_PRESETS.getPreset(layoutMode)
  const fillPreset = FILL_MODE_PRESETS.getPreset(fillMode)
  const lightingPreset = LIGHTING_PRESETS.getPreset(lightingMode)

  const defaultLayoutPrompt = layoutPreset?.userPromptBlock || ''
  const defaultFillPrompt = fillPreset?.userPromptBlock || ''
  const defaultLightingPrompt = lightingPreset?.userPromptBlock || ''

  const steps: PromptStep[] = [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '发送给 AI 的完整提示词，包含布局、填充模式、服装描述等',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的用户指令',
      editable: true
    },
    {
      id: 'back',
      label: '背面图提示词',
      prompt: customPrompts?.back || defaultBackPrompt,
      defaultPrompt: defaultBackPrompt,
      description: '服装背面图的生成规则',
      editable: true
    },
    // ========== 布局/填充/光影提示词（新增）==========
    {
      id: 'layout',
      label: '布局提示词',
      prompt: customPrompts?.layout || defaultLayoutPrompt,
      defaultPrompt: defaultLayoutPrompt,
      description: `当前布局: ${layoutPreset?.label || layoutMode}。定义服装的拍摄角度和展示方式`,
      editable: true
    },
    {
      id: 'fill',
      label: '填充提示词',
      prompt: customPrompts?.fill || defaultFillPrompt,
      defaultPrompt: defaultFillPrompt,
      description: `当前填充: ${fillPreset?.label || fillMode}。定义服装的立体效果和造型方式`,
      editable: true
    },
    {
      id: 'lighting',
      label: '光影提示词',
      prompt: customPrompts?.lighting || defaultLightingPrompt,
      defaultPrompt: defaultLightingPrompt,
      description: `当前光影: ${lightingPreset?.label || lightingMode}。定义拍摄的灯光设置和氛围`,
      editable: true
    }
  ]

  // 添加 8 种独立的细节图步骤
  for (const detailType of ECOM_DETAIL_TYPES) {
    const stepId = `detail_${detailType.id}`
    const defaultPrompt = EcomPromptBuilder.buildDetailPrompt(detailType.id as EcomDetailType)
    steps.push({
      id: stepId,
      label: detailType.label,
      prompt: customPrompts?.[stepId] || defaultPrompt,
      defaultPrompt: defaultPrompt,
      description: detailType.description,
      editable: true
    })
  }

  return steps
}

// ==================== 图案生成节点 ====================

/**
 * 获取图案生成节点的提示词步骤
 */
export function getPatternNodePromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const defaultPatternPrompt = buildGeminiPatternPrompt(config, 'seamless')
  const defaultGraphicPrompt = buildGeminiPatternPrompt(config, 'graphic')
  const defaultMockupPrompt = buildGeminiPatternMockupPrompt(config)

  return [
    {
      id: 'pattern',
      label: '图案提示词',
      prompt: customPrompts?.pattern || defaultPatternPrompt,
      defaultPrompt: defaultPatternPrompt,
      description: '无缝图案生成的完整提示词',
      editable: true
    },
    {
      id: 'graphic',
      label: 'T恤大图提示词',
      prompt: customPrompts?.graphic || defaultGraphicPrompt,
      defaultPrompt: defaultGraphicPrompt,
      description: 'T恤胸前大图的生成规则',
      editable: true
    },
    {
      id: 'mockup',
      label: 'Mockup提示词',
      prompt: customPrompts?.mockup || defaultMockupPrompt,
      defaultPrompt: defaultMockupPrompt,
      description: '图案贴图到服装上的 Mockup 生成规则',
      editable: true
    }
  ]
}

// ==================== 辅助包装函数 ====================

// 电商节点提示词现在直接使用 EcomPromptBuilder（与执行器一致）
// 废弃的函数已移除：buildGeminiEcomMainPrompt, buildGeminiEcomBackPrompt, buildGeminiEcomMobilePrompt

/**
 * 构建图案生成节点提示词
 * 使用 GeminiPatternNode/prompts.ts 的 buildPatternPrompt 函数
 */
function buildGeminiPatternPrompt(config: Record<string, any>, outputMode: 'seamless' | 'graphic'): string {
  return buildGeminiPatternPromptBase(config as any, outputMode)
}

/**
 * 构建图案节点 Mockup 提示词
 * 使用 GeminiPatternNode/prompts.ts 的 buildSetMockupPrompt/buildSingleMockupPrompt 函数
 */
function buildGeminiPatternMockupPrompt(config: Record<string, any>): string {
  const mockupType = config.mockupType || 'single'
  if (mockupType === 'set') {
    return buildGeminiPatternSetMockupPromptBase(config as any)
  }
  return buildGeminiPatternSingleMockupPromptBase(config as any)
}

// ==================== 珠宝摄影节点 ====================

/**
 * 获取珠宝摄影节点的提示词步骤
 */
export function getJewelryPhotoPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const jewelryConfig: JewelryConfig & Record<string, unknown> = {
    jewelryType: config.jewelryType || 'ring',
    metalType: config.metalType || 'gold',
    stoneType: config.stoneType || 'diamond',
    lightingSetup: config.lightingSetup || 'soft_box',
    backgroundStyle: config.backgroundStyle || 'white',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '1:1',
    extraDescription: config.extraDescription
  }

  const builder = new JewelryPromptBuilder({
    config: jewelryConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '珠宝摄影的系统角色定位，包含专业珠宝摄影师角色和光线控制规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含珠宝类型、金属材质、宝石、光线设置等',
      editable: true
    }
  ]
}

// ==================== 食品摄影节点 ====================

/**
 * 获取食品摄影节点的提示词步骤
 */
export function getFoodPhotoPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const foodConfig: FoodConfig & Record<string, unknown> = {
    foodCategory: config.foodCategory || 'main_dish',
    stylePreset: config.stylePreset || 'modern',
    moodPreset: config.moodPreset || 'warm',
    backgroundStyle: config.backgroundStyle || 'white',
    enableSteam: config.enableSteam ?? false,
    enableDroplets: config.enableDroplets ?? false,
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '1:1',
    extraDescription: config.extraDescription
  }

  const builder = new FoodPromptBuilder({
    config: foodConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '食品摄影的系统角色定位，包含专业食品摄影师角色和新鲜感控制规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含食品类别、风格、氛围、动态效果等',
      editable: true
    }
  ]
}

// ==================== 产品场景节点 ====================

/**
 * 获取产品场景节点的提示词步骤
 */
export function getProductScenePromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const sceneConfig: ProductSceneConfig & Record<string, unknown> = {
    sceneType: config.sceneType || 'studio',
    lightingStyle: config.lightingStyle || 'natural',
    moodStyle: config.moodStyle || 'professional',
    productType: config.productType,
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '1:1',
    extraDescription: config.extraDescription
  }

  const builder = new ProductScenePromptBuilder({
    config: sceneConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '产品场景合成的系统角色定位，包含专业合成师角色和光影匹配规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含场景类型、光影风格、氛围等',
      editable: true
    }
  ]
}

// ==================== 首饰试戴节点 ====================

/**
 * 获取首饰试戴节点的提示词步骤
 */
export function getJewelryTryonPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const tryonConfig: JewelryTryonConfig & Record<string, unknown> = {
    jewelryType: config.jewelryType || 'necklace',
    position: config.position || 'auto',
    blendMode: config.blendMode || 'natural',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '3:4',
    extraDescription: config.extraDescription
  }

  const builder = new JewelryTryonPromptBuilder({
    config: tryonConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '首饰试戴的系统角色定位，包含虚拟试戴专家角色和融合规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含首饰类型、佩戴位置、融合模式等',
      editable: true
    }
  ]
}

// ==================== 眼镜试戴节点 ====================

/**
 * 获取眼镜试戴节点的提示词步骤
 */
export function getEyewearTryonPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const eyewearConfig: EyewearTryonConfig & Record<string, unknown> = {
    eyewearType: config.eyewearType || 'glasses',
    frameStyle: config.frameStyle || 'round',
    lensEffect: config.lensEffect || 'clear',
    blendMode: config.blendMode || 'natural',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '3:4',
    extraDescription: config.extraDescription
  }

  const builder = new EyewearTryonPromptBuilder({
    config: eyewearConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '眼镜试戴的系统角色定位，包含虚拟试戴专家角色、镜框和镜片效果规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含眼镜类型、镜框风格、镜片效果、融合模式等',
      editable: true
    }
  ]
}

// ==================== 鞋类展示节点 ====================

/**
 * 获取鞋类展示节点的提示词步骤
 */
export function getFootwearDisplayPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const footwearConfig: FootwearDisplayConfig & Record<string, unknown> = {
    footwearType: config.footwearType || 'sneakers',
    displayAngle: config.displayAngle || 'three_quarter',
    materialStyle: config.materialStyle || 'leather',
    sceneBackground: config.sceneBackground || 'white',
    lightingEffect: config.lightingEffect || 'soft',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '4:3',
    extraDescription: config.extraDescription
  }

  const builder = new FootwearDisplayPromptBuilder({
    config: footwearConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '鞋类展示的系统角色定位，包含专业摄影师角色、材质和光影规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含鞋类类型、展示角度、材质、场景背景等',
      editable: true
    }
  ]
}

// ==================== 美妆产品节点 ====================

/**
 * 获取美妆产品节点的提示词步骤
 */
export function getCosmeticsPhotoPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const cosmeticsConfig: CosmeticsPhotoConfig & Record<string, unknown> = {
    cosmeticsType: config.cosmeticsType || 'skincare',
    productTexture: config.productTexture || 'glossy',
    displayStyle: config.displayStyle || 'clean',
    backgroundSetting: config.backgroundSetting || 'white',
    lightingEffect: config.lightingEffect || 'soft',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '1:1',
    extraDescription: config.extraDescription
  }

  const builder = new CosmeticsPhotoPromptBuilder({
    config: cosmeticsConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '美妆产品摄影的系统角色定位，包含专业美妆摄影师角色、产品质感和光泽控制规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含产品类型、质感、展示风格、背景和光效等',
      editable: true
    }
  ]
}

// ==================== 家具场景节点 ====================

/**
 * 获取家具场景节点的提示词步骤
 */
export function getFurnitureScenePromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const furnitureConfig: FurnitureSceneConfig & Record<string, unknown> = {
    furnitureType: config.furnitureType || 'sofa',
    sceneStyle: config.sceneStyle || 'modern',
    roomType: config.roomType || 'living_room',
    lightingMood: config.lightingMood || 'natural',
    spaceSize: config.spaceSize || 'medium',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '16:9',
    extraDescription: config.extraDescription
  }

  const builder = new FurnitureScenePromptBuilder({
    config: furnitureConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '家具场景合成的系统角色定位，包含室内摄影师角色、空间感和透视控制规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含家具类型、场景风格、房间类型、光线氛围等',
      editable: true
    }
  ]
}

// ==================== 电子产品节点 ====================

/**
 * 获取电子产品节点的提示词步骤
 */
export function getElectronicsPhotoPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const electronicsConfig: ElectronicsPhotoConfig & Record<string, unknown> = {
    electronicsType: config.electronicsType || 'smartphone',
    displayStyle: config.displayStyle || 'minimal',
    surfaceFinish: config.surfaceFinish || 'glossy',
    lightingStyle: config.lightingStyle || 'soft',
    screenContent: config.screenContent || 'blank',
    imageSize: config.imageSize || '2K',
    aspectRatio: config.aspectRatio || '1:1',
    extraDescription: config.extraDescription
  }

  const builder = new ElectronicsPhotoPromptBuilder({
    config: electronicsConfig
  })

  const defaultSystemPrompt = builder.buildSystemPrompt()
  const defaultUserPrompt = builder.buildUserPrompt()

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '电子产品摄影的系统角色定位，包含科技产品摄影师角色、反光处理和屏幕内容规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含产品类型、展示风格、表面质感、光效和屏幕内容等',
      editable: true
    }
  ]
}

// ==================== 产品描述生成节点 ====================

/**
 * 获取产品描述生成节点的提示词步骤
 */
export function getProductDescriptionPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  // 构建默认系统提示词
  const platform = config.platform || 'general'
  const language = config.language || 'en-US'
  const toneStyle = config.toneStyle || 'professional'

  const defaultSystemPrompt = `[Role: Professional E-commerce Copywriter & SEO Specialist]
You are an expert e-commerce copywriter with extensive experience writing product listings for major platforms.

[Target Platform: ${platform}]
[Language: ${language}]
[Tone & Style: ${toneStyle}]

[Writing Guidelines]
1. **Title Optimization**:
   - Include primary keywords naturally
   - Highlight key product benefits
   - Keep within character limit

2. **Bullet Points**:
   - Lead with benefits, follow with features
   - Use action verbs and sensory words
   - Address customer pain points

3. **Description**:
   - Tell a compelling product story
   - Include relevant specifications
   - Create emotional connection

[Output Format]
Respond ONLY in valid JSON format with title, description, bullets, and seoKeywords.`

  const defaultUserPrompt = `Generate product content for platform: ${platform}
Language: ${language}
Tone: ${toneStyle}

Provide a compelling, platform-optimized product listing that drives conversions.`

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '产品描述生成的系统角色定位，包含电商文案专家角色、平台风格和写作规范',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含平台、语言、风格等设置',
      editable: true
    }
  ]
}

// ==================== A+ 内容生成节点 ====================

/**
 * 获取 A+ 内容生成节点的提示词步骤
 */
export function getAplusContentPromptSteps(params: NodePromptConfig): PromptStep[] {
  const { config, customPrompts } = params

  const contentStyle = config.contentStyle || 'professional'
  const language = config.language || 'en-US'
  const moduleTypes = config.moduleTypes || ['standard_header', 'standard_image_text']

  const defaultSystemPrompt = `[Role: Amazon A+ Content Specialist]
You are an expert Amazon A+ Content (Enhanced Brand Content) copywriter with deep knowledge of:
- Amazon A+ page best practices and guidelines
- Conversion-optimized copywriting
- Brand storytelling techniques
- SEO optimization for Amazon

[Content Style: ${contentStyle}]
[Output Language: ${language}]
[A+ Modules: ${moduleTypes.join(', ')}]

[Amazon A+ Guidelines]
1. NO promotional language (no "best", "guaranteed", "limited time")
2. NO pricing or discount information
3. NO competitor comparisons by name
4. Focus on brand story and product benefits
5. Use lifestyle imagery descriptions
6. Keep text scannable with clear hierarchy

[Output Format]
Return a valid JSON object with modules array and pageSummary.`

  const defaultUserPrompt = `Generate Amazon A+ Content with the following modules:
${moduleTypes.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}

Style: ${contentStyle}
Language: ${language}

Generate compelling A+ content that tells a brand story and drives conversions.`

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: customPrompts?.system || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: 'A+ 内容生成的系统角色定位，包含亚马逊 A+ 专家角色、模块规范和写作规则',
      editable: true
    },
    {
      id: 'user',
      label: '用户提示词',
      prompt: customPrompts?.user || defaultUserPrompt,
      defaultPrompt: defaultUserPrompt,
      description: '发送给 AI 的完整提示词，包含模块类型、内容风格、语言等设置',
      editable: true
    }
  ]
}

// ==================== 统一入口函数 ====================

/**
 * 根据节点类型获取提示词步骤
 */
export function getPromptStepsForNode(params: NodePromptConfig): PromptStep[] {
  const { nodeType, config } = params

  switch (nodeType) {
    // 统一提示词节点 - 根据 outputMode 分发
    case 'unified_prompt':
      switch (config.outputMode) {
        case 'model':
          return getUnifiedModelPromptSteps(params)
        case 'pattern':
          return getUnifiedPatternPromptSteps(params)
        case 'ecom':
          return getUnifiedEcomPromptSteps(params)
        case 'all':
          // 全部输出模式：显示所有三种提示词（按模式分组）
          return [
            ...getUnifiedModelPromptSteps(params).map((s) => ({
              ...s,
              id: `model_${s.id}`,
              label: `[模特] ${s.label}`
            })),
            ...getUnifiedPatternPromptSteps(params).map((s) => ({
              ...s,
              id: `pattern_${s.id}`,
              label: `[图案] ${s.label}`
            })),
            ...getUnifiedEcomPromptSteps(params).map((s) => ({ ...s, id: `ecom_${s.id}`, label: `[电商] ${s.label}` }))
          ]
        default:
          return getUnifiedEcomPromptSteps(params)
      }

    // 视频提示词节点
    case 'video_prompt':
      return getVideoPromptSteps(params)

    // Gemini 图片生成节点
    case 'gemini_generate':
    case 'gemini_generate_model':
    case 'gemini_model_from_clothes':
      return getGeminiGeneratePromptSteps(params)

    // Gemini 编辑节点（模特换装）
    case 'gemini_edit':
      return getGeminiEditPromptSteps(params)

    // 电商图生成节点
    case 'gemini_ecom':
      return getEcomNodePromptSteps(params)

    // 图案生成节点
    case 'gemini_pattern':
      return getPatternNodePromptSteps(params)

    // 珠宝摄影节点
    case 'jewelry_photo':
      return getJewelryPhotoPromptSteps(params)

    // 食品摄影节点
    case 'food_photo':
      return getFoodPhotoPromptSteps(params)

    // 产品场景节点
    case 'product_scene':
      return getProductScenePromptSteps(params)

    // 首饰试戴节点
    case 'jewelry_tryon':
      return getJewelryTryonPromptSteps(params)

    // 眼镜试戴节点
    case 'eyewear_tryon':
      return getEyewearTryonPromptSteps(params)

    // 鞋类展示节点
    case 'footwear_display':
      return getFootwearDisplayPromptSteps(params)

    // 美妆产品节点
    case 'cosmetics_photo':
      return getCosmeticsPhotoPromptSteps(params)

    // 家具场景节点
    case 'furniture_scene':
      return getFurnitureScenePromptSteps(params)

    // 电子产品节点
    case 'electronics_photo':
      return getElectronicsPhotoPromptSteps(params)

    // 产品描述生成节点
    case 'product_description':
      return getProductDescriptionPromptSteps(params)

    // A+ 内容生成节点
    case 'aplus_content':
      return getAplusContentPromptSteps(params)

    default:
      return []
  }
}

/**
 * 将编辑后的步骤转换为 customPrompts 对象
 */
export function stepsToCustomPrompts(steps: PromptStep[]): Record<string, string> {
  const result: Record<string, string> = {}

  for (const step of steps) {
    // 只保存与默认值不同的提示词
    if (step.prompt !== step.defaultPrompt) {
      result[step.id] = step.prompt
    }
  }

  return result
}

/**
 * 检查是否有自定义提示词
 */
export function hasCustomPrompts(customPrompts?: Record<string, string>): boolean {
  return customPrompts !== undefined && Object.keys(customPrompts).length > 0
}

// ==================== 向后兼容导出 ====================
// 保留旧的函数名以兼容已有代码

export function getEcomPromptSteps(customPrompts?: Record<string, string>): PromptStep[] {
  return getEcomNodePromptSteps({
    nodeType: 'gemini_ecom',
    config: {},
    customPrompts
  })
}

export function getPatternPromptSteps(customPrompts?: Record<string, string>): PromptStep[] {
  return getPatternNodePromptSteps({
    nodeType: 'gemini_pattern',
    config: {},
    customPrompts
  })
}

export function getUnifiedPromptSteps(customPrompts?: Record<string, string>): PromptStep[] {
  return getUnifiedEcomPromptSteps({
    nodeType: 'unified_prompt',
    config: { displayMode: 'ecom' },
    customPrompts
  })
}
