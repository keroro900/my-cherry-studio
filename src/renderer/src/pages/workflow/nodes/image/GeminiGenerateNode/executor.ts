/**
 * Gemini 图片生成节点执行器
 *
 * @deprecated 此执行器已弃用，请使用 StrategyBasedExecutor 替代
 *
 * 迁移指南：
 * - 新代码请使用 `StrategyBasedExecutor` 代替此类
 * - 策略模式实现位于 `../strategies/` 目录
 * - 每种节点类型有独立的策略实现
 *
 * 支持多种图片生成模式：
 * - GEMINI_GENERATE: 通用图片生成 → GeneralStrategy
 * - GEMINI_GENERATE_MODEL: 从 promptJson 生成模特 → ModelStrategy
 * - GEMINI_MODEL_FROM_CLOTHES: 从衣服图片生成模特 → ModelStrategy
 * - GEMINI_ECOM: 电商图片生成 → EcomStrategy
 * - GEMINI_PATTERN: 图案生成 → PatternStrategy
 *
 * 重要：支持 system_instruction 参数（Gemini 3 Pro Image 支持）
 * 使用 PromptBuilder.buildSystemPrompt() 和 buildUserPrompt() 分离系统和用户提示词
 *
 * **Feature: executor-strategy-pattern - 此文件将在策略模式稳定后移除**
 */

