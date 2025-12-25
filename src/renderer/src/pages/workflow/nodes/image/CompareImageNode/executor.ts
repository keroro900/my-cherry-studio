/**
 * 图片对比节点执行器 v2.0
 *
 * 纯展示节点 - 用于在节点内直接预览 Before/After 对比效果
 * 无输出端口，不产生新图片
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface CompareImageConfig {
  initialPosition?: number
  showLabels?: boolean
  previewSize?: 'small' | 'medium' | 'large'
}

export class CompareImageExecutor extends BaseNodeExecutor {
  constructor() {
    super('compare_image')
  }

  async execute(
    inputs: Record<string, any>,
    config: CompareImageConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行图片对比节点')

      // 获取两张图片（支持多种输入名称）
      const beforeImage = inputs.beforeImage || inputs.originalImage || inputs.image1 || inputs.image
      const afterImage = inputs.afterImage || inputs.newImage || inputs.image2

      if (!beforeImage) {
        return this.error('缺少原图 (Before) 输入')
      }

      if (!afterImage) {
        return this.error('缺少编辑后 (After) 输入')
      }

      this.log(context, '收集到两张图片用于对比', {
        hasBefore: !!beforeImage,
        hasAfter: !!afterImage,
        config: {
          initialPosition: config.initialPosition ?? 50,
          showLabels: config.showLabels ?? true,
          previewSize: config.previewSize ?? 'medium'
        }
      })

      // 纯展示节点 - 将图片数据存储在 result 中供 UI 渲染
      // 不产生输出，但需要返回成功状态
      const outputs = {
        // 存储对比数据供节点 UI 使用
        _compareData: {
          beforeImage,
          afterImage,
          initialPosition: config.initialPosition ?? 50,
          showLabels: config.showLabels ?? true,
          previewSize: config.previewSize ?? 'medium'
        }
      }

      this.log(context, '图片对比节点执行完成')

      return this.success(outputs, Date.now() - startTime)
    } catch (error) {
      this.logError(context, '图片对比节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default CompareImageExecutor
