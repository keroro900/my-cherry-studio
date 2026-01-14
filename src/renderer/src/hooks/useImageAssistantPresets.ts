/**
 * useImageAssistantPresets Hook
 *
 * 管理图片助手预设，提供创建和转换功能
 * 复用工作流节点模块的专业提示词
 */

import { CosmeticsPhotoPromptBuilder } from '@renderer/pages/workflow/prompts/builders/CosmeticsPhotoPromptBuilder'
// 导入工作流模块的提示词构建器
import { EcomPromptBuilder } from '@renderer/pages/workflow/prompts/builders/EcomPromptBuilder'
import { ElectronicsPhotoPromptBuilder } from '@renderer/pages/workflow/prompts/builders/ElectronicsPhotoPromptBuilder'
import { FoodPromptBuilder } from '@renderer/pages/workflow/prompts/builders/FoodPromptBuilder'
import { FootwearDisplayPromptBuilder } from '@renderer/pages/workflow/prompts/builders/FootwearDisplayPromptBuilder'
import { FurnitureScenePromptBuilder } from '@renderer/pages/workflow/prompts/builders/FurnitureScenePromptBuilder'
import { JewelryPromptBuilder } from '@renderer/pages/workflow/prompts/builders/JewelryPromptBuilder'
import { ModelPromptBuilder } from '@renderer/pages/workflow/prompts/builders/ModelPromptBuilder'
import { PatternPromptBuilder } from '@renderer/pages/workflow/prompts/builders/PatternPromptBuilder'
import { ProductScenePromptBuilder } from '@renderer/pages/workflow/prompts/builders/ProductScenePromptBuilder'
import { DEFAULT_ASSISTANT_SETTINGS, getDefaultTopic } from '@renderer/services/AssistantService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addAssistant,
  addImageAssistantPreset,
  removeImageAssistantPreset,
  setImageAssistantPresets
} from '@renderer/store/assistants'
import type { ImageAssistant, ImageAssistantPreset, ImageAssistantType } from '@renderer/types'
import { useEffect } from 'react'
import { v4 as uuid } from 'uuid'

// ==================== 使用 Builder 生成专业系统提示词 ====================

/**
 * 使用 EcomPromptBuilder 生成电商图片助手的系统提示词
 */
