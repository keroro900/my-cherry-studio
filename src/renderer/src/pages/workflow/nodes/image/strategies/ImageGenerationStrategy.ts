/**
 * 图片生成策略接口
 * Image Generation Strategy Interface
 *
 * 定义图片生成节点的策略模式接口
 * 每种节点类型实现自己的策略，避免单一执行器中的条件地狱
 *
 * 架构说明：
 * - 策略负责：输出映射、多步骤执行逻辑
 * - PromptService 负责：提示词构建（避免重复）
 * - 执行器负责：调度策略、管理执行上下文
 *
 * 集成关系：
 * - 策略调用 PromptService.build() 获取提示词
 * - 执行器调用 strategy.execute() 执行生成
 * - 策略内部可覆盖提示词构建逻辑（特殊场景）
 *
 * **Feature: executor-strategy-pattern, Phase 3.1**
 */

import type { Model, Provider } from '@renderer/types'

import { type PromptResult, PromptService } from '../../../prompts'
import { ImageRefService } from '../../../services/ImageRefService'
import {
  createErrorResult,
  createSuccessResult,
  type ImageRef,
  type NodeExecutionContext,
  type NodeExecutionResult
} from '../../../types/core'

// ==================== 核心类型定义 ====================

/**
 * 图片生成参数
 * 传递给 WorkflowAiService.generateImage() 的参数
 */
export interface ImageGenerationParams {
  /** 用户提示词 */
  prompt: string
  /** 系统提示词 */
  systemPrompt?: string
  /** 负面提示词 */
  negativePrompt?: string
  /** 参考图片 base64 列表 */
  images?: string[]
  /** 宽高比 */
  aspectRatio?: string
  /** 图片尺寸 */
  imageSize?: string
  /** 取消信号 */
  signal?: AbortSignal
}

/**
 * 策略执行上下文
 * 包含执行所需的所有依赖
 */
export interface StrategyContext {
  /** AI Provider */
  provider: Provider
  /** AI Model */
  model: Model
  /** 节点执行上下文 */
  executionContext: NodeExecutionContext
  /** 图片生成服务调用函数 */
  generateImage: (params: ImageGenerationParams) => Promise<string>
  /** 加载图片为 base64 */
  loadImagesAsBase64: (images: string[]) => Promise<string[]>
  /** 日志函数 */
  log?: (message: string, data?: Record<string, any>) => void
}

/**
 * 策略输出映射
 * 定义策略产出的图片如何映射到节点输出端口
 */
export interface OutputMapping {
  /** 主输出端口 ID */
  primaryOutput: string
  /** 额外输出端口映射 { 输出键: 端口 ID } */
  additionalOutputs?: Record<string, string>
}

// ==================== 策略接口 ====================

/**
 * 图片生成策略接口
 *
 * 每种节点类型实现此接口，提供：
 * 1. 输出映射（根据节点类型确定输出端口）
 * 2. 多步骤执行逻辑（如 ECOM 需要主图+背面图+细节图）
 * 3. 可选的提示词构建覆盖（默认委托给 PromptService）
 */
export interface ImageGenerationStrategy {
  /**
   * 支持的节点类型
   * 一个策略可以支持多个相关的节点类型
   */
  readonly supportedNodeTypes: string[]

  /**
   * 策略名称（用于日志和调试）
   */
  readonly name: string

  /**
   * 是否支持多步骤执行
   * 如 ECOM 节点需要生成主图、背面图、细节图
   */
  readonly supportsMultiStep: boolean

  /**
   * 获取输出映射
   *
   * @param config - 节点配置（可能影响输出结构）
   * @returns 输出映射配置
   */
  getOutputMapping(config: Record<string, any>): OutputMapping

  /**
   * 执行策略
   *
   * @param inputs - 节点输入数据
   * @param config - 节点配置
   * @param context - 策略执行上下文
   * @returns 执行结果
   */
  execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: StrategyContext
  ): Promise<NodeExecutionResult>
}

// ==================== 基础策略抽象类 ====================

/**
 * 策略基类
 * 提供通用方法和默认实现，委托提示词构建给 PromptService
 */
export abstract class BaseImageGenerationStrategy implements ImageGenerationStrategy {
  abstract readonly supportedNodeTypes: string[]
  abstract readonly name: string

  /**
   * 默认不支持多步骤
   */
  readonly supportsMultiStep: boolean = false

  /**
   * 获取输出映射（子类必须实现）
   */
  abstract getOutputMapping(config: Record<string, any>): OutputMapping

  /**
   * 获取节点类型（从 config 中提取）
   */
  protected getNodeType(config: Record<string, any>): string {
    return config.nodeType || this.supportedNodeTypes[0]
  }

