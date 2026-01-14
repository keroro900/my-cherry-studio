/**
 * 自动优化节点
 *
 * 基于质量评估结果自动优化内容
 * 支持提示词优化、配置调整等
 */

import type { NodeDefinition } from '../../base/types'
import { AutoOptimizeExecutor } from './executor'

export const AutoOptimizeNode: NodeDefinition = {
  metadata: {
    type: 'auto_optimize',
    label: '自动优化',
    icon: '⚡',
    category: 'flow',
    version: '1.0.0',
    description: '基于质量评估自动优化内容，支持提示词、配置和代码的智能优化',
    tags: ['quality', 'optimize', 'auto', 'AI']
  },

  inputs: [
    {
      id: 'content',
      label: '原始内容',
      dataType: 'any',
      required: true,
      description: '需要优化的原始内容'
    },
    {
      id: 'metrics',
      label: '质量指标',
      dataType: 'json',
      required: false,
      description: '来自质量检查节点的指标（可选，无则自动评估）'
    },
    {
      id: 'context',
      label: '上下文',
      dataType: 'text',
      required: false,
      description: '额外的上下文信息'
    }
  ],

  outputs: [
    {
      id: 'optimized',
      label: '优化结果',
      dataType: 'any',
      description: '优化后的内容'
    },
    {
      id: 'improved',
      label: '是否改进',
      dataType: 'boolean',
      description: '优化是否带来了改进'
    },
    {
      id: 'before_score',
      label: '优化前分数',
      dataType: 'number',
      description: '优化前的质量分数'
    },
    {
      id: 'after_score',
      label: '优化后分数',
      dataType: 'number',
      description: '优化后的质量分数'
    },
    {
      id: 'changes',
      label: '变更详情',
      dataType: 'json',
      description: '所做的变更列表'
    },
    {
      id: 'report',
      label: '优化报告',
      dataType: 'text',
      description: '优化过程报告'
    }
  ],

  configSchema: {
    fields: [
      {
        key: 'targetType',
        label: '目标类型',
        type: 'select',
        required: true,
        default: 'prompt',
        options: [
          { label: '提示词', value: 'prompt' },
          { label: '配置', value: 'config' },
          { label: '代码', value: 'code' },
          { label: '工作流', value: 'workflow' }
        ],
        description: '要优化的内容类型'
      },
      {
        key: 'style',
        label: '优化风格',
        type: 'select',
        default: 'moderate',
        options: [
          { label: '保守 (最小改动)', value: 'conservative' },
          { label: '适中 (平衡改动)', value: 'moderate' },
          { label: '激进 (大幅改动)', value: 'aggressive' }
        ],
        description: '优化的激进程度'
      },
      {
        key: 'targetScore',
        label: '目标分数',
        type: 'number',
        default: 80,
        min: 0,
        max: 100,
        description: '期望达到的质量分数'
      },
      {
        key: 'maxIterations',
        label: '最大迭代次数',
        type: 'number',
        default: 3,
        min: 1,
        max: 10,
        description: '最多尝试优化的次数'
      },
      {
        key: 'preserveSemantics',
        label: '保持语义一致',
        type: 'checkbox',
        default: true,
        description: '优化时保持原始语义不变'
      },
      {
        key: 'requireApproval',
        label: '需要用户确认',
        type: 'checkbox',
        default: false,
        description: '应用高风险修改前需要用户确认'
      }
    ]
  },

  configUI: {
    hideModelSelector: false,
    showPromptEditor: false
  },

  defaultConfig: {
    targetType: 'prompt',
    style: 'moderate',
    targetScore: 80,
    maxIterations: 3,
    preserveSemantics: true,
    requireApproval: false
  },

  executor: new AutoOptimizeExecutor()
}

export { AutoOptimizeExecutor }
export default AutoOptimizeNode
