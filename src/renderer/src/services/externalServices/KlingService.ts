/**
 * 可灵 (Kling) AI 视频生成服务客户端
 *
 * 基于旧后端 Python 实现的 TypeScript 移植
 * 提供图生视频功能
 *
 * 文档：https://app.klingai.com/cn/dev/document-api/apiReference/model/imageToVideo
 * 认证：https://app.klingai.com/cn/dev/document-api/apiReference/commonInfo
 */

import { loggerService } from '@logger'
import store from '@renderer/store'
import type { KlingConfig } from '@renderer/store/externalServices'

const logger = loggerService.withContext('Kling')

// ==================== 类型定义 ====================

/**
 * 图生视频请求参数
 */
export interface Image2VideoRequest {
  /** 模型名称 */
  model_name?: string
  /** 输入图片 URL 或 Base64 */
  image: string
  /** 图片尾帧（可选） */
  image_tail?: string
  /** 视频提示词 */
  prompt?: string
  /** 反向提示词 */
  negative_prompt?: string
  /** 创意程度 (0.0-1.0) */
  cfg_scale?: number
  /** 运动模式 */
  mode?: 'std' | 'pro'
  /** 视频时长（秒）*/
  duration?: '5' | '10'
  /** 宽高比 */
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  /** 回调 URL */
  callback_url?: string
  /** 外部任务 ID */
  external_task_id?: string
}

/**
 * Kling API 响应
 */
export interface KlingResponse<T = any> {
  code: number
  message: string
  request_id: string
  data: T
}

/**
 * 任务创建响应
 */
export interface TaskCreatedData {
  task_id: string
  task_status: string
  created_at: number
  updated_at: number
}

/**
 * 视频结果
 */
export interface VideoResult {
  id: string
  url: string
  duration: string
}

/**
 * 任务状态响应
 */
export interface TaskStatusData {
  task_id: string
  task_status: 'submitted' | 'processing' | 'succeed' | 'failed'
  task_status_msg?: string
  created_at: number
  updated_at: number
  task_result?: {
    videos: VideoResult[]
  }
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  success: boolean
  message: string
  latencyMs: number
  error?: string
}

// ==================== JWT 工具函数 ====================

/**
 * Base64 URL 安全编码
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 生成 HMAC-SHA256 签名
 * 使用 Web Crypto API
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const signatureArray = new Uint8Array(signature)

  // 转换为 Base64 URL 安全格式
  let binary = ''
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i])
  }
  return base64UrlEncode(binary)
}

/**
 * 生成 JWT Token
 *
 * 参考旧后端实现：
 * headers = {"alg": "HS256", "typ": "JWT"}
 * payload = {"iss": access_key, "exp": current_time + 1800, "nbf": current_time - 5}
 * token = jwt.encode(payload, secret_key, headers=headers)
 */
