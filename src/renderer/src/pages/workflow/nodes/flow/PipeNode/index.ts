/**
 * 数据管道节点
 * 通用数据管道，支持命名传输
 */

import type { NodeDefinition } from '../../base/types'
import { PipeExecutor } from './executor'

export const PipeNode: NodeDefinition = {
  metadata: {
    type: 'pipe',
    label: '数据管道',
    icon: '🚰',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '通用数据管道，支持命名传输',
    tags: ['pipe', 'data', 'flow']
  },

  inputs: [{ id: 'data', label: '输入数据', dataType: 'any', required: true }],

  outputs: [{ id: 'data', label: '输出数据', dataType: 'any' }],

  configSchema: {
    fields: [
      {
        key: 'pipeName',
        label: '管道名称',
        type: 'text',
        default: 'default_pipe',
        placeholder: '输入管道名称'
      }
    ]
  },

  defaultConfig: {
    pipeName: 'default_pipe',
    dataType: 'any'
  },

  executor: new PipeExecutor()
}

export { PipeExecutor }
export default PipeNode
