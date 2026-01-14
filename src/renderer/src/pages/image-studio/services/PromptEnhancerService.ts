/**
 * Image Studio Prompt 增强器服务
 *
 * 使用 LLM 智能增强用户输入的提示词，生成更专业、更详细的描述
 * 支持三个模块：电商(ecom)、模特(model)、图案(pattern)
 */

import { loggerService } from '@logger'
import LegacyAiProvider from '@renderer/aiCore/legacy/index'
import type { CompletionsParams } from '@renderer/aiCore/legacy/middleware/schemas'
import { hasApiKey } from '@renderer/services/ApiService'
import { getProviderByModel } from '@renderer/services/AssistantService'
import store from '@renderer/store'
import type { Assistant, Model } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'
import { uuid } from '@renderer/utils'

import type { StudioModule } from '../types'

const logger = loggerService.withContext('PromptEnhancerService')

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 增强模式
 */
export type EnhanceMode = 'garment' | 'style' | 'design' | 'scene'

/**
 * 增强选项
 */
export interface EnhanceOptions {
  /** 增强模式 */
  mode: EnhanceMode
  /** 所属模块 */
  module: StudioModule
  /** 当前模块配置（用于上下文） */
  moduleConfig?: Record<string, any>
  /** 参考图片（Base64），用于分析图片内容 */
  referenceImages?: string[]
}

/**
 * 增强结果
 */
export interface EnhanceResult {
  /** 原始提示词 */
  original: string
  /** 增强后的提示词 */
  enhanced: string
  /** 新增的内容点 */
  additions: string[]
  /** 置信度 (0-1) */
  confidence: number
}

// ============================================================================
// 系统提示词定义
// ============================================================================

/**
 * 电商服装描述增强
 */
const ECOM_GARMENT_SYSTEM_PROMPT = `You are an expert e-commerce product photographer and copywriter specializing in garment descriptions for fashion photography.

Your task is to enhance garment descriptions to produce better AI-generated product images.

## Guidelines:

1. **Material & Texture**: Add specific fabric details (e.g., "soft cotton blend", "crisp linen", "stretchy jersey knit")
2. **Design Elements**: Describe collar style, sleeve type, hemline, buttons, zippers, embroidery details
3. **Fit & Silhouette**: Mention fit type (slim, relaxed, oversized), body-flattering details
4. **Color Accuracy**: Use precise color terms (e.g., "dusty rose" instead of "pink", "navy blue" instead of "blue")
5. **Style Category**: Specify the style (casual, formal, streetwear, minimalist, vintage)
6. **Target Audience**: Consider if it's for kids, teens, adults, specific occasions
7. **Photography Direction**: Add hints for lighting, composition, mood

## Output Rules:
- Output in the SAME LANGUAGE as the input
- Output ONLY the enhanced description, no explanations
- Keep it concise but comprehensive (50-150 words)
- Focus on visual details that affect image generation

## Examples:

Input: "童装T恤"
Output: "儿童纯棉短袖T恤，柔软亲肤面料，圆领设计，宽松舒适版型，胸前印有可爱卡通图案，颜色为清新的天蓝色，适合3-6岁小朋友，活泼可爱风格，适合日常穿着和户外活动"

Input: "women's dress"
Output: "Elegant women's midi dress in soft sage green, featuring a flattering A-line silhouette, delicate V-neckline, flutter sleeves, and a subtle floral print. Made from lightweight chiffon fabric with a silky lining. Perfect for spring occasions, garden parties, or casual office wear. Feminine and sophisticated aesthetic."`

/**
 * 模特风格描述增强
 */
