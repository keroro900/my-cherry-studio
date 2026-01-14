/**
 * 统一的模型路由判断模块
 *
 * 由 ImageGenerationService 和 WorkflowAiService 共同复用
 *
 * 核心设计原则：
 * - 中转站会自己处理格式转换，我们只需要确保参数正确传递
 * - Gemini 图像模型使用原生 API 格式（generationConfig.imageConfig）
 * - 非 Gemini 模型使用 OpenAI Images API 格式
 */

import { isDedicatedImageGenerationModel } from '@renderer/config/models'
import type { Assistant, Model, Provider } from '@renderer/types'
import { isImageAssistant } from '@renderer/types'

/**
 * 支持 Gemini 原生格式的 API Host 列表
 *
 * 注意：此列表主要用于 canFallbackToGemini 和 supportsGeminiNative 方法
 * 实际路由决策已简化为基于模型类型判断，不再依赖此列表
 */
export const GEMINI_NATIVE_HOSTS = [
  'generativelanguage.googleapis.com',
  'googleapis.com',
  'cherryin.ai',
  'cherryin.net',
  't8star.cn',
  'comfly.chat',
  'aihubmix.com',
  'newapi.ai'
] as const

/**
 * 图像生成 API 格式
 */
export type ImageGenerationFormat = 'gemini-native' | 'openai-images'

/**
 * 模型路由器
 * 提供统一的模型路由判断接口
 */
export class ModelRouter {
  /**
   * 判断 API Host 是否支持 Gemini 原生格式
   *
   * @param apiHost Provider 的 apiHost 配置
   * @returns 是否支持 Gemini 原生格式
   */
  static supportsGeminiNative(apiHost: string | undefined): boolean {
    if (!apiHost) {
      // 没有配置 apiHost，假设使用 Google 官方 API
      return true
    }

    return GEMINI_NATIVE_HOSTS.some((host) => apiHost.includes(host))
  }

  /**
   * 判断 Provider 是否为 Gemini Provider
   *
   * 条件：
   * 1. API Host 支持 Gemini 原生格式
   * 2. Provider ID 或类型为 'gemini'
   *
   * @param provider Provider 配置
   * @returns 是否为 Gemini Provider
   */
  static isGeminiProvider(provider: Provider): boolean {
    const supportsNative = this.supportsGeminiNative(provider.apiHost)

    return supportsNative && (provider.id === 'gemini' || provider.type === 'gemini')
  }

  /**
   * 判断 Model 是否为 Gemini 图像模型
   *
   * 判断依据：
   * 1. endpoint_type 为 'gemini-image' 或 'gemini-image-edit'
   * 2. 模型 ID 包含 'gemini' 和 'image' 关键词
   *
   * @param model Model 配置
   * @returns 是否为 Gemini 图像模型
   */
  static isGeminiImageModel(model: Model): boolean {
    const endpointType = (model as Record<string, unknown>).endpoint_type as string | undefined

    if (endpointType === 'gemini-image' || endpointType === 'gemini-image-edit') {
      return true
    }

    // 检查模型 ID 中是否包含 gemini 和 image 关键词
    const modelIdLower = model.id.toLowerCase()
    return modelIdLower.includes('gemini') && modelIdLower.includes('image')
  }

  /**
   * 判断是否可以回退到 Gemini 原生 API
   *
   * 用于当主要 API 格式失败时，判断是否可以尝试 Gemini 原生格式
   *
   * @param provider Provider 配置
   * @returns 是否可以回退到 Gemini 原生 API
   */
  static canFallbackToGemini(provider: Provider): boolean {
    return this.supportsGeminiNative(provider.apiHost)
  }

