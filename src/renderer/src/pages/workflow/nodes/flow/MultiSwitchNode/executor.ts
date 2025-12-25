/**
 * 多路选择节点执行器
 * 多个分支选择（类似 switch-case）
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { SwitchNodeConfig } from '../../definitions'

export class MultiSwitchExecutor extends BaseNodeExecutor {
  constructor() {
    super('multi_switch')
  }

  async execute(
    inputs: Record<string, any>,
    config: SwitchNodeConfig,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行多路选择节点')

      const data = inputs.data
      const selector = String(inputs.selector || '')

      const outputs: Record<string, any> = {
        case1: null,
        case2: null,
        case3: null,
        default: data
      }

      // 查找匹配的 case
      if (config.cases && Array.isArray(config.cases)) {
        for (let i = 0; i < config.cases.length; i++) {
          const caseItem = config.cases[i]
          if (selector === caseItem.value) {
            outputs[`case${i + 1}`] = data
            outputs.default = null
            this.log(context, '匹配到分支', { caseIndex: i + 1, value: caseItem.value })
            break
          }
        }
      }

      this.log(context, '多路选择完成', { selector })

      return this.success(outputs, Date.now() - startTime)
    } catch (error) {
      this.logError(context, '多路选择节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default MultiSwitchExecutor
