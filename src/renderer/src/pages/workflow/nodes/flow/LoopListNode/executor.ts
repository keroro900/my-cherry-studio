/**
 * 列表循环节点执行器
 * 遍历列表元素（for item in list）
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { LoopNodeConfig } from '../../definitions'

export class LoopListExecutor extends BaseNodeExecutor {
  constructor() {
    super('loop_list')
  }

  async execute(
    inputs: Record<string, any>,
    config: LoopNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行列表循环节点')

      const list = inputs.list

      if (!Array.isArray(list)) {
        this.log(context, '输入不是数组，返回空结果')
        return this.success(
          {
            current: null,
            index: '0',
            result: []
          },
          Date.now() - startTime
        )
      }

      const results: any[] = []
      const maxIterations = config.maxIterations || 1000

      for (let i = 0; i < list.length && i < maxIterations; i++) {
        // 检查是否应该中止
        if (this.shouldAbort(context)) {
          this.log(context, '列表循环被用户中止')
          break
        }

        results.push({
          index: i,
          item: list[i]
        })

        // 添加延迟
        if (config.iterationDelay && config.iterationDelay > 0) {
          await this.sleep(config.iterationDelay)
        }
      }

      this.log(context, '列表循环完成', { iterations: results.length })

      return this.success(
        {
          current: results[results.length - 1] || null,
          index: String(results.length > 0 ? results.length - 1 : 0),
          result: results
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '列表循环节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default LoopListExecutor
