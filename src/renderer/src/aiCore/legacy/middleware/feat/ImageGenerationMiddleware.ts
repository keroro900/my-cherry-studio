import { loggerService } from '@logger'
import { ModelRouter } from '@renderer/aiCore/routing/ModelRouter'
import { autonomousImageAgent, createBase64Ref, type ImageRef, intentAnalyzer } from '@renderer/pages/workflow/agents'
import { PromptService } from '@renderer/pages/workflow/prompts/PromptService'
import { WorkflowAiService } from '@renderer/pages/workflow/services/WorkflowAiService'
import FileManager from '@renderer/services/FileManager'
import {
  type ImageGenerationParams,
  ImageGenerationService,
  type StreamingGenerationOptions
} from '@renderer/services/ImageGenerationService'
import store from '@renderer/store'
import { type ImageAssistant, type ImageAssistantType, isImageAssistant } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'
import { findImageBlocks, getMainTextContent } from '@renderer/utils/messageUtils/find'

import type { CompletionsParams, CompletionsResult, GenericChunk } from '../schemas'
import type { CompletionsContext, CompletionsMiddleware } from '../types'

export const MIDDLEWARE_NAME = 'ImageGenerationMiddleware'
const logger = loggerService.withContext('ImageGenerationMiddleware')

// ==================== 自主模式检测 ====================

/**
 * 自主模式触发关键词
 * 当用户消息包含这些关键词时，触发自主图片生成
 */
const AUTONOMOUS_MODE_KEYWORDS = [
  // 中文关键词
  '一整套',
  '全套',
  '整套',
  '帮我生成',
  '自主生成',
  '自动生成',
  '智能生成',
  '一键生成',
  // 英文关键词
  'full set',
  'complete set',
  'auto generate',
  'autonomous',
  'smart generate'
]

/**
 * 检测是否应该使用自主模式
 */
function shouldUseAutonomousMode(userPrompt: string, hasImages: boolean): boolean {
  if (!hasImages) return false

  const lowerPrompt = userPrompt.toLowerCase()

  // 检查是否包含自主模式关键词
  for (const keyword of AUTONOMOUS_MODE_KEYWORDS) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      return true
    }
  }

  // 使用 IntentAnalyzer 检测高置信度的电商/模特任务
  const intent = intentAnalyzer.analyzeUserIntent(userPrompt)
  if (intent.confidence >= 0.6 && (intent.taskType === 'ecom' || intent.taskType === 'model')) {
    // 如果检测到电商或模特任务且有图片，也可以触发自主模式
    return true
  }

  return false
}

