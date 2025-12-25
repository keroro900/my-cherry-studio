/**
 * 统一图像生成服务
 *
 * 核心原则：
 * 1. 所有第三方中转服务都遵循 OpenAI 格式 (/v1/images/generations)
 * 2. 服务端负责格式转换，客户端统一按 OpenAI/DALL-E 格式发送
 * 3. 只有当 endpoint_type 明确为 'gemini-image' 时才使用 Gemini 原生 API
 */

import { loggerService } from '@logger'
import AiProvider from '@renderer/aiCore'
import { ModelRouter } from '@renderer/aiCore/routing'
import type { Model, Provider } from '@renderer/types'

const logger = loggerService.withContext('ImageGenerationService')

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 统一的图像生成参数（基于 DALL-E 格式，扩展支持其他模型特有参数）
 */
export interface ImageGenerationParams {
  // === 基础参数（所有模型通用）===
  prompt: string
  model: string
  n?: number // 生成数量
  reference_images?: string[] // 参考图（编辑/图生图）

  // === 尺寸参数 ===
  size?: string // DALL-E 格式: "1024x1024"
  aspect_ratio?: string // 某些模型使用: "16:9"
  width?: number // 某些模型使用像素值
  height?: number
  image_size?: string // 某些模型（Gemini）使用: 1K/2K/4K

  // === 质量参数 ===
  quality?: string // "auto" | "hd" | "standard"

  // === 高级参数（混传，第三方平台通常支持）===
  negative_prompt?: string // 反向提示词
  seed?: number // 随机种子
  steps?: number // 推理步数
  guidance_scale?: number // 引导比例/CFG Scale
  style_type?: string // 风格类型

  // === 安全/审核参数 ===
  moderation?: string // 内容审核级别
  safety_tolerance?: number

  // === 输出参数 ===
  response_format?: 'url' | 'b64_json'

  // === 参考图片（图生图）===
  image?: string // Base64 或 URL

  // === 扩展参数（用于特定模型的额外参数）===
  [key: string]: any
}

/**
 * 图像生成结果
 */
export interface ImageGenerationResult {
  success: boolean
  images: string[] // Base64 或 URL 数组
  error?: string
}

/**
 * 生成选项
 */
export interface GenerationOptions {
  signal?: AbortSignal
  onProgress?: (current: number, total: number) => void
}

// ============================================================================
// 统一图像生成服务
// ============================================================================

export class ImageGenerationService {
  private provider: Provider
  private model: Model

  // API 格式缓存：记录每个 provider+model 组合成功使用的 API 格式
  // 避免重复尝试失败的格式，减少不必要的 API 调用
  private static apiFormatCache: Map<
    string,
    {
      format: 'chat-completions' | 'openai-images' | 'gemini-native'
      timestamp: number
    }
  > = new Map()

  // 缓存有效期：30 分钟
  private static readonly CACHE_TTL = 30 * 60 * 1000

  constructor(provider: Provider, model: Model) {
    this.provider = provider
    this.model = model
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(): string {
    return `${this.provider.id}:${this.model.id}`
  }

  /**
   * 获取缓存的 API 格式
   */
  private getCachedApiFormat(): 'chat-completions' | 'openai-images' | 'gemini-native' | null {
    const cacheKey = this.getCacheKey()
    const cached = ImageGenerationService.apiFormatCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < ImageGenerationService.CACHE_TTL) {
      logger.debug(`使用缓存的 API 格式: ${cached.format}`, { cacheKey })
      return cached.format
    }

    // 清理过期缓存
    if (cached) {
      ImageGenerationService.apiFormatCache.delete(cacheKey)
    }

    return null
  }

  /**
   * 缓存成功的 API 格式
   */
  private cacheApiFormat(format: 'chat-completions' | 'openai-images' | 'gemini-native'): void {
    const cacheKey = this.getCacheKey()
    ImageGenerationService.apiFormatCache.set(cacheKey, {
      format,
      timestamp: Date.now()
    })
    logger.debug(`缓存 API 格式: ${format}`, { cacheKey })
  }

