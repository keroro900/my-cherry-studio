/**
 * 条件开关节点执行器
 * 根据条件选择分支
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { SwitchNodeConfig } from '../../definitions'

export class SwitchExecutor extends BaseNodeExecutor {
  constructor() {
    super('switch')
  }

  async execute(
    inputs: Record<string, any>,
    config: SwitchNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行条件开关节点', { conditionType: config.conditionType })

      const data = inputs.data
      let conditionMet = false

      if (config.conditionType === 'exists') {
        conditionMet = data !== null && data !== undefined
      } else if (config.conditionType === 'value') {
        conditionMet = this.evaluateCondition(data, config.condition || '')
      } else if (config.conditionType === 'count') {
        if (Array.isArray(data)) {
          conditionMet = data.length > 0
        }
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
      this.logError(context, '条件开关节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(data: any, condition: string): boolean {
    if (!condition) return true

    try {
      if (condition.includes('length')) {
        if (Array.isArray(data)) {
          const expression = condition.replace(/length/g, String(data.length))
          return this.evaluateNumericBooleanExpression(expression)
        }
      }
      return false
    } catch {
      return false
    }
  }

  private evaluateNumericBooleanExpression(expression: string): boolean {
    const orParts = expression
      .split('||')
      .map((p) => p.trim())
      .filter(Boolean)

    if (orParts.length === 0) return false

    return orParts.some((orPart) => {
      const andParts = orPart
        .split('&&')
        .map((p) => p.trim())
        .filter(Boolean)

      if (andParts.length === 0) return false
      return andParts.every((andPart) => this.evaluateSimpleComparison(andPart))
    })
  }

  private evaluateSimpleComparison(expression: string): boolean {
    const match = expression.match(/^\s*(-?\d+(?:\.\d+)?)\s*(===|==|!==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (!match) return false

    const left = Number(match[1])
    const operator = match[2]
    const right = Number(match[3])

    switch (operator) {
      case '===':
      case '==':
        return left === right
      case '!==':
      case '!=':
        return left !== right
      case '>':
        return left > right
      case '>=':
        return left >= right
      case '<':
        return left < right
      case '<=':
        return left <= right
      default:
        return false
    }
  }
}

export default SwitchExecutor
