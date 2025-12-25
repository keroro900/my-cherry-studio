/**
 * 列表合并节点执行器
 * 合并多个列表
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { ListNodeConfig } from '../../definitions'

export class ListMergeExecutor extends BaseNodeExecutor {
  constructor() {
    super('list_merge')
  }

  async execute(
    inputs: Record<string, any>,
    config: ListNodeConfig & { removeDuplicates?: boolean },
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行列表合并节点')

      const merged: any[] = []

      // 合并所有列表输入
      for (const key of ['list1', 'list2', 'list3', 'list4']) {
        if (inputs[key]) {
          if (Array.isArray(inputs[key])) {
            merged.push(...inputs[key])
          } else {
            merged.push(inputs[key])
          }
        }
      }

      // 去重（如果配置了）
      let finalMerged = merged
      if (config.removeDuplicates) {
        finalMerged = [...new Set(merged)]
      }

      this.log(context, '列表合并完成', { count: finalMerged.length })

      return this.success(
        {
          merged: finalMerged,
          count: String(finalMerged.length)
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '列表合并节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default ListMergeExecutor
