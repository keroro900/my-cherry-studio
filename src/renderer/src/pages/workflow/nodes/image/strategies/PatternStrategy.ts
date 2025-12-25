/**
 * 图案生成策略
 * Pattern Generation Strategy
 *
 * 处理 gemini_pattern 节点类型
 * 支持多模式输出：pattern_only (仅无缝图) 或 set (大图 + 无缝图)
 *
 * **Feature: executor-strategy-pattern, Phase 3.2d**
 */

import { type PatternConfig, PatternPromptBuilder } from '../../../prompts/builders'
import { ImageRefService } from '../../../services/ImageRefService'
import { createErrorResult, createSuccessResult, type ImageRef, type NodeExecutionResult } from '../../../types/core'
import { BaseImageGenerationStrategy, type OutputMapping, type StrategyContext } from './ImageGenerationStrategy'

/**
 * 图案生成策略
 *
 * 支持节点类型：
 * - gemini_pattern: 图案/印花生成
 *
 * 输出模式：
 * - pattern_only: 只生成无缝图案
 * - set: 先生成大图（graphic），再生成无缝图（seamless）
 *
 * 生成模式（generationMode）：
 * - mode_a: 元素重组（参考图 + 提示词）
 * - mode_b: 纯无缝化（仅参考图）
 * - mode_c: 设计大师（纯文本生成）
 */
export class PatternStrategy extends BaseImageGenerationStrategy {
  readonly supportedNodeTypes = ['gemini_pattern']
  readonly name = 'PatternStrategy'
  readonly supportsMultiStep = true

  getOutputMapping(config: Record<string, any>): OutputMapping {
    const outputType = config.outputType || 'pattern_only'

    if (outputType === 'set') {
      return {
        primaryOutput: 'graphicImage',
        additionalOutputs: {
          image: 'graphicImage',
          patternImage: 'patternImage'
        }
      }
    }

    return {
      primaryOutput: 'patternImage',
      additionalOutputs: {
        image: 'patternImage'
      }
    }
  }

  /**
   * 执行图案生成
   */
  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: StrategyContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 解析配置
      const imageSize = config.imageSize || '2K'
      const aspectRatio = config.aspectRatio || '1:1'
      const outputType = config.outputType || 'pattern_only'
      const customPrompts = config.customPrompts as
        | {
            system?: string
            user?: string
          }
        | undefined

      // UI 层保存的字段
      const stylePresetId = config.stylePresetId || config.stylePreset
      const stylePresetPrompt = config.stylePresetPrompt || ''
      const generationMode = (config.generationMode as PatternConfig['generationMode']) || 'mode_a'

      context.log?.('PatternStrategy: 开始执行', {
        outputType,
        generationMode,
        stylePresetId
      })

      // 2. 收集输入图片
      const imageInputs = this.collectImageInputs(inputs)
      const imageBase64List = imageInputs.length > 0 ? await context.loadImagesAsBase64(imageInputs) : undefined

      context.log?.(`PatternStrategy: 收集到 ${imageInputs.length} 张参考图片`)

      // 3. 构建基础配置
      const patternBaseConfig: PatternConfig & Record<string, unknown> = {
        stylePreset: stylePresetId,
        customElements: stylePresetPrompt || config.customPrompt,
        colorTone: config.colorTone || 'auto',
        density: config.density || 'medium',
        imageSize,
        aspectRatio,
        generationMode
      }

      // 4. 构建系统提示词（共享）
      const systemBuilder = new PatternPromptBuilder({
        config: {
          ...patternBaseConfig,
          patternType: outputType === 'set' ? 'graphic' : 'seamless'
        }
      })
      const patternSystemPrompt = customPrompts?.system || systemBuilder.buildSystemPrompt()

      const outputs: Record<string, any> = {}

