/**
 * 平台尺寸适配节点执行器
 * Platform Resize Node Executor
 *
 * 使用 Canvas 在客户端进行图片尺寸适配
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import { PLATFORM_SPECS, type PlatformResizeConfig, type PlatformResizeOutput } from './types'

export class PlatformResizeExecutor extends BaseNodeExecutor {
  constructor() {
    super('platform_resize')
  }

  async execute(
    inputs: Record<string, any>,
    config: PlatformResizeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    this.log(context, '开始执行平台尺寸适配节点', {
      targetPlatform: config.targetPlatform,
      scaleMode: config.scaleMode,
      batchMode: config.batchMode
    })

    try {
      // 1. 收集输入图片
      const inputImage = inputs.image || inputs.input
      if (!inputImage) {
        return this.error('请提供输入图片', Date.now() - startTime)
      }

      this.log(context, '收集输入', {
        hasImage: !!inputImage
      })

      // 2. 确定目标平台列表
      const targetPlatforms =
        config.batchMode && config.batchPlatforms?.length ? config.batchPlatforms : [config.targetPlatform]

      // 3. 处理每个目标平台
      const results: PlatformResizeOutput[] = []

      for (const platformId of targetPlatforms) {
        const platformSpec = PLATFORM_SPECS[platformId]
        if (!platformSpec) {
          this.log(context, `跳过未知平台: ${platformId}`)
          continue
        }

        // 确定目标尺寸
        let targetWidth = platformSpec.width
        let targetHeight = platformSpec.height

        if (platformId === 'custom') {
          targetWidth = config.customWidth || 1000
          targetHeight = config.customHeight || 1000
        }

        this.log(context, `处理平台: ${platformSpec.name}`, {
          targetWidth,
          targetHeight
        })

        // 调用图片处理
        const resizedImage = await this.resizeImage(inputImage, {
          targetWidth,
          targetHeight,
          scaleMode: config.scaleMode,
          backgroundFill: config.backgroundFill,
          backgroundColor: config.backgroundColor,
          quality: config.quality,
          outputFormat: config.outputFormat,
          maintainAspectRatio: config.maintainAspectRatio
        })

        results.push({
          image: resizedImage,
          width: targetWidth,
          height: targetHeight,
          platform: platformId,
          platformName: platformSpec.name
        })
      }

      if (results.length === 0) {
        return this.error('没有成功处理的图片', Date.now() - startTime)
      }

      const duration = Date.now() - startTime
      this.log(context, '节点执行完成', {
        duration: `${duration}ms`,
        processedCount: results.length
      })

      // 返回结果
      if (config.batchMode && results.length > 1) {
        return this.success(
          {
            images: results.map((r) => r.image),
            results: results,
            image: results[0].image // 兼容单图输出
          },
          duration
        )
      } else {
        const result = results[0]
        return this.success(
          {
            image: result.image,
            width: result.width,
            height: result.height,
            platform: result.platform,
            platformName: result.platformName
          },
          duration
        )
      }
    } catch (error) {
      this.logError(context, '节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 图片尺寸调整
   */
  private async resizeImage(
    imageSource: string,
    options: {
      targetWidth: number
      targetHeight: number
      scaleMode: string
      backgroundFill: string
      backgroundColor?: string
      quality: number
      outputFormat: string
      maintainAspectRatio: boolean
    }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('无法创建 Canvas 上下文'))
            return
          }

          canvas.width = options.targetWidth
          canvas.height = options.targetHeight

          // 填充背景
          this.fillBackground(ctx, canvas.width, canvas.height, options.backgroundFill, options.backgroundColor, img)

          // 计算缩放和位置
          const { x, y, width, height } = this.calculateImagePlacement(
            img.width,
            img.height,
            options.targetWidth,
            options.targetHeight,
            options.scaleMode,
            options.maintainAspectRatio
          )

          // 绘制图片
          ctx.drawImage(img, x, y, width, height)

          // 输出
          const mimeType =
            options.outputFormat === 'png' ? 'image/png' : options.outputFormat === 'webp' ? 'image/webp' : 'image/jpeg'
          const quality = options.quality / 100
          resolve(canvas.toDataURL(mimeType, quality))
        } catch (e) {
          reject(e)
        }
      }

      img.onerror = () => {
        reject(new Error('无法加载图片'))
      }

      // 处理 base64 或 URL
      if (imageSource.startsWith('data:') || imageSource.startsWith('http') || imageSource.startsWith('blob:')) {
        img.src = imageSource
      } else if (imageSource.startsWith('indexeddb://')) {
        // 需要从 IndexedDB 加载
        reject(new Error('暂不支持 IndexedDB 图片，请先转换为 base64'))
      } else {
        img.src = imageSource
      }
    })
  }

  /**
   * 填充背景
   */
  private fillBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    fillType: string,
    customColor?: string,
    sourceImage?: HTMLImageElement
  ): void {
    switch (fillType) {
      case 'white':
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        break
      case 'black':
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, width, height)
        break
      case 'transparent':
        // 不填充，保持透明
        break
      case 'color':
        ctx.fillStyle = customColor || '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        break
      case 'blur':
        if (sourceImage) {
          // 绘制模糊背景
          ctx.filter = 'blur(50px)'
          const scale = Math.max(width / sourceImage.width, height / sourceImage.height) * 1.2
          const bw = sourceImage.width * scale
          const bh = sourceImage.height * scale
          ctx.drawImage(sourceImage, (width - bw) / 2, (height - bh) / 2, bw, bh)
          ctx.filter = 'none'
        } else {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
        }
        break
      default:
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
    }
  }

  /**
   * 计算图片放置位置和尺寸
   */
  private calculateImagePlacement(
    srcWidth: number,
    srcHeight: number,
    targetWidth: number,
    targetHeight: number,
    scaleMode: string,
    maintainAspectRatio: boolean
  ): { x: number; y: number; width: number; height: number } {
    if (!maintainAspectRatio || scaleMode === 'stretch') {
      return { x: 0, y: 0, width: targetWidth, height: targetHeight }
    }

    const srcRatio = srcWidth / srcHeight
    const targetRatio = targetWidth / targetHeight

    let width: number, height: number, x: number, y: number

    switch (scaleMode) {
      case 'fill':
        // 填满目标区域，可能裁剪
        if (srcRatio > targetRatio) {
          height = targetHeight
          width = srcWidth * (targetHeight / srcHeight)
        } else {
          width = targetWidth
          height = srcHeight * (targetWidth / srcWidth)
        }
        x = (targetWidth - width) / 2
        y = (targetHeight - height) / 2
        break

      case 'contain':
      case 'fit':
      default:
        // 完整显示，可能有留白
        if (srcRatio > targetRatio) {
          width = targetWidth
          height = srcHeight * (targetWidth / srcWidth)
        } else {
          height = targetHeight
          width = srcWidth * (targetHeight / srcHeight)
        }
        x = (targetWidth - width) / 2
        y = (targetHeight - height) / 2
        break
    }

    return { x, y, width, height }
  }
}

export default PlatformResizeExecutor
