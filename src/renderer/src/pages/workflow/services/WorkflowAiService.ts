/**
 * 工作流 AI 服务
 *
 * 复用 Cherry Studio 原生的 ApiService 进行 AI 调用
 * 支持文本生成、视觉分析、图片生成等功能
 *
 * **Feature: image-ref-optimization**
 * 支持 ImageRef 图片引用类型，在 API 请求前才解析为 Base64
 */

import { loggerService } from '@logger'
import { ModelRouter } from '@renderer/aiCore/routing'
import { fetchChatCompletion, fetchGenerate } from '@renderer/services/ApiService'
import { getProviderByModelId } from '@renderer/services/AssistantService'
import {
  type ImageGenerationParams as ServiceImageParams,
  ImageGenerationService
} from '@renderer/services/ImageGenerationService'
import store from '@renderer/store'
import type { Assistant, Model, Provider } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'
import { uuid } from '@renderer/utils'
// 导入 Cherry Studio 底层图片压缩工具（使用 AI 视觉分析专用版本，保持高质量）
import { compressImageForVision } from '@renderer/utils/image'
import type { ImagePart, TextPart, UserModelMessage } from 'ai'
import { NoOutputGeneratedError } from 'ai'

// 导入 ImageRef 相关类型和工具
import { type ImageData, type ImageRef, isImageRef } from '../types/core'

// ============================================================================
// 图片压缩常量（对齐 Cherry Studio 底层逻辑）
// ============================================================================

/** 视觉分析场景的最大图片大小（4MB，留有余量，API 限制 5MB） */
const VISION_MAX_SIZE_BYTES = 4 * 1024 * 1024

// 调试模式：开发环境启用详细日志，生产环境仅输出警告和错误
const DEBUG_MODE = process.env.NODE_ENV === 'development'

const baseLogger = loggerService.withContext('WorkflowAiService')

// 包装 logger，根据 DEBUG_MODE 控制 info/debug 级别日志
const logger = {
  debug: DEBUG_MODE
    ? baseLogger.debug.bind(baseLogger)
    : () => {
        /* 生产环境静默 */
      },
  info: DEBUG_MODE
    ? baseLogger.info.bind(baseLogger)
    : () => {
        /* 生产环境静默 */
      },
  warn: baseLogger.warn.bind(baseLogger),
  error: baseLogger.error.bind(baseLogger)
}

/**
 * 文本生成参数
 */
export interface TextGenerationParams {
  systemPrompt?: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}

/**
 * 视觉分析参数
 */
export interface VisionAnalysisParams {
  systemPrompt: string
  userPrompt: string
  images: string[] // base64 编码的图片
  temperature?: number
  signal?: AbortSignal // 用于取消请求的信号
  timeout?: number // 请求超时时间（毫秒），默认 10 分钟
}

/**
 * 图片生成参数
 */
export interface ImageGenerationParams {
  prompt: string
  negativePrompt?: string
  size?: string
  aspectRatio?: string
  numberOfImages?: number
}

/**
 * Gemini generateContent 图片生成参数
 * 支持多图片输入，用于图片编辑和服装换模特等场景
 *
 * @note Gemini 3 Pro Image 支持 system_instruction 参数
 * 参考: model = GenerativeModel("gemini-3-pro-image-preview", system_instruction=[...])
 */
export interface GeminiImageGenerationParams {
  prompt: string
  systemPrompt?: string // 系统提示词，用于设置 AI 角色和规则约束
  negativePrompt?: string
  images?: string[] // base64 编码的输入图片
  aspectRatio?: string // "1:1", "16:9", "9:16", "4:3", "3:4"
  imageSize?: string // "1K", "2K", "4K"
  temperature?: number
  seed?: number // 可选的随机种子值
  signal?: AbortSignal // 用于取消请求的信号
}

/**
 * 工作流 AI 服务
 * 封装 Cherry Studio 的 aiCore，提供工作流节点使用的 AI 调用接口
 */
export class WorkflowAiService {
  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  /**
   * 使用 AssistantService 统一接口获取 Provider 和 Model
   */
  static getProviderAndModelUnified(
    providerId: string,
    modelId: string
  ): { provider: Provider | undefined; model: Model | undefined } {
    try {
      // 优先通过 modelId 获取 provider（AssistantService 推荐方式）
      const providerByModel = getProviderByModelId(modelId)

      if (providerByModel) {
        const model = providerByModel.models?.find((m) => m.id === modelId)
        return { provider: providerByModel, model }
      }

      // 如果通过 modelId 找不到，回退到通过 providerId 查找
      const state = store.getState()
      const provider = state.llm.providers.find((p) => p.id === providerId)
      const model = provider?.models?.find((m) => m.id === modelId)

      logger.debug('[WorkflowAiService] 使用回退方案获取 Provider/Model', {
        providerId,
        modelId,
        foundProvider: !!provider,
        foundModel: !!model
      })

      return { provider, model }
    } catch (error) {
      logger.error('[WorkflowAiService] 获取 Provider/Model 失败', {
        providerId,
        modelId,
        error: error instanceof Error ? error.message : String(error)
      })
      return { provider: undefined, model: undefined }
    }
  }

  /**
   * 获取所有启用的 Provider
   */
  static getEnabledProviders(): Provider[] {
    const state = store.getState()
    return state.llm.providers.filter((p) => p.enabled !== false)
  }

