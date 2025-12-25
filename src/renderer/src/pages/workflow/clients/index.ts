/**
 * AI 客户端工具类
 * 封装各 AI 服务的 API 调用
 *
 * 设计原则：
 * 1. 使用 Cherry Studio 的底层服务进行 AI 调用
 * 2. 轻量封装，委托到底层服务（KlingService, RunningHubService 等）
 * 3. 统一的错误处理和日志记录
 *
 * 注意：
 * - 图像生成使用 WorkflowAiService.generateImage() 统一入口
 * - 文本生成使用 WorkflowAiService.generateText() 统一入口
 * - 已删除 GeminiClient 和 QwenClient（重复实现，已迁移到 WorkflowAiService）
 */

import { loggerService } from '@logger'
import type { RunningHubNodeInfo } from '@renderer/services/externalServices'

const logger = loggerService.withContext('WorkflowClients')

// ==================== Kling 客户端 ====================

/**
 * Kling 客户端工具
 * 使用 externalServices 中的 KlingService 实现
 */
export class KlingClient {
  constructor() {
    logger.debug('KlingClient initialized (using KlingService)')
  }

  /**
   * 图生视频
   * 使用 KlingService 的完整实现
   */
  async imageToVideo(params: {
    imageUrl: string
    prompt?: string
    duration?: 5 | 10
    mode?: 'std' | 'pro'
  }): Promise<string> {
    // 动态导入以避免循环依赖
    const { klingService } = await import('@renderer/services/externalServices')

    logger.info('Creating video from image with Kling', {
      imageUrl: params.imageUrl,
      duration: params.duration,
      promptLength: params.prompt?.length || 0
    })

    try {
      // 构建 Image2VideoRequest 参数
      const request = {
        image: params.imageUrl,
        prompt: params.prompt,
        duration: params.duration ? (String(params.duration) as '5' | '10') : undefined,
        mode: params.mode
      }

      const videoUrls = await klingService.image2VideoAndWait(request)

      // 返回第一个视频 URL
      return videoUrls.length > 0 ? videoUrls[0] : ''
    } catch (error) {
      logger.error('Failed to create video with Kling', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`Kling 图生视频失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// ==================== RunningHub 客户端 ====================

/**
 * RunningHub 客户端工具
 * 使用 externalServices 中的 RunningHubService 实现
 */
export class RunningHubClient {
  constructor() {
    logger.debug('RunningHubClient initialized (using RunningHubService)')
  }

  /**
   * 运行应用并等待结果
   */
  async runApp(params: { appId: string; nodeId: string; inputs: Record<string, any> }): Promise<any> {
    // 动态导入以避免循环依赖
    const { runningHubService } = await import('@renderer/services/externalServices')

    logger.info('Running RunningHub app', {
      appId: params.appId,
      nodeId: params.nodeId
    })

    try {
      // 构建节点信息数组，需要包含 fieldType
      const nodeInfos: RunningHubNodeInfo[] = Object.entries(params.inputs).map(([key, value]) => ({
        nodeId: params.nodeId,
        fieldName: key,
        fieldType: 'STRING' as const, // 默认为 STRING 类型
        fieldValue: typeof value === 'string' ? value : JSON.stringify(value)
      }))

      // runAndWait 返回 string[] (URL 数组)
      const urls = await runningHubService.runAndWait(params.appId, nodeInfos)

      return {
        image: urls.length > 0 ? urls[0] : null,
        images: urls,
        data: { urls }
      }
    } catch (error) {
      logger.error('Failed to run RunningHub app', { error: error instanceof Error ? error.message : String(error) })
      throw new Error(`RunningHub 应用运行失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取工作流配置
   */
  async getWorkflowConfig(workflowId: string): Promise<any> {
    const { runningHubService } = await import('@renderer/services/externalServices')

    logger.info('Getting RunningHub workflow config', { workflowId })

    try {
      const config = await runningHubService.getWebappConfig(workflowId)
      return config
    } catch (error) {
      logger.error('Failed to get RunningHub workflow config', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`获取 RunningHub 工作流配置失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 上传 Base64 图片
   */
  async uploadBase64Image(base64Data: string, fileName?: string): Promise<string> {
    const { runningHubService } = await import('@renderer/services/externalServices')

    logger.info('Uploading base64 image to RunningHub')

    try {
      const fileUrl = await runningHubService.uploadBase64Image(base64Data, fileName)
      return fileUrl
    } catch (error) {
      logger.error('Failed to upload base64 image to RunningHub', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`RunningHub Base64 图片上传失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