const MODEL_STYLE_SYSTEM_PROMPT = `You are an expert fashion photographer and art director specializing in model photography for e-commerce and fashion brands.

Your task is to enhance style descriptions for AI model generation, ensuring the generated models look natural, appealing, and appropriate for the clothing.

## Guidelines:

1. **Model Appearance**: Describe hair style/color, makeup level, skin tone range, facial expression
2. **Pose & Body Language**: Specify pose type (standing, walking, sitting), body angle, hand positions
3. **Expression & Mood**: Define the emotional tone (confident, playful, serene, energetic)
4. **Styling Details**: Accessories, shoes, complementary items
5. **Photography Style**: Lighting setup, background atmosphere, color grading
6. **Brand Aesthetic**: SHEIN-style casual, premium editorial, street fashion, etc.
7. **Cultural Sensitivity**: Be inclusive and respectful of diverse representations

## Output Rules:
- Output in the SAME LANGUAGE as the input
- Output ONLY the enhanced description, no explanations
- Keep it concise but comprehensive (50-150 words)
- Ensure descriptions are appropriate for all ages

## Examples:

Input: "小女孩模特"
Output: "可爱的6岁小女孩模特，自然卷曲的棕色短发，甜美灿烂的笑容，白皙健康的肤色，活泼俏皮的站姿，双手自然放在身侧，眼神充满童真与好奇，明亮的自然光照，简洁的浅色背景，整体氛围温馨活泼，展现童装的可爱与舒适"

Input: "adult female model"
Output: "Elegant young woman in her mid-20s with sleek shoulder-length dark hair, natural makeup enhancing her features, warm olive skin tone. Confident yet relaxed standing pose with gentle shoulder turn, one hand lightly touching hip. Soft, genuine smile with bright eyes conveying approachability. Professional studio lighting with subtle shadows, clean white backdrop. Modern minimalist aesthetic suitable for contemporary fashion brands."`

/**
 * 图案设计提示词增强
 */
const PATTERN_DESIGN_SYSTEM_PROMPT = `You are an expert textile designer and pattern artist specializing in seamless patterns for fashion and home décor.

Your task is to enhance pattern design prompts to generate beautiful, commercially viable seamless patterns.

## Guidelines:

1. **Pattern Type**: Specify if it's geometric, floral, abstract, animal print, paisley, etc.
2. **Scale & Density**: Describe element size (small, medium, large) and spacing (dense, scattered)
3. **Color Palette**: Define 2-4 main colors with specific names (not just "blue" but "cobalt blue")
4. **Style Reference**: Mention design era or movement (Art Deco, Scandinavian, Bohemian, Japanese)
5. **Technical Requirements**: Seamless repeat, tiling direction, symmetry type
6. **Application Context**: Where it will be used (kids' clothing, formal wear, bedding)
7. **Mood & Theme**: Playful, elegant, bold, subtle, nature-inspired, geometric modern

## Output Rules:
- Output in the SAME LANGUAGE as the input
- Output ONLY the enhanced description, no explanations
- Keep it concise but comprehensive (50-100 words)
- Ensure patterns are described as SEAMLESS and REPEATABLE

## Examples:

Input: "可爱动物图案"
Output: "童趣可爱的无缝动物图案，中等密度排列，主体为简约卡通风格的小动物（小熊、小兔、小鹿），配以小星星和爱心点缀，主色调为柔和的粉色、浅蓝和奶油白，线条圆润可爱，适合婴幼儿服装和儿童床品，斯堪的纳维亚简约风格，四方连续无缝重复"

Input: "geometric pattern"
Output: "Modern geometric seamless pattern featuring interlocking hexagons and triangles in a clean, minimalist style. Color palette: deep navy blue, warm coral, and crisp white. Medium-scale elements with balanced negative space. Contemporary Scandinavian aesthetic with subtle Art Deco influences. Perfect for adult fashion accessories and home textiles. Precise seamless repeat for continuous tiling."`

/**
 * 场景描述增强
 */
