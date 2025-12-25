/**
 * 索引循环节点
 * 按索引循环（for i in range）
 */

import type { NodeDefinition } from '../../base/types'
import { LoopIndexExecutor } from './executor'

export const LoopIndexNode: NodeDefinition = {
  metadata: {
    type: 'loop_index',
    label: '索引循环',
    icon: '🔢',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '按索引循环（for i in range）',
    tags: ['loop', 'index', 'range', 'flow']
  },

  inputs: [{ id: 'data', label: '输入数据', dataType: 'any', required: true }],

  outputs: [
    { id: 'current', label: '当前项', dataType: 'any' },
    { id: 'index', label: '当前索引', dataType: 'text' },
    { id: 'result', label: '循环结果', dataType: 'any' }
  ],

  configSchema: {
    fields: [
      {
        key: 'indexRange.start',
        label: '起始索引',
        type: 'number',
        default: 0
      },
      {
        key: 'indexRange.end',
        label: '结束索引',
        type: 'number',
        default: 10
      },
      {
        key: 'indexRange.step',
        label: '步长',
        type: 'number',
        default: 1,
        min: 1
      },
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
    loopType: 'index',
    indexRange: {
      start: 0,
      end: 10,
      step: 1
    },
    maxIterations: 1000
  },

  executor: new LoopIndexExecutor()
}

export { LoopIndexExecutor }
export default LoopIndexNode
