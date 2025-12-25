/**
 * 节点执行器基类
 *
 * 提供节点执行的通用功能和工具方法
 */

import { loggerService } from '@logger'
import type { Model, Provider } from '@renderer/types'

import { WorkflowAiService } from '../../services/WorkflowAiService'
import type { ImageData, NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '../../types/core'
import { createErrorResult, createSkippedResult, createSuccessResult, isImageRef } from '../../types/core'

const logger = loggerService.withContext('BaseNodeExecutor')

/**
 * 节点执行器基类
 * 所有节点执行器都应该继承此类
 */
export abstract class BaseNodeExecutor implements NodeExecutor {
  protected nodeType: string

  constructor(nodeType: string) {
    this.nodeType = nodeType
  }

  /**
   * 执行节点（抽象方法，子类必须实现）
   */
  abstract execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult>

  /**
   * 创建成功结果
   */
  protected success(outputs: Record<string, any>, duration?: number): NodeExecutionResult {
    return createSuccessResult(outputs, duration)
  }

  /**
   * 创建错误结果
   */
  protected error(message: string, duration?: number): NodeExecutionResult {
    return createErrorResult(message, duration)
  }

  /**
   * 创建跳过结果
   */
  protected skipped(reason?: string): NodeExecutionResult {
    return createSkippedResult(reason)
  }

  /**
   * 记录日志
   */
  protected log(context: NodeExecutionContext, message: string, data?: Record<string, any>) {
    const prefix = `[${this.nodeType}]`
    if (data) {
      logger.info(`${prefix} ${message}`, data)
    } else {
      logger.info(`${prefix} ${message}`)
    }
    context.log(message, data)
  }

  /**
   * 记录错误日志
   */
  protected logError(context: NodeExecutionContext, message: string, error?: any) {
    const prefix = `[${this.nodeType}]`
    logger.error(`${prefix} ${message}`, {
      error: error instanceof Error ? error.message : String(error)
    })
    context.log(`❌ ${message}`, { error: error instanceof Error ? error.message : String(error) })
  }

  /**
   * 验证必需的输入
   */
  protected validateRequiredInputs(
    inputs: Record<string, any>,
    requiredKeys: string[]
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = []
    for (const key of requiredKeys) {
      if (inputs[key] === undefined || inputs[key] === null) {
        missing.push(key)
      }
    }
    return {
      valid: missing.length === 0,
      missing
    }
  }

  /**
   * 获取输入值，支持多种键名
   */
  protected getInput<T>(inputs: Record<string, any>, keys: string[], defaultValue?: T): T | undefined {
    for (const key of keys) {
      if (inputs[key] !== undefined && inputs[key] !== null) {
        return inputs[key] as T
      }
    }
    return defaultValue
  }

  /**
   * 收集所有图片输入
   */
  protected collectImageInputs(inputs: Record<string, any>): ImageData[] {
    const images: ImageData[] = []

    // 常见的图片输入键名
    const imageKeyPatterns = [
      'image',
      'images', // 图片数组
      'all_images', // 兼容旧版
      'baseImage',
      'base_image',
      'clothesImage',
      'clothes_image',
      'top_image',
      'bottom_image',
      'top_garment',
      'bottom_garment',
      'originalImage',
      'newImage',
      'extra_refs'
    ]

    for (const [key, value] of Object.entries(inputs)) {
      // 检查是否匹配图片键名模式
      const isImageKey =
        imageKeyPatterns.includes(key) ||
        /^image_?\d*$/.test(key) ||
        /^image\d+$/.test(key) ||
        /^folder_\d+$/.test(key) ||
        /^reference_\d+$/.test(key)

      // 或者检查值是否看起来像图片数据 / ImageRef
      const isImageValue =
        (typeof value === 'string' &&
          (value.startsWith('data:image') ||
            /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(value) ||
            value.includes('\\') ||
            value.includes('/'))) ||
        isImageRef(value)

      // 检查是否是图片数组（字符串或 ImageRef）
      const isImageArray =
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(
          (item) =>
            (typeof item === 'string' &&
              (item.startsWith('data:image') ||
                /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(item) ||
                item.includes('\\') ||
                item.includes('/'))) ||
            isImageRef(item)
        )

      if (isImageKey || isImageValue || isImageArray) {
        if (Array.isArray(value)) {
          images.push(...(value.filter(Boolean) as ImageData[]))
        } else if (value) {
          images.push(value as ImageData)
        }
      }
    }

    return images
  }

  /**
   * 检查是否应该取消执行
   */
  protected shouldAbort(context: NodeExecutionContext): boolean {
    return context.abortSignal?.aborted ?? false
  }

  /**
   * 等待指定时间
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 获取 Gemini 图片生成模型
   * 统一的模型查找逻辑，支持多种配置格式：
   * - config.model (新格式，包含 id 和 provider)
   * - config.providerId + config.modelId (旧格式)
   * - 自动查找可用的 Gemini 图片模型
   */
  protected async getGeminiModel(config: Record<string, any>): Promise<{
    provider: Provider | undefined
    model: Model | undefined
  }> {
    let provider: Provider | undefined
    let model: Model | undefined

    // 新格式：config.model 包含完整的模型信息
    const modelConfig = config.model
    const providerId = modelConfig?.provider || config.providerId
    const modelId = modelConfig?.id || config.modelId

    // 调试日志
    logger.debug(`[${this.nodeType}] getGeminiModel 配置信息`, {
      'config.model': modelConfig,
      'config.providerId': config.providerId,
      'config.modelId': config.modelId,
      resolvedProviderId: providerId,
      resolvedModelId: modelId
    })

    // 先尝试精确匹配 - 使用统一接口
    if (providerId && modelId) {
      const result = WorkflowAiService.getProviderAndModelUnified(providerId, modelId)
      provider = result.provider
      model = result.model
    }

    // 如果精确匹配失败，使用 findGeminiImageProvider 查找
    if (!provider || !model) {
      const geminiModel = await WorkflowAiService.findGeminiImageProvider(providerId, modelId)
      if (geminiModel) {
        provider = geminiModel.provider
        model = geminiModel.model
        logger.debug(`[${this.nodeType}] 找到模型`, {
          providerId: provider?.id,
          modelId: model?.id
        })
      } else {
        logger.warn(`[${this.nodeType}] 未找到模型`, {
          providerId,
          modelId
        })
      }
    }

    return { provider, model }
  }
}

export default BaseNodeExecutor
