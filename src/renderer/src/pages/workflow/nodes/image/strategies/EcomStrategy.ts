/**
 * 电商图生成策略
 * E-commerce Image Generation Strategy
 *
 * 处理 gemini_ecom 节点类型
 * 支持多步骤生成：主图 → 背面图（可选）→ 细节图（可选）
 *
 * **Feature: executor-strategy-pattern, Phase 3.2c**
 */

import { resolveFillMode, resolveLayoutMode } from '../../../presets'
import { type EcomConfig, type EcomDetailType, EcomPromptBuilder } from '../../../prompts/builders'
import { ImageRefService } from '../../../services/ImageRefService'
import { createErrorResult, createSuccessResult, type ImageRef, type NodeExecutionResult } from '../../../types/core'
import { BaseImageGenerationStrategy, type OutputMapping, type StrategyContext } from './ImageGenerationStrategy'

/**
 * 电商图生成策略
 *
 * 支持节点类型：
 * - gemini_ecom: 电商产品图生成
 *
 * 特点：
 * - 多步骤生成（主图 → 背面图 → 细节图）
 * - 支持 layout/fillMode 的 'none' 和 'random' 模式
 * - 背面图支持参考图片（image_4, image_5）
 * - 使用 EcomPromptBuilder 构建专业提示词
 */
export class EcomStrategy extends BaseImageGenerationStrategy {
  readonly supportedNodeTypes = ['gemini_ecom']
  readonly name = 'EcomStrategy'
  readonly supportsMultiStep = true

  getOutputMapping(_config: Record<string, any>): OutputMapping {
    return {
      primaryOutput: 'mainImage',
      additionalOutputs: {
        image: 'mainImage', // 通用输出
        backImage: 'backImage',
        detailImages: 'detailImages'
      }
    }
  }

