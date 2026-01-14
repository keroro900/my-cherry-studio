/**
 * 统一视频生成服务
 *
 * 核心原则：
 * 1. 支持 v1 (/v1/video/generations) 和 v2 (/v2/videos/generations) API 格式
 * 2. 支持异步任务：提交任务 → 轮询状态 → 获取视频
 * 3. 支持文生视频和图生视频两种模式
 * 4. 自动检测 API 版本并适配请求格式
 */

import { loggerService } from '@logger'
import AiProvider from '@renderer/aiCore'
import type { Model, Provider } from '@renderer/types'

const logger = loggerService.withContext('VideoGenerationService')

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 视频生成参数（统一格式，兼容 v1/v2 API）
 */
export interface VideoGenerationParams {
  // === 基础参数（所有模型通用）===
  prompt: string
  model: string

  // === 图生视频参数 ===
  image?: string // Base64 或 URL（首帧图片）
  images?: string[] // v2 API: 图片数组
  image_end?: string // 尾帧图片（部分模型支持）
  videos?: string[] // v2 API: 视频数组（用于视频到视频）

  // === 尺寸/时长参数 ===
  size?: string // "1920x1080" 或 "1280x720"
  aspect_ratio?: string // "16:9", "9:16", "1:1"
  ratio?: string // v2 API: 宽高比 ("21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "9:21", "keep_ratio", "adaptive")
  resolution?: string // v2 API: 分辨率 ("480p", "720p", "1080p")
  duration?: number // 视频时长（秒）
  fps?: number // 帧率
  n?: number // 生成数量

  // === v2 API 高级参数 ===
  enhance_prompt?: boolean // 提示词优化（中文翻译为英文）
  enable_upsample?: boolean // 分辨率提升到 1080p
  watermark?: boolean // AI 生成水印
  camerafixed?: boolean // 固定镜头
  return_last_frame?: boolean // 返回视频最后一帧

  // === 通用高级参数 ===
  negative_prompt?: string // 反向提示词
  seed?: number // 随机种子
  cfg_scale?: number // 引导比例
  motion_bucket_id?: number // 运动强度（Stability AI）

  // === 扩展参数 ===
  [key: string]: any
}

/**
 * 视频生成任务状态
 */
export interface VideoGenerationTask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number // 0-100
  created: number
  updated?: number
  error?: string
  data?: {
    url: string
    duration?: number
    width?: number
    height?: number
  }[]
}

/**
 * 视频生成结果
 */
export interface VideoGenerationResult {
  success: boolean
  taskId?: string
  videos?: string[] // 视频 URL 数组
  error?: string
  metadata?: Record<string, any>
}

/**
 * 生成选项
 */
export interface VideoGenerationOptions {
  signal?: AbortSignal
  timeout?: number // 毫秒，默认 600000 (10分钟)
  pollingInterval?: number // 毫秒，默认 5000
  onProgress?: (status: string, progress: number) => void
}

// ============================================================================
// 视频生成服务
// ============================================================================

export class VideoGenerationService {
  private provider: Provider
  private model: Model
  private apiVersion: 'v1' | 'v2'

  constructor(provider: Provider, model: Model) {
    this.provider = provider
    this.model = model
    // 根据模型名称检测 API 版本
    this.apiVersion = this.detectApiVersion()
  }

  /**
   * 检测 API 版本
   * v2 API 支持: Veo, Seedance(doubao) 等新模型
   */
  private detectApiVersion(): 'v1' | 'v2' {
    const modelId = this.model.id.toLowerCase()
    // v2 API 模型列表
    const v2Models = ['veo', 'veo2', 'veo3', 'veo3.1', 'seedance', 'doubao', 'kling', 'hailuo', 'minimax']
    if (v2Models.some((m) => modelId.includes(m))) {
      return 'v2'
    }
    return 'v1'
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
    return 'https://api.openai.com'
  }

