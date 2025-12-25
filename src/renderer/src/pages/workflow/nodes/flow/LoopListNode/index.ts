/**
 * 列表循环节点
 * 遍历列表元素（for item in list）
 */

import type { NodeDefinition } from '../../base/types'
import { LoopListExecutor } from './executor'

export const LoopListNode: NodeDefinition = {
  metadata: {
    type: 'loop_list',
    label: '列表循环',
    icon: '📋',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '遍历列表元素（for item in list）',
    tags: ['loop', 'list', 'foreach', 'flow']
  },

  inputs: [{ id: 'list', label: '输入列表', dataType: 'any', required: true }],

  outputs: [
    { id: 'current', label: '当前项', dataType: 'any' },
    { id: 'index', label: '当前索引', dataType: 'text' },
    { id: 'result', label: '处理结果', dataType: 'any' }
  ],

  configSchema: {
    fields: [
      {
        key: 'maxIterations',
        label: '最大迭代次数',
        type: 'number',
        default: 1000,
        min: 1,
        max: 10000
      },
      {
        key: 'iterationDelay',
        label: '迭代间隔(ms)',
        type: 'number',
        default: 0,
        min: 0
      }
    ]
  },

  defaultConfig: {
    loopType: 'list',
    maxIterations: 1000,
    iterationDelay: 0
  },

  executor: new LoopListExecutor()
}

export { LoopListExecutor }
export default LoopListNode