  /**
   * 执行电商图多步骤生成
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
      const aspectRatio = config.aspectRatio || '3:4'
      const customPrompts = config.customPrompts as
        | {
            system?: string
            user?: string
            back?: string
          }
        | undefined

      // 使用解析函数处理 'none' 和 'random'
      const ecomJson = inputs.promptJson?.type === 'ecom' ? inputs.promptJson : null
      const resolvedLayout = resolveLayoutMode(ecomJson?.layout_mode || config.layout)
      const resolvedFill = resolveFillMode(ecomJson?.fill_mode || config.fillMode)

      const garmentDesc = config.garmentDescription || config.garmentDesc || ''
      const enableBack = config.enableBack ?? false
      const enableDetail = config.enableDetail ?? false
      const detailTypes = (config.detailTypes as string[] | undefined) || []

      context.log?.('EcomStrategy: 开始执行', {
        resolvedLayout,
        resolvedFill,
        enableBack,
        enableDetail,
        detailTypes
      })

      // 2. 构建主图提示词
      const ecomConfig: EcomConfig & Record<string, unknown> = {
        // 'none' 传递 undefined，让 EcomPromptBuilder 处理 AI 自由发挥
        layout: resolvedLayout === 'none' ? undefined : resolvedLayout,
        fillMode: resolvedFill === 'none' ? undefined : resolvedFill,
        garmentDescription: garmentDesc,
        imageSize,
        aspectRatio
      }

      const mainBuilder = new EcomPromptBuilder({
        promptJson: ecomJson || undefined,
        config: ecomConfig
      })

      const mainSystemPrompt = customPrompts?.system || mainBuilder.buildSystemPrompt()
      const mainUserPrompt = customPrompts?.user || mainBuilder.buildUserPrompt()

      if (!mainUserPrompt) {
        return createErrorResult('缺少提示词', Date.now() - startTime)
      }

      context.log?.('EcomStrategy: 主图提示词构建完成', {
        hasSystemPrompt: !!mainSystemPrompt,
        userPromptLength: mainUserPrompt.length
      })

      // 3. 收集输入图片（排除背面参考图 image_4, image_5）
      const imageInputs = this.collectMainImageInputs(inputs)
      const imageBase64List = imageInputs.length > 0 ? await context.loadImagesAsBase64(imageInputs) : undefined

      context.log?.(`EcomStrategy: 收集到 ${imageInputs.length} 张主图参考图片`)

      // 4. 检查取消
      if (context.executionContext.abortSignal?.aborted) {
        return createErrorResult('执行已取消', Date.now() - startTime)
      }

      // 5. 生成主图
      const mainImageResult = await context.generateImage({
        prompt: mainUserPrompt,
        systemPrompt: mainSystemPrompt,
        negativePrompt: config.negativePrompt,
        images: imageBase64List,
        aspectRatio,
        imageSize,
        signal: context.executionContext.abortSignal
      })

      // **Feature: image-ref-optimization**
      // 将 API 响应转换为 ImageRef
      const mainImageRef: ImageRef = ImageRefService.fromApiResponse(mainImageResult)

      const outputs: Record<string, any> = {
        mainImage: mainImageRef,
        image: mainImageRef
      }

      context.log?.('EcomStrategy: 主图生成完成')

      // 6. 并行生成背面图和细节图（性能优化）
      // 主图完成后，背面图和细节图可以同时开始生成，不需要串行等待
      const parallelTasks: Promise<void>[] = []
      const parallelStartTime = Date.now()

      // 背面图生成任务
      if (enableBack) {
        parallelTasks.push(
          (async () => {
            // 检查取消
            if (context.executionContext.abortSignal?.aborted) {
              throw new Error('执行已取消')
            }

            const backImageResult = await this.generateBackImage(
              inputs,
              config,
              context,
              mainImageResult, // 传递原始结果用于生成（需要 base64）
              mainSystemPrompt,
              imageBase64List,
              customPrompts?.back
            )

            // 转换为 ImageRef
            const backImageRef: ImageRef = ImageRefService.fromApiResponse(backImageResult)
            outputs.backImage = backImageRef
            context.log?.('EcomStrategy: 背面图生成完成')
          })()
        )
      }

      // 细节图生成任务
      if (enableDetail && detailTypes.length > 0) {
        parallelTasks.push(
          (async () => {
            const detailImageRefs: ImageRef[] = []

            // 细节图内部仍然串行生成（因为每张细节图都依赖相同的上下文）
            // 如果需要更高并发，可以进一步改为并行，但要注意 API 限流
            for (const dt of detailTypes) {
              // 检查取消
              if (context.executionContext.abortSignal?.aborted) {
                throw new Error('执行已取消')
              }

              const detailPrompt = EcomPromptBuilder.buildDetailPrompt(dt as EcomDetailType)

              const detailImageResult = await context.generateImage({
                prompt: detailPrompt,
                systemPrompt: mainSystemPrompt,
                negativePrompt: config.negativePrompt,
                images: imageBase64List ? [...imageBase64List, mainImageResult] : [mainImageResult],
                aspectRatio,
                imageSize,
                signal: context.executionContext.abortSignal
              })

              // 转换为 ImageRef
              const detailImageRef: ImageRef = ImageRefService.fromApiResponse(detailImageResult)
              detailImageRefs.push(detailImageRef)
            }

            outputs.detailImages = detailImageRefs
            context.log?.('EcomStrategy: 细节图生成完成', { count: detailImageRefs.length })
          })()
        )
      }

      // 等待所有并行任务完成
      if (parallelTasks.length > 0) {
        context.log?.('EcomStrategy: 开始并行生成', { taskCount: parallelTasks.length })

        const parallelResults = await Promise.allSettled(parallelTasks)

        // 检查是否有失败的任务
        const failures = parallelResults.filter((r) => r.status === 'rejected')
        if (failures.length > 0) {
          const firstError = (failures[0] as PromiseRejectedResult).reason
          // 如果是取消错误，直接返回
          if (firstError?.message === '执行已取消') {
            return createErrorResult('执行已取消', Date.now() - startTime)
          }
          // 其他错误记录日志但不中断（主图已生成成功）
          context.log?.('EcomStrategy: 部分并行任务失败', {
            failures: failures.map((f) => (f as PromiseRejectedResult).reason?.message)
          })
        }

        context.log?.('EcomStrategy: 并行任务完成', {
          duration: `${Date.now() - parallelStartTime}ms`,
          successCount: parallelResults.filter((r) => r.status === 'fulfilled').length,
          failureCount: failures.length
        })
      }

      context.log?.('EcomStrategy: 所有图片生成完成', {
        outputKeys: Object.keys(outputs)
      })

      return createSuccessResult(outputs, Date.now() - startTime)
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 生成背面图
   *
   * 特殊处理：
   * - 支持用户提供的背面参考图（image_4 = 上装背面，image_5 = 下装背面）
   * - 使用专门的背面图提示词
   * - 优化：并行加载背面参考图
   */
  private async generateBackImage(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: StrategyContext,
    mainImage: string,
    mainSystemPrompt: string,
    imageBase64List: string[] | undefined,
    customBackPrompt?: string
  ): Promise<string> {
    // 检查是否有用户提供的背面参考图
    const backTopImage = inputs.image_4 as string | undefined
    const backBottomImage = inputs.image_5 as string | undefined
    const hasBackReference = !!(backTopImage || backBottomImage)

    // 并行加载背面参考图（性能优化）
    const backRefImages: string[] = []
    if (hasBackReference) {
      const backImagesToLoad = [backTopImage, backBottomImage].filter(Boolean) as string[]
      const backBase64Results = await context.loadImagesAsBase64(backImagesToLoad)
      backRefImages.push(...backBase64Results)
    }

    context.log?.('EcomStrategy: 背面参考图收集', {
      hasBackReference,
      backRefCount: backRefImages.length
    })

    // 构建背面图提示词
    const backPrompt = customBackPrompt || EcomPromptBuilder.buildBackViewPrompt()

    // 构建背面图生成的图片列表：原始图 + 主图 + 背面参考图（如果有）
    const backImages = [...(imageBase64List || []), mainImage, ...backRefImages]

    return context.generateImage({
      prompt: hasBackReference
        ? `${backPrompt}\n\n[IMPORTANT] Reference back view images are provided. Use them to accurately reproduce the back design.`
        : backPrompt,
      systemPrompt: mainSystemPrompt,
      negativePrompt: config.negativePrompt,
      images: backImages,
      aspectRatio: config.aspectRatio || '3:4',
      imageSize: config.imageSize || '2K',
      signal: context.executionContext.abortSignal
    })
  }

  /**
   * 收集主图输入图片（排除背面参考图 image_4, image_5）
   */
  private collectMainImageInputs(inputs: Record<string, any>): string[] {
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

    // 收集动态图片端口 (image_1, image_2, image_3)
    // 排除 image_4 和 image_5（这些是背面参考图）
    for (const key of Object.keys(inputs)) {
      if (/^image_?[123]$/.test(key) && typeof inputs[key] === 'string' && inputs[key]) {
        images.push(inputs[key])
      }
    }

    return images
  }
}

/**
 * 导出策略实例
 */
export const ecomStrategy = new EcomStrategy()
