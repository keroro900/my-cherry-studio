/**
 * 数据路由器节点
 * 根据规则将数据路由到不同管道
 */

import type { NodeDefinition } from '../../base/types'
import { PipeRouterExecutor } from './executor'

export const PipeRouterNode: NodeDefinition = {
  metadata: {
    type: 'pipe_router',
    label: '数据路由器',
    icon: '🔀',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '根据规则将数据路由到不同管道',
    tags: ['pipe', 'router', 'flow']
  },

  inputs: [{ id: 'data', label: '输入数据', dataType: 'any', required: true }],

  outputs: [
    { id: 'out1', label: '输出1', dataType: 'any' },
    { id: 'out2', label: '输出2', dataType: 'any' },
    { id: 'out3', label: '输出3', dataType: 'any' },
    { id: 'default', label: '默认输出', dataType: 'any' }
  ],

  configSchema: {
    fields: [
      {
        key: 'routingRules',
        label: '路由规则',
        type: 'textarea',
        default: '',
        placeholder: '输入路由规则（JSON格式）',
        description: '定义数据路由规则'
      }
    ]
  },

  defaultConfig: {
    dataType: 'any',
    routingRules: []
  },

  executor: new PipeRouterExecutor()
}

export { PipeRouterExecutor }
export default PipeRouterNode
