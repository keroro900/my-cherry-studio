/**
 * 模型能力检测配置
 *
 * 定义各图像生成模型支持的功能和限制
 * 用于动态调整 UI 和验证参数
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 模型能力定义
 */
export interface ModelCapabilities {
  // === 功能支持 ===
  supportsNegativePrompt: boolean
  supportsControlNet: boolean
  supportsLoRA: boolean
  supportsInpainting: boolean
  supportsUpscale: boolean
  supportsImg2Img: boolean
  supportsVariations: boolean

  // === 数量限制 ===
  maxBatchSize: number
  minBatchSize: number

  // === 分辨率限制 ===
  maxResolution: { width: number; height: number }
  minResolution: { width: number; height: number }
  supportedAspectRatios: string[]
  supportedSizes?: string[]

  // === 参数范围 ===
  stepsRange?: { min: number; max: number; default: number }
  guidanceScaleRange?: { min: number; max: number; default: number; step: number }
  seedRange?: { min: number; max: number }

  // === 特殊约束 ===
  customSizeConstraints?: {
    divisibleBy?: number
    maxPixels?: number
  }

  // === 语言支持 ===
  supportsChinesePrompt: boolean

  // === 质量选项 ===
  qualityOptions?: string[]

  // === 风格选项 ===
  styleOptions?: string[]
}

// ============================================================================
// 默认能力配置
// ============================================================================

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsNegativePrompt: true,
  supportsControlNet: false,
  supportsLoRA: false,
  supportsInpainting: false,
  supportsUpscale: false,
  supportsImg2Img: true,
  supportsVariations: false,
  maxBatchSize: 4,
  minBatchSize: 1,
  maxResolution: { width: 2048, height: 2048 },
  minResolution: { width: 256, height: 256 },
  supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  stepsRange: { min: 10, max: 50, default: 25 },
  guidanceScaleRange: { min: 1, max: 20, default: 7.5, step: 0.5 },
  seedRange: { min: 0, max: 999999999 },
  supportsChinesePrompt: false
}

// ============================================================================
// 模型能力配置映射
// ============================================================================

