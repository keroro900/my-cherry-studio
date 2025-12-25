/**
 * 索引循环节点执行器
 * 按索引循环（for i in range）
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { LoopNodeConfig } from '../../definitions'

export class LoopIndexExecutor extends BaseNodeExecutor {
  constructor() {
    super('loop_index')
  }

  async execute(
    inputs: Record<string, any>,
    config: LoopNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行索引循环节点')

      const data = inputs.data
      const range = config.indexRange || { start: 0, end: 10, step: 1 }

      const results: any[] = []
      const maxIterations = config.maxIterations || 1000

      let iterations = 0
      for (let i = range.start; i < range.end && iterations < maxIterations; i += range.step || 1) {
        // 检查是否应该中止
        if (this.shouldAbort(context)) {
          this.log(context, '索引循环被用户中止')
          break
        }

        results.push({
          index: i,
          data: data
        })

        iterations++

        // 添加延迟
        if (config.iterationDelay && config.iterationDelay > 0) {
          await this.sleep(config.iterationDelay)
        }
      }

      this.log(context, '索引循环完成', { iterations })

      return this.success(
        {
          current: results[results.length - 1] || null,
          index: String(results.length > 0 ? results.length - 1 : 0),
          result: results
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '索引循环节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default LoopIndexExecutor
