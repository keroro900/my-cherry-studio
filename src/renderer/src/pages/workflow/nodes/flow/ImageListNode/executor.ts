/**
 * 图片列表节点执行器
 * 管理图片列表，支持批量处理
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { ListNodeConfig } from '../../definitions'

export class ImageListExecutor extends BaseNodeExecutor {
  constructor() {
    super('image_list')
  }

  async execute(
    inputs: Record<string, any>,
    config: ListNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行图片列表节点')

      const images: string[] = []

      // 收集所有输入的图片 (image_1 - image_10，兼容 image1 - image10)
      for (let i = 1; i <= 10; i++) {
        // 优先使用带下划线的格式，兼容不带下划线的格式
        const imageKey = inputs[`image_${i}`] ? `image_${i}` : `image${i}`
        if (inputs[imageKey]) {
          images.push(inputs[imageKey])
        }
      }

      // 如果有 images_input，也加入
      if (inputs.images_input && Array.isArray(inputs.images_input)) {
        images.push(...inputs.images_input)
      }

      // 限制最大容量
      const maxCapacity = config.maxCapacity || 100
      const finalImages = images.slice(0, maxCapacity)

      this.log(context, '图片列表收集完成', { count: finalImages.length })

      return this.success(
        {
          images: finalImages,
          count: String(finalImages.length),
          image_at_0: finalImages[0] || null,
          image_at_1: finalImages[1] || null,
          image_at_2: finalImages[2] || null
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '图片列表节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default ImageListExecutor