async function generateJwtToken(accessKey: string, secretKey: string): Promise<string> {
  const currentTime = Math.floor(Date.now() / 1000)

  // JWT Header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  // JWT Payload
  const payload = {
    iss: accessKey,
    exp: currentTime + 1800, // 30 分钟后过期
    nbf: currentTime - 5 // 5 秒前生效（允许时钟偏差）
  }

  // 编码 Header 和 Payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))

  // 创建签名
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const signature = await hmacSha256(secretKey, signatureInput)

  // 组装 JWT
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

// ==================== 服务类 ====================

class KlingService {
  private pollingInterval = 5000 // 轮询间隔（毫秒）
  private cachedToken: string | null = null
  private tokenExpiry: number = 0

  /**
   * 获取当前配置
   */
  private getConfig(): KlingConfig {
    return store.getState().externalServices.kling
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    const config = this.getConfig()
    return config.enabled && !!config.accessKey && !!config.secretKey
  }

  /**
   * 获取请求基础 URL
   */
  private getBaseUrl(): string {
    return this.getConfig().baseUrl.replace(/\/$/, '')
  }

  /**
   * 获取认证 Token（带缓存）
   */
  private async getAuthToken(): Promise<string> {
    const config = this.getConfig()

    if (!config.accessKey || !config.secretKey) {
      throw new Error('Kling Access Key 或 Secret Key 未配置')
    }

    const currentTime = Date.now()

    // 检查缓存的 token 是否有效（提前 5 分钟刷新）
    if (this.cachedToken && this.tokenExpiry > currentTime + 5 * 60 * 1000) {
      return this.cachedToken
    }

    // 生成新 token
    logger.info('生成新的 JWT Token')
    this.cachedToken = await generateJwtToken(config.accessKey, config.secretKey)
    this.tokenExpiry = currentTime + 25 * 60 * 1000 // 25 分钟后认为过期

    return this.cachedToken
  }

  /**
   * 发送 API 请求
   */
  private async request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<KlingResponse<T>> {
    const token = await this.getAuthToken()
    const url = `${this.getBaseUrl()}${endpoint}`

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP 错误 ${response.status}: ${errorText}`)
    }

    return response.json()
  }

  /**
   * 图生视频
   */
  async image2Video(params: Image2VideoRequest): Promise<string> {
    const config = this.getConfig()

    // 设置默认值，使用用户配置的模型名称
    const requestBody: Image2VideoRequest = {
      model_name: config.defaultModel || 'kling-v1-6',
      mode: config.defaultMode,
      duration: String(config.defaultDuration) as '5' | '10',
      ...params
    }

    logger.info('提交图生视频任务:', {
      model_name: requestBody.model_name,
      mode: requestBody.mode,
      duration: requestBody.duration,
      hasPrompt: !!requestBody.prompt,
      hasImage: !!requestBody.image
    })

    const result = await this.request<TaskCreatedData>('/v1/videos/image2video', 'POST', requestBody)

    if (result.code !== 0) {
      throw new Error(result.message || '任务提交失败')
    }

    logger.info('任务提交成功:', result.data.task_id)
    return result.data.task_id
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusData> {
    const result = await this.request<TaskStatusData>(`/v1/videos/image2video/${taskId}`)

    if (result.code !== 0) {
      throw new Error(result.message || '获取任务状态失败')
    }

    return result.data
  }

  /**
   * 图生视频并等待结果
   */
  async image2VideoAndWait(
    params: Image2VideoRequest,
    options: {
      timeout?: number // 毫秒
      onProgress?: (status: string, progress: number) => void
    } = {}
  ): Promise<string[]> {
    const { timeout = this.getConfig().timeout * 1000, onProgress } = options

    // 提交任务
    const taskId = await this.image2Video(params)
    onProgress?.('任务已提交', 10)

    // 轮询等待结果
    const startTime = Date.now()
    let progress = 10

    while (true) {
      // 检查超时
      if (Date.now() - startTime > timeout) {
        throw new Error('视频生成超时')
      }

      // 获取任务状态
      const status = await this.getTaskStatus(taskId)

      switch (status.task_status) {
        case 'succeed':
          // 任务完成
          const videos = status.task_result?.videos || []
          const urls = videos.map((v) => v.url)
          logger.info('视频生成完成:', urls)
          onProgress?.('视频生成完成', 100)
          return urls

        case 'failed':
          throw new Error(status.task_status_msg || '视频生成失败')

        case 'processing':
          progress = Math.min(progress + 5, 90)
          onProgress?.('视频生成中', progress)
          break

        case 'submitted':
          onProgress?.('任务排队中', progress)
          break

        default:
          logger.warn('未知状态:', status.task_status)
      }

      // 等待后继续轮询
      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval))
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now()

    try {
      // 尝试生成 token 来验证配置
      await this.getAuthToken()
      const latencyMs = Math.round(performance.now() - startTime)

      return {
        success: true,
        message: 'API 配置正确，Token 生成成功',
        latencyMs
      }
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime)
      const errorMessage = error instanceof Error ? error.message : String(error)

      return {
        success: false,
        message: `配置验证失败: ${errorMessage}`,
        latencyMs,
        error: errorMessage
      }
    }
  }

  /**
   * 清除缓存的 Token
   */
  clearTokenCache(): void {
    this.cachedToken = null
    this.tokenExpiry = 0
  }
}

// 导出单例实例
export const klingService = new KlingService()
export default klingService