const SCENE_SYSTEM_PROMPT = `You are an expert set designer and photographer specializing in product photography backgrounds and environments.

Your task is to enhance scene/background descriptions for e-commerce product photography.

## Guidelines:

1. **Environment Type**: Indoor (studio, home, office) or Outdoor (garden, urban, beach)
2. **Lighting Conditions**: Natural light, studio softbox, golden hour, overcast
3. **Color Scheme**: Background colors that complement the product
4. **Props & Elements**: Relevant lifestyle props, plants, furniture
5. **Mood & Atmosphere**: Clean and minimal, warm and cozy, fresh and vibrant
6. **Depth & Composition**: Foreground/background blur, perspective
7. **Brand Alignment**: Luxury, casual, youthful, professional

## Output Rules:
- Output in the SAME LANGUAGE as the input
- Output ONLY the enhanced description, no explanations
- Keep it concise (30-80 words)

## Examples:

Input: "白色背景"
Output: "纯净的高调白色无缝背景，柔和的漫射光照均匀覆盖，无明显阴影，专业摄影棚风格，画面干净简洁，突出产品本身，适合电商主图展示"

Input: "outdoor scene"
Output: "Bright outdoor garden setting with soft natural daylight filtering through leafy trees. Gentle bokeh background of lush green foliage and subtle white flowers. Clean grass underfoot with dappled sunlight creating warm, inviting atmosphere. Fresh, organic mood perfect for casual lifestyle fashion photography."`

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取用于增强的模型
 */
function getEnhanceModel(): { model: Model; assistant: Assistant } | null {
  const state = store.getState()
  const defaultAssistant = state.assistants.defaultAssistant
  const llmDefaultModel = state.llm.defaultModel

  const model = defaultAssistant?.model ?? defaultAssistant?.defaultModel ?? llmDefaultModel

  if (!model) {
    logger.warn('No model found for prompt enhancement')
    return null
  }

  return { model, assistant: defaultAssistant }
}

/**
 * 根据模式获取系统提示词
 */
function getSystemPromptForMode(mode: EnhanceMode): string {
  switch (mode) {
    case 'garment':
      return ECOM_GARMENT_SYSTEM_PROMPT
    case 'style':
      return MODEL_STYLE_SYSTEM_PROMPT
    case 'design':
      return PATTERN_DESIGN_SYSTEM_PROMPT
    case 'scene':
      return SCENE_SYSTEM_PROMPT
    default:
      return ECOM_GARMENT_SYSTEM_PROMPT
  }
}

/**
 * 根据模块获取默认增强模式
 */
function getDefaultModeForModule(module: StudioModule): EnhanceMode {
  switch (module) {
    case 'ecom':
      return 'garment'
    case 'model':
      return 'style'
    case 'pattern':
      return 'design'
    default:
      return 'garment'
  }
}

/**
 * 构建上下文信息
 */
function buildContextInfo(options: EnhanceOptions): string {
  const { module, moduleConfig } = options
  const contextParts: string[] = []

  if (module) {
    contextParts.push(`Module: ${module}`)
  }

  if (moduleConfig) {
    // 提取关键配置信息
    if (moduleConfig.layout) contextParts.push(`Layout: ${moduleConfig.layout}`)
    if (moduleConfig.stylePreset) contextParts.push(`Style: ${moduleConfig.stylePreset}`)
    if (moduleConfig.ageGroup) contextParts.push(`Age Group: ${moduleConfig.ageGroup}`)
    if (moduleConfig.gender) contextParts.push(`Gender: ${moduleConfig.gender}`)
    if (moduleConfig.patternType) contextParts.push(`Pattern Type: ${moduleConfig.patternType}`)
    if (moduleConfig.colorTone) contextParts.push(`Color Tone: ${moduleConfig.colorTone}`)
  }

  return contextParts.length > 0 ? `\n\nContext:\n${contextParts.join('\n')}` : ''
}

/**
 * 简单的差异分析
 */
function analyzeAdditions(original: string, enhanced: string): string[] {
  const additions: string[] = []
  const originalLower = original.toLowerCase()

  // 简单的关键词检测
  const keywords = [
    '材质',
    '面料',
    'fabric',
    'material',
    '颜色',
    'color',
    '风格',
    'style',
    '氛围',
    'mood',
    '光照',
    'lighting',
    '背景',
    'background',
    '姿势',
    'pose',
    '表情',
    'expression'
  ]

  for (const keyword of keywords) {
    if (enhanced.toLowerCase().includes(keyword) && !originalLower.includes(keyword)) {
      additions.push(keyword)
    }
  }

  return additions.slice(0, 5) // 最多返回5个新增点
}

// ============================================================================
// 主服务类
// ============================================================================

/**
 * Image Studio Prompt 增强器服务
 */
