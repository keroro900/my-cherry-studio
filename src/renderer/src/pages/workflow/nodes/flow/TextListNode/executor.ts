/**
 * 文本列表节点执行器
 * 管理文本列表，支持批量prompt
 */

import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'
import type { ListNodeConfig } from '../../definitions'

export class TextListExecutor extends BaseNodeExecutor {
  constructor() {
    super('text_list')
  }

  async execute(
    inputs: Record<string, any>,
    config: ListNodeConfig & { separator?: string },
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      this.log(context, '开始执行文本列表节点')

      const texts: string[] = []

      // 收集所有输入的文本 (text1 - text10)
      for (let i = 1; i <= 10; i++) {
        const textKey = `text${i}`
        if (inputs[textKey]) {
          texts.push(String(inputs[textKey]))
        }
      }

      // 限制最大容量
      const maxCapacity = config.maxCapacity || 100
      const finalTexts = texts.slice(0, maxCapacity)

      // 合并文本
      const separator = config.separator || '\n'
      const joined = finalTexts.join(separator)

      this.log(context, '文本列表收集完成', { count: finalTexts.length })

      return this.success(
        {
          texts: finalTexts,
          count: String(finalTexts.length),
          joined
        },
        Date.now() - startTime
      )
    } catch (error) {
      this.logError(context, '文本列表节点执行失败', error)
      return this.error(error instanceof Error ? error.message : String(error), Date.now() - startTime)
    }
  }
}

export default TextListExecutor
