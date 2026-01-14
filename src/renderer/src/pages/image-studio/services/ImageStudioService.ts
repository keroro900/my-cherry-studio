/**
 * Image Studio 服务
 *
 * 封装图片生成逻辑，使用 ImageGenerationService（与工作流保持一致）
 * 参数传递方式与工作流对齐：
 * - image_size: 直接传递原始值如 "2K"
 * - aspect_ratio: 直接传递如 "3:4"
 */

import { loggerService } from '@logger'
import { type ImageGenerationParams, ImageGenerationService } from '@renderer/services/ImageGenerationService'
import store from '@renderer/store'
import type { Model, Provider } from '@renderer/types'

import type { EcomModuleConfig, ModelModuleConfig, PatternModuleConfig, StudioModule } from '../types'

const logger = loggerService.withContext('ImageStudioService')

export interface GenerateOptions {
  module: StudioModule
  config: EcomModuleConfig | ModelModuleConfig | PatternModuleConfig
  inputs: {
    images: string[]
    prompt?: string
  }
  providerId: string
  modelId: string
  // 通用图片生成参数（与工作流保持一致）
  imageSize?: '1K' | '2K' | '4K'
  aspectRatio?: string
  batchCount?: number
}

export interface GenerateResult {
  success: boolean
  outputs?: {
    image?: string
    images?: string[]
    mainImage?: string
    backImage?: string
    detailImages?: string[]
    modelImage?: string
    patternImage?: string
    seamlessImage?: string
    graphicImage?: string
  }
  error?: string
}

export interface ProgressCallback {
  (progress: { current: number; total: number; step: string }): void
}

/**
 * 获取 provider 通过 providerId
 */
function getProviderById(providerId: string): Provider | undefined {
  const state = store.getState()
  return state.llm.providers.find((p) => p.id === providerId)
}

/**
 * 获取 model 通过 providerId 和 modelId
 */
function getModelById(providerId: string, modelId: string): Model | undefined {
  const provider = getProviderById(providerId)
  return provider?.models.find((m) => m.id === modelId)
}

/**
 * 获取图片尺寸的像素值（与工作流保持一致）
 */
function getImageSizeValue(imageSize: '1K' | '2K' | '4K'): string {
  const sizeMap: Record<string, string> = {
    '1K': '1024x1024',
    '2K': '2048x2048',
    '4K': '4096x4096'
  }
  return sizeMap[imageSize] || '1024x1024'
}

/**
 * 构建生成提示词
 */
function buildGenerationPrompt(
  module: StudioModule,
  config: EcomModuleConfig | ModelModuleConfig | PatternModuleConfig,
  userPrompt?: string
): string {
  const parts: string[] = []

  switch (module) {
    case 'ecom': {
      const ecomConfig = config as EcomModuleConfig
      parts.push('Generate a professional e-commerce product photo.')
      if (ecomConfig.layout) {
        const layouts: Record<string, string> = {
          flat_lay: 'Use flat lay photography style.',
          model_shot: 'Show the product on a model.',
          hanging: 'Show the product in hanging display.',
          none: 'Show the product only.'
        }
        parts.push(layouts[ecomConfig.layout] || '')
      }
      if (ecomConfig.stylePreset && ecomConfig.stylePreset !== 'auto') {
        parts.push(`Style: ${ecomConfig.stylePreset}`)
      }
      if (ecomConfig.garmentDescription) {
        parts.push(`Product: ${ecomConfig.garmentDescription}`)
      }
      break
    }
    case 'model': {
      const modelConfig = config as ModelModuleConfig
      parts.push('Generate a fashion model photo wearing the provided garment.')
      if (modelConfig.gender) {
        parts.push(`Model gender: ${modelConfig.gender}`)
      }
      if (modelConfig.ageGroup) {
        const ages: Record<string, string> = {
          small_kid: 'young child',
          big_kid: 'teenager',
          adult: 'adult'
        }
        parts.push(`Model age: ${ages[modelConfig.ageGroup] || modelConfig.ageGroup}`)
      }
      if (modelConfig.scenePreset) {
        parts.push(`Scene: ${modelConfig.scenePreset}`)
      }
      if (modelConfig.poseStyle) {
        parts.push(`Pose: ${modelConfig.poseStyle}`)
      }
      break
    }
    case 'pattern': {
      const patternConfig = config as PatternModuleConfig
      parts.push('Generate a seamless pattern design.')
      if (patternConfig.patternType) {
        parts.push(`Pattern type: ${patternConfig.patternType}`)
      }
      if (patternConfig.density) {
        parts.push(`Pattern density: ${patternConfig.density}`)
      }
      if (patternConfig.colorTone && patternConfig.colorTone !== 'auto') {
        parts.push(`Color tone: ${patternConfig.colorTone}`)
      }
      if (patternConfig.designPrompt) {
        parts.push(`Design: ${patternConfig.designPrompt}`)
      }
      if (patternConfig.colorPrompt) {
        parts.push(`Colors: ${patternConfig.colorPrompt}`)
      }
      break
    }
  }

  if (userPrompt) {
    parts.push(`User request: ${userPrompt}`)
  }

  return parts.filter(Boolean).join('\n')
}

class ImageStudioService {
  private static instance: ImageStudioService

  private constructor() {}

  static getInstance(): ImageStudioService {
    if (!ImageStudioService.instance) {
      ImageStudioService.instance = new ImageStudioService()
    }
    return ImageStudioService.instance
  }