  /**
   * 收集参考图，优先使用 image 字段，其次 reference_images
   */
  private collectReferenceImages(params: ImageGenerationParams): string[] {
    const images: string[] = []
    if (params.image) images.push(params.image)
    if (Array.isArray(params.reference_images)) {
      images.push(...params.reference_images.filter(Boolean))
    }
    // 去重，保持顺序
    return Array.from(new Set(images))
  }

  /**
   * 获取首张参考图
   */
  private getPrimaryImage(params: ImageGenerationParams): string | undefined {
    return this.collectReferenceImages(params)[0]
  }

  /**
   * 获取 API Key
   */
  private getApiKey(): string {
    const aiProvider = new AiProvider(this.provider)
    return aiProvider.getApiKey()
  }

  /**
   * 获取 API Base URL
   */
  private getBaseUrl(): string {
    if (this.provider.apiHost) {
      return this.provider.apiHost.replace(/\/$/, '')
    }

    const defaultUrls: Record<string, string> = {
      openai: 'https://api.openai.com',
      zhipu: 'https://open.bigmodel.cn',
      siliconflow: 'https://api.siliconflow.cn',
      dmxapi: 'https://api.dmxapi.cn',
      cherryin: 'https://open.cherryin.ai'
    }

    return defaultUrls[this.provider.id] || 'https://api.openai.com'
  }

  /**
   * 判断是否使用 Gemini 原生 API 格式
   *
   * 使用 ModelRouter 进行统一判断
   */
  private isGeminiNativeFormat(): boolean {
    const hasImages = false // generate 方法中会传入实际值
    const willUseGeminiNative = ModelRouter.needsGeminiNative(this.provider, this.model, hasImages)

    // 同时检查模型是否为 Gemini 图像模型且 API Host 支持
    const isGeminiImageModel = ModelRouter.isGeminiImageModel(this.model)
    const supportsGeminiNative = ModelRouter.supportsGeminiNative(this.provider.apiHost)

    const result = (willUseGeminiNative || isGeminiImageModel) && supportsGeminiNative

    return result
  }

  /**
   * 构建 OpenAI 格式的请求体
   */
  private buildRequestBody(params: ImageGenerationParams): Record<string, any> {
    const primaryImage = this.getPrimaryImage(params)

    const body: Record<string, any> = {
      model: params.model || this.model.id,
      prompt: params.prompt,
      n: params.n || 1,
      response_format: params.response_format || 'b64_json'
    }

    // 尺寸参数
    if (params.size) {
      body.size = params.size
    } else if (params.aspect_ratio) {
      body.aspect_ratio = params.aspect_ratio
    } else if (params.width && params.height) {
      body.size = `${params.width}x${params.height}`
    }

    // 质量参数
    if (params.quality) {
      body.quality = params.quality
    }

    // 高级参数
    if (params.negative_prompt) {
      body.negative_prompt = params.negative_prompt
    }
    if (params.seed !== undefined) {
      body.seed = params.seed
    }
    if (params.steps !== undefined) {
      body.steps = params.steps
      body.num_inference_steps = params.steps
    }
    if (params.guidance_scale !== undefined) {
      body.guidance_scale = params.guidance_scale
      body.cfg_scale = params.guidance_scale
    }
    if (params.style_type) {
      body.style_type = params.style_type
      body.style = params.style_type
    }

    // 安全参数
    if (params.moderation) {
      body.moderation = params.moderation
    }
    if (params.safety_tolerance !== undefined) {
      body.safety_tolerance = params.safety_tolerance
    }

    // 参考图片
    if (params.image) {
      body.image = params.image
    }

    // 参考图与图像尺寸透传，便于后端执行图生图/编辑逻辑
    if (!body.image && primaryImage) {
      body.image = primaryImage
    }
    if (params.reference_images?.length) {
      body.reference_images = params.reference_images
    }
    // 透传 image_size，由调用方（绘画模块/工作流模块）负责设置默认值
    // 不在服务层硬编码默认值，以支持不同模型的不同默认配置
    if (params.image_size) {
      body.image_size = params.image_size
    }

    return body
  }

