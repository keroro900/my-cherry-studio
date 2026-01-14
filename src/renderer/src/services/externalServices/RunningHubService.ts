/**
 * RunningHub 服务客户端
 *
 * 基于旧后端 Python 实现的 TypeScript 移植
 * 提供 RunningHub AI 应用平台的 API 调用功能
 *
 * 文档：https://www.runninghub.cn/runninghub-api-doc-cn/doc-7527911
 */

import { loggerService } from '@logger'
import store from '@renderer/store'
import type { RunningHubConfig } from '@renderer/store/externalServices'

const logger = loggerService.withContext('RunningHub')

// ==================== 类型定义 ====================

/**
 * RunningHub 节点信息
 */
export interface RunningHubNodeInfo {
  nodeId: string
  nodeName?: string
  fieldName: string
  fieldType: 'STRING' | 'LIST' | 'IMAGE' | 'AUDIO' | 'VIDEO'
  fieldValue: string
  fieldData?: string // JSON string for LIST type options
  description?: string
  descriptionEn?: string
}

/**
 * RunningHub API 响应
 */
export interface RunningHubResponse<T = any> {
  code: number
  msg: string
  data: T
}

/**
 * 获取 webapp 配置的响应
 */
export interface WebappConfigResponse {
  nodeInfoList: RunningHubNodeInfo[]
  covers?: Array<{ thumbnailUri: string }>
}

/**
 * 上传文件响应
 */
export interface UploadFileResponse {
  fileName: string
}

/**
 * 运行任务响应
 */
export interface RunTaskResponse {
  taskId: string
}

/**
 * 任务输出结果
 */
export interface TaskOutput {
  fileUrl?: string
  url?: string
  fileType?: string
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

// ==================== 状态码定义 ====================

/**
 * RunningHub 状态码
 */
export const RH_STATUS = {
  SUCCESS: 0,
  TASK_RUNNING: 804,
  TASK_QUEUED: 813,
  TASK_FAILED: 805
}

// ==================== 服务类 ====================

class RunningHubService {
  private pollingInterval = 3000 // 轮询间隔（毫秒）

  /**
   * 获取当前配置
   */
  private getConfig(): RunningHubConfig {
    return store.getState().externalServices.runningHub
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    const config = this.getConfig()
    return config.enabled && !!config.apiKey
  }

  /**
   * 获取请求基础 URL
   */
  private getBaseUrl(): string {
    return this.getConfig().baseUrl.replace(/\/$/, '')
  }

  /**
   * 获取 API Key
   */
  private getApiKey(): string {
    const key = this.getConfig().apiKey
    if (!key) {
      throw new Error('RunningHub API Key 未配置')
    }
    return key
  }

  /**
   * 获取 webapp 的输入输出配置
   */
  async getWebappConfig(webappId: string): Promise<WebappConfigResponse> {
    const url = `${this.getBaseUrl()}/api/webapp/apiCallDemo`
    const params = new URLSearchParams({
      apiKey: this.getApiKey(),
      webappId
    })

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`)
    }

    const result: RunningHubResponse<WebappConfigResponse> = await response.json()

    if (result.code !== RH_STATUS.SUCCESS) {
      throw new Error(result.msg || '获取配置失败')
    }

    return result.data
  }

  /**
   * 上传文件到 RunningHub
   */
  async uploadFile(file: File | Blob, fileName?: string): Promise<string> {
    const url = `${this.getBaseUrl()}/task/openapi/upload`

    const formData = new FormData()
    formData.append('apiKey', this.getApiKey())
    formData.append('file', file, fileName || (file instanceof File ? file.name : 'file'))

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`)
    }

    const result: RunningHubResponse<UploadFileResponse> = await response.json()

    if (result.code !== RH_STATUS.SUCCESS) {
      throw new Error(result.msg || '文件上传失败')
    }

