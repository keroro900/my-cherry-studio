/**
 * 模特图提示词构建器
 * Model Photography Prompt Builder
 *
 * 专门用于生成模特换装/服装展示图片
 * 支持：年龄、性别、人种、姿态、场景等预设
 */

import { HARD_RULES, RECREATION_CONCEPT } from '../core/concepts'
import { PROFESSIONAL_STYLING_RULES, THEME_BACKGROUND_RULES } from '../core/themes'
import { MODEL_ANALYSIS_PROMPT, ModelModule, QualityModule, ThemeModule } from '../modules'
import type { GarmentAnalysis } from '../modules/types'
import { getAgePreset, getEthnicityPreset, getGenderPreset, getPosePreset, getScenePreset } from '../presets'
import { type BasePromptJson, PromptBuilder, type PromptBuilderOptions } from './PromptBuilder'

/**
 * 模特图 promptJson 类型
 */
export interface ModelPromptJson extends BasePromptJson {
  /** 服装描述 */
  garmentDescription?: string
  /** 风格约束 */
  styleConstraint?: string
  /** 年龄数字 */
  age_years?: number
  /** 人种描述 */
  ethnicity?: string
  /** 外观特征 */
  appearance?: string
  /** 服装主题描述 */
  subject?: string
  /** 前景描述 */
  foreground?: string
  /** 中景描述 */
  midground?: string
  /** 背景描述 */
  background?: string
  /** 构图方式 */
  composition?: string
  /** 视觉指导 */
  visual_guidance?: string
  /** 色彩色调 */
  color_tone?: string
  /** 光线氛围 */
  lighting_mood?: string
  /** 相机参数 */
  camera_params?: string
  /** IP品牌 */
  ip_brand?: string
  /** IP描述 */
  ip_desc?: string
  /** 最终标题 */
  caption?: string
}

/**
 * 模特图配置类型
 */
export interface ModelConfig {
  /** 模式：preset 预设 | custom 自定义 */
  mode?: 'preset' | 'custom'
  /** 年龄段 */
  ageGroup?: 'small_kid' | 'big_kid' | 'adult'
  /** 性别 */
  gender?: 'male' | 'female'
  /** 场景预设 */
  scenePreset?: 'home' | 'outdoor' | 'studio' | 'playground' | 'nature'
  /** 风格模式 */
  styleMode?: 'daily' | 'commercial'
  /** 人种预设 */
  ethnicityPreset?: 'asian' | 'caucasian' | 'african_american' | 'hispanic' | 'mixed'
  /** 姿态预设 */
  posePreset?: 'natural' | 'sitting' | 'playing' | 'walking'
  /** 自定义提示词 */
  customPrompt?: string
  /** 输出尺寸 */
  imageSize?: string
  /** 宽高比 */
  aspectRatio?: string
}

/**
 * 模特图提示词构建器
 *
 * 使用示例：
 * ```typescript
 * const builder = new ModelPromptBuilder({
 *   promptJson: inputs.promptJson,
 *   preset: config.styleMode,
 *   config: {
 *     ageGroup: 'big_kid',
 *     gender: 'female',
 *     scenePreset: 'home',
 *     ethnicityPreset: 'asian',
 *     posePreset: 'natural'
 *   }
 * })
 *
 * const { prompt, source } = builder.build()
 * ```
 */
export class ModelPromptBuilder extends PromptBuilder<ModelConfig, ModelPromptJson> {
  constructor(options: PromptBuilderOptions<ModelPromptJson> & { config?: ModelConfig }) {
    super(options)
    this.initializeModules()
  }

  /**
   * 初始化基础模块
   */
  private initializeModules(): void {
    const config = this.config

    // 添加核心规则
    this.withCore().withHardRules()

    // 添加模特模块
    this.withModule(
      ModelModule.get({
        age: config.ageGroup || 'child',
        gender: config.gender || 'female',
        ethnicity: config.ethnicityPreset || 'asian',
        pose: this.mapPosePreset(config.posePreset)
      })
    )

    // 添加质量模块
    this.withModule(QualityModule.get(config.imageSize || '2K', config.aspectRatio || '3:4'))
  }

  /**
   * 映射姿态预设到模块支持的格式
   */
  private mapPosePreset(pose?: string): string {
    const poseMap: Record<string, string> = {
      natural: 'standing_front',
      sitting: 'sitting',
      playing: 'playing',
      walking: 'walking'
    }
    return poseMap[pose || 'natural'] || 'standing_front'
  }

  /**
   * 便捷方法：设置模特属性
   */
  withModel(options: { age?: string; gender?: string; ethnicity?: string; pose?: string }): this {
    this.modules = this.modules.filter((m) => m.type !== 'model')
    this.withModule(ModelModule.get(options))
    return this
  }

  // ==================== 抽象方法实现 ====================