  /**
   * 从响应中提取图片
   */
  private extractImages(response: any): string[] {
    const images: string[] = []

    // DALL-E 标准格式
    if (response?.data && Array.isArray(response.data)) {
      for (const item of response.data) {
        if (item.b64_json) {
          images.push(`data:image/png;base64,${item.b64_json}`)
        } else if (item.url) {
          images.push(item.url)
        }
      }
    }

    // SiliconFlow 格式
    if (response?.images && Array.isArray(response.images)) {
      for (const item of response.images) {
        if (typeof item === 'string') {
          images.push(item.startsWith('data:') ? item : `data:image/png;base64,${item}`)
        } else if (item?.url) {
          images.push(item.url)
        } else if (item?.b64_json) {
          images.push(`data:image/png;base64,${item.b64_json}`)
        }
      }
    }

    // Gemini 格式（某些平台可能透传）
    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        // 支持 inlineData 和 inline_data 两种格式
        const inlineData = part.inlineData || part.inline_data
        if (inlineData?.data) {
          const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png'
          images.push(`data:${mimeType};base64,${inlineData.data}`)
        }
      }
    }

    return images
  }

  /**
   * 检查 API Host 是否支持 Gemini 原生格式
   * 用于回退逻辑判断
   *
   * 使用 ModelRouter 进行统一判断
   */
  private canFallbackToGemini(): boolean {
    return ModelRouter.canFallbackToGemini(this.provider)
  }

  /**
   * 检查模型是否为 Gemini 图像模型
   *
   * 使用 ModelRouter 进行统一判断
   */
  private isGeminiImageModel(): boolean {
    return ModelRouter.isGeminiImageModel(this.model)
  }

  /**
   * 生成图片
   *
   * API 格式选择策略：
   * 1. 优先使用缓存的成功格式（避免重复尝试失败的格式）
   * 2. 如果是 Gemini 原生格式（Google 官方 API），使用 generateContent API
   * 3. 如果是 Gemini 模型但使用第三方代理，按顺序尝试：
   *    - Chat Completions API → OpenAI Images API → Gemini Native（如果支持）
   * 4. 非 Gemini 模型使用 OpenAI Images API
   */
  async generate(params: ImageGenerationParams, options?: GenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now()
    const requestId = Math.random().toString(36).substring(2, 8)

    logger.debug(`[${requestId}] ========== 开始图片生成 ==========`)
    logger.debug(`[${requestId}] 参数:`, {
      model: params.model,
      image_size: params.image_size,
      aspect_ratio: params.aspect_ratio,
      size: params.size,
      hasReferenceImages: !!params.reference_images?.length || !!params.image
    })

    try {
      const apiKey = this.getApiKey()
      if (!apiKey) {
        logger.debug(`[${requestId}] 错误: 未配置 API Key`)
        return { success: false, images: [], error: '未配置 API Key' }
      }

      // 检查缓存的 API 格式
      const cachedFormat = this.getCachedApiFormat()
      if (cachedFormat) {
        logger.debug(`[${requestId}] 使用缓存格式: ${cachedFormat}`)
        const result = await this.executeWithFormat(cachedFormat, params, apiKey, options, requestId)
        if (result.success) {
          logger.debug(
            `[${requestId}] 缓存格式成功，耗时: ${Date.now() - startTime}ms`
          )
          return result
        }
        // 缓存格式失败，清除缓存并重新尝试
        logger.debug(`[${requestId}] 缓存格式失败，清除缓存重新尝试`)
        ImageGenerationService.apiFormatCache.delete(this.getCacheKey())
      }

      // 判断使用哪种 API 格式
      const isNativeFormat = this.isGeminiNativeFormat()

      if (isNativeFormat) {
        logger.debug(`[${requestId}] 路由: Gemini Native (官方 API)`)
        const result = await this.generateWithGeminiNative(params, apiKey, options)
        if (result.success) {
          this.cacheApiFormat('gemini-native')
        }
        logger.debug(
          `[${requestId}] 完成，耗时: ${Date.now() - startTime}ms，成功: ${result.success}`
        )
        return result
      } else if (this.isGeminiImageModel()) {
        // Gemini 模型通过第三方代理，按顺序尝试不同格式
        logger.debug(`[${requestId}] 路由: Gemini via Proxy (需要探测格式)`)

        // 尝试 1: Chat Completions API
        logger.debug(`[${requestId}] [尝试 1/3] Chat Completions API`)
        try {
          const result = await this.generateWithChatCompletions(params, apiKey, options)
          if (result.success) {
            this.cacheApiFormat('chat-completions')
            logger.debug(
              `[${requestId}] Chat Completions 成功，耗时: ${Date.now() - startTime}ms`
            )
            return result
          }
        } catch (chatError) {
          logger.debug(
            `[${requestId}] Chat Completions 失败:`,
            (chatError as Error).message
          )
        }

        // 尝试 2: OpenAI Images API
        logger.debug(`[${requestId}] [尝试 2/3] OpenAI Images API`)
        try {
          const result = await this.generateWithOpenAI(params, apiKey, options)
          if (result.success) {
            this.cacheApiFormat('openai-images')
            logger.debug(
              `[${requestId}] OpenAI Images 成功，耗时: ${Date.now() - startTime}ms`
            )
            return result
          }
        } catch (openaiError) {
          logger.debug(
            `[${requestId}] OpenAI Images 失败:`,
            (openaiError as Error).message
          )

          // 尝试 3: Gemini Native（如果支持）
          if (this.canFallbackToGemini()) {
            logger.debug(`[${requestId}] [尝试 3/3] Gemini Native 回退`)
            const result = await this.generateWithGeminiNative(params, apiKey, options)
            if (result.success) {
              this.cacheApiFormat('gemini-native')
              logger.debug(
                `[${requestId}] Gemini Native 回退成功，耗时: ${Date.now() - startTime}ms`
              )
            }
            return result
          }

          throw openaiError
        }

        // 不应该到达这里
        throw new Error('所有 API 格式均失败')
      } else {
        // 非 Gemini 模型，使用 OpenAI Images API
        logger.debug(`[${requestId}] 路由: OpenAI Images API`)
        const result = await this.generateWithOpenAI(params, apiKey, options)
        if (result.success) {
          this.cacheApiFormat('openai-images')
        }
        logger.debug(
          `[${requestId}] 完成，耗时: ${Date.now() - startTime}ms，成功: ${result.success}`
        )
        return result
      }
    } catch (error) {
      logger.debug(
        `[${requestId}] 最终失败，耗时: ${Date.now() - startTime}ms，错误:`,
        (error as Error).message
      )
      return {
        success: false,
        images: [],
        error: (error as Error).message
      }
    }
  }

  /**
   * 使用指定格式执行图片生成
   */
  private async executeWithFormat(
    format: 'chat-completions' | 'openai-images' | 'gemini-native',
    params: ImageGenerationParams,
    apiKey: string,
    options: GenerationOptions | undefined,
    requestId: string
  ): Promise<ImageGenerationResult> {
    logger.debug(`[${requestId}] 执行格式: ${format}`)
    switch (format) {
      case 'chat-completions':
        return this.generateWithChatCompletions(params, apiKey, options)
      case 'openai-images':
        return this.generateWithOpenAI(params, apiKey, options)
      case 'gemini-native':
        return this.generateWithGeminiNative(params, apiKey, options)
    }
  }

  /**
   * 使用 OpenAI 格式生成图片（适用于所有第三方 API 代理）
   */
  private async generateWithOpenAI(
    params: ImageGenerationParams,
    apiKey: string,
    options?: GenerationOptions
  ): Promise<ImageGenerationResult> {
    const baseUrl = this.getBaseUrl()
    const url = `${baseUrl}/v1/images/generations`

    const body = this.buildRequestBody(params)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: options?.signal
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.error('API error:', {
        status: response.status,
        body: errorText,
        requestBody: body
      })
      let errorMessage = `API 请求失败: HTTP ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorData.message || errorMessage
      } catch {
        if (errorText) {
          errorMessage = `${errorMessage} - ${errorText.slice(0, 200)}`
        }
      }
      throw new Error(errorMessage)
    }

    const result = await response.json()
    const images = this.extractImages(result)

    if (images.length === 0) {
      throw new Error('API 未返回图片数据')
    }

    return { success: true, images }
  }

  /**
   * 使用 OpenAI Chat Completions API 生成图片
   * 适用于支持通过 chat/completions 端点生成图片的第三方代理（如 open.cherryin.ai）
   *
   * 参考代码：
   * ```python
   * response = client.chat.completions.create(
   *     model="gemini-3-pro-image-preview",
   *     messages=[{
   *         "role": "user",
   *         "content": [{"type": "text", "text": "生成一张图片..."}]
   *     }]
   * )
   * ```
   */
  private async generateWithChatCompletions(
    params: ImageGenerationParams,
    apiKey: string,
    options?: GenerationOptions
  ): Promise<ImageGenerationResult> {
    const baseUrl = this.getBaseUrl()
    const url = `${baseUrl}/v1/chat/completions`

    const modelId = params.model || this.model.id

    // 获取宽高比和图片尺寸（由调用方负责设置默认值）
    const aspectRatio = params.aspect_ratio
    const imageSize = params.image_size

    // 构建提示词
    let promptText = params.prompt

    // 在提示词末尾添加宽高比要求（仅当有明确宽高比且非 1:1 时）
    if (aspectRatio && aspectRatio !== '1:1') {
      promptText = `${params.prompt}\n\n请生成宽高比为 ${aspectRatio} 的图片。`
    }

    // 构建消息内容
    const content: any[] = [{ type: 'text', text: promptText }]

    // 如果有参考图片，添加到消息中（支持多张）
    const referenceImages = this.collectReferenceImages(params)
    for (const img of referenceImages) {
      const imageUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
      content.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'auto'
        }
      })
    }

    // 构建请求体
    // 注意：某些第三方代理可能支持额外的参数来控制图像生成
    const body: Record<string, any> = {
      model: modelId,
      messages: [
        {
          role: 'user',
          content: content
        }
      ],
      max_tokens: 4096,
      temperature: 0.7
    }

    // 透传前端配置，便于代理侧使用
    body.n = params.n || 1
    if (aspectRatio) body.aspect_ratio = aspectRatio
    if (imageSize) body.image_size = imageSize
    if (params.size) body.size = params.size
    if (params.reference_images?.length) body.reference_images = params.reference_images

    // 添加 Gemini 原生格式的 generationConfig，便于支持透传的代理使用
    // 某些代理会将这些参数透传给 Gemini API
    if (aspectRatio || imageSize) {
      body.generationConfig = {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          ...(aspectRatio && { aspectRatio }),
          ...(imageSize && { imageSize })
        }
      }
    }

    // 关键参数追踪日志
    logger.debug('Chat Completions - 发送参数', {
      aspectRatio,
      imageSize,
      bodyAspectRatio: body.aspect_ratio,
      bodyImageSize: body.image_size,
      generationConfig: body.generationConfig,
      model: modelId
    })

    // 打印完整请求体（调试用）
    logger.debug('Chat Completions - 完整请求体', JSON.stringify(body, null, 2))

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: options?.signal
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.error('Chat Completions API error:', {
        status: response.status,
        body: errorText
      })
      let errorMessage = `Chat Completions API 请求失败: HTTP ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorData.message || errorMessage
      } catch {
        if (errorText) {
          errorMessage = `${errorMessage} - ${errorText.slice(0, 200)}`
        }
      }
      throw new Error(errorMessage)
    }

    const result = await response.json()
    const images = this.extractImagesFromChatResponse(result)

    if (images.length === 0) {
      throw new Error('Chat Completions API 未返回图片数据')
    }

    return { success: true, images }
  }

  /**
   * 从 Chat Completions 响应中提取图片
   */
  private extractImagesFromChatResponse(response: any): string[] {
    const images: string[] = []

    // 检查 choices 数组
    if (response?.choices && Array.isArray(response.choices)) {
      for (const choice of response.choices) {
        const message = choice.message || choice.delta
        if (!message) continue

        // 检查 content 是否为数组（多模态响应）
        if (Array.isArray(message.content)) {
          for (const item of message.content) {
            // 检查 image_url 类型
            if (item.type === 'image_url' && item.image_url?.url) {
              images.push(item.image_url.url)
            }
            // 检查 inline_data 类型（Gemini 格式）
            if (item.type === 'image' && item.image?.url) {
              images.push(item.image.url)
            }
            // 检查 base64 数据
            if (item.b64_json) {
              images.push(`data:image/png;base64,${item.b64_json}`)
            }
          }
        }

        // 检查 content 是否为字符串（可能包含 base64 图片）
        if (typeof message.content === 'string') {
          // 尝试从文本中提取 base64 图片
          const base64Match = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
          if (base64Match) {
            images.push(base64Match[0])
          }
        }
      }
    }

    // 检查 Gemini 格式的响应（candidates）
    if (response?.candidates && Array.isArray(response.candidates)) {
      for (const candidate of response.candidates) {
        const parts = candidate.content?.parts || []
        for (const part of parts) {
          const inlineData = part.inlineData || part.inline_data
          if (inlineData?.data) {
            const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png'
            images.push(`data:${mimeType};base64,${inlineData.data}`)
          }
        }
      }
    }

    return images
  }

  /**
   * 使用 Gemini 原生 generateContent API
   * 仅当 endpoint_type 为 'gemini-image' 时使用
   */
  private async generateWithGeminiNative(
    params: ImageGenerationParams,
    apiKey: string,
    options?: GenerationOptions
  ): Promise<ImageGenerationResult> {
    let baseUrl = this.provider.apiHost || 'https://generativelanguage.googleapis.com'
    baseUrl = baseUrl.replace(/\/$/, '')
    if (!baseUrl.includes('/v1beta')) {
      baseUrl = `${baseUrl}/v1beta`
    }

    // 判断是否为中转站（非 Google 官方域名）
    const isGoogleOfficial =
      baseUrl.includes('generativelanguage.googleapis.com') || baseUrl.includes('aiplatform.googleapis.com')

    // 直接使用用户配置的模型 ID，不做任何前缀处理
    // 用户在设置中配置什么模型名就用什么模型名
    const modelId = params.model || this.model.id

    // 构建 URL 和 headers - 中转站使用 Bearer token，官方 API 使用 URL 参数
    let url: string
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (isGoogleOfficial) {
      // Google 官方 API - 使用 URL 参数传递 key
      url = `${baseUrl}/models/${modelId}:generateContent?key=${apiKey}`
    } else {
      // 中转站（如 NewAPI）- 使用 Bearer token 认证，URL 结尾加斜杠
      url = `${baseUrl}/models/${modelId}:generateContent/`
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // 构建 parts 数组
    const parts: any[] = [{ text: params.prompt }]

    // 添加参考图片（支持多张）
    const referenceImages = this.collectReferenceImages(params)
    for (const img of referenceImages) {
      const imageData = img.startsWith('data:') ? img.split(',')[1] : img
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageData
        }
      })
    }

    // 转换 aspect_ratio（由调用方负责设置默认值）
    let aspectRatio = params.aspect_ratio
    if (params.size && params.size.includes('x')) {
      const [w, h] = params.size.split('x').map(Number)
      if (w && h) {
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
        const d = gcd(w, h)
        aspectRatio = `${w / d}:${h / d}`
      }
    }

    // 生成随机 seed，避免同质化
    const randomSeed = Math.floor(Math.random() * 2147483647)

    // 获取图片尺寸（由调用方负责设置默认值）
    const imageSize = params.image_size

    // 构建 imageConfig（仅当有值时才设置）
    const imageConfig: Record<string, string> = {}
    if (aspectRatio) imageConfig.aspectRatio = aspectRatio
    if (imageSize) imageConfig.imageSize = imageSize

    // 获取系统提示词（Gemini 3 Pro Image 支持 system_instruction）
    const systemPrompt = params.system_prompt || params.systemPrompt

    // 构建请求体（参考 ComfyUI 和 Cherry 工作流的实现）
    // Gemini 3 Pro Image 支持 system_instruction 参数用于设置角色和规则约束
    const payload: Record<string, any> = {
      // 系统提示词（如果提供）
      ...(systemPrompt && {
        system_instruction: {
          parts: [{ text: systemPrompt }]
        }
      }),
      contents: [{ parts }],
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        maxOutputTokens: 8192,
        seed: randomSeed,
        responseModalities: ['TEXT', 'IMAGE'],
        ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
        ...(params.n ? { candidateCount: params.n } : {})
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    }

    // 关键参数追踪日志
    logger.debug('Gemini Native - 发送参数', {
      aspectRatio,
      imageSize,
      imageConfig,
      hasSystemPrompt: !!systemPrompt,
      systemPromptLength: systemPrompt?.length || 0,
      generationConfig: payload.generationConfig
    })

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: options?.signal
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.error('Gemini API error:', {
        status: response.status,
        body: errorText
      })
      let errorMessage = `Gemini API 请求失败: HTTP ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || errorMessage
      } catch {
        if (errorText) {
          errorMessage = `${errorMessage} - ${errorText.slice(0, 200)}`
        }
      }
      throw new Error(errorMessage)
    }

    const result = await response.json()
    const images = this.extractImages(result) // 复用提取逻辑

    if (images.length === 0) {
      // 检查是否返回了文本
      const textParts = result?.candidates?.[0]?.content?.parts?.filter((p: any) => p.text)
      if (textParts?.length > 0) {
        const text = textParts.map((p: any) => p.text).join('')
        throw new Error(`Gemini 未返回图片，返回了文本: ${text.substring(0, 100)}...`)
      }
      throw new Error('Gemini API 未返回图片数据')
    }

    return { success: true, images }
  }

  /**
   * 批量生成
   */
  async generateBatch(params: ImageGenerationParams, options?: GenerationOptions): Promise<ImageGenerationResult> {
    const batchSize = params.n || 1

    // 对于小批量（<=4），尝试一次性生成，失败直接返回错误
    if (batchSize <= 4) {
      return await this.generate(params, options)
    }

    // 对于大批量（>4），逐个生成
    const allImages: string[] = []
    const errors: string[] = []

    for (let i = 0; i < batchSize; i++) {
      if (options?.signal?.aborted) break

      options?.onProgress?.(i + 1, batchSize)

      const result = await this.generate({ ...params, n: 1 }, options)
      if (result.success) {
        allImages.push(...result.images)
      } else if (result.error) {
        errors.push(`第 ${i + 1} 张: ${result.error}`)
      }
    }

    return {
      success: allImages.length > 0,
      images: allImages,
      error: errors.length > 0 ? errors.join('\n') : undefined
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createImageGenerationService(provider: Provider, model: Model): ImageGenerationService {
  return new ImageGenerationService(provider, model)
}

export async function quickGenerate(
  provider: Provider,
  model: Model,
  params: ImageGenerationParams,
  options?: GenerationOptions
): Promise<ImageGenerationResult> {
  const service = createImageGenerationService(provider, model)
  return service.generateBatch(params, options)
}