  /**
   * 查找模型（跟随 Cherry 客户端原生逻辑）
   * 不做任何过滤，用户选择什么模型就用什么模型
   *
   * @param providerId Provider ID
   * @param modelId Model ID
   * @returns Provider 和 Model 组合，或 null
   */
  static async findModel(providerId?: string, modelId?: string): Promise<{ provider: Provider; model: Model } | null> {
    const providers = this.getEnabledProviders()

    logger.info('[WorkflowAiService] findModel 开始查找', {
      providerId,
      modelId,
      enabledProviderCount: providers.length,
      availableProviderIds: providers.map((p) => p.id)
    })

    // 必须指定 Provider 和 Model
    if (!providerId || !modelId) {
      logger.warn('[WorkflowAiService] 未指定模型，请在节点配置中选择模型')
      return null
    }

    // 1. 先在 provider.models 中查找
    const provider = providers.find((p) => p.id === providerId && p.enabled !== false)
    if (provider) {
      // 打印完整的 Provider 配置用于调试
      logger.info('[WorkflowAiService] 找到 Provider', {
        id: provider.id,
        type: provider.type,
        apiHost: provider.apiHost,
        hasApiKey: !!provider.apiKey,
        apiKeyPrefix: provider.apiKey?.substring(0, 8) + '...',
        modelCount: provider.models?.length || 0
      })

      const model = provider.models?.find((m) => m.id === modelId)
      if (model) {
        logger.info('[WorkflowAiService] 在 provider.models 中找到模型', {
          providerId: provider.id,
          modelId: model.id,
          modelProvider: model.provider
        })
        return { provider, model }
      }

      // 2. provider.models 中没有模型，但用户明确指定了 Provider
      // 不要回退到其他 Provider，直接构造临时 Model 对象
      // 这样可以支持用户手动输入的模型 ID（如 API 直接支持的模型）
      logger.info('[WorkflowAiService] provider.models 中未找到模型，构造临时 Model 对象', {
        providerId: provider.id,
        providerApiHost: provider.apiHost,
        modelId
      })
      const constructedModel = ModelRouter.constructTemporaryModel(modelId, provider.id)
      return { provider, model: constructedModel }
    }

    // 4. Provider 找不到，尝试全局查找 modelId
    const globalProviderByModel = getProviderByModelId(modelId)
    if (globalProviderByModel) {
      const modelFromGlobal = globalProviderByModel.models?.find((m) => m.id === modelId)
      if (modelFromGlobal) {
        logger.debug('[WorkflowAiService] 全局查找找到模型', {
          providerId: globalProviderByModel.id,
          modelId: modelFromGlobal.id
        })
        return { provider: globalProviderByModel, model: modelFromGlobal }
      }
    }

    logger.warn('[WorkflowAiService] 指定的 Provider/Model 组合无法找到', {
      providerId,
      modelId
    })
    return null
  }

  /**
   * 文本生成
   * 复用原生 ApiService.fetchGenerate 进行简单的文本生成
   */
  static async generateText(provider: Provider, model: Model, params: TextGenerationParams): Promise<string> {
    logger.info('[WorkflowAiService] generateText', {
      providerId: provider.id,
      modelId: model.id,
      promptLength: params.userPrompt.length,
      hasSystemPrompt: !!params.systemPrompt
    })

    try {
      const result = await fetchGenerate({
        prompt: params.systemPrompt || '',
        content: params.userPrompt,
        model: model
      })

      logger.info('[WorkflowAiService] generateText completed', {
        resultLength: result.length
      })

      return result
    } catch (error) {
      const errorMessage = this.getErrorMessage(error)
      logger.error('[WorkflowAiService] generateText failed', {
        error: errorMessage
      })
      throw error
    }
  }

  /**
   * 视觉分析
   * 复用原生 ApiService.fetchChatCompletion 进行视觉分析
   *
   * 直接构建 AI SDK 格式的 ModelMessage，包含文本和图片部分，
   * 完全复用 Cherry Studio 原生的 AI 调用链路。
   */
  static async visionAnalysis(provider: Provider, model: Model, params: VisionAnalysisParams): Promise<string> {
    logger.info('[WorkflowAiService] visionAnalysis 开始', {
      providerId: provider.id,
      modelId: model.id,
      imageCount: params.images.length,
      systemPromptLength: params.systemPrompt.length,
      userPromptLength: params.userPrompt.length
    })

    // 验证 Provider 配置
    if (!provider.apiKey) {
      logger.error('[WorkflowAiService] Provider 缺少 apiKey', { providerId: provider.id })
      throw new Error(`Provider ${provider.id} 缺少 API Key 配置`)
    }

    let resultText = ''

    // 1. 构建 Assistant（复用原生类型）
    const assistant: Assistant = {
      id: `workflow-${uuid()}`,
      name: 'Workflow Assistant',
      prompt: params.systemPrompt,
      model: model,
      type: 'assistant',
      topics: [],
      settings: {
        temperature: params.temperature ?? 0.7,
        streamOutput: false,
        reasoning_effort: undefined // 工作流节点不使用思考模式
      }
    }

    // 2. 构建 ModelMessage（AI SDK 格式）
    // 使用 UserModelMessage 类型，包含文本和图片部分
    const contentParts: (TextPart | ImagePart)[] = [{ type: 'text', text: params.userPrompt }]

    // 添加图片部分
    for (const imageBase64 of params.images) {
      if (imageBase64) {
        // 确保是纯 base64（不含 data: 前缀）
        let pureBase64: string
        let mimeType = 'image/jpeg'

        if (imageBase64.startsWith('data:')) {
          const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
          if (matches) {
            mimeType = matches[1]
            pureBase64 = matches[2]
          } else {
            pureBase64 = imageBase64.split(',')[1] || imageBase64
          }
        } else {
          pureBase64 = imageBase64
        }

        contentParts.push({
          type: 'image',
          image: pureBase64,
          mediaType: mimeType
        } as ImagePart)
      }
    }

    const messages: UserModelMessage[] = [
      {
        role: 'user',
        content: contentParts
      }
    ]

    logger.info('[WorkflowAiService] visionAnalysis 构造消息', {
      contentPartsCount: contentParts.length,
      textPartsCount: contentParts.filter((p) => p.type === 'text').length,
      imagePartsCount: contentParts.filter((p) => p.type === 'image').length
    })

    // 调试日志：确认系统提示词内容
    logger.info('[WorkflowAiService] visionAnalysis 系统提示词', {
      assistantPromptLength: assistant.prompt?.length || 0,
      assistantPromptPreview: assistant.prompt?.substring(0, 200) + '...',
      hasJsonConstraints: assistant.prompt?.includes('JSON') || false,
      hasOutputConstraints: assistant.prompt?.includes('直接以 { 开头') || false
    })

    try {
      // 3. 调用原生 API
      // 设置超时：默认 10 分钟（与聊天界面保持一致），避免网络连接过早关闭
      const DEFAULT_TIMEOUT = 10 * 60 * 1000 // 10 分钟
      const timeout = params.timeout ?? DEFAULT_TIMEOUT

      // 构建请求选项
      const requestOptions: {
        signal?: AbortSignal
        timeout?: number
      } = {
        timeout
      }

      // 如果提供了外部信号，创建组合的 AbortSignal
      if (params.signal) {
        // 组合外部取消信号和超时信号
        const timeoutController = new AbortController()
        const timeoutId = setTimeout(() => timeoutController.abort(), timeout)

        // 监听外部信号
        if (params.signal.aborted) {
          clearTimeout(timeoutId)
          throw new DOMException('请求已取消', 'AbortError')
        }

        params.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeoutId)
            timeoutController.abort()
          },
          { once: true }
        )

