/**
 * 数据管道节点执行器
 * 通用数据管道，支持命名传输
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { PipeNodeConfig } from '../../definitions'

export class PipeExecutor extends BaseNodeExecutor {
  constructor() {
    super('pipe')
  }

  async execute(
    inputs: Record<string, any>,
    config: PipeNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行数据管道节点', { pipeName: config.pipeName })

      const data = inputs.data

      this.log(context, '数据管道传输完成', {
        pipeName: config.pipeName,
        dataType: typeof data
      })

      return this.success(
        {
          data
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '数据管道节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default PipeExecutor