  /**
   * 生成图片（统一入口）
   *
   * 使用 ImageGenerationService，参数传递方式与工作流保持一致：
   * - image_size: 直接传递原始值如 "2K"
   * - aspect_ratio: 直接传递如 "3:4"
   * - size: 传递像素值如 "2048x2048"
   */
  async generate(
    options: GenerateOptions,
    onProgress: ProgressCallback,
    abortSignal: AbortSignal
  ): Promise<GenerateResult> {
    const { module, config, inputs, providerId, modelId, imageSize, aspectRatio, batchCount } = options

    try {
      onProgress({ current: 0, total: 100, step: '准备生成...' })

      // 获取 provider 和 model
      const provider = getProviderById(providerId)
      const model = getModelById(providerId, modelId)

      if (!provider) {
        return { success: false, error: '未找到服务提供商，请在设置中配置' }
      }

      if (!model) {
        return { success: false, error: '未找到模型，请选择一个模型' }
      }

      onProgress({ current: 10, total: 100, step: '构建请求参数...' })

      // 构建提示词
      const prompt = buildGenerationPrompt(module, config, inputs.prompt)

      // 构建图片生成参数（与工作流保持一致）
      // 关键：同时传递 image_size（原始值如 "2K"）和 size（像素值如 "2048x2048"）
      const serviceParams: ImageGenerationParams = {
        model: modelId,
        prompt,
        n: batchCount || 1,
        response_format: 'b64_json'
      }

      // 设置图片尺寸 - 关键：同时传递 image_size 和 size（与工作流保持一致）
      if (imageSize) {
        serviceParams.image_size = imageSize // 原始值如 "2K"
        serviceParams.size = getImageSizeValue(imageSize) // 像素值如 "2048x2048"
      }

      // 设置宽高比（直接传递，如 "1:1", "3:4", "16:9"）
      if (aspectRatio) {
        serviceParams.aspect_ratio = aspectRatio
      }

      // 添加参考图片
      if (inputs.images && inputs.images.length > 0) {
        serviceParams.image = inputs.images[0]
        serviceParams.reference_images = inputs.images
      }

      logger.debug('ImageStudioService - 生成参数', {
        module,
        imageSize,
        aspectRatio,
        image_size: serviceParams.image_size,
        size: serviceParams.size,
        aspect_ratio: serviceParams.aspect_ratio,
        hasReferenceImages: inputs.images?.length > 0
      })

      onProgress({ current: 20, total: 100, step: '调用图片生成服务...' })

      // 使用 ImageGenerationService 进行图片生成（与工作流保持一致）
      const imageService = new ImageGenerationService(provider, model)
      const result = await imageService.generate(serviceParams, { signal: abortSignal })

      if (abortSignal.aborted) {
        return { success: false, error: 'cancelled' }
      }

      if (!result.success || result.images.length === 0) {
        return { success: false, error: result.error || '图片生成失败' }
      }

      onProgress({ current: 90, total: 100, step: '处理输出结果...' })

      // 根据模块类型处理输出
      const outputs = this.processOutputs(module, result.images)

      onProgress({ current: 100, total: 100, step: '完成' })

      return {
        success: true,
        outputs
      }
    } catch (error: any) {
      logger.error('ImageStudioService - 生成失败', error)
      return { success: false, error: error.message || '生成失败' }
    }
  }

  /**
   * 根据模块类型处理输出
   */
  private processOutputs(module: StudioModule, images: string[]): GenerateResult['outputs'] {
    // 确保所有图片都是完整的 data URL
    const processedImages = images.map((img) => {
      if (img.startsWith('data:')) {
        return img
      }
      if (img.startsWith('http://') || img.startsWith('https://')) {
        return img
      }
      return `data:image/png;base64,${img}`
    })

    switch (module) {
      case 'ecom':
        return {
          mainImage: processedImages[0],
          backImage: processedImages[1],
          detailImages: processedImages.slice(2),
          images: processedImages
        }
      case 'model':
        return {
          modelImage: processedImages[0],
          images: processedImages
        }
      case 'pattern':
        return {
          patternImage: processedImages[0],
          seamlessImage: processedImages[1],
          images: processedImages
        }
      default:
        return {
          image: processedImages[0],
          images: processedImages
        }
    }
  }

  /**
   * 局部编辑
   */
  async localEdit(
    baseImage: string,
    _mask: string,
    editPrompt: string,
    providerId: string,
    modelId: string,
    onProgress: ProgressCallback,
    abortSignal: AbortSignal
  ): Promise<GenerateResult> {
    try {
      onProgress({ current: 0, total: 100, step: '准备编辑...' })

      const provider = getProviderById(providerId)
      const model = getModelById(providerId, modelId)

      if (!provider || !model) {
        return { success: false, error: '未找到服务提供商或模型' }
      }

      onProgress({ current: 10, total: 100, step: '构建编辑请求...' })

      // 构建编辑参数
      const serviceParams: ImageGenerationParams = {
        model: modelId,
        prompt: editPrompt,
        image: baseImage,
        reference_images: [baseImage],
        n: 1,
        response_format: 'b64_json'
      }

      onProgress({ current: 20, total: 100, step: '调用编辑服务...' })

      const imageService = new ImageGenerationService(provider, model)
      const result = await imageService.generate(serviceParams, { signal: abortSignal })

      if (abortSignal.aborted) {
        return { success: false, error: 'cancelled' }
      }

      if (!result.success || result.images.length === 0) {
        return { success: false, error: result.error || '编辑失败' }
      }

      onProgress({ current: 100, total: 100, step: '完成' })

      return {
        success: true,
        outputs: {
          image: result.images[0]
        }
      }
    } catch (error: any) {
      logger.error('ImageStudioService - 编辑失败', error)
      return { success: false, error: error.message || '编辑失败' }
    }
  }
}

export const imageStudioService = ImageStudioService.getInstance()
export default imageStudioService