  /**
   * 判断是否需要使用 Gemini 原生 API
   *
   * 简化后的通用逻辑：
   * - 只要是 Gemini 图像模型（通过 endpoint_type 或模型名称判断），就使用 Gemini 原生 API
   * - 中转站会自己处理格式转换，我们只需要确保参数（imageSize, aspectRatio）正确传递
   * - Gemini 原生 API 使用 generationConfig.imageConfig 传递这些参数
   *
   * @param provider Provider 配置
   * @param model Model 配置
   * @param _hasMultipleImages 是否有多图输入（保留参数以保持 API 兼容性，但不再作为判断条件）
   * @returns 是否需要使用 Gemini 原生 API
   */
  static needsGeminiNative(provider: Provider, model: Model, _hasMultipleImages: boolean = false): boolean {
    // 简化逻辑：只要是 Gemini 图像模型，就使用原生 API 格式
    // 这样可以确保 imageSize 和 aspectRatio 通过 generationConfig.imageConfig 正确传递
    // 中转站会自己处理格式转换，我们不需要为每个代理商单独适配

    // 1. 检查 endpoint_type 是否明确为 Gemini 图像类型
    const endpointType = (model as Record<string, unknown>).endpoint_type as string | undefined
    if (endpointType === 'gemini-image' || endpointType === 'gemini-image-edit') {
      return true
    }

    // 2. 检查模型 ID 是否包含 gemini 和 image 关键词
    if (this.isGeminiImageModel(model)) {
      return true
    }

    // 3. 如果是 Gemini Provider 且模型名称包含 image
    if (this.isGeminiProvider(provider) && model.id.toLowerCase().includes('image')) {
      return true
    }

    return false
  }

  /**
   * 构造临时模型对象
   *
   * 用于支持用户手动输入的模型 ID（API 直接支持但未在 UI 列表中显示的模型）
   *
   * @param modelId 模型 ID
   * @param providerId Provider ID
   * @param options 可选配置
   * @returns 构造的临时 Model 对象
   */
  static constructTemporaryModel(
    modelId: string,
    providerId: string,
    options?: { endpointType?: string; group?: string }
  ): Model {
    const model: Model = {
      id: modelId,
      name: modelId,
      provider: providerId,
      group: options?.group || 'default'
    }

    // 如果指定了 endpointType，添加到模型配置
    if (options?.endpointType) {
      ;(model as Record<string, unknown>).endpoint_type = options.endpointType
    }

    return model
  }

  /**
   * 获取图像生成的推荐 API 格式
   *
   * 简化后的通用逻辑：
   * - Gemini 图像模型 -> 使用 Gemini 原生格式（确保 imageSize/aspectRatio 正确传递）
   * - 其他模型 -> 使用 OpenAI Images API
   *
   * @param provider Provider 配置
   * @param model Model 配置
   * @returns 推荐的 API 格式
   */
  static getImageGenerationFormat(provider: Provider, model: Model): ImageGenerationFormat {
    // 使用统一的判断逻辑
    if (this.needsGeminiNative(provider, model)) {
      return 'gemini-native'
    }

    // 默认使用 OpenAI Images API
    return 'openai-images'
  }

  // ==================== 统一模型判断方法 ====================

  /**
   * 判断是否为图片生成模型
   *
   * 统一入口：整合 Gemini 图像模型和专用图片生成模型的判断
   *
   * @param model Model 配置
   * @returns 是否为图片生成模型
   */
  static isImageGenerationModel(model: Model): boolean {
    // 1. 检查是否为 Gemini 图像模型
    if (this.isGeminiImageModel(model)) {
      return true
    }

    // 2. 检查是否为专用图片生成模型（DALL-E, GPT-Image, Imagen 等）
    if (isDedicatedImageGenerationModel(model)) {
      return true
    }

    return false
  }

  /**
   * 判断是否应该走图片生成路径
   *
   * 统一入口：供 ImageGenerationMiddleware 等调用
   * 整合了 isImageAssistant 和模型类型判断
   *
   * @param assistant 助手配置
   * @param model 模型配置（可选，默认使用 assistant.model）
   * @returns 是否应该使用图片生成路径
   */
  static shouldUseImageGeneration(assistant: Assistant, model?: Model): boolean {
    // 1. 如果是图片助手类型，一定走图片生成路径
    if (isImageAssistant(assistant)) {
      return true
    }

    // 2. 检查模型是否为图片生成模型
    const targetModel = model || assistant.model
    if (targetModel && this.isImageGenerationModel(targetModel)) {
      return true
    }

    return false
  }
}