import { resolveFillMode, resolveLayoutMode } from '../../../presets'
import {
  type CosmeticsPhotoConfig,
  CosmeticsPhotoPromptBuilder,
  type EcomConfig,
  type EcomDetailType,
  EcomPromptBuilder,
  type ElectronicsPhotoConfig,
  ElectronicsPhotoPromptBuilder,
  type EyewearTryonConfig,
  EyewearTryonPromptBuilder,
  type FoodConfig,
  FoodPromptBuilder,
  type FootwearDisplayConfig,
  FootwearDisplayPromptBuilder,
  type FurnitureSceneConfig,
  FurnitureScenePromptBuilder,
  type JewelryConfig,
  JewelryPromptBuilder,
  type JewelryTryonConfig,
  JewelryTryonPromptBuilder,
  type ModelConfig,
  ModelPromptBuilder,
  type PatternConfig,
  PatternPromptBuilder,
  type ProductSceneConfig,
  ProductScenePromptBuilder,
  PromptBuilder
} from '../../../prompts/builders'
import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { ImageGenerateNodeConfig, NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import { WorkflowNodeType } from '../../definitions'

/**
 * 提示词结果类型
 * 支持系统提示词和用户提示词分离
 */
interface PromptResult {
  systemPrompt?: string
  userPrompt: string
}

/**
 * @deprecated 请使用 StrategyBasedExecutor 替代
 * @see StrategyBasedExecutor
 */
export class GeminiGenerateExecutor extends BaseNodeExecutor {
  constructor() {
    super('gemini_generate')
  }

  /**
   * 根据节点类型和配置构建系统和用户提示词
   * 使用 PromptBuilder.buildSystemPrompt() 和 buildUserPrompt() 分离
   */
  private buildPrompts(
    nodeType: string,
    config: ImageGenerateNodeConfig,
    inputs: Record<string, any>,
    imageSize: string,
    aspectRatio: string
  ): PromptResult {
    // 获取用户自定义提示词（UI 编辑后保存到此）
    const customPrompts = (config as any).customPrompts as Record<string, string> | undefined

    // 模特图节点：GEMINI_GENERATE_MODEL, GEMINI_MODEL_FROM_CLOTHES
    if (
      nodeType === WorkflowNodeType.GEMINI_GENERATE_MODEL ||
      nodeType === WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES
    ) {
      const modelConfig: ModelConfig = {
        ageGroup: (config.ageGroup as ModelConfig['ageGroup']) || 'big_kid',
        gender: (config.gender as ModelConfig['gender']) || 'female',
        scenePreset: (config.scenePreset as ModelConfig['scenePreset']) || 'home',
        posePreset: ((config as any).posePreset as ModelConfig['posePreset']) || 'natural',
        ethnicityPreset: ((config as any).ethnicityPreset as ModelConfig['ethnicityPreset']) || 'asian',
        imageSize,
        aspectRatio
      }

      // 如果有 promptJson，合并配置
      if (inputs.promptJson && typeof inputs.promptJson === 'object') {
        modelConfig.ageGroup = (inputs.promptJson.age_group as ModelConfig['ageGroup']) || modelConfig.ageGroup
        modelConfig.gender = (inputs.promptJson.gender as ModelConfig['gender']) || modelConfig.gender
        modelConfig.scenePreset =
          (inputs.promptJson.scene_preset as ModelConfig['scenePreset']) || modelConfig.scenePreset
        // 从 promptJson 读取种族和姿势配置
        modelConfig.ethnicityPreset =
          (inputs.promptJson.ethnicity_preset as ModelConfig['ethnicityPreset']) ||
          (inputs.promptJson.ethnicity as ModelConfig['ethnicityPreset']) ||
          modelConfig.ethnicityPreset
        modelConfig.posePreset =
          (inputs.promptJson.pose_preset as ModelConfig['posePreset']) ||
          (inputs.promptJson.pose as ModelConfig['posePreset']) ||
          modelConfig.posePreset
      }

      const builder = new ModelPromptBuilder({
        promptJson: inputs.promptJson,
        config: modelConfig as ModelConfig & Record<string, unknown>
      })

      // 使用 buildSystemPrompt() 和 buildUserPrompt() 分离
      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      // 处理变量替换
      const variables = {
        ageGroup: modelConfig.ageGroup || '',
        gender: modelConfig.gender || '',
        scenePreset: modelConfig.scenePreset || '',
        posePreset: modelConfig.posePreset || '',
        ethnicityPreset: modelConfig.ethnicityPreset || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 电商图节点：GEMINI_ECOM
    if (nodeType === WorkflowNodeType.GEMINI_ECOM) {
      const ecomJson = inputs.promptJson?.type === 'ecom' ? inputs.promptJson : null

      // 使用新的解析函数，支持 'none' 和 'random'
      // 配置优先级：promptJson > 节点配置
      const resolvedLayout = resolveLayoutMode(ecomJson?.layout_mode || (config as any).layout)
      const resolvedFill = resolveFillMode(ecomJson?.fill_mode || (config as any).fillMode)

      const garmentDesc = (config as any).garmentDescription || (config as any).garmentDesc || ''

      const ecomConfig: EcomConfig = {
        // 'none' 传递 undefined，让 EcomPromptBuilder 处理 AI 自由发挥
        layout: resolvedLayout === 'none' ? undefined : resolvedLayout,
        fillMode: resolvedFill === 'none' ? undefined : resolvedFill,
        garmentDescription: garmentDesc,
        imageSize,
        aspectRatio
      }

      const builder = new EcomPromptBuilder({
        promptJson: ecomJson || undefined,
        config: ecomConfig as EcomConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      // 处理变量替换
      const variables = {
        garmentDescription: ecomConfig.garmentDescription || '',
        layout: ecomConfig.layout || '',
        fillMode: ecomConfig.fillMode || '',
        stylePreset: (ecomConfig.stylePreset as string) || '',
        styleConstraint: (ecomConfig.styleConstraint as string) || '',
        extraNote: (ecomConfig.extraNote as string) || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 图案节点：GEMINI_PATTERN
    if (nodeType === WorkflowNodeType.GEMINI_PATTERN) {
      const patternJson = inputs.promptJson?.type === 'pattern' ? inputs.promptJson : null
      const outputType = (config as any).outputType || 'pattern_only'
      const patternType = (config as any).patternStep || (outputType === 'set' ? 'graphic' : 'seamless')

      // UI 层保存的字段：stylePresetId, stylePresetPrompt, generationMode
      // 优先使用 stylePresetId，其次使用 stylePreset（向后兼容）
      const stylePresetId = (config as any).stylePresetId || (config as any).stylePreset
      const stylePresetPrompt = (config as any).stylePresetPrompt || ''
      const generationMode = (config as any).generationMode || 'mode_a'

      const patternConfig: PatternConfig & Record<string, unknown> = {
        patternType: patternType === 'graphic' ? 'graphic' : 'seamless',
        stylePreset: stylePresetId,
        customElements: stylePresetPrompt || (config as any).customPrompt,
        colorTone: patternJson?.color_mood || (config as any).colorTone || 'auto',
        density: patternJson?.density || (config as any).density || 'medium',
        imageSize,
        aspectRatio,
        // 扩展字段：生成模式 (mode_a, mode_b, mode_c)
        generationMode
      }

      const builder = new PatternPromptBuilder({
        promptJson: patternJson || undefined,
        config: patternConfig
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      // 处理变量替换
      const variables = {
        patternType: patternConfig.patternType || '',
        stylePreset: patternConfig.stylePreset || '',
        customElements: patternConfig.customElements || '',
        colorTone: patternConfig.colorTone || '',
        density: patternConfig.density || '',
        generationMode: (patternConfig.generationMode as string) || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 珠宝摄影节点：JEWELRY_PHOTO
    if (nodeType === WorkflowNodeType.JEWELRY_PHOTO || nodeType === 'jewelry_photo') {
      const jewelryConfig: JewelryConfig = {
        jewelryType: ((config as any).jewelryType as JewelryConfig['jewelryType']) || 'ring',
        metalType: ((config as any).metalType as JewelryConfig['metalType']) || 'gold',
        stoneType: ((config as any).stoneType as JewelryConfig['stoneType']) || 'diamond',
        lightingSetup: ((config as any).lightingSetup as JewelryConfig['lightingSetup']) || 'soft_box',
        backgroundStyle: ((config as any).backgroundStyle as JewelryConfig['backgroundStyle']) || 'white',
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new JewelryPromptBuilder({
        config: jewelryConfig as JewelryConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      // 处理变量替换
      const variables = {
        jewelryType: jewelryConfig.jewelryType || '',
        metalType: jewelryConfig.metalType || '',
        stoneType: jewelryConfig.stoneType || '',
        lightingSetup: jewelryConfig.lightingSetup || '',
        backgroundStyle: jewelryConfig.backgroundStyle || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 食品摄影节点：FOOD_PHOTO
    if (nodeType === WorkflowNodeType.FOOD_PHOTO || nodeType === 'food_photo') {
      const foodConfig: FoodConfig = {
        foodCategory: ((config as any).foodCategory as FoodConfig['foodCategory']) || 'main_dish',
        stylePreset: ((config as any).stylePreset as FoodConfig['stylePreset']) || 'modern',
        moodPreset: ((config as any).moodPreset as FoodConfig['moodPreset']) || 'warm',
        backgroundStyle: ((config as any).backgroundStyle as FoodConfig['backgroundStyle']) || 'white',
        enableSteam: (config as any).enableSteam ?? false,
        enableDroplets: (config as any).enableDroplets ?? false,
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new FoodPromptBuilder({
        config: foodConfig as FoodConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      // 处理变量替换
      const variables = {
        foodCategory: foodConfig.foodCategory || '',
        stylePreset: foodConfig.stylePreset || '',
        moodPreset: foodConfig.moodPreset || '',
        backgroundStyle: foodConfig.backgroundStyle || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 产品场景节点：PRODUCT_SCENE
    if (nodeType === WorkflowNodeType.PRODUCT_SCENE || nodeType === 'product_scene') {
      const sceneConfig: ProductSceneConfig = {
        sceneType: ((config as any).sceneType as ProductSceneConfig['sceneType']) || 'studio',
        lightingStyle: ((config as any).lightingStyle as ProductSceneConfig['lightingStyle']) || 'natural',
        moodStyle: ((config as any).moodStyle as ProductSceneConfig['moodStyle']) || 'professional',
        productType: (config as any).productType,
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new ProductScenePromptBuilder({
        config: sceneConfig as ProductSceneConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      const variables = {
        sceneType: sceneConfig.sceneType || '',
        lightingStyle: sceneConfig.lightingStyle || '',
        moodStyle: sceneConfig.moodStyle || '',
        productType: sceneConfig.productType || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 首饰试戴节点：JEWELRY_TRYON
    if (nodeType === WorkflowNodeType.JEWELRY_TRYON || nodeType === 'jewelry_tryon') {
      const tryonConfig: JewelryTryonConfig = {
        jewelryType: ((config as any).jewelryType as JewelryTryonConfig['jewelryType']) || 'necklace',
        position: ((config as any).position as JewelryTryonConfig['position']) || 'auto',
        blendMode: ((config as any).blendMode as JewelryTryonConfig['blendMode']) || 'natural',
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new JewelryTryonPromptBuilder({
        config: tryonConfig as JewelryTryonConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      const variables = {
        jewelryType: tryonConfig.jewelryType || '',
        position: tryonConfig.position || '',
        blendMode: tryonConfig.blendMode || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 眼镜试戴节点：EYEWEAR_TRYON
    if (nodeType === WorkflowNodeType.EYEWEAR_TRYON || nodeType === 'eyewear_tryon') {
      const eyewearConfig: EyewearTryonConfig = {
        eyewearType: ((config as any).eyewearType as EyewearTryonConfig['eyewearType']) || 'glasses',
        frameStyle: ((config as any).frameStyle as EyewearTryonConfig['frameStyle']) || 'round',
        lensEffect: ((config as any).lensEffect as EyewearTryonConfig['lensEffect']) || 'clear',
        blendMode: ((config as any).blendMode as EyewearTryonConfig['blendMode']) || 'natural',
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new EyewearTryonPromptBuilder({
        config: eyewearConfig as EyewearTryonConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      const variables = {
        eyewearType: eyewearConfig.eyewearType || '',
        frameStyle: eyewearConfig.frameStyle || '',
        lensEffect: eyewearConfig.lensEffect || '',
        blendMode: eyewearConfig.blendMode || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 鞋类展示节点：FOOTWEAR_DISPLAY
    if (nodeType === WorkflowNodeType.FOOTWEAR_DISPLAY || nodeType === 'footwear_display') {
      const footwearConfig: FootwearDisplayConfig = {
        footwearType: ((config as any).footwearType as FootwearDisplayConfig['footwearType']) || 'sneakers',
        displayAngle: ((config as any).displayAngle as FootwearDisplayConfig['displayAngle']) || 'three_quarter',
        materialStyle: ((config as any).materialStyle as FootwearDisplayConfig['materialStyle']) || 'leather',
        sceneBackground: ((config as any).sceneBackground as FootwearDisplayConfig['sceneBackground']) || 'white',
        lightingEffect: ((config as any).lightingEffect as FootwearDisplayConfig['lightingEffect']) || 'soft',
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new FootwearDisplayPromptBuilder({
        config: footwearConfig as FootwearDisplayConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      const variables = {
        footwearType: footwearConfig.footwearType || '',
        displayAngle: footwearConfig.displayAngle || '',
        materialStyle: footwearConfig.materialStyle || '',
        sceneBackground: footwearConfig.sceneBackground || '',
        lightingEffect: footwearConfig.lightingEffect || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 美妆产品节点：COSMETICS_PHOTO
    if (nodeType === WorkflowNodeType.COSMETICS_PHOTO || nodeType === 'cosmetics_photo') {
      const cosmeticsConfig: CosmeticsPhotoConfig = {
        cosmeticsType: ((config as any).cosmeticsType as CosmeticsPhotoConfig['cosmeticsType']) || 'skincare',
        productTexture: ((config as any).productTexture as CosmeticsPhotoConfig['productTexture']) || 'glossy',
        displayStyle: ((config as any).displayStyle as CosmeticsPhotoConfig['displayStyle']) || 'clean',
        backgroundSetting: ((config as any).backgroundSetting as CosmeticsPhotoConfig['backgroundSetting']) || 'white',
        lightingEffect: ((config as any).lightingEffect as CosmeticsPhotoConfig['lightingEffect']) || 'soft',
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new CosmeticsPhotoPromptBuilder({
        config: cosmeticsConfig as CosmeticsPhotoConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      const variables = {
        cosmeticsType: cosmeticsConfig.cosmeticsType || '',
        productTexture: cosmeticsConfig.productTexture || '',
        displayStyle: cosmeticsConfig.displayStyle || '',
        backgroundSetting: cosmeticsConfig.backgroundSetting || '',
        lightingEffect: cosmeticsConfig.lightingEffect || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 家具场景节点：FURNITURE_SCENE
    if (nodeType === WorkflowNodeType.FURNITURE_SCENE || nodeType === 'furniture_scene') {
      const furnitureConfig: FurnitureSceneConfig = {
        furnitureType: ((config as any).furnitureType as FurnitureSceneConfig['furnitureType']) || 'sofa',
        sceneStyle: ((config as any).sceneStyle as FurnitureSceneConfig['sceneStyle']) || 'modern',
        roomType: ((config as any).roomType as FurnitureSceneConfig['roomType']) || 'living_room',
        lightingMood: ((config as any).lightingMood as FurnitureSceneConfig['lightingMood']) || 'natural',
        spaceSize: ((config as any).spaceSize as FurnitureSceneConfig['spaceSize']) || 'medium',
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new FurnitureScenePromptBuilder({
        config: furnitureConfig as FurnitureSceneConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      const variables = {
        furnitureType: furnitureConfig.furnitureType || '',
        sceneStyle: furnitureConfig.sceneStyle || '',
        roomType: furnitureConfig.roomType || '',
        lightingMood: furnitureConfig.lightingMood || '',
        spaceSize: furnitureConfig.spaceSize || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 电子产品节点：ELECTRONICS_PHOTO
    if (nodeType === WorkflowNodeType.ELECTRONICS_PHOTO || nodeType === 'electronics_photo') {
      const electronicsConfig: ElectronicsPhotoConfig = {
        electronicsType: ((config as any).electronicsType as ElectronicsPhotoConfig['electronicsType']) || 'smartphone',
        displayStyle: ((config as any).displayStyle as ElectronicsPhotoConfig['displayStyle']) || 'minimal',
        surfaceFinish: ((config as any).surfaceFinish as ElectronicsPhotoConfig['surfaceFinish']) || 'glossy',
        lightingStyle: ((config as any).lightingStyle as ElectronicsPhotoConfig['lightingStyle']) || 'soft',
        screenContent: ((config as any).screenContent as ElectronicsPhotoConfig['screenContent']) || 'blank',
        imageSize,
        aspectRatio,
        extraDescription: (config as any).extraDescription
      }

      const builder = new ElectronicsPhotoPromptBuilder({
        config: electronicsConfig as ElectronicsPhotoConfig & Record<string, unknown>
      })

      let systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
      let userPrompt = customPrompts?.user || builder.buildUserPrompt()

      const variables = {
        electronicsType: electronicsConfig.electronicsType || '',
        displayStyle: electronicsConfig.displayStyle || '',
        surfaceFinish: electronicsConfig.surfaceFinish || '',
        lightingStyle: electronicsConfig.lightingStyle || '',
        screenContent: electronicsConfig.screenContent || ''
      }
      systemPrompt = PromptBuilder.processTemplate(systemPrompt, variables)
      userPrompt = PromptBuilder.processTemplate(userPrompt, variables)

      return { systemPrompt, userPrompt }
    }

    // 通用图片生成节点：GEMINI_GENERATE 或其他
    // 如果有结构化 promptJson，使用 ModelPromptBuilder
    if (inputs.promptJson && typeof inputs.promptJson === 'object') {
      const hasStructuredFields =
        inputs.promptJson.foreground ||
        inputs.promptJson.midground ||
        inputs.promptJson.background ||
        inputs.promptJson.visual_guidance ||
        inputs.promptJson.camera_params

      if (hasStructuredFields || inputs.promptJson.full_prompt) {
        const modelConfig: ModelConfig = {
          ageGroup:
            (config.ageGroup as ModelConfig['ageGroup']) ||
            (inputs.promptJson.age_group as ModelConfig['ageGroup']) ||
            'big_kid',
          gender:
            (config.gender as ModelConfig['gender']) || (inputs.promptJson.gender as ModelConfig['gender']) || 'female',
          scenePreset:
            (config.scenePreset as ModelConfig['scenePreset']) ||
            (inputs.promptJson.scene_preset as ModelConfig['scenePreset']) ||
            'home',
          imageSize,
          aspectRatio
        }

        const builder = new ModelPromptBuilder({
          promptJson: inputs.promptJson,
          config: modelConfig as ModelConfig & Record<string, unknown>
        })

        const systemPrompt = customPrompts?.system || builder.buildSystemPrompt()
        const userPrompt = customPrompts?.user || builder.buildUserPrompt()

        return { systemPrompt, userPrompt }
      }

      // JSON 没有结构化字段，使用 caption 作为用户提示词
      const userPrompt = customPrompts?.user || inputs.promptJson.caption || inputs.prompt || config.prompt || ''
      return { systemPrompt: customPrompts?.system, userPrompt }
    }

    // 没有 promptJson，使用普通提示词
    const userPrompt = customPrompts?.user || inputs.prompt || config.prompt || ''
    return { systemPrompt: customPrompts?.system, userPrompt }
  }

  async execute(
    inputs: Record<string, any>,
    config: ImageGenerateNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 确保 imageSize 和 aspectRatio 有值（回退到默认值）
      const imageSize = config.imageSize || '2K'
      const aspectRatio = config.aspectRatio || '1:1'

      // 获取用户自定义提示词（UI 编辑后保存到此）
      const customPrompts = (config as any).customPrompts as Record<string, string> | undefined

      // 调试日志
      this.log(context, '开始执行图片生成节点', {
        imageSize,
        aspectRatio,
        configImageSize: config.imageSize,
        configAspectRatio: config.aspectRatio,
        hasImageSize: 'imageSize' in config,
        hasAspectRatio: 'aspectRatio' in config,
        hasCustomPrompts: !!customPrompts
      })

      // 查找 Gemini 图片生成 Provider
      const geminiProvider = await WorkflowAiService.findGeminiImageProvider(config.providerId, config.modelId)

      if (!geminiProvider) {
        return this.error(
          '未找到可用的 Gemini 图像生成服务。请在设置 → 模型服务中添加 Provider，并为模型设置端点类型为 "图像生成 (Gemini)"'
        )
      }

      this.log(context, '找到 Gemini Provider', {
        providerId: geminiProvider.provider.id,
        modelId: geminiProvider.model.id
      })

      // 收集所有图片输入
      const images = this.collectImageInputs(inputs)
      this.log(context, `收集到 ${images.length} 张图片`)

      // 根据节点类型构建提示词（使用 system + user 分离）
      const nodeType = (config as any).nodeType || 'gemini_generate'
      const { systemPrompt, userPrompt } = this.buildPrompts(nodeType, config, inputs, imageSize, aspectRatio)

      if (!userPrompt) {
        return this.error('缺少提示词')
      }

      this.log(context, '提示词准备完成', {
        hasSystemPrompt: !!systemPrompt,
        systemPromptLength: systemPrompt?.length || 0,
        userPromptLength: userPrompt.length
      })

      const imageBase64List = images.length > 0 ? await WorkflowAiService.loadImagesAsBase64(images) : undefined

      let outputs: Record<string, any> = {}

      // 多步骤 ECOM 生成（主图 + 可选的背面图 + 细节图）
      if (nodeType === WorkflowNodeType.GEMINI_ECOM && !(config as any).ecomStep) {
        // 使用新的解析函数，支持 'none' 和 'random'
        const resolvedLayout = resolveLayoutMode((config as any).layout)
        const resolvedFill = resolveFillMode((config as any).fillMode)

        const garmentDesc = (config as any).garmentDescription || (config as any).garmentDesc || ''
        const enableBack = (config as any).enableBack ?? false
        const enableDetail = (config as any).enableDetail ?? false
        const detailTypes = ((config as any).detailTypes as string[] | undefined) || []

        // 使用 EcomPromptBuilder 生成 system + user 提示词
        const mainBuilder = new EcomPromptBuilder({
          config: {
            // 'none' 传递 undefined，让 EcomPromptBuilder 处理 AI 自由发挥
            layout: resolvedLayout === 'none' ? undefined : resolvedLayout,
            fillMode: resolvedFill === 'none' ? undefined : resolvedFill,
            garmentDescription: garmentDesc,
            imageSize: imageSize,
            aspectRatio: aspectRatio
          } as EcomConfig & Record<string, unknown>
        })
        const mainSystemPrompt = customPrompts?.system || mainBuilder.buildSystemPrompt()
        const mainUserPrompt = customPrompts?.user || mainBuilder.buildUserPrompt()

        // 检查是否已取消
        if (this.shouldAbort(context)) {
          return this.error('执行已取消', Date.now() - startTime)
        }

        const mainImage = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
          prompt: mainUserPrompt,
          systemPrompt: mainSystemPrompt,
          negativePrompt: config.negativePrompt,
          images: imageBase64List,
          aspectRatio,
          imageSize,
          signal: context.abortSignal
        })
        outputs.mainImage = mainImage
        outputs.image = mainImage
        this.log(context, 'ECOM 主图完成')

        if (enableBack) {
          // 检查是否有用户提供的背面参考图（使用统一的 image_N 命名）
          // image_4 = 上装背面图, image_5 = 下装背面图
          const backTopImage = inputs.image_4 as string | undefined
          const backBottomImage = inputs.image_5 as string | undefined
          const hasBackReference = !!(backTopImage || backBottomImage)

          // 收集背面参考图
          const backRefImages: string[] = []
          if (backTopImage) {
            const backTopBase64 = await WorkflowAiService.loadImagesAsBase64([backTopImage])
            backRefImages.push(...backTopBase64)
          }
          if (backBottomImage) {
            const backBottomBase64 = await WorkflowAiService.loadImagesAsBase64([backBottomImage])
            backRefImages.push(...backBottomBase64)
          }

          // 根据是否有背面参考图使用不同的提示词
          const backPrompt = customPrompts?.back || EcomPromptBuilder.buildBackViewPrompt()

          // 构建背面图生成的图片列表：原始图 + 主图 + 背面参考图（如果有）
          const backImages = [...(imageBase64List || []), mainImage, ...backRefImages]

          const backImage = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
            prompt: hasBackReference
              ? `${backPrompt}\n\n[IMPORTANT] Reference back view images are provided. Use them to accurately reproduce the back design.`
              : backPrompt,
            systemPrompt: mainSystemPrompt, // 使用相同的系统提示词保持风格一致
            negativePrompt: config.negativePrompt,
            images: backImages,
            aspectRatio,
            imageSize,
            signal: context.abortSignal
          })
          outputs.backImage = backImage
          this.log(context, 'ECOM 背面图完成', { hasBackReference })
        }

        if (enableDetail && detailTypes.length > 0) {
          const detailImages: string[] = []
          for (const dt of detailTypes) {
            // 检查是否已取消
            if (this.shouldAbort(context)) {
              return this.error('执行已取消', Date.now() - startTime)
            }

            // 细节图使用静态方法
            const detailPrompt = EcomPromptBuilder.buildDetailPrompt(dt as EcomDetailType)
            const detailImage = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
              prompt: detailPrompt,
              systemPrompt: mainSystemPrompt, // 使用相同的系统提示词保持风格一致
              negativePrompt: config.negativePrompt,
              images: imageBase64List ? [...imageBase64List, mainImage] : [mainImage],
              aspectRatio,
              imageSize,
              signal: context.abortSignal
            })
            detailImages.push(detailImage)
          }
          outputs.detailImages = detailImages
          this.log(context, 'ECOM 细节图完成', { count: detailImages.length })
        }

        this.log(context, '图片生成完成', { outputKeys: Object.keys(outputs) })
        return this.success(outputs, Date.now() - startTime)
      }

      // 多步骤 PATTERN 生成（大图 + 无缝图）
      if (nodeType === WorkflowNodeType.GEMINI_PATTERN && !(config as any).patternStep) {
        const outputType = (config as any).outputType || 'pattern_only'

        // 使用 PatternPromptBuilder 生成 system + user 提示词
        const patternBuilder = new PatternPromptBuilder({
          config: {
            patternType: outputType === 'set' ? 'graphic' : 'seamless',
            stylePreset: (config as any).stylePreset,
            customElements: (config as any).customPrompt,
            colorTone: (config as any).colorTone || 'auto',
            density: (config as any).density || 'medium',
            imageSize,
            aspectRatio
          } as PatternConfig & Record<string, unknown>
        })
        const patternSystemPrompt = customPrompts?.system || patternBuilder.buildSystemPrompt()

        if (outputType === 'set') {
          // 先生成大图
          const graphicBuilder = new PatternPromptBuilder({
            config: {
              patternType: 'graphic',
              stylePreset: (config as any).stylePreset,
              customElements: (config as any).customPrompt,
              colorTone: (config as any).colorTone || 'auto',
              density: (config as any).density || 'medium',
              imageSize,
              aspectRatio
            } as PatternConfig & Record<string, unknown>
          })
          const graphicUserPrompt = customPrompts?.user || graphicBuilder.buildUserPrompt()

          // 检查是否已取消
          if (this.shouldAbort(context)) {
            return this.error('执行已取消', Date.now() - startTime)
          }

          const graphicImage = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
            prompt: graphicUserPrompt,
            systemPrompt: patternSystemPrompt,
            negativePrompt: config.negativePrompt,
            images: imageBase64List,
            aspectRatio,
            imageSize,
            signal: context.abortSignal
          })
          outputs.graphicImage = graphicImage
          outputs.image = graphicImage
          this.log(context, 'PATTERN 大图完成')

          // 再生成无缝图
          const seamlessBuilder = new PatternPromptBuilder({
            config: {
              patternType: 'seamless',
              stylePreset: (config as any).stylePreset,
              customElements: (config as any).customPrompt,
              colorTone: (config as any).colorTone || 'auto',
              density: (config as any).density || 'medium',
              imageSize,
              aspectRatio
            } as PatternConfig & Record<string, unknown>
          })
          const seamlessUserPrompt = seamlessBuilder.buildUserPrompt()

          const patternImage = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
            prompt: seamlessUserPrompt,
            systemPrompt: patternSystemPrompt,
            negativePrompt: config.negativePrompt,
            images: imageBase64List,
            aspectRatio,
            imageSize,
            signal: context.abortSignal
          })
          outputs.patternImage = patternImage
          this.log(context, 'PATTERN 无缝图完成')
        } else {
          // 只生成无缝图
          const seamlessUserPrompt = customPrompts?.user || patternBuilder.buildUserPrompt()

          // 检查是否已取消
          if (this.shouldAbort(context)) {
            return this.error('执行已取消', Date.now() - startTime)
          }

          const patternImage = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
            prompt: seamlessUserPrompt,
            systemPrompt: patternSystemPrompt,
            negativePrompt: config.negativePrompt,
            images: imageBase64List,
            aspectRatio,
            imageSize,
            signal: context.abortSignal
          })
          outputs.patternImage = patternImage
          outputs.image = patternImage
          this.log(context, 'PATTERN 无缝图完成')
        }

        this.log(context, '图片生成完成', { outputKeys: Object.keys(outputs) })
        return this.success(outputs, Date.now() - startTime)
      }

      // 单步骤图片生成（通用路径）
      this.log(context, '调用 Gemini API...')

      // 检查是否已取消
      if (this.shouldAbort(context)) {
        return this.error('执行已取消', Date.now() - startTime)
      }

      const imageResult = await WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        negativePrompt: config.negativePrompt,
        images: imageBase64List,
        aspectRatio,
        imageSize,
        signal: context.abortSignal
      })

      // 根据节点类型设置输出
      if (nodeType === WorkflowNodeType.GEMINI_ECOM) {
        // 单步骤 ECOM（通过外部流程控制）
        const step = (config as any).ecomStep as 'main' | 'back' | 'detail'
        if (step === 'main') {
          outputs = { mainImage: imageResult, image: imageResult }
        } else if (step === 'back') {
          outputs = { backImage: imageResult, image: imageResult }
        } else {
          outputs = { detailImages: [imageResult], image: imageResult }
        }
      } else if (nodeType === WorkflowNodeType.GEMINI_PATTERN) {
        // 单步骤 PATTERN（通过外部流程控制）
        const patternStep = (config as any).patternStep as 'graphic' | 'seamless'
        if (patternStep === 'graphic') {
          outputs = { graphicImage: imageResult, image: imageResult }
        } else {
          outputs = { patternImage: imageResult, image: imageResult }
        }
      } else {
        // 其他节点类型
        const outputKey =
          {
            [WorkflowNodeType.GEMINI_GENERATE]: 'image',
            [WorkflowNodeType.GEMINI_GENERATE_MODEL]: 'modelImage',
            [WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES]: 'modelImage'
          }[nodeType] || 'image'

        outputs = { [outputKey]: imageResult, image: imageResult }
      }

      this.log(context, '图片生成完成', { outputKeys: Object.keys(outputs) })

      return this.success(outputs, Date.now() - startTime)
    } catch (error) {
      this.logError(context, '图片生成失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default GeminiGenerateExecutor
