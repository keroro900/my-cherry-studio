/**
 * 循环执行节点执行器
 * 循环执行工作流片段
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { LoopNodeConfig } from '../../definitions'

export class LoopExecutor extends BaseNodeExecutor {
  constructor() {
    super('loop')
  }

  async execute(
    inputs: Record<string, any>,
    config: LoopNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行循环节点', { loopType: config.loopType })

      const data = inputs.data
      const condition = inputs.condition

      const results: any[] = []
      const maxIterations = config.maxIterations || 100
      let iterations = 0

      while (iterations < maxIterations) {
        // 检查是否应该中止
        if (this.shouldAbort(context)) {
          this.log(context, '循环被用户中止')
          break
        }

        // 评估循环条件
        if (config.loopType === 'condition') {
          if (!this.evaluateCondition(data, condition)) {
            break
          }
        }

        results.push({
          iteration: iterations,
          data: data
        })

        iterations++

        // 添加延迟
        if (config.iterationDelay && config.iterationDelay > 0) {
          await this.sleep(config.iterationDelay)
        }
      }

      this.log(context, '循环执行完成', { iterations })

      return this.success(
        {
          result: results,
          iterations: String(iterations)
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '循环节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 评估条件表达式 (安全实现，不使用 eval)
   * 支持的条件格式: "length > 0", "length === 5", "length >= 10" 等
   */
  private evaluateCondition(data: any, condition: string): boolean {
    if (!condition) return true

    try {
      // 安全的长度比较模式: "length > 0", "length === 5", "length >= 10"
      const lengthPattern = /^length\s*(===|==|!==|!=|>|<|>=|<=)\s*(\d+)$/
      const match = condition.trim().match(lengthPattern)

      if (match && Array.isArray(data)) {
        const [, operator, valueStr] = match
        const length = data.length
        const value = parseInt(valueStr, 10)

        switch (operator) {
          case '===':
          case '==':
            return length === value
          case '!==':
          case '!=':
            return length !== value
          case '>':
            return length > value
          case '<':
            return length < value
          case '>=':
            return length >= value
          case '<=':
            return length <= value
          default:
            return false
        }
      }

      return false
    } catch {
      return false
    }
  }
}

export default LoopExecutor