  /**
   * 构建提示词
   * 默认委托给 PromptService，子类可覆盖
   */
  protected buildPrompts(inputs: Record<string, any>, config: Record<string, any>): PromptResult {
    const nodeType = this.getNodeType(config)

    return PromptService.build({
      nodeType,
      config,
      inputs,
      customPrompts: config.customPrompts
    })
  }

  /**
   * 默认执行实现
   * 单步骤图片生成
   */
  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: StrategyContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 构建提示词（委托给 PromptService）
      const promptResult = this.buildPrompts(inputs, config)

      if (!promptResult.userPrompt) {
        return createErrorResult('缺少提示词', Date.now() - startTime)
      }

      context.log?.('提示词构建完成', {
        source: promptResult.source,
        hasSystemPrompt: !!promptResult.systemPrompt,
        userPromptLength: promptResult.userPrompt.length
      })

      // 2. 收集输入图片
      const imageInputs = this.collectImageInputs(inputs)
      const imageBase64List = imageInputs.length > 0 ? await context.loadImagesAsBase64(imageInputs) : undefined

      context.log?.(`收集到 ${imageInputs.length} 张图片`)

      // 3. 检查取消
      if (context.executionContext.abortSignal?.aborted) {
        return createErrorResult('执行已取消', Date.now() - startTime)
      }

      // 4. 调用图片生成
      const imageResult = await context.generateImage({
        prompt: promptResult.userPrompt,
        systemPrompt: promptResult.systemPrompt,
        negativePrompt: promptResult.negativePrompt || config.negativePrompt,
        images: imageBase64List,
        aspectRatio: config.aspectRatio || '1:1',
        imageSize: config.imageSize || '2K',
        signal: context.executionContext.abortSignal
      })

      // 5. 构建输出 - 使用 ImageRef 而非 Base64
      // **Feature: image-ref-optimization**
      // 将 API 响应转换为 ImageRef，减少内存占用
      const imageRef: ImageRef = ImageRefService.fromApiResponse(imageResult)

      const outputMapping = this.getOutputMapping(config)
      const outputs: Record<string, any> = {
        [outputMapping.primaryOutput]: imageRef,
        image: imageRef // 总是提供 'image' 作为通用输出
      }

      // 添加额外输出
      if (outputMapping.additionalOutputs) {
        for (const [key, portId] of Object.entries(outputMapping.additionalOutputs)) {
          outputs[portId] = outputs[key]
        }
      }

      return createSuccessResult(outputs, Date.now() - startTime)
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 收集输入中的图片
   * 遍历常见的图片输入键
   */
  protected collectImageInputs(inputs: Record<string, any>): string[] {
    const images: string[] = []
    const imageKeys = [
      'image',
      'images',
      'baseImage',
      'base_image',
      'originalImage',
      'clothesImage',
      'clothes_image',
      'referenceImage',
      'reference_image',
      'all_images',
      'extra_refs'
    ]

    // 收集静态键
    for (const key of imageKeys) {
      const value = inputs[key]
      if (typeof value === 'string' && value) {
        images.push(value)
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item) {
            images.push(item)
          }
        }
      }
    }

    // 收集动态图片端口 (image_1, image_2, ...)
    for (const key of Object.keys(inputs)) {
      if (/^image_?\d+$/.test(key) && typeof inputs[key] === 'string' && inputs[key]) {
        images.push(inputs[key])
      }
    }

    return images
  }
}

// ==================== 策略注册表 ====================

/**
 * 策略注册表
 * 管理所有图片生成策略
 */
class ImageGenerationStrategyRegistry {
  private strategies: Map<string, ImageGenerationStrategy> = new Map()
  private initialized = false

  /**
   * 注册策略
   */
  register(strategy: ImageGenerationStrategy): void {
    for (const nodeType of strategy.supportedNodeTypes) {
      this.strategies.set(nodeType, strategy)
    }
  }

  /**
   * 获取策略
   */
  get(nodeType: string): ImageGenerationStrategy | undefined {
    return this.strategies.get(nodeType)
  }

  /**
   * 检查是否支持节点类型
   */
  supports(nodeType: string): boolean {
    return this.strategies.has(nodeType)
  }

  /**
   * 获取所有已注册的节点类型
   */
  getSupportedNodeTypes(): string[] {
    return Array.from(this.strategies.keys())
  }

  /**
   * 标记已初始化
   */
  markInitialized(): void {
    this.initialized = true
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }
}

/**
 * 全局策略注册表实例
 */
export const strategyRegistry = new ImageGenerationStrategyRegistry()
