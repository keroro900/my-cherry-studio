/**
 * 数据合并器节点
 * 合并多个数据管道
 */

import type { NodeDefinition } from '../../base/types'
import { PipeMergerExecutor } from './executor'

export const PipeMergerNode: NodeDefinition = {
  metadata: {
    type: 'pipe_merger',
    label: '数据合并器',
    icon: '🔗',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '合并多个数据管道',
    tags: ['pipe', 'merger', 'flow']
  },

  inputs: [
    { id: 'in1', label: '输入1', dataType: 'any' },
    { id: 'in2', label: '输入2', dataType: 'any' },
    { id: 'in3', label: '输入3', dataType: 'any' },
    { id: 'in4', label: '输入4', dataType: 'any' }
  ],

  outputs: [{ id: 'data', label: '合并数据', dataType: 'any' }],

  configSchema: {
    fields: [
      {
        key: 'mergeStrategy',
        label: '合并策略',
        type: 'select',
        default: 'concat',
        options: [
          { label: '连接', value: 'concat' },
          { label: '覆盖', value: 'override' },
          { label: '交错', value: 'interleave' }
        ]
      }
    ]
  },

  defaultConfig: {
    dataType: 'any',
    mergeStrategy: 'concat'
  },

  executor: new PipeMergerExecutor()
}

export { PipeMergerExecutor }
export default PipeMergerNode