export const MODEL_CAPABILITIES: Record<string, Partial<ModelCapabilities>> = {
  // ==================== Google Gemini / Imagen ====================
  'gemini-image': {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 4,
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    supportsChinesePrompt: true
  },

  // ==================== OpenAI DALL-E 3 ====================
  'openai-dalle3': {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: false,
    maxBatchSize: 1,
    supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
    qualityOptions: ['standard', 'hd'],
    styleOptions: ['vivid', 'natural'],
    supportsChinesePrompt: true
  },

  // ==================== OpenAI DALL-E 2 ====================
  'openai-dalle2': {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: true,
    supportsUpscale: false,
    supportsImg2Img: true,
    supportsVariations: true,
    maxBatchSize: 10,
    supportedSizes: ['256x256', '512x512', '1024x1024'],
    supportsChinesePrompt: true
  },

  // ==================== OpenAI GPT Image ====================
  'openai-gpt-image': {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: true,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 10,
    supportedSizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
    qualityOptions: ['auto', 'high', 'medium', 'low'],
    supportsChinesePrompt: true
  },

  // ==================== Flux Pro ====================
  'flux-pro': {
    supportsNegativePrompt: false,
    supportsControlNet: true,
    supportsLoRA: true,
    supportsInpainting: true,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 1,
    supportedAspectRatios: ['1:1', '16:9', '9:16', '3:2', '2:3', '4:5', '5:4', '3:4', '4:3'],
    guidanceScaleRange: { min: 2, max: 5, default: 3, step: 0.1 },
    supportsChinesePrompt: false
  },

  // ==================== Flux Dev ====================
  'flux-dev': {
    supportsNegativePrompt: false,
    supportsControlNet: true,
    supportsLoRA: true,
    supportsInpainting: true,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 4,
    supportedAspectRatios: ['1:1', '16:9', '9:16', '21:9', '9:21', '3:2', '2:3', '4:5', '5:4', '3:4', '4:3'],
    stepsRange: { min: 1, max: 50, default: 28 },
    guidanceScaleRange: { min: 0, max: 10, default: 3.5, step: 0.5 },
    supportsChinesePrompt: false
  },

  // ==================== Flux Schnell ====================
  'flux-schnell': {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: false,
    maxBatchSize: 4,
    supportedAspectRatios: ['1:1', '16:9', '9:16', '21:9', '9:21', '3:2', '2:3', '4:5', '5:4', '3:4', '4:3'],
    stepsRange: { min: 1, max: 4, default: 4 },
    supportsChinesePrompt: false
  },

  // ==================== Stability AI SDXL ====================
  'stability-sdxl': {
    supportsNegativePrompt: true,
    supportsControlNet: true,
    supportsLoRA: true,
    supportsInpainting: true,
    supportsUpscale: true,
    supportsImg2Img: true,
    maxBatchSize: 10,
    supportedAspectRatios: ['1:1', '16:9', '9:16', '21:9', '9:21', '2:3', '3:2', '4:5', '5:4'],
    stepsRange: { min: 10, max: 50, default: 40 },
    guidanceScaleRange: { min: 0, max: 35, default: 7, step: 0.5 },
    supportsChinesePrompt: false
  },

  // ==================== Stability AI SD3 ====================
  'stability-sd3': {
    supportsNegativePrompt: true,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 10,
    stepsRange: { min: 10, max: 50, default: 30 },
    guidanceScaleRange: { min: 0, max: 35, default: 7, step: 0.5 },
    supportsChinesePrompt: false
  },

  // ==================== Midjourney ====================
  midjourney: {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: true,
    supportsImg2Img: true,
    supportsVariations: true,
    maxBatchSize: 4,
    supportedAspectRatios: ['1:1', '2:3', '3:2', '4:5', '5:4', '16:9', '9:16'],
    qualityOptions: ['0.25', '0.5', '1', '2'],
    styleOptions: ['', 'raw', 'scenic', 'expressive', 'cute'],
    supportsChinesePrompt: true
  },

  // ==================== 智谱 CogView-4 ====================
  'zhipu-cogview4': {
    supportsNegativePrompt: true,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: false,
    maxBatchSize: 4,
    supportedSizes: ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864'],
    qualityOptions: ['standard', 'hd'],
    customSizeConstraints: {
      divisibleBy: 16,
      maxPixels: 2097152
    },
    supportsChinesePrompt: true
  },

  // ==================== 智谱 CogView-3 ====================
  'zhipu-cogview3': {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: false,
    maxBatchSize: 4,
    supportedSizes: ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864'],
    supportsChinesePrompt: true
  },

  // ==================== 通义万相 Wanx ====================
  wanx: {
    supportsNegativePrompt: true,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 4,
    supportedSizes: ['1024*1024', '720*1280', '768*1152', '1280*720'],
    supportsChinesePrompt: true
  },

  // ==================== DMXAPI / Seedream ====================
  dmxapi: {
    supportsNegativePrompt: false,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 4,
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    supportsChinesePrompt: true
  },

  // ==================== SiliconFlow ====================
  siliconflow: {
    supportsNegativePrompt: true,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: true,
    maxBatchSize: 4,
    supportedSizes: ['512x512', '768x768', '1024x1024', '768x1024', '1024x768'],
    stepsRange: { min: 1, max: 50, default: 20 },
    guidanceScaleRange: { min: 1, max: 15, default: 7.5, step: 0.5 },
    supportsChinesePrompt: true
  },

  // ==================== OVMS 本地模型 ====================
  ovms: {
    supportsNegativePrompt: true,
    supportsControlNet: false,
    supportsLoRA: false,
    supportsInpainting: false,
    supportsUpscale: false,
    supportsImg2Img: false,
    maxBatchSize: 1,
    supportedSizes: ['512x512', '768x768', '1024x1024'],
    stepsRange: { min: 1, max: 100, default: 20 },
    supportsChinesePrompt: false
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 根据模型 ID 推断能力配置类型
 */
export function inferCapabilitiesType(modelId: string, providerId?: string): string {
  const lowerModelId = modelId.toLowerCase()
  const lowerProviderId = (providerId || '').toLowerCase()

  // Gemini / Imagen
  if (lowerModelId.includes('gemini') && lowerModelId.includes('image')) return 'gemini-image'
  if (lowerModelId.includes('imagen')) return 'gemini-image'

  // DALL-E 3
  if (lowerModelId.includes('dall-e-3') || lowerModelId === 'dalle-3') return 'openai-dalle3'

  // DALL-E 2
  if (lowerModelId.includes('dall-e-2') || lowerModelId === 'dalle-2') return 'openai-dalle2'

  // GPT Image
  if (lowerModelId.includes('gpt-image') || lowerModelId.includes('gpt-4-image')) return 'openai-gpt-image'

  // Flux 系列
  if (lowerModelId.includes('flux-pro') || lowerModelId.includes('flux-1.1-pro')) return 'flux-pro'
  if (lowerModelId.includes('flux-dev')) return 'flux-dev'
  if (lowerModelId.includes('flux-schnell') || lowerModelId.includes('flux-fast')) return 'flux-schnell'
  if (lowerModelId.includes('flux')) return 'flux-dev'

  // Stability AI
  if (lowerModelId.includes('sdxl') || lowerModelId.includes('stable-diffusion-xl')) return 'stability-sdxl'
  if (lowerModelId.includes('sd3') || lowerModelId.includes('stable-diffusion-3')) return 'stability-sd3'
  if (lowerModelId.includes('stability') || lowerModelId.includes('stable-diffusion')) return 'stability-sdxl'

  // Midjourney
  if (lowerModelId.includes('midjourney') || lowerModelId.includes('mj')) return 'midjourney'

  // 智谱 CogView
  if (lowerModelId.includes('cogview-4') || lowerModelId.includes('cogview4')) return 'zhipu-cogview4'
  if (lowerModelId.includes('cogview')) return 'zhipu-cogview3'
  if (lowerProviderId.includes('zhipu')) return 'zhipu-cogview4'

  // 通义万相
  if (lowerModelId.includes('wanx') || lowerModelId.includes('tongyi') || lowerModelId.includes('wanxiang'))
    return 'wanx'

  // DMXAPI
  if (lowerProviderId.includes('dmxapi') || lowerModelId.includes('seedream')) return 'dmxapi'

  // SiliconFlow
  if (lowerProviderId.includes('silicon') || lowerProviderId.includes('siliconflow')) return 'siliconflow'

  // OVMS
  if (lowerProviderId.includes('ovms')) return 'ovms'

  return 'default'
}

/**
 * 获取模型能力配置
 */
export function getModelCapabilities(modelId: string, providerId?: string): ModelCapabilities {
  const configType = inferCapabilitiesType(modelId, providerId)
  const specificCapabilities = MODEL_CAPABILITIES[configType] || {}

  return {
    ...DEFAULT_CAPABILITIES,
    ...specificCapabilities
  }
}

/**
 * 检查模型是否支持某个功能
 */
export function modelSupports(modelId: string, feature: keyof ModelCapabilities, providerId?: string): boolean {
  const capabilities = getModelCapabilities(modelId, providerId)
  return Boolean(capabilities[feature])
}

/**
 * 获取模型的参数范围
 */
export function getParameterRange(
  modelId: string,
  parameter: 'steps' | 'guidanceScale' | 'seed',
  providerId?: string
): { min: number; max: number; default?: number; step?: number } | null {
  const capabilities = getModelCapabilities(modelId, providerId)

  switch (parameter) {
    case 'steps':
      return capabilities.stepsRange || null
    case 'guidanceScale':
      return capabilities.guidanceScaleRange || null
    case 'seed':
      return capabilities.seedRange || null
    default:
      return null
  }
}

/**
 * 验证自定义尺寸
 */
export function validateCustomSize(
  modelId: string,
  width: number,
  height: number,
  providerId?: string
): { valid: boolean; error?: string } {
  const capabilities = getModelCapabilities(modelId, providerId)
  const { maxResolution, minResolution, customSizeConstraints } = capabilities

  // 检查最小分辨率
  if (width < minResolution.width || height < minResolution.height) {
    return {
      valid: false,
      error: `尺寸不能小于 ${minResolution.width}x${minResolution.height}`
    }
  }

  // 检查最大分辨率
  if (width > maxResolution.width || height > maxResolution.height) {
    return {
      valid: false,
      error: `尺寸不能大于 ${maxResolution.width}x${maxResolution.height}`
    }
  }

  // 检查自定义约束
  if (customSizeConstraints) {
    const { divisibleBy, maxPixels } = customSizeConstraints

    if (divisibleBy && (width % divisibleBy !== 0 || height % divisibleBy !== 0)) {
      return {
        valid: false,
        error: `尺寸必须能被 ${divisibleBy} 整除`
      }
    }

    if (maxPixels && width * height > maxPixels) {
      return {
        valid: false,
        error: `总像素数不能超过 ${maxPixels.toLocaleString()}`
      }
    }
  }

  return { valid: true }
}
