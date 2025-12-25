/**
 * 多路选择节点
 * 多个分支选择（类似 switch-case）
 */

import type { NodeDefinition } from '../../base/types'
import { MultiSwitchExecutor } from './executor'

export const MultiSwitchNode: NodeDefinition = {
  metadata: {
    type: 'multi_switch',
    label: '多路选择',
    icon: '🎚️',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '多个分支选择（类似 switch-case）',
    tags: ['switch', 'multi', 'flow']
  },

  inputs: [
    { id: 'data', label: '输入数据', dataType: 'any', required: true },
    { id: 'selector', label: '选择器', dataType: 'text', required: true }
  ],

  outputs: [
    { id: 'case1', label: '分支1', dataType: 'any' },
    { id: 'case2', label: '分支2', dataType: 'any' },
    { id: 'case3', label: '分支3', dataType: 'any' },
    { id: 'default', label: '默认分支', dataType: 'any' }
  ],

  configSchema: {
    fields: [
      {
        key: 'cases',
        label: '分支配置',
        type: 'textarea',
        default: '',
        placeholder: '输入分支配置（JSON格式）',
        description: '定义各分支的匹配值'
      }
    ]
  },

  defaultConfig: {
    conditionType: 'value',
    cases: [
      { value: 'case1', label: '分支1' },
      { value: 'case2', label: '分支2' },
      { value: 'case3', label: '分支3' }
    ]
  },

  executor: new MultiSwitchExecutor()
}

export { MultiSwitchExecutor }
export default MultiSwitchNode