  /**
   * 获取提交任务的 URL
   */
  private getSubmitUrl(): string {
    const baseUrl = this.getBaseUrl()
    return this.apiVersion === 'v2' ? `${baseUrl}/v2/videos/generations` : `${baseUrl}/v1/video/generations`
  }

  /**
   * 获取查询任务状态的 URL
   */
  private getStatusUrl(taskId: string): string {
    const baseUrl = this.getBaseUrl()
    return this.apiVersion === 'v2'
      ? `${baseUrl}/v2/videos/generations/${taskId}`
      : `${baseUrl}/v1/video/generations/${taskId}`
  }

  /**
   * 构建请求头
   */
  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  }

  /**
   * 构建 v1 API 请求体
   */
  private buildV1RequestBody(params: VideoGenerationParams): Record<string, any> {
    const body: Record<string, any> = {
      model: params.model || this.model.id,
      prompt: params.prompt,
      n: params.n || 1
    }

    if (params.size) body.size = params.size
    else if (params.aspect_ratio) body.aspect_ratio = params.aspect_ratio

    if (params.duration) body.duration = params.duration
    if (params.fps) body.fps = params.fps
    if (params.image) body.image = params.image
    if (params.image_end) body.image_end = params.image_end
    if (params.negative_prompt) body.negative_prompt = params.negative_prompt
    if (params.seed !== undefined) body.seed = params.seed
    if (params.cfg_scale !== undefined) body.cfg_scale = params.cfg_scale
    if (params.motion_bucket_id !== undefined) body.motion_bucket_id = params.motion_bucket_id

    return body
  }

  /**
   * 构建 v2 API 请求体
   */
  private buildV2RequestBody(params: VideoGenerationParams): Record<string, any> {
    const body: Record<string, any> = {
      model: params.model || this.model.id,
      prompt: params.prompt
    }

    // 图片参数（v2 使用 images 数组）
    if (params.images && params.images.length > 0) {
      body.images = params.images
    } else if (params.image) {
      // 兼容 v1 格式的单图片
      body.images = [params.image]
      if (params.image_end) {
        body.images.push(params.image_end)
      }
    }

    // 视频参数（视频到视频）
    if (params.videos && params.videos.length > 0) {
      body.videos = params.videos
    }

    // 尺寸/比例参数
    if (params.ratio) {
      body.ratio = params.ratio
    } else if (params.aspect_ratio) {
      body.aspect_ratio = params.aspect_ratio
    }

    // 分辨率
    if (params.resolution) {
      body.resolution = params.resolution
    }

    // 时长
    if (params.duration) {
      body.duration = params.duration
    }

    // v2 特有参数
    if (params.enhance_prompt !== undefined) body.enhance_prompt = params.enhance_prompt
    if (params.enable_upsample !== undefined) body.enable_upsample = params.enable_upsample
    if (params.watermark !== undefined) body.watermark = params.watermark
    if (params.camerafixed !== undefined) body.camerafixed = params.camerafixed
    if (params.return_last_frame !== undefined) body.return_last_frame = params.return_last_frame

    // 通用高级参数
    if (params.seed !== undefined) body.seed = params.seed

    return body
  }

  /**
   * 构建请求体（自动选择 v1 或 v2 格式）
   */
  private buildRequestBody(params: VideoGenerationParams): Record<string, any> {
    return this.apiVersion === 'v2' ? this.buildV2RequestBody(params) : this.buildV1RequestBody(params)
  }

  /**
   * 将 v2 API 状态映射到内部状态
   */
  private mapV2Status(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const statusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {
      NOT_START: 'pending',
      SUBMITTED: 'pending',
      QUEUED: 'pending',
      IN_PROGRESS: 'processing',
      SUCCESS: 'completed',
      FAILURE: 'failed',
      // 兼容小写
      pending: 'pending',
      processing: 'processing',
      completed: 'completed',
      failed: 'failed'
    }
    return statusMap[status] || 'pending'
  }

  /**
   * 提交视频生成任务
   */
  async submitTask(params: VideoGenerationParams): Promise<VideoGenerationTask> {
    const apiKey = this.getApiKey()
    const url = this.getSubmitUrl()

    const body = this.buildRequestBody(params)

    logger.info('Submitting video generation task', {
      apiVersion: this.apiVersion,
      model: body.model,
      hasImages: !!(params.images?.length || params.image),
      duration: params.duration
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.error('Video API error:', { status: response.status, body: errorText })

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

    // v2 API 返回 task_id
    if (result.task_id) {
      return {
        id: result.task_id,
        status: 'pending',
        created: Date.now()
      }
    }

    // v1 API: 检查是否为同步响应（直接返回视频）
    if (result.data && Array.isArray(result.data) && result.data[0]?.url) {
      return {
        id: result.id || `sync_${Date.now()}`,
        status: 'completed',
        created: result.created || Date.now(),
        data: result.data
      }
    }

    // 异步响应：返回任务信息
    return {
      id: result.id || result.task_id,
      status: this.mapV2Status(result.status) || 'pending',
      progress: result.progress,
      created: result.created || Date.now()
    }
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<VideoGenerationTask> {
    const apiKey = this.getApiKey()
    const url = this.getStatusUrl(taskId)

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(apiKey)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.error('Video status API error:', { status: response.status, body: errorText })

      let errorMessage = `获取任务状态失败: HTTP ${response.status}`
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

    // 处理 v2 API 响应格式
    if (this.apiVersion === 'v2') {
      // 提取视频 URL (v2 API 使用 data.output 或 data.outputs)
      let videoData: { url: string }[] | undefined
      if (result.data?.output) {
        videoData = [{ url: result.data.output }]
      } else if (result.data?.outputs && result.data.outputs.length > 0) {
        videoData = result.data.outputs.map((url: string) => ({ url }))
      }

      return {
        id: result.task_id || taskId,
        status: this.mapV2Status(result.status),
        progress: result.progress,
        created: result.submit_time ? new Date(result.submit_time).getTime() : Date.now(),
        updated: result.finish_time ? new Date(result.finish_time).getTime() : undefined,
        error: result.fail_reason,
        data: videoData
      }
    }

    // v1 API 响应格式
    return {
      id: result.id || taskId,
      status: this.mapV2Status(result.status),
      progress: result.progress,
      created: result.created,
      updated: result.updated,
      error: result.error?.message || result.error,
      data: result.data
    }
  }

  /**
   * 下载视频（某些 API 需要单独调用下载端点）
   */
  async downloadVideo(taskId: string): Promise<string> {
    const apiKey = this.getApiKey()
    const baseUrl = this.getBaseUrl()
    const url = `${baseUrl}/v1/video/generations/${taskId}/download`

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(apiKey)
    })

    if (!response.ok) {
      throw new Error(`下载视频失败: HTTP ${response.status}`)
    }

    const result = await response.json()
    return result.url || result.data?.[0]?.url
  }

  /**
   * 生成视频（完整流程：提交 + 轮询 + 返回）
   */
  async generate(params: VideoGenerationParams, options?: VideoGenerationOptions): Promise<VideoGenerationResult> {
    const { signal, timeout = 600000, pollingInterval = 5000, onProgress } = options || {}

    const startTime = Date.now()
    const requestId = Math.random().toString(36).substring(2, 8)

    logger.debug(`[${requestId}] ========== 开始视频生成 ==========`)
    logger.debug(`[${requestId}] 参数:`, {
      model: params.model,
      hasImage: !!params.image,
      duration: params.duration,
      size: params.size
    })

    try {
      // 1. 提交任务
      onProgress?.('提交任务中...', 5)
      const task = await this.submitTask(params)

      logger.debug(`[${requestId}] 任务已提交:`, { taskId: task.id, status: task.status })

      // 2. 如果是同步响应（已完成），直接返回
      if (task.status === 'completed' && task.data) {
        logger.debug(`[${requestId}] 同步响应，直接返回`)
        onProgress?.('视频生成完成', 100)
        return {
          success: true,
          taskId: task.id,
          videos: task.data.map((d) => d.url),
          metadata: {
            duration_ms: Date.now() - startTime,
            generatedAt: new Date().toISOString()
          }
        }
      }

      // 3. 异步模式：轮询任务状态
      let currentTask = task
      let progress = 10

      while (true) {
        // 检查超时
        if (Date.now() - startTime > timeout) {
          throw new Error(`视频生成超时（${timeout / 1000}秒）`)
        }

        // 检查取消信号
        if (signal?.aborted) {
          throw new Error('视频生成已取消')
        }

        // 等待后轮询
        await this.sleep(pollingInterval)

        // 获取任务状态
        currentTask = await this.getTaskStatus(task.id)

        logger.debug(`[${requestId}] 任务状态:`, {
          status: currentTask.status,
          progress: currentTask.progress
        })

        switch (currentTask.status) {
          case 'completed':
            onProgress?.('视频生成完成', 100)
            logger.debug(`[${requestId}] 完成，耗时: ${Date.now() - startTime}ms`)

            // 获取视频 URL
            let videos: string[] = []
            if (currentTask.data) {
              videos = currentTask.data.map((d) => d.url)
            } else {
              // 某些 API 需要单独调用下载端点
              try {
                const downloadUrl = await this.downloadVideo(task.id)
                videos = [downloadUrl]
              } catch (downloadError) {
                logger.warn(`[${requestId}] 下载端点失败，尝试从任务数据获取`)
              }
            }

            return {
              success: true,
              taskId: currentTask.id,
              videos,
              metadata: {
                duration_ms: Date.now() - startTime,
                generatedAt: new Date().toISOString(),
                videoData: currentTask.data
              }
            }

          case 'failed':
            throw new Error(currentTask.error || '视频生成失败')

          case 'processing':
            // 更新进度
            if (currentTask.progress !== undefined) {
              progress = currentTask.progress
            } else {
              progress = Math.min(progress + 5, 90)
            }
            onProgress?.('生成中...', progress)
            break

          case 'pending':
            onProgress?.('排队中...', progress)
            break

          default:
            logger.warn(`[${requestId}] 未知状态:`, { status: currentTask.status })
        }
      }
    } catch (error) {
      logger.error(`[${requestId}] 视频生成失败:`, { error: (error as Error).message })
      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          duration_ms: Date.now() - startTime,
          failedAt: new Date().toISOString()
        }
      }
    }
  }

  /**
   * 文生视频
   */
  async text2Video(
    prompt: string,
    options?: VideoGenerationOptions & {
      duration?: number
      aspectRatio?: string
      size?: string
      seed?: number
    }
  ): Promise<VideoGenerationResult> {
    return this.generate(
      {
        prompt,
        model: this.model.id,
        duration: options?.duration,
        aspect_ratio: options?.aspectRatio,
        size: options?.size,
        seed: options?.seed
      },
      options
    )
  }

  /**
   * 图生视频
   */
  async image2Video(
    image: string,
    prompt: string,
    options?: VideoGenerationOptions & {
      imageEnd?: string
      duration?: number
      aspectRatio?: string
      size?: string
      seed?: number
    }
  ): Promise<VideoGenerationResult> {
    return this.generate(
      {
        prompt,
        model: this.model.id,
        image,
        image_end: options?.imageEnd,
        duration: options?.duration,
        aspect_ratio: options?.aspectRatio,
        size: options?.size,
        seed: options?.seed
      },
      options
    )
  }

  /**
   * 睡眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createVideoGenerationService(provider: Provider, model: Model): VideoGenerationService {
  return new VideoGenerationService(provider, model)
}

/**
 * 快速生成视频
 */
export async function quickGenerateVideo(
  provider: Provider,
  model: Model,
  params: VideoGenerationParams,
  options?: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const service = createVideoGenerationService(provider, model)
  return service.generate(params, options)
}
