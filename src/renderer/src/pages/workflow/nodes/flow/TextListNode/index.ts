/**
 * 文本列表节点
 * 管理文本列表，支持批量prompt
 */

import type { NodeDefinition } from '../../base/types'
import { TextListExecutor } from './executor'

export const TextListNode: NodeDefinition = {
  metadata: {
    type: 'text_list',
    label: '文本列表',
    icon: '📝',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '管理文本列表，支持批量prompt',
    tags: ['list', 'text', 'batch']
  },

  inputs: [
    { id: 'text1', label: '文本1', dataType: 'text' },
    { id: 'text2', label: '文本2', dataType: 'text' },
    { id: 'text3', label: '文本3', dataType: 'text' },
    { id: 'text4', label: '文本4', dataType: 'text' },
    { id: 'text5', label: '文本5', dataType: 'text' }
  ],

  outputs: [
    { id: 'texts', label: '文本列表', dataType: 'any' },
    { id: 'count', label: '数量', dataType: 'text' },
    { id: 'joined', label: '合并文本', dataType: 'text' }
  ],

  configSchema: {
    fields: [
      {
        key: 'maxCapacity',
        label: '最大容量',
        type: 'number',
        default: 100,
        min: 1,
        max: 1000,
        description: '列表最大文本数量'
      },
      {
        key: 'separator',
        label: '合并分隔符',
        type: 'text',
        default: '\n',
        description: '合并文本时使用的分隔符'
      }
    ]
  },

  defaultConfig: {
    listType: 'text',
    maxCapacity: 100
  },

  executor: new TextListExecutor()
}

export { TextListExecutor }
export default TextListNode