        requestOptions.signal = timeoutController.signal
      }

      logger.info('[WorkflowAiService] visionAnalysis 调用 fetchChatCompletion', {
        timeout,
        hasSignal: !!params.signal
      })

      // 调用 API
      // fetchChatCompletion 不返回值，文本通过 onChunkReceived 回调收集
      // 监听多种 chunk 类型以确保捕获所有可能的文本输出
      const receivedChunkTypes: string[] = [] // 调试用：记录收到的所有 chunk 类型
      await fetchChatCompletion({
        messages,
        assistant,
        requestOptions,
        onChunkReceived: (chunk) => {
          // 调试日志：记录每个收到的 chunk 类型
          if (!receivedChunkTypes.includes(chunk.type)) {
            receivedChunkTypes.push(chunk.type)
          }

          // 1. 流式文本增量（最常见）
          if (chunk.type === ChunkType.TEXT_DELTA) {
            resultText += chunk.text || ''
          }
          // 2. 文本完成事件（包含完整文本）
          if (chunk.type === ChunkType.TEXT_COMPLETE) {
            const textCompleteChunk = chunk as { text?: string }
            if (textCompleteChunk.text) {
              // TEXT_COMPLETE 包含完整文本，直接替换
              resultText = textCompleteChunk.text
            }
          }
          // 3. LLM 响应完成（非流式模式可能在此返回文本）
          if (chunk.type === ChunkType.LLM_RESPONSE_COMPLETE) {
            const responseChunk = chunk as { response?: { text?: string } }
            if (responseChunk.response?.text && !resultText) {
              resultText = responseChunk.response.text
              logger.info('[WorkflowAiService] 从 LLM_RESPONSE_COMPLETE 获取文本', {
                resultLength: resultText.length
              })
            }
          }
          // 4. 块完成事件（最终备用）
          if (chunk.type === ChunkType.BLOCK_COMPLETE) {
            const blockChunk = chunk as { response?: { text?: string } }
            if (blockChunk.response?.text && !resultText) {
              resultText = blockChunk.response.text
              logger.info('[WorkflowAiService] 从 BLOCK_COMPLETE 获取文本', {
                resultLength: resultText.length
              })
            }
          }
        }
      })

      logger.info('[WorkflowAiService] visionAnalysis completed', {
        resultLength: resultText.length,
        receivedChunkTypes: receivedChunkTypes.join(', ')
      })

      // 检查是否有输出
      if (!resultText || resultText.trim().length === 0) {
        throw new Error('模型未生成任何输出，请检查提示词或尝试其他模型')
      }

      return resultText
    } catch (error) {
      // 处理 AI SDK 的 NoOutputGeneratedError
      if (NoOutputGeneratedError.isInstance(error)) {
        logger.error('[WorkflowAiService] visionAnalysis 无输出', {
          error: '模型未生成任何输出'
        })
        throw new Error('模型未生成任何输出。可能原因：1) 内容被安全过滤 2) 模型不支持此类请求 3) 请尝试其他模型')
      }

      const errorMessage = this.getErrorMessage(error)
      logger.error('[WorkflowAiService] visionAnalysis failed', {
        error: errorMessage
      })
      throw error
    }
  }

  /**
   * 查找支持 Gemini 图片生成的 Provider 和 Model
   * 优先查找 endpoint_type 为 'gemini-image' 的模型
   *
   * 改进的查找逻辑：
   * 1. 优先使用用户指定的 providerId/modelId 组合
   * 2. 如果在 provider.models 中找不到，尝试通过 AssistantService 查找
   * 3. 如果仍找不到，在所有 provider 中查找该 modelId
   * 4. 如果仍找不到，构造一个临时 Model 对象（假设用户知道自己在做什么）
   * 5. 查找任意 endpoint_type 为 'gemini-image' 或 'gemini-image-edit' 的模型
   * 6. 最后回退到查找官方 Gemini Provider
   */
  static async findGeminiImageProvider(
    preferredProviderId?: string,
    preferredModelId?: string
  ): Promise<{ provider: Provider; model: Model } | null> {
    const providers = this.getEnabledProviders()

    logger.debug('[WorkflowAiService] findGeminiImageProvider 开始查找', {
      preferredProviderId,
      preferredModelId,
      enabledProviderCount: providers.length,
      providerIds: providers.map((p) => p.id)
    })

    // 1. 如果指定了 Provider 和 Model，优先使用
    if (preferredProviderId && preferredModelId) {
      // 1a. 先在指定 provider.models 中查找
      const provider = providers.find((p) => p.id === preferredProviderId && p.enabled !== false)
      if (provider) {
        const model = provider.models?.find((m) => m.id === preferredModelId)
        if (model) {
          logger.debug('[WorkflowAiService] 在 provider.models 中找到模型', {
            providerId: provider.id,
            modelId: model.id,
            endpointType: (model as any).endpoint_type
          })
          return { provider, model }
        }
      }

      // 1b. 尝试通过 AssistantService 查找
      const providerByModel = getProviderByModelId(preferredModelId)
      if (providerByModel) {
        const modelFromService = providerByModel.models?.find((m) => m.id === preferredModelId)
        if (modelFromService) {
          logger.debug('[WorkflowAiService] 通过 AssistantService 找到模型', {
            providerId: providerByModel.id,
            modelId: modelFromService.id
          })
          return { provider: providerByModel, model: modelFromService }
        }
      }

      // 1c. 尝试在所有 provider 中查找这个 modelId
      for (const p of providers) {
        if (p.enabled === false) continue
        const foundModel = p.models?.find((m) => m.id === preferredModelId)
        if (foundModel) {
          logger.debug('[WorkflowAiService] 在其他 provider 中找到模型', {
            providerId: p.id,
            modelId: foundModel.id,
            endpointType: (foundModel as any).endpoint_type
          })
          return { provider: p, model: foundModel }
        }
      }

      // 1d. 仍然找不到，但用户明确指定了，构造临时 Model 对象
      // 这适用于用户手动添加的模型或 API 直接支持但未在 UI 列表中显示的模型
      if (provider) {
        logger.info('[WorkflowAiService] 构造临时 Model 对象（用户明确指定）', {
          providerId: provider.id,
          modelId: preferredModelId
        })
        const constructedModel = ModelRouter.constructTemporaryModel(preferredModelId, provider.id, {
          endpointType: 'gemini-image',
          group: 'image-generation'
        })
        return { provider, model: constructedModel }
      }

      logger.warn('[WorkflowAiService] 用户指定的 Provider/Model 组合无法找到，将回退到自动查找', {
        preferredProviderId,
        preferredModelId
      })
    }

    // 2. 查找 endpoint_type 为 'gemini-image' 或 'gemini-image-edit' 的模型
    for (const provider of providers) {
      if (provider.enabled === false || !provider.apiKey) continue
      const geminiImageModel = provider.models?.find(
        (m: any) => m.endpoint_type === 'gemini-image' || m.endpoint_type === 'gemini-image-edit'
      )
      if (geminiImageModel) {
        logger.debug('[WorkflowAiService] 找到 Gemini 图像生成模型', {
          providerId: provider.id,
          modelId: geminiImageModel.id,
          endpointType: (geminiImageModel as any).endpoint_type
        })
        return { provider, model: geminiImageModel }
      }
    }

    // 3. 查找官方 Gemini Provider 或 type 为 gemini 的 Provider
    const geminiProvider = providers.find(
      (p) =>
        p.enabled !== false &&
        p.apiKey &&
        (p.id === 'gemini' || p.type === 'gemini' || p.apiHost?.includes('generativelanguage.googleapis.com'))
    )
    if (geminiProvider) {
      // 使用默认的 Gemini 图像生成模型
      const defaultModel: Model = {
        id: 'gemini-2.0-flash-exp-image-generation',
        name: 'Gemini 2.0 Flash Image Generation',
        provider: geminiProvider.id,
        group: 'image-generation'
      }
      logger.debug('[WorkflowAiService] 使用默认 Gemini 图像生成模型', {
        providerId: geminiProvider.id,
        modelId: defaultModel.id
      })
      return { provider: geminiProvider, model: defaultModel }
    }

    logger.warn('[WorkflowAiService] 未找到任何可用的 Gemini 图像生成服务', {
      checkedProviders: providers.map((p) => ({
        id: p.id,
        type: p.type,
        enabled: p.enabled,
        hasApiKey: !!p.apiKey,
        modelCount: p.models?.length || 0,
        geminiImageModels:
          p.models
            ?.filter((m: any) => m.endpoint_type === 'gemini-image' || m.endpoint_type === 'gemini-image-edit')
            .map((m) => m.id) || []
      }))
    })
    return null
  }

  /**
   * 统一图像生成接口 - 智能路由
   *
   * 会根据以下规则选择最合适的服务：
   * 1. 如果是 Google 官方 API + Gemini 模型 + 多图输入 -> 使用 Gemini generateContent API
   * 2. 其他情况（包括第三方代理） -> 使用原生 ImageGenerationService (OpenAI 格式)
   *
   * @param provider AI Provider 配置
   * @param model Model 配置
   * @param params 图像生成参数
   * @returns base64 编码的图片
   */
  static async generateImage(provider: Provider, model: Model, params: GeminiImageGenerationParams): Promise<string> {
    const hasMultipleImages = params.images && params.images.length > 0

    logger.info('[WorkflowAiService] generateImage - 智能路由', {
      providerId: provider.id,
      modelId: model.id,
      modelEndpointType: (model as any).endpoint_type,
      apiHost: provider.apiHost,
      hasMultipleImages,
      isGeminiProvider: ModelRouter.isGeminiProvider(provider),
      isGeminiModel: ModelRouter.isGeminiImageModel(model),
      // 追踪关键参数
      imageSize: params.imageSize,
      aspectRatio: params.aspectRatio
    })

    // 使用 ModelRouter 判断是否需要使用 Gemini 原生 API
    const needsGeminiNative = ModelRouter.needsGeminiNative(provider, model, hasMultipleImages)

    if (needsGeminiNative) {
      logger.info('[WorkflowAiService] 使用 Gemini generateContent API (Google 官方 API + 多图输入)')
      return this.generateImageWithGeminiNative(provider, model, params)
    } else {
      logger.info('[WorkflowAiService] 使用原生 ImageGenerationService (统一接口/OpenAI 格式)')
      return this.generateImageWithUnifiedService(provider, model, params)
    }
  }

  /**
   * 使用原生 ImageGenerationService 生成图片
   */
  private static async generateImageWithUnifiedService(
    provider: Provider,
    model: Model,
    params: GeminiImageGenerationParams
  ): Promise<string> {
    try {
      // 将 Gemini 参数转换为统一的 ImageGenerationParams
      const serviceParams: ServiceImageParams = {
        model: model.id,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        n: 1, // 工作流节点通常一次生成一张
        response_format: 'b64_json',
        // 尺寸参数转换
        aspect_ratio: params.aspectRatio,
        // Gemini 的 imageSize 映射 - 同时传递 size 和 image_size
        size: this.convertGeminiSizeToStandardSize(params.imageSize),
        image_size: params.imageSize, // 底层服务使用 image_size
        // 如果有参考图片，传递所有参考图
        image: params.images?.[0],
        reference_images: params.images
      }

      // 关键参数追踪日志
      logger.info('[WorkflowAiService] generateImageWithUnifiedService - 参数转换', {
        inputImageSize: params.imageSize,
        inputAspectRatio: params.aspectRatio,
        outputImageSize: serviceParams.image_size,
        outputAspectRatio: serviceParams.aspect_ratio,
        outputSize: serviceParams.size
      })

      const service = new ImageGenerationService(provider, model)
      const result = await service.generate(serviceParams)

      if (!result.success || result.images.length === 0) {
        throw new Error(result.error || '原生服务未返回图片')
      }

      const imageData = result.images[0]

      // 使用统一的图片数据规范化方法
      return this.normalizeImageData(imageData)
    } catch (error) {
      // 使用 ModelRouter 检查是否可以回退到 Gemini 原生 API
      const canFallbackToGemini = ModelRouter.canFallbackToGemini(provider)

      if (canFallbackToGemini) {
        logger.warn('[WorkflowAiService] 原生服务失败，回退到 Gemini API', {
          error: error instanceof Error ? error.message : String(error),
          apiHost: provider.apiHost
        })
        return this.generateImageWithGeminiNative(provider, model, params)
      } else {
        // 不支持回退，直接抛出错误
        logger.error('[WorkflowAiService] 原生服务失败，且不支持 Gemini 原生 API 回退', {
          error: error instanceof Error ? error.message : String(error),
          apiHost: provider.apiHost
        })
        throw error
      }
    }
  }

  /**
   * 转换 Gemini 的 imageSize 到标准尺寸
   */
  private static convertGeminiSizeToStandardSize(geminiSize?: string): string {
    switch (geminiSize) {
      case '1K':
        return '1024x1024'
      case '2K':
        return '2048x2048'
      case '4K':
        return '4096x4096'
      default:
        return '1024x1024'
    }
  }

  /**
   * 规范化图片数据格式
   * 复用主应用 ImageGenerationService.extractImages() 的逻辑
   *
   * @param imageData 输入的图片数据（可能是 data URL、HTTP URL 或纯 base64）
   * @returns 规范化后的图片数据
   */
  private static normalizeImageData(imageData: string): string {
    // 1. 已经是 data URL - 直接返回
    if (imageData.startsWith('data:')) {
      return imageData
    }

    // 2. 是 HTTP/HTTPS URL - 直接返回，下游处理
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      logger.debug('[WorkflowAiService] normalizeImageData: 检测到 URL，直接返回', {
        url: imageData.substring(0, 100)
      })
      return imageData
    }

    // 3. 是 file:// 协议 - 直接返回
    if (imageData.startsWith('file://')) {
      return imageData
    }

    // 4. 纯 base64 字符串 - 包装为 data URL
    // 检查是否是有效的 base64 格式（至少 100 字符，避免误判短字符串）
    if (/^[A-Za-z0-9+/=]+$/.test(imageData) && imageData.length > 100) {
      logger.debug('[WorkflowAiService] normalizeImageData: 检测到纯 base64，包装为 data URL')
      return `data:image/png;base64,${imageData}`
    }

    // 5. 未知格式 - 原样返回，让下游处理
    logger.warn('[WorkflowAiService] normalizeImageData: 未知图片格式', {
      dataPreview: imageData.substring(0, 50)
    })
    return imageData
  }

  /**
   * Gemini generateContent API 的原生实现
   */
  private static async generateImageWithGeminiNative(
    provider: Provider,
    model: Model,
    params: GeminiImageGenerationParams
  ): Promise<string> {
    logger.info('[WorkflowAiService] generateImageWithGeminiNative', {
      providerId: provider.id,
      modelId: model.id,
      promptLength: params.prompt.length,
      imageCount: params.images?.length || 0,
      aspectRatio: params.aspectRatio,
      imageSize: params.imageSize
    })

    // 构建 API URL
    let baseUrl = provider.apiHost || 'https://generativelanguage.googleapis.com'
    baseUrl = baseUrl.replace(/\/$/, '')
    if (!baseUrl.includes('/v1beta')) {
      baseUrl = `${baseUrl}/v1beta`
    }
    const apiKey = provider.apiKey

    // 使用模型服务中配置的模型 ID（保持原样）
    const modelName = model.id

    // 判断是否为 Google 官方域名
    const isGoogleOfficial =
      baseUrl.includes('generativelanguage.googleapis.com') || baseUrl.includes('aiplatform.googleapis.com')

    // 构建 URL - 统一使用 ?key= 格式（参考脚本的实现）
    // 中转站和 Google 官方 API 都使用这种格式
    const url = `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    logger.info('[WorkflowAiService] Gemini API 配置', {
      isGoogleOfficial,
      baseUrl,
      modelId: modelName,
      url: url.replace(apiKey || '', '***')
    })

    // 构建 parts 数组
    const parts: any[] = []

    // 添加提示词，明确指示生成图像
    let fullPrompt = `请根据以下描述生成一张真实的照片图像，不要返回文本分析或解释：

${params.prompt}`

    if (params.negativePrompt) {
      fullPrompt += `\n\n负面提示词（需要避免的内容）: ${params.negativePrompt}`
    }

    // 强调图像生成要求
    fullPrompt += `\n\n重要：请直接生成图像，不要提供任何文字描述、分析或解释。`

    parts.push({ text: fullPrompt })

    // 添加输入图片
    if (params.images && params.images.length > 0) {
      for (const imageBase64 of params.images) {
        if (imageBase64) {
          // 确保是纯 base64（不含 data: 前缀）
          const pureBase64 = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64
          parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: pureBase64
            }
          })
        }
      }
    }

    // 生成随机 seed，避免同质化
    const randomSeed = Math.floor(Math.random() * 2147483647)

    // 构建请求体
    // Gemini 3 Pro Image 支持 system_instruction 参数用于设置角色和规则约束
    const payload: Record<string, any> = {
      // 系统提示词（如果提供）
      ...(params.systemPrompt && {
        system_instruction: {
          parts: [{ text: params.systemPrompt }]
        }
      }),
      contents: [{ parts }],
      generationConfig: {
        temperature: params.temperature ?? 1.0,
        topP: 0.95,
        maxOutputTokens: 8192,
        seed: randomSeed,
        // 同时支持文本和图像响应（某些中转站需要）
        responseModalities: ['TEXT', 'IMAGE'],
        // imageConfig：仅当有值时才设置，由调用方负责设置默认值
        // 不在服务层硬编码默认值，以支持不同模型的不同默认配置
        ...(params.aspectRatio || params.imageSize
          ? {
              imageConfig: {
                ...(params.aspectRatio && { aspectRatio: params.aspectRatio }),
                ...(params.imageSize && { imageSize: params.imageSize })
              }
            }
          : {})
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    }

    logger.debug('[WorkflowAiService] Sending Gemini API request', {
      url: url.replace(apiKey || '', '***'),
      partsCount: parts.length,
      hasSystemPrompt: !!params.systemPrompt,
      systemPromptLength: params.systemPrompt?.length || 0,
      aspectRatio: params.aspectRatio,
      imageSize: params.imageSize,
      imageConfig: payload.generationConfig.imageConfig,
      isGoogleOfficial
    })

    try {
      // 执行请求前检查是否已取消
      if (params.signal?.aborted) {
        throw new DOMException('请求已取消', 'AbortError')
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: params.signal // 传递 AbortSignal 以支持取消请求
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`
        throw new Error(`Gemini API 请求失败: ${errorMsg}`)
      }

      const result = await response.json()

      logger.debug('[WorkflowAiService] Gemini API response received', {
        hasCandidates: !!result?.candidates?.length,
        candidateCount: result?.candidates?.length || 0
      })

      // 提取图片
      const imageResult = this.extractImageFromGeminiResponse(result)

      if (!imageResult) {
        // 检查是否有文本响应
        const textResponse = this.extractTextFromGeminiResponse(result)
        if (textResponse) {
          logger.warn('[WorkflowAiService] Gemini returned text instead of image', {
            text: textResponse.substring(0, 200),
            fullResponse: JSON.stringify(result, null, 2)
          })
          throw new Error(
            `Gemini API 配置错误：期望返回图像但收到文本响应。请检查模型是否支持图像生成功能，或联系管理员检查 API 配置。返回的文本: ${textResponse.substring(0, 100)}...`
          )
        }

        // 详细的调试信息
        logger.error('[WorkflowAiService] No image found in Gemini response', {
          response: JSON.stringify(result, null, 2),
          candidatesCount: result?.candidates?.length || 0,
          parts: result?.candidates?.[0]?.content?.parts || []
        })

        throw new Error(
          'Gemini API 未返回图片数据。可能原因：1) 模型不支持图像生成 2) API 密钥权限不足 3) 提示词触发了安全限制。请检查模型配置和提示词内容。'
        )
      }

      logger.info('[WorkflowAiService] generateImage completed', {
        resultType: imageResult.startsWith('data:') ? 'base64' : 'url',
        resultLength: imageResult.length
      })

      return imageResult
    } catch (error) {
      // 特殊处理取消请求的情况
      if (error instanceof DOMException && error.name === 'AbortError') {
        logger.info('[WorkflowAiService] generateImage 请求被取消')
        throw error // 直接重新抛出 AbortError
      }

      logger.error('[WorkflowAiService] generateImage failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 从 Gemini API 响应中提取图片
   */
  private static extractImageFromGeminiResponse(result: any): string | null {
    const candidates = result.candidates || []
    if (candidates.length === 0) {
      return null
    }

    const content = candidates[0].content || {}
    const parts: any[] = content.parts || []

    for (const part of parts) {
      // 格式 1: inlineData 或 inline_data (base64)
      const inlineData = part.inlineData || part.inline_data
      if (inlineData && inlineData.data) {
        const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/jpeg'
        return `data:${mimeType};base64,${inlineData.data}`
      }

      // 格式 2: fileData 或 file_data (URL)
      const fileData = part.fileData || part.file_data
      if (fileData && (fileData.fileUri || fileData.file_uri || fileData.uri)) {
        const uri = fileData.fileUri || fileData.file_uri || fileData.uri
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          return uri
        }
        if (uri.startsWith('gs://')) {
          return uri.replace('gs://', 'https://storage.googleapis.com/')
        }
      }

      // 格式 3: image_url 或 imageUrl
      const imageUrl = part.image_url || part.imageUrl || part.url
      if (imageUrl) {
        const url = typeof imageUrl === 'string' ? imageUrl : imageUrl.url
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          return url
        }
      }

      // 格式 4: b64_json (OpenAI 格式兼容)
      if (part.b64_json) {
        return `data:image/png;base64,${part.b64_json}`
      }
    }

    return null
  }

  /**
   * 从 Gemini API 响应中提取文本
   */
  private static extractTextFromGeminiResponse(result: any): string | null {
    const candidates = result.candidates || []
    if (candidates.length === 0) {
      return null
    }

    const content = candidates[0].content || {}
    const parts: any[] = content.parts || []

    const textParts = parts.filter((p) => p.text).map((p) => p.text!)
    return textParts.length > 0 ? textParts.join('\n') : null
  }

  /**
   * 读取图片并转换为 base64
   *
   * **Feature: image-ref-optimization**
   * 支持 ImageRef 图片引用类型，实现延迟加载
   *
   * 复用主应用的文件 API，支持多种输入格式：
   * - ImageRef: 图片引用对象（新增）
   * - data URL: 直接提取 base64 部分
   * - HTTP/HTTPS URL: 使用主应用下载服务
   * - 存储 ID (UUID): 使用主应用文件存储服务
   * - 本地文件路径: 使用主进程 API 读取
   * - 纯 base64 字符串: 直接返回
   */
  static async loadImageAsBase64(imageInput: ImageData): Promise<string> {
    // 处理 ImageRef 类型
    if (isImageRef(imageInput)) {
      return this.resolveImageRef(imageInput)
    }

    // 兼容旧代码：处理字符串类型
    const imagePath = imageInput

    logger.debug('[WorkflowAiService] loadImageAsBase64 开始', {
      imagePath: imagePath.substring(0, 100),
      isDataUrl: imagePath.startsWith('data:'),
      isHttpUrl: imagePath.startsWith('http://') || imagePath.startsWith('https://'),
      hasPath: imagePath.includes('/') || imagePath.includes('\\')
    })

    // 1. 如果已经是 data URL，提取 base64 部分
    if (imagePath.startsWith('data:')) {
      const base64Part = imagePath.split(',')[1]
      if (base64Part) {
        logger.debug('[WorkflowAiService] 已是 data URL，直接返回 base64')
        return base64Part
      }
      // 如果没有逗号分隔，可能是错误格式，尝试返回原始数据
      return imagePath
    }

    // 2. 如果是 HTTP/HTTPS URL - 使用主应用下载服务
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      try {
        logger.debug('[WorkflowAiService] 检测到 HTTP URL，使用下载服务')
        // 使用主应用的下载服务，下载到本地存储
        const fileMetadata = await window.api.file.download(imagePath, true)
        // 从存储读取为 base64
        const result = await window.api.file.base64Image(fileMetadata.id)
        logger.debug('[WorkflowAiService] HTTP URL 下载成功', {
          fileId: fileMetadata.id,
          resultLength: result.base64.length
        })
        return result.base64
      } catch (error) {
        logger.error('[WorkflowAiService] HTTP URL 下载失败', {
          url: imagePath.substring(0, 100),
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }

    // 3. 如果是存储 ID（UUID 格式）- 使用主应用文件存储服务
    if (/^[a-f0-9-]{36}$/i.test(imagePath)) {
      try {
        logger.debug('[WorkflowAiService] 检测到存储 ID，使用文件存储服务')
        const result = await window.api.file.base64Image(imagePath)
        logger.debug('[WorkflowAiService] 存储 ID 读取成功', {
          resultLength: result.base64.length
        })
        return result.base64
      } catch (error) {
        logger.error('[WorkflowAiService] 存储 ID 读取失败', {
          fileId: imagePath,
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }

    // 4. 如果不包含路径分隔符，可能已经是纯 base64
    if (!imagePath.includes('/') && !imagePath.includes('\\')) {
      // 检查是否看起来像 base64（仅包含有效字符）
      if (/^[A-Za-z0-9+/=]+$/.test(imagePath)) {
        logger.debug('[WorkflowAiService] 检测到纯 base64 字符串')
        return imagePath
      }
    }

    // 5. 本地文件路径 - 使用 Electron 主进程 API 读取文件
    try {
      // 优先使用 fs.readBase64 - 这是专门为此设计的 API
      if (window.api?.fs?.readBase64) {
        logger.debug('[WorkflowAiService] 使用 window.api.fs.readBase64 读取文件')
        const base64Content = await window.api.fs.readBase64(imagePath)
        if (base64Content) {
          logger.debug('[WorkflowAiService] 文件读取成功', {
            resultLength: base64Content.length
          })
          return base64Content
        }
      }

      // 如果 readBase64 不可用或返回空，抛出错误
      throw new Error(`无法读取图片文件: ${imagePath}`)
    } catch (error) {
      logger.error('[WorkflowAiService] loadImageAsBase64 失败', {
        imagePath: imagePath.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 解析 ImageRef 为 base64
   *
   * **Feature: image-ref-optimization**
   * 根据 ImageRef 类型执行相应的解析逻辑
   */
  private static async resolveImageRef(ref: ImageRef): Promise<string> {
    logger.debug('[WorkflowAiService] resolveImageRef 开始', {
      type: ref.type,
      valuePreview: ref.value.substring(0, 50)
    })

    switch (ref.type) {
      case 'base64':
        // 已经是 Base64，直接返回
        return ref.value

      case 'file':
        // 本地文件路径
        return this.loadImageAsBase64(ref.value)

      case 'url':
        // HTTP/HTTPS URL
        return this.loadImageAsBase64(ref.value)

      case 'blob':
        // Blob URL - 使用 fetch 读取
        try {
          const response = await fetch(ref.value)
          const blob = await response.blob()
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const result = reader.result as string
              resolve(result.includes(',') ? result.split(',')[1] : result)
            }
            reader.onerror = () => reject(new Error('Blob 读取失败'))
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          logger.error('[WorkflowAiService] Blob URL 读取失败', {
            blobUrl: ref.value,
            error: error instanceof Error ? error.message : String(error)
          })
          throw new Error(`无法读取 Blob URL: ${ref.value}`)
        }

      case 'storage':
        // Cherry Studio 存储 ID
        return this.loadImageAsBase64(ref.value)

      default:
        throw new Error(`不支持的图片引用类型: ${(ref as any).type}`)
    }
  }

  /**
   * 批量加载图片为 base64
   *
   * **Feature: image-ref-optimization**
   * 支持 ImageRef 和字符串混合输入
   *
   * 使用 Promise.all 并行加载，提高效率
   */
  static async loadImagesAsBase64(imageInputs: ImageData[]): Promise<string[]> {
    logger.info('[WorkflowAiService] loadImagesAsBase64 开始', {
      imageCount: imageInputs.length,
      types: imageInputs.map((p) =>
        isImageRef(p) ? `ImageRef(${p.type})` : typeof p === 'string' ? p.substring(0, 30) : typeof p
      )
    })

    // 使用 Promise.allSettled 允许部分失败
    const results = await Promise.allSettled(imageInputs.map((input) => this.loadImageAsBase64(input)))

    const successResults: string[] = []
    const errors: string[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successResults.push(result.value)
      } else {
        const input = imageInputs[index]
        const inputDesc = isImageRef(input)
          ? `ImageRef(${input.type})`
          : typeof input === 'string'
            ? input.substring(0, 50)
            : typeof input
        errors.push(`图片 ${index + 1}: ${result.reason?.message || String(result.reason)}`)
        logger.warn('[WorkflowAiService] 单张图片加载失败', {
          index,
          input: inputDesc,
          error: result.reason?.message || String(result.reason)
        })
      }
    })

    logger.info('[WorkflowAiService] loadImagesAsBase64 完成', {
      total: imageInputs.length,
      success: successResults.length,
      failed: errors.length
    })

    if (errors.length > 0 && successResults.length === 0) {
      throw new Error(`所有图片加载失败: ${errors.join('; ')}`)
    }

    return successResults
  }

  /**
   * 加载并压缩图片用于视觉分析（文本生成场景）
   *
   * 对齐 Cherry Studio 底层逻辑：
   * - 文本生成场景需要压缩图片以避免超过 API 限制
   * - 直接调用 Cherry Studio 的 compressImage 函数
   *
   * 性能优化：使用 Promise.all 并行加载所有图片
   *
   * @param imagePaths 图片路径数组
   * @returns 压缩后的 base64 图片数组
   */
  static async loadImagesForVision(imageInputs: ImageData[]): Promise<string[]> {
    const startTime = Date.now()
    logger.info('[WorkflowAiService] loadImagesForVision 开始', {
      imageCount: imageInputs.length,
      types: imageInputs.map((p) =>
        isImageRef(p) ? `ImageRef(${p.type})` : typeof p === 'string' ? p.substring(0, 30) : typeof p
      )
    })

    // 使用 Promise.allSettled 并行加载所有图片
    // 单张图片失败不影响其他图片
    const loadPromises = imageInputs.map(async (imageInput, index) => {
      const itemStartTime = Date.now()
      try {
        // 1. 先加载为 base64
        const base64 = await this.loadImageAsBase64(imageInput)

        // 2. 检查大小，如果超过限制则压缩
        const sizeInBytes = this.getBase64SizeInBytes(base64)

        let result: string
        if (sizeInBytes > VISION_MAX_SIZE_BYTES) {
          logger.info(`[WorkflowAiService] 图片 ${index + 1} 超过大小限制，进行压缩`, {
            originalSize: `${(sizeInBytes / 1024 / 1024).toFixed(2)}MB`,
            maxSize: `${(VISION_MAX_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB`
          })

          // 直接调用 Cherry Studio 底层的 compressImage
          const compressedBase64 = await this.compressBase64Image(base64)
          result = compressedBase64

          logger.info(`[WorkflowAiService] 图片 ${index + 1} 压缩完成`, {
            originalSize: `${(sizeInBytes / 1024 / 1024).toFixed(2)}MB`,
            compressedSize: `${(this.getBase64SizeInBytes(compressedBase64) / 1024 / 1024).toFixed(2)}MB`,
            duration: `${Date.now() - itemStartTime}ms`
          })
        } else {
          result = base64
        }

        return { success: true as const, index, result, duration: Date.now() - itemStartTime }
      } catch (error) {
        logger.warn(`[WorkflowAiService] 图片 ${index + 1} 加载/压缩失败，跳过`, {
          input: isImageRef(imageInput)
            ? `${imageInput.type}:${imageInput.value.substring(0, 50)}`
            : typeof imageInput === 'string'
              ? imageInput.substring(0, 50)
              : typeof imageInput,
          error: error instanceof Error ? error.message : String(error),
          duration: `${Date.now() - itemStartTime}ms`
        })
        return { success: false as const, index, error, duration: Date.now() - itemStartTime }
      }
    })

    // 等待所有加载完成
    const loadResults = await Promise.all(loadPromises)

    // 按原始顺序收集成功的结果
    const results: string[] = []
    for (const item of loadResults) {
      if (item.success) {
        results.push(item.result)
      }
    }

    if (results.length === 0 && imageInputs.length > 0) {
      throw new Error('所有图片加载失败')
    }

    const totalDuration = Date.now() - startTime
    logger.info('[WorkflowAiService] loadImagesForVision 完成', {
      total: imageInputs.length,
      success: results.length,
      totalDuration: `${totalDuration}ms`,
      // 计算并行带来的时间节省
      serialEstimate: loadResults.reduce((sum, r) => sum + r.duration, 0),
      parallelActual: totalDuration
    })

    return results
  }

  /**
   * 计算 base64 字符串的实际字节大小
   */
  private static getBase64SizeInBytes(base64: string): number {
    const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64
    return Math.ceil((pureBase64.length * 3) / 4)
  }

  /**
   * 压缩 base64 图片
   * 使用 AI 视觉分析专用压缩函数，保持高质量（2048px, 90%质量）
   */
  private static async compressBase64Image(base64: string): Promise<string> {
    // 1. base64 转 File
    const file = this.base64ToFile(base64)

    // 2. 调用 AI 视觉分析专用压缩函数（保持高质量）
    const compressedFile = await compressImageForVision(file)

    // 3. 转回 base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result.includes(',') ? result.split(',')[1] : result)
      }
      reader.onerror = () => reject(new Error('读取压缩后的图片失败'))
      reader.readAsDataURL(compressedFile)
    })
  }

  /**
   * base64 字符串转 File
   */
  private static base64ToFile(base64: string): File {
    let mimeType = 'image/jpeg'
    let pureBase64 = base64

    if (base64.startsWith('data:')) {
      const matches = base64.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        mimeType = matches[1]
        pureBase64 = matches[2]
      } else {
        pureBase64 = base64.split(',')[1] || base64
      }
    }

    const binaryString = atob(pureBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return new File([bytes], 'image.jpg', { type: mimeType })
  }
}

export default WorkflowAiService
