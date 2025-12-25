/**
 * 统一视频生成节点执行器
 *
 * 支持通过 OpenAI 兼容 API 调用各种视频生成模型
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface UnifiedVideoGenerationConfig {
  // 模型配置（新格式）
  model?: { id: string; provider: string } | null
  // 兼容旧格式
  providerId?: string
  modelId?: string

  // 生成模式
  mode?: 'text2video' | 'image2video'

  // 视频参数
  duration?: number
  aspectRatio?: string
  resolution?: string

  // 提示词配置
  useUpstreamPrompt?: boolean
  videoPrompt?: string
  negativePrompt?: string

  // 高级选项
  seed?: number
  cfgScale?: number
  timeout?: number
}

export class UnifiedVideoGenerationExecutor extends BaseNodeExecutor {
  constructor() {
    super('unified_video_generation')
  }

  async execute(
    inputs: Record<string, any>,
    config: UnifiedVideoGenerationConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const metadata: Record<string, any> = {
      generatedAt: new Date().toISOString(),
      config: { ...config }
    }

    try {
      this.log(context, '开始视频生成')

      // 1. 解析模型配置
      let providerId: string | undefined
      let modelId: string | undefined

      if (config.model && typeof config.model === 'object') {
        providerId = config.model.provider
        modelId = config.model.id
      } else {
        providerId = config.providerId
        modelId = config.modelId
      }

      if (!providerId || !modelId) {
        return this.error('请在节点配置中选择视频生成模型')
      }

      this.log(context, '使用模型', { provider: providerId, model: modelId })

      // 2. 获取提示词
      let prompt = ''

      if (config.useUpstreamPrompt !== false) {
        // 优先使用上游输入
        if (inputs.prompt) {
          prompt = inputs.prompt
        } else if (inputs.videoPrompt) {
          prompt = inputs.videoPrompt
        } else if (inputs.promptJson?.video_prompt) {
          prompt = inputs.promptJson.video_prompt
        } else if (inputs.promptJson?.prompt) {
          prompt = inputs.promptJson.prompt
        }
      }

      // 如果上游没有提示词，使用配置中的提示词
      if (!prompt) {
        prompt = config.videoPrompt || ''
      }

      if (!prompt && config.mode !== 'image2video') {
        return this.error('文生视频模式需要提供提示词')
      }

      this.log(context, '提示词', { prompt: prompt.substring(0, 100) + '...' })

      // 3. 获取图片输入（图生视频模式）
      const sourceImage = inputs.image || inputs.baseImage
      const endImage = inputs.imageEnd || inputs.tailImage

      if (config.mode === 'image2video' && !sourceImage) {
        return this.error('图生视频模式需要提供首帧图片')
      }

      // 4. 获取负面提示词
      const negativePrompt = inputs.negativePrompt || config.negativePrompt

      // 5. 计算分辨率
      const size = this.calculateSize(config.aspectRatio, config.resolution)

      // 6. 动态导入服务
      const { VideoGenerationService } = await import('@renderer/services/VideoGenerationService')
      const { getProviderById } = await import('@renderer/services/ProviderService')

      const provider = getProviderById(providerId)
      if (!provider) {
        return this.error(`未找到服务商: ${providerId}`)
      }

      // 创建模型对象
      const model = {
        id: modelId,
        provider: providerId,
        name: modelId,
        group: 'video',
        endpoint_type: 'video-generation' as const
      }

      const service = new VideoGenerationService(provider, model)

      this.log(context, '提交视频生成任务...', {
        mode: config.mode,
        duration: config.duration,
        size
      })

      // 7. 调用视频生成服务
      const result = await service.generate(
        {
          prompt,
          model: modelId,
          image: sourceImage,
          image_end: endImage,
          size,
          aspect_ratio: config.aspectRatio,
          duration: config.duration,
          negative_prompt: negativePrompt,
          seed: config.seed,
          cfg_scale: config.cfgScale
        },
        {
          timeout: (config.timeout || 600) * 1000,
          signal: context.abortSignal,
          onProgress: (status, progress) => {
            this.log(context, `${status} (${progress}%)`)
          }
        }
      )

      if (!result.success) {
        throw new Error(result.error || '视频生成失败')
      }

      if (!result.videos?.length) {
        throw new Error('未获取到视频 URL')
      }

      const duration = Date.now() - startTime
      this.log(context, '视频生成完成', { duration: `${duration}ms` })

      metadata.duration_ms = duration
      metadata.videoUrl = result.videos[0]
      metadata.taskId = result.taskId

      return this.success(
        {
          video: result.videos[0],
          metadata
        },
        duration
      )
    } catch (error) {
      this.logError(context, '视频生成失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 根据宽高比和分辨率计算实际尺寸
   */
  private calculateSize(aspectRatio?: string, resolution?: string): string {
    const baseHeight = resolution === '4k' ? 2160 : resolution === '720p' ? 720 : 1080

    const ratios: Record<string, [number, number]> = {
      '16:9': [16, 9],
      '9:16': [9, 16],
      '1:1': [1, 1],
      '4:3': [4, 3],
      '3:4': [3, 4]
    }

    const [w, h] = ratios[aspectRatio || '16:9'] || [16, 9]

    if (w > h) {
      // 横屏
      const width = Math.round((baseHeight * w) / h)
      return `${width}x${baseHeight}`
    } else if (h > w) {
      // 竖屏
      const height = Math.round((baseHeight * h) / w)
      return `${baseHeight}x${height}`
    } else {
      // 方形
      return `${baseHeight}x${baseHeight}`
    }
  }
}

export default UnifiedVideoGenerationExecutor