  /**
   * 从上游 promptJson 构建提示词
   */
  protected fromPromptJson(): string {
    const json = this.promptJson!

    // 如果有 full_prompt，直接使用
    if (json.full_prompt) {
      const techModules = this.modules.filter((m) => ['model', 'quality'].includes(m.type))
      return `${json.full_prompt}\n\n${techModules.map((m) => m.text).join('\n\n')}\n\n[Output] Generate image directly.`
    }

    // 否则从 JSON 字段构建
    return this.buildFromJsonFields(json)
  }

  /**
   * 从预设构建提示词
   */
  protected fromPreset(): string {
    const config = this.config

    // 获取预设数据
    const ageData = getAgePreset(config.ageGroup || 'big_kid')
    const genderData = getGenderPreset(config.gender || 'female')
    const sceneData = getScenePreset(config.scenePreset || 'home')
    const ethnicityData = getEthnicityPreset(config.ethnicityPreset || 'asian')
    const poseData = getPosePreset(config.posePreset || 'natural')

    // 构建专业提示词
    this.withCustomBlock('task', '[Task: Professional Model Photography / Clothing Try-On Image Generation]', 95)

    this.withCustomBlock(
      'model_detail',
      `[Model Description]
Generate a photorealistic image of a ${ageData?.en || 'child'}, ${genderData?.en || 'girl'}, ${ethnicityData?.description || 'Asian ethnicity'}.
Pose: ${poseData?.description || 'Natural standing pose'}
Expression: ${ageData?.expression || 'Natural and relaxed'}
Physical appearance: ${genderData?.features || 'Natural features'}`,
      85
    )

    this.withCustomBlock(
      'clothing',
      `[Clothing - MUST PRESERVE FROM REFERENCE]
CRITICAL: The model MUST wear the exact clothing shown in the reference garment image.
Preserve ALL details:
- Exact colors and color combinations
- All patterns, prints, and graphics
- Collar type, sleeve length, overall silhouette
- Any visible brand elements or decorations`,
      80
    )

    this.withCustomBlock(
      'scene',
      `[Scene Setting]
Location: ${sceneData?.en || 'Indoor setting'}
Background: ${sceneData?.background || 'Clean background'}
Props: ${sceneData?.props || 'Minimal props'}
Lighting: ${sceneData?.lighting || 'Soft natural light'}`,
      70
    )

    this.withCustomBlock(
      'prohibitions',
      `[Strict Prohibitions]
- NO text, watermarks, logos, or UI elements
- NO distortion or unnatural body proportions
- NO inappropriate content
- NO changing the clothing design from the reference
- NO extra people or characters not requested`,
      30
    )

    return this.assemble()
  }

  /**
   * 从分析结果构建提示词
   */
  protected fromAnalysis(analysis: GarmentAnalysis): string {
    // 根据分析结果添加主题
    if (analysis.ip_character || analysis.theme) {
      this.withModule(ThemeModule.fromAnalysis(analysis))
    }

    // 添加服装信息
    if (analysis.garment_type || analysis.prints_patterns) {
      this.withCustomBlock(
        'garment_info',
        `[Garment Info]
Type: ${analysis.garment_type || 'clothing'}
${analysis.prints_patterns ? `Prints/Patterns: ${analysis.prints_patterns}` : ''}
${analysis.colors?.length ? `Colors: ${analysis.colors.join(', ')}` : ''}
Preserve all details exactly in the output.`,
        80
      )
    }

    return this.assemble()
  }

  /**
   * 获取分析提示词
   */
  protected getAnalysisPrompt(): string {
    return MODEL_ANALYSIS_PROMPT
  }

  /**
   * 从 JSON 字段构建提示词（兼容旧格式）
   *
   * v4.1 优化：生成自然语言叙事性提示词 (Narrative Caption)
   * 适配 Gemini 3 Pro Image 等现代模型
   */
  private buildFromJsonFields(json: ModelPromptJson): string {
    // 1. 构建核心叙事段落
    const modelDesc = [
      json.age_years ? `${json.age_years}-year-old` : '',
      json.ethnicity || '',
      json.gender === 'male' ? 'boy' : json.gender === 'female' ? 'girl' : 'child'
    ]
      .filter(Boolean)
      .join(' ')

    const actionDesc = json.pose ? `posing in a ${json.pose}` : 'posing naturally'
    const expressionDesc = json.expression ? `with a ${json.expression} expression` : ''

    // 主体描述
    let narrative = `A photorealistic medium shot of a ${modelDesc} ${actionDesc} ${expressionDesc}. `

    // 服装描述 (核心)
    const clothingDesc = json.garmentDescription || json.subject || 'stylish clothing'
    narrative += `The model is wearing ${clothingDesc}. `

    // 场景描述
    const sceneDesc = json.background || json.scene_preset || 'a professional studio setting'
    narrative += `The setting is ${sceneDesc}. `

    // 光影描述
    const lightingDesc = json.lighting_mood || 'soft, professional lighting'
    narrative += `The lighting is ${lightingDesc}. `

    // 2. 注入摄影参数 (Camera Injection)
    // 模特图默认使用 85mm 人像镜头
    const cameraParams =
      json.camera_params ||
      'Shot on an 85mm lens at f/1.8 aperture for a shallow depth of field and professional portrait look.'
    narrative += `${cameraParams} `

    // 3. 补充细节 (Details)
    if (json.visual_guidance) {
      narrative += `${json.visual_guidance} `
    }

    // 4. 强制约束 (Constraints)
    const constraints = `
[Critical Requirements]
- Exact garment reproduction: ${json.ip_brand ? `Must match ${json.ip_brand} style` : 'Match reference details exactly'}
- High detailed skin texture (subsurface scattering), no plastic look
- Immaculately steamed fabric with realistic drape
${json.styleConstraint || ''}`

    return `${narrative}\n\n${constraints}`
  }

