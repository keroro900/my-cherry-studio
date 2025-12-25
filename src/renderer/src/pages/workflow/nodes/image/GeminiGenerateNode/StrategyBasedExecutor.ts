/**
 * 基于策略的图片生成执行器
 * Strategy-Based Image Generation Executor
 *
 * 使用策略模式替代原有的条件分支逻辑
 * 通过策略注册表查找对应节点类型的策略执行
 *
 * **Feature: executor-strategy-pattern, Phase 3.3**
 */

import { WorkflowAiService } from '../../../services/WorkflowAiService'
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { ImageGenerateNodeConfig, NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import {
  type ImageGenerationParams,
  registerAllStrategies,
  type StrategyContext,
  strategyRegistry
} from '../strategies'

/**
 * 基于策略的图片生成执行器
 *
 * 支持的节点类型通过策略注册表动态确定：
 * - gemini_generate: 通用图片生成（GeneralStrategy）
 * - gemini_generate_model: 模特图生成（ModelStrategy）
 * - gemini_model_from_clothes: 从衣服生成模特图（ModelStrategy）
 * - gemini_ecom: 电商图生成（EcomStrategy）
 * - gemini_pattern: 图案生成（PatternStrategy）
 *
 * 架构优势：
 * - 消除 execute() 方法中的条件地狱
 * - 每个策略独立实现，易于测试和维护
 * - 新增节点类型只需添加新策略
 */
export class StrategyBasedExecutor extends BaseNodeExecutor {
  constructor() {
    super('gemini_generate')

    // 确保策略已注册
    registerAllStrategies()
  }

  async execute(
    inputs: Record<string, any>,
    config: ImageGenerateNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 获取节点类型
      const nodeType = (config as any).nodeType || 'gemini_generate'

      this.log(context, '开始执行图片生成节点', {
        nodeType,
        imageSize: config.imageSize,
        aspectRatio: config.aspectRatio
      })

      // 2. 查找对应策略
      const strategy = strategyRegistry.get(nodeType)

      if (!strategy) {
        return this.error(
          `未找到节点类型 "${nodeType}" 对应的策略。已注册的类型: ${strategyRegistry.getSupportedNodeTypes().join(', ')}`
        )
      }

      this.log(context, `使用策略: ${strategy.name}`)

      // 3. 查找 Gemini 图片生成 Provider
      const geminiProvider = await WorkflowAiService.findGeminiImageProvider(config.providerId, config.modelId)

      if (!geminiProvider) {
        return this.error(
          '未找到可用的 Gemini 图像生成服务。请在设置 → 模型服务中添加 Provider，并为模型设置端点类型为 "图像生成 (Gemini)"'
        )
      }

      this.log(context, '找到 Gemini Provider', {
        providerId: geminiProvider.provider.id,
        modelId: geminiProvider.model.id
      })

      // 4. 构建策略执行上下文
      const strategyContext: StrategyContext = {
        provider: geminiProvider.provider,
        model: geminiProvider.model,
        executionContext: context,

        // 图片生成服务包装
        generateImage: async (params: ImageGenerationParams) => {
          return WorkflowAiService.generateImage(geminiProvider.provider, geminiProvider.model, {
            prompt: params.prompt,
            systemPrompt: params.systemPrompt,
            negativePrompt: params.negativePrompt,
            images: params.images,
            aspectRatio: params.aspectRatio,
            imageSize: params.imageSize,
            signal: params.signal
          })
        },

        // 加载图片为 base64
        loadImagesAsBase64: async (images: string[]) => {
          return WorkflowAiService.loadImagesAsBase64(images)
        },

        // 日志函数
        log: (message: string, data?: Record<string, any>) => {
          this.log(context, message, data)
        }
      }

      // 5. 准备完整配置（合并默认值）
      const fullConfig: Record<string, any> = {
        ...config,
        nodeType,
        imageSize: config.imageSize || '2K',
        aspectRatio: config.aspectRatio || '1:1'
      }

      // 6. 执行策略
      this.log(context, '开始执行策略...')

      const result = await strategy.execute(inputs, fullConfig, strategyContext)

      // 7. 记录执行结果
      if (result.status === 'success') {
        this.log(context, '策略执行成功', {
          outputKeys: Object.keys(result.outputs || {}),
          duration: result.duration
        })
      } else {
        this.log(context, '策略执行失败', {
          error: result.errorMessage,
          duration: result.duration
        })
      }

      return result
    } catch (error) {
      this.logError(context, '图片生成失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 获取支持的节点类型列表
   */
  static getSupportedNodeTypes(): string[] {
    registerAllStrategies()
    return strategyRegistry.getSupportedNodeTypes()
  }
}

/**
 * 默认导出策略执行器实例
 */
export default StrategyBasedExecutor