/**
 * 获取图片尺寸的像素值
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
 * 将 Uint8Array 转换为 base64 字符串
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

export const ImageGenerationMiddleware: CompletionsMiddleware =
  () =>
  (next) =>
  async (context: CompletionsContext, params: CompletionsParams): Promise<CompletionsResult> => {
    const { assistant, messages } = params
    const provider = context.apiClientInstance.provider
    const signal = context._internal?.flowControl?.abortSignal

    // 使用 ModelRouter 统一判断是否走图片生成路径
    const isImageTypeAssistant = isImageAssistant(assistant)
    const shouldHandleImageGeneration = ModelRouter.shouldUseImageGeneration(assistant)

    // 调试日志：追踪图片助手配置
    logger.debug('ImageGenerationMiddleware - 检查助手类型', {
      assistantId: assistant.id,
      assistantType: assistant.type,
      isImageTypeAssistant,
      shouldHandleImageGeneration,
      hasModel: !!assistant.model
    })

    if (!shouldHandleImageGeneration || typeof messages === 'string') {
      return next(context, params)
    }

    // 获取图片助手的配置
    const imageConfig = isImageTypeAssistant ? (assistant as ImageAssistant).imageConfig : null
    const imageModelId = isImageTypeAssistant ? (assistant as ImageAssistant).imageModelId : assistant.model?.id

    // 调试日志：追踪 imageConfig
    logger.debug('ImageGenerationMiddleware - 图片助手配置', {
      isImageTypeAssistant,
      hasImageConfig: !!imageConfig,
      imageSize: imageConfig?.imageSize,
      aspectRatio: imageConfig?.aspectRatio,
      batchCount: imageConfig?.batchCount,
      imageModelId
    })

    const stream = new ReadableStream<GenericChunk>({
      async start(controller) {
        const enqueue = (chunk: GenericChunk) => controller.enqueue(chunk)

        try {
          if (!imageModelId && !assistant.model) {
            throw new Error('Assistant model is not defined.')
          }

          const lastUserMessage = messages.findLast((m) => m.role === 'user')
          const lastAssistantMessage = messages.findLast((m) => m.role === 'assistant')

          if (!lastUserMessage) {
            throw new Error('No user message found for image generation.')
          }

          const userPrompt = getMainTextContent(lastUserMessage)

          // 构建增强的提示词（结合系统提示和模块配置）
          // 使用 PromptService.buildForAssistant 替代原有的 buildEnhancedPrompt
          const imageAssistant = isImageTypeAssistant ? (assistant as ImageAssistant) : null
          const enhancedPrompt = isImageTypeAssistant
            ? PromptService.buildForAssistant({
                imageType: imageAssistant!.imageType as ImageAssistantType,
                moduleConfig: imageAssistant!.imageConfig?.moduleConfig,
                userPrompt,
                systemPrompt: imageAssistant!.prompt
              }).fullPrompt
            : userPrompt

          // 收集参考图片为 base64 格式（与工作流保持一致）
          const referenceImages: string[] = []

          // Collect images from user message
          const userImageBlocks = findImageBlocks(lastUserMessage)
          for (const block of userImageBlocks) {
            if (block.file) {
              const binaryData: Uint8Array = await FileManager.readBinaryImage(block.file)
              const base64 = uint8ArrayToBase64(binaryData)
              referenceImages.push(base64)
            } else if (block.url) {
              // 如果是 data URL，提取 base64 部分
              const base64Part = block.url.replace(/^data:image\/\w+;base64,/, '')
              if (base64Part !== block.url) {
                referenceImages.push(base64Part)
              }
            }
          }

          // Collect images from last assistant message
          if (lastAssistantMessage) {
            const assistantImageBlocks = findImageBlocks(lastAssistantMessage)
            for (const block of assistantImageBlocks) {
              if (block.url) {
                const base64Part = block.url.replace(/^data:image\/\w+;base64,/, '')
                if (base64Part !== block.url) {
                  referenceImages.push(base64Part)
                }
              }
            }
          }

          // ==================== 自主模式检测与执行 ====================
          const useAutonomousMode = shouldUseAutonomousMode(userPrompt, referenceImages.length > 0)

          if (useAutonomousMode) {
            logger.info('ImageGenerationMiddleware - 检测到自主模式', {
              userPrompt: userPrompt.substring(0, 100),
              imageCount: referenceImages.length
            })

            enqueue({ type: ChunkType.IMAGE_CREATED })
            enqueue({
              type: ChunkType.THINKING_DELTA,
              text: '🤖 启动自主图片生成模式...\n\n'
            })

            try {
              // 获取 Provider 配置
              const state = store.getState()
              const geminiProvider = state.llm.providers.find((p) => p.type === 'gemini' && p.apiKey)
              if (!geminiProvider) {
                throw new Error('自主模式需要配置 Gemini API Key')
              }
              const geminiModel = geminiProvider.models.find((m) => m.id.includes('flash') || m.id.includes('pro'))
              if (!geminiModel) {
                throw new Error('未找到可用的 Gemini 模型')
              }

              // 设置生成和分析函数
              autonomousImageAgent.setGenerateImageFunc(async (params) => {
                try {
                  const imageResult = await WorkflowAiService.generateImage(geminiProvider, geminiModel, {
                    prompt: params.prompt,
                    systemPrompt: params.systemPrompt,
                    images: params.images,
                    aspectRatio: imageConfig?.aspectRatio || '3:4',
                    imageSize: imageConfig?.imageSize || '2K'
                  })
                  return { images: [imageResult] }
                } catch (error) {
                  return { images: [], error: error instanceof Error ? error.message : String(error) }
                }
              })

              autonomousImageAgent.setAnalyzeImageFunc(async (imgs, prompt) => {
                const loadedImages = await WorkflowAiService.loadImagesForVision(imgs)
                return WorkflowAiService.visionAnalysis(geminiProvider, geminiModel, {
                  systemPrompt:
                    'You are an expert fashion analyst. Analyze the image and provide structured information.',
                  userPrompt: prompt,
                  images: loadedImages
                })
              })

              // 转换为 ImageRef
              const imageRefs: ImageRef[] = referenceImages.map((base64) =>
                createBase64Ref(base64, { filename: 'input.png' })
              )

              // 执行自主生成
              const startTime = Date.now()
              const result = await autonomousImageAgent.execute(
                {
                  userMessage: userPrompt,
                  images: imageRefs,
                  constraints: {
                    taskType: 'auto'
                  }
                },
                (progress) => {
                  // 进度回调
                  enqueue({
                    type: ChunkType.THINKING_DELTA,
                    text: `${progress.message}\n`
                  })
                }
              )

              if (!result.success) {
                throw new Error(result.error || '自主生成失败')
              }

              // 收集所有生成的图片
              const allImages: string[] = []
              const extractBase64Values = (refs?: ImageRef[]): string[] => {
                if (!refs) return []
                return refs.filter((img) => img.type === 'base64').map((img) => `data:image/png;base64,${img.value}`)
              }

              allImages.push(...extractBase64Values(result.images.main))
              allImages.push(...extractBase64Values(result.images.back))
              allImages.push(...extractBase64Values(result.images.detail))

              if (allImages.length === 0) {
                throw new Error('未生成任何图片')
              }

              // 发送结果
              enqueue({
                type: ChunkType.THINKING_DELTA,
                text: `\n✅ 生成完成！共生成 ${allImages.length} 张图片\n`
              })

              enqueue({
                type: ChunkType.IMAGE_COMPLETE,
                image: { type: 'base64', images: allImages }
              })

              enqueue({
                type: ChunkType.LLM_RESPONSE_COMPLETE,
                response: {
                  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                  metrics: {
                    completion_tokens: 0,
                    time_first_token_millsec: 0,
                    time_completion_millsec: Date.now() - startTime
                  }
                }
              })

              controller.close()
              return
            } catch (error: any) {
              logger.error('自主模式执行失败', error)
              enqueue({
                type: ChunkType.TEXT_DELTA,
                text: `\n❌ 自主模式执行失败: ${error.message}\n\n切换到普通生成模式...`
              })
              // 继续执行普通模式
            }
          }

          // ==================== 普通图片生成模式 ====================
          enqueue({ type: ChunkType.IMAGE_CREATED })

          const startTime = Date.now()
          const modelId = imageModelId || assistant.model?.id || ''
          const model = assistant.model || { id: modelId, name: modelId, provider: provider.id, group: 'image' }

          // 构建图片生成参数（与工作流保持一致）
          // 关键：同时传递 image_size（原始值如 "2K"）和 size（像素值如 "2048x2048"）
          const serviceParams: ImageGenerationParams = {
            model: modelId,
            prompt: enhancedPrompt || '',
            n: 1,
            response_format: 'b64_json'
          }

          // 应用图片助手配置
          if (imageConfig) {
            // 设置图片尺寸 - 关键：同时传递 image_size 和 size
            if (imageConfig.imageSize) {
              serviceParams.image_size = imageConfig.imageSize // 原始值如 "2K"
              serviceParams.size = getImageSizeValue(imageConfig.imageSize) // 像素值如 "2048x2048"
            }
            // 设置宽高比（直接传递，如 "1:1", "3:4", "16:9"）
            if (imageConfig.aspectRatio) {
              serviceParams.aspect_ratio = imageConfig.aspectRatio
            }
            // 设置批量生成数量
            if (imageConfig.batchCount && imageConfig.batchCount > 1) {
              serviceParams.n = imageConfig.batchCount
            }

            // 调试日志：追踪实际传递的参数
            logger.debug('ImageGenerationMiddleware - 应用 imageConfig 到 serviceParams', {
              image_size: serviceParams.image_size,
              size: serviceParams.size,
              aspect_ratio: serviceParams.aspect_ratio,
              n: serviceParams.n
            })
          }

          // 添加参考图片
          if (referenceImages.length > 0) {
            serviceParams.image = referenceImages[0]
            serviceParams.reference_images = referenceImages
          }

          // 检查 Azure OpenAI GPT-Image-1-Mini 限制
          if (
            referenceImages.length > 0 &&
            model.id.toLowerCase().includes('gpt-image-1-mini') &&
            provider.type === 'azure-openai'
          ) {
            throw new Error('Azure OpenAI GPT-Image-1-Mini model does not support image editing.')
          }

          // 使用 ImageGenerationService 进行流式图片生成
          // 流式生成支持显示思考步骤
          const imageService = new ImageGenerationService(provider, model)

          // 收集生成的图片
          const generatedImages: string[] = []

          // 流式生成选项
          const streamingOptions: StreamingGenerationOptions = {
            signal,
            // 文本/思考内容回调
            onTextChunk: (text, type) => {
              if (type === 'thinking') {
                // 思考内容
                enqueue({
                  type: ChunkType.THINKING_DELTA,
                  text
                })
              } else {
                // 普通文本内容
                enqueue({
                  type: ChunkType.TEXT_DELTA,
                  text
                })
              }
            },
            // 图片回调
            onImageChunk: (image) => {
              generatedImages.push(image)
            }
          }

          // 使用流式生成
          const result = await imageService.generateStreaming(serviceParams, streamingOptions)

          if (!result.success || result.images.length === 0) {
            throw new Error(result.error || '图片生成失败')
          }

          // 确定图片类型
          let imageType: 'url' | 'base64' = 'base64'
          const imageList = result.images.map((img) => {
            if (img.startsWith('http://') || img.startsWith('https://')) {
              imageType = 'url'
              return img
            }
            // 确保返回完整的 data URL
            if (img.startsWith('data:')) {
              return img
            }
            return `data:image/png;base64,${img}`
          })

          enqueue({
            type: ChunkType.IMAGE_COMPLETE,
            image: { type: imageType, images: imageList }
          })

          enqueue({
            type: ChunkType.LLM_RESPONSE_COMPLETE,
            response: {
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              metrics: {
                completion_tokens: 0,
                time_first_token_millsec: 0,
                time_completion_millsec: Date.now() - startTime
              }
            }
          })
        } catch (error: any) {
          enqueue({ type: ChunkType.ERROR, error })
        } finally {
          controller.close()
        }
      }
    })

    return {
      stream,
      getText: () => ''
    }
  }