      // 5. 根据输出类型生成图案
      if (outputType === 'set') {
        // 并行生成大图（graphic）和无缝图（seamless）- 性能优化
        // 两者不互相依赖，可以同时生成
        context.log?.('PatternStrategy: 并行生成大图和无缝图')
        const parallelStartTime = Date.now()

        const [graphicResult, seamlessResult] = await Promise.allSettled([
          // 大图生成任务
          (async () => {
            if (context.executionContext.abortSignal?.aborted) {
              throw new Error('执行已取消')
            }
            return this.generateGraphicImage(
              config,
              context,
              patternBaseConfig,
              patternSystemPrompt,
              imageBase64List,
              customPrompts?.user
            )
          })(),
          // 无缝图生成任务
          (async () => {
            if (context.executionContext.abortSignal?.aborted) {
              throw new Error('执行已取消')
            }
            return this.generateSeamlessImage(config, context, patternBaseConfig, patternSystemPrompt, imageBase64List)
          })()
        ])

        context.log?.('PatternStrategy: 并行生成完成', {
          duration: `${Date.now() - parallelStartTime}ms`,
          graphicStatus: graphicResult.status,
          seamlessStatus: seamlessResult.status
        })

        // 处理大图结果
        if (graphicResult.status === 'rejected') {
          const error = graphicResult.reason
          if (error?.message === '执行已取消') {
            return createErrorResult('执行已取消', Date.now() - startTime)
          }
          return createErrorResult(`大图生成失败: ${error?.message || '未知错误'}`, Date.now() - startTime)
        }

        const graphicImageRef: ImageRef = ImageRefService.fromApiResponse(graphicResult.value)
        outputs.graphicImage = graphicImageRef
        outputs.image = graphicImageRef

        // 处理无缝图结果
        if (seamlessResult.status === 'rejected') {
          const error = seamlessResult.reason
          if (error?.message === '执行已取消') {
            return createErrorResult('执行已取消', Date.now() - startTime)
          }
          // 无缝图失败但大图成功，记录警告但继续
          context.log?.('PatternStrategy: 无缝图生成失败，但大图已成功', {
            error: error?.message
          })
        } else {
          const patternImageRef: ImageRef = ImageRefService.fromApiResponse(seamlessResult.value)
          outputs.patternImage = patternImageRef
        }
      } else {
        // 只生成无缝图
        if (context.executionContext.abortSignal?.aborted) {
          return createErrorResult('执行已取消', Date.now() - startTime)
        }

        const patternImageResult = await this.generateSeamlessImage(
          config,
          context,
          patternBaseConfig,
          patternSystemPrompt,
          imageBase64List,
          customPrompts?.user
        )

        // **Feature: image-ref-optimization**
        const patternImageRef: ImageRef = ImageRefService.fromApiResponse(patternImageResult)
        outputs.patternImage = patternImageRef
        outputs.image = patternImageRef
        context.log?.('PatternStrategy: 无缝图生成完成')
      }

      context.log?.('PatternStrategy: 所有图案生成完成', {
        outputKeys: Object.keys(outputs)
      })

      return createSuccessResult(outputs, Date.now() - startTime)
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 生成大图（Graphic/Placement Print）
   */
  private async generateGraphicImage(
    config: Record<string, any>,
    context: StrategyContext,
    baseConfig: PatternConfig & Record<string, unknown>,
    systemPrompt: string,
    imageBase64List: string[] | undefined,
    customUserPrompt?: string
  ): Promise<string> {
    const graphicBuilder = new PatternPromptBuilder({
      config: {
        ...baseConfig,
        patternType: 'graphic'
      }
    })

    const graphicUserPrompt = customUserPrompt || graphicBuilder.buildUserPrompt()

    return context.generateImage({
      prompt: graphicUserPrompt,
      systemPrompt,
      negativePrompt: config.negativePrompt,
      images: imageBase64List,
      aspectRatio: config.aspectRatio || '1:1',
      imageSize: config.imageSize || '2K',
      signal: context.executionContext.abortSignal
    })
  }

  /**
   * 生成无缝图（Seamless Pattern）
   */
  private async generateSeamlessImage(
    config: Record<string, any>,
    context: StrategyContext,
    baseConfig: PatternConfig & Record<string, unknown>,
    systemPrompt: string,
    imageBase64List: string[] | undefined,
    customUserPrompt?: string
  ): Promise<string> {
    const seamlessBuilder = new PatternPromptBuilder({
      config: {
        ...baseConfig,
        patternType: 'seamless'
      }
    })

    const seamlessUserPrompt = customUserPrompt || seamlessBuilder.buildUserPrompt()

    return context.generateImage({
      prompt: seamlessUserPrompt,
      systemPrompt,
      negativePrompt: config.negativePrompt,
      images: imageBase64List,
      aspectRatio: config.aspectRatio || '1:1',
      imageSize: config.imageSize || '2K',
      signal: context.executionContext.abortSignal
    })
  }
}

/**
 * 导出策略实例
 */
export const patternStrategy = new PatternStrategy()
