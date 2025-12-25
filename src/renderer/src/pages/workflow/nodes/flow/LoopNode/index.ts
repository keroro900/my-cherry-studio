/**
 * 循环执行节点
 * 循环执行工作流片段
 */

import type { NodeDefinition } from '../../base/types'
import { LoopExecutor } from './executor'

export const LoopNode: NodeDefinition = {
  metadata: {
    type: 'loop',
    label: '循环执行',
    icon: '🔁',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '循环执行工作流片段',
    tags: ['loop', 'iteration', 'flow']
  },

  inputs: [
    { id: 'data', label: '输入数据', dataType: 'any', required: true },
    { id: 'condition', label: '循环条件', dataType: 'text' }
  ],

  outputs: [
    { id: 'result', label: '循环结果', dataType: 'any' },
    { id: 'iterations', label: '迭代次数', dataType: 'text' }
  ],

  configSchema: {
    fields: [
      {
        key: 'maxIterations',
        label: '最大迭代次数',
        type: 'number',
        default: 100,
        min: 1,
        max: 10000,
        description: '防止死循环'
      },
      {
        key: 'iterationDelay',
        label: '迭代间隔(ms)',
        type: 'number',
        default: 0,
        min: 0,
        max: 10000,
        description: '每次迭代之间的延迟'
      },
      {
        key: 'allowBreak',
        label: '允许中断',
        type: 'checkbox',
        default: true
      }
    ]
  },

  defaultConfig: {
    loopType: 'condition',
    maxIterations: 100,
    allowBreak: true,
    iterationDelay: 0
  },

  executor: new LoopExecutor()
}

export { LoopExecutor }
export default LoopNode
