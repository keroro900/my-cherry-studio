/**
 * 条件分支节点定义
 */

import type { NodeDefinition } from '../../base/types'
import { ConditionExecutor } from './executor'

export const ConditionNode: NodeDefinition = {
  metadata: {
    type: 'condition',
    label: '条件分支',
    icon: '🔀',
    category: 'flow',
    version: '1.0.0',
    description: '根据条件判断执行不同分支',
    tags: ['flow', 'condition', 'branch', 'logic']
  },

  inputs: [{ id: 'data', label: '输入数据', dataType: 'json', required: true, description: '要判断的 JSON 数据' }],

  outputs: [
    { id: 'true', label: '满足条件', dataType: 'any', description: '条件满足时输出数据' },
    { id: 'false', label: '不满足', dataType: 'any', description: '条件不满足时输出数据' }
  ],

  configSchema: {
    fields: [
      {
        key: 'field',
        label: '字段名',
        type: 'text',
        placeholder: '输入要检查的字段名',
        description: '从输入 JSON 中获取的字段'
      },
      {
        key: 'operator',
        label: '比较操作',
        type: 'select',
        default: 'equals',
        options: [
          { label: '等于', value: 'equals' },
          { label: '不等于', value: 'not_equals' },
          { label: '包含', value: 'contains' },
          { label: '不包含', value: 'not_contains' },
          { label: '开头是', value: 'starts_with' },
          { label: '结尾是', value: 'ends_with' },
          { label: '存在', value: 'exists' },
          { label: '不存在', value: 'not_exists' }
        ]
      },
      {
        key: 'value',
        label: '比较值',
        type: 'text',
        placeholder: '输入比较值',
        description: '与字段值进行比较的值'
      }
    ]
  },

  defaultConfig: {
    field: '',
    operator: 'equals',
    value: ''
  },

  executor: new ConditionExecutor()
}

export { ConditionExecutor }
export default ConditionNode