class PromptEnhancerServiceImpl {
  /**
   * 增强提示词
   * @param prompt 原始提示词
   * @param options 增强选项
   * @returns 增强结果
   */
  async enhance(prompt: string, options: EnhanceOptions): Promise<EnhanceResult> {
    if (!prompt || !prompt.trim()) {
      throw new Error('提示词不能为空')
    }

    const mode = options.mode || getDefaultModeForModule(options.module)

    // 获取模型
    const result = getEnhanceModel()
    if (!result) {
      throw new Error('未配置默认助手模型，请先在设置中配置默认助手模型')
    }

    const { model, assistant: defaultAssistant } = result
    const provider = getProviderByModel(model)

    if (!provider) {
      throw new Error('未找到模型对应的服务商')
    }

    if (!hasApiKey(provider)) {
      throw new Error('服务商未配置 API Key')
    }

    logger.info('Enhancing prompt', {
      modelId: model.id,
      mode,
      module: options.module,
      promptLength: prompt.length
    })

    // 创建 AI Provider
    const aiProvider = new LegacyAiProvider(provider)

    // 获取系统提示词
    const systemPrompt = getSystemPromptForMode(mode)

    // 构建上下文
    const contextInfo = buildContextInfo(options)

    // 创建增强专用 assistant
    const assistant: Assistant = {
      ...defaultAssistant,
      id: `enhance-${uuid()}`,
      name: 'Image Studio Prompt Enhancer',
      prompt: systemPrompt,
      model: model,
      topics: [],
      settings: {
        temperature: 0.7,
        contextCount: 1,
        streamOutput: false,
        enableMaxTokens: false,
        maxTokens: 0,
        topP: 1,
        enableTopP: false,
        enableTemperature: true,
        reasoning_effort: undefined,
        qwenThinkMode: undefined,
        toolUseMode: undefined
      }
    }

    let resultText = ''
    const userMessage = `Please enhance the following description:${contextInfo}\n\nOriginal: ${prompt}`

    const completionsParams: CompletionsParams = {
      assistant,
      messages: userMessage,
      streamOutput: false,
      callType: 'generate',
      onChunk: (chunk) => {
        if (chunk.type === ChunkType.TEXT_DELTA) {
          resultText += chunk.text || ''
        }
      }
    }

    try {
      await aiProvider.completions(completionsParams)

      const enhancedPrompt = resultText.trim()

      if (!enhancedPrompt) {
        throw new Error('未获取到增强结果')
      }

      logger.info('Prompt enhanced successfully', {
        mode,
        originalLength: prompt.length,
        enhancedLength: enhancedPrompt.length
      })

      return {
        original: prompt,
        enhanced: enhancedPrompt,
        additions: analyzeAdditions(prompt, enhancedPrompt),
        confidence: 0.85
      }
    } catch (error) {
      logger.error('Failed to enhance prompt:', error as Error)
      throw error
    }
  }

  /**
   * 快速增强（使用默认模式）
   */
  async quickEnhance(prompt: string, module: StudioModule): Promise<string> {
    const result = await this.enhance(prompt, {
      mode: getDefaultModeForModule(module),
      module
    })
    return result.enhanced
  }

  /**
   * 检查是否可以使用增强功能
   */
  canEnhance(): boolean {
    const result = getEnhanceModel()
    if (!result) return false

    const provider = getProviderByModel(result.model)
    if (!provider || !hasApiKey(provider)) return false

    return true
  }

  /**
   * 获取增强模型名称
   */
  getModelName(): string | null {
    const result = getEnhanceModel()
    if (!result) return null
    return result.model.name || result.model.id || null
  }

  /**
   * 获取模块支持的增强模式
   */
  getSupportedModes(module: StudioModule): EnhanceMode[] {
    switch (module) {
      case 'ecom':
        return ['garment', 'scene']
      case 'model':
        return ['style', 'scene']
      case 'pattern':
        return ['design']
      default:
        return ['garment']
    }
  }
}

// 导出单例
export const promptEnhancerService = new PromptEnhancerServiceImpl()

export default promptEnhancerService