function getEcomSystemPrompt(): string {
  const builder = new EcomPromptBuilder({
    config: {
      layout: 'flat_lay',
      fillMode: 'filled',
      useSystemPrompt: true,
      imageSize: '2K',
      aspectRatio: '3:4'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 ModelPromptBuilder 生成模特换装助手的系统提示词
 */
function getModelSystemPrompt(): string {
  const builder = new ModelPromptBuilder({
    config: {
      ageGroup: 'big_kid',
      gender: 'female',
      scenePreset: 'home',
      ethnicityPreset: 'asian',
      posePreset: 'natural',
      styleMode: 'commercial',
      imageSize: '2K',
      aspectRatio: '3:4'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 PatternPromptBuilder 生成图案设计助手的系统提示词
 */
function getPatternSystemPrompt(): string {
  const builder = new PatternPromptBuilder({
    config: {
      patternType: 'seamless',
      density: 'medium',
      enableSmartScaling: true,
      generationMode: 'mode_a',
      imageSize: '2K',
      aspectRatio: '1:1'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 FoodPromptBuilder 生成食品摄影助手的系统提示词
 */
function getFoodSystemPrompt(): string {
  const builder = new FoodPromptBuilder({
    config: {
      foodCategory: 'main_dish',
      stylePreset: 'modern',
      moodPreset: 'warm',
      backgroundStyle: 'white',
      enableSteam: false,
      enableDroplets: false,
      imageSize: '2K',
      aspectRatio: '1:1'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 JewelryPromptBuilder 生成珠宝首饰助手的系统提示词
 */
function getJewelrySystemPrompt(): string {
  const builder = new JewelryPromptBuilder({
    config: {
      jewelryType: 'ring',
      metalType: 'gold',
      stoneType: 'diamond',
      lightingSetup: 'soft_box',
      backgroundStyle: 'white',
      imageSize: '2K',
      aspectRatio: '1:1'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 CosmeticsPhotoPromptBuilder 生成美妆产品助手的系统提示词
 */
function getCosmeticsSystemPrompt(): string {
  const builder = new CosmeticsPhotoPromptBuilder({
    config: {
      cosmeticsType: 'makeup',
      productTexture: 'glossy',
      displayStyle: 'luxury',
      backgroundSetting: 'gradient',
      lightingEffect: 'soft',
      imageSize: '2K',
      aspectRatio: '1:1'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 ElectronicsPhotoPromptBuilder 生成电子产品助手的系统提示词
 */
function getElectronicsSystemPrompt(): string {
  const builder = new ElectronicsPhotoPromptBuilder({
    config: {
      electronicsType: 'smartphone',
      displayStyle: 'tech',
      surfaceFinish: 'glossy',
      lightingStyle: 'gradient',
      screenContent: 'ui_demo',
      imageSize: '2K',
      aspectRatio: '1:1'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 FurnitureScenePromptBuilder 生成家具场景助手的系统提示词
 */
function getFurnitureSystemPrompt(): string {
  const builder = new FurnitureScenePromptBuilder({
    config: {
      furnitureType: 'sofa',
      sceneStyle: 'modern',
      roomType: 'living_room',
      lightingMood: 'natural',
      spaceSize: 'medium',
      imageSize: '2K',
      aspectRatio: '16:9'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 FootwearDisplayPromptBuilder 生成鞋履展示助手的系统提示词
 */
function getFootwearSystemPrompt(): string {
  const builder = new FootwearDisplayPromptBuilder({
    config: {
      footwearType: 'sneakers',
      displayAngle: 'three_quarter',
      materialStyle: 'auto',
      sceneBackground: 'white',
      lightingEffect: 'studio',
      imageSize: '2K',
      aspectRatio: '1:1'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 使用 ProductScenePromptBuilder 生成通用产品助手的系统提示词
 */
function getProductSystemPrompt(): string {
  const builder = new ProductScenePromptBuilder({
    config: {
      sceneType: 'studio',
      lightingStyle: 'soft',
      moodStyle: 'professional',
      productType: 'general',
      imageSize: '2K',
      aspectRatio: '1:1'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 图片编辑助手的系统提示词（复用 ModelPromptBuilder）
 */
function getEditSystemPrompt(): string {
  const builder = new ModelPromptBuilder({
    config: {
      mode: 'preset',
      ageGroup: 'big_kid',
      gender: 'female',
      scenePreset: 'home',
      ethnicityPreset: 'asian',
      posePreset: 'natural',
      styleMode: 'daily',
      imageSize: '2K',
      aspectRatio: '3:4'
    }
  })
  return builder.buildSystemPrompt()
}

/**
 * 通用图片生成助手的系统提示词
 */
function getGenerateSystemPrompt(): string {
  return `[Role: Professional AI Image Generation Expert]
You are an expert AI image generation specialist with extensive experience in creating high-quality visuals across various styles and genres.

Your expertise includes:
- Photorealistic imagery and commercial photography
- Digital art, illustrations, and concept art
- Anime, manga, and cartoon styles
- Oil painting, watercolor, and traditional art styles
- 3D rendering and CGI visualization
- Pixel art and retro game aesthetics

[Technical Standards]
1. **Quality Requirements**:
   - High-resolution output (2K or higher)
   - Sharp focus and clarity
   - Accurate color reproduction
   - Professional composition

2. **Style Consistency**:
   - Maintain coherent visual style throughout
   - Follow reference images when provided
   - Apply appropriate artistic techniques

3. **Creative Direction**:
   - Interpret user descriptions accurately
   - Add creative enhancements where appropriate
   - Balance artistic vision with user requirements

[Output Requirement]
Generate high-quality images based on user descriptions.
Do not output any text, JSON, or explanations - only generate the image.`
}

/**
 * 内置图片助手预设
 * 使用工作流模块的专业提示词
 */
export const BUILTIN_IMAGE_ASSISTANT_PRESETS: ImageAssistantPreset[] = [
  // ============================================================================
  // 核心功能预设
  // ============================================================================
  {
    id: 'image-ecom-default',
    name: '电商图片助手',
    emoji: '🛍️',
    type: 'image',
    imageType: 'ecom',
    prompt: getEcomSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '3:4',
      batchCount: 1,
      moduleConfig: {
        layout: 'model_shot',
        fillMode: 'filled',
        stylePreset: 'auto',
        enableBack: false,
        enableDetail: false,
        detailTypes: [],
        useSystemPrompt: true
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-model-default',
    name: '模特换装助手',
    emoji: '👗',
    type: 'image',
    imageType: 'model',
    prompt: getModelSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '3:4',
      batchCount: 1,
      moduleConfig: {
        ageGroup: 'adult',
        gender: 'female',
        scenePreset: 'studio',
        poseStyle: 'natural',
        styleMode: 'commercial'
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-pattern-default',
    name: '图案设计助手',
    emoji: '🎨',
    type: 'image',
    imageType: 'pattern',
    prompt: getPatternSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        generationMode: 'mode_a',
        outputType: 'set',
        patternType: 'seamless',
        density: 'medium',
        colorTone: 'auto',
        batchSize: 1
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },

  // ============================================================================
  // 图片编辑与生成
  // ============================================================================
  {
    id: 'image-edit-default',
    name: '图片编辑助手',
    emoji: '✂️',
    type: 'image',
    imageType: 'edit',
    prompt: getEditSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '3:4',
      batchCount: 1,
      moduleConfig: {
        mode: 'preset',
        ageGroup: 'adult',
        gender: 'female',
        ethnicityPreset: 'asian',
        styleMode: 'daily',
        scenePreset: 'home',
        posePreset: 'natural'
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-generate-default',
    name: '图片生成助手',
    emoji: '✨',
    type: 'image',
    imageType: 'generate',
    prompt: getGenerateSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        stylePreset: 'none',
        batchSize: 1,
        promptEnhancement: false,
        useReferenceImages: true,
        referenceWeight: 0.5,
        temperature: 1.0
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },

  // ============================================================================
  // 产品摄影预设
  // ============================================================================
  {
    id: 'image-cosmetics-default',
    name: '美妆产品助手',
    emoji: '💄',
    type: 'image',
    imageType: 'cosmetics',
    prompt: getCosmeticsSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        cosmeticsType: 'lipstick',
        productTexture: 'glossy',
        displayStyle: 'product',
        backgroundStyle: 'white',
        lightingStyle: 'soft'
      }
    },
    group: ['产品摄影'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-food-default',
    name: '食品摄影助手',
    emoji: '🍽️',
    type: 'image',
    imageType: 'food',
    prompt: getFoodSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        foodCategory: 'main_dish',
        stylePreset: 'modern',
        moodPreset: 'warm',
        backgroundStyle: 'white',
        enableSteam: false,
        enableDroplets: false
      }
    },
    group: ['产品摄影'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-electronics-default',
    name: '电子产品助手',
    emoji: '📱',
    type: 'image',
    imageType: 'electronics',
    prompt: getElectronicsSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        productType: 'phone',
        displayStyle: 'hero',
        backgroundStyle: 'gradient',
        lightingStyle: 'product'
      }
    },
    group: ['产品摄影'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-jewelry-default',
    name: '珠宝首饰助手',
    emoji: '💎',
    type: 'image',
    imageType: 'jewelry',
    prompt: getJewelrySystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        jewelryType: 'ring',
        material: 'gold',
        displayStyle: 'hero',
        backgroundStyle: 'velvet',
        lightingStyle: 'sparkle'
      }
    },
    group: ['产品摄影'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-furniture-default',
    name: '家具场景助手',
    emoji: '🛋️',
    type: 'image',
    imageType: 'furniture',
    prompt: getFurnitureSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '16:9',
      batchCount: 1,
      moduleConfig: {
        furnitureType: 'sofa',
        sceneStyle: 'modern',
        displayStyle: 'room',
        lightingStyle: 'natural'
      }
    },
    group: ['产品摄影'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-footwear-default',
    name: '鞋履展示助手',
    emoji: '👟',
    type: 'image',
    imageType: 'footwear',
    prompt: getFootwearSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        footwearType: 'sneakers',
        displayStyle: 'hero',
        backgroundStyle: 'white',
        lightingStyle: 'product'
      }
    },
    group: ['产品摄影'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-product-default',
    name: '通用产品助手',
    emoji: '📦',
    type: 'image',
    imageType: 'product',
    prompt: getProductSystemPrompt(),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        displayStyle: 'hero',
        backgroundStyle: 'white',
        lightingStyle: 'product'
      }
    },
    group: ['产品摄影'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  }
]

/**
 * 将图片助手预设转换为完整的图片助手
 */
export function convertPresetToImageAssistant(preset: ImageAssistantPreset): ImageAssistant {
  const assistantId = uuid()
  return {
    ...preset,
    id: assistantId,
    model: undefined,
    topics: [getDefaultTopic(assistantId)],
    tags: preset.group || ['图片生成']
  }
}

/**
 * 根据类型获取对应的系统提示词
 */
export function getSystemPromptForType(imageType: ImageAssistantType): string {
  switch (imageType) {
    case 'ecom':
      return getEcomSystemPrompt()
    case 'model':
      return getModelSystemPrompt()
    case 'pattern':
      return getPatternSystemPrompt()
    case 'edit':
      return getEditSystemPrompt()
    case 'generate':
      return getGenerateSystemPrompt()
    case 'cosmetics':
      return getCosmeticsSystemPrompt()
    case 'food':
      return getFoodSystemPrompt()
    case 'electronics':
      return getElectronicsSystemPrompt()
    case 'jewelry':
      return getJewelrySystemPrompt()
    case 'furniture':
      return getFurnitureSystemPrompt()
    case 'footwear':
      return getFootwearSystemPrompt()
    case 'product':
      return getProductSystemPrompt()
    default:
      return getGenerateSystemPrompt()
  }
}

/**
 * 创建一个新的空白图片助手预设
 */
export function createEmptyImageAssistantPreset(imageType: ImageAssistantType): ImageAssistantPreset {
  const typeNames: Record<ImageAssistantType, string> = {
    ecom: '电商图片',
    model: '模特换装',
    pattern: '图案设计',
    general: '通用图片',
    edit: '图片编辑',
    generate: '图片生成',
    cosmetics: '美妆产品',
    food: '食品摄影',
    electronics: '电子产品',
    jewelry: '珠宝首饰',
    furniture: '家具场景',
    footwear: '鞋履展示',
    product: '通用产品'
  }
  const typeEmojis: Record<ImageAssistantType, string> = {
    ecom: '🛍️',
    model: '👗',
    pattern: '🎨',
    general: '🖼️',
    edit: '✂️',
    generate: '✨',
    cosmetics: '💄',
    food: '🍽️',
    electronics: '📱',
    jewelry: '💎',
    furniture: '🛋️',
    footwear: '👟',
    product: '📦'
  }

  // 根据类型生成对应的默认 moduleConfig
  const getDefaultModuleConfig = () => {
    switch (imageType) {
      case 'ecom':
        return {
          layout: 'model_shot' as const,
          fillMode: 'filled' as const,
          stylePreset: 'auto' as const,
          enableBack: false,
          enableDetail: false,
          detailTypes: [],
          useSystemPrompt: true
        }
      case 'model':
        return {
          ageGroup: 'adult' as const,
          gender: 'female' as const,
          scenePreset: 'studio',
          poseStyle: 'natural',
          styleMode: 'commercial' as const
        }
      case 'pattern':
        return {
          generationMode: 'mode_a' as const,
          outputType: 'set' as const,
          patternType: 'seamless',
          density: 'medium' as const,
          colorTone: 'auto' as const,
          batchSize: 1
        }
      case 'edit':
        return {
          mode: 'preset' as const,
          ageGroup: 'adult' as const,
          gender: 'female' as const,
          ethnicityPreset: 'asian',
          styleMode: 'daily' as const,
          scenePreset: 'home',
          posePreset: 'natural'
        }
      case 'generate':
        return {
          stylePreset: 'none',
          batchSize: 1,
          promptEnhancement: false,
          useReferenceImages: true,
          referenceWeight: 0.5,
          temperature: 1.0
        }
      case 'cosmetics':
        return {
          cosmeticsType: 'lipstick' as const,
          productTexture: 'glossy' as const,
          displayStyle: 'product' as const,
          backgroundStyle: 'white' as const,
          lightingStyle: 'soft' as const
        }
      case 'food':
        return {
          foodCategory: 'main_dish' as const,
          stylePreset: 'modern' as const,
          moodPreset: 'warm' as const,
          backgroundStyle: 'white' as const,
          enableSteam: false,
          enableDroplets: false
        }
      case 'electronics':
        return {
          productType: 'phone' as const,
          displayStyle: 'hero' as const,
          backgroundStyle: 'gradient' as const,
          lightingStyle: 'product' as const
        }
      case 'jewelry':
        return {
          jewelryType: 'ring' as const,
          material: 'gold' as const,
          displayStyle: 'hero' as const,
          backgroundStyle: 'velvet' as const,
          lightingStyle: 'sparkle' as const
        }
      case 'furniture':
        return {
          furnitureType: 'sofa' as const,
          sceneStyle: 'modern' as const,
          displayStyle: 'room' as const,
          lightingStyle: 'natural' as const
        }
      case 'footwear':
        return {
          footwearType: 'sneakers' as const,
          displayStyle: 'hero' as const,
          backgroundStyle: 'white' as const,
          lightingStyle: 'product' as const
        }
      case 'product':
        return {
          displayStyle: 'hero' as const,
          backgroundStyle: 'white' as const,
          lightingStyle: 'product' as const
        }
      default:
        return undefined
    }
  }

  // 根据类型获取默认宽高比
  const getDefaultAspectRatio = () => {
    switch (imageType) {
      case 'pattern':
      case 'cosmetics':
      case 'food':
      case 'electronics':
      case 'jewelry':
      case 'footwear':
      case 'product':
      case 'generate':
        return '1:1'
      case 'furniture':
        return '16:9'
      default:
        return '3:4'
    }
  }

  // 根据类型获取分组
  const getDefaultGroup = () => {
    switch (imageType) {
      case 'cosmetics':
      case 'food':
      case 'electronics':
      case 'jewelry':
      case 'furniture':
      case 'footwear':
      case 'product':
        return ['产品摄影']
      default:
        return ['图片生成']
    }
  }

  return {
    id: `image-custom-${uuid()}`,
    name: `自定义${typeNames[imageType]}助手`,
    emoji: typeEmojis[imageType],
    type: 'image',
    imageType,
    prompt: getSystemPromptForType(imageType),
    imageConfig: {
      imageSize: '2K',
      aspectRatio: getDefaultAspectRatio(),
      batchCount: 1,
      moduleConfig: getDefaultModuleConfig()
    },
    group: getDefaultGroup(),
    settings: DEFAULT_ASSISTANT_SETTINGS
  }
}

/**
 * 图片助手预设管理 Hook
 */
export function useImageAssistantPresets() {
  const storedPresets = useAppSelector((state) => state.assistants.imageAssistantPresets)
  const dispatch = useAppDispatch()

  // 如果存储的预设为空，初始化为内置预设
  useEffect(() => {
    if (!storedPresets || storedPresets.length === 0) {
      dispatch(setImageAssistantPresets(BUILTIN_IMAGE_ASSISTANT_PRESETS))
    }
  }, [storedPresets, dispatch])

  // 使用存储的预设或内置预设作为回退
  const presets = storedPresets && storedPresets.length > 0 ? storedPresets : BUILTIN_IMAGE_ASSISTANT_PRESETS

  /**
   * 从预设创建新的图片助手
   */
  const createAssistantFromPreset = (preset: ImageAssistantPreset): ImageAssistant => {
    const assistant = convertPresetToImageAssistant(preset)
    dispatch(addAssistant(assistant))
    return assistant
  }

  /**
   * 创建自定义图片助手
   */
  const createCustomAssistant = (imageType: ImageAssistantType, name?: string): ImageAssistant => {
    const preset = createEmptyImageAssistantPreset(imageType)
    if (name) {
      preset.name = name
    }
    const assistant = convertPresetToImageAssistant(preset)
    dispatch(addAssistant(assistant))
    return assistant
  }

  /**
   * 添加新的图片助手预设
   */
  const addPreset = (preset: ImageAssistantPreset) => {
    dispatch(addImageAssistantPreset(preset))
  }

  /**
   * 删除图片助手预设
   */
  const removePreset = (id: string) => {
    dispatch(removeImageAssistantPreset({ id }))
  }

  /**
   * 设置所有图片助手预设
   */
  const setPresets = (presets: ImageAssistantPreset[]) => {
    dispatch(setImageAssistantPresets(presets))
  }

  /**
   * 重置为内置预设
   */
  const resetToBuiltin = () => {
    dispatch(setImageAssistantPresets(BUILTIN_IMAGE_ASSISTANT_PRESETS))
  }

  return {
    presets,
    builtinPresets: BUILTIN_IMAGE_ASSISTANT_PRESETS,
    createAssistantFromPreset,
    createCustomAssistant,
    addPreset,
    removePreset,
    setPresets,
    resetToBuiltin
  }
}

/**
 * 获取指定 ID 的图片助手预设
 */
export function useImageAssistantPreset(id: string) {
  const { presets } = useImageAssistantPresets()
  return presets.find((p) => p.id === id)
}
