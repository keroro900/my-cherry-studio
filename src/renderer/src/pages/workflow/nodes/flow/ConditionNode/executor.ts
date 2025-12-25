/**
 * 条件分支节点执行器
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export interface ConditionConfig {
  field: string
  operator:
    | 'equals'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'not_contains'
    | 'not_equals'
    | 'exists'
    | 'not_exists'
  value: string
}

export class ConditionExecutor extends BaseNodeExecutor {
  constructor() {
    super('condition')
  }

  async execute(
    inputs: Record<string, any>,
    config: ConditionConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行条件节点', { field: config.field, operator: config.operator })

      const data = inputs.data

      if (!data || typeof data !== 'object') {
        this.log(context, '输入数据无效，条件不满足')
        return this.success({ true: null, false: inputs.data }, Date.now() - startTime)
      }

      // 获取字段值
      const fieldValue = String(data[config.field] || '').toLowerCase()
      const compareValue = String(config.value || '').toLowerCase()

      // 执行比较
      let conditionMet = false
      switch (config.operator) {
        case 'equals':
          conditionMet = fieldValue === compareValue
          break
        case 'contains':
          conditionMet = fieldValue.includes(compareValue)
          break
        case 'starts_with':
          conditionMet = fieldValue.startsWith(compareValue)
          break
        case 'ends_with':
          conditionMet = fieldValue.endsWith(compareValue)
          break
        case 'not_contains':
          conditionMet = !fieldValue.includes(compareValue)
          break
        case 'not_equals':
          conditionMet = fieldValue !== compareValue
          break
        case 'exists':
          conditionMet = data[config.field] !== undefined && data[config.field] !== null
          break
        case 'not_exists':
          conditionMet = data[config.field] === undefined || data[config.field] === null
          break
      }

      this.log(context, '条件判断完成', { conditionMet })

      return this.success(
        {
          true: conditionMet ? data : null,
          false: conditionMet ? null : data
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '条件判断失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default ConditionExecutor