  // ==================== System/User 提示词方法 ====================

  /**
   * 构建完整的系统提示词
   *
   * 包含：
   * - 角色定位：专业童装摄影师
   * - RE-CREATION 核心概念
   * - 硬性规则
   * - 专业造型规则
   * - 主题背景规则
   *
   * 用于 Gemini 3 Pro Image 的 system_instruction 参数
   */
  buildSystemPrompt(): string {
    const config = this.config

    // 获取场景和年龄相关的描述
    const ageDesc =
      config.ageGroup === 'small_kid'
        ? 'toddlers (1-3 years)'
        : config.ageGroup === 'big_kid'
          ? 'children (4-12 years)'
          : config.ageGroup === 'adult'
            ? 'teenagers or young adults'
            : 'children'

    const genderDesc = config.gender === 'male' ? 'boys' : 'girls'

    return `[Role: Professional Children's Fashion Photographer]
You are an expert children's fashion photographer specializing in creating photorealistic model photos for e-commerce platforms like SHEIN and TEMU.
Your specialty is ${ageDesc}, particularly ${genderDesc}.

${RECREATION_CONCEPT}

${HARD_RULES}

${PROFESSIONAL_STYLING_RULES}

${THEME_BACKGROUND_RULES}

[Technical Standards - Gemini 3 Pro Optimized]
- **Photography Style**: Commercial Editorial
- **Camera Gear**: High-end full-frame camera (Sony A7R V or equivalent)
- **Lens Choice**: 85mm f/1.8 for portraits (Model Mode), 50mm f/8 for product details
- **Lighting**: "Butterfly" or "Rembrandt" lighting patterns for dramatic yet soft dimensionality
- **Skin Texture**: Ultra-realistic, preserving pores and natural imperfections (NO smoothing/filters)
- **Output**: A single, compositionally perfect image

[Output Requirement]
Generate the image directly based on the user's description.
Do not output any text, JSON, or explanations - only generate the image.`
  }

  /**
   * 构建用户提示词模板
   *
   * 包含：
   * - 模特描述（年龄、性别、人种、姿态）
   * - 服装要求
   * - 场景设置
   * - 禁止项
   *
   * 这是发送给 AI 的实际任务描述
   */
  buildUserPrompt(): string {
    const config = this.config

    // 获取预设数据
    const ageData = getAgePreset(config.ageGroup || 'big_kid')
    const genderData = getGenderPreset(config.gender || 'female')
    const sceneData = getScenePreset(config.scenePreset || 'home')
    const ethnicityData = getEthnicityPreset(config.ethnicityPreset || 'asian')
    const poseData = getPosePreset(config.posePreset || 'natural')

    // 构建自然语言叙事 Prompt
    const modelDesc = `${ageData?.en || 'child'} (${ageData?.ageRange || '4-12 years'}) ${genderData?.en || 'girl'}, ${ethnicityData?.description || 'Asian'}`
    const sceneDesc = sceneData?.en || 'Indoor home setting'

    return `Create a high-end commercial fashion photograph.

**Subject**: A ${modelDesc} posing in a ${poseData?.description || 'natural standing pose'}. The model has a ${ageData?.expression || 'natural'} expression and ${genderData?.features || 'natural features'}.

**Clothing (CRITICAL)**: The model is wearing the EXACT garment from the reference image.
- Reproduce colors, patterns, prints, and text 100% accurately.
- Maintain the original collar type, sleeve length, and silhouette.
- Fabric texture should look tangible and realistic.

**Environment**: ${sceneDesc}. 
- Background: ${sceneData?.background || 'Clean, theme-appropriate'}.
- Props: ${sceneData?.props || 'Minimal'}.
- Lighting: ${sceneData?.lighting || 'Soft natural light'}.

**Technical Specs**:
- Camera: 85mm portrait lens at f/1.8
- Focus: Sharp focus on the garment and model's eyes
- Quality: 8k resolution, highly detailed, photorealistic, cinematic lighting

**Negative Prompt**: 
Distorted body, unnatural proportions, plastic skin, blurred details, watermark, text overlay, changing garment design, extra limbs.`
  }
}
