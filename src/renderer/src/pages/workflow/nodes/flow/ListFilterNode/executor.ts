/**
 * 列表筛选节点执行器
 * 根据条件筛选列表元素
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { ListNodeConfig } from '../../definitions'

export class ListFilterExecutor extends BaseNodeExecutor {
  constructor() {
    super('list_filter')
  }

  async execute(
    inputs: Record<string, any>,
    config: ListNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行列表筛选节点')

      const inputList = inputs.list

      if (!Array.isArray(inputList)) {
        this.log(context, '输入不是数组，返回空列表')
        return this.success(
          {
            filtered: [],
            count: '0'
          },
          Date.now() - startTime
        )
      }

      const filterCondition = config.filterCondition
      if (!filterCondition || !filterCondition.value) {
        // 没有筛选条件，返回原列表
        return this.success(
          {
            filtered: inputList,
            count: String(inputList.length)
          },
          Date.now() - startTime
        )
      }

      // 应用筛选条件
      const filtered = inputList.filter((item) => {
        const itemStr = String(item)
        const value = filterCondition.value || ''

        switch (filterCondition.operator) {
          case 'contains':
            return itemStr.includes(value)
          case 'equals':
            return itemStr === value
          case 'starts_with':
            return itemStr.startsWith(value)
          case 'ends_with':
            return itemStr.endsWith(value)
          case 'not_contains':
            return !itemStr.includes(value)
          default:
            return true
        }
      })

      this.log(context, '列表筛选完成', { originalCount: inputList.length, filteredCount: filtered.length })

      return this.success(
        {
          filtered,
          count: String(filtered.length)
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '列表筛选节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default ListFilterExecutor
