/**
 * 质量检查节点
 *
 * 评估内容（图片/代码/文本/提示词/工作流）的质量
 * 输出质量评分、详细检查项和改进建议
 */

import type { NodeDefinition } from '../../base/types'
import { QualityCheckExecutor } from './executor'

export const QualityCheckNode: NodeDefinition = {
  metadata: {
    type: 'quality_check',
    label: '质量检查',
    icon: '🔍',
    category: 'flow',
    version: '1.0.0',
    description: '评估内容质量，输出评分、检查详情和改进建议',
    tags: ['quality', 'check', 'evaluation', 'AI']
  },

  inputs: [
    {
      id: 'content',
      label: '内容',
      dataType: 'any',
      required: true,
      description: '要检查质量的内容（文本/图片/代码等）'
    },
    {
      id: 'reference',
      label: '参考内容',
      dataType: 'any',
      required: false,
      description: '用于对比的参考内容（可选）'
    },
    {
      id: 'prompt',
      label: '原始提示词',
      dataType: 'text',
      required: false,
      description: '生成内容时使用的原始提示词（可选）'
    }
  ],

  outputs: [
    {
      id: 'passed',
      label: '通过',
      dataType: 'boolean',
      description: '是否通过质量检查'
    },
    {
      id: 'score',
      label: '评分',
      dataType: 'number',
      description: '质量评分 (0-100)'
    },
    {
      id: 'report',
      label: '报告',
      dataType: 'text',
      description: '质量评估报告（Markdown 格式）'
    },
    {
      id: 'metrics',
      label: '指标详情',
      dataType: 'json',
      description: '完整的质量指标数据'
    },
    {
      id: 'suggestions',
      label: '改进建议',
      dataType: 'json',
      description: '改进建议列表'
    },
    {
      id: 'content_out',
      label: '内容透传',
      dataType: 'any',
      description: '原始内容透传（方便后续处理）'
    }
  ],

  configSchema: {
    fields: [
      {
        key: 'contentType',
        label: '内容类型',
        type: 'select',
        required: true,
        default: 'auto',
        options: [
          { label: '自动检测', value: 'auto' },
          { label: '图片', value: 'image' },
          { label: '代码', value: 'code' },
          { label: '文本', value: 'text' },
          { label: '提示词', value: 'prompt' },
          { label: '工作流', value: 'workflow' }
        ],
        description: '要检查的内容类型'
      },
      {
        key: 'checkLevel',
        label: '检查级别',
        type: 'select',
        required: false,
        default: 'standard',
        options: [
          { label: '基础检查', value: 'basic' },
          { label: '标准检查', value: 'standard' },
          { label: '深度检查', value: 'thorough' }
        ],
        description: '检查的详细程度'
      },
      {
        key: 'minScore',
        label: '最低通过分',
        type: 'number',
        required: false,
        default: 60,
        min: 0,
        max: 100,
        description: '低于此分数视为不通过'
      },
      {
        key: 'enableAutoFix',
        label: '生成修复建议',
        type: 'checkbox',
        default: true,
        description: '是否生成自动修复建议'
      },
      {
        key: 'outputFormat',
        label: '报告格式',
        type: 'select',
        default: 'markdown',
        options: [
          { label: 'Markdown', value: 'markdown' },
          { label: '纯文本', value: 'text' },
          { label: 'JSON', value: 'json' }
        ],
        description: '输出报告的格式'
      },
      {
        key: 'focusAreas',
        label: '重点关注',
        type: 'text',
        placeholder: 'clarity,structure',
        description: '逗号分隔的重点检查项（可选）'
      }
    ]
  },

  configUI: {
    hideModelSelector: true
  },

  defaultConfig: {
    contentType: 'auto',
    checkLevel: 'standard',
    minScore: 60,
    enableAutoFix: true,
    outputFormat: 'markdown',
    focusAreas: ''
  },

  executor: new QualityCheckExecutor()
}

export { QualityCheckExecutor }
export default QualityCheckNode
