/**
 * 列表合并节点
 * 合并多个列表
 */

import type { NodeDefinition } from '../../base/types'
import { ListMergeExecutor } from './executor'

export const ListMergeNode: NodeDefinition = {
  metadata: {
    type: 'list_merge',
    label: '列表合并',
    icon: '🔀',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '合并多个列表',
    tags: ['list', 'merge', 'batch']
  },

  inputs: [
    { id: 'list1', label: '列表1', dataType: 'any', required: true },
    { id: 'list2', label: '列表2', dataType: 'any', required: true },
    { id: 'list3', label: '列表3', dataType: 'any' },
    { id: 'list4', label: '列表4', dataType: 'any' }
  ],

  outputs: [
    { id: 'merged', label: '合并列表', dataType: 'any' },
    { id: 'count', label: '总数量', dataType: 'text' }
  ],

  configSchema: {
    fields: [
      {
        key: 'removeDuplicates',
        label: '去重',
        type: 'checkbox',
        default: false,
        description: '是否移除重复元素'
      }
    ]
  },

  defaultConfig: {
    operation: 'merge'
  },

  executor: new ListMergeExecutor()
}

export { ListMergeExecutor }
export default ListMergeNode
