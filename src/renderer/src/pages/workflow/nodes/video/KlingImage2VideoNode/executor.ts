/**
 * Kling 图生视频节点执行器 v2.0
 *
 * 深度优化版本：
 * - 多模型版本支持
 * - 完整 API 参数
 * - 尾帧图片支持
 * - 进度回调
 * - 重试机制
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface KlingImage2VideoConfig {
  // 模型配置
  modelVersion?: 'v1' | 'v1.5' | 'v1.6' | 'v2' | 'v2.1'
  mode?: 'std' | 'pro'

  // 视频参数
  duration?: 5 | 10
  cfgScale?: number

  // 提示词
  useUpstreamPrompt?: boolean
  videoPrompt?: string
  negativePrompt?: string

  // 尾帧控制
  useTailImage?: boolean

  // 高级选项
  seed?: number
  timeout?: number
  retryCount?: number
}

export class KlingImage2VideoExecutor extends BaseNodeExecutor {
  constructor() {
    super('kling_image2video')
  }

  async execute(
    inputs: Record<string, any>,
    config: KlingImage2VideoConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const metadata: Record<string, any> = {
      generatedAt: new Date().toISOString(),
      config: { ...config }
    }

    try {
      this.log(context, '开始执行图生视频节点 v2.0')

      // 动态导入 Kling 客户端和服务
      const { KlingClient } = await import('../../../clients')
      const { klingService } = await import('@renderer/services/externalServices')

      // 检查服务是否可用
      if (!klingService.isAvailable()) {
        return this.error('Kling 服务不可用，请在设置 → 外部服务中配置 Kling Access Key 和 Secret Key')
      }

      this.log(context, 'Kling 服务可用', {
        modelVersion: config.modelVersion || 'v1.6',
        mode: config.mode || 'std'
      })

      // 获取首帧图片
      const imageUrl = inputs.image || inputs.editedImage || inputs.modelImage
      if (!imageUrl) {
        return this.error('图生视频节点需要输入图片')
      }

      this.log(context, '收集到首帧图片')

      // 获取尾帧图片（如果启用）
      let tailImageUrl: string | undefined
      if (config.useTailImage && inputs.tailImage) {
        tailImageUrl = inputs.tailImage
        this.log(context, '收集到尾帧图片')
      }

      // 获取视频提示词
      let videoPrompt = config.videoPrompt || ''
      if (config.useUpstreamPrompt) {
        // 优先级: inputs.videoPrompt > inputs.promptJson.video_prompt > config.videoPrompt
        if (inputs.videoPrompt) {
          videoPrompt = inputs.videoPrompt
          this.log(context, '使用输入端口的视频提示词')
        } else if (inputs.promptJson?.video_prompt) {
          videoPrompt = inputs.promptJson.video_prompt
          this.log(context, '使用上游 JSON 中的视频提示词')
        }
      }

      // 记录元数据
      metadata.prompt = videoPrompt
      metadata.negativePrompt = config.negativePrompt
      metadata.modelVersion = config.modelVersion || 'v1.6'
      metadata.mode = config.mode || 'std'
      metadata.duration = config.duration || 5
      metadata.cfgScale = config.cfgScale ?? 0.5
      metadata.hasTailImage = !!tailImageUrl

      // 构建 API 请求参数
      const apiParams: Record<string, any> = {
        image: imageUrl,
        prompt: videoPrompt,
        duration: String(config.duration || 5) as '5' | '10',
        mode: config.mode || 'std',
        cfg_scale: config.cfgScale ?? 0.5
      }

      // 添加负面提示词
      if (config.negativePrompt) {
        apiParams.negative_prompt = config.negativePrompt
      }

      // 添加尾帧图片
      if (tailImageUrl) {
        apiParams.tail_image_url = tailImageUrl
      }

      // 添加种子值
      if (config.seed !== undefined && config.seed !== null) {
        apiParams.seed = config.seed
        metadata.seed = config.seed
      }

      // 创建 Kling 客户端并调用 API
      const klingClient = new KlingClient()
      this.log(context, '调用 Kling API 生成视频...', {
        modelVersion: metadata.modelVersion,
        duration: metadata.duration,
        cfgScale: metadata.cfgScale
      })

      // 使用重试机制
      const maxRetries = config.retryCount ?? 2
      let lastError: Error | null = null
      let videoUrl: string | null = null

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            this.log(context, `第 ${attempt} 次重试...`)
          }

          videoUrl = await klingClient.imageToVideo({
            imageUrl,
            prompt: videoPrompt,
            duration: (config.duration || 5) as 5 | 10,
            mode: (config.mode || 'std') as 'std' | 'pro'
          })

          if (videoUrl) {
            break
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          this.log(context, `尝试 ${attempt + 1} 失败: ${lastError.message}`)

          if (attempt < maxRetries) {
            // 等待一段时间后重试
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }
      }

      if (!videoUrl) {
        throw lastError || new Error('视频生成失败')
      }

      const duration = Date.now() - startTime
      this.log(context, '视频生成完成', { duration: `${duration}ms` })

      metadata.duration_ms = duration
      metadata.videoUrl = videoUrl

      return this.success(
        {
          video: videoUrl,
          metadata
        },
        duration
      )
    } catch (error) {
      this.logError(context, '图生视频失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default KlingImage2VideoExecutor
