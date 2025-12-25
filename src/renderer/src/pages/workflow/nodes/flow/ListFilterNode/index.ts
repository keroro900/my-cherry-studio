/**
 * 列表筛选节点
 * 根据条件筛选列表元素
 */

import type { NodeDefinition } from '../../base/types'
import { ListFilterExecutor } from './executor'

export const ListFilterNode: NodeDefinition = {
  metadata: {
    type: 'list_filter',
    label: '列表筛选',
    icon: '🔍',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '根据条件筛选列表元素',
    tags: ['list', 'filter', 'batch']
  },

  inputs: [{ id: 'list', label: '输入列表', dataType: 'any', required: true }],

  outputs: [
    { id: 'filtered', label: '筛选结果', dataType: 'any' },
    { id: 'count', label: '结果数量', dataType: 'text' }
  ],

  configSchema: {
    fields: [
      {
        key: 'filterCondition.operator',
        label: '筛选条件',
        type: 'select',
        default: 'contains',
        options: [
          { label: '包含', value: 'contains' },
          { label: '等于', value: 'equals' },
          { label: '开头是', value: 'starts_with' },
          { label: '结尾是', value: 'ends_with' },
          { label: '不包含', value: 'not_contains' }
        ]
      },
      {
        key: 'filterCondition.value',
        label: '筛选值',
        type: 'text',
        default: '',
        placeholder: '输入筛选条件值'
      }
    ]
  },

  defaultConfig: {
    operation: 'filter',
    filterCondition: {
      operator: 'contains',
      value: ''
    }
  },

  executor: new ListFilterExecutor()
}

export { ListFilterExecutor }
export default ListFilterNode
