/**
 * 数据路由器节点执行器
 * 根据规则将数据路由到不同管道
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { PipeNodeConfig } from '../../definitions'

export class PipeRouterExecutor extends BaseNodeExecutor {
  constructor() {
    super('pipe_router')
  }

  async execute(
    inputs: Record<string, any>,
    config: PipeNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行数据路由器节点')

      const data = inputs.data

      const outputs: Record<string, any> = {
        default: data,
        out1: null,
        out2: null,
        out3: null
      }

      // 应用路由规则
      if (config.routingRules && Array.isArray(config.routingRules)) {
        for (let i = 0; i < config.routingRules.length; i++) {
          const rule = config.routingRules[i]
          if (this.evaluateCondition(data, rule.condition)) {
            outputs[`out${i + 1}`] = data
            outputs.default = null // 匹配到规则后，默认输出为空
            this.log(context, '路由规则匹配', { ruleIndex: i, condition: rule.condition })
            break
          }
        }
      }

      this.log(context, '数据路由完成')

      return this.success(outputs, Date.now() - startTime)
    } catch (error) {
      this.logError(context, '数据路由器节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(data: any, condition: string): boolean {
    if (!condition) return false

    try {
      // 简单的条件评估
      if (condition.includes('length')) {
        if (Array.isArray(data)) {
          const expression = condition.replace(/length/g, String(data.length))
          return this.evaluateNumericBooleanExpression(expression)
        }
      }

      if (condition.includes('exists')) {
        return data !== null && data !== undefined
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

export default PipeRouterExecutor
