/**
 * 条件开关节点
 * 根据条件选择分支
 */

import type { NodeDefinition } from '../../base/types'
import { SwitchExecutor } from './executor'

export const SwitchNode: NodeDefinition = {
  metadata: {
    type: 'switch',
    label: '条件开关',
    icon: '🔀',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '根据条件选择分支',
    tags: ['switch', 'condition', 'flow']
  },

  inputs: [
    { id: 'data', label: '输入数据', dataType: 'any', required: true },
    { id: 'condition', label: '条件值', dataType: 'text' }
  ],

  outputs: [
    { id: 'true', label: '满足条件', dataType: 'any' },
    { id: 'false', label: '不满足', dataType: 'any' }
  ],

  configSchema: {
    fields: [
      {
        key: 'conditionType',
        label: '条件类型',
        type: 'select',
        default: 'exists',
        options: [
          { label: '存在检查', value: 'exists' },
          { label: '值比较', value: 'value' },
          { label: '数量检查', value: 'count' }
        ]
      },
      {
        key: 'condition',
        label: '条件表达式',
        type: 'text',
        default: '',
        placeholder: '输入条件表达式'
      },
      {
        key: 'defaultBranch',
        label: '默认分支',
        type: 'select',
        default: 'false',
        options: [
          { label: '满足条件', value: 'true' },
          { label: '不满足', value: 'false' },
          { label: '无', value: 'none' }
        ]
      }
    ]
  },

  defaultConfig: {
    conditionType: 'exists',
    defaultBranch: 'false'
  },

  executor: new SwitchExecutor()
}

export { SwitchExecutor }
export default SwitchNode