    logger.info('文件上传成功', { value: result.data.fileName })
    return result.data.fileName
  }

  /**
   * 上传图片（Base64 格式）
   */
  async uploadBase64Image(base64Data: string, fileName: string = 'image.png'): Promise<string> {
    // 移除 data URL 前缀（如果有）
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const binaryString = atob(base64Content)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const blob = new Blob([bytes], { type: 'image/png' })
    return this.uploadFile(blob, fileName)
  }

  /**
   * 运行 AI 应用
   */
  async runAiApp(webappId: string, nodeInfoList: RunningHubNodeInfo[], instanceType?: 'std' | 'plus'): Promise<string> {
    const url = `${this.getBaseUrl()}/task/openapi/ai-app/run`

    const payload: Record<string, any> = {
      webappId,
      apiKey: this.getApiKey(),
      nodeInfoList
    }

    if (instanceType) {
      payload.instanceType = instanceType
    }

    logger.info('提交任务', {
      value: {
        webappId,
        instanceType,
        nodeCount: nodeInfoList.length
      }
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`)
    }

    const result: RunningHubResponse<RunTaskResponse> = await response.json()

    if (result.code !== RH_STATUS.SUCCESS) {
      throw new Error(result.msg || '任务提交失败')
    }

    logger.info('任务提交成功', { value: result.data.taskId })
    return result.data.taskId
  }

  /**
   * 获取任务输出
   */
  async getTaskOutputs(taskId: string): Promise<RunningHubResponse<TaskOutput[] | TaskOutput>> {
    const url = `${this.getBaseUrl()}/task/openapi/outputs`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: this.getApiKey(),
        taskId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 运行 AI 应用并等待结果
   */
  async runAndWait(
    webappId: string,
    nodeInfoList: RunningHubNodeInfo[],
    options: {
      instanceType?: 'std' | 'plus'
      timeout?: number // 毫秒
      pollingInterval?: number // 毫秒
      onProgress?: (status: string, progress: number) => void
    } = {}
  ): Promise<string[]> {
    const { timeout = this.getConfig().timeout * 1000, pollingInterval = this.pollingInterval, onProgress } = options

    // 提交任务
    const taskId = await this.runAiApp(webappId, nodeInfoList, options.instanceType)
    onProgress?.('任务已提交', 10)

    // 轮询等待结果
    const startTime = Date.now()
    let progress = 10

    while (true) {
      // 检查超时
      if (Date.now() - startTime > timeout) {
        throw new Error('任务执行超时')
      }

      // 获取任务状态
      const result = await this.getTaskOutputs(taskId)

      if (result.code === RH_STATUS.SUCCESS && result.data) {
        // 任务完成，提取文件 URL
        const outputs = Array.isArray(result.data) ? result.data : [result.data]
        const urls = outputs.map((output) => output.fileUrl || output.url).filter((url): url is string => !!url)

        logger.info('任务完成', { value: urls })
        onProgress?.('任务完成', 100)
        return urls
      }

      if (result.code === RH_STATUS.TASK_RUNNING || result.code === RH_STATUS.TASK_QUEUED) {
        // 任务进行中
        progress = Math.min(progress + 5, 90)
        const status = result.code === RH_STATUS.TASK_RUNNING ? '任务执行中' : '任务排队中'
        onProgress?.(status, progress)
      } else if (result.code === RH_STATUS.TASK_FAILED) {
        throw new Error(result.msg || '任务执行失败')
      } else {
        throw new Error(`未知状态: ${result.code} - ${result.msg}`)
      }

      // 等待后继续轮询
      await new Promise((resolve) => setTimeout(resolve, pollingInterval))
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now()

    try {
      const url = `${this.getBaseUrl()}/api/webapp/apiCallDemo`
      const params = new URLSearchParams({
        apiKey: this.getApiKey(),
        webappId: 'test'
      })

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const latencyMs = Math.round(performance.now() - startTime)

      if (response.ok) {
        return {
          success: true,
          message: 'API 连接正常',
          latencyMs
        }
      }

      const result = await response.json().catch(() => ({}))
      return {
        success: false,
        message: `API 请求失败: ${result.msg || response.statusText}`,
        latencyMs,
        error: result.msg || `HTTP ${response.status}`
      }
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime)
      const errorMessage = error instanceof Error ? error.message : String(error)

      return {
        success: false,
        message: `连接失败: ${errorMessage}`,
        latencyMs,
        error: errorMessage
      }
    }
  }
}

// 导出单例实例
export const runningHubService = new RunningHubService()
export default runningHubService
