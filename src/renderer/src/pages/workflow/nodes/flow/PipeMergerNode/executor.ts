/**
 * 数据合并器节点执行器
 * 合并多个数据管道
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { PipeNodeConfig } from '../../definitions'

export class PipeMergerExecutor extends BaseNodeExecutor {
  constructor() {
    super('pipe_merger')
  }

  async execute(
    inputs: Record<string, any>,
    config: PipeNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行数据合并器节点', { strategy: config.mergeStrategy })

      const mergeStrategy = config.mergeStrategy || 'concat'

      // 收集所有输入数据
      const inputData: any[] = []
      for (const key of ['in1', 'in2', 'in3', 'in4']) {
        if (inputs[key] !== null && inputs[key] !== undefined) {
          inputData.push(inputs[key])
        }
      }

      let merged: any

      if (mergeStrategy === 'concat') {
        // 连接数组
        merged = inputData.flat()
      } else if (mergeStrategy === 'override') {
        // 后者覆盖前者
        merged = inputData[inputData.length - 1]
      } else if (mergeStrategy === 'interleave') {
        // 交错合并
        merged = this.interleaveArrays(inputData)
      } else {
        merged = inputData
      }

      this.log(context, '数据合并完成', { inputCount: inputData.length })

      return this.success(
        {
          data: merged
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '数据合并器节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }

  /**
   * 交错合并数组
   */
  private interleaveArrays(arrays: any[][]): any[] {
    const result: any[] = []
    const maxLength = Math.max(...arrays.map((arr) => (Array.isArray(arr) ? arr.length : 1)))

    for (let i = 0; i < maxLength; i++) {
      for (const arr of arrays) {
        if (Array.isArray(arr) && i < arr.length) {
          result.push(arr[i])
        } else if (!Array.isArray(arr) && i === 0) {
          result.push(arr)
        }
      }
    }

    return result
  }
}

export default PipeMergerExecutor
